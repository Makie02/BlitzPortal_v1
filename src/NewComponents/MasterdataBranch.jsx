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

            while (hasMore) {
                const { data, error } = await supabase
                    .from('Accounts_List')
                    .select('*')
                    .order('id', { ascending: true })
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error('Error fetching data:', error);
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

            setData(allData);
            console.log(`Loaded ${allData.length} records`);
        } catch (err) {
            console.error('Error:', err);
            Swal.fire('Error', err.message, 'error');
        }
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
            .select("code, name")
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
            distributor_code: selected.code
        }));
        setShowDistributorModal(false);
    };

    const handleSelectMother = (selected) => {
        setNewRecord(prev => ({
            ...prev,
            mother_code: selected.dscode,
            group_code: selected.group_code || ''
        }));
        setShowMotherModal(false);
    };

    const handleSelectBp = (selected) => {
        setNewRecord(prev => ({
            ...prev,
            bp_code: selected.bp_code
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
                    setData(prev => prev.map(row => row.id === id ? { ...row, ...updateData } : row));
                    setShowModal(false);
                    setIsEditing(false);
                    Swal.fire('Success', 'Record updated', 'success');
                }
            } else {
                const { error } = await supabase
                    .from('Accounts_List')
                    .insert([{
                        ...newRecord,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }])
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
                        agent_code: '',
                        group_code: '',
                        status: true
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

    // Import/Export
    const handleImportClick = () => {
        document.getElementById('excel-upload').click();
    };

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
                    Swal.fire('Error', 'No data in Excel', 'error');
                    return;
                }

                let addedCount = 0;
                let updatedCount = 0;

                for (const row of sheetData) {
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
                    } catch (err) {
                        console.error('Row error:', err);
                    }
                }

                await fetchAndCleanData();
                Swal.fire('Complete', `Added: ${addedCount}, Updated: ${updatedCount}`, 'success');
            };

            reader.readAsArrayBuffer(file);
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setUploading(false);
            setShowImportMenu(false);
        }
    };

    const handleExport = (type) => {
        if (!data || data.length === 0) {
            Swal.fire('Error', 'No data to export', 'error');
            return;
        }

        const headers = ['distributor_code', 'mother_code', 'bp_code', 'agent_code', 'group_code', 'status'];
        let exportData = [];

        if (type === 'template') {
            exportData = [Object.fromEntries(headers.map(k => [k, ""]))];
        } else if (type === 'all') {
            exportData = data.map(row => {
                const obj = {};
                headers.forEach(k => obj[k] = row[k] ?? '');
                return obj;
            });
        }

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

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>📋 Accounts List Manager</h2>

            <div style={styles.buttonContainer}>
                <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowExportMenu(!showExportMenu)} style={styles.btn}>
                        Export ▼
                    </button>
                    {showExportMenu && (
                        <div ref={exportMenuRef} style={styles.menu}>
                            <div style={styles.menuItem} onClick={() => handleExport('template')}>Template</div>
                            <div style={styles.menuItem} onClick={() => handleExport('all')}>All Data</div>
                        </div>
                    )}
                </div>

                <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowImportMenu(!showImportMenu)} style={styles.btn}>
                        Import ▼
                    </button>
                    {showImportMenu && (
                        <div ref={importMenuRef} style={styles.menu}>
                            <div style={styles.menuItem} onClick={handleImportClick}>Upload Excel</div>
                        </div>
                    )}
                    <input type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} id="excel-upload" />
                </div>

                <button onClick={() => { setIsEditing(false); setNewRecord({ distributor_code: '', mother_code: '', bp_code: '', agent_code: '', group_code: '', status: true }); setShowModal(true); }} style={styles.btnCreate}>
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
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Agent Code</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Group Code</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Status</th>
                            <th style={{ padding: '12px 15px', borderBottom: '2px solid #0056b3' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.length ? currentItems.map(row => (
                            <tr key={row.id} style={{ borderBottom: '1px solid #ddd', transition: 'background 0.3s', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f7ff'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding: '10px 15px' }}>{row.distributor_code}</td>
                                <td style={{ padding: '10px 15px' }}>{row.mother_code}</td>
                                <td style={{ padding: '10px 15px' }}>{row.bp_code}</td>
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
                        )) : (
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
                <div style={modalStyles.overlay} onClick={() => setShowModal(false)}>
                    <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
                        <div style={modalStyles.header}>
                            <h3>{isEditing ? 'Edit' : 'Create New'} Record</h3>
                            <button onClick={() => setShowModal(false)} style={modalStyles.closeBtn}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                                <div>
                                    <label>Distributor Code</label>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                        <input name="distributor_code" value={newRecord.distributor_code} onChange={handleInputChange} style={styles.input} />
                                        <button type="button" onClick={() => setShowDistributorModal(true)} style={styles.btnIcon}>🔍</button>
                                    </div>
                                </div>

                                <div>
                                    <label>Mother Code</label>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                        <input name="mother_code" value={newRecord.mother_code} onChange={handleInputChange} style={styles.input} />
                                        <button type="button" onClick={() => setShowMotherModal(true)} style={styles.btnIcon}>🔍</button>
                                    </div>
                                </div>

                                <div>
                                    <label>BP Code</label>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                        <input name="bp_code" value={newRecord.bp_code} onChange={handleInputChange} style={styles.input} />
                                        <button type="button" onClick={() => setShowBpModal(true)} style={styles.btnIcon}>🔍</button>
                                    </div>
                                </div>

                                <div>
                                    <label>Agent Code</label>
                                    <div style={{ display: 'flex', gap: 5 }}>
                                        <input name="agent_code" value={newRecord.agent_code} onChange={handleInputChange} style={styles.input} />
                                        <button type="button" onClick={() => setShowAgentModal(true)} style={styles.btnIcon}>🔍</button>
                                    </div>
                                </div>

                                <div>
                                    <label>Group Code</label>
                                    <input name="group_code" value={newRecord.group_code} onChange={handleInputChange} style={styles.input} />
                                </div>

                                <div>
                                    <label>Status</label>
                                    <select name="status" value={newRecord.status} onChange={e => setNewRecord(p => ({ ...p, status: e.target.value === 'true' }))} style={styles.input}>
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {errorMessage && <div style={{ color: 'red', marginTop: 10 }}>{errorMessage}</div>}

                            <div style={modalStyles.footer}>
                                <button type="button" onClick={() => setShowModal(false)} style={styles.btnCancel}>Cancel</button>
                                <button type="submit" disabled={saving} style={styles.btnSave}>{saving ? 'Saving...' : (isEditing ? 'Update' : 'Create')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDistributorModal && <LookupModal title="Select Distributor" columns={['Code', 'Name']} data={distributors} onSelect={handleSelectDistributor} onClose={() => setShowDistributorModal(false)} fieldKeys={['code', 'name']} />}
            {showMotherModal && <LookupModal title="Select Mother Account" columns={['Code', 'Name', 'Group']} data={motherAccounts} onSelect={handleSelectMother} onClose={() => setShowMotherModal(false)} fieldKeys={['dscode', 'name', 'group_name']} />}
            {showBpModal && <LookupModal title="Select BP Account" columns={['Code', 'Name']} data={bpAccounts} onSelect={handleSelectBp} onClose={() => setShowBpModal(false)} fieldKeys={['bp_code', 'bp_name']} />}
            {showAgentModal && <LookupModal title="Select Agent" columns={['ID', 'Name']} data={agents} onSelect={handleSelectAgent} onClose={() => setShowAgentModal(false)} fieldKeys={['UserID', 'name']} />}
        </div>
    );
}

function LookupModal({ title, columns, data, onSelect, onClose, fieldKeys }) {
    const [search, setSearch] = useState('');
    const filtered = data.filter(row => fieldKeys.some(k => String(row[k] || '').toLowerCase().includes(search.toLowerCase())));

    return (
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={{ ...modalStyles.modal, width: '80%', maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                <div style={{ ...modalStyles.header, background: '#2563eb', color: 'white' }}>
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ padding: 15 }}>
                    <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...styles.input, width: '100%' }} />
                </div>

                <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: 15 }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                {columns.map((c, i) => <th key={i}>{c}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length ? filtered.map((row, i) => (
                                <tr key={i} onClick={() => { onSelect(row); onClose(); }} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'} onMouseLeave={e => e.currentTarget.style.background = i % 2 ? '#f9f9f9' : 'white'}>
                                    {fieldKeys.map((k, j) => <td key={j}>{row[k] || '-'}</td>)}
                                </tr>
                            )) : (
                                <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 20 }}>No results</td></tr>
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
    menu: { position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #ccc', borderRadius: 4, zIndex: 10, minWidth: 150 },
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
