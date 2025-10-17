import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

const ROW_OPTIONS = [5, 10, 20];

const Bp_Account = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ bp_code: '', bp_name: '' });
  const [isEditing, setIsEditing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = useRef(null);

  // === Fetch Data ===
  const fetchAccounts = async () => {
    setLoading(true);

    try {
      const batchSize = 1000;
      let allData = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        console.log(
          `📥 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`
        );

        const { data, error } = await supabase
          .from('Bp_Accounts')
          .select('*')
          .order('bp_code', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error('❌ Error fetching BP accounts:', error.message);
          Swal.fire('Error', 'Error fetching BP accounts: ' + error.message, 'error');
          break;
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
          console.log('🏁 Finished fetching all BP accounts');
        }
      }

      if (allData.length === 0) {
        console.log('⚠️ No BP accounts found');
        Swal.fire('Notice', 'No BP accounts found.', 'info');
      } else {
        console.log(`✅ Total BP accounts fetched: ${allData.length}`);
        setAccounts(allData);
      }
    } catch (err) {
      console.error('❌ Unexpected error fetching BP accounts:', err);
      Swal.fire('Error', 'Unexpected error fetching BP accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);


  // === Modal ===
  const openAddModal = () => {
    setForm({ bp_code: '', bp_name: '' });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEditModal = (account) => {
    setForm({ bp_code: account.bp_code, bp_name: account.bp_name });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // === Add / Update ===
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.bp_code.trim() || !form.bp_name.trim()) {
      Swal.fire('Validation Error', 'Both BP Code and BP Name are required.', 'warning');
      return;
    }

    if (isEditing) {
      // UPDATE record
      const { error } = await supabase
        .from('Bp_Accounts')
        .update({ bp_name: form.bp_name })
        .eq('bp_code', form.bp_code);

      if (error) Swal.fire('Update Error', error.message, 'error');
      else {
        Swal.fire('Success', 'BP Account updated successfully!', 'success');
        setModalOpen(false);
        fetchAccounts();
      }
    } else {
      // INSERT new record
      const { error } = await supabase
        .from('Bp_Accounts')
        .insert([{ bp_code: form.bp_code, bp_name: form.bp_name }]);

      if (error) Swal.fire('Insert Error', error.message, 'error');
      else {
        Swal.fire('Success', 'BP Account added successfully!', 'success');
        setModalOpen(false);
        fetchAccounts();
      }
    }
  };

  // === Delete ===
  const handleDelete = async (bp_code) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You will not be able to recover this BP Account (${bp_code})!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      const { error } = await supabase.from('Bp_Accounts').delete().eq('bp_code', bp_code);
      if (error) Swal.fire('Delete Error', error.message, 'error');
      else {
        Swal.fire('Deleted!', 'BP Account has been deleted.', 'success');
        fetchAccounts();
      }
    }
  };

  // === EXPORT TEMPLATE ===
  const exportTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ bp_code: '', bp_name: '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'BP_Accounts_Template.xlsx');
  };

  // === EXPORT ALL ===
  const exportAllData = () => {
    if (accounts.length === 0) return Swal.fire('No Data', 'No BP Accounts to export.', 'info');
    const ws = XLSX.utils.json_to_sheet(accounts);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BP_Accounts');
    XLSX.writeFile(wb, 'BP_Accounts_AllData.xlsx');
  };

  // === IMPORT ===
 // === IMPORT (with progress countdown) ===
