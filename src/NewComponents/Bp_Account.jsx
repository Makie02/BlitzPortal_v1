import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { Modal, Button, Table, Spinner } from "react-bootstrap";

const ROW_OPTIONS = [5, 10, 20];

const Bp_Account = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true); // ✅ Auto-load on mount
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ bp_code: '', bp_name: '' });
  const [isEditing, setIsEditing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8); // ✅ Default 20 rows

  // ✅ Pagination state
  const [totalCount, setTotalCount] = useState(0);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [show, setShow] = useState(false);
  const onHide = () => setShow(false);

  // ✅ Fetch ONLY current page (lazy load per page)
  const fetchAccounts = async (page = 1, search = '') => {
    setLoading(true);

    try {
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('Bp_Accounts')
        .select('*', { count: 'exact' })
        .order('bp_code', { ascending: true })
        .range(from, to);

      if (search) {
        query = query.or(`bp_code.ilike.%${search}%,bp_name.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        Swal.fire('Error', 'Error fetching BP accounts: ' + error.message, 'error');
        return;
      }

      setAccounts(data || []);
      setTotalCount(count || 0);

    } catch (err) {
      Swal.fire('Error', 'Unexpected error fetching BP accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load first page on mount
  useEffect(() => {
    fetchAccounts(1, '');
  }, []);

  // ✅ Fetch when page or itemsPerPage changes
  useEffect(() => {
    if (currentPage > 1 || searchTerm) {
      fetchAccounts(currentPage, searchTerm);
    }
  }, [currentPage, itemsPerPage]);

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
      const { error } = await supabase
        .from('Bp_Accounts')
        .update({ bp_name: form.bp_name })
        .eq('bp_code', form.bp_code);

      if (error) Swal.fire('Update Error', error.message, 'error');
      else {
        Swal.fire('Success', 'BP Account updated successfully!', 'success');
        setModalOpen(false);
        fetchAccounts(currentPage, searchTerm);
      }
    } else {
      const { error } = await supabase
        .from('Bp_Accounts')
        .insert([{ bp_code: form.bp_code, bp_name: form.bp_name }]);

      if (error) Swal.fire('Insert Error', error.message, 'error');
      else {
        Swal.fire('Success', 'BP Account added successfully!', 'success');
        setModalOpen(false);
        fetchAccounts(currentPage, searchTerm);
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
        fetchAccounts(currentPage, searchTerm);
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
  const exportAllData = async () => {
    Swal.fire({
      title: 'Exporting...',
      text: 'Fetching all data from database...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      let allData = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('Bp_Accounts')
          .select('*')
          .order('bp_code', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      if (allData.length === 0) {
        Swal.fire('No Data', 'No BP Accounts to export.', 'info');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(allData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BP_Accounts');
      XLSX.writeFile(wb, 'BP_Accounts_AllData.xlsx');

      Swal.fire('Success', `Exported ${allData.length} records!`, 'success');
    } catch (error) {
      Swal.fire('Error', 'Failed to export data: ' + error.message, 'error');
    }
  };

  // === IMPORT ===
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [importData, setImportData] = useState([]);
  const [checking, setChecking] = useState(false);
  const [existingRows, setExistingRows] = useState([]);
  const [importing, setImporting] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      const cleaned = json
        .map((r) => ({
          bp_code: String(r.bp_code || "").trim().toUpperCase(),
          bp_name: String(r.bp_name || "").trim(),
        }))
        .filter((r) => r.bp_code && r.bp_name);

      setImportData(cleaned);

      try {
        const { data: existing, error } = await supabase
          .from("Bp_Accounts")
          .select("bp_code");

        if (error) {
          console.error("Error checking duplicates:", error.message);
          return;
        }

        const existingCodes = new Set(
          existing.map((e) => String(e.bp_code).trim().toUpperCase())
        );

        const duplicates = cleaned.filter((r) => existingCodes.has(r.bp_code));
        setExistingRows(duplicates);

        if (duplicates.length > 0) {
          Swal.fire({
            icon: 'warning',
            title: 'Duplicates Detected!',
            html: `Found <b>${duplicates.length}</b> existing BP codes.<br/>Red rows will be skipped during import.`,
            confirmButtonText: 'OK'
          });
        }
      } catch (error) {
        console.error("Duplicate check failed:", error.message);
        Swal.fire('Error', 'Failed to check for duplicates.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const importDataToDB = async () => {
    if (importData.length === 0) {
      Swal.fire("No Data", "Please select a valid Excel file.", "warning");
      return;
    }

    const existingCodes = new Set(existingRows.map(r => r.bp_code));
    const newRecords = importData.filter(r => !existingCodes.has(r.bp_code));

    if (newRecords.length === 0) {
      Swal.fire("No New Records", "All records already exist in the database.", "info");
      return;
    }

    setImporting(true);
    let importedCount = 0;

    Swal.fire({
      title: "Importing...",
      html: `<b>0</b> / ${newRecords.length} records processed.<br/><small>Skipping ${existingRows.length} duplicates</small>`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const batchSize = 100;
    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize);
      const { error } = await supabase.from("Bp_Accounts").insert(batch);

      if (error) {
        Swal.fire("Error", error.message, "error");
        setImporting(false);
        return;
      }

      importedCount += batch.length;
      Swal.update({
        html: `<b>${importedCount}</b> / ${newRecords.length} records processed...<br/><small>Skipped ${existingRows.length} duplicates</small>`,
      });
    }

    Swal.fire({
      icon: "success",
      title: "✅ Import Complete",
      html: `<b>${importedCount}</b> new records imported successfully!<br/><span style="color: red;">${existingRows.length}</span> duplicates skipped.`,
    });

    setImporting(false);
    setImportData([]);
    setExistingRows([]);
    setFileName("");
    fetchAccounts(currentPage, searchTerm);
    onHide();
  };

  const checkExistingRecords = async () => {
    if (importData.length === 0) {
      Swal.fire("No Data", "Please select a valid Excel file first.", "warning");
      return;
    }

    setChecking(true);
    const { data: existing } = await supabase.from("Bp_Accounts").select("bp_code");
    const existingCodes = new Set(existing.map((e) => e.bp_code));
    const duplicates = importData.filter((r) => existingCodes.has(r.bp_code));
    setExistingRows(duplicates);
    setChecking(false);

    if (duplicates.length > 0) {
      Swal.fire("Duplicates Found", `${duplicates.length} existing BP codes detected.`, "info");
    } else {
      Swal.fire("✅ No Duplicates", "All records are new!", "success");
    }
  };

  // ✅ Search with debounce
  const searchTimeout = useRef(null);
  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchAccounts(1, value);
    }, 500);
  };

  // === Pagination ===
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const goToPage = (page) => {
    if (page < 1) page = 1;
    else if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
    fetchAccounts(1, searchTerm); // ✅ Refetch with new page size
  };

  const importFromExcel = () => setShow(true);
  const [currentPageExcel, setCurrentPageExcel] = useState(1);
  const rowsPerPageExcel = 10;

  const totalPagesExcel = Math.ceil(importData.length / rowsPerPageExcel);
  const indexOfLastRowExcel = currentPageExcel * rowsPerPageExcel;
  const indexOfFirstRowExcel = indexOfLastRowExcel - rowsPerPageExcel;
  const currentRowsExcel = importData.slice(indexOfFirstRowExcel, indexOfLastRowExcel);

  const deleteImportRow = (index) => {
    const actualIndex = indexOfFirstRowExcel + index;
    const updatedData = importData.filter((_, i) => i !== actualIndex);
    setImportData(updatedData);

    const existingCodes = new Set(accounts.map((acc) => acc.bp_code.trim().toUpperCase()));
    const duplicates = updatedData.filter((r) => existingCodes.has(r.bp_code));
    setExistingRows(duplicates);

    if (updatedData.length > 0 && currentRowsExcel.length === 1 && currentPageExcel > 1) {
      setCurrentPageExcel(currentPageExcel - 1);
    }
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
                <button onClick={importFromExcel} style={exportMenuItem}>📥 Import from Excel</button>
              </div>
            )}

            <Modal show={show} onHide={onHide} centered size="lg">
              <Modal.Header closeButton>
                <Modal.Title>📥 Import from Excel</Modal.Title>
              </Modal.Header>

              <Modal.Body>
                <div className="mb-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                    className="form-control"
                  />
                  {fileName && (
                    <div className="mt-2 text-muted">
                      Selected File: <b>{fileName}</b>
                    </div>
                  )}
                </div>

                {importData.length > 0 && (
                  <>
                    <Button variant="warning" size="sm" onClick={checkExistingRecords} disabled={checking}>
                      {checking ? <><Spinner animation="border" size="sm" /> Checking...</> : "🔍 Check for Duplicates"}
                    </Button>

                    <div className="table-responsive">
                      <table style={tableStyle}>
                        <thead className="table-dark">
                          <tr>
                            <th style={thStyle}>BP Code</th>
                            <th style={thStyle}>BP Name</th>
                            <th style={thStyle}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentRowsExcel.map((row, idx) => {
                            const isDuplicate = existingRows.some((r) => r.bp_code === row.bp_code);
                            return (
                              <tr key={idx} style={{
                                backgroundColor: isDuplicate ? "#ffcccc" : "white",
                                color: isDuplicate ? "#b30000" : "black",
                                fontWeight: isDuplicate ? 600 : "normal",
                              }}>
                                <td style={tdStyle}>{row.bp_code}</td>
                                <td style={tdStyle}>{row.bp_name}</td>
                                <td style={{ textAlign: 'center' }}>
                                  {isDuplicate ? (
                                    <Button variant="danger" size="sm" onClick={() => deleteImportRow(idx)} style={{ padding: "4px 10px", fontSize: "12px" }}>
                                      🗑️ Delete
                                    </Button>
                                  ) : (
                                    <span style={{ color: "#28a745", fontWeight: 600 }}>✓ New</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <small>Showing {indexOfFirstRowExcel + 1}–{Math.min(indexOfLastRowExcel, importData.length)} of {importData.length}</small>
                      <div>
                        <Button variant="outline-dark" size="sm" disabled={currentPageExcel === 1} onClick={() => setCurrentPageExcel((p) => p - 1)} className="me-2">⬅ Prev</Button>
                        <span className="mx-2">Page {currentPageExcel} of {totalPagesExcel}</span>
                        <Button variant="outline-dark" size="sm" disabled={currentPageExcel === totalPagesExcel} onClick={() => setCurrentPageExcel((p) => p + 1)}>Next ➡</Button>
                      </div>
                    </div>

                    {existingRows.length > 0 && (
                      <div className="mt-2" style={{ color: "#b30000", fontSize: "14px", fontStyle: "italic", textAlign: "right" }}>
                        🔴 Red rows = existing BP Codes (duplicates)
                      </div>
                    )}
                  </>
                )}
              </Modal.Body>

              <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Close</Button>
                <Button variant="success" onClick={importDataToDB} disabled={importing || importData.length === 0}>
                  {importing ? <><Spinner animation="border" size="sm" /> Importing...</> : "📤 Import"}
                </Button>
              </Modal.Footer>
            </Modal>
          </div>
        </div>
      </div>

      <div style={tableWrapperStyle}>
        <div style={searchWrapperStyle}>
          <input
            type="text"
            placeholder="Search by BP code or name..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spinner animation="border" />
            <p>Loading page {currentPage}...</p>
          </div>
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
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                      No results found
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.bp_code}>
                      <td style={tdStyle}>{acc.bp_code}</td>
                      <td style={tdStyle}>{acc.bp_name}</td>
                      <td style={tdStyle}>
                        <button style={editBtn} onClick={() => openEditModal(acc)}>Edit</button>
                        <button style={deleteBtn} onClick={() => handleDelete(acc.bp_code)}>Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={paginationContainer}>
              <select value={itemsPerPage} onChange={handleItemsPerPageChange} style={pageSelect}>
                {ROW_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt} rows</option>
                ))}
              </select>

              <div>
                <small style={{ marginRight: '10px' }}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} total records
                </small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={{ padding: '4px 8px' }}>⏮ First</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ padding: '4px 8px' }}>◀ Prev</button>
                <span style={{ margin: '0 10px' }}>Page {currentPage} / {totalPages || 1}</span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: '4px 8px' }}>Next ▶</button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '4px 8px' }}>Last ⏭</button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{isEditing ? 'Edit BP Account' : 'Add BP Account'}</h3>
            <form onSubmit={handleSubmit}>
              <div>
                <label>BP Code</label>
                <input type="text" name="bp_code" value={form.bp_code} onChange={handleChange} style={inputStyle} required disabled={isEditing} />
              </div>
              <div>
                <label>BP Name</label>
                <input type="text" name="bp_name" value={form.bp_name} onChange={handleChange} style={inputStyle} required />
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

const containerStyle = { padding: '24px', maxWidth: 1400, margin: '40px auto', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' };
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

export default Bp_Account;
