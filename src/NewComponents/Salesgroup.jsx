import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const SalesGroup = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ id: null, code: '', name: '', description: '' });
    const [isEditing, setIsEditing] = useState(false);

    const fetchGroups = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sales_group')
            .select('*')
            .order('code', { ascending: true });

        if (error) {
            alert('Error fetching sales groups: ' + error.message);
        } else {
            setGroups(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const generateNextCode = () => {
        if (groups.length === 0) return '10001';
        const maxCode = Math.max(...groups.map(g => parseInt(g.code, 10) || 10000));
        return (maxCode + 1).toString();
    };

    const openAddModal = () => {
        setForm({ id: null, code: generateNextCode(), name: '', description: '' });
        setIsEditing(false);
        setModalOpen(true);
    };

    const openEditModal = (group) => {
        setForm(group);
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
            alert('Name is required.');
            return;
        }

        if (isEditing) {
            const { error } = await supabase
                .from('sales_group')
                .update({ name: form.name, description: form.description || null })
                .eq('id', form.id);

            if (error) {
                alert('Update error: ' + error.message);
            } else {
                alert('Sales group updated successfully!');
                setModalOpen(false);
                fetchGroups();
            }
        } else {
            const { error } = await supabase
                .from('sales_group')
                .insert([{ code: form.code, name: form.name, description: form.description || null }]);

            if (error) {
                alert('Insert error: ' + error.message);
            } else {
                alert('Sales group added successfully!');
                setModalOpen(false);
                fetchGroups();
            }
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this sales group?')) {
            const { error } = await supabase
                .from('sales_group')
                .delete()
                .eq('id', id);
            if (error) {
                alert('Delete error: ' + error.message);
            } else {
                alert('Sales group deleted!');
                fetchGroups();
            }
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: 1500, margin: '0 auto', backgroundColor: '#fdfdfdff', borderRadius: '12px' }}>
            <h2>Sales Groups</h2>
            <button
                onClick={openAddModal}
                style={{
                    marginBottom: '20px',
                    padding: '10px 16px',
                    backgroundColor: '#6387ebff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px'
                }}
            >
                + Add New Sales Group
            </button>

            {loading ? (
                <p>Loading...</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#0062ffff', color: 'white' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Code</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ padding: 12, textAlign: 'center' }}>
                                    No sales groups found.
                                </td>
                            </tr>
                        ) : (
                            groups.map((group) => (
                                <tr key={group.id} style={{ borderBottom: '1px solid #ddd' }}>
                                    <td style={{ padding: '12px' }}>{group.id}</td>
                                    <td style={{ padding: '12px' }}>{group.code}</td>
                                    <td style={{ padding: '12px' }}>{group.name}</td>
                                    <td style={{ padding: '12px' }}>{group.description || '-'}</td>
                                    <td style={{ padding: '12px' }}>
                                        <button
                                            onClick={() => openEditModal(group)}
                                            style={{ ...primaryButtonStyle, marginRight: '8px' }}
                                        >
                                            Edit
                                        </button>

                                        <button
                                            onClick={() => handleDelete(group.id)}
                                            style={dangerButtonStyle}
                                        >
                                            Delete
                                        </button>

                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}

            {modalOpen && (
                <div style={{
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
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '8px',
                        width: '100%',
                        maxWidth: '400px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    }}>
                        <h3>{isEditing ? 'Edit Sales Group' : 'Add New Sales Group'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Code:</label>
                                <input type="text" name="code" value={form.code} readOnly style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Name: *</label>
                                <input type="text" name="name" value={form.name} onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Description:</label>
                                <textarea name="description" value={form.description} onChange={handleChange} style={{ width: '100%', padding: '8px', height: '60px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    style={secondaryButtonStyle}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    style={primaryButtonStyle}
                                >
                                    {isEditing ? 'Update' : 'Add'}
                                </button>

                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
// Reusable button styles
const baseButtonStyle = {
    padding: '8px 14px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
};

const primaryButtonStyle = {
    ...baseButtonStyle,
    backgroundColor: '#007bff',
    color: 'white',
};

const dangerButtonStyle = {
    ...baseButtonStyle,
    backgroundColor: '#dc3545',
    color: 'white',
};

const secondaryButtonStyle = {
    ...baseButtonStyle,
    backgroundColor: '#6c757d',
    color: 'white',
};

const addButtonStyle = {
    ...baseButtonStyle,
    backgroundColor: '#6387eb',
    color: 'white',
    marginBottom: '20px',
};


export default SalesGroup;
