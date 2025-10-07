import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const Position = () => {
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ id: null, code: '', name: '', description: '' });
    const [isEditing, setIsEditing] = useState(false);

    // Fetch positions
    const fetchPositions = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('position')
            .select('*')
            .order('code', { ascending: true });

        if (error) {
            alert('Error fetching positions: ' + error.message);
        } else {
            setPositions(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPositions();
    }, []);

    // Generate next code starting at 6000
    const generateNextCode = () => {
        const codes = positions
            .map(p => parseInt(p.code, 10))
            .filter(n => !isNaN(n));

        const maxCode = codes.length > 0 ? Math.max(...codes) : 5999;
        return (maxCode + 1).toString();
    };

    const openAddModal = () => {
        setForm({ id: null, code: generateNextCode(), name: '', description: '' });
        setIsEditing(false);
        setModalOpen(true);
    };

    const openEditModal = (pos) => {
        setForm({
            id: pos.id,
            code: pos.code,
            name: pos.name,
            description: pos.description || ''
        });
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
                .from('position')
                .update({ name: form.name, description: form.description || null })
                .eq('id', form.id);

            if (error) {
                alert('Update error: ' + error.message);
            } else {
                alert('Position updated successfully!');
                setModalOpen(false);
                fetchPositions();
            }
        } else {
            const { error } = await supabase
                .from('position')
                .insert([{ code: form.code, name: form.name, description: form.description || null }]);

            if (error) {
                alert('Insert error: ' + error.message);
            } else {
                alert('Position added successfully!');
                setModalOpen(false);
                fetchPositions();
            }
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this position?')) {
            const { error } = await supabase
                .from('position')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Delete error: ' + error.message);
            } else {
                alert('Position deleted!');
                fetchPositions();
            }
        }
    };

    // Styles
    const containerStyle = {
        padding: '20px',
        maxWidth: '1500px',
        margin: '0 auto',
        backgroundColor: '#fdfdfd',
        borderRadius: '12px'
    };
    const addButtonStyle = {
        marginBottom: '20px',
        padding: '10px 16px',
        backgroundColor: '#6387eb',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
    };
    const tableStyle = {
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '600px'
    };
    const thStyle = {
        padding: '12px',
        textAlign: 'left',
        backgroundColor: '#0062ff',
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
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '10px',
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
        marginTop: '4px'
    };

    return (
        <div style={containerStyle}>
            <h2>Positions</h2>
            <button onClick={openAddModal} style={addButtonStyle}>+ Add New Position</button>

            {loading ? (
                <p>Loading...</p>
            ) : (
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
                        {positions.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ padding: 12, textAlign: 'center' }}>No positions found.</td>
                            </tr>
                        ) : positions.map(pos => (
                            <tr key={pos.id} style={{ borderBottom: '1px solid #ddd' }}>
                                <td style={tdStyle}>{pos.id}</td>
                                <td style={tdStyle}>{pos.code}</td>
                                <td style={tdStyle}>{pos.name}</td>
                                <td style={tdStyle}>{pos.description || '-'}</td>
                                <td style={tdStyle}>
                                    <button onClick={() => openEditModal(pos)} style={actionBtnStyle}>Edit</button>
                                    <button onClick={() => handleDelete(pos.id)} style={{ ...actionBtnStyle, backgroundColor: '#dc3545' }}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {modalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3>{isEditing ? 'Edit Position' : 'Add New Position'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Code:</label>
                                <input
                                    type="text"
                                    name="code"
                                    value={form.code}
                                    readOnly
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Name: *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label>Description:</label>
                                <textarea
                                    name="description"
                                    value={form.description ? form.description : ''}
                                    onChange={handleChange}
                                    style={Object.assign({}, inputStyle, { height: '60px' })}
                                />

                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    style={{ ...actionBtnStyle, backgroundColor: '#6c757d' }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" style={actionBtnStyle}>
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

export default Position;
