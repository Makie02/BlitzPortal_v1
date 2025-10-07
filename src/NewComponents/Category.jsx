import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';


const Category = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ id: null, code: '', name: '', description: '' });
    const [isEditing, setIsEditing] = useState(false);

    const fetchCategories = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('category')
            .select('*')
            .order('code', { ascending: true });

        if (error) {
            Swal.fire('Fetch Error', error.message, 'error');
        } else {
            setCategories(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const generateNextCode = () => {
        if (categories.length === 0) return '8000';

        const sorted = [...categories].sort((a, b) => {
            const aNum = parseInt(a.code.replace(/\D/g, ''), 10);
            const bNum = parseInt(b.code.replace(/\D/g, ''), 10);
            return aNum - bNum;
        });

        const lastCode = sorted[sorted.length - 1].code;
        const lastNum = parseInt(lastCode.replace(/\D/g, ''), 10);
        return `${lastNum + 1}`;
    };

    const openAddModal = () => {
        setForm({ id: null, code: generateNextCode(), name: '', description: '' });
        setIsEditing(false);
        setModalOpen(true);
    };

    const openEditModal = (category) => {
        setForm(category);
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
                .from('category')
                .update({ name: form.name, description: form.description || null })
                .eq('id', form.id);

            if (error) {
                Swal.fire('Update Failed', error.message, 'error');
            } else {
                Swal.fire('Success', 'Category updated successfully!', 'success');
                setModalOpen(false);
                fetchCategories();
            }
        } else {
            const { error } = await supabase
                .from('category')
                .insert([{ code: form.code, name: form.name, description: form.description || null }]);

            if (error) {
                Swal.fire('Insert Failed', error.message, 'error');
            } else {
                Swal.fire('Success', 'Category added successfully!', 'success');
                setModalOpen(false);
                fetchCategories();
            }
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'You will not be able to recover this category!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            const { error } = await supabase
                .from('category')
                .delete()
                .eq('id', id);

            if (error) {
                Swal.fire('Delete Failed', error.message, 'error');
            } else {
                Swal.fire('Deleted!', 'Category has been deleted.', 'success');
                fetchCategories();
            }
        }
    };
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div style={containerStyle}>
            <h2 style={{ color: '#fff' }}>Categories</h2>
            <button onClick={openAddModal} style={addButtonStyle}>
                + Add New Category
            </button>

            {loading ? (
                <p style={{ color: '#fff' }}>Loading...</p>
            ) : (
                <div style={tableWrapperStyle}>
                    <input
                        type="text"
                        placeholder="Search categories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            padding: '8px 12px',
                            marginBottom: '20px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            fontSize: '14px',
                        }}
                    />

                    {/* Table */}
                    <table style={tableStyle}>
                        <thead>
                            <tr style={{ backgroundColor: '#0062ffff' }}>
                                <th style={thStyle}>ID</th>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Description</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.filter(cat =>
                                cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                cat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))
                            ).length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: 12, textAlign: 'center', color: '#fff' }}>
                                        No categories found.
                                    </td>
                                </tr>
                            ) : (
                                categories
                                    .filter(cat =>
                                        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        cat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))
                                    )
                                    .map(cat => (
                                        <tr key={cat.id} style={{ borderBottom: '1px solid #ddd' }}>
                                            <td style={tdStyle}>{cat.id}</td>
                                            <td style={tdStyle}>{cat.code}</td>
                                            <td style={tdStyle}>{cat.name}</td>
                                            <td style={tdStyle}>{cat.description || '-'}</td>
                                            <td style={tdStyle}>
                                                  <button
                                                onClick={() => openEditModal(cat)}
                                                style={actionBtnStyle}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cat.id)}
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

            {modalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 style={{ color: 'black' }}>{isEditing ? 'Edit Category' : 'Add New Category'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ color: 'black' }}>Code:</label>
                                <input
                                    type="text"
                                    name="code"
                                    value={form.code}
                                    readOnly
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ color: 'black' }}>Name: *</label>
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
                                <label style={{ color: 'black' }}>Description:</label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    style={{ ...inputStyle, height: '60px' }}
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
export default Category;