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
    const [bpAccounts, setBpAccounts] = useState([]);
    const [agents, setAgents] = useState([]);
    const [agentMap, setAgentMap] = useState({}); // 🔹 Map UserID -> name
    const [motherMap, setMotherMap] = useState({}); // 🔹 Map dscode -> name
    const [distributorMap, setDistributorMap] = useState({}); // 🔹 Map code -> name
    const [groupMap, setGroupMap] = useState({});

    const [newRecord, setNewRecord] = useState({
        distributor_code: '',
        mother_code: '',
        bp_code: '',
        bp_name: '',
        agent_code: '',
        group_code: '',
        status: true
    });


    // 🔹 Handle file selection

    // 🔹 Delete a row in preview
const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

// 🔹 Check duplicates with UPDATE detection
const checkExistingRecords = async () => {
    if (!importData.length) return;
    setChecking(true);
    setLoadingProgress({ current: 0, total: 0 });

    try {
        console.log("🔍 Starting duplicate check...");
        console.log(`📊 Total rows to check: ${importData.length}`);
        
        // First, get the total count
        const { count: totalCount, error: countError } = await supabase
            .from("Accounts_List")
            .select("bp_code", { count: 'exact', head: true });

        if (countError) {
            console.error("❌ Count Error:", countError);
            Swal.fire("Error", `Failed to count records: ${countError.message}`, "error");
            setChecking(false);
            return;
        }

        console.log(`📈 Total existing records in DB: ${totalCount || 0}`);
        setLoadingProgress({ current: 0, total: totalCount || 0 });

        let allExistingRecords = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        // Fetch all records with ALL fields to compare
        while (hasMore) {
            const { data, error } = await supabase
                .from("Accounts_List")
                .select("bp_code, distributor_code, mother_code, agent_code, group_code, bp_name")
                .range(from, from + batchSize - 1);

            if (error) {
                console.error("❌ Fetch Error:", error);
                Swal.fire("Error", `Failed to fetch records: ${error.message}`, "error");
                setChecking(false);
                return;
            }

            if (data && data.length > 0) {
                allExistingRecords = [...allExistingRecords, ...data];
                from += batchSize;

                setLoadingProgress({
                    current: allExistingRecords.length,
                    total: totalCount || 0
                });
            }

            hasMore = data && data.length === batchSize;
        }

        console.log(`✅ Total records loaded from DB: ${allExistingRecords.length}`);

        // Create lookup map: bp_code -> full record
        const existingMap = {};
        allExistingRecords.forEach(row => {
            if (row.bp_code) {
                existingMap[row.bp_code.trim().toUpperCase()] = row;
            }
        });
        
        console.log(`🔑 Unique BP codes in DB: ${Object.keys(existingMap).length}`);
        console.log("Sample existing codes:", Object.keys(existingMap).slice(0, 5));

        setExistingRows(new Set(Object.keys(existingMap)));
        setDuplicatesChecked(true);

        // 🔍 DETAILED DUPLICATE ANALYSIS WITH UPDATE DETECTION
        console.log("\n📋 UPLOAD DATA ANALYSIS:");
        console.table(importData.slice(0, 10).map((row, idx) => ({
            Row: idx + 2,
            BP_Code: row.bp_code || "❌ NULL",
            Distributor: row.distributor_code || "N/A",
            Mother: row.mother_code || "N/A",
            Agent: row.agent_code || "N/A"
        })));

        const exactDuplicates = [];
        const needsUpdate = [];
        const newRecords = [];
        const nullBpCodes = [];

        const updatedImportData = importData.map((row, idx) => {
            const rowNum = idx + 2;
            
            if (!row.bp_code || row.bp_code.trim() === "") {
                nullBpCodes.push({
                    Row: rowNum,
                    BP_Code: "❌ NULL/EMPTY",
                    BP_Name: row.bp_name || "N/A",
                    Distributor: row.distributor_code || "N/A"
                });
                return { ...row, _updateFlag: 'null' };
            }

            const normalizedCode = row.bp_code.trim().toUpperCase();
            const existingRecord = existingMap[normalizedCode];

            if (!existingRecord) {
                // NEW RECORD
                newRecords.push({
                    Row: rowNum,
                    BP_Code: row.bp_code,
                    BP_Name: row.bp_name || "N/A",
                    Distributor: row.distributor_code || "N/A",
                    Mother: row.mother_code || "N/A",
                    Agent: row.agent_code || "N/A",
                    Status: "✅ NEW"
                });
                return { ...row, _updateFlag: 'new' };
            }

            // EXISTS - Check if any field is different
            const hasChanges = 
                (row.distributor_code && existingRecord.distributor_code !== row.distributor_code) ||
                (row.mother_code && existingRecord.mother_code !== row.mother_code) ||
                (row.agent_code && String(existingRecord.agent_code) !== String(row.agent_code)) ||
                (row.group_code && existingRecord.group_code !== row.group_code) ||
                (row.bp_name && existingRecord.bp_name !== row.bp_name);

            if (hasChanges) {
                // NEEDS UPDATE
                needsUpdate.push({
                    Row: rowNum,
                    BP_Code: row.bp_code,
                    Old_Distributor: existingRecord.distributor_code || "N/A",
                    New_Distributor: row.distributor_code || "N/A",
                    Old_Mother: existingRecord.mother_code || "N/A",
                    New_Mother: row.mother_code || "N/A",
                    Old_Agent: existingRecord.agent_code || "N/A",
                    New_Agent: row.agent_code || "N/A",
                    Status: "🟠 NEEDS UPDATE"
                });
                return { ...row, _updateFlag: 'update', _oldData: existingRecord };
            } else {
                // EXACT DUPLICATE
                exactDuplicates.push({
                    Row: rowNum,
                    BP_Code: row.bp_code,
                    BP_Name: row.bp_name || "N/A",
                    Distributor: row.distributor_code || "N/A",
                    Mother: row.mother_code || "N/A",
                    Status: "🔴 EXACT DUPLICATE"
                });
                return { ...row, _updateFlag: 'duplicate' };
            }
        });

        // Console logs with tables
        console.log("\n🟠 RECORDS THAT NEED UPDATE:");
        if (needsUpdate.length > 0) {
            console.table(needsUpdate);
        } else {
            console.log("✅ No records need updating!");
        }

        console.log("\n🔴 EXACT DUPLICATE RECORDS (will be skipped):");
        if (exactDuplicates.length > 0) {
            console.table(exactDuplicates);
        } else {
            console.log("✅ No exact duplicates!");
        }

        console.log("\n⚠️ NULL/EMPTY BP_CODE RECORDS:");
        if (nullBpCodes.length > 0) {
            console.table(nullBpCodes);
        } else {
            console.log("✅ All records have BP codes!");
        }

        console.log("\n✅ NEW RECORDS (Sample):");
        console.table(newRecords.slice(0, 10));

        console.log("\n📊 SUMMARY:");
        console.log(`Total Upload Rows: ${importData.length}`);
        console.log(`🟠 Needs Update: ${needsUpdate.length}`);
        console.log(`🔴 Exact Duplicates: ${exactDuplicates.length}`);
        console.log(`⚠️ Null BP Codes: ${nullBpCodes.length}`);
        console.log(`✅ New Records: ${newRecords.length}`);

        setLoadingProgress({ current: 0, total: 0 });

        // Sort: needs update first, then exact duplicates, then new
        const sortedImportData = [...updatedImportData].sort((a, b) => {
            const order = { update: 0, duplicate: 1, new: 2, null: 3 };
            return order[a._updateFlag] - order[b._updateFlag];
        });

        setImportData(sortedImportData);
        setCurrentPageExcel(1);

        // Show detailed alert
        if (needsUpdate.length > 0 || exactDuplicates.length > 0 || nullBpCodes.length > 0) {
            Swal.fire({
                icon: "warning",
                title: "⚠️ Analysis Complete!",
                html: `
                    <div style="text-align:left; font-family: monospace;">
                        <h4>📊 Summary:</h4>
                        <p><strong>Total Upload Rows:</strong> ${importData.length}</p>
                        <p style="color: orange;"><strong>🟠 Needs Update:</strong> ${needsUpdate.length}</p>
                        <p style="color: red;"><strong>🔴 Exact Duplicates (will skip):</strong> ${exactDuplicates.length}</p>
                        <p><strong>⚠️ Null BP Codes:</strong> ${nullBpCodes.length}</p>
                        <p style="color: green;"><strong>✅ New Records:</strong> ${newRecords.length}</p>
                        <hr>
                        <p><strong>Checked against:</strong> ${allExistingRecords.length} existing records</p>
                        <p><em>Orange rows = will be updated during import</em></p>
                        <p><em>Red rows = will be skipped (no changes)</em></p>
                        <p><em>Check console (F12) for detailed breakdown.</em></p>
                    </div>
                `,
                width: 650
            });
        } else {
            Swal.fire({
                icon: "success",
                title: "✅ All Clear!",
                html: `
                    <div style="text-align:left; font-family: monospace;">
                        <p><strong>Total Upload Rows:</strong> ${importData.length}</p>
                        <p><strong>✅ All records are new!</strong></p>
                        <hr>
                        <p>Checked against: ${allExistingRecords.length} existing records</p>
                    </div>
                `,
                width: 500
            });
        }

    } catch (err) {
        console.error("💥 ERROR CHECKING DUPLICATES:", err);
        console.error("Error details:", err.message);
        console.error("Stack trace:", err.stack);
        
        Swal.fire({
            icon: "error",
            title: "Error!",
            html: `
                <div style="text-align:left;">
                    <p><strong>Something went wrong:</strong></p>
                    <p style="color: red; font-family: monospace;">${err.message}</p>
                    <p><em>Check console (F12) for details.</em></p>
                </div>
            `,
            width: 600
        });
        
        setLoadingProgress({ current: 0, total: 0 });
    } finally {
        setChecking(false);
    }
};

