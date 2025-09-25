import React, { useState, useEffect } from 'react';

const ManageEditModal = ({ isOpen, onClose, rowData, onSave }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (rowData) {
      setFormData({ ...rowData });
    }
  }, [rowData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const renderFormFields = () => {
    if (formData.tableType === 'cover_pwp') {
      return (
        <>
          <label>
            Cover Code:
            <input
              type="text"
              name="cover_code"
              value={formData.cover_code || ''}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Distributor Code:
            <input
              type="text"
              name="distributor_code"
              value={formData.distributor_code || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            Account Type:
            <input
              type="text"
              name="account_type"
              value={formData.account_type || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            Amount Budget:
            <input
              type="number"
              name="amount_budget"
              value={formData.amount_budget || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            PWP Type:
            <input
              type="text"
              name="pwp_type"
              value={formData.pwp_type || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            Objective:
            <textarea
              name="objective"
              value={formData.objective || ''}
              onChange={handleChange}
            />
          </label>
          {/* More fields for 'cover_pwp' */}
        </>
      );
    } else if (formData.tableType === 'regular_pwp') {
      return (
        <>
          <label>
            Regular PWP Code:
            <input
              type="text"
              name="regularpwpcode"
              value={formData.regularpwpcode || ''}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Account Type:
            <input
              type="text"
              name="accountType"
              value={formData.accountType || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            Activity:
            <input
              type="text"
              name="activity"
              value={formData.activity || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            PWP Type:
            <input
              type="text"
              name="pwptype"
              value={formData.pwptype || ''}
              onChange={handleChange}
            />
          </label>
          <label>
            Objective:
            <textarea
              name="objective"
              value={formData.objective || ''}
              onChange={handleChange}
            />
          </label>
          {/* More fields for 'regular_pwp' */}
        </>
      );
    }
  };

  return (
    <div
      style={{
        display: isOpen ? 'block' : 'none',
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: '1000',
        overflow: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          margin: '50px auto',
          padding: '20px',
          maxWidth: '600px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Edit {formData.tableType && formData.tableType.startsWith('R') ? 'Regular' : 'Cover'} PWP</h2>
        <form onSubmit={handleSubmit}>
          {renderFormFields()}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button type="submit" style={{ marginRight: '10px' }}>
              Save
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManageEditModal;
