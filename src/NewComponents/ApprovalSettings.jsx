import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

const ApprovalSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Approval Settings fetch/update/create (your existing logic)
  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('approval_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      Swal.fire('Error', error.message, 'error');
    } else {
      setSettings(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async (field) => {
    const updatedValue = !(settings ? settings[field] : false);
    if (settings) {
      const { error } = await supabase
        .from('approval_settings')
        .update({ [field]: updatedValue })
        .eq('id', settings.id);

      if (error) {
        Swal.fire('Update Failed', error.message, 'error');
      } else {
        setSettings((prev) => ({ ...prev, [field]: updatedValue }));
        Swal.fire('Success', `${field.replace('_', ' ')} updated`, 'success');
      }
    }
  };

  const handleCreate = async () => {
    const newRecord = {
      single_approval: false,
      multiple_approval: false,
    };

    const { data, error } = await supabase
      .from('approval_settings')
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      Swal.fire('Creation Failed', error.message, 'error');
    } else {
      setSettings(data);
      Swal.fire('Success', 'Approval settings created', 'success');
    }
  };

  // --- Mapping Category Claims logic ---

  const [mappingForm, setMappingForm] = useState({
    category: false,
    subcategory: false,
  });
  const [mappingList, setMappingList] = useState([]);
  const [editMappingId, setEditMappingId] = useState(null);
  const [editMappingForm, setEditMappingForm] = useState({
    category: false,
    subcategory: false,
  });

  // Fetch mappings on mount and after updates
  const fetchMappings = async () => {
    const { data, error } = await supabase
      .from('mapping_category_claims')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      setMappingList(data);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  // Insert new mapping
  const handleAddMapping = async (e) => {
    e.preventDefault();

    const { error } = await supabase
      .from('mapping_category_claims')
      .insert([
        {
          category: mappingForm.category,
          subcategory: mappingForm.subcategory,
        },
      ]);

    if (!error) {
      setMappingForm({ category: false, subcategory: false });
      fetchMappings();
    } else {
      Swal.fire('Insert Failed', error.message, 'error');
    }
  };

  // Start editing a mapping
  const handleEditClick = (mapping) => {
    setEditMappingId(mapping.id);
    setEditMappingForm({
      category: mapping.category,
      subcategory: mapping.subcategory,
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditMappingId(null);
  };

  // Save edited mapping
  const handleSaveEdit = async (id) => {
    const { error } = await supabase
      .from('mapping_category_claims')
      .update({
        category: editMappingForm.category,
        subcategory: editMappingForm.subcategory,
      })
      .eq('id', id);

    if (!error) {
      setEditMappingId(null);
      fetchMappings();
      Swal.fire('Success', 'Mapping updated', 'success');
    } else {
      Swal.fire('Update Failed', error.message, 'error');
    }
  };

  // Delete a mapping
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This will delete the mapping permanently.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
    });

    if (result.isConfirmed) {
      const { error } = await supabase
        .from('mapping_category_claims')
        .delete()
        .eq('id', id);

      if (!error) {
        fetchMappings();
        Swal.fire('Deleted!', 'Mapping has been deleted.', 'success');
      } else {
        Swal.fire('Delete Failed', error.message, 'error');
      }
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading approval settings...</p>;

  return (
    <div style={containerStyle}>
      <h2>Approval Settings</h2>

      {settings ? (
        <div style={settingsBox}>
          <ToggleSwitch
            id="single_approval"
            label="Single Approval"
            checked={settings.single_approval}
            onChange={() => handleToggle('single_approval')}
          />
          <ToggleSwitch
            id="multiple_approval"
            label="Multiple Approval"
            checked={settings.multiple_approval}
            onChange={() => handleToggle('multiple_approval')}
          />
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <p>No approval settings found.</p>
          <button onClick={handleCreate} style={buttonStyle}>
            Add Approval Setting
          </button>
        </div>
      )}

      <h2 style={{ marginTop: '40px' }}>Mapping Category Claims</h2>

      <form onSubmit={handleAddMapping} style={mappingFormStyle}>
        <ToggleSwitch
          id="new_mapping_category"
          label="Category"
          checked={mappingForm.category}
          onChange={() =>
            setMappingForm((prev) => ({ ...prev, category: !prev.category }))
          }
        />

        <ToggleSwitch
          id="new_mapping_subcategory"
          label="Subcategory"
          checked={mappingForm.subcategory}
          onChange={() =>
            setMappingForm((prev) => ({ ...prev, subcategory: !prev.subcategory }))
          }
        />

        <button type="submit" style={{ ...buttonStyle, marginTop: 10 }}>
          Add Mapping
        </button>
      </form>

      <ul style={{ marginTop: '16px', padding: 0, listStyle: 'none' }}>
        {mappingList.map((item) => (
          <li key={item.id} style={mappingItemStyle}>
            {editMappingId === item.id ? (
              <>
                <ToggleSwitch
                  id={`edit_mapping_category_${item.id}`}
                  label="Category"
                  checked={editMappingForm.category}
                  onChange={() =>
                    setEditMappingForm((prev) => ({
                      ...prev,
                      category: !prev.category,
                    }))
                  }
                />
                <ToggleSwitch
                  id={`edit_mapping_subcategory_${item.id}`}
                  label="Subcategory"
                  checked={editMappingForm.subcategory}
                  onChange={() =>
                    setEditMappingForm((prev) => ({
                      ...prev,
                      subcategory: !prev.subcategory,
                    }))
                  }
                />
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => handleSaveEdit(item.id)}
                    style={{ ...buttonStyle, marginRight: 8 }}
                  >
                    Save
                  </button>
                  <button onClick={handleCancelEdit} style={cancelButtonStyle}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <span>
                  Category: <b>{item.category ? 'Yes' : 'No'}</b> | Subcategory:{' '}
                  <b>{item.subcategory ? 'Yes' : 'No'}</b>
                </span>
                <div>
                  <button
                    onClick={() => handleEditClick(item)}
                    style={{ ...smallButtonStyle, marginRight: 8 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={deleteButtonStyle}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const ToggleSwitch = ({ id, label, checked, onChange }) => (
  <div style={toggleWrapper}>
    <label htmlFor={id} style={labelStyle}>
      {label}
    </label>
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={checkboxStyle}
    />
  </div>
);

// Styles
const containerStyle = {
  padding: '20px',
  maxWidth: 600,
  margin: '0 auto',
  backgroundColor: '#fdfdfd',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
};

const settingsBox = {
  marginTop: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const toggleWrapper = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: '12px 16px',
    borderRadius: '6px',
    border: '1px solid #ddd',
};

const labelStyle = {
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
};

const checkboxStyle = {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    margin: 0,
    padding: 0,
};

const buttonStyle = {
    padding: '10px 20px',
    backgroundColor: '#2575fc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
};

const mappingFormStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '20px',
    backgroundColor: '#f9f9f9',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #ddd',
};

const mappingItemStyle = {
    padding: '8px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #eee',
    marginBottom: '8px',
};
const smallButtonStyle = {
  padding: '6px 12px',
  backgroundColor: '#3498db',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  fontSize: '14px',
  cursor: 'pointer',
};

const cancelButtonStyle = {
  ...smallButtonStyle,
  backgroundColor: '#bdc3c7',
};

const deleteButtonStyle = {
  ...smallButtonStyle,
  backgroundColor: '#e74c3c',
};

export default ApprovalSettings;