// 🔹 Import data into DB with UPDATE support
const importDataToDB = async () => {
    if (!importData.length) return;

    console.log("\n🚀 STARTING IMPORT TO DATABASE");
    console.log(`Total rows to import: ${importData.length}`);

    setUploading(true);
    setImporting(true);

    let successCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedRows = [];

    try {
        const BATCH_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < importData.length; i += BATCH_SIZE) {
            chunks.push(importData.slice(i, i + BATCH_SIZE));
        }

        console.log(`\n📦 Processing ${chunks.length} batches of ${BATCH_SIZE} rows each...`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`\n⚙️ Processing batch ${i + 1}/${chunks.length}...`);

            const recordsToInsert = [];
            const recordsToUpdate = [];

            chunk.forEach((row, idx) => {
                const actualRowNumber = i * BATCH_SIZE + idx + 2;

                if (!row.bp_code) return; // Skip null BP codes

                const record = {
                    distributor_code: row.distributor_code || null,
                    mother_code: row.mother_code || null,
                    bp_code: row.bp_code || null,
                    bp_name: row.bp_name || null,
                    agent_code: row.agent_code ? parseInt(row.agent_code) : null,
                    group_code: row.group_code || null,
                    status: true,
                    _rowNumber: actualRowNumber
                };

                if (row._updateFlag === 'new') {
                    recordsToInsert.push(record);
                } else if (row._updateFlag === 'update') {
                    recordsToUpdate.push({ ...record, _oldData: row._oldData });
                } else if (row._updateFlag === 'duplicate') {
                    skippedCount++;
                }
            });

            console.log(`  ✅ To Insert: ${recordsToInsert.length}`);
            console.log(`  🔄 To Update: ${recordsToUpdate.length}`);
            console.log(`  ⏭️ Skipped: ${chunk.filter(r => r._updateFlag === 'duplicate').length}`);

            // INSERT new records
            if (recordsToInsert.length > 0) {
                const cleanInserts = recordsToInsert.map(({ _rowNumber, ...r }) => r);

                const { data: insertedData, error } = await supabase
                    .from('Accounts_List')
                    .insert(cleanInserts)
                    .select();

                if (error) {
                    console.error(`❌ Insert error in batch ${i + 1}:`, error);
                    recordsToInsert.forEach((r) => {
                        failedRows.push({
                            row: r._rowNumber,
                            error: error.message,
                            bp_code: r.bp_code,
                            action: 'INSERT'
                        });
                    });
                } else {
                    const insertCount = insertedData?.length || cleanInserts.length;
                    successCount += insertCount;
                    console.log(`  ✅ Inserted ${insertCount} records`);
                }
            }

            // UPDATE existing records
            if (recordsToUpdate.length > 0) {
                console.log(`\n🔄 UPDATING ${recordsToUpdate.length} RECORDS:`);
                console.table(recordsToUpdate.map(r => ({
                    Row: r._rowNumber,
                    BP_Code: r.bp_code,
                    Old_Dist: r._oldData.distributor_code,
                    New_Dist: r.distributor_code,
                    Old_Mother: r._oldData.mother_code,
                    New_Mother: r.mother_code
                })));

                for (const record of recordsToUpdate) {
                    const { _rowNumber, _oldData, ...updateData } = record;

                    const { error: updateError } = await supabase
                        .from('Accounts_List')
                        .update(updateData)
                        .eq('bp_code', record.bp_code);

                    if (updateError) {
                        console.error(`❌ Update error for ${record.bp_code}:`, updateError);
                        failedRows.push({
                            row: _rowNumber,
                            error: updateError.message,
                            bp_code: record.bp_code,
                            action: 'UPDATE'
                        });
                    } else {
                        updatedCount++;
                        console.log(`  🔄 Updated ${record.bp_code}`);
                    }
                }
            }

            const processed = Math.min((i + 1) * BATCH_SIZE, importData.length);
            setProcessedRows(processed);
            setProgressPercent(Math.round((processed / importData.length) * 100));
            await new Promise(res => setTimeout(res, 50));
        }

        const failedCount = failedRows.length;
        const totalProcessed = importData.length;

        console.log("\n📊 IMPORT COMPLETE!");
        console.log(`✅ Successfully imported: ${successCount}`);
        console.log(`🔄 Updated: ${updatedCount}`);
        console.log(`⏭️ Skipped: ${skippedCount}`);
        console.log(`❌ Failed: ${failedCount}`);

        if (failedRows.length > 0) {
            console.log("\n❌ FAILED ROWS:");
            console.table(failedRows);
        }

        Swal.fire({
            icon: failedCount > 0 ? 'warning' : 'success',
            title: 'Import Finished!',
            html: `
            <div style="text-align:left; font-family: monospace;">
              <p><strong>✅ Imported (New):</strong> ${successCount}</p>
              <p style="color: orange;"><strong>🔄 Updated:</strong> ${updatedCount}</p>
              <p><strong>⏭️ Skipped (No Changes):</strong> ${skippedCount}</p>
              <p style="color: red;"><strong>❌ Failed:</strong> ${failedCount}</p>
              <hr>
              <p><strong>📊 Total Processed:</strong> ${totalProcessed}</p>
              ${failedCount > 0 ? '<hr><p style="color: red;"><em>Check console (F12) for failed rows details.</em></p>' : ''}
              ${updatedCount > 0 ? '<p style="color: orange;"><em>Check console (F12) for updated rows details.</em></p>' : ''}
            </div>
        `,
            confirmButtonText: 'OK',
            width: 600,
            willClose: () => {
                fetchAndCleanData();
                setShowExcelModal(false);
                setImportData([]);
                setExistingRows(new Set());
            }
        });

    } catch (error) {
        console.error('💥 IMPORT ERROR:', error);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        
        Swal.fire({
            icon: 'error',
            title: 'Import Failed',
            html: `
                <div style="text-align:left;">
                    <p><strong>Error:</strong></p>
                    <p style="color: red; font-family: monospace;">${error.message}</p>
                    <p><em>Check console (F12) for full details.</em></p>
                </div>
            `,
            width: 600
        });
    } finally {
        setUploading(false);
        setImporting(false);
    }
};

