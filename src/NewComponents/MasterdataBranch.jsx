import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from "sweetalert2";
import { Modal, Button, Spinner } from "react-bootstrap";

export default function AccountsListManager() {
    const [data, setData] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showImportMenu, setShowImportMenu] = useState(false);
    const [importMode, setImportMode] = useState('add');
    

    const [showDistributorModal, setShowDistributorModal] = useState(false);
    const [showMotherModal, setShowMotherModal] = useState(false);
    const [showBpModal, setShowBpModal] = useState(false);
    const [showAgentModal, setShowAgentModal] = useState(false);

    const [distributors, setDistributors] = useState([]);
    const [motherAccounts, setMotherAccounts] = useState([]);
    const [motherAccountsMap, setMotherAccountsMap] = useState([{}]);
    const [bpAccounts, setBpAccounts] = useState([]);
    const [agents, setAgents] = useState([]);
    const [agentMap, setAgentMap] = useState({}); // 🔹 Map UserID -> name
const [motherMap, setMotherMap] = useState({}); // 🔹 Map dscode -> name
const [distributorMap, setDistributorMap] = useState({}); // 🔹 Map code -> name

    

    const [newRecord, setNewRecord] = useState({
        distributor_code: '',
        mother_code: '',
        bp_code: '',
        bp_name: '',
        agent_code: '',
        group_code: '',
        status: true
    });

    const itemsPerPage = 7;
    const exportMenuRef = useRef(null);
    const importMenuRef = useRef(null);
    const [totalCount, setTotalCount] = useState(0); // 👈 Add this line
    const [duplicatesChecked, setDuplicatesChecked] = useState(false); // ✅ track if check has been done


    // 🔹 Handle file selection

    // 🔹 Delete a row in preview
    const deleteImportRow = (index) => {
        const newData = [...importData];
        newData.splice(index, 1);
        setImportData(newData);
    };

    // 🔹 Check duplicates
    const checkExistingRecords = async () => {
        if (!importData.length) return;
        setChecking(true);

        const { data: existing, error } = await supabase
            .from("Accounts_List")
            .select("bp_code");

        if (error) {
            Swal.fire("Error", "Failed to check duplicates", "error");
            setChecking(false);
            return;
        }

        setExistingRows(existing);
        setChecking(false);
        setDuplicatesChecked(true); // ✅ mark as checked
    };

    // 🔹 Import data into DB
    const importDataToDB = async () => {
        if (!importData.length) return;
        setImporting(true);

        const newRows = importData.filter(
            (row) =>
                !existingRows.some(
                    (ex) =>
                        ex.bp_code.trim().toUpperCase() === row.bp_code.trim().toUpperCase()
                )
        );

        const { error } = await supabase.from("Accounts_List").insert(newRows);
        setImporting(false);

        if (error) {
            Swal.fire("Error", "Import failed.", "error");
        } else {
            Swal.fire("Success", "Data imported successfully!", "success");
            setShowExcelModal(false);
            setImportData([]);
            setDuplicatesChecked(true); // ✅ mark as checked

        }
    };

    const handleImportMother = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const data = await readExcelFile(file);
        if (!data.length) return;

        if (data.length > 40000) {
            Swal.fire({
                icon: 'error',
                title: 'Too Many Rows!',
                text: `Excel contains ${data.length.toLocaleString()} rows. Maximum allowed is 40,000 rows.`,
                confirmButtonText: 'OK'
            });
            return;
        }

        // ✅ Display file and data immediately
        setFileName(file.name);
        setImportData(data);
        setCurrentPageExcel(1);
        setTotalRows(data.length);
        setProcessedRows(0);
        setProgressPercent(0);
        setDuplicatesChecked(true); // ✅ mark as checked

        // ✅ Automatically check for duplicates
        await checkExistingRecords();


        let successCount = 0;
        let failedRows = [];
        let skippedRows = []; // ✅ for already-existing rows

        // ✅ Fetch reference tables
        const [
            { data: motherAccounts },
            { data: agentAccounts },
            { data: bpAccounts },
            { data: distributorAccounts }
        ] = await Promise.all([
            supabase.from('sub_mother_account').select('dscode, name, group_name, group_code'),
            supabase.from('Account_Users').select('UserID, name'),
            supabase.from('Bp_Accounts').select('bp_code, bp_name'),
            supabase.from('distributors').select('code, name')
        ]);

        const groupNameToCodeMap = {};
        motherAccounts?.forEach(m => {
            if (m.group_name && m.group_code) {
                const normalizedGroupName = m.group_name.toString().trim().toLowerCase();
                groupNameToCodeMap[normalizedGroupName] = m.group_code.toString();
            }
        });

        const motherLookup = {};
        motherAccounts?.forEach(m => {
            const groupCode = m.group_code?.toString().trim();
            const exactName = m.name?.toString().trim().toLowerCase();
            const normalizedName = exactName.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').replace(/\s+/g, ' ').trim();
            if (!groupCode || !m.name) return;
            if (!motherLookup[groupCode]) motherLookup[groupCode] = {};
            motherLookup[groupCode][exactName] = m.dscode;
            motherLookup[groupCode][normalizedName] = m.dscode;
        });

        const findMotherCode = (rawMotherName, resolvedGroupCode) => {
            const groupCode = resolvedGroupCode?.toString().trim();
            if (!groupCode || !motherLookup[groupCode]) return rawMotherName;

            const exactName = rawMotherName.toString().trim().toLowerCase();
            const normalizedName = exactName.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').replace(/\s+/g, ' ').trim();
            const availableNames = motherLookup[groupCode];

            if (availableNames[exactName]) return availableNames[exactName];
            if (availableNames[normalizedName]) return availableNames[normalizedName];
            const fuzzyMatch = Object.keys(availableNames).find(dbName =>
                dbName.includes(normalizedName) || normalizedName.includes(dbName)
            );
            if (fuzzyMatch) return availableNames[fuzzyMatch];
            return Object.values(availableNames)[0];
        };

        const createMap = (arr, key1, key2) => {
            const map = {};
            arr?.forEach(item => {
                if (item[key1]) map[item[key1].toString().trim().toLowerCase()] = item[key2];
                if (item[key2]) map[item[key2].toString().trim().toLowerCase()] = item[key2];
            });
            return map;
        };

        const agentMap = createMap(agentAccounts, 'name', 'UserID');
        const bpMap = createMap(bpAccounts, 'bp_name', 'bp_code');
        const distributorMap = createMap(distributorAccounts, 'name', 'code');
        const bpNameMap = {};
        bpAccounts?.forEach(b => {
            if (b.bp_code && b.bp_name)
                bpNameMap[b.bp_code.toString().trim().toLowerCase()] = b.bp_name;
        });

        const isCode = (val) => /^[A-Z0-9\-_]+$/i.test(val || '');

        const BATCH_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            chunks.push(data.slice(i, i + BATCH_SIZE));
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            const records = chunk.map((row, idx) => {
                const actualRowNumber = i * BATCH_SIZE + idx + 2;

                const rawGroup = row.group_code?.toString().trim() || '';
                const rawMother = row.mother_code?.toString().trim() || '';
                const rawAgent = row.agent_code?.toString().trim() || '';
                const rawBp = row.bp_code?.toString().trim() || '';
                const rawDist = row.distributor_code?.toString().trim() || '';

                let groupCode = rawGroup;
                if (!isCode(rawGroup)) {
                    groupCode = groupNameToCodeMap[rawGroup.toLowerCase()] || rawGroup;
                }

                let motherCode = rawMother;
                if (!isCode(rawMother)) {
                    motherCode = findMotherCode(rawMother, groupCode);
                }

                const agentCode = isCode(rawAgent)
                    ? rawAgent
                    : (agentMap[rawAgent.toLowerCase()] || rawAgent);

                const bpCode = isCode(rawBp)
                    ? rawBp
                    : (bpMap[rawBp.toLowerCase()] || rawBp);

                const bpName =
                    bpNameMap[bpCode?.toString().trim().toLowerCase()] ||
                    row.bp_name ||
                    null;

                const distributorCode = isCode(rawDist)
                    ? rawDist
                    : (distributorMap[rawDist.toLowerCase()] || rawDist);

                return {
                    distributor_code: distributorCode,
                    mother_code: motherCode,
                    bp_code: bpCode,
                    bp_name: bpName,
                    agent_code: agentCode,
                    group_code: groupCode,
                    _rowNumber: actualRowNumber
                };
            });

            // ✅ Check existing in Accounts_List before insert
            const bpCodes = records.map(r => r.bp_code).filter(Boolean);
            const { data: existingRows, error: checkError } = await supabase
                .from('Accounts_List')
                .select('bp_code')
                .in('bp_code', bpCodes);

            if (checkError) {
                console.error('❌ Error checking existing:', checkError);
            }

            const existingCodes = new Set(existingRows?.map(r => r.bp_code.toLowerCase()) || []);

            const newRecords = records.filter(r => !existingCodes.has(r.bp_code.toLowerCase()));
            const skipped = records.filter(r => existingCodes.has(r.bp_code.toLowerCase()));
            skippedRows.push(...skipped.map(r => r._rowNumber));

            const recordsToInsert = newRecords.map(r => {
                const { _rowNumber, ...record } = r;
                return record;
            });

            if (recordsToInsert.length > 0) {
                const { data: insertedData, error } = await supabase
                    .from('Accounts_List')
                    .insert(recordsToInsert)
                    .select();

                if (error) {
                    console.error('Insert error:', error);
                    records.forEach((r) => {
                        failedRows.push({
                            row: r._rowNumber,
                            error: error.message,
                            ...r,
                        });
                    });
                } else {
                    successCount += insertedData?.length || recordsToInsert.length;
                }
            }

            const processed = Math.min((i + 1) * BATCH_SIZE, data.length);
            setProcessedRows(processed);
            setProgressPercent(Math.round((processed / data.length) * 100));
            await new Promise(res => setTimeout(res, 50));
        }

        setUploading(false);

        // ✅ Summary
        const failedCount = failedRows.length;
        const skippedCount = skippedRows.length;
        const totalProcessed = data.length;

        Swal.fire({
            icon: 'success',
            title: 'Import Finished!',
            html: `
        <div style="text-align:left;">
          <p><strong>✅ Imported:</strong> ${successCount}</p>
          <p><strong>❌ Failed:</strong> ${failedCount}</p>
          <p><strong>📊 Total:</strong> ${totalProcessed}</p>
        </div>
      `,
            confirmButtonText: 'OK',
            willClose: () => fetchAccountsList()
        });
    };

    // 🔹 Modal visibility

    // 🔹 Excel import data
    const [importData, setImportData] = useState([]);
    const [existingRows, setExistingRows] = useState([]);
    const [fileName, setFileName] = useState("");
    const [importing, setImporting] = useState(false);
    const [checking, setChecking] = useState(false);

    // 🔹 Pagination
    const [currentPageExcel, setCurrentPageExcel] = useState(1);
    const rowsPerPageExcel = 10;
    const indexOfLastRowExcel = currentPageExcel * rowsPerPageExcel;
    const indexOfFirstRowExcel = indexOfLastRowExcel - rowsPerPageExcel;
    const currentRowsExcel = importData.slice(indexOfFirstRowExcel, indexOfLastRowExcel);
    const totalPagesExcel = Math.ceil(importData.length / rowsPerPageExcel);

    // 🔹 File ref
    const fileInputRef = useRef(null);
    // Fetch and clean data on mount
    useEffect(() => {
        fetchAndCleanData();
        fetchAgents();
        fetchMotherAccounts(); // 🔹 Load mother accounts
        fetchDistributors(); // 🔹 Load distributors
    }, []);

    const fetchAndCleanData = async (page = 1, search = "") => {
        try {
            setLoading(true);
            const batchSize = 8; // show 8 rows at a time
            const offset = (page - 1) * batchSize;

            let query = supabase
                .from("Accounts_List")
                .select("*", { count: "exact" })
                .order("id", { ascending: true })
                .range(offset, offset + batchSize - 1);

            // 🔍 Apply search filter only if there's a search term
            if (search.trim()) {
                query = query.or(
                    `bp_name.ilike.%${search}%,mother_code.ilike.%${search}%`
                );
            }

            const { data: pageData, error, count } = await query;

            if (error) throw error;

            // 🧩 Clean duplicates
            const uniqueData = await autoRemoveDuplicatesOnLoad(pageData);

            // 🧩 Update data
            if (page === 1) {
                setData(uniqueData);
            } else {
                setData((prev) => {
                    const existingIds = new Set(prev.map((x) => x.id));
                    const newRows = uniqueData.filter((x) => !existingIds.has(x.id));
                    return [...prev, ...newRows];
                });
            }

            setTotalCount(count || 0);
            setLoading(false);
        } catch (err) {
            console.error("Error:", err);
            Swal.fire("Error", err.message, "error");
            setLoading(false);
        }
    };


    useEffect(() => {
        const delay = setTimeout(() => {
            fetchAndCleanData(1, searchTerm);
        }, 400); // wait 400ms after typing stops

        return () => clearTimeout(delay);
    }, [searchTerm]);


    // 🔍 Filter logic
    const filteredData = data.filter((row) => {
        if (!searchTerm.trim()) return true;
        const search = searchTerm.toLowerCase();
        return (
            row.bp_name?.toLowerCase().includes(search) ||
            row.mother_code?.toLowerCase().includes(search)
        );
    });

    // 🧮 Pagination (based on filtered data)
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);




    const handleNextPage = async () => {
        if (currentPage < totalPages) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);

            // Fetch new data only if not loaded yet
            const alreadyLoaded = data.length >= nextPage * itemsPerPage;
            if (!alreadyLoaded) {
                await fetchAndCleanData(nextPage);
            }
        }
    };
    const handleFirstPage = () => {
        if (currentPage !== 1) setCurrentPage(1);
    };

    const handleLastPage = async () => {
        if (currentPage !== totalPages) {
            setCurrentPage(totalPages);

            const alreadyLoaded = data.length >= totalPages * itemsPerPage;
            if (!alreadyLoaded) {
                await fetchAndCleanData(totalPages);
            }
        }
    };


    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage((p) => p - 1);
    };


    // ✅ Duplicate cleaner function (keeps first entry, deletes the rest)
    const autoRemoveDuplicatesOnLoad = async (data) => {
        if (!Array.isArray(data) || data.length === 0) return [];

        const seen = {};
        const toDelete = [];
        const uniqueRecords = [];

        for (const record of data) {
            const key = `${record.mother_code || ""}|${record.bp_code || ""}`;

            if (!record.mother_code && !record.bp_code) {
                uniqueRecords.push(record);
                continue;
            }

            if (seen[key]) {
                if (record.id) toDelete.push(record.id);
            } else {
                seen[key] = true;
                uniqueRecords.push(record);
            }
        }

        if (toDelete.length > 0) {
            console.log(`🧹 Found ${toDelete.length} duplicates — cleaning up...`);
            try {
                const chunkSize = 500;
                let totalDeleted = 0;

                for (let i = 0; i < toDelete.length; i += chunkSize) {
                    const chunk = toDelete.slice(i, i + chunkSize);

                    const { error: deleteError } = await supabase
                        .from("Accounts_List")
                        .delete()
                        .in("id", chunk);

                    if (deleteError) {
                        console.warn(`⚠️ Batch delete failed, retrying individually`, deleteError);
                        for (const id of chunk) {
                            const { error } = await supabase
                                .from("Accounts_List")
                                .delete()
                                .eq("id", id);
                            if (!error) totalDeleted++;
                        }
                    } else {
                        totalDeleted += chunk.length;
                    }
                }

                Swal.fire({
                    icon: "success",
                    title: "Duplicate Cleanup",
                    text: `Deleted ${totalDeleted}/${toDelete.length} duplicates.`,
                    timer: 2000,
                    showConfirmButton: false,
                });
            } catch (err) {
                console.error("❌ Error during duplicate cleanup:", err);
                Swal.fire("Error", "Unexpected error while deleting duplicates.", "error");
            }
        } else {
            console.log("✅ No duplicates found.");
        }

        return uniqueRecords;
    };

    // Filtered data
    // 🔍 Filter logic: only bp_name and mother_code


    // Pagination

    // Fetch dropdowns
 const fetchDistributors = async () => {
    const { data, error } = await supabase
        .from("distributors")
        .select("code, name, agent_code")
        .order("name", { ascending: true });
    if (error) console.error(error);
    else {
        setDistributors(data);
        // 🔹 Create a map for quick lookup: code -> name
        const map = {};
        data.forEach(dist => {
            map[dist.code] = dist.name;
        });
        setDistributorMap(map);
    }
};

