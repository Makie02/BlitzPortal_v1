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

  // form now includes agent_code and mother_accounts_code (string)
  const [form, setForm] = useState({
    id: null,
    code: '',
    name: '',
    description: '',
    agent_code: '',
    mother_accounts_code: '' // comma-separated codes
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false); // view-only modal mode

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Mother accounts state
  const [motherAccounts, setMotherAccounts] = useState([]);
  const [selectedMotherAccounts, setSelectedMotherAccounts] = useState([]); // array of mother account ids

  // Account_Users (for selecting agent)
  const [accountUsers, setAccountUsers] = useState([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [accountUserSearch, setAccountUserSearch] = useState('');
  const [selectedAgentUser, setSelectedAgentUser] = useState(null); // {id, name, UserID}

  const fetchDistributors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('code', { ascending: true });
    if (error) {
      Swal.fire('Error', 'Error fetching distributors: ' + error.message, 'error');
    } else {
      setDistributors(data || []);
    }
    setLoading(false);
  };

  const fetchMotherAccounts = async () => {
    const { data, error } = await supabase
      .from('mother_account')
      .select('id, code, name')
      .eq('status', true)
      .order('code', { ascending: true });
    if (error) {
      Swal.fire('Error', 'Error fetching mother accounts: ' + error.message, 'error');
    } else {
      setMotherAccounts(data || []);
    }
  };

  const fetchAccountUsers = async () => {
    // fetch id, name, "UserID"
    const { data, error } = await supabase
      .from('Account_Users')
      .select('id, name, "UserID"')
      .order('name', { ascending: true })
      .limit(1000); // adjust limit as needed
    if (error) {
      Swal.fire('Error', 'Error fetching account users: ' + error.message, 'error');
    } else {
      setAccountUsers(data || []);
    }
  };

  useEffect(() => {
    fetchDistributors();
    fetchMotherAccounts();
    fetchAccountUsers();
  }, []);

  // generate next code: returns numeric string padded to 4
  const getNextDistributorCode = async () => {
    try {
      const { data, error } = await supabase
        .from('distributors')
        .select('code')
        .not('code', 'is', null)
        .order('id', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0 && data[0].code) {
        const lastCode = data[0].code;
        const numberPart = parseInt(String(lastCode).replace(/\D/g, ''), 10) || 0;
        const nextNumber = numberPart + 1;
        return nextNumber.toString().padStart(4, '0');
      }

      return '0001';
    } catch (err) {
      console.error('Error generating next code:', err.message);
      return '0001';
    }
  };

  const openAddModal = async () => {
    const nextCode = await getNextDistributorCode();

    setForm({
      id: null,
      code: nextCode,
      name: '',
      description: '',
      agent_code: '',
      mother_accounts_code: ''
    });
    setIsEditing(false);
    setIsViewing(false);
    setSelectedMotherAccounts([]);
    setSelectedAgentUser(null);
    setModalOpen(true);
  };

  const openEditModal = (distributor) => {
    setForm({
      id: distributor.id,
      code: distributor.code,
      name: distributor.name || '',
      description: distributor.description || '',
      agent_code: distributor.agent_code || '',
      mother_accounts_code: distributor.mother_accounts_code || ''
    });

    // populate selectedMotherAccounts by matching codes in mother_accounts_code
    if (distributor.mother_accounts_code) {
      const codesArr = distributor.mother_accounts_code.split(',').map(c => c.trim()).filter(Boolean);
      const selectedIds = motherAccounts
        .filter(ma => codesArr.includes(String(ma.code)))
        .map(ma => ma.id);
      setSelectedMotherAccounts(selectedIds);
    } else {
      setSelectedMotherAccounts([]);
    }

    // find selected agent user (if any)
    if (distributor.agent_code) {
      const match = accountUsers.find(u => String(u.UserID) === String(distributor.agent_code));
      if (match) setSelectedAgentUser(match);
      else setSelectedAgentUser(null);
    } else {
      setSelectedAgentUser(null);
    }

    setIsEditing(true);
    setIsViewing(false);
    setModalOpen(true);
  };

  const openViewModal = (distributor) => {
    setForm({
      id: distributor.id,
      code: distributor.code,
      name: distributor.name || '',
      description: distributor.description || '',
      agent_code: distributor.agent_code || '',
      mother_accounts_code: distributor.mother_accounts_code || ''
    });

    if (distributor.mother_accounts_code) {
      const codesArr = distributor.mother_accounts_code.split(',').map(c => c.trim()).filter(Boolean);
      const selectedIds = motherAccounts
        .filter(ma => codesArr.includes(String(ma.code)))
        .map(ma => ma.id);
      setSelectedMotherAccounts(selectedIds);
    } else {
      setSelectedMotherAccounts([]);
    }

    // find agent user for view
    if (distributor.agent_code) {
      const match = accountUsers.find(u => String(u.UserID) === String(distributor.agent_code));
      if (match) setSelectedAgentUser(match);
      else setSelectedAgentUser(null);
    } else {
      setSelectedAgentUser(null);
    }

    setIsEditing(false);
    setIsViewing(true);
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);

    // if agent_code typed manually, update selectedAgentUser (best-effort)
    if (name === 'agent_code') {
      const match = accountUsers.find(u => String(u.UserID) === String(value));
      setSelectedAgentUser(match || null);
    }

    if (isEditing) {
      autoSave(updated);
    }
  };

  const handleMotherAccountToggle = (id) => {
    // Do nothing in view-only mode
    if (isViewing) return;

    let updatedSelected = [];
    if (selectedMotherAccounts.includes(id)) {
      updatedSelected = selectedMotherAccounts.filter(sid => sid !== id);
    } else {
      updatedSelected = [...selectedMotherAccounts, id];
    }
    setSelectedMotherAccounts(updatedSelected);

    // update form.mother_accounts_code to reflect selected codes
    const motherCodes = motherAccounts
      .filter(ma => updatedSelected.includes(ma.id))
      .map(ma => ma.code)
      .join(',') || '';

    const updatedForm = {
      ...form,
      mother_accounts_code: motherCodes
    };

    setForm(updatedForm);

    // Remove autosave here - it will be saved on form submit or when typing other fields
  };
  const [selectedAgentUsers, setSelectedAgentUsers] = useState([]);
useEffect(() => {
  if (isEditing && form.agent_code) {
    const codes = form.agent_code.split(',').map(c => c.trim());
    const preSelected = accountUsers.filter(u => codes.includes(String(u.UserID)));
    setSelectedAgentUsers(preSelected);
  }
}, [isEditing, form.agent_code, accountUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      Swal.fire('Warning', 'Distributor name is required.', 'warning');
      return;
    }

    // Compose mother_accounts_code from selectedMotherAccounts (ensure it's stored)
    const motherCodes = motherAccounts
      .filter(ma => selectedMotherAccounts.includes(ma.id))
      .map(ma => ma.code)
      .join(',') || null;

    try {
      if (isEditing && form.id) {
        const { error } = await supabase
          .from('distributors')
          .update({
            name: form.name.trim(),
            description: form.description ? form.description.trim() : null,
            agent_code: selectedAgentUsers.length > 0
              ? selectedAgentUsers.map(a => a.UserID).join(',')
              : null,
            mother_accounts_code: motherCodes
          })
          .eq('id', form.id);

        if (error) throw error;

        Swal.fire('Success', 'Distributor updated successfully!', 'success');
      } else {
        // Add new distributor
        const nextCode = form.code || (await getNextDistributorCode());

        // check duplicate name
        const { data: existing } = await supabase
          .from('distributors')
          .select('name')
          .eq('name', form.name.trim());

        if (existing && existing.length > 0) {
          Swal.fire('Duplicate', 'A distributor with this name already exists.', 'warning');
          return;
        }

        const { error } = await supabase.from('distributors').insert([
          {
            code: nextCode,
            name: form.name.trim(),
            description: form.description ? form.description.trim() : null,
            agent_code: form.agent_code ? String(form.agent_code).trim() : null,
            mother_accounts_code: motherCodes
          },
        ]);

        if (error) throw error;

        Swal.fire('Success', `Distributor added successfully! (${nextCode})`, 'success');
      }

      setModalOpen(false);
      await fetchDistributors();
    } catch (err) {
      console.error('Error saving distributor:', err.message);
      Swal.fire('Error', err.message, 'error');
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
    const headers = ['ID', 'Code', 'Distributor Name', 'Description', 'Agent Code', 'Mother Accounts Code'];
    const rows = distributors.map(d => [
      d.id,
      d.code,
      d.name,
      d.description || '',
      d.agent_code || '',
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
            code: row.code?.trim() || undefined,
            name: row.name.trim(),
            description: row.description?.trim() || null,
            agent_code: row.agent_code?.trim() || null,
            mother_accounts_code: row.mother_accounts_code?.trim() || null
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
    if (updatedForm.id && updatedForm.name && updatedForm.name.trim()) {
      const { error } = await supabase
        .from('distributors')
        .update({
          name: updatedForm.name.trim(),
          description: updatedForm.description ? updatedForm.description.trim() : null,
          agent_code: updatedForm.agent_code ? String(updatedForm.agent_code).trim() : null,
          mother_accounts_code: updatedForm.mother_accounts_code || null
        })
        .eq('id', updatedForm.id);

      if (error) {
        console.error('Auto-save error:', error.message);
      } else {
        console.log('Auto-saved changes');
        fetchDistributors();
      }
    }
  }, 1000);



  // Filtering distributors by searchTerm
  const filteredDistributors = distributors.filter(dist => {
    const term = searchTerm.toLowerCase();
    return (
      String(dist.name || '').toLowerCase().includes(term) ||
      String(dist.code || '').toLowerCase().includes(term) ||
      (dist.description && String(dist.description).toLowerCase().includes(term)) ||
      (dist.agent_code && String(dist.agent_code).toLowerCase().includes(term))
    );
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredDistributors.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredDistributors.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page) => {
    if (page < 1) page = 1;
    else if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  // Styles (kept mostly same)
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
    maxWidth: '720px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    maxHeight: '85vh',
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

  // --- UI helpers for account users modal ---
  const filteredAccountUsers = accountUsers.filter(u => {
    const term = accountUserSearch.toLowerCase();
    return (
      String(u.name || '').toLowerCase().includes(term) ||
      String(u.UserID || '').toLowerCase().includes(term)
    );
  });

  const openUserPicker = () => {
    // refresh account users in case of changes
    fetchAccountUsers();
    setAccountUserSearch('');
    setUserModalOpen(true);
  };

  const selectAgentUser = (user) => {
    // user.UserID goes into agent_code
    setForm(prev => ({ ...prev, agent_code: String(user.UserID) }));
    setSelectedAgentUser(user);
    setUserModalOpen(false);

    if (isEditing) {
      // autosave the selection for editing
      autoSave({ ...form, agent_code: String(user.UserID) });
    }
  };

  // --- Render ---
  return (
    <div style={containerStyle}>
      <h2>Distributor List</h2>

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
          placeholder="Search by distributor name, code, description or agent"
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
              <th style={thStyle}>Distributor Name</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Agent Code</th>
              <th style={thStyle}>Mother Accounts Code</th>
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
                <td style={tdStyle}>{distributor.agent_code}</td>
                <td style={tdStyle}>
                  {distributor.mother_accounts_code?.length > 40
                    ? distributor.mother_accounts_code.substring(0, 40) + "..."
                    : distributor.mother_accounts_code}
                </td>
                <td style={tdStyle}>
                  {/* View (magnifying glass) */}
                  <button
                    title="View"
                    onClick={() => openViewModal(distributor)}
                    style={{ ...actionBtnStyle, backgroundColor: '#17a2b8', padding: '6px 10px', minWidth: 'auto' }}
                    aria-label="View Distributor"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
                    </svg>
                  </button>

                  {/* Edit */}
                  <button
                    style={{ ...actionBtnStyle, backgroundColor: '#007bff', padding: '6px 10px', minWidth: 'auto' }}
                    onClick={() => openEditModal(distributor)}
                    aria-label="Edit Distributor"
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <path d="M12.146.854a.5.5 0 0 1 .708 0l2.292 2.292a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2L3 10.207V11h.793L13 3.793 11.207 2z" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    style={{ ...actionBtnStyle, backgroundColor: '#dc3545', padding: '6px 10px', minWidth: 'auto' }}
                    onClick={() => handleDelete(distributor.id)}
                    aria-label="Delete Distributor"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
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
      <div style={{
        marginTop: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontFamily: 'Arial, sans-serif',
      }}>
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
        >
          Next
        </button>
      </div>

      {/* Modal for Add/Edit/View */}
      {modalOpen && (
        <div style={modalOverlayStyle} onClick={() => setModalOpen(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3>{isViewing ? 'View Distributor' : (isEditing ? 'Edit Distributor' : 'Add Distributor')}</h3>
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

              <label>Distributor Name *</label>
              <input
                style={inputStyle}
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                disabled={isViewing}
              />

              <label>Description</label>
              <textarea
                style={{ ...inputStyle, height: '60px' }}
                name="description"
                value={form.description}
                onChange={handleChange}
                disabled={isViewing}
              />

              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Agent Code</label>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <input
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                  type="text"
                  name="agent_code"
                  value={form.agent_code}
                  onChange={handleChange}
                  disabled={isViewing}
                  placeholder="Enter UserID or pick from users"
                />

                {/* magnifying glass button */}
                <button
                  type="button"
                  title="Pick Agent (Account User)"
                  onClick={() => {
                    if (!isViewing) openUserPicker();
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: isViewing ? 'not-allowed' : 'pointer',
                    backgroundColor: '#17a2b8',
                    color: 'white'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.85-3.85zM6.5 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
                  </svg>
                </button>
              </div>

              {/* show selected agent user name if present */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontWeight: 600 }}>Agent Info</label>
                <div
                  style={{
                    padding: '8px',
                    borderRadius: 6,
                    border: '1px solid #ddd',
                    backgroundColor: '#fafafa'
                  }}
                >
                  {selectedAgentUsers.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {selectedAgentUsers.map((user) => (
                        <li key={user.id}>
                          <strong>UserID:</strong> {user.UserID} — <strong>Name:</strong> {user.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: '#666', fontStyle: 'italic' }}>No agents selected</div>
                  )}
                </div>
              </div>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontWeight: '600' }}>
                Mother Accounts (select codes)
                {!isViewing && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMotherAccounts.length === motherAccounts.length) {
                        setSelectedMotherAccounts([]); // uncheck all
                        setForm(prev => ({ ...prev, mother_accounts_code: '' }));
                      } else {
                        const allIds = motherAccounts.map(ma => ma.id);
                        setSelectedMotherAccounts(allIds);
                        const allCodes = motherAccounts.map(ma => ma.code).join(',');
                        setForm(prev => ({ ...prev, mother_accounts_code: allCodes }));
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
                )}
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
                  motherAccounts.map(ma => {
                    const checked = selectedMotherAccounts.includes(ma.id);
                    return (
                      <div
                        key={ma.id}
                        style={{
                          marginBottom: '8px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          cursor: isViewing ? 'default' : 'pointer',
                          userSelect: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'background-color 0.15s'
                        }}
                        onClick={() => handleMotherAccountToggle(ma.id)}
                        onKeyDown={e => {
                          if (!isViewing && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            handleMotherAccountToggle(ma.id);
                          }
                        }}
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleMotherAccountToggle(ma.id)}
                          disabled={isViewing}
                          style={{ marginRight: '10px', cursor: isViewing ? 'default' : 'pointer' }}
                          tabIndex={-1}
                        />
                        <span>{ma.code} - {ma.name}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Show the composed mother_accounts_code so user can see or copy */}
              <label>Mother Accounts Code (stored)</label>
              <input
                style={inputStyle}
                type="text"
                name="mother_accounts_code"
                value={form.mother_accounts_code}
                readOnly
                disabled
              />

              {!isViewing ? (
                <>
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
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    style={cancelButtonStyle}
                    onClick={() => setModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* User picker modal (for selecting Agent) */}
      {userModalOpen && (
        <div style={modalOverlayStyle} onClick={() => setUserModalOpen(false)}>
          <div style={{ ...modalContentStyle, maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
            <h4>Select Account User (Agent)</h4>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Search by Distributor Name or UserID"
                value={accountUserSearch}
                onChange={e => setAccountUserSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }}
              />
              <button
                type="button"
                onClick={() => {
                  setAccountUserSearch('');
                  fetchAccountUsers();
                }}
                style={{ padding: '8px 12px', borderRadius: 6, border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' }}
              >
                Refresh
              </button>
            </div>

            <div style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f7f7f7' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>UserID</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Distributor Name</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccountUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, textAlign: 'center', color: '#666' }}>
                        No account users found
                      </td>
                    </tr>
                  ) : (
                    filteredAccountUsers.map((u) => {
                      const isSelected = selectedAgentUsers.some(a => a.id === u.id);
                      return (
                        <tr
                          key={u.id}
                          style={{
                            borderTop: '1px solid #f0f0f0',
                            backgroundColor: isSelected ? '#e8f5e9' : 'transparent',
                            transition: 'background-color 0.2s ease',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAgentUsers(prev => prev.filter(a => a.id !== u.id));
                            } else {
                              setSelectedAgentUsers(prev => [...prev, u]);
                            }
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = '#f9f9f9';
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td style={{ padding: 10, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedAgentUsers(prev => prev.filter(a => a.id !== u.id));
                                } else {
                                  setSelectedAgentUsers(prev => [...prev, u]);
                                }
                              }}
                              style={{
                                width: 20,
                                height: 20,
                                accentColor: '#28a745',
                                cursor: 'pointer'
                              }}
                            />
                          </td>

                          <td style={{ padding: 10, fontWeight: 500, color: '#333' }}>{u.UserID}</td>
                          <td style={{ padding: 10, color: '#555' }}>{u.name}</td>
                          <td style={{ padding: 10 }}>
                            {isSelected && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  backgroundColor: '#d4edda',
                                  color: '#155724',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}
                              >
                                Selected
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>


              </table>
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                style={{ ...cancelButtonStyle }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Distributor;
