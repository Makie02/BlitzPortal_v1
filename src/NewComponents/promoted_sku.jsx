import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PromotedSKU = () => {
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: null, code: '', name: '', description: '' });
  const [isEditing, setIsEditing] = useState(false);

  const fetchSKUs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('promoted_sku')
      .select('*')
      .order('code', { ascending: true });
    if (error) {
      alert('Error fetching SKUs: ' + error.message);
    } else {
      setSkus(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSKUs();
  }, []);

  const generateNextCode = () => {
    if (skus.length === 0) return '3001';
    const nums = skus.map(sku => {
      const n = parseInt(sku.code, 10);
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

  const openEditModal = (sku) => {
    setForm({ id: sku.id, code: sku.code, name: sku.name, description: sku.description });
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
        .from('promoted_sku')
        .update({ name: form.name, description: form.description || null })
        .eq('id', form.id);
      if (error) {
        alert('Update error: ' + error.message);
      } else {
        alert('SKU updated successfully!');
        setModalOpen(false);
        fetchSKUs();
      }
    } else {
      const { error } = await supabase
        .from('promoted_sku')
        .insert([{ code: form.code, name: form.name, description: form.description || null }]);
      if (error) {
        alert('Insert error: ' + error.message);
      } else {
        alert('SKU added successfully!');
        setModalOpen(false);
        fetchSKUs();
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this SKU?')) {
      const { error } = await supabase
        .from('promoted_sku')
        .delete()
        .eq('id', id);
      if (error) {
        alert('Delete error: ' + error.message);
      } else {
        alert('SKU deleted!');
        fetchSKUs();
      }
    }
  };

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
      <h2>Promoted SKUs</h2>
      <button onClick={openAddModal} style={addButtonStyle}>+ Add New SKU</button>

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
            {skus.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding:12, textAlign: 'center' }}>No SKUs found.</td>
              </tr>
            ) : skus.map(sku => (
              <tr key={sku.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tdStyle}>{sku.id}</td>
                <td style={tdStyle}>{sku.code}</td>
                <td style={tdStyle}>{sku.name}</td>
                <td style={tdStyle}>{sku.description || '-'}</td>
                <td style={tdStyle}>
                  <button onClick={() => openEditModal(sku)} style={actionBtnStyle}>Edit</button>
                  <button onClick={() => handleDelete(sku.id)} style={{ ...actionBtnStyle, backgroundColor: '#dc3545' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{isEditing ? 'Edit SKU' : 'Add New SKU'}</h3>
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

export default PromotedSKU;
