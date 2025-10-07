import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const Department = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: null, code: '', name: '', description: '' });
  const [isEditing, setIsEditing] = useState(false);

  // Fetch all departments
  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('department')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      alert('Error fetching departments: ' + error.message);
    } else {
      setDepartments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Generate next code starting from 5000
  const generateNextCode = () => {
    if (departments.length === 0) return '5000';

    const codes = departments
      .map(d => parseInt(d.code))
      .filter(num => !isNaN(num));

    const maxCode = codes.length > 0 ? Math.max(...codes) : 4999;
    const nextCodeNumber = maxCode + 1;

    return nextCodeNumber.toString();
  };

  const openAddModal = () => {
    setForm({ id: null, code: generateNextCode(), name: '', description: '' });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEditModal = (department) => {
    setForm({
      id: department.id,
      code: department.code,
      name: department.name,
      description: department.description || ''
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
        .from('department')
        .update({ name: form.name, description: form.description || null })
        .eq('id', form.id);

      if (error) {
        alert('Update error: ' + error.message);
      } else {
        alert('Department updated successfully!');
        setModalOpen(false);
        fetchDepartments();
      }
    } else {
      const { error } = await supabase
        .from('department')
        .insert([{ code: form.code, name: form.name, description: form.description || null }]);

      if (error) {
        alert('Insert error: ' + error.message);
      } else {
        alert('Department added successfully!');
        setModalOpen(false);
        fetchDepartments();
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      const { error } = await supabase
        .from('department')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Delete error: ' + error.message);
      } else {
        alert('Department deleted!');
        fetchDepartments();
      }
    }
  };

  // Styles like your Activity/Distributor style
  const containerStyle = {
    padding: '20px',
    maxWidth: 1200,
    margin: '0 auto',
    backgroundColor: '#fdfdfd',
    borderRadius: '12px',
  };
  const addButtonStyle = {
    marginBottom: '20px',
    padding: '10px 16px',
    backgroundColor: '#6387eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  };
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '600px',
  };
  const thStyle = {
    padding: '12px',
    textAlign: 'left',
    backgroundColor: '#0062ff',
    color: 'white',
  };
  const tdStyle = {
    padding: '12px',
  };
  const actionBtnStyle = {
    marginRight: '8px',
    padding: '6px 12px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    backgroundColor: '#007bff',
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
  };
  const modalContentStyle = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  };
  const inputStyle = {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    marginTop: '4px',
  };

  return (
    <div style={containerStyle}>
      <h2>Departments</h2>
      <button onClick={openAddModal} style={addButtonStyle}>+ Add New Department</button>

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
            {departments.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: 12, textAlign: 'center' }}>No departments found.</td>
              </tr>
            ) : departments.map(dept => (
              <tr key={dept.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tdStyle}>{dept.id}</td>
                <td style={tdStyle}>{dept.code}</td>
                <td style={tdStyle}>{dept.name}</td>
                <td style={tdStyle}>{dept.description || '-'}</td>
                <td style={tdStyle}>
                  <button onClick={() => openEditModal(dept)} style={actionBtnStyle}>Edit</button>
                  <button
                    onClick={() => handleDelete(dept.id)}
                    style={{ ...actionBtnStyle, backgroundColor: '#dc3545' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{isEditing ? 'Edit Department' : 'Add New Department'}</h3>
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

export default Department;