const fetchMotherAccounts = async () => {
    const batchSize = 1000;
    let allData = [];
    let hasMore = true;
    let offset = 0;

    console.log("🚀 Starting full sub_mother_account data fetch...");

    try {
        while (hasMore) {
            console.log(
                `📥 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`
            );

            const { data, error } = await supabase
                .from("sub_mother_account")
                .select("dscode, name, group_code, group_name")
                .eq("status", true)
                .order("name", { ascending: true })
                .range(offset, offset + batchSize - 1);

            if (error) {
                console.error("❌ Error during batch fetch:", error);
                throw error;
            }

            console.log(
                `✅ Fetched batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`
            );

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                offset += batchSize;
                hasMore = data.length === batchSize;
                console.log(`📊 Total records so far: ${allData.length}`);
            } else {
                hasMore = false;
                console.log("🏁 Finished fetching all sub_mother_account data");
            }
        }

        if (allData.length === 0) {
            console.warn("⚠️ No active mother accounts found");
            setMotherAccounts([]);
            return;
        }

        // ✅ Set all fetched data into state
        setMotherAccounts(allData);
        
        // 🔹 Create a map for quick lookup: dscode -> name
        const map = {};
        allData.forEach(mother => {
            map[mother.dscode] = mother.name;
        });
        setMotherMap(map);
        
        console.log(`🎉 Successfully loaded ${allData.length} mother accounts`);
    } catch (err) {
        console.error("🔥 Error fetching sub_mother_account:", err);
    }
};

    const [allBpAccounts, setAllBpAccounts] = useState([]); // For all data when searching

    const [pageSize] = useState(50); // Show 50 per page

    // 🧩 Fetch limited data first (1k)
    const fetchBpAccounts = async () => {
        try {
            console.log("🚀 Fetching initial 1k Bp_Accounts...");
            const { data, error } = await supabase
                .from("Bp_Accounts")
                .select("bp_code, bp_name")
                .order("bp_name", { ascending: true })
                .range(0, 999); // first 1000

            if (error) throw error;
            setBpAccounts(data);
            console.log(`✅ Loaded ${data.length} initial BP records`);
        } catch (err) {
            console.error("❌ Error fetching initial BP accounts:", err);
        }
    };

    // 🧩 Fetch ALL data for search
    const fetchAllBpAccounts = async () => {
        const batchSize = 1000;
        let allData = [];
        let offset = 0;
        let hasMore = true;

        console.log("📦 Fetching all Bp_Accounts for search...");
        try {
            while (hasMore) {
                const { data, error } = await supabase
                    .from("Bp_Accounts")
                    .select("bp_code, bp_name")
                    .order("bp_name", { ascending: true })
                    .range(offset, offset + batchSize - 1);

                if (error) throw error;

                if (data?.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            setAllBpAccounts(allData);
            console.log(`🎉 All data fetched: ${allData.length} records`);
        } catch (err) {
            console.error("🔥 Error fetching full BP list:", err);
        }
    };

    // 🧩 Handle search with real-time filtering
    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (searchTerm.trim() === "") {
                setCurrentPage(1);
                setBpAccounts(allBpAccounts.length ? allBpAccounts.slice(0, 1000) : bpAccounts);
                return;
            }

            // Fetch all data once for searching
            if (!allBpAccounts.length) {
                fetchAllBpAccounts();
            }

            const filtered = allBpAccounts.filter(
                (bp) =>
                    bp.bp_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    bp.bp_name.toLowerCase().includes(searchTerm.toLowerCase())
            );

            setCurrentPage(1);
            setBpAccounts(filtered);
        }, 400);

        return () => clearTimeout(delayDebounce);
    }, [searchTerm]);

    // 🧩 Pagination computed data
    const currentData = bpAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize);


