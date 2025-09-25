import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../supabaseClient'; // Make sure you import the supabase client

const ModuleForm = () => {
    const [form, setForm] = useState({
        model_name: '',
        allowed: false,
        role: '',
        days: '',
    });

    // State to hold the created modules
    const [modules, setModules] = useState([]);
    const [editingModule, setEditingModule] = useState(null); // Track the module being edited

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    // Fetch modules from Supabase
    const fetchModules = async () => {
        try {
            const { data, error } = await supabase.from('modules').select('*');

            if (error) {
                console.error('Error fetching modules:', error);
                return;
            }
            setModules(data || []);  // Set modules data or empty array if none
        } catch (error) {
            console.error('Error fetching modules:', error.message);
        }
    };

    // Call the fetchModules function when the component is mounted
    useEffect(() => {
        fetchModules();
    }, []);

    // Handle form submission (Create/Update)
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!form.model_name.trim() || !form.role || !form.days) {
            Swal.fire('Validation Error', 'All fields are required!', 'warning');
            return;
        }

        try {
            let data, error;

            if (editingModule) {
                // If editing, update the module
                const { data: updatedData, error: updateError } = await supabase
                    .from('modules')
                    .update({
                        model_name: form.model_name,
                        allowed: form.allowed,
                        role: form.role,
                        days: parseInt(form.days),
                    })
                    .eq('id', editingModule.id); // Update based on the module's id

                data = updatedData;
                error = updateError;
            } else {
                // If creating a new module
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
                setForm({
                    model_name: '',
                    allowed: false,
                    role: '',
                    days: '',
                });
                setEditingModule(null); // Reset editing state
                fetchModules(); // Refresh the module list
            }
        } catch (error) {
            Swal.fire('Error', 'Error: ' + error.message, 'error');
        }
    };

    // Handle editing a module
    const handleEdit = (module) => {
        setEditingModule(module);
        setForm({
            model_name: module.model_name,
            allowed: module.allowed,
            role: module.role,
            days: module.days.toString(),
        });
    };

    // Handle deleting a module
    const handleDelete = async (id) => {
        try {
            const { error } = await supabase
                .from('modules')
                .delete()
                .eq('id', id);

            if (error) {
                Swal.fire('Error', 'Error deleting module: ' + error.message, 'error');
            } else {
                Swal.fire('Success', 'Module deleted successfully!', 'success');
                fetchModules(); // Refresh the module list
            }
        } catch (error) {
            Swal.fire('Error', 'Error: ' + error.message, 'error');
        }
    };

    return (
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
                        onClick={() => setForm({ model_name: '', allowed: false, role: '', days: '' })}
                        style={cancelButtonStyle}
                    >
                        Cancel
                    </button>
                </div>
            </form>

            {/* Display Created Modules in Table */}
            {modules.length > 0 && (
                <div style={tableContainerStyle}>
                    <h3>Created Modules</h3>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Model Name</th>
                                <th style={thStyle}>Allowed</th>
                                <th style={thStyle}>Role</th>
                                <th style={thStyle}>Days</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {modules.map((module, index) => (
                                <tr key={index}>
                                    <td style={tdStyle}>{module.model_name}</td>
                                    <td style={tdStyle}>{module.allowed ? 'Yes' : 'No'}</td>
                                    <td style={tdStyle}>{module.role}</td>
                                    <td style={tdStyle}>{module.days}</td>
                                    <td style={tdStyle}>
                                        <button
                                            onClick={() => handleEdit(module)}
                                            style={editButtonStyle}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(module.id)}
                                            style={deleteButtonStyle}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// Styles
const formContainerStyle = {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
};

const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
};

const inputStyle = {
    padding: '10px',
    marginBottom: '12px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '14px',
};

const checkboxWrapperStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '15px',
};

const checkboxStyle = {
    marginRight: '10px',
};

const formActionsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
};

const submitButtonStyle = {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

const cancelButtonStyle = {
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

// Table Styles
const tableContainerStyle = {
    marginTop: '30px',
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
};

const thStyle = {
    padding: '12px',
    backgroundColor: '#f4f4f4',
    textAlign: 'left',
    border: '1px solid #ddd',
};

const tdStyle = {
    padding: '12px',
    textAlign: 'left',
    border: '1px solid #ddd',
};

const editButtonStyle = {
    padding: '5px 10px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginRight: '5px',
};

const deleteButtonStyle = {
    padding: '5px 10px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

export default ModuleForm;
