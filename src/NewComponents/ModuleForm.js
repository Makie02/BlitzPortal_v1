import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../supabaseClient'; // Make sure this path is correct

const ModuleForm = () => {
    const [form, setForm] = useState({
        model_name: '',
        allowed: false,
        role: '',
        days: '',
    });

    const [modules, setModules] = useState([]);
    const [editingModule, setEditingModule] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const fetchModules = async () => {
        try {
            const { data, error } = await supabase.from('modules').select('*');
            if (error) throw error;
            setModules(data || []);
        } catch (error) {
            console.error('Error fetching modules:', error.message);
        }
    };

    useEffect(() => {
        fetchModules();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.model_name.trim() || !form.role || !form.days) {
            Swal.fire('Validation Error', 'All fields are required!', 'warning');
            return;
        }

        try {
            let data, error;

            if (editingModule) {
                const { data: updatedData, error: updateError } = await supabase
                    .from('modules')
                    .update({
                        model_name: form.model_name,
                        allowed: form.allowed,
                        role: form.role,
                        days: parseInt(form.days),
                    })
                    .eq('id', editingModule.id);

                data = updatedData;
                error = updateError;
            } else {
                const { data: newData, error: insertError } = await supabase
                    .from('modules')
                    .insert([
                        {
                            model_name: form.model_name,
                            allowed: form.allowed,
                            role: form.role,
                            days: parseInt(form.days),
                        },
                    ]);

                data = newData;
                error = insertError;
            }

            if (error) {
                Swal.fire('Error', 'Error inserting/updating module: ' + error.message, 'error');
            } else {
                Swal.fire('Success', `Module ${editingModule ? 'updated' : 'created'} successfully!`, 'success');
                setForm({ model_name: '', allowed: false, role: '', days: '' });
                setEditingModule(null);
                fetchModules();
            }
        } catch (error) {
            Swal.fire('Error', 'Error: ' + error.message, 'error');
        }
    };

    const handleEdit = (module) => {
        setEditingModule(module);
        setForm({
            model_name: module.model_name,
            allowed: module.allowed,
            role: module.role,
            days: module.days.toString(),
        });
    };

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase.from('modules').delete().eq('id', id);
            if (error) throw error;
            Swal.fire('Success', 'Module deleted successfully!', 'success');
            fetchModules();
        } catch (error) {
            Swal.fire('Error', 'Error deleting module: ' + error.message, 'error');
        }
    };

    return (
        <div style={pageContainerStyle}>
            <div style={formContainerStyle}>
                <h2>{editingModule ? 'Edit Module' : 'Create New Module'}</h2>
                <form onSubmit={handleSubmit} style={formStyle}>
                    <label>Model Name</label>
                    <input
                        type="text"
                        name="model_name"
                        value={form.model_name}
                        onChange={handleChange}
                        style={inputStyle}
                        placeholder="Enter model name"
                        required
                    />

                    <label>Allowed</label>
                    <div style={checkboxWrapperStyle}>
                        <label>
                            <input
                                type="checkbox"
                                name="allowed"
                                checked={form.allowed}
                                onChange={handleChange}
                                style={checkboxStyle}
                            />
                            Yes, Allowed
                        </label>
                    </div>

                    <label>Role</label>
                    <select
                        name="role"
                        value={form.role}
                        onChange={handleChange}
                        style={inputStyle}
                        required
                    >
                        <option value="">Select Role</option>
                        <option value="Admin">Admin</option>
                        <option value="User">User</option>
                        <option value="Guest">Guest</option>
                    </select>

                    <label>Days</label>
                    <input
                        type="number"
                        name="days"
                        value={form.days}
                        onChange={handleChange}
                        style={inputStyle}
                        placeholder="Enter number of days"
                        required
                    />

                    <div style={formActionsStyle}>
                        <button type="submit" style={submitButtonStyle}>
                            {editingModule ? 'Update Module' : 'Create Module'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setForm({ model_name: '', allowed: false, role: '', days: '' });
                                setEditingModule(null);
                            }}
                            style={cancelButtonStyle}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            {/* Right-side module cards */}
            <div style={moduleCardContainer}>
                <h3 style={{ marginBottom: '15px' }}>Created Modules</h3>
                {modules.map((module) => (
                    <div key={module.id} style={moduleCardStyle}>
                        <h4>{module.model_name}</h4>
                        <p><strong>Allowed:</strong> {module.allowed ? 'Yes' : 'No'}</p>
                        <p><strong>Role:</strong> {module.role}</p>
                        <p><strong>Days:</strong> {module.days}</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                            <button onClick={() => handleEdit(module)} style={editButtonStyle}>Edit</button>
                            <button onClick={() => handleDelete(module.id)} style={deleteButtonStyle}>Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 🧾 Layout Container Styles
const pageContainerStyle = {
    display: 'flex',
    gap: '30px',
    alignItems: 'flex-start',
    padding: '30px',
    height: '700px',              // fixed height for layout
    boxSizing: 'border-box',
    overflow: 'hidden',          // prevent outer scroll
};

const formContainerStyle = {
    flex: '1',
    minWidth: '300px',
    maxWidth: '500px',
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
    height: '100%',              // fill vertical space
    boxSizing: 'border-box',
    overflowY: 'auto',           // scroll if content overflows (form side too)
};

const moduleCardContainer = {
    flex: '1',
    minWidth: '300px',
    maxWidth: '900px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    height: '100%',
    overflowY: 'auto',           // scroll the module cards
    paddingRight: '10px',
};

const moduleCardStyle = {
    backgroundColor: '#f9f9f9',
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    flexShrink: 0,
};

const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const inputStyle = {
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '5px',
};

const checkboxWrapperStyle = {
    marginBottom: '10px',
};

const checkboxStyle = {
    marginRight: '10px',
};

const formActionsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '15px',
};

const submitButtonStyle = {
    backgroundColor: '#28a745',
    color: '#fff',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

const cancelButtonStyle = {
    backgroundColor: '#dc3545',
    color: '#fff',
    padding: '10px 16px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

// 🧱 Module Card Styles


const editButtonStyle = {
    marginRight: '10px',
    padding: '6px 12px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
};

const deleteButtonStyle = {
    padding: '6px 12px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
};

export default ModuleForm;
