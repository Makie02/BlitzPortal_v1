import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

const ApprovalSettings = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        const { data, error } = await supabase
            .from('approval_settings')
            .select('*')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // ignore “no rows found” error if any
            Swal.fire('Error', error.message, 'error');
        } else {
            setSettings(data); // data may be null if none exists
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleToggle = async (field) => {
        // Toggle the value based on current settings or default false
        const updatedValue = !(settings ? settings[field] : false);

        if (settings) {
            // Update existing record
            const { error } = await supabase
                .from('approval_settings')
                .update({ [field]: updatedValue })
                .eq('id', settings.id);

            if (error) {
                Swal.fire('Update Failed', error.message, 'error');
            } else {
                setSettings(prev => ({ ...prev, [field]: updatedValue }));
                Swal.fire('Success', `${field.replace('_', ' ')} updated`, 'success');
            }
        } else {
            // Create new record
            const newRecord = {
                single_approval: false,
                multiple_approval: false,
                [field]: updatedValue
            };

            const { data, error } = await supabase
                .from('approval_settings')
                .insert(newRecord)
                .select()
                .single();

            if (error) {
                Swal.fire('Creation Failed', error.message, 'error');
            } else {
                setSettings(data);
                Swal.fire('Success', 'Settings created', 'success');
            }
        }
    };

    if (loading) return <p style={{ padding: 20 }}>Loading approval settings...</p>;

    return (
        <div style={containerStyle}>
            <h2>Approval Settings</h2>
            <div style={settingsBox}>
             
                <ToggleSwitch
                    label="Single Approval"
                    checked={settings ? settings.single_approval : false}
                    onChange={() => handleToggle('single_approval')}
                />
                <ToggleSwitch
                    label="Multiple Approval"
                    checked={settings ? settings.multiple_approval : false}
                    onChange={() => handleToggle('multiple_approval')}
                />
            </div>
        </div>
    );
};

const ToggleSwitch = ({ label, checked, onChange }) => (
    <div style={toggleWrapper}>
        <label style={labelStyle}>{label}</label>
        <input
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
    backgroundColor: '#fdfdfdff',
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
    border: '1px solid #ddd'
};

const labelStyle = {
    fontSize: '16px',
    fontWeight: '500'
};

const checkboxStyle = {
    width: '20px',
    height: '20px',
    cursor: 'pointer'
};

export default ApprovalSettings;