const importFromExcel = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const data = evt.target.result;
    const workbook = XLSX.read(data, { type: 'binary' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    if (json.length === 0) {
      Swal.fire('Empty File', 'No data found in Excel file.', 'warning');
      return;
    }

    // Clean and normalize
    let cleanedRows = json
      .map((row) => ({
        bp_code: String(row.bp_code || '').trim(),
        bp_name: String(row.bp_name || '').trim(),
      }))
      .filter((row) => row.bp_code && row.bp_name);

    if (cleanedRows.length === 0) {
      Swal.fire('Invalid Data', 'No valid BP Code or BP Name found.', 'warning');
      return;
    }

    // Remove duplicates
    const uniqueMap = new Map();
    cleanedRows.forEach((r) => uniqueMap.set(r.bp_code, r));
    cleanedRows = Array.from(uniqueMap.values());

    // === Show a loading popup with progress ===
    let importedCount = 0;
    Swal.fire({
      title: 'Importing...',
      html: `<b>0</b> / ${cleanedRows.length} records processed.`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const batchSize = 100; // smaller batches for progress updates
    for (let i = 0; i < cleanedRows.length; i += batchSize) {
      const batch = cleanedRows.slice(i, i + batchSize);
      const { error } = await supabase.from('Bp_Accounts').upsert(batch, { onConflict: 'bp_code' });

      if (error) {
        console.error('Upsert Error:', error);
        Swal.fire('Import Error', error.message, 'error');
        return;
      }

      importedCount += batch.length;
      Swal.update({
        html: `<b>${importedCount}</b> / ${cleanedRows.length} records processed...`,
      });
    }

    // === Finished ===
    Swal.fire('✅ Import Complete', `${importedCount} records imported successfully!`, 'success');
    fetchAccounts();
  };

  reader.readAsBinaryString(file);
  e.target.value = ''; // reset input
};


  // === Search + Pagination ===
  const filteredAccounts = accounts.filter((acc) => {
    const term = searchTerm.toLowerCase();
    return (
      acc.bp_name.toLowerCase().includes(term) ||
      acc.bp_code.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredAccounts.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page) => {
    if (page < 1) page = 1;
    else if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div style={containerStyle}>
      <div style={headerRowStyle}>
        <h2>BP Accounts</h2>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={openAddModal} style={addButtonStyle}>+ Add New</button>

          <div style={{ position: 'relative' }}>
            <button
              style={exportButtonStyle}
              onClick={() => setShowExportMenu((prev) => !prev)}
            >
              ⬇ Export / Import
            </button>

            {showExportMenu && (
              <div style={exportMenuStyle}>
                <button onClick={exportTemplate} style={exportMenuItem}>📄 Export Template Only</button>
                <button onClick={exportAllData} style={exportMenuItem}>📦 Export All Data</button>
                <button
                  onClick={() => fileInputRef.current.click()}
                  style={exportMenuItem}
                >
                  📥 Import from Excel
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={importFromExcel}
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={tableWrapperStyle}>
        <div style={searchWrapperStyle}>
          <input
            type="text"
            placeholder="Search by BP code or name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={searchInputStyle}
          />
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>BP Code</th>
                  <th style={thStyle}>BP Name</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((acc) => (
                  <tr key={acc.bp_code}>
                    <td style={tdStyle}>{acc.bp_code}</td>
                    <td style={tdStyle}>{acc.bp_name}</td>
                    <td style={tdStyle}>
                      <button style={editBtn} onClick={() => openEditModal(acc)}>Edit</button>
                      <button style={deleteBtn} onClick={() => handleDelete(acc.bp_code)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={paginationContainer}>
              <select value={itemsPerPage} onChange={handleItemsPerPageChange} style={pageSelect}>
                {ROW_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} rows
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  style={{ padding: '4px 8px' }}
                >
                  ⏮ First
                </button>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{ padding: '4px 8px' }}
                >
                  ◀ Prev
                </button>

                <span style={{ margin: '0 10px' }}>
                  Page {currentPage} / {totalPages || 1}
                </span>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{ padding: '4px 8px' }}
                >
                  Next ▶
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{ padding: '4px 8px' }}
                >
                  Last ⏭
                </button>
              </div>
            </div>

          </>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{isEditing ? 'Edit BP Account' : 'Add BP Account'}</h3>
            <form onSubmit={handleSubmit}>
              <div>
                <label>BP Code</label>
                <input
                  type="text"
                  name="bp_code"
                  value={form.bp_code}
                  onChange={handleChange}
                  style={inputStyle}
                  required
                  disabled={isEditing}
                />
              </div>
              <div>
                <label>BP Name</label>
                <input
                  type="text"
                  name="bp_name"
                  value={form.bp_name}
                  onChange={handleChange}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={modalBtnRow}>
                <button type="submit" style={saveBtnStyle}>Save</button>
                <button type="button" style={cancelBtnStyle} onClick={() => setModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// === Styles ===
const containerStyle = {
  padding: '24px',
  maxWidth: 1400,
  margin: '40px auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
};
const headerRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
const addButtonStyle = { background: '#0062ff', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' };
const exportButtonStyle = { background: '#28a745', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' };
const exportMenuStyle = { position: 'absolute', top: '40px', right: 0, background: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', borderRadius: '6px', zIndex: 5 };
const exportMenuItem = { display: 'block', padding: '8px 12px', width: '200px', border: 'none', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '14px' };
const tableWrapperStyle = { overflowX: 'auto' };
const searchWrapperStyle = { marginBottom: '10px' };
const searchInputStyle = { width: '250px', padding: '6px 10px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: '600px' };
const thStyle = { padding: '10px', background: '#0062ff', color: 'white', textAlign: 'left' };
const tdStyle = { padding: '8px', borderBottom: '1px solid #eee' };
const editBtn = { background: '#007bff', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', marginRight: '6px', cursor: 'pointer' };
const deleteBtn = { background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' };
const paginationContainer = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' };
const pageSelect = { padding: '4px' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 };
const modalContentStyle = { background: 'white', padding: '20px', borderRadius: '10px', width: '400px' };
const inputStyle = { width: '100%', padding: '6px 10px', margin: '8px 0' };
const modalBtnRow = { display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '8px' };
const saveBtnStyle = { background: '#007bff', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px' };
const cancelBtnStyle = { background: '#6c757d', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px' };
const paginationButtonStyle = {
  padding: '4px 10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  background: '#f8f9fa',
  cursor: 'pointer',
};

const paginationButtonDisabled = {
  ...paginationButtonStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

export default Bp_Account;
