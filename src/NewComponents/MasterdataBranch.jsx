import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from "sweetalert2";

export default function MasterDataManager() {
    const [data, setData] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [newRecord, setNewRecord] = useState({
        distributor_code: '',
        distributor_name: '',
        mother_code: '',
        mother_acct: '',
        bp_code: '',
        bp_name: '',
        agent_code: '',
        agent_name: '',
        group_code: '',
        group_name: ''
    });

    // useEffect(() => {
    //     const fetchMasterData = async () => {
    //         const batchSize = 1000;
    //         let allData = [];
    //         let hasMore = true;
    //         let offset = 0;

    //         while (hasMore) {
    //             console.log(`📥 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`);

    //             const { data, error } = await supabase
    //                 .from("master_data_list")
    //                 .select("*")
    //                 .order("id", { ascending: true })
    //                 .range(offset, offset + batchSize - 1);

    //             console.log(
    //                 `✅ Fetched batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`
    //             );

    //             if (error) {
    //                 console.error("❌ Error fetching master data:", error);
    //                 break;
    //             }

    //             if (data && data.length > 0) {
    //                 allData = [...allData, ...data];
    //                 offset += batchSize;
    //                 hasMore = data.length === batchSize;
    //                 console.log(`📊 Total records so far: ${allData.length}`);
    //             } else {
    //                 hasMore = false;
    //             }
    //         }

    //         setData(allData);
    //         console.log(`🎉 Finished fetching all master data: ${allData.length}`);
    //     };

    //     fetchMasterData();
    // }, []);



    // Deduplicate function: keep newest, delete old duplicates
const autoRemoveDuplicatesOnLoad = async (data) => {
  if (!Array.isArray(data) || data.length === 0) return [];

  const seen = {}; // key -> newest record
  const toDelete = [];

  for (const record of data) {
    const key = `${record.mother_code || ''}|${record.bp_code || ''}`;
    
    if (!key.trim()) {
      // No mother_code & bp_code -> can't compare
      continue;
    }

    if (seen[key]) {
      // Compare created_at/updated_at
      const existing = seen[key];
      const existingTime = new Date(existing.updated_at || existing.created_at).getTime();
      const currentTime = new Date(record.updated_at || record.created_at).getTime();

      if (currentTime > existingTime) {
        // Current is newer -> delete old
        if (existing.id) toDelete.push(existing.id);
        seen[key] = record;
      } else {
        // Keep existing -> delete current
        if (record.id) toDelete.push(record.id);
      }
    } else {
      seen[key] = record;
    }
  }

  if (toDelete.length > 0) {
    console.log(`🧹 Removing ${toDelete.length} duplicate(s)...`);
    const chunkSize = 500;
    let totalDeleted = 0;

    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('master_data_list')
        .delete()
        .in('id', chunk);

      if (!error) totalDeleted += chunk.length;
      else console.warn('⚠️ Error deleting chunk:', error);
    }

    Swal.fire({
      icon: 'success',
      title: 'Cleanup',
      text: `Deleted ${totalDeleted}/${toDelete.length} old duplicate(s).`,
      timer: 2000,
      showConfirmButton: false
    });
  } else {
    console.log('✅ No duplicates found.');
  }

  // Return array of unique records
  return Object.values(seen);
};