// 🔹 Handle Excel Import (no changes needed, just included for completeness)
const handleImportMother = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const rawData = await readExcelFile(file);
    if (!rawData.length) return;

    if (rawData.length > 40000) {
        Swal.fire({
            icon: 'error',
            title: 'Too Many Rows!',
            text: `Excel contains ${rawData.length.toLocaleString()} rows. Maximum allowed is 40,000 rows.`,
            confirmButtonText: 'OK'
        });
        return;
    }

    Swal.fire({
        title: 'Processing Excel...',
        text: 'Converting names to codes...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
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
            return Object.values(availableNames)[0] || rawMotherName;
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

        const processedData = rawData.map((row) => {
            const rawGroup = row.group_code?.toString().trim() || row.group_name?.toString().trim() || '';
            const rawMother = row.mother_code?.toString().trim() || row.mother_name?.toString().trim() || '';
            const rawAgent = row.agent_code?.toString().trim() || row.agent_name?.toString().trim() || '';
            const rawBp = row.bp_code?.toString().trim() || '';
            const rawDist = row.distributor_code?.toString().trim() || row.distributor_name?.toString().trim() || '';

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
                distributor_code: distributorCode || '',
                mother_code: motherCode || '',
                bp_code: bpCode || '',
                bp_name: bpName || '',
                agent_code: agentCode || '',
                group_code: groupCode || '',
                status: 'status'
            };
        });

        Swal.close();

        setFileName(file.name);
        setImportData(processedData);
        setCurrentPageExcel(1);
        setTotalRows(processedData.length);
        setProcessedRows(0);
        setProgressPercent(0);
        setDuplicatesChecked(false);

    } catch (error) {
        console.error('❌ Error processing Excel:', error);
        Swal.fire('Error', 'Failed to process Excel file', 'error');
    }
};

    // 🔹 Modal visibility

    // 🔹 Excel import data
    const [importData, setImportData] = useState([]);
    const [existingRows, setExistingRows] = useState([]);
    const [fileName, setFileName] = useState("");
    const [importing, setImporting] = useState(false);
    const [checking, setChecking] = useState(false);
    const itemsPerPage = 7;
    const exportMenuRef = useRef(null);
    const importMenuRef = useRef(null);
    const [totalCount, setTotalCount] = useState(0); // 👈 Add this line
    const [duplicatesChecked, setDuplicatesChecked] = useState(false); // ✅ track if check has been done


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
        fetchAgents(); // 🔹 Load agents on mount for mapping
        fetchMotherAccounts(); // 🔹 Load mother accounts
        fetchDistributors(); // 🔹 Load distributors
        fetchGroupMap();
    }, []);

   const fetchAndCleanData = async (page = 1, search = "") => {
    try {
        setLoading(true);
        const batchSize = itemsPerPage;
        const offset = (page - 1) * batchSize;

        let query = supabase
            .from("Accounts_List")
            .select("*", { count: "exact" })
            .order("id", { ascending: true })
            .range(offset, offset + batchSize - 1);

        // 🔍 Apply comprehensive search filter across ALL fields including names
        if (search.trim()) {
            const searchTerm = search.trim().toLowerCase();
            
            // Fetch lookup data for name searching
            const [distData, motherData, agentData, groupData] = await Promise.all([
                supabase.from('distributors').select('code, name'),
                supabase.from('sub_mother_account').select('dscode, name'),
                supabase.from('Account_Users').select('UserID, name'),
                supabase.from('mother_account').select('code, name')
            ]);

            // Create reverse maps: name -> code
            const distCodes = new Set();
            distData.data?.forEach(d => {
                if (d.name && d.name.toLowerCase().includes(searchTerm)) {
                    distCodes.add(d.code);
                }
            });

            const motherCodes = new Set();
            motherData.data?.forEach(m => {
                if (m.name && m.name.toLowerCase().includes(searchTerm)) {
                    motherCodes.add(m.dscode);
                }
            });

            const agentCodes = new Set();
            agentData.data?.forEach(a => {
                if (a.name && a.name.toLowerCase().includes(searchTerm)) {
                    agentCodes.add(a.UserID); // Keep as number
                }
            });

            const groupCodes = new Set();
            groupData.data?.forEach(g => {
                if (g.name && g.name.toLowerCase().includes(searchTerm)) {
                    groupCodes.add(g.code);
                }
            });

            // Build OR conditions for direct field matches + name matches
            const conditions = [
                `distributor_code.ilike.%${search}%`,
                `mother_code.ilike.%${search}%`,
                `bp_code.ilike.%${search}%`,
                `bp_name.ilike.%${search}%`,
                `group_code.ilike.%${search}%`
            ];

            // Add matched codes from names
            if (distCodes.size > 0) {
                conditions.push(`distributor_code.in.(${Array.from(distCodes).join(',')})`);
            }
            if (motherCodes.size > 0) {
                conditions.push(`mother_code.in.(${Array.from(motherCodes).join(',')})`);
            }
            if (agentCodes.size > 0) {
                conditions.push(`agent_code.in.(${Array.from(agentCodes).join(',')})`); // No quotes for numbers
            }
            if (groupCodes.size > 0) {
                conditions.push(`group_code.in.(${Array.from(groupCodes).join(',')})`);
            }

            // Handle agent_code as number if search term is numeric
            if (!isNaN(search)) {
                conditions.push(`agent_code.eq.${search}`);
            }

            query = query.or(conditions.join(','));
        }

        const { data: pageData, error, count } = await query;

        if (error) throw error;

        // 🧩 Clean duplicates
        const uniqueData = await autoRemoveDuplicatesOnLoad(pageData);

        // ✅ Always replace data for current page
        setData(uniqueData);
        setTotalCount(count || 0);
        setLoading(false);
    } catch (err) {
        console.error("Error:", err);
        Swal.fire("Error", err.message, "error");
        setLoading(false);
    }
};

    // ✅ STEP 2: UPDATE useEffect for search - reset to page 1
    useEffect(() => {
        const delay = setTimeout(() => {
            setCurrentPage(1); // ✅ ADD: Reset to page 1 when searching
            fetchAndCleanData(1, searchTerm);
        }, 400);

        return () => clearTimeout(delay);
    }, [searchTerm]);



    // 🔍 Filter logic


    // 🧮 Pagination (based on filtered data)
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;



    const handleNextPage = async () => {
        if (currentPage < totalPages) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            await fetchAndCleanData(nextPage, searchTerm); // ✅ CHANGE: Always fetch
        }
    };

    // ✅ STEP 6: UPDATE handlePrevPage (ADD THIS if you don't have it)
    const handlePrevPage = async () => {
        if (currentPage > 1) {
            const prevPage = currentPage - 1;
            setCurrentPage(prevPage);
            await fetchAndCleanData(prevPage, searchTerm);
        }
    };

    // ✅ STEP 7: UPDATE handleFirstPage
    const handleFirstPage = async () => {
        if (currentPage !== 1) {
            setCurrentPage(1);
            await fetchAndCleanData(1, searchTerm); // ✅ ADD: Fetch data
        }
    };

    // ✅ STEP 8: ADD handleLastPage
    const handleLastPage = async () => {
        if (currentPage !== totalPages) {
            setCurrentPage(totalPages);
            await fetchAndCleanData(totalPages, searchTerm);
        }
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



    // ✅ Fetch first 1,000 records for initial modal load
    // ✅ Fetch BP Accounts with pagination - Shows first page fast, loads more on demand
    const fetchBpAccounts = async (page = 1, searchTerm = '') => {
        const pageSize = 10;
        const offset = (page - 1) * pageSize;

        console.log(`🚀 Fetching BP Accounts - Page ${page}, Search: "${searchTerm}"`);

        try {
            let query = supabase
                .from("Bp_Accounts")
                .select("bp_code, bp_name", { count: "exact" })
                .order("bp_name", { ascending: true })
                .range(offset, offset + pageSize - 1);

            // Apply search filter if exists
            if (searchTerm.trim()) {
                query = query.or(`bp_code.ilike.%${searchTerm}%,bp_name.ilike.%${searchTerm}%`);
            }

            const { data, error, count } = await query;

            if (error) {
                console.error("❌ Error fetching BP Accounts:", error);
                throw error;
            }

            console.log(`✅ Fetched ${data?.length || 0} records (Total: ${count})`);

            return { data: data || [], count: count || 0 };
        } catch (err) {
            console.error("🔥 Error fetching Bp_Accounts:", err);
            return { data: [], count: 0 };
        }
    };

    // ✅ Fetch ALL records only during search




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
    const fetchGroupMap = async () => {
        const { data, error } = await supabase
            .from("mother_account")
            .select("code, name")
            .eq("status", true);

        if (error) {
            console.error(error);
        } else {
            const map = {};
            data.forEach(group => {
                map[group.code] = group.name;
            });
            setGroupMap(map);
        }
    };

    useEffect(() => {
        if (showDistributorModal) fetchDistributors();
        if (showMotherModal) fetchMotherAccounts();
        if (showBpModal) {
            // ✅ BP modal will load first page instantly in the modal itself
            setBpAccounts([]); // Clear old data, modal handles fetching
        }
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
            group_code: selected.group_code,

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


    const [showExcelModal, setShowExcelModal] = useState(false);




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
                "distributor_name",
                "mother_name",
                "bp_code",
                "bp_name",
                "agent_name",
                "group_name",
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

                // 🔹 Fetch all lookup tables for name conversion
                const { data: groupData } = await supabase
                    .from("mother_account")
                    .select("code, name");

                const groupMap = {};
                groupData?.forEach(g => {
                    groupMap[g.code] = g.name;
                });

                // Convert codes to names
                exportData = allData.map((row) => ({
                    distributor_name: distributorMap[row.distributor_code] || row.distributor_code || "",
                    mother_name: motherMap[row.mother_code] || row.mother_code || "",
                    bp_code: row.bp_code || "",
                    bp_name: row.bp_name || "",
                    agent_name: agentMap[row.agent_code] || row.agent_code || "",
                    group_name: groupMap[row.group_code] || row.group_code || "",
                    status: row.status ? "Active" : "Inactive",
                }));
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
                                {checking && loadingProgress.total > 0 && (
                                    <div style={{
                                        marginBottom: "15px",
                                        padding: "10px",
                                        backgroundColor: "#f8f9fa",
                                        borderRadius: "6px",
                                        border: "1px solid #dee2e6"
                                    }}>
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "8px"
                                        }}>
                                            <span style={{ fontWeight: 600, color: "#495057" }}>
                                                Loading existing records...
                                            </span>
                                            <span style={{ fontWeight: 600, color: "#0d6efd" }}>
                                                {loadingProgress.current.toLocaleString()} / {loadingProgress.total.toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{
                                            width: '100%',
                                            height: '10px',
                                            backgroundColor: '#e9ecef',
                                            borderRadius: '5px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                                                height: '100%',
                                                backgroundColor: '#0d6efd',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                        <div style={{
                                            marginTop: "6px",
                                            fontSize: "12px",
                                            color: "#6c757d",
                                            textAlign: "center"
                                        }}>
                                            {Math.round((loadingProgress.current / loadingProgress.total) * 100)}% complete
                                        </div>
                                    </div>
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
                                                    const updateFlag = row._updateFlag;
                                                    const oldData = row._oldData;
                                                    
                                                    // Determine row background and status
                                                    let rowBg = "white";
                                                    let statusText = "New";
                                                    let statusIcon = "✅";
                                                    
                                                    if (updateFlag === 'update') {
                                                        rowBg = "#fff3cd"; // Light orange/yellow
                                                        statusText = "Update";
                                                        statusIcon = "🟠";
                                                    } else if (updateFlag === 'duplicate') {
                                                        rowBg = "#ffcccc"; // Light red
                                                        statusText = "Duplicate";
                                                        statusIcon = "🔴";
                                                    } else if (updateFlag === 'null') {
                                                        rowBg = "#f8d7da"; // Light red
                                                        statusText = "Null BP";
                                                        statusIcon = "⚠️";
                                                    }
                                                    
                                                    // Helper function to check if field changed
                                                    const hasChanged = (field) => {
                                                        if (updateFlag !== 'update' || !oldData) return false;
                                                        return oldData[field] !== row[field];
                                                    };
                                                    
                                                    // Style for changed cells
                                                    const changedCellStyle = {
                                                        ...tdStyle,
                                                        backgroundColor: "#ffc107",
                                                        fontWeight: 600,
                                                        border: "2px solid #ff9800"
                                                    };

                                                    return (
                                                        <tr key={idx} style={{ backgroundColor: rowBg }}>
                                                            <td style={hasChanged('distributor_code') ? changedCellStyle : tdStyle}>
                                                                {row.distributor_code}
                                                                {hasChanged('distributor_code') && oldData && (
                                                                    <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                                                        Old: {oldData.distributor_code || 'N/A'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={hasChanged('mother_code') ? changedCellStyle : tdStyle}>
                                                                {row.mother_code}
                                                                {hasChanged('mother_code') && oldData && (
                                                                    <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                                                        Old: {oldData.mother_code || 'N/A'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={tdStyle}>{row.bp_code}</td>
                                                            <td style={hasChanged('bp_name') ? changedCellStyle : tdStyle}>
                                                                {row.bp_name}
                                                                {hasChanged('bp_name') && oldData && (
                                                                    <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                                                        Old: {oldData.bp_name || 'N/A'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={hasChanged('agent_code') ? changedCellStyle : tdStyle}>
                                                                {row.agent_code}
                                                                {hasChanged('agent_code') && oldData && (
                                                                    <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                                                        Old: {oldData.agent_code || 'N/A'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={hasChanged('group_code') ? changedCellStyle : tdStyle}>
                                                                {row.group_code}
                                                                {hasChanged('group_code') && oldData && (
                                                                    <div style={{ fontSize: "0.75em", color: "#666", marginTop: "2px" }}>
                                                                        Old: {oldData.group_code || 'N/A'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={{ ...tdStyle, fontWeight: 600 }}>
                                                                {statusIcon} {statusText}
                                                            </td>
                                                            <td style={{ textAlign: "center" }}>
                                                                <Button
                                                                    variant={updateFlag === 'duplicate' ? "danger" : updateFlag === 'update' ? "warning" : "secondary"}
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        const actualIndex = indexOfFirstRowExcel + idx;
                                                                        const updatedData = importData.filter((_, i) => i !== actualIndex);
                                                                        setImportData(updatedData);

                                                                        const stillHasDuplicates = updatedData.some(r => r._updateFlag === 'duplicate' || r._updateFlag === 'update');
                                                                        if (!stillHasDuplicates) {
                                                                            setDuplicatesChecked(false);
                                                                        }
                                                                    }}
                                                                    style={{ padding: "6px 12px", fontSize: "14px" }}
                                                                >
                                                                    🗑️ Remove
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

                        {/* ✅ DISPLAY DATA - ISANG BESES LANG! */}
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: 20 }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : data.length > 0 ? (
                            data.map((row) => (
                                <tr
                                    key={row.id}
                                    style={{
                                        borderBottom: '1px solid #ddd',
                                        transition: 'background 0.3s',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f7ff')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
                                    </td>
                                    <td style={{ padding: '10px 15px' }}>
                                        {groupMap[row.group_code] || row.group_code}
                                    </td>
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
                {/* 📄 Pagination Controls */}
                {!showAll && data.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', padding: '20px' }}>
                        <button
                            onClick={handleFirstPage}
                            disabled={currentPage === 1}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: currentPage === 1 ? '#ccc' : '#007BFF',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            }}
                        >
                            First
                        </button>

                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: currentPage === 1 ? '#ccc' : '#007BFF',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Previous
                        </button>

                        <span style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                            Page {currentPage} of {totalPages || 1}
                        </span>

                        <button
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: currentPage === totalPages ? '#ccc' : '#007BFF',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Next
                        </button>

                        <button
                            onClick={handleLastPage}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: currentPage === totalPages ? '#ccc' : '#007BFF',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Last
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
            {showBpModal && <LookupModal title="Select BP Account" columns={['Code', 'Name']} data={bpAccounts} onSelect={handleSelectBp} onClose={() => setShowBpModal(false)} fieldKeys={['bp_code', 'bp_name']} />}
            {showAgentModal && <LookupModal title="Select Agent" columns={['ID', 'Name']} data={agents} onSelect={handleSelectAgent} onClose={() => setShowAgentModal(false)} fieldKeys={['UserID', 'name']} />}
        </div >
    );
}



function LookupModal({ title, columns, data, onSelect, onClose, fieldKeys }) {
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [localData, setLocalData] = useState(data);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const pageSize = 10;

    // Check if this is BP modal (needs lazy loading)
    const isBpModal = title === 'Select BP Account';

    // Fetch data for BP modal (lazy loading)
    const fetchBpPage = async (page, searchTerm) => {
        if (!isBpModal) return;

        setLoading(true);
        try {
            const offset = (page - 1) * pageSize;
            let query = supabase
                .from("Bp_Accounts")
                .select("bp_code, bp_name", { count: "exact" })
                .order("bp_name", { ascending: true })
                .range(offset, offset + pageSize - 1);

            if (searchTerm.trim()) {
                query = query.or(`bp_code.ilike.%${searchTerm}%,bp_name.ilike.%${searchTerm}%`);
            }

            const { data: fetchedData, error, count } = await query;
            if (error) throw error;

            setLocalData(fetchedData || []);
            setTotalCount(count || 0);
        } catch (err) {
            console.error('Error fetching BP data:', err);
            setLocalData([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    // Initialize data
    useEffect(() => {
        if (isBpModal) {
            fetchBpPage(1, '');
        } else {
            setLocalData(data);
            setTotalCount(data.length);
        }
    }, []);

    // Handle search
    useEffect(() => {
        if (isBpModal) {
            setCurrentPage(1);
            fetchBpPage(1, search);
        } else {
            // For non-BP modals, filter locally
            const filtered = data.filter(row =>
                fieldKeys.some(k => String(row[k] || '').toLowerCase().includes(search.toLowerCase()))
            );
            setLocalData(filtered);
            setTotalCount(filtered.length);
        }
    }, [search]);

    // Handle page change
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        if (isBpModal) {
            fetchBpPage(newPage, search);
        }
    };

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / pageSize);
    const displayData = isBpModal ? localData : localData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
                        fontWeight: 600
                    }}>
                        {title} {isBpModal && `(${totalCount.toLocaleString()} total)`}
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
                            fontSize: 22,
                            transition: 'all 0.2s'
                        }}
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
                        />
                    </div>
                </div>

                {/* Table */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0 24px 24px'
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                            Loading...
                        </div>
                    ) : (
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
                                {displayData.length ? displayData.map((row, i) => (
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
                                                padding: '14px 16px',
                                                fontSize: 14,
                                                color: '#1f2937',
                                                background: 'white',
                                                border: '1px solid #e5e7eb',
                                                borderLeft: j === 0 ? '3px solid #2563eb' : '1px solid #e5e7eb',
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
                                            No records found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination Controls */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f9fafb'
                }}>
                    <span style={{ fontSize: 14, color: '#6b7280' }}>
                        Page {currentPage} of {totalPages || 1}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                background: (currentPage === 1 || loading) ? '#f3f4f6' : '#fff',
                                color: '#111827',
                                cursor: (currentPage === 1 || loading) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            ◀ Prev
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || totalPages === 0 || loading}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                background: (currentPage === totalPages || totalPages === 0 || loading) ? '#f3f4f6' : '#fff',
                                color: '#111827',
                                cursor: (currentPage === totalPages || totalPages === 0 || loading) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Next ▶
                        </button>
                    </div>
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
