const fetchAgents = async () => {
    const { data, error } = await supabase
        .from("Account_Users")
        .select("UserID, name")
        .order("name", { ascending: true });
    if (error) console.error(error);
    else {
        setAgents(data);
        // 🔹 Create a map for quick lookup: UserID -> name
        const map = {};
        data.forEach(agent => {
            map[agent.UserID] = agent.name;
        });
        setAgentMap(map);
    }
};
    useEffect(() => {
        if (showDistributorModal) fetchDistributors();
        if (showMotherModal) fetchMotherAccounts();
        if (showBpModal) fetchBpAccounts();
        if (showAgentModal) fetchAgents();
    }, [showDistributorModal, showMotherModal, showBpModal, showAgentModal]);

    // Handle selections
    const handleSelectDistributor = (selected) => {
        setNewRecord(prev => ({
            ...prev,
            distributor_code: selected.code,

        }));
        setShowDistributorModal(false);
    };

    const handleSelectMother = (selected) => {
        setNewRecord(prev => ({
            ...prev,
            mother_code: selected.dscode,
            group_code: selected.group_code

        }));
        setShowMotherModal(false);
    };

    const handleSelectBp = (selected) => {
        setNewRecord(prev => ({
            ...prev,
            bp_code: selected.bp_code,
            bp_name: selected.bp_name

        }));
        setShowBpModal(false);
    };

    const handleSelectAgent = (selected) => {
        setNewRecord(prev => ({
            ...prev,
            agent_code: selected.UserID
        }));
        setShowAgentModal(false);
    };

    // Form handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewRecord(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrorMessage('');

        try {
            if (isEditing) {
                const { id, ...updateData } = newRecord;
                const { error } = await supabase
                    .from('Accounts_List')
                    .update({ ...updateData, updated_at: new Date().toISOString() })
                    .eq('id', id);

                if (error) {
                    setErrorMessage(error.message);
                } else {
                    setData((prev) =>
                        prev.map((row) => (row.id === id ? { ...row, ...updateData } : row))
                    );
                    setShowModal(false);
                    setIsEditing(false);
                    Swal.fire('Success', 'Record updated', 'success');
                }
            } else {
                const { error } = await supabase
                    .from('Accounts_List')
                    .insert([
                        {
                            ...newRecord,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        },
                    ])
                    .select();

                if (error) {
                    setErrorMessage(error.message);
                } else {
                    await fetchAndCleanData();
                    setShowModal(false);
                    setNewRecord({
                        distributor_code: '',
                        mother_code: '',
                        bp_code: '',
                        bp_name: '',
                        agent_code: '',

                        group_code: '',
                        status: true,
                    });
                    Swal.fire('Success', 'Record created', 'success');
                }
            }
        } catch (err) {
            setErrorMessage(err.message);
        } finally {
            setSaving(false);
        }
    };


    const handleEdit = (row) => {
        setNewRecord(row);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete?',
            text: "This can't be undone",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Delete'
        });

        if (!result.isConfirmed) return;

        try {
            const { error } = await supabase
                .from('Accounts_List')
                .delete()
                .eq('id', id);

            if (error) {
                Swal.fire('Error', error.message, 'error');
            } else {
                setData(prev => prev.filter(row => row.id !== id));
                Swal.fire('Deleted', 'Record removed', 'success');
            }
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    };

    const [countdown, setCountdown] = useState(0);
    const [progressPercent, setProgressPercent] = useState(0);
    const [totalRows, setTotalRows] = useState(0);
    const [processedRows, setProcessedRows] = useState(0);

    const handleImportClick = () => {
        document.getElementById('excel-upload').click();
    };

    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        setCountdown(0);
        setProgressPercent(0);
        setProcessedRows(0);
        setTotalRows(0);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arr = new Uint8Array(e.target.result);
                const workbook = XLSX.read(arr, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const sheetData = XLSX.utils.sheet_to_json(sheet);

                if (!sheetData || sheetData.length === 0) {
                    Swal.fire('Error', 'No data in Excel', 'error');
                    setUploading(false);
                    return;
                }

                setTotalRows(sheetData.length);

                let addedCount = 0;
                let updatedCount = 0;

                for (let i = 0; i < sheetData.length; i++) {
                    const row = sheetData[i];
                    if (!row.distributor_code) continue;

                    try {
                        const { data: existing } = await supabase
                            .from('Accounts_List')
                            .select('id')
                            .eq('distributor_code', row.distributor_code)
                            .eq('mother_code', row.mother_code || null)
                            .eq('bp_code', row.bp_code || null)
                            .maybeSingle();

                        if (existing) {
                            await supabase
                                .from('Accounts_List')
                                .update({ ...row, updated_at: new Date().toISOString() })
                                .eq('id', existing.id);
                            updatedCount++;
                        } else {
                            await supabase
                                .from('Accounts_List')
                                .insert([{ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
                            addedCount++;
                        }

                        const processed = i + 1;
                        setProcessedRows(processed);
                        setProgressPercent(Math.round((processed / sheetData.length) * 100));
                    } catch (err) {
                        console.error('Row error:', err);
                    }
                }

                await fetchAndCleanData();

                // Final 3-second countdown
                let timer = 3;
                const interval = setInterval(() => {
                    setCountdown(timer);
                    timer--;
                    if (timer < 0) {
                        clearInterval(interval);
                        setUploading(false);
                        Swal.fire('Complete', `Added: ${addedCount}, Updated: ${updatedCount}`, 'success');
                    }
                }, 1000);
            };

            reader.readAsArrayBuffer(file);
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
            setUploading(false);
        } finally {
            setShowImportMenu(false);
        }
    };
    // file: MasterdataBranch.jsx
    const readExcelFile = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                resolve(jsonData);
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const data = await readExcelFile(file); // parse using SheetJS or similar
        // Save data as-is to your Accounts_List or process as needed
    };


    const [showExcelModal, setShowExcelModal] = useState(false);



    // Add this inside your component
    const fetchAccountsList = async () => {
        try {
            const { data, error } = await supabase
                .from('Accounts_List')
                .select('*')
                .order('id', { ascending: false });

            if (error) {
                console.error('Error fetching accounts:', error);
                return;
            }

            setAccountsData(data || []); // store full table data
        } catch (err) {
            console.error(err);
        }
    };

    const [accountsData, setAccountsData] = useState([]); // full table data



    // State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportProgress, setExportProgress] = useState({ fetched: 0, total: 0, type: "" });

    // Updated handleExport
    const handleExport = async (type) => {
        try {
            setShowExportModal(true);
            setExportProgress({ fetched: 0, total: 0, type });

            const headers = [
                "distributor_code",
                "mother_code",
                "bp_code",
                "bp_name",
                "agent_code",
                "group_code",
                "status",
            ];

            let exportData = [];

            if (type === "template") {
                exportData = [Object.fromEntries(headers.map((k) => [k, ""]))];
                setExportProgress({ fetched: 1, total: 1, type });
            } else if (type === "all") {
                const batchSize = 1000;
                let allData = [];
                let offset = 0;
                let hasMore = true;

                while (hasMore) {
                    const { data, error } = await supabase
                        .from("Accounts_List")
                        .select("*")
                        .order("id", { ascending: true })
                        .range(offset, offset + batchSize - 1);

                    if (error) throw error;

                    if (data && data.length > 0) {
                        allData = [...allData, ...data];
                        offset += batchSize;
                        hasMore = data.length === batchSize;
                        setExportProgress({ fetched: allData.length, total: allData.length + (hasMore ? batchSize : 0), type });
                    } else {
                        hasMore = false;
                        setExportProgress({ fetched: allData.length, total: allData.length, type });
                    }
                }

                if (allData.length === 0) {
                    Swal.fire("Error", "No data to export", "error");
                    setShowExportModal(false);
                    return;
                }

                exportData = allData.map((row) => {
                    const obj = {};
                    headers.forEach((k) => (obj[k] = row[k] ?? ""));
                    return obj;
                });
            }

            // Small delay to display progress modal nicely
            await new Promise((res) => setTimeout(res, 500));

            // Generate Excel
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "AccountsList");
            const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
            const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
            saveAs(blob, `accounts_list_${type}.xlsx`);

            setShowExportModal(false);
        } catch (err) {
            console.error("Export Error:", err);
            Swal.fire("Error", err.message, "error");
            setShowExportModal(false);
        } finally {
            setShowExportMenu(false);
        }
    };



    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
            if (importMenuRef.current && !importMenuRef.current.contains(e.target)) setShowImportMenu(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    const [showTaggingModal, setShowTaggingModal] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const handleOptionClick = (type) => {
        setSelectedExportType(type);
        setShowMultipleModal(true);  // This opens your modal
    };

    const [taggingData, setTaggingData] = useState({
        bp_code: '',
        agent_code: '',
        distributor_code: '',
        mother_code: '',
        group_code: '',
        from_date: '',
        to_date: '',
    });
    const handleTaggingExport = (e) => {
        e.preventDefault();
        console.log('Exporting for tagging:', newRecord);
        // call your export logic here (like handleExport('tagging'))
        handleExport('tagging');
        setShowTaggingModal(false);
    };
    // Handles input changes in your modal
    const handleTaggingChange = (e) => {
        const { name, value } = e.target;
        setNewRecord(prev => ({ ...prev, [name]: value }));
    };

    // Generates Excel tagging template
    const handleGenerateTaggingTemplate = () => {
        const distributorBase = parseInt(newRecord.distributor_code) || 5001;
        let count = Number(newRecord.range_count) || 1;
        count = Math.max(1, Math.min(count, 99999999)); // clamp

        const rows = [];
        for (let i = 0; i < count; i++) {
            rows.push({
                distributor_code: distributorBase,
                mother_code: newRecord.mother_code || '',
                bp_code: newRecord.bp_code || '',
                agent_code: newRecord.agent_code || '',
                group_code: newRecord.group_code || '',
            });
        }

        // Export to Excel
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'TaggingTemplate');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(blob, 'tagging_template.xlsx');

        // ✅ Reset all modal fields
        setNewRecord({
            distributor_code: '',
            distributor_name: '',
            mother_code: '',
            mother_acct: '',
            bp_code: '',
            bp_name: '',
            agent_code: '',
            agent_name: '',
            group_code: '',
            group_name: '',
            range_count: ''
        });

        alert(`Tagging template generated successfully! (${count} codes)`);
        setShowTaggingModal(false);
    };

    const [hoveredButton, setHoveredButton] = useState(null);

    // Updated styles with hover effect
    const buttonHoverStyle = {
        background: '#1d4ed8',
        color: 'white',
        transition: 'all 0.2s',
    };

    const menuItemHoverStyle = {
        background: '#e8f0fe',
        transition: 'background 0.2s',
    };

    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupAccounts, setGroupAccounts] = useState([]);
    const fetchGroupAccounts = async () => {
        const { data, error } = await supabase
            .from('mother_account')
            .select('*')
            .eq('status', true);

        if (error) {
            console.error(error);
        } else {
            setGroupAccounts(data);
        }
    };

    useEffect(() => {
        if (showGroupModal) fetchGroupAccounts();
    }, [showGroupModal]);
    const handleSelectGroup = (selected) => {
        setNewRecord(prev => ({
            ...prev,
            group_code: selected.code
        }));
        setShowGroupModal(false);
    };


    const [showMultipleModal, setShowMultipleModal] = useState(false);
    const [selectedExportType, setSelectedExportType] = useState('');
    const [multipleRecord, setMultipleRecord] = useState({ range_count: '' });

    const handleGenerateMultipleTemplate = async (type) => {
        try {
            // ✅ check if form has data
            if (!newRecord || Object.keys(newRecord).length === 0) {
                Swal.fire('Error', 'No data to export', 'error');
                return;
            }

            const count = parseInt(newRecord.range_count || '0');
            if (isNaN(count) || count <= 0) {
                Swal.fire('Invalid Input', 'Please enter a valid range count', 'warning');
                return;
            }

            Swal.fire({
                title: `Generating ${type} Excel...`,
                text: 'Please wait a moment.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            // ✅ Define the headers you want in the export
            const headers = [
                'distributor_code',
                'mother_code',
                'bp_code',
                'bp_name',
                'agent_code',
                'group_code',
                'status'
            ];

            // ✅ Create the export row from form (newRecord)
            const baseRow = {};
            headers.forEach(h => baseRow[h] = newRecord[h] ?? '');

            // ✅ Generate multiple rows (duplicate based on count)
            const exportData = Array.from({ length: count }, () => ({ ...baseRow }));

            if (exportData.length === 0) {
                Swal.fire('Error', 'No data to export', 'error');
                return;
            }

            // ✅ Create Excel file
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `${type}_Export`);

            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
            saveAs(blob, `${type}_Export.xlsx`);

            Swal.fire('Success', `${type} Excel generated successfully!`, 'success');
            setShowMultipleModal(false);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to generate Excel.', 'error');
        }
    };



    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>📋 Accounts List Manager</h2>

            <div style={styles.buttonContainer}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        style={{
                            ...styles.btn,
                            ...(hoveredButton === 'export' ? buttonHoverStyle : {}),
                        }}
                        onMouseEnter={() => setHoveredButton('export')}
                        onMouseLeave={() => setHoveredButton(null)}
                    >
                        Export ▼
                    </button>

                    {showExportMenu && (
                        <div ref={exportMenuRef} style={styles.menu}>
                            {/* Template */}
                            <div
                                style={styles.menuItem}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                                onClick={() => {
                                    handleExport('template');
                                    setShowExportMenu(false);
                                }}
                            >
                                📄 Export Template Only
                            </div>

                            {/* All Data */}
                            <div
                                style={styles.menuItem}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f0fe")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                onClick={() => handleExport("all")}
                            >
                                📊 Export All Data
                            </div>


                            {/* Tagging */}
                            <div
                                style={styles.menuItem}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                                onClick={() => {
                                    setShowTaggingModal(true);
                                    setShowExportMenu(false);
                                }}
                            >
                                🏷️ Export for Tagging
                            </div>
                            <Modal show={showExportModal} centered>
                                <Modal.Header>
                                    <Modal.Title>📊 Exporting Data...</Modal.Title>
                                </Modal.Header>
                                <Modal.Body>
                                    {exportProgress.type === "template" ? (
                                        <p>Preparing template...</p>
                                    ) : (
                                        <>
                                            <p>
                                                Fetched {exportProgress.fetched} / {exportProgress.total} records
                                            </p>
                                            <div
                                                style={{
                                                    width: "100%",
                                                    height: "10px",
                                                    background: "#eee",
                                                    borderRadius: "5px",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${Math.min((exportProgress.fetched / exportProgress.total) * 100, 100)}%`,
                                                        height: "100%",
                                                        background: "#0d6efd",
                                                        transition: "width 0.2s",
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </Modal.Body>
                            </Modal>

                            {/* Multiple (Agent / Distributor / Mother) */}
                            <div
                                style={{ ...styles.menuItem, position: 'relative' }}
                                onMouseEnter={() => setShowTooltip(true)}
                                onMouseLeave={() => setShowTooltip(false)}
                            >
                                🔁 Export Multiple ▸

                                {showTooltip && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: '100%',
                                            background: '#fff',
                                            border: '1px solid #ccc',
                                            borderRadius: 6,
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                            zIndex: 10,
                                            width: 160,
                                        }}
                                    >
                                        {['Agent', 'Distributor', 'Mother'].map((label, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '10px 12px',
                                                    cursor: 'pointer',
                                                    borderBottom: idx < 2 ? '1px solid #eee' : 'none',
                                                    transition: 'background 0.2s',
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                                                onClick={() => {
                                                    handleOptionClick(label); // ✅ triggers modal
                                                    setShowExportMenu(false);
                                                    setShowTooltip(false);
                                                }}
                                            >
                                                {label}
                                            </div>
                                        ))}

                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Import Button */}
                {/* === Import Menu === */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowImportMenu(!showImportMenu)}
                        style={{
                            ...styles.btn,
                            ...(hoveredButton === 'import' ? buttonHoverStyle : {}),
                        }}
                        onMouseEnter={() => setHoveredButton('import')}
                        onMouseLeave={() => setHoveredButton(null)}
                    >
                        Import ▼
                    </button>

                    {showImportMenu && (
                        <div ref={importMenuRef} style={styles.menu}>
                            <div
                                style={styles.menuItem}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                                onClick={() => {
                                    setShowImportMenu(false);
                                    setShowExcelModal(true);
                                }}
                            >
                                📥 Upload Excel File
                            </div>
                        </div>
                    )}

                    {/* === Import Excel Modal === */}
                    {showExcelModal && (
                        <div
                            style={{
                                position: "fixed",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                backgroundColor: "rgba(0,0,0,0.5)",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                zIndex: 1050,
                            }}
                            onClick={() => {
                                setShowExcelModal(false);
                                setImportData([]);
                                setExistingRows([]);
                                setDuplicatesChecked(false);
                                setFileName('');
                                setProcessedRows(0);
                                setProgressPercent(0);
                            }}
                        >
                            <div
                                style={{
                                    width: "1500px",
                                    maxHeight: "90vh",
                                    backgroundColor: "white",
                                    borderRadius: "8px",
                                    overflowY: "auto",
                                    padding: "20px",
                                    boxShadow: "0 0 20px rgba(0,0,0,0.3)",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                                    <h4>📥 Import from Excel</h4>
                                    <button
                                        onClick={() => {
                                            setShowExcelModal(false);
                                            setImportData([]);
                                            setExistingRows([]);
                                            setDuplicatesChecked(false);
                                            setFileName('');
                                            setProcessedRows(0);
                                            setProgressPercent(0);
                                        }}
                                        style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer" }}
                                    >
                                        ×
                                    </button>
                                </div>

                                {/* File Input */}
                                <div className="mb-3">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept=".xlsx,.xls,.csv"
                                        onChange={handleImportMother}
                                        className="form-control"
                                    />
                                    {fileName && <div className="mt-2 text-muted">Selected File: <b>{fileName}</b></div>}
                                </div>

                                {/* Check Duplicates Button */}
                                {importData.length > 0 && (
                                    <Button
                                        variant="warning"
                                        size="sm"
                                        onClick={checkExistingRecords}
                                        disabled={checking}
                                        style={{ marginBottom: "10px" }}
                                    >
                                        {checking ? (
                                            <>
                                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                                Checking...
                                            </>
                                        ) : (
                                            "🔍 Check for Duplicates"
                                        )}
                                    </Button>
                                )}

                                {/* Table */}
                                {importData.length > 0 && (
                                    <div className="table-responsive mt-2">
                                        <table style={{ ...tableStyle, width: "100%", fontSize: "1.1rem" }}>
                                            <thead style={{ backgroundColor: "#0d6efd", color: "white" }}>
                                                <tr>
                                                    <th style={{ ...thStyle, minWidth: "120px" }}>Distributor Code</th>
                                                    <th style={{ ...thStyle, minWidth: "120px" }}>Mother Code</th>
                                                    <th style={{ ...thStyle, minWidth: "120px" }}>BP Code</th>
                                                    <th style={{ ...thStyle, minWidth: "150px" }}>BP Name</th>
                                                    <th style={{ ...thStyle, minWidth: "120px" }}>Agent Code</th>
                                                    <th style={{ ...thStyle, minWidth: "120px" }}>Group Code</th>
                                                    <th style={{ ...thStyle, minWidth: "100px" }}>Status</th>
                                                    <th style={{ ...thStyle, minWidth: "100px" }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentRowsExcel.map((row, idx) => {
                                                    const isDuplicate = existingRows.some(
                                                        (r) => r.bp_code.trim().toUpperCase() === row.bp_code.trim().toUpperCase()
                                                    );
                                                    return (
                                                        <tr
                                                            key={idx}
                                                            style={{
                                                                backgroundColor: isDuplicate ? "#ffcccc" : "white",
                                                                color: isDuplicate ? "#b30000" : "black",
                                                                fontWeight: isDuplicate ? 600 : "normal",
                                                            }}
                                                        >
                                                            <td style={tdStyle}>{row.distributor_code}</td>
                                                            <td style={tdStyle}>{row.mother_code}</td>
                                                            <td style={tdStyle}>{row.bp_code}</td>
                                                            <td style={tdStyle}>{row.bp_name}</td>
                                                            <td style={tdStyle}>{row.agent_code}</td>
                                                            <td style={tdStyle}>{row.group_code}</td>
                                                            <td style={tdStyle}>{isDuplicate ? "Duplicate" : "New"}</td>
                                                            <td style={{ textAlign: "center" }}>
                                                                <Button
                                                                    variant={isDuplicate ? "danger" : "secondary"}
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        const actualIndex = indexOfFirstRowExcel + idx;
                                                                        const updatedData = importData.filter((_, i) => i !== actualIndex);
                                                                        setImportData(updatedData);

                                                                        const remainingDuplicates = updatedData.filter((r) =>
                                                                            existingRows.some(
                                                                                (ex) => ex.bp_code.trim().toUpperCase() === r.bp_code.trim().toUpperCase()
                                                                            )
                                                                        );
                                                                        setExistingRows(remainingDuplicates);
                                                                        if (remainingDuplicates.length === 0) setDuplicatesChecked(false);
                                                                    }}
                                                                    style={{ padding: "6px 12px", fontSize: "14px" }}
                                                                >
                                                                    {isDuplicate ? "🗑️ Delete" : "🗑️ Remove"}
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Progress */}
                                {uploading && (
                                    <div style={{ marginTop: 10 }}>
                                        <div>Processing {processedRows}/{totalRows} rows</div>
                                        <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                                            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#28a745' }} />
                                        </div>
                                    </div>
                                )}

                                {/* Pagination */}
                                {importData.length > 0 && (
                                    <div className="d-flex justify-content-between align-items-center mt-2">
                                        <small>
                                            Showing {indexOfFirstRowExcel + 1}–{Math.min(indexOfLastRowExcel, importData.length)} of {importData.length}
                                        </small>
                                        <div>
                                            <Button
                                                variant="outline-dark"
                                                size="sm"
                                                disabled={currentPageExcel === 1}
                                                onClick={() => setCurrentPageExcel((p) => p - 1)}
                                                className="me-2"
                                            >
                                                ⬅ Prev
                                            </Button>
                                            <span className="mx-2">Page {currentPageExcel} of {totalPagesExcel}</span>
                                            <Button
                                                variant="outline-dark"
                                                size="sm"
                                                disabled={currentPageExcel === totalPagesExcel}
                                                onClick={() => setCurrentPageExcel((p) => p + 1)}
                                            >
                                                Next ➡
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Footer Buttons */}
                                <div style={{ marginTop: "20px", textAlign: "right" }}>
                                    <button
                                        onClick={() => {
                                            setShowExcelModal(false);
                                            setImportData([]);
                                            setExistingRows([]);
                                            setDuplicatesChecked(false);
                                            setFileName('');
                                            setProcessedRows(0);
                                            setProgressPercent(0);
                                        }}
                                        style={{
                                            padding: "6px 12px",
                                            marginRight: "10px",
                                            backgroundColor: "#6c757d",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={importDataToDB}
                                        disabled={importing || importData.length === 0 || !duplicatesChecked}
                                        style={{
                                            padding: "6px 12px",
                                            backgroundColor: "#28a745",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: importing || importData.length === 0 || !duplicatesChecked ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        {importing ? "Importing..." : "📤 Import"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>







                {/* Create New */}
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setNewRecord({
                            distributor_code: '',
                            mother_code: '',
                            bp_code: '',
                            agent_code: '',
                            group_code: '',
                            status: true,
                        });
                        setShowModal(true);
                    }}
                    style={{
                        ...styles.btnCreate,
                        ...(hoveredButton === 'create' ? buttonHoverStyle : {}),
                    }}
                    onMouseEnter={() => setHoveredButton('create')}
                    onMouseLeave={() => setHoveredButton(null)}
                >
                    + Create New
                </button>
            </div>


            {/* 🔍 Search and Toggle Show All */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => {
                        const value = e.target.value;
                        setSearchTerm(value);
                        fetchAndCleanData(1, value); // 👈 fetch data again with filter
                    }}
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                    }}
                />
                <button
                    onClick={() => setShowAll(!showAll)}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: showAll ? '#6c757d' : '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                    }}
                >
                    {showAll ? 'Paginate' : 'Show All'}
                </button>
            </div>

            {/* 🧾 Table */}
            <div
                style={{
                    overflowX: 'auto',
                    margin: '20px 0',
                    fontFamily: 'Arial, sans-serif',
                }}
            >
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        minWidth: '800px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                >
                    <thead>
                        <tr
                            style={{
                                backgroundColor: '#007BFF',
                                color: '#fff',
                                textAlign: 'left',
                            }}
                        >
                            <th style={{ padding: '12px 15px' }}>Distributor</th>
                            <th style={{ padding: '12px 15px' }}>Mother Code</th>
                            <th style={{ padding: '12px 15px' }}>BP Code</th>
                            <th style={{ padding: '12px 15px' }}>BP Name</th>
                            <th style={{ padding: '12px 15px' }}>Agent Code</th>
                            <th style={{ padding: '12px 15px' }}>Group Code</th>
                            <th style={{ padding: '12px 15px' }}>Status</th>
                            <th style={{ padding: '12px 15px' }}>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {/* 🔄 Upload progress bar */}
                        {uploading && (
                            <tr>
                                <td colSpan={8} style={{ padding: '10px 15px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        <div
                                            style={{
                                                background: '#e0e0e0',
                                                borderRadius: 5,
                                                overflow: 'hidden',
                                                height: 20,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${progressPercent}%`,
                                                    height: '100%',
                                                    background: 'linear-gradient(90deg, #4f46e5, #3b82f6)',
                                                    transition: 'width 0.3s ease-in-out',
                                                    textAlign: 'center',
                                                    color: 'white',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {processedRows} / {totalRows} rows
                                            </div>
                                        </div>
                                        {countdown > 0 && (
                                            <div
                                                style={{
                                                    textAlign: 'center',
                                                    fontWeight: 'bold',
                                                    color: '#1d4ed8',
                                                }}
                                            >
                                                Completed! Closing in {countdown}...
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}

                        {/* 🧭 Display Data (Filtered + Paginated) */}
                        {(showAll ? filteredData : currentItems).length ? (
                            (showAll ? filteredData : currentItems).map((row) => (
                                <tr
                                    key={row.id}
                                    style={{
                                        borderBottom: '1px solid #ddd',
                                        transition: 'background 0.3s',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f7ff')}
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.background = 'transparent')
                                    }
                                >
                                    <td style={{ padding: '10px 15px' }}>
    {distributorMap[row.distributor_code] || row.distributor_code}
</td>
<td style={{ padding: '10px 15px' }}>
    {motherMap[row.mother_code] || row.mother_code}
</td>
<td style={{ padding: '10px 15px' }}>{row.bp_code}</td>
<td style={{ padding: '10px 15px' }}>{row.bp_name}</td>
<td style={{ padding: '10px 15px' }}>
    {agentMap[row.agent_code] || row.agent_code}
</td>                         <td style={{ padding: '10px 15px' }}>{row.group_code}</td>
                                    <td
                                        style={{
                                            padding: '10px 15px',
                                            fontWeight: 'bold',
                                            color: row.status ? 'green' : 'red',
                                        }}
                                    >
                                        {row.status ? 'Active' : 'Inactive'}
                                    </td>
                                    <td style={{ padding: '10px 15px', display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handleEdit(row)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#28a745',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(row.id)}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#dc3545',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            !uploading && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        style={{ textAlign: 'center', padding: 20, color: '#777' }}
                                    >
                                        No records
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>

                {/* 📄 Pagination Controls (NO Last button) */}
                {!showAll && totalCount > 0 && (
                    <div
                        style={{
                            marginTop: 15,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <button
                            onClick={handleFirstPage}
                            disabled={currentPage === 1}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 4,
                                border: '1px solid #ccc',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            }}
                        >
                            First
                        </button>

                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 4,
                                border: '1px solid #ccc',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Previous
                        </button>

                        <span>
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 4,
                                border: '1px solid #ccc',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>




            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'white',
                            borderRadius: 16,
                            width: '100%',
                            maxWidth: 650,
                            maxHeight: '90vh',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            style={{
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                padding: '20px 24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    color: 'white',
                                    fontSize: 20,
                                    fontWeight: 600,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {isEditing ? 'Edit' : 'Create New'} Record
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    color: 'white',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 24,
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')
                                }
                            >
                                ×
                            </button>
                        </div>

                        {/* Form */}
                        <form
                            onSubmit={handleSubmit}
                            style={{
                                padding: 24,
                                overflowY: 'auto',
                                flex: 1,
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 20,
                            }}
                        >
                            {/* Distributor Code */}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        marginBottom: 8,
                                        fontSize: 14,
                                        fontWeight: 500,
                                        color: '#374151',
                                    }}
                                >
                                    Distributor Code *
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="distributor_code"
                                        value={newRecord.distributor_code || ''}
                                        onChange={handleInputChange}
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                            fontSize: 14,
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                        }}
                                        onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                                        onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDistributorModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            fontSize: 16,
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* Mother Code */}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        marginBottom: 8,
                                        fontSize: 14,
                                        fontWeight: 500,
                                        color: '#374151',
                                    }}
                                >
                                    Mother Code
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="mother_code"
                                        value={newRecord.mother_code || ''}
                                        onChange={handleInputChange}
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                            fontSize: 14,
                                        }}
                                        onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                                        onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowMotherModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                            fontSize: 16,
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* Agent Code */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>Agent Code</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="agent_code"
                                        value={newRecord.agent_code || ''}
                                        onChange={handleTaggingChange}
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowAgentModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* Group Code */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>Group Code</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="group_code"
                                        value={newRecord.group_code || ''}
                                        onChange={handleTaggingChange}
                                        disabled
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGroupModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* BP Code */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>BP Code</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="bp_code"
                                        value={newRecord.bp_code || ''}
                                        onChange={handleInputChange}
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowBpModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* BP Name (Disabled) */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>BP Name</label>
                                <input
                                    name="bp_name"
                                    value={newRecord.bp_name || ''}
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: 8,
                                        backgroundColor: '#f9fafb',
                                        color: '#6b7280',
                                        fontStyle: 'italic',
                                    }}
                                />
                            </div>


                            {/* Status */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>Status *</label>
                                <select
                                    name="status"
                                    value={newRecord.status}
                                    onChange={(e) =>
                                        setNewRecord((p) => ({ ...p, status: e.target.value === 'true' }))
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                    }}
                                    required
                                >
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>

                            {/* Error Message */}
                            {errorMessage && (
                                <div
                                    style={{
                                        color: '#dc2626',
                                        marginTop: 20,
                                        padding: 12,
                                        background: '#fef2f2',
                                        borderRadius: 8,
                                        fontSize: 14,
                                        borderLeft: '4px solid #dc2626',
                                        gridColumn: 'span 2',
                                    }}
                                >
                                    {errorMessage}
                                </div>
                            )}
                        </form>

                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 12,
                                padding: 24,
                                flexShrink: 0,
                                borderTop: '1px solid #e5e7eb',
                                background: 'white',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    background: '#f3f4f6',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button" // keep as button
                                onClick={handleSubmit} // <--- call your function here
                                disabled={saving}
                                style={{
                                    padding: '10px 20px',
                                    background: saving ? '#9ca3af' : '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
                            </button>
                        </div>

                    </div>
                </div>
            )}



            {showMultipleModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: 16,
                    }}
                    onClick={() => setShowMultipleModal(false)}
                >
                    <div
                        style={{
                            position: 'relative',
                            background: 'white',
                            borderRadius: 16,
                            width: '100%',
                            maxWidth: 450,
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            style={{
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                padding: '18px 20px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <h3 style={{ margin: 0, color: 'white', fontSize: 18, fontWeight: 600 }}>
                                🔍 Export {selectedExportType}
                            </h3>
                            <button
                                onClick={() => setShowMultipleModal(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    color: 'white',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 22,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Form */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleGenerateMultipleTemplate(selectedExportType);
                            }}
                            style={{
                                padding: 24,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 20,
                            }}
                        >
                            {/* Dynamic Input Field */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>
                                    {selectedExportType} Code
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name={`${selectedExportType.toLowerCase()}_code`}
                                        type="text"
                                        value={
                                            newRecord[`${selectedExportType.toLowerCase()}_code`] || ''
                                        }
                                        onChange={(e) =>
                                            setNewRecord({
                                                ...newRecord,
                                                [e.target.name]: e.target.value,
                                            })
                                        }
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                        }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedExportType === 'Agent') setShowAgentModal(true);
                                            if (selectedExportType === 'Distributor')
                                                setShowDistributorModal(true);
                                            if (selectedExportType === 'Mother') setShowMotherModal(true);
                                        }}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* Number of Codes */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>
                                    Number of Codes to Generate
                                </label>
                                <input
                                    name="range_count"
                                    type="number"
                                    min="1"
                                    max="99999999"
                                    value={newRecord.range_count || ''}
                                    onChange={(e) =>
                                        setNewRecord({
                                            ...newRecord,
                                            [e.target.name]: e.target.value,
                                        })
                                    }
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: 8,
                                    }}
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: 10,
                                    marginTop: 10,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowMultipleModal(false)}
                                    style={{
                                        padding: '10px 16px',
                                        border: 'none',
                                        borderRadius: 8,
                                        background: '#e5e7eb',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '10px 16px',
                                        background: '#2563eb',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                    }}
                                >
                                    Generate
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}



            {showTaggingModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: 16,
                    }}
                    onClick={() => setShowTaggingModal(false)}
                >
                    <div
                        style={{
                            position: 'relative',
                            background: 'white',
                            borderRadius: 16,
                            width: '100%',
                            maxWidth: 700,
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            style={{
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                padding: '20px 24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <h3 style={{ margin: 0, color: 'white', fontSize: 20, fontWeight: 600 }}>
                                🏷️ Export for Tagging
                            </h3>
                            <button
                                onClick={() => setShowTaggingModal(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    color: 'white',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 24,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Form */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleGenerateTaggingTemplate();
                            }}
                            style={{
                                padding: 24,
                                overflowY: 'auto',
                                flex: 1,
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 20,
                            }}
                        >
                            {/* Distributor Code */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>Distributor Code</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="distributor_code"
                                        type="number"
                                        value={newRecord.distributor_code || ''}
                                        onChange={handleTaggingChange}
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                        }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDistributorModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* Mother Code */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>Mother Code</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="mother_code"
                                        value={newRecord.mother_code || ''}
                                        onChange={handleTaggingChange}
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowMotherModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* Agent Code */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>Agent Code</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="agent_code"
                                        value={newRecord.agent_code || ''}
                                        onChange={handleTaggingChange}
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowAgentModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>

                            {/* Group Code */}
                            <div>
                                <label style={{ display: 'block', marginBottom: 8 }}>Group Code</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        name="group_code"
                                        value={newRecord.group_code || ''}
                                        onChange={handleTaggingChange}
                                        disabled
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: 8,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowGroupModal(true)}
                                        style={{
                                            padding: '10px 14px',
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🔍
                                    </button>
                                </div>
                            </div>
                            {/* Number of Codes */}
                            <div style={{ gridColumn: '1 / span 2' }}>
                                <label style={{ display: 'block', marginBottom: 8 }}>Number of Codes to Generate</label>
                                <input
                                    name="range_count"
                                    type="number"
                                    min="1"
                                    max="99999999"
                                    value={newRecord.range_count || ''}
                                    onChange={handleTaggingChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: 8,
                                    }}
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: 12,
                                    gridColumn: '1 / span 2',
                                    marginTop: 24,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowTaggingModal(false)}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#f3f4f6',
                                        color: '#374151',
                                        border: 'none',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '10px 20px',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                    }}
                                >
                                    Generate Template
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showGroupModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: 16,
                    }}
                    onClick={() => setShowGroupModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: 16,
                            width: '100%',
                            maxWidth: 600,
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            padding: 24,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ marginBottom: 16 }}>Select Group Code</h3>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {groupAccounts.map((g) => (
                                <li
                                    key={g.id}
                                    style={{
                                        padding: '10px 12px',
                                        borderBottom: '1px solid #e5e7eb',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => handleSelectGroup(g)}
                                >
                                    {g.code} — {g.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {showDistributorModal && <LookupModal title="Select Distributor" columns={['Code', 'Name',]} data={distributors} onSelect={handleSelectDistributor} onClose={() => setShowDistributorModal(false)} fieldKeys={['code', 'name',]} />}
            {showMotherModal && <LookupModal title="Select Mother Account" columns={['Code', 'Name',]} data={motherAccounts} onSelect={handleSelectMother} onClose={() => setShowMotherModal(false)} fieldKeys={['dscode', 'name',]} />}
            {showBpModal && (
                <>
                    <LookupModal
                        title="Select BP Account"
                        columns={["Code", "Name"]}
                        data={currentData} // ← Paginated data
                        onSelect={handleSelectBp}
                        onClose={() => setShowBpModal(false)}
                        fieldKeys={["bp_code", "bp_name"]}
                    />

                    {/* Pagination Controls */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            marginTop: "10px",
                            gap: "10px",
                        }}
                    >
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </button>

                        <span>
                            Page {currentPage} of {Math.ceil(bpAccounts.length / pageSize)}
                        </span>

                        <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() =>
                                setCurrentPage((p) =>
                                    Math.min(p + 1, Math.ceil(bpAccounts.length / pageSize))
                                )
                            }
                            disabled={currentPage === Math.ceil(bpAccounts.length / pageSize)}
                        >
                            Next
                        </button>
                    </div>
                </>
            )}

            {showAgentModal && <LookupModal title="Select Agent" columns={['ID', 'Name']} data={agents} onSelect={handleSelectAgent} onClose={() => setShowAgentModal(false)} fieldKeys={['UserID', 'name']} />}


        </div >
    );
}



function LookupModal({ title, columns, data, onSelect, onClose, fieldKeys }) {
    const [search, setSearch] = useState('');
    const filtered = data.filter(row =>
        fieldKeys.some(k => String(row[k] || '').toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
                padding: 16
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'white',
                    borderRadius: 16,
                    width: '100%',
                    maxWidth: 700,
                    maxHeight: '90vh',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h3 style={{
                        margin: 0,
                        color: 'white',
                        fontSize: 20,
                        fontWeight: 600,
                        letterSpacing: '-0.02em'
                    }}>
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: 'white',
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    >
                        ×
                    </button>
                </div>

                {/* Search Bar */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute',
                            left: 12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#9ca3af',
                            fontSize: 18
                        }}>
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 44px',
                                border: '2px solid #e5e7eb',
                                borderRadius: 10,
                                fontSize: 15,
                                outline: 'none',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit',
                                boxSizing: 'border-box'
                            }}
                            onFocus={e => {
                                e.target.style.borderColor = '#2563eb';
                                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                            }}
                            onBlur={e => {
                                e.target.style.borderColor = '#e5e7eb';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>
                </div>

                {/* Table */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0 24px 24px'
                }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'separate',
                        borderSpacing: '0 4px',
                        marginTop: 4
                    }}>
                        <thead>
                            <tr>
                                {columns.map((c, i) => (
                                    <th key={i} style={{
                                        textAlign: 'left',
                                        padding: '12px 16px',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: '#6b7280',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        position: 'sticky',
                                        top: 0,
                                        background: 'white',
                                        zIndex: 10
                                    }}>
                                        {c}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length ? filtered.map((row, i) => (
                                <tr
                                    key={i}
                                    onClick={() => { onSelect(row); onClose(); }}
                                    style={{
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'scale(1.01)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.15)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    {fieldKeys.map((k, j) => (
                                        <td key={j} style={{
                                            padding: '16px',
                                            fontSize: 14,
                                            color: '#1f2937',
                                            background: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderLeft: j === 0 ? '3px solid #2563eb' : '1px solid #e5e7eb',
                                            borderRight: j === fieldKeys.length - 1 ? '1px solid #e5e7eb' : 'none',
                                            borderRadius: j === 0 ? '8px 0 0 8px' : j === fieldKeys.length - 1 ? '0 8px 8px 0' : 0
                                        }}>
                                            {row[k] || '-'}
                                        </td>
                                    ))}
                                </tr>
                            )) : (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        style={{
                                            textAlign: 'center',
                                            padding: 40,
                                            color: '#9ca3af',
                                            fontSize: 15
                                        }}
                                    >
                                        No results found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: { padding: 20, fontFamily: 'Arial, sans-serif', background: '#f5f5f5' },
    heading: { color: '#333', marginBottom: 20 },
    buttonContainer: { display: 'flex', gap: 10, marginBottom: 20 },
    btn: { padding: '10px 15px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' },
    btnCreate: { padding: '10px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' },
    btnEdit: { padding: '5px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
    btnDelete: { padding: '5px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
    btnIcon: { padding: '8px 10px', background: '#0066cc', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' },
    btnCancel: { padding: '8px 15px', background: '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' },
    btnSave: { padding: '8px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' },
    menu: { position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ccc', borderRadius: 4, zIndex: 10, minWidth: 250 },
    menuItem: { padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' },
    table: { width: '100%', borderCollapse: 'collapse', background: 'white', marginTop: 15 },
    input: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: 4 },
    searchInput: { flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: 4 },
    pagination: { display: 'flex', justifyContent: 'center', gap: 10, marginTop: 15, padding: 10 },
    pageBtn: { padding: '6px 12px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', borderRadius: 4 }
};
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { border: "1px solid #ccc", padding: "8px", textAlign: "center" };
const tdStyle = { border: "1px solid #ccc", padding: "8px", textAlign: "center" };


const modalStyles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal: { background: 'white', borderRadius: 8, width: 600, maxHeight: '90vh', overflowY: 'auto', padding: 20 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: 15, marginBottom: 20 },
    closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' },
    footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }
};
























