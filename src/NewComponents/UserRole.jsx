import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const UserRole = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ id: null, role: '', description: '' });
    const [errorMsg, setErrorMsg] = useState('');

    const fetchRoles = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('user_role')
            .select('*')
            .order('id', { ascending: true });
        if (error) {
            console.error('Error fetching roles:', error);
        } else {
            setRoles(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const openNewModal = () => {
        setForm({ id: null, role: '', description: '' });
        setErrorMsg('');
        setShowModal(true);
    };

    const openEditModal = (role) => {
        setForm({
            id: role.id,
            role: role.role,
            description: role.description || ''
        });
        setErrorMsg('');
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!form.role.trim()) {
            setErrorMsg('Role is required.');
            return;
        }

        if (form.id) {
            const { error } = await supabase
                .from('user_role')
                .update({ role: form.role, description: form.description })
                .eq('id', form.id);

            if (error) {
                setErrorMsg(error.message);
            } else {
                setShowModal(false);
                fetchRoles();
            }
        } else {
            const { error } = await supabase
                .from('user_role')
                .insert({ role: form.role, description: form.description });

            if (error) {
                setErrorMsg(error.message);
            } else {
                setShowModal(false);
                fetchRoles();
            }
        }
    };

    const handleDelete = async (id) => {
        const confirmed = window.confirm('Are you sure you want to delete this role?');
        if (!confirmed) return;

        const { error } = await supabase
            .from('user_role')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Failed to delete role: ' + error.message);
        } else {
            fetchRoles();
        }
    };

    return (
        <div style={containerStyle}>
            <h2 style={{ color: '#fff' }}>User Roles</h2>
            <button onClick={openNewModal} style={addButtonStyle}>
                + Add New Role
            </button>

            {loading ? (
                <p style={{ color: '#fff' }}>Loading...</p>
            ) : (
                <div style={tableWrapperStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={{ backgroundColor: '#0062ffff' }}>
                                <th style={thStyle}>ID</th>
                                <th style={thStyle}>Code</th>

                                <th style={thStyle}>Role</th>
                                <th style={thStyle}>Description</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: 12, textAlign: 'center', color: '#fff' }}>
                                        No roles found.
                                    </td>
                                </tr>
                            ) : (
                                roles.map(role => (
                                    <tr key={role.id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={tdStyle}>{role.id}</td>
                                        <td style={tdStyle}>{role.code}</td>

                                        <td style={tdStyle}>{role.role}</td>
                                        <td style={tdStyle}>{role.description || '-'}</td>
                                        <td style={tdStyle}>
                                            <button onClick={() => openEditModal(role)} style={actionBtnStyle}>
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(role.id)}
                                                style={{ ...actionBtnStyle, backgroundColor: '#dc3545' }}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 style={{ color: 'black' }}>{form.id ? 'Edit Role' : 'Add New Role'}</h3>
                        {errorMsg && (
                            <div style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</div>
                        )}
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ color: 'black' }}>Role:</label>
                                <input
                                    type="text"
                                    name="role"
                                    value={form.role}
                                    onChange={handleFormChange}
                                    required
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ color: 'black' }}>Description:</label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleFormChange}
                                    style={{ ...inputStyle, height: '60px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{ ...actionBtnStyle, backgroundColor: '#6c757d' }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" style={actionBtnStyle}>
                                    {form.id ? 'Update' : 'Add'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Styles
const containerStyle = {
    padding: '20px',
    maxWidth: 1500,
    margin: '0 auto',
    backgroundColor: '#fdfdfdff',
    borderRadius: '12px',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box',
};

const addButtonStyle = {
    marginBottom: '20px',
    padding: '10px 16px',
    cursor: 'pointer',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#6387ebff',
    color: 'white',
    fontWeight: '600',
    fontSize: '16px',
};

const tableWrapperStyle = {
    overflowX: 'auto',
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '600px',
};

const thStyle = {
    padding: '12px',
    borderBottom: '2px solid #ccc',
    textAlign: 'left',
    fontWeight: '600',
    color: 'white',
};

const tdStyle = {
    padding: '12px',
    color: 'black',
};

const actionBtnStyle = {
    padding: '6px 12px',
    marginRight: '8px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#007bff',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
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
    padding: '10px',
    boxSizing: 'border-box',
};

const modalContentStyle = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    boxSizing: 'border-box',
};

const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    marginTop: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
};

export default UserRole;
