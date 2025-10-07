import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

const ROW_OPTIONS = [5, 10, 20];

const Account = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ id: null, code: '', name: '', description: '' });
    const [isEditing, setIsEditing] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    const fetchAccounts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .order('code', { ascending: true });

        if (error) {
            Swal.fire('Error', 'Error fetching accounts: ' + error.message, 'error');
        } else {
            setAccounts(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const generateNextCode = () => {
        if (accounts.length === 0) return '20001';
        const nums = accounts.map(acc => {
            const n = parseInt(acc.code, 10);
            return isNaN(n) ? 0 : n;
        });
        const maxNum = Math.max(...nums);
        return (maxNum + 1).toString();
    };

    const openAddModal = () => {
        setForm({ id: null, code: generateNextCode(), name: '', description: '' });
        setIsEditing(false);
        setModalOpen(true);
    };

    const openEditModal = (account) => {
        setForm({ id: account.id, code: account.code, name: account.name, description: account.description });
        setIsEditing(true);
        setModalOpen(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            Swal.fire('Validation Error', 'Name is required.', 'warning');
            return;
        }

        if (isEditing) {
            const { error } = await supabase
                .from('accounts')
                .update({ name: form.name, description: form.description || null })
                .eq('id', form.id);

            if (error) {
                Swal.fire('Update Error', error.message, 'error');
            } else {
                Swal.fire('Success', 'Account updated successfully!', 'success');
                setModalOpen(false);
                fetchAccounts();
            }
        } else {
            const { error } = await supabase
                .from('accounts')
                .insert([{ code: form.code, name: form.name, description: form.description || null }]);

            if (error) {
                Swal.fire('Insert Error', error.message, 'error');
            } else {
                Swal.fire('Success', 'Account added successfully!', 'success');
                setModalOpen(false);
                fetchAccounts();
            }
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'You will not be able to recover this account!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('accounts').delete().eq('id', id);
            if (error) {
                Swal.fire('Delete Error', error.message, 'error');
            } else {
                Swal.fire('Deleted!', 'Account has been deleted.', 'success');
                fetchAccounts();
            }
        }
    };

    // Search
    const filteredAccounts = accounts.filter(acc => {
        const term = searchTerm.toLowerCase();
        return (
            acc.name.toLowerCase().includes(term) ||
            acc.code.toLowerCase().includes(term) ||
            (acc.description && acc.description.toLowerCase().includes(term))
        );
    });

    // Pagination
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
            <h2>Accounts</h2>
            <button onClick={openAddModal} style={addButtonStyle}>+ Add New Account</button>

            <div style={tableWrapperStyle}>
                <div style={searchWrapperStyle}>
                    <input
                        type="text"
                        placeholder="Search by code, name, description..."
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
                                    <th style={thStyle}>ID</th>
                                    <th style={thStyle}>Code</th>
                                    <th style={thStyle}>Name</th>
                                    <th style={thStyle}>Description</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: 12, textAlign: 'center' }}>No accounts found.</td>
                                    </tr>
                                ) : currentItems.map(acc => (
                                    <tr key={acc.id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={tdStyle}>{acc.id}</td>
                                        <td style={tdStyle}>{acc.code}</td>
                                        <td style={tdStyle}>{acc.name}</td>
                                        <td style={tdStyle}>{acc.description || '-'}</td>
                                        <td style={tdStyle}>
                                            <button onClick={() => openEditModal(acc)} style={actionBtnStyle}>Edit</button>
                                            <button onClick={() => handleDelete(acc.id)} style={{ ...actionBtnStyle, backgroundColor: '#dc3545' }}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={footerStyle}>
                            <div>
                                <label htmlFor="rowsPerPage" style={{ marginRight: '6px' }}>Rows per page:</label>
                                <select
                                    id="rowsPerPage"
                                    value={itemsPerPage}
                                    onChange={handleItemsPerPageChange}
                                    style={selectStyle}
                                >
                                    {ROW_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={paginationStyle}>
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    style={{
                                        ...pageButtonStyle,
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === 1 ? 0.5 : 1
                                    }}
                                >Prev</button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => goToPage(page)}
                                        style={currentPage === page ? activePageButtonStyle : pageButtonStyle}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    style={{
                                        ...pageButtonStyle,
                                        cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === totalPages || totalPages === 0 ? 0.5 : 1
                                    }}
                                >Next</button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {modalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3>{isEditing ? 'Edit Account' : 'Add New Account'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Code:</label>
                                <input type="text" name="code" value={form.code} readOnly style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Name: *</label>
                                <input type="text" name="name" value={form.name} onChange={handleChange} required style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Description:</label>
                                <textarea name="description" value={form.description} onChange={handleChange} style={{ ...inputStyle, height: '60px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={() => setModalOpen(false)} style={{ ...actionBtnStyle, backgroundColor: '#6c757d' }}>Cancel</button>
                                <button type="submit" style={actionBtnStyle}>{isEditing ? 'Update' : 'Add'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// === Reusable Styles ===

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

const tableWrapperStyle = { overflowX: 'auto' };

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

const tdStyle = { padding: '12px' };

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
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
};

const inputStyle = {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    marginTop: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
};

const searchWrapperStyle = {
    marginBottom: '12px',
    maxWidth: '300px'
};

const searchInputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '14px',
    boxSizing: 'border-box'
};

const footerStyle = {
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px'
};

const paginationStyle = {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
};

const pageButtonStyle = {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid #007bff',
    backgroundColor: 'white',
    color: '#007bff',
    cursor: 'pointer',
    minWidth: '32px',
    textAlign: 'center',
    fontWeight: '600',
    userSelect: 'none'
};

const activePageButtonStyle = {
    ...pageButtonStyle,
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'default'
};

const selectStyle = {
    padding: '6px 10px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    cursor: 'pointer'
};

export default Account;
