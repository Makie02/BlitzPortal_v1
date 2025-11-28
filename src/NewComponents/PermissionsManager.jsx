import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PERMISSION_COLUMNS = [
  'distributor',
  'distributor_listing',
  'module',
  'activity',
  'department',
  'user_role',
  'salesgroup',
  'position',
  'listing_activity',
  'category',
  'category_list_skus',
  'approval_setting',
  'budget_view',
  'page_404',
  'claims_listing_activity',
  'license',
  'customer_group',
  'monther_account',
  'sub_mother_account',
  'branch_listing',
  'sub_3rd_mother_account',
  'userList',
  'masterDataBranch',
  'Bp_Account',
  'MotherAccount2',
  'Year'
];

const PermissionsManager = () => {
  const [permissionsList, setPermissionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newPermissions, setNewPermissions] = useState({});
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  async function fetchPermissions() {
    setLoading(true);
    const { data, error } = await supabase.from('modules_permissions').select('*');
    if (error) {
      console.error('Fetch error:', error.message);
    } else {
      setPermissionsList(data);
    }
    setLoading(false);
  }

  function openModal(permission = null) {
    if (permission) {
      // Editing
      const existingPermissions = PERMISSION_COLUMNS.reduce((acc, col) => {
        acc[col] = !!permission[col];
        return acc;
      }, {});
      setNewPermissions(existingPermissions);
      setNewName(permission.name || '');
      setEditingId(permission.id);
    } else {
      // New
      const defaultPerms = PERMISSION_COLUMNS.reduce((acc, col) => {
        acc[col] = false;
        return acc;
      }, {});
      setNewPermissions(defaultPerms);
      setNewName('');
      setEditingId(null);
    }
    setModalOpen(true);
  }

  function toggleNewPermission(col) {
    setNewPermissions((prev) => ({
      ...prev,
      [col]: !prev[col],
    }));
  }

  async function savePermissions() {
    setSaving(true);
    const insertData = {
      name: newName || null,
      ...newPermissions,
    };

    let error;

    if (editingId) {
      // Update
      ({ error } = await supabase
        .from('modules_permissions')
        .update(insertData)
        .eq('id', editingId));
    } else {
      // Insert
      ({ error } = await supabase
        .from('modules_permissions')
        .insert([insertData]));
    }

    if (error) {
      console.error('Save error:', error.message);
    } else {
      setModalOpen(false);
      fetchPermissions();
    }

    setSaving(false);
  }

  async function deletePermission(id) {
    if (!window.confirm('Are you sure you want to delete this permission row?')) return;

    const { error } = await supabase.from('modules_permissions').delete().eq('id', id);

    if (error) {
      console.error('Delete error:', error.message);
    } else {
      fetchPermissions();
    }
  }

  if (loading) return <p className="text-center mt-4">Loading...</p>;

  return (
    <div className="container-fluid my-5">

      <h1 className="text-center mb-4 text-primary">Reference Permissions </h1>

      <div className="text-end mb-3">
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Add New Row
        </button>
      </div>

      <div className="table-responsive">
        <table
          className="table table-bordered table-striped table-hover align-middle w-100 text-nowrap"
          style={{
            minWidth: '100%',
            fontSize: '0.9rem',
          }}
        >
          <thead
            className="table-primary text-white"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              backgroundColor: '#0d6efd',
            }}
          >
            <tr>
              <th style={{ minWidth: '60px' }}>ID</th>
              <th style={{ minWidth: '100px' }}>Code</th>
              <th style={{ minWidth: '160px' }}>Name</th>
              {PERMISSION_COLUMNS.map((col) => (
                <th
                  key={col}
                  style={{
                    minWidth: '140px',
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
              <th style={{ minWidth: '140px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {permissionsList.map((perm) => (
              <tr key={perm.id}>
                <td>{perm.id}</td>
                <td>{perm.code}</td>
                <td>{perm.name || '-'}</td>
                {PERMISSION_COLUMNS.map((col) => (
                  <td key={col} className="text-center">
                    <input type="checkbox" checked={perm[col]} readOnly disabled />
                  </td>
                ))}
                <td className="text-center">
                  <button
                    className="btn btn-sm btn-warning me-2"
                    onClick={() => openModal(perm)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => deletePermission(perm.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
     {modalOpen && (
  <div
    className="modal fade show d-block"
    tabIndex="-1"
    role="dialog"
    style={{
      backgroundColor: 'rgba(0,0,0,0.5)',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1050,
    }}
  >
    <div
      className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
      role="document"
    >
      <div className="modal-content">
        <div className="modal-header bg-primary text-white">
          <h5 className="modal-title">
            {editingId ? 'Edit Permission Row' : 'Create New Permission Row'}
          </h5>
          <button
            type="button"
            className="btn-close"
            onClick={() => setModalOpen(false)}
            disabled={saving}
          />
        </div>
        <div className="modal-body">
          <div className="mb-4">
            <label className="form-label">Name</label>
            <input
              type="text"
              className="form-control"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={saving}
              placeholder="Enter name for this permission row"
            />
          </div>
          <div className="row">
            {PERMISSION_COLUMNS.map((col) => (
              <div
                key={col}
                className="col-md-4 mb-3 d-flex align-items-center justify-content-between"
              >
                <label className="form-label mb-0 me-3">
                  {col.replace(/_/g, ' ')}
                </label>
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={newPermissions[col] || false}
                  onChange={() => toggleNewPermission(col)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setModalOpen(false)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={savePermissions}
            disabled={saving}
          >
            {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default PermissionsManager;