// UseEffect to fetch and clean data
useEffect(() => {
  const fetchAndCleanData = async () => {
    const batchSize = 1000;
    let allData = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      const { data, error } = await supabase
        .from('master_data_list')
        .select('*')
        .order('id', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('❌ Error fetching data:', error);
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

    // Remove duplicates based on mother_code + bp_code
    const uniqueData = await autoRemoveDuplicatesOnLoad(allData);

    setData(uniqueData);
    console.log(`🎉 Finished loading and deduplicating: ${uniqueData.length} records.`);
  };

  fetchAndCleanData();
}, []);

    const [loading, setLoading] = useState(false);

    const handleExportSelected = async () => {
        if (!newRecord || Object.keys(newRecord).length === 0) {
            alert("⚠️ No selection to export!");
            return;
        }

        setLoading(true);

        try {
            // Fetch all master data in batches
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            while (hasMore) {
                const { data: batchData, error } = await supabase
                    .from("master_data_list")
                    .select("*")
                    .order("id", { ascending: true })
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error("❌ Error fetching master data:", error);
                    alert("❌ Error fetching master data!");
                    setLoading(false);
                    return;
                }

                if (batchData && batchData.length > 0) {
                    allData = [...allData, ...batchData];
                    offset += batchSize;
                    hasMore = batchData.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            if (allData.length === 0) {
                alert("⚠️ No master data available!");
                setLoading(false);
                return;
            }

            const { agent_code, distributor_code, mother_code } = newRecord;

            // Filter depending on what is selected
            const exportDataRaw = allData.filter((row) => {
                const rowAgent = row.agent_code ? row.agent_code.toString().trim() : "";
                const rowDistributor = row.distributor_code ? row.distributor_code.toString().trim() : "";
                const rowMother_code = row.mother_code ? row.mother_code.toString().trim() : "";

                let match = true;

                if (agent_code) match = match && rowAgent === agent_code.toString().trim();
                if (distributor_code) match = match && rowDistributor === distributor_code.toString().trim();
                if (mother_code) match = match && rowMother_code === mother_code.toString().trim();

                return match;
            });

            if (exportDataRaw.length === 0) {
                alert("⚠️ No matching data found for the selection!");
                setLoading(false);
                return;
            }

            console.log(`✅ Exporting ${exportDataRaw.length} row(s) matching selection`);

            const headers = [
                "distributor_code",
                "distributor_name",
                "mother_code",
                "mother_acct",
                "bp_code",
                "bp_name",
                "agent_code",
                "agent_name",
                "group_code",
                "group_name",
            ];

            const exportData = exportDataRaw.map((row) => {
                const filteredRow = {};
                headers.forEach((key) => (filteredRow[key] = row[key] ?? ""));
                return filteredRow;
            });

            // Export to Excel
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "SelectedData");
            const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
            const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
            saveAs(blob, `selected_agent_distributor.xlsx`);
        } catch (err) {
            console.error("❌ Error exporting data:", err);
            alert("❌ Error exporting data!");
        } finally {
            setLoading(false);
        }
    };



    // Export to Excel
    const handleExport = (type) => {
        if (!data || data.length === 0) {
            alert("⚠️ No data available to export!");
            return;
        }

        const headers = [
            "distributor_code",
            "distributor_name",
            "mother_code",
            "mother_acct",
            "bp_code",
            "bp_name",
            "agent_code",
            "agent_name",
            "group_code",
            "group_name"
        ];

        let exportData = [];

        switch (type) {
            case 'template':
                // Single empty row with headers
                exportData = [Object.fromEntries(headers.map(key => [key, ""]))];
                break;

            case 'all':
                // Map all data rows keeping only headers
                exportData = data.map(row => {
                    const filtered = {};
                    headers.forEach(key => filtered[key] = row[key] ?? '');
                    return filtered;
                });
                break;

            case 'tagging':
                // Map only selected fields for tagging
                exportData = data.map(row => ({
                    distributor_code: row.distributor_code ?? '',
                    distributor_name: row.distributor_name ?? '',
                    bp_code: row.bp_code ?? '',
                    bp_name: row.bp_name ?? ''
                }));
                break;

            default:
                console.error("Unknown export type:", type);
                return;
        }

        // Convert to Excel
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'MasterData');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(blob, `master_data_${type}.xlsx`);

        console.log(`✅ Exported ${exportData.length} rows as ${type}`);
    };

    // Export selected record only

    const handleImportClick = (mode) => {
        setImportMode(mode);          // 'add' or 'update'
        setShowImportMenu(false);     // close menu
        document.getElementById('excel-upload').click(); // open file picker
    };


    // Import Excel to Supabase
    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setUploading(true);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arr = new Uint8Array(e.target.result);
                const workbook = XLSX.read(arr, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const sheetData = XLSX.utils.sheet_to_json(sheet);

                if (!sheetData || sheetData.length === 0) {
                    Swal.fire("⚠️ No data found in the Excel file!");
                    return;
                }

                const now = new Date().toISOString();
                let addedCount = 0;
                let updatedCount = 0;

                for (const row of sheetData) {
                    if (!row.distributor_code) continue;

                    // Check if the row already exists
                    const { data: existing, error: selectError } = await supabase
                        .from("master_data_list")
                        .select("*")
                        .eq("distributor_code", row.distributor_code)
                        .single();

                    if (selectError && selectError.code !== "PGRST116") {
                        console.error("❌ Error checking existing row:", selectError);
                        continue;
                    }

                    if (existing) {
                        // Update existing row
                        const { error: updateError } = await supabase
                            .from("master_data_list")
                            .update({ ...row, updated_at: now })
                            .eq("distributor_code", row.distributor_code);

                        if (updateError) {
                            console.error("❌ Error updating:", updateError);
                        } else {
                            updatedCount++;
                            console.log("✅ Updated distributor_code:", row.distributor_code);
                        }
                    } else {
                        // Insert new row
                        const { error: insertError } = await supabase
                            .from("master_data_list")
                            .insert({ ...row, created_at: now, updated_at: now });

                        if (insertError) {
                            console.error("❌ Error inserting:", insertError);
                        } else {
                            addedCount++;
                            console.log("➕ Added distributor_code:", row.distributor_code);
                        }
                    }
                }

                // Refresh data after import
                const { data: refreshed } = await supabase.from("master_data_list").select("*").order("id");
                setData(refreshed || []);

                Swal.fire({
                    icon: "success",
                    title: "Import Complete",
                    html: `
                   
                `,
                });
            };

            reader.readAsArrayBuffer(file);
        } catch (err) {
            console.error("❌ Unexpected error:", err);
            Swal.fire("❌ Unexpected error during import");
        } finally {
            setUploading(false);
        }
    };

    const [showImportMenu, setShowImportMenu] = useState(false);
    const [importMode, setImportMode] = useState('add'); // 'add' or 'update'

    const menuItemStyle = {
        padding: '10px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid #eee',
        transition: 'background 0.2s'
    };


    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewRecord(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmitNew = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrorMessage('');
        try {
            const recordToInsert = {
                ...newRecord,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const { data: inserted, error } = await supabase
                .from('master_data_list')
                .insert([recordToInsert])
                .select()
                .single();
            if (error) setErrorMessage(error.message);
            else {
                setData(prev => [...prev, inserted]);
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
                    group_name: ''
                });
                setShowModal(false);
            }
        } catch {
            setErrorMessage('Unexpected error');
        } finally {
            setSaving(false);
        }
    };


    const handleDelete = async (id) => {
        // SweetAlert confirmation
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
        });

        if (!result.isConfirmed) return; // exit if cancelled

        try {
            const { error } = await supabase
                .from("master_data_list")
                .delete()
                .eq("id", id);

            if (error) {
                console.error("❌ Delete failed:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Failed!',
                    text: 'Could not delete record.',
                });
            } else {
                setData(prev => prev.filter(row => row.id !== id));
                console.log("🗑️ Deleted record ID:", id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Record has been deleted.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'Oops!',
                text: 'Unexpected error occurred.',
            });
        }
    };


    // Edit button handler
    const [isEditing, setIsEditing] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isEditing) {
            await handleUpdate();
        } else {
            await handleSubmitNew(e);
        }
    };

    const handleEdit = (row) => {
        setNewRecord({ ...row }); // clone row
        setIsEditing(true);       // mark as editing
        setShowModal(true);
    };

    // Update record
    const handleUpdate = async () => {
        if (!newRecord?.id) return Swal.fire("⚠️ No record selected for update");

        try {
            const { id, ...updateData } = newRecord;
            delete updateData.created_at;

            const { data, error } = await supabase
                .from("master_data_list")
                .update({ ...updateData, updated_at: new Date().toISOString() })
                .eq("id", id);

            if (error) return Swal.fire("❌ Failed to update", error.message, "error");

            setData(prev => prev.map(row => row.id === id ? { ...row, ...updateData } : row));
            setShowModal(false);
            setIsEditing(false); // reset editing state
            Swal.fire("✅ Updated!", "Record has been updated.", "success");
        } catch (err) {
            Swal.fire("❌ Unexpected error", err.message, "error");
        }
    };

    // Distributor modal state
    const [showDistributorModal, setShowDistributorModal] = useState(false);
    const [distributors, setDistributors] = useState([]);

    const fetchDistributors = async () => {
        const { data, error } = await supabase
            .from("distributors")
            .select("code, name, description")
            .order("name", { ascending: true });
        if (error) console.error(error);
        else setDistributors(data);
    };

    useEffect(() => {
        if (showDistributorModal) fetchDistributors();
    }, [showDistributorModal]);

    const handleSelectDistributor = (selected) => {
        console.log("Distributor selected:", selected);
        setNewRecord(prev => ({
            ...prev,
            distributor_code: selected.code,
            distributor_name: selected.name
        }));
        setShowDistributorModal(false);
    };


    // Mother account modal
    const [showMotherModal, setShowMotherModal] = useState(false);
    const [motherAccounts, setMotherAccounts] = useState([]);

    const fetchMotherAccounts = async () => {
        const { data, error } = await supabase
            .from("sub_mother_account")
            .select("dscode, name, group_name,group_code")
            .eq("status", true)
            .order("name", { ascending: true });
        if (error) console.error(error);
        else setMotherAccounts(data);
    };

    useEffect(() => {
        if (showMotherModal) fetchMotherAccounts();
    }, [showMotherModal]);

    const handleSelectMother = (selected) => {
        console.log("Mother Account selected:", selected);

        setNewRecord(prev => ({
            ...prev,
            mother_code: selected.dscode,       // code
            mother_acct: selected.name,         // name
            group_code: selected.group_code || '', // add this if your data has a group code
            group_name: selected.group_name || ''  // add this so it displays
        }));

        setShowMotherModal(false);
    };

    // 🔹 Agent modal
    const [showAgentModal, setShowAgentModal] = useState(false);
    const [agents, setAgents] = useState([]);

    const fetchAgents = async () => {
        const { data, error } = await supabase
            .from("Account_Users")
            .select("UserID, name")
            .order("name", { ascending: true });
        if (error) console.error(error);
        else setAgents(data);
    };

    useEffect(() => {
        if (showAgentModal) fetchAgents();
    }, [showAgentModal]);

    const handleSelectAgent = (selected) => {
        console.log("Agent selected:", selected);
        setNewRecord(prev => ({
            ...prev,
            agent_code: selected.UserID,
            agent_name: selected.name
        }));
        setShowAgentModal(false);
    };
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const [showExportMenu, setShowExportMenu] = useState(false);




    const [showTaggingModal, setShowTaggingModal] = useState(false);
    const [taggingForm, setTaggingForm] = useState({
        distributor_code: '',
        mother_code: ''
    });

    // Handle input change for tagging form
    const handleTaggingChange = (e) => {
        const { name, value } = e.target;
        setTaggingForm(prev => ({ ...prev, [name]: value }));
        setNewRecord(prev => ({
            ...prev,
            [name]: value === '' ? '' : Number(value) // convert to number
        }));
    };

    // Handle generate template button
    const handleGenerateTaggingTemplate = () => {
        const distributorBase = parseInt(newRecord.distributor_code) || 5001;

        // Make sure range_count is a number
        let count = Number(newRecord.range_count) || 1;
        count = Math.max(1, Math.min(count, 99999999)); // clamp

        // Generate rows with all fields populated from newRecord
        const rows = [];
        for (let i = 0; i < count; i++) {
            rows.push({
                distributor_code: distributorBase,
                distributor_name: newRecord.distributor_name || '',
                mother_code: newRecord.mother_code || '',
                mother_acct: newRecord.mother_acct || '',
                bp_code: newRecord.bp_code || '',
                bp_name: newRecord.bp_name || '',
                agent_code: newRecord.agent_code || '',
                agent_name: newRecord.agent_name || '',
                group_code: newRecord.group_code || '',
                group_name: newRecord.group_name || ''
            });
        }

        // Export to Excel
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'TaggingTemplate');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(blob, 'tagging_template.xlsx');

        // Reset the form
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





    // Add state at the top
