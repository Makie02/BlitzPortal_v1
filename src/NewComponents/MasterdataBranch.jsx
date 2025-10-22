import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from "sweetalert2";

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

    // Fetch and clean data on mount
    useEffect(() => {
        fetchAndCleanData();
    }, []);

    const fetchAndCleanData = async () => {
        try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            // 🧩 Step 1: Fetch all data in batches
            while (hasMore) {
                const { data, error } = await supabase
                    .from("Accounts_List")
                    .select("*")
                    .order("id", { ascending: true })
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error("Error fetching data:", error);
                    break;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            console.log(`✅ Loaded ${allData.length} records`);

            // 🧩 Step 2: Auto-remove duplicates based on mother_code + bp_code
            const uniqueData = await autoRemoveDuplicatesOnLoad(allData);

            // 🧩 Step 3: Set state with cleaned data
            setData(uniqueData);
        } catch (err) {
            console.error("Error:", err);
            Swal.fire("Error", err.message, "error");
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
    const filteredData = data.filter(row => {
        const term = searchTerm.toLowerCase();
        const fields = [
            row.distributor_code,
            row.mother_code,
            row.bp_code,
            row.agent_code,
            row.group_code
        ];
        return fields.some(f => (f?.toString() || '').toLowerCase().includes(term));
    });

    // Pagination
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;


    const currentItems = showAll ? filteredData : filteredData.slice(indexOfFirstItem, indexOfLastItem);

    // Fetch dropdowns
    const fetchDistributors = async () => {
        const { data, error } = await supabase
            .from("distributors")
            .select("code, name,agent_code")
            .order("name", { ascending: true });
        if (error) console.error(error);
        else setDistributors(data);
    };

    const fetchMotherAccounts = async () => {
        const { data, error } = await supabase
            .from("sub_mother_account")
            .select("dscode, name, group_code, group_name")
            .eq("status", true)
            .order("name", { ascending: true });
        if (error) console.error(error);
        else setMotherAccounts(data);
    };

    const fetchBpAccounts = async () => {
        const { data, error } = await supabase
            .from("Bp_Accounts")
            .select("bp_code, bp_name")
            .order("bp_name", { ascending: true });
        if (error) console.error(error);
        else setBpAccounts(data);
    };

    const fetchAgents = async () => {
        const { data, error } = await supabase
            .from("Account_Users")
            .select("UserID, name")
            .order("name", { ascending: true });
        if (error) console.error(error);
        else setAgents(data);
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

    
const handleImportMother = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const data = await readExcelFile(file);
  if (!data.length) return;

  // ✅ Check 40K limit
  if (data.length > 40000) {
    Swal.fire({
      icon: 'error',
      title: 'Too Many Rows!',
      text: `Excel contains ${data.length.toLocaleString()} rows. Maximum allowed is 40,000 rows.`,
      confirmButtonText: 'OK'
    });
    return;
  }

  setUploading(true);
  setTotalRows(data.length);
  setProcessedRows(0);
  setProgressPercent(0);

  // ✅ Track success and failures
  let successCount = 0;
  let failedRows = [];

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

  // ✅ STEP 1: Create Group Name → Group Code mapping
  const groupNameToCodeMap = {};
  motherAccounts?.forEach(m => {
    if (m.group_name && m.group_code) {
      const normalizedGroupName = m.group_name.toString().trim().toLowerCase();
      groupNameToCodeMap[normalizedGroupName] = m.group_code.toString();
    }
  });

  console.log('📋 Group Name to Code Map:', groupNameToCodeMap);

  // ✅ STEP 2: Build Mother lookup by Group Code + Name
  // Structure: groupCode → { normalizedName → dscode, exactName → dscode }
  const motherLookup = {};

  motherAccounts?.forEach(m => {
    const groupCode = m.group_code?.toString().trim();
    const exactName = m.name?.toString().trim().toLowerCase();
    
    // Normalize: remove punctuation and extra spaces
    const normalizedName = exactName
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!groupCode || !m.name) return;

    if (!motherLookup[groupCode]) {
      motherLookup[groupCode] = {};
    }

    // Store both exact and normalized versions
    motherLookup[groupCode][exactName] = m.dscode;
    motherLookup[groupCode][normalizedName] = m.dscode;
  });

  console.log('🔍 Mother Lookup by Group:', motherLookup);

  // ✅ Helper: Find mother_code using Group Code priority
  const findMotherCode = (rawMotherName, resolvedGroupCode) => {
    const groupCode = resolvedGroupCode?.toString().trim();
    
    if (!groupCode || !motherLookup[groupCode]) {
      console.error(`❌ No mothers found for group code: ${groupCode}`);
      return rawMotherName; // Return original if group not found
    }

    const exactName = rawMotherName.toString().trim().toLowerCase();
    const normalizedName = exactName
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const availableNames = motherLookup[groupCode];

    // Priority 1: Exact match
    if (availableNames[exactName]) {
      console.log(`✅ Exact match: "${rawMotherName}" → ${availableNames[exactName]}`);
      return availableNames[exactName];
    }

    // Priority 2: Normalized match (ignores punctuation)
    if (availableNames[normalizedName]) {
      console.log(`✅ Normalized match: "${rawMotherName}" → ${availableNames[normalizedName]}`);
      return availableNames[normalizedName];
    }

    // Priority 3: Partial match (fuzzy)
    const nameKeys = Object.keys(availableNames);
    const fuzzyMatch = nameKeys.find(dbName => 
      dbName.includes(normalizedName) || normalizedName.includes(dbName)
    );

    if (fuzzyMatch) {
      console.log(`✅ Fuzzy match: "${rawMotherName}" matched "${fuzzyMatch}" → ${availableNames[fuzzyMatch]}`);
      return availableNames[fuzzyMatch];
    }

    // Priority 4: Return first available dscode in this group (last resort)
    const firstDscode = Object.values(availableNames)[0];
    console.warn(`⚠️ Using first available dscode for group ${groupCode}: "${rawMotherName}" → ${firstDscode}`);
    return firstDscode;
  };

  // ✅ Helper maps for other codes
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
    if (b.bp_code && b.bp_name) {
      bpNameMap[b.bp_code.toString().trim().toLowerCase()] = b.bp_name;
    }
  });

  const isCode = (val) => /^[A-Z0-9\-_]+$/i.test(val || '');

  // ✅ Process data in batches
  const BATCH_SIZE = 500;
  const chunks = [];
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    chunks.push(data.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const records = chunk.map((row, idx) => {
      const actualRowNumber = i * BATCH_SIZE + idx + 2; // +2 for Excel header row
      
      const rawGroup = row.group_code?.toString().trim() || '';
      const rawMother = row.mother_code?.toString().trim() || '';
      const rawAgent = row.agent_code?.toString().trim() || '';
      const rawBp = row.bp_code?.toString().trim() || '';
      const rawDist = row.distributor_code?.toString().trim() || '';

      // 🎯 STEP 1: Convert Group Code FIRST
      let groupCode = rawGroup;
      if (!isCode(rawGroup)) {
        groupCode = groupNameToCodeMap[rawGroup.toLowerCase()] || rawGroup;
        console.log(`📌 Group converted: "${rawGroup}" → ${groupCode}`);
      }

      // 🎯 STEP 2: Use resolved Group Code to find Mother Code
      let motherCode = rawMother;
      if (!isCode(rawMother)) {
        motherCode = findMotherCode(rawMother, groupCode);
      } else {
        console.log(`✅ Mother code already valid: ${rawMother}`);
      }

      // 🎯 STEP 3: Resolve other codes
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
        _rowNumber: actualRowNumber // Track row number for error reporting
      };
    });

    // ✅ Remove _rowNumber before insert
    const recordsToInsert = records.map(r => {
      const { _rowNumber, ...record } = r;
      return record;
    });

    const { data: insertedData, error } = await supabase
      .from('Accounts_List')
      .insert(recordsToInsert)
      .select();

    if (error) {
      console.error('Insert error:', error);
      // Track failed rows with detailed error info
      records.forEach((r, idx) => {
        failedRows.push({
          row: r._rowNumber,
          distributor_code: r.distributor_code,
          mother_code: r.mother_code,
          bp_code: r.bp_code,
          bp_name: r.bp_name,
          agent_code: r.agent_code,
          group_code: r.group_code,
          error: error.message,
          error_code: error.code,
          error_details: error.details || 'N/A'
        });
      });
    } else {
      // Count successful inserts
      successCount += insertedData?.length || recordsToInsert.length;
    }

    const processed = Math.min((i + 1) * BATCH_SIZE, data.length);
    setProcessedRows(processed);
    setProgressPercent(Math.round((processed / data.length) * 100));
    await new Promise(res => setTimeout(res, 50));
  }

  setUploading(false);

  // ✅ Show detailed results
  const failedCount = failedRows.length;
  const totalProcessed = data.length;

  if (failedCount === 0) {
    // ✅ All successful
    let countdown = 3;
    Swal.fire({
      icon: 'success',
      title: 'Import Completed!',
      html: `
        <div style="text-align: left; padding: 10px;">
          <p><strong>✅ Successfully imported:</strong> ${successCount.toLocaleString()} rows</p>
          <p><strong>📊 Total processed:</strong> ${totalProcessed.toLocaleString()} rows</p>
          <p><strong>❌ Failed:</strong> 0 rows</p>
        </div>
        <br>Closing in <b>${countdown}</b> seconds...
      `,
      showConfirmButton: false,
      timer: countdown * 1000,
      timerProgressBar: true,
      didOpen: () => {
        const b = Swal.getHtmlContainer().querySelector('b');
        const timer = setInterval(() => {
          countdown--;
          if (b) b.textContent = countdown;
          if (countdown <= 0) clearInterval(timer);
        }, 1000);
      },
      willClose: () => fetchAccountsList()
    });
  } else {
    // ⚠️ Some failed - Show detailed error report
    const failedRowNumbers = failedRows.slice(0, 20).map(f => f.row).join(', ');
    const moreFailures = failedCount > 20 ? `... and ${failedCount - 20} more` : '';

    // Create downloadable error report
    const createErrorReport = () => {
      const headers = ['Excel Row', 'Error Message', 'Error Code', 'Distributor', 'Mother', 'BP Code', 'Agent', 'Group'];
      const csvContent = [
        headers.join(','),
        ...failedRows.map(f => [
          f.row,
          `"${f.error.replace(/"/g, '""')}"`,
          f.error_code || 'N/A',
          f.distributor_code || '',
          f.mother_code || '',
          f.bp_code || '',
          f.agent_code || '',
          f.group_code || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `import_errors_${new Date().getTime()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    // Group errors by type
    const errorTypes = {};
    failedRows.forEach(f => {
      const errorKey = f.error_code || f.error;
      if (!errorTypes[errorKey]) {
        errorTypes[errorKey] = { count: 0, example: f.row };
      }
      errorTypes[errorKey].count++;
    });

    const errorSummary = Object.entries(errorTypes)
      .map(([error, info]) => `<li><strong>${error}:</strong> ${info.count} rows (e.g., row ${info.example})</li>`)
      .join('');

    Swal.fire({
      icon: 'warning',
      title: 'Import Completed with Errors',
      html: `
        <div style="text-align: left; padding: 10px;">
          <p><strong>✅ Successfully imported:</strong> ${successCount.toLocaleString()} rows</p>
          <p><strong>❌ Failed to import:</strong> ${failedCount.toLocaleString()} rows</p>
          <p><strong>📊 Total processed:</strong> ${totalProcessed.toLocaleString()} rows</p>
          <hr>
          <p><strong>Error Summary:</strong></p>
          <ul style="font-size: 12px; text-align: left; max-height: 150px; overflow-y: auto;">
            ${errorSummary}
          </ul>
          <hr>
          <p><strong>First 20 Failed Rows:</strong></p>
          <p style="color: #d33; font-size: 12px;">${failedRowNumbers}${moreFailures}</p>
          <p style="font-size: 11px; color: #666;">Click "Download Error Report" to see all failed rows with details</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '📥 Download Error Report',
      cancelButtonText: 'Close',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      willClose: () => fetchAccountsList()
    }).then((result) => {
      if (result.isConfirmed) {
        createErrorReport();
        Swal.fire({
          icon: 'success',
          title: 'Error Report Downloaded!',
          text: 'Check your downloads folder for the CSV file.',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });

    // Log detailed errors to console
    console.error('❌ Failed Rows Details:', failedRows);
    console.table(failedRows);
  }
};



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



 const handleExport = (type) => {
    if (!data || data.length === 0) {
        Swal.fire('Error', 'No data to export', 'error');
        return;
    }

    // ✅ Added bp_name
    const headers = [
        'distributor_code',
        'mother_code',
        'bp_code',
        'bp_name',  // 👈 added this
        'agent_code',
        'group_code',
        'status'
    ];

    let exportData = [];

    if (type === 'template') {
        // Export an empty row with all headers
        exportData = [Object.fromEntries(headers.map(k => [k, ""]))];
    } else if (type === 'all') {
        exportData = data.map(row => {
            const obj = {};
            headers.forEach(k => obj[k] = row[k] ?? '');
            return obj;
        });
    }

    // ✅ Generate Excel
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AccountsList');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `accounts_list_${type}.xlsx`);
    setShowExportMenu(false);
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
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                                onClick={() => {
                                    handleExport('all');
                                    setShowExportMenu(false);
                                }}
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
                            {/* Upload Excel */}
                       

                            {/* Extract Data Mother */}
                            <div
                                style={styles.menuItem}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f0fe')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                                onClick={() => document.getElementById('mother-upload').click()}
                            >
                                 Upload Excel File
                            </div>
                        </div>
                    )}

                    {/* Hidden file inputs */}
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportExcel}
                        style={{ display: 'none' }}
                        id="excel-upload"
                    />

                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportMother}
                        style={{ display: 'none' }}
                        id="mother-upload"
                    />
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


            <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={styles.searchInput} />
                <button onClick={() => setShowAll(!showAll)} style={styles.btn}>{showAll ? 'Paginate' : 'Show All'}</button>
            </div>

            <div style={{ overflowX: 'auto', margin: '20px 0', fontFamily: 'Arial, sans-serif' }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: '800px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <thead>
                        <tr style={{ backgroundColor: '#007BFF', color: '#fff', textAlign: 'left' }}>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Distributor</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Mother Code</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>BP Code</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>BP Name</th>

                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Agent Code</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Group Code</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Status</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {uploading && (
                            <tr>
                                <td colSpan={7} style={{ padding: '10px 15px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        <div style={{
                                            background: '#e0e0e0',
                                            borderRadius: 5,
                                            overflow: 'hidden',
                                            height: 20,
                                        }}>
                                            <div style={{
                                                width: `${progressPercent}%`,
                                                height: '100%',
                                                background: 'linear-gradient(90deg, #4f46e5, #3b82f6)',
                                                transition: 'width 0.3s ease-in-out',
                                                textAlign: 'center',
                                                color: 'white',
                                                fontWeight: 600,
                                            }}>
                                                {processedRows} / {totalRows} rows
                                            </div>
                                        </div>
                                        {countdown > 0 && (
                                            <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#1d4ed8' }}>
                                                Completed! Closing in {countdown}...
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}


                        {currentItems.length ? currentItems.map(row => (
                            <tr key={row.id} style={{ borderBottom: '1px solid #ddd', transition: 'background 0.3s', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f7ff'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding: '10px 15px' }}>{row.distributor_code}</td>
                                <td style={{ padding: '10px 15px' }}>{row.mother_code}</td>
                                <td style={{ padding: '10px 15px' }}>{row.bp_code}</td>
                                <td style={{ padding: '10px 15px' }}>{row.bp_name}</td>

                                <td style={{ padding: '10px 15px' }}>{row.agent_code}</td>
                                <td style={{ padding: '10px 15px' }}>{row.group_code}</td>
                                <td style={{ padding: '10px 15px', fontWeight: 'bold', color: row.status ? 'green' : 'red' }}>
                                    {row.status ? 'Active' : 'Inactive'}
                                </td>
                                <td style={{ padding: '10px 15px', display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleEdit(row)}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#28a745',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}>
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(row.id)}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#dc3545',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        )) : !uploading && (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#777' }}>No records</td>
                            </tr>
                        )}
                    </tbody>

                </table>

                {filteredData.length > 0 && !showAll && (
                    <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ccc', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
                            First
                        </button>
                        <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ccc', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
                            Previous
                        </button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ccc', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
                            Next
                        </button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ccc', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
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

const modalStyles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal: { background: 'white', borderRadius: 8, width: 600, maxHeight: '90vh', overflowY: 'auto', padding: 20 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: 15, marginBottom: 20 },
    closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' },
    footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }
};
























