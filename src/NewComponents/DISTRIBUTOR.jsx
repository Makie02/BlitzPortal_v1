import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import { debounce } from 'lodash';
import Papa from 'papaparse';

const ROW_OPTIONS = [5, 10, 20];

const Distributor = () => {
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: null, code: '', name: '', description: '' });
  const [isEditing, setIsEditing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // New states for mother accounts
  const [motherAccounts, setMotherAccounts] = useState([]);
  const [selectedMotherAccounts, setSelectedMotherAccounts] = useState([]); // array of mother account ids

  const fetchDistributors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('code', { ascending: true });
    if (error) {
      Swal.fire('Error', 'Error fetching distributors: ' + error.message, 'error');
    } else {
      setDistributors(data);
    }
    setLoading(false);
  };

  const fetchMotherAccounts = async () => {
    const { data, error } = await supabase
      .from('mother_account')
      .select('id, code, name')
      .eq('status', true) // only active mother accounts, adjust if needed
      .order('code', { ascending: true });
    if (error) {
      Swal.fire('Error', 'Error fetching mother accounts: ' + error.message, 'error');
    } else {
      setMotherAccounts(data);
    }
  };

  useEffect(() => {
    fetchDistributors();
    fetchMotherAccounts();
  }, []);

  const openAddModal = () => {
    // Don't set code when adding - let database generate it
    setForm({ id: null, code: 'Auto-generated', name: '', description: '' });
    setIsEditing(false);
    setSelectedMotherAccounts([]); // reset selection on add
    setModalOpen(true);
  };

  const openEditModal = (distributor) => {
    setForm({ id: distributor.id, code: distributor.code, name: distributor.name, description: distributor.description || '' });

    // Parse stored mother_accounts_code and mother_accounts_name into selectedMotherAccounts array by matching with motherAccounts
    // mother_accounts_code and mother_accounts_name are comma separated strings
    if (distributor.mother_accounts_code && distributor.mother_accounts_name) {
      const codesArr = distributor.mother_accounts_code.split(',').map(c => c.trim());
      // Find matching mother accounts by code
      const selectedIds = motherAccounts
        .filter(ma => codesArr.includes(String(ma.code)))
        .map(ma => ma.id);
      setSelectedMotherAccounts(selectedIds);
    } else {
      setSelectedMotherAccounts([]);
    }

    setIsEditing(true);
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);

    if (isEditing) {
      autoSave(updated);
    }
  };

  // Handle checkbox change for mother accounts
  const handleMotherAccountToggle = (id) => {
    let updatedSelected = [];
    if (selectedMotherAccounts.includes(id)) {
      updatedSelected = selectedMotherAccounts.filter(sid => sid !== id);
    } else {
      updatedSelected = [...selectedMotherAccounts, id];
    }
    setSelectedMotherAccounts(updatedSelected);

    // If editing, also auto-save after changing mother accounts
    if (isEditing) {
      // get updated form with updated mother accounts info
      const motherNames = motherAccounts
        .filter(ma => updatedSelected.includes(ma.id))
        .map(ma => ma.name)
        .join(', ');
      const motherCodes = motherAccounts
        .filter(ma => updatedSelected.includes(ma.id))
        .map(ma => ma.code)
        .join(', ');

      const updatedForm = {
        ...form,
        mother_accounts_name: motherNames,
        mother_accounts_code: motherCodes
      };

      autoSave(updatedForm);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      Swal.fire('Validation Error', 'Name is required.', 'warning');
      return;
    }

    // Compose mother accounts names and codes as comma-separated strings from selectedMotherAccounts
    const motherNames = motherAccounts
      .filter(ma => selectedMotherAccounts.includes(ma.id))
      .map(ma => ma.name)
      .join(', ');
    const motherCodes = motherAccounts
      .filter(ma => selectedMotherAccounts.includes(ma.id))
      .map(ma => ma.code)
      .join(', ');

    if (isEditing) {
      const { error } = await supabase
        .from('distributors')
        .update({
          name: form.name,
          description: form.description || null,
          mother_accounts_name: motherNames || null,
          mother_accounts_code: motherCodes || null
        })
        .eq('id', form.id);
      if (error) {
        Swal.fire('Update Error', error.message, 'error');
      } else {
        Swal.fire('Success', 'Distributor updated successfully!', 'success');
        setModalOpen(false);
        fetchDistributors();
      }
    } else {
      // Insert new distributor without code (auto-gen)
      const { error } = await supabase
        .from('distributors')
        .insert([{
          name: form.name,
          description: form.description || null,
          mother_accounts_name: motherNames || null,
          mother_accounts_code: motherCodes || null
        }]);
      if (error) {
        Swal.fire('Insert Error', error.message, 'error');
      } else {
        Swal.fire('Success', 'Distributor added successfully!', 'success');
        setModalOpen(false);
        fetchDistributors();
      }
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this distributor!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      const { error } = await supabase
        .from('distributors')
        .delete()
        .eq('id', id);
      if (error) {
        Swal.fire('Delete Error', error.message, 'error');
      } else {
        Swal.fire('Deleted!', 'Distributor has been deleted.', 'success');
        fetchDistributors();
      }
    }
  };

  const handleExport = () => {
    const headers = ['ID', 'Code', 'Name', 'Description', 'Mother Accounts Name', 'Mother Accounts Code'];
    const rows = distributors.map(d => [
      d.id,
      d.code,
      d.name,
      d.description || '',
      d.mother_accounts_name || '',
      d.mother_accounts_code || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'distributors.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const imported = results.data;

        // Normalize headers
        const normalizedData = imported.map(row => {
          const normalized = {};
          for (const key in row) {
            if (key && typeof key === 'string') {
              normalized[key.toLowerCase().trim()] = row[key];
            }
          }
          return normalized;
        });

        const allNames = normalizedData
          .filter(row => row.name && row.name.trim())
          .map(row => row.name.trim());

        // Get existing names from DB
        const { data: existing, error: fetchError } = await supabase
          .from('distributors')
          .select('name')
          .in('name', allNames);

        if (fetchError) {
          Swal.fire('Fetch Error', fetchError.message, 'error');
          return;
        }

        const existingNames = new Set(existing.map(e => e.name));

        const validEntries = normalizedData
          .filter(row => row.name && !existingNames.has(row.name.trim()))
          .map(row => ({
            name: row.name.trim(),
            description: row.description?.trim() || null,
          }));

        if (validEntries.length === 0) {
          Swal.fire('Import Notice', 'No new distributors to import. All names already exist.', 'info');
          return;
        }

        const { error: insertError } = await supabase
          .from('distributors')
          .insert(validEntries);

        if (insertError) {
          Swal.fire('Insert Error', insertError.message, 'error');
        } else {
          Swal.fire('Success', `${validEntries.length} new distributors imported successfully.`, 'success');
          fetchDistributors();
        }
      },
      error: (err) => {
        Swal.fire('Parse Error', err.message, 'error');
      }
    });

    e.target.value = '';
  };

  const autoSave = debounce(async (updatedForm) => {
    if (updatedForm.id && updatedForm.name.trim()) {
      // Compose mother accounts from selectedMotherAccounts state
      const motherNames = motherAccounts
        .filter(ma => selectedMotherAccounts.includes(ma.id))
        .map(ma => ma.name)
        .join(', ');
      const motherCodes = motherAccounts
        .filter(ma => selectedMotherAccounts.includes(ma.id))
        .map(ma => ma.code)
        .join(', ');

      const { error } = await supabase
        .from('distributors')
        .update({
          name: updatedForm.name,
          description: updatedForm.description || null,
          mother_accounts_name: motherNames || null,
          mother_accounts_code: motherCodes || null
        })
        .eq('id', updatedForm.id);

      if (error) {
        console.error('Auto-save error:', error.message);
      } else {
        console.log('Auto-saved changes');
      }
    }
  }, 1000); // 1 second debounce

  // Filtering distributors by searchTerm
  const filteredDistributors = distributors.filter(dist => {
    const term = searchTerm.toLowerCase();
    return (
      dist.name.toLowerCase().includes(term) ||
      dist.code.toString().toLowerCase().includes(term) ||
      (dist.description && dist.description.toLowerCase().includes(term))
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredDistributors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredDistributors.slice(startIndex, startIndex + itemsPerPage);

  // Pagination controls handlers
  const goToPage = (page) => {
    if (page < 1) page = 1;
    else if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  // When itemsPerPage changes reset to first page
  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  // Styles
  const containerStyle = {
    padding: '20px',
    maxWidth: 1500,
    margin: '0 auto',
    backgroundColor: '#fdfdfdff',
    borderRadius: '12px'
  };
  const addButtonStyle = {
    marginBottom: '20px',
    padding: '10px 16px',
    backgroundColor: '#6387ebff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  };
  const tableWrapperStyle = {
    overflowX: 'auto',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '600px'
  };
  const thStyle = {
    padding: '12px',
    textAlign: 'left',
    backgroundColor: '#0062ffff',
    color: 'white'
  };
  const tdStyle = {
    padding: '12px'
  };
  const actionBtnStyle = {
    marginRight: '8px',
    padding: '6px 12px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    backgroundColor: '#007bff'
  };
  const modalOverlayStyle = {
    position: 'fixed',
    top: 0, left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '10px'
  };
  const modalContentStyle = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    maxHeight: '80vh',
    overflowY: 'auto'
  };
  const inputStyle = {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    marginBottom: '12px'
  };
  const saveButtonStyle = {
    padding: '10px 16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  };
  const cancelButtonStyle = {
    padding: '10px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginLeft: '8px'
  };

  return (
    <div style={containerStyle}>
      <h2>Distributor List</h2>
      {/* Action Bar: Add, Export, Import, Search */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <button style={addButtonStyle} onClick={openAddModal}>
          Add Distributor
        </button>

        <button
          style={{ ...addButtonStyle, backgroundColor: '#28a745' }}
          onClick={handleExport}
        >
          Export CSV
        </button>

        {/* Import CSV as a styled button */}
        <label
          htmlFor="import-csv"
          style={{
            ...addButtonStyle,
            backgroundColor: '#00a854ff',
            display: 'inline-block',
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '6px',
            color: '#fff',
            fontWeight: 'bold'
          }}
        >
          Import CSV
        </label>

        <input
          id="import-csv"
          type="file"
          accept=".csv"
          onChange={handleImport}
          style={{ display: 'none' }}
        />


        <input
          type="text"
          placeholder="Search by name, code or description"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            ...inputStyle,
            maxWidth: '300px',
            flex: '1',
            minWidth: '200px'
          }}
        />
      </div>

      {/* Rows per page dropdown */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px'
      }}>
        <label htmlFor="rowsPerPage" style={{ fontWeight: 'bold' }}>Rows per page:</label>
        <select
          id="rowsPerPage"
          value={itemsPerPage}
          onChange={handleItemsPerPageChange}
          style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            cursor: 'pointer'
          }}
        >
          {ROW_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Mother Accounts Name</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : currentItems.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>No distributors found</td></tr>
            ) : currentItems.map(distributor => (
              <tr key={distributor.id}>
                <td style={tdStyle}>{distributor.id}</td>
                <td style={tdStyle}>{distributor.code}</td>
                <td style={tdStyle}>{distributor.name}</td>
                <td style={tdStyle}>{distributor.description}</td>
                <td style={tdStyle}>
                  {distributor.mother_accounts_name?.length > 50
                    ? distributor.mother_accounts_name.substring(0, 50) + "..."
                    : distributor.mother_accounts_name}
                </td>
                <td style={tdStyle}>
                  <button
                    style={{ ...actionBtnStyle, backgroundColor: '#007bff', padding: '6px 10px', minWidth: 'auto' }}
                    onClick={() => openEditModal(distributor)}
                    aria-label="Edit Distributor"
                    title="Edit"
                  >
                    {/* Pencil/Edit icon SVG */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="white"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M12.146.854a.5.5 0 0 1 .708 0l2.292 2.292a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2L3 10.207V11h.793L13 3.793 11.207 2z" />
                    </svg>
                  </button>

                  <button
                    style={{ ...actionBtnStyle, backgroundColor: '#dc3545', padding: '6px 10px', minWidth: 'auto' }}
                    onClick={() => handleDelete(distributor.id)}
                    aria-label="Delete Distributor"
                    title="Delete"
                  >
                    {/* Trash/Delete icon SVG */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="white"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm5 0A.5.5 0 0 1 11 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" />
                      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3.086a1 1 0 0 1 .707.293l.707.707h3.086l.707-.707A1 1 0 0 1 11.914 2H15a1 1 0 0 1 .5.5zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118z" />
                    </svg>
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #007bff',
            backgroundColor: currentPage === 1 ? '#e0e0e0' : '#007bff',
            color: currentPage === 1 ? '#888' : '#fff',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s',
          }}
          onMouseEnter={e => {
            if (currentPage !== 1) e.currentTarget.style.backgroundColor = '#0056b3';
          }}
          onMouseLeave={e => {
            if (currentPage !== 1) e.currentTarget.style.backgroundColor = '#007bff';
          }}
        >
          Prev
        </button>

        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #007bff',
            backgroundColor: currentPage === totalPages ? '#e0e0e0' : '#007bff',
            color: currentPage === totalPages ? '#888' : '#fff',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s',
          }}
          onMouseEnter={e => {
            if (currentPage !== totalPages) e.currentTarget.style.backgroundColor = '#0056b3';
          }}
          onMouseLeave={e => {
            if (currentPage !== totalPages) e.currentTarget.style.backgroundColor = '#007bff';
          }}
        >
          Next
        </button>
      </div>

      {/* Modal for Add/Edit */}
      {modalOpen && (
        <div style={modalOverlayStyle} onClick={() => setModalOpen(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3>{isEditing ? 'Edit Distributor' : 'Add Distributor'}</h3>
            <form onSubmit={handleSubmit}>
              <label>Code</label>
              <input
                style={inputStyle}
                type="text"
                name="code"
                value={form.code}
                disabled
                readOnly
              />
              <label>Name *</label>
              <input
                style={inputStyle}
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
              <label>Description</label>
              <textarea
                style={{ ...inputStyle, height: '60px' }}
                name="description"
                value={form.description}
                onChange={handleChange}
              />

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontWeight: '600' }}>
                Mother Accounts
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMotherAccounts.length === motherAccounts.length) {
                      setSelectedMotherAccounts([]); // uncheck all
                    } else {
                      setSelectedMotherAccounts(motherAccounts.map(ma => ma.id)); // check all
                    }
                  }}
                  style={{
                    fontSize: '0.85rem',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    border: '1px solid #007bff',
                    backgroundColor: selectedMotherAccounts.length === motherAccounts.length ? '#f8d7da' : '#007bff',
                    color: selectedMotherAccounts.length === motherAccounts.length ? '#721c24' : 'white',
                    transition: 'background-color 0.2s, color 0.2s'
                  }}
                >
                  {selectedMotherAccounts.length === motherAccounts.length ? 'Uncheck All' : 'Check All'}
                </button>
              </label>

              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  marginBottom: '12px',
                  backgroundColor: '#fafafa',
                  boxShadow: 'inset 0 1px 3px rgb(0 0 0 / 0.1)'
                }}
              >
                {motherAccounts.length === 0 ? (
                  <p style={{ color: '#888', fontStyle: 'italic' }}>No mother accounts available</p>
                ) : (
                  motherAccounts.map(ma => (
                    <div
                      key={ma.id}
                      style={{
                        marginBottom: '8px',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'background-color 0.15s'
                      }}
                      onClick={() => handleMotherAccountToggle(ma.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleMotherAccountToggle(ma.id);
                        }
                      }}
                      role="checkbox"
                      aria-checked={selectedMotherAccounts.includes(ma.id)}
                      tabIndex={0}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMotherAccounts.includes(ma.id)}
                        onChange={() => handleMotherAccountToggle(ma.id)}
                        style={{ marginRight: '10px', cursor: 'pointer' }}
                        tabIndex={-1}
                      />
                      <span>{ma.code} - {ma.name}</span>
                    </div>
                  ))
                )}
              </div>


              <button type="submit" style={saveButtonStyle}>
                {isEditing ? 'Save Changes' : 'Add Distributor'}
              </button>
              <button
                type="button"
                style={cancelButtonStyle}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Distributor;