// State
const [searchTerm, setSearchTerm] = useState('');
const [showAll, setShowAll] = useState(false);

// Filtered data
const filteredData = data.filter(row => {
    const term = searchTerm.toLowerCase();

    // Convert all values to string before calling toLowerCase
    const fields = [
        row.distributor_code,
        row.distributor_name,
        row.mother_code,
        row.mother_acct,
        row.bp_code,
        row.bp_name,
        row.agent_code,
        row.agent_name,
        row.group_code,
        row.group_name
    ];

    return fields.some(f => (f?.toString() || '').toLowerCase().includes(term));
});

// Pagination logic
const currentItems = showAll ? filteredData : filteredData.slice(indexOfFirstItem, indexOfLastItem);

    useEffect(() => {
        const items = document.querySelectorAll('.export-multiple-tooltip');
        items.forEach(tooltip => {
            const parent = tooltip.parentElement;
            parent.addEventListener('mouseenter', () => { tooltip.style.display = 'flex'; });
            parent.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
        });
    }, [showExportMenu]);




    const [selectedLabel, setSelectedLabel] = useState('');
    const [showTooltip, setShowTooltip] = useState(false);
    const [showModalmutiple, setShowModalmutiple] = useState(false);


    const handleOptionClick = (label) => {
        setSelectedLabel(label);
        setShowModalmutiple(true);
        setShowTooltip(false);
    };

    const exportItems = [
        { label: "Export Template Only", type: "template", title: "Export Template Only" },
        { label: "Export All Data", type: "all", title: "Export All Data" },
        { label: "Export for Tagging", type: "tagging", title: "Export for Tagging" },
        { label: "Export for Multiple", type: "multiple", title: "Export for Multiple choice" },
    ];

    const exportMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
                setShowExportMenu(false);
            }
        };

        if (showExportMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExportMenu]);

    const importMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (importMenuRef.current && !importMenuRef.current.contains(event.target)) {
                setShowImportMenu(false);
            }
        };

        if (showImportMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showImportMenu]);

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>📘 Master Data List</h2>

            <div style={styles.buttonContainer}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 5,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        ⬇️ Export
                        <span style={{ fontSize: 12 }}>▼</span>
                    </button>
                    {showExportMenu && (
                        <div
                            ref={exportMenuRef}
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                background: 'white',
                                border: '1px solid #ccc',
                                borderRadius: '5px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                zIndex: 10,
                                width: 220,
                                fontSize: 14,
                            }}
                        >
                            {exportItems.map(item => (
                                <div
                                    key={item.type}
                                    style={{
                                        position: 'relative',
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        transition: 'background 0.2s',
                                    }}
                                    title={item.title}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = '#dbeafe';
                                        if (item.type === 'multiple') setShowTooltip(true);
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'white';
                                        if (item.type === 'multiple') setShowTooltip(false);
                                    }}
                                    onClick={() => {
                                        setShowExportMenu(false);
                                        if (item.type === 'tagging') setShowTaggingModal(true);
                                        else if (item.type !== 'multiple') handleExport(item.type);
                                    }}
                                >
                                    <span>📄</span>
                                    {item.label}

                                    {item.type === 'multiple' && showTooltip && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: '140px',
                                                minWidth: 180,
                                                background: '#91d3ffff',
                                                color: 'black',
                                                padding: '12px 15px',
                                                borderRadius: 8,
                                                fontSize: 14,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                zIndex: 20,
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                                            }}
                                        >
                                            {['Agent', 'Distributor', 'Mother'].map((label, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        padding: '10px 0',
                                                        cursor: 'pointer',
                                                        borderRadius: 4,
                                                        transition: 'background 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 5,
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#d6d6d6ff'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    onClick={() => handleOptionClick(label)}
                                                >
                                                    {label}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}



                    {/* Modal */}
                    {showModalmutiple && (
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100vw',
                                height: '100vh',
                                background: 'rgba(0,0,0,0.5)',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 50,
                            }}
                            onClick={() => setShowModalmutiple(false)}
                        >
                            <div
                                style={{
                                    background: '#fff',
                                    padding: 30,
                                    borderRadius: 12,
                                    minWidth: 360,
                                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h2 style={{ marginBottom: 20, color: '#333', textAlign: 'center' }}>
                                    {selectedLabel} Form
                                </h2>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        alert(`Submitted data for ${selectedLabel}`);
                                    }}
                                >
                                    <div style={{ marginBottom: 15, display: 'flex', alignItems: 'center' }}>
                                        <label style={{ flex: 1, fontWeight: 500 }}>{selectedLabel} Name:</label>
                                        <input
                                            type="text"
                                            style={{
                                                flex: 2,
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                border: '1px solid #ccc',
                                            }}
                                            value={
                                                selectedLabel === 'Agent'
                                                    ? newRecord.agent_name || ''
                                                    : selectedLabel === 'Distributor'
                                                        ? newRecord.distributor_name || ''
                                                        : selectedLabel === 'Mother'
                                                            ? newRecord.mother_acct || ''
                                                            : ''
                                            }
                                            readOnly
                                        />
                                        {/* Magnifying glass buttons */}
                                        {selectedLabel === 'Agent' && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAgentModal(true)}
                                                style={{
                                                    marginLeft: 10,
                                                    padding: '6px 10px',
                                                    borderRadius: 6,
                                                    background: '#4CAF50',
                                                    color: 'white',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                🔍
                                            </button>
                                        )}
                                        {selectedLabel === 'Distributor' && (
                                            <button
                                                type="button"
                                                onClick={() => setShowDistributorModal(true)}
                                                style={{
                                                    marginLeft: 10,
                                                    padding: '6px 10px',
                                                    borderRadius: 6,
                                                    background: '#2196F3',
                                                    color: 'white',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                🔍
                                            </button>
                                        )}
                                        {selectedLabel === 'Mother' && (
                                            <button
                                                type="button"
                                                onClick={() => setShowMotherModal(true)}
                                                style={{
                                                    marginLeft: 10,
                                                    padding: '6px 10px',
                                                    borderRadius: 6,
                                                    background: '#FF9800',
                                                    color: 'white',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                🔍
                                            </button>
                                        )}
                                    </div>

                                    {/* Extra fields */}
                                    {selectedLabel === 'Agent' && (
                                        <div style={{ marginBottom: 15 }}>
                                            <label style={{ fontWeight: 500 }}>Agent Code:</label>
                                            <input
                                                type="text"
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }}
                                                value={newRecord.agent_code || ''}
                                                readOnly
                                            />
                                        </div>
                                    )}
                                    {selectedLabel === 'Distributor' && (
                                        <div style={{ marginBottom: 15 }}>
                                            <label style={{ fontWeight: 500 }}>Distributor Region:</label>
                                            <input
                                                type="text"
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }}
                                                value={newRecord.distributor_code || ''}
                                                readOnly
                                            />
                                        </div>
                                    )}
                                    {selectedLabel === 'Mother' && (
                                        <div style={{ marginBottom: 15 }}>
                                            <label style={{ fontWeight: 500 }}>Mother Code:</label>
                                            <input
                                                type="text"
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc' }}
                                                value={newRecord.mother_code || ''}
                                                readOnly
                                            />
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                                        <button
                                            type="button"
                                            onClick={handleExportSelected}
                                            disabled={loading}
                                            style={{
                                                position: "relative",
                                                padding: loading ? "10px 40px" : "10px 16px",
                                                borderRadius: 6,
                                                background: "#673AB7",
                                                color: "#fff",
                                                border: "none",
                                                cursor: loading ? "not-allowed" : "pointer",
                                                marginRight: 10,
                                                overflow: "hidden",
                                                transition: "all 0.3s ease",
                                            }}
                                        >
                                            {loading ? (
                                                <div style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "8px"
                                                }}>
                                                    <div style={{
                                                        width: 16,
                                                        height: 16,
                                                        border: "3px solid #fff",
                                                        borderTop: "3px solid rgba(255,255,255,0.2)",
                                                        borderRadius: "50%",
                                                        animation: "spin 1s linear infinite"
                                                    }} />
                                                    Exporting...
                                                </div>
                                            ) : (
                                                "Export Selected 🔽"
                                            )}

                                            <style>{`
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `}</style>
                                        </button>


                                        <button
                                            type="button"
                                            onClick={() => setShowModalmutiple(false)}
                                            style={{
                                                padding: '10px 16px',
                                                borderRadius: 6,
                                                background: '#f44336',
                                                color: '#fff',
                                                border: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Close
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}




                </div>

                {showTaggingModal && (
                    <div style={modalStyles.overlay} onMouseDown={() => setShowTaggingModal(false)}>
                        <div style={modalStyles.modal} onMouseDown={e => e.stopPropagation()}>
                            <div style={modalStyles.header}>
                                <h5>📝 Export for Tagging</h5>
                                <button onClick={() => setShowTaggingModal(false)} style={modalStyles.closeBtn}>✕</button>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleGenerateTaggingTemplate(); }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                                    {/* Distributor Code */}
                                    <div>
                                        <label>Distributor Code</label>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <input
                                                name="distributor_code"
                                                type="number"
                                                min="1"
                                                max="99999999"
                                                value={newRecord.distributor_code}
                                                onChange={handleTaggingChange}
                                                required
                                                style={inputStyle}
                                            />
                                            <button type="button" onClick={() => setShowDistributorModal(true)} style={iconBtn}>🔍</button>
                                        </div>
                                    </div>

                                    {/* Distributor Name */}
                                    <div>
                                        <label>Distributor Name</label>
                                        <input
                                            name="distributor_name"
                                            value={newRecord.distributor_name}
                                            disabled
                                            style={{ ...inputStyle, backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                                        />
                                    </div>

                                    {/* Mother Code */}
                                    <div>
                                        <label>Mother Code</label>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <input
                                                name="mother_code"
                                                value={newRecord.mother_code}
                                                onChange={handleTaggingChange}
                                                style={inputStyle}
                                            />
                                            <button type="button" onClick={() => setShowMotherModal(true)} style={iconBtn}>🔍</button>
                                        </div>
                                    </div>

                                    {/* Mother Name */}
                                    <div>
                                        <label>Mother Name</label>
                                        <input
                                            name="mother_acct"
                                            value={newRecord.mother_acct}
                                            disabled
                                            style={{ ...inputStyle, backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                                        />
                                    </div>

                                    {/* Agent Code */}
                                    <div>
                                        <label>Agent Code</label>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <input
                                                name="agent_code"
                                                value={newRecord.agent_code}
                                                onChange={handleTaggingChange}
                                                style={inputStyle}
                                            />
                                            <button type="button" onClick={() => setShowAgentModal(true)} style={iconBtn}>🔍</button>
                                        </div>
                                    </div>

                                    {/* Agent Name */}
                                    <div>
                                        <label>Agent Name</label>
                                        <input
                                            name="agent_name"
                                            value={newRecord.agent_name}
                                            disabled
                                            style={{ ...inputStyle, backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                                        />
                                    </div>

                                    {/* Group Code */}
                                    <div>
                                        <label>Group Code</label>
                                        <input
                                            name="group_code"
                                            value={newRecord.group_code}
                                            disabled
                                            style={{ ...inputStyle, backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                                        />
                                    </div>

                                    {/* Group Name */}
                                    <div>
                                        <label>Group Name</label>
                                        <input
                                            name="group_name"
                                            value={newRecord.group_name}
                                            disabled
                                            style={{ ...inputStyle, backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                                        />
                                    </div>

                                    {/* Number of rows to generate */}
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label>Number of Codes to Generate</label>
                                        <input
                                            name="range_count"
                                            type="number"
                                            min="1"
                                            max="99999999"
                                            value={newRecord.range_count}
                                            onChange={handleTaggingChange}
                                            required
                                            style={{ ...inputStyle, width: '100%' }}
                                        />
                                    </div>

                                    {/* Other dynamic fields */}
                                    {Object.keys(newRecord)
                                        .filter(k => ![
                                            'distributor_code',
                                            'distributor_name',
                                            'mother_code',
                                            'mother_acct',
                                            'agent_code',
                                            'agent_name',
                                            'group_code',
                                            'group_name',
                                            'range_count',
                                            'bp_code',
                                            'bp_name'
                                        ].includes(k))
                                        .map(key => (
                                            <div key={key}>
                                                <label style={{ fontSize: 13 }}>
                                                    {key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                                </label>
                                                <input
                                                    name={key}
                                                    value={newRecord[key]}
                                                    onChange={handleTaggingChange}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        ))}
                                </div>

                                <div style={modalStyles.footer}>
                                    <button type="button" onClick={() => setShowTaggingModal(false)} style={modalStyles.cancelBtn}>Cancel</button>
                                    <button type="submit" style={modalStyles.saveBtn}>Generate Template</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}




                <div style={{ position: 'relative', display: 'inline-block', marginLeft: 10 }}>
                    <button
                        onClick={() => setShowImportMenu(!showImportMenu)}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: 5,
                            cursor: 'pointer'
                        }}
                    >
                        ⬆️ Import Excel
                    </button>

                    {showImportMenu && (
                        <div
                            ref={importMenuRef}
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                background: 'white',
                                border: '1px solid #ccc',
                                borderRadius: 5,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                zIndex: 10,
                                width: 180
                            }}
                        >
                            <div
                                onClick={() => handleImportClick('add')}
                                style={menuItemStyle}
                                onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            >
                                ➕ Add New Data
                            </div>
                            <div
                                onClick={() => handleImportClick('update')}
                                style={menuItemStyle}
                                onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            >
                                🔄 Update Existing Data
                            </div>
                        </div>
                    )}


                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImport}
                        style={{ display: 'none' }}
                        id="excel-upload"
                    />
                </div>


                <button onClick={() => setShowModal(true)} style={{ ...styles.exportBtn, backgroundColor: '#10b981' }}>
                    ➕ Create New
                </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <input
                    type="text"
                    placeholder="🔍 Search..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', width: '50%' }}
                />
                <button
                    onClick={() => setShowAll(prev => !prev)}
                    style={{ padding: '8px 12px', borderRadius: 6, backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer' }}
                >
                    {showAll ? 'Paginate' : 'View All'}
                </button>
            </div>


            <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                    <thead
                        style={{
                            background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
                            color: 'white',
                            textAlign: 'left',
                            fontWeight: '600',
                            fontSize: '14px',
                            letterSpacing: '0.5px',
                            position: 'sticky',
                            top: 0,
                            zIndex: 2
                        }}
                    >
                        <tr>
                            <th>Distributor Code</th>
                            <th>Distributor Name</th>
                            <th>Mother Account</th>
                            <th>BP Code</th>
                            <th>BP Name</th>
                            <th>Agent Name</th>
                            <th>Group Name</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.length > 0 ? currentItems.map(row => (
                            <tr key={row.id}>
                                <td>{row.distributor_code}</td>
                                <td>{row.distributor_name}</td>
                                <td>{row.mother_acct}</td>
                                <td>{row.bp_code}</td>
                                <td>{row.bp_name}</td>
                                <td>{row.agent_name}</td>
                                <td>{row.group_name}</td>
                                <td>
                                    <button
                                        onClick={() => handleEdit(row)}
                                        style={{
                                            marginRight: 5,
                                            background: "#4CAF50",
                                            color: "#fff",
                                            padding: "4px 8px",
                                            borderRadius: 4,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => handleDelete(row.id)}
                                        style={{
                                            background: "#f44336",
                                            color: "#fff",
                                            padding: "4px 8px",
                                            borderRadius: 4,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={11} style={{ textAlign: 'center', padding: 20 }}>No records yet</td>
                            </tr>
                        )}
                    </tbody>

                </table>
                {data.length > 0 && (
                    <div style={styles.paginationContainer}>
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            style={styles.pageBtn}
                        >
                            ⏮ First
                        </button>

                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            style={styles.pageBtn}
                        >
                            ◀ Previous
                        </button>

                        <span style={styles.pageInfo}>
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            style={styles.pageBtn}
                        >
                            Next ▶
                        </button>

                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            style={styles.pageBtn}
                        >
                            Last ⏭
                        </button>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div style={modalStyles.overlay} onMouseDown={() => setShowModal(false)}>
                    <div style={modalStyles.modal} onMouseDown={(e) => e.stopPropagation()}>
                        <div style={modalStyles.header}>
                            <h5>➕ Create New Record</h5>
                            <button onClick={() => setShowModal(false)} style={modalStyles.closeBtn}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                                {/* Distributor Code */}
                                <div>
                                    <label>BP Code</label>
                                    <input
                                        name="bp_code"
                                        value={newRecord.bp_code}
                                        onChange={handleInputChange}
                                        style={inputStyle}
                                    />
                                </div>

                                {/* 🔹 BP Name (moved up) */}
                                <div>
                                    <label>BP Name</label>
                                    <input
                                        name="bp_name"
                                        value={newRecord.bp_name}
                                        onChange={handleInputChange}
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label>Distributor Code</label>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                        <input
                                            name="distributor_code"
                                            value={newRecord.distributor_code}
                                            onChange={handleInputChange}
                                            required
                                            style={inputStyle}
                                        />
                                        <button type="button" onClick={() => setShowDistributorModal(true)} style={iconBtn}>🔍</button>
                                    </div>
                                </div>

                                {/* Mother Code */}
                                <div>
                                    <label>Mother Code</label>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                        <input
                                            name="mother_code"
                                            value={newRecord.mother_code}
                                            onChange={handleInputChange}
                                            style={inputStyle}
                                        />
                                        <button type="button" onClick={() => setShowMotherModal(true)} style={iconBtn}>🔍</button>
                                    </div>
                                </div>

                                {/* 🔹 BP Code (moved up) */}

                                {/* Agent Code */}
                                <div>
                                    <label>Agent</label>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                        <input
                                            name="agent_code"
                                            value={newRecord.agent_code}
                                            readOnly
                                            style={inputStyle}
                                        />
                                        <button type="button" onClick={() => setShowAgentModal(true)} style={iconBtn}>🔍</button>
                                    </div>
                                </div>

                                <div>
                                    <label>Agent Name</label>
                                    <input
                                        name="agent_name"
                                        value={newRecord.agent_name}
                                        readOnly
                                        style={inputStyle}
                                    />
                                </div>

                                {/* Remaining Fields */}
                                {Object.keys(newRecord)
                                    .filter(k => ![
                                        'distributor_code',
                                        'mother_code',
                                        'bp_code',
                                        'bp_name',
                                        'agent_code',
                                        'agent_name'
                                    ].includes(k))
                                    .map(key => (
                                        <div key={key}>
                                            <label style={{ fontSize: 13 }}>
                                                {key
                                                    .split('_')
                                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                                    .join(' ')}
                                            </label>
                                            <input
                                                name={key}
                                                value={newRecord[key]}
                                                onChange={handleInputChange}
                                                style={inputStyle}
                                            />
                                        </div>
                                    ))}
                            </div>

                            {errorMessage && <div style={{ color: 'red', marginTop: 10 }}>{errorMessage}</div>}

                            <div style={modalStyles.footer}>
                                <div style={modalStyles.footer}>
                                    <button type="button" onClick={() => setShowModal(false)} style={modalStyles.cancelBtn}>Cancel</button>
                                    <button type="submit" disabled={saving} style={modalStyles.saveBtn}>
                                        {saving ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* Distributor Modal */}
            {showDistributorModal && (
                <LookupModal
                    title="Select Distributor"
                    columns={["Code", "Name", "Description"]}
                    data={distributors}
                    onSelect={handleSelectDistributor}
                    onClose={() => setShowDistributorModal(false)}
                    fieldKeys={["code", "name", "description"]}
                />
            )}

            {/* Mother Account Modal */}
            {showMotherModal && (
                <LookupModal
                    title="Select Mother Account"
                    columns={["DS Code", "Name", "Group Name"]}
                    data={motherAccounts}
                    onSelect={handleSelectMother}
                    onClose={() => setShowMotherModal(false)}
                    fieldKeys={["dscode", "name", "group_name"]}
                />
            )}

            {/* Agent Modal */}
            {showAgentModal && (
                <LookupModal
                    title="Select Agent"
                    columns={["UserID", "Name"]}
                    data={agents}
                    onSelect={handleSelectAgent}
                    onClose={() => setShowAgentModal(false)}
                    fieldKeys={["UserID", "name"]}
                />
            )}
        </div>
    );
}

// 🔹 Reusable Lookup Modal Component
function LookupModal({ title, columns, data, onSelect, onClose, fieldKeys }) {
    const [search, setSearch] = useState('');
    const [filtered, setFiltered] = useState(data);

    useEffect(() => {
        if (!search.trim()) {
            setFiltered(data);
        } else {
            const term = search.toLowerCase();
            setFiltered(
                data.filter(row =>
                    fieldKeys.some(key =>
                        String(row[key] || '').toLowerCase().includes(term)
                    )
                )
            );
        }
    }, [search, data, fieldKeys]);

    return (
        <div style={modalStyles.overlay} onMouseDown={onClose}>
            <div
                style={{ ...modalStyles.modal, width: '80%', maxWidth: 800 }}
                onMouseDown={e => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        ...modalStyles.header,
                        background: '#007bff',
                        color: 'white',
                        padding: '10px 20px'
                    }}
                >
                    <h5 style={{ margin: 0 }}>{title}</h5>
                    <button
                        onClick={onClose}
                        style={{
                            ...modalStyles.closeBtn,
                            color: 'white',
                            fontSize: 20
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Search Bar */}
                <div style={{ padding: '10px 20px', background: '#f9fafb' }}>
                    <input
                        type="text"
                        placeholder="🔍 Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid #ccc',
                            fontSize: 14,
                        }}
                    />
                </div>

                {/* Table */}
                <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: 14
                        }}
                    >
                        <thead>
                            <tr style={{ background: '#f1f5fb' }}>
                                {columns.map((col, i) => (
                                    <th
                                        key={i}
                                        style={{
                                            padding: '8px 10px',
                                            textAlign: 'left',
                                            borderBottom: '2px solid #ddd'
                                        }}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length ? (
                                filtered.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={() => onSelect(row)}
                                        style={{
                                            cursor: 'pointer',
                                            backgroundColor:
                                                idx % 2 ? '#f9f9f9' : '#fff'
                                        }}
                                        onMouseEnter={e =>
                                        (e.currentTarget.style.backgroundColor =
                                            '#e9f3ff')
                                        }
                                        onMouseLeave={e =>
                                        (e.currentTarget.style.backgroundColor =
                                            idx % 2 ? '#f9f9f9' : '#fff')
                                        }
                                    >
                                        {fieldKeys.map((key, i) => (
                                            <td
                                                key={i}
                                                style={{
                                                    padding: '8px 10px',
                                                    borderBottom:
                                                        '1px solid #eee'
                                                }}
                                            >
                                                {row[key] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        style={{
                                            textAlign: 'center',
                                            padding: 20
                                        }}
                                    >
                                        No matching records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '10px 20px',
                        textAlign: 'right',
                        borderTop: '1px solid #eee'
                    }}
                >
                    <button onClick={onClose} style={modalStyles.cancelBtn}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}


// Styles
const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #ccc',
    borderRadius: 6,
};
const iconBtn = {
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    padding: '0 10px',
    cursor: 'pointer',
};
const styles = {
    container: { padding: 20, fontFamily: 'Arial, sans-serif', background: '#f0f8ff', borderRadius: 10 },
    heading: { color: '#1e3a8a' },
    table: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 8, overflow: 'hidden', minWidth: 900, padding: '5px' },
    buttonContainer: { marginBottom: 20, display: 'flex', gap: 10 },
    exportBtn: { backgroundColor: '#1e40af', color: 'white', padding: '10px 15px', border: 'none', borderRadius: 5, cursor: 'pointer' },
    importLabel: { backgroundColor: '#2563eb', color: 'white', padding: '10px 15px', borderRadius: 5, cursor: 'pointer' },
    fileInput: { display: 'none' },
    paginationContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        marginTop: '16px',
        padding: '8px 0',
        background: '#f9fafb',
        borderRadius: '8px',
    },
    pageBtn: {
        padding: '6px 12px',
        border: '1px solid #ccc',
        borderRadius: '6px',
        background: 'white',
        cursor: 'pointer',
        fontSize: '14px',
    },
    pageInfo: {
        fontSize: '14px',
        fontWeight: '500',
    },

};
const modalStyles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal: { background: 'white', borderRadius: 8, width: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', padding: 20 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: 10 },
    closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' },
    footer: { display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 10 },
    saveBtn: { backgroundColor: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: 5, cursor: 'pointer' },
    cancelBtn: { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 15px', borderRadius: 5, cursor: 'pointer' },
};
