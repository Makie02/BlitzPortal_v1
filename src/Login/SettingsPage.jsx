
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
const SettingsPage = () => {



    const [notification, setNotification] = useState(null); // New: notification message

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Add log entry helper
    const addLog = (message) => {
        setLogs(prevLogs => [
            { id: Date.now(), message, time: new Date().toLocaleString() },
            ...prevLogs
        ]);
    };
    const toggleSetting = async (key) => {
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
        console.log('Current User data:', currentUser);

        const userCode = currentUser.UserID;
        console.log('Using UserCode:', userCode);

        if (!userCode) {
            console.log('No valid UserCode found');
            return;
        }

        const newValue = !settings[key];

        const updatedSettings = {
            ...settings,
            [key]: newValue,
        };

        setSettings(updatedSettings);
        addLog(`Setting "${key}" changed to ${newValue ? 'Enabled' : 'Disabled'}`);

        if (key === 'approvals') {
            setNotification(`Approvals have been ${newValue ? 'enabled' : 'disabled'}.`);
            setTimeout(() => setNotification(null), 4000);
        }

        try {
            // 1. Check if settings already exist for this user
            const { data: existing, error: selectError } = await supabase
                .from('Account_SecuritySettings')
                .select('"Id"')
                .eq('UserCode', userCode)
                .maybeSingle();

            if (selectError) throw selectError;

            if (existing) {
                // 2. Update if exists
                const { error: updateError } = await supabase
                    .from('Account_SecuritySettings')
                    .update({
                        approvals: updatedSettings.approvals,
                        notifications: updatedSettings.notifications,
                        visaForms: updatedSettings.visaForms,
                        selectedDate: updatedSettings.selectedDate,
                    })
                    .eq('UserCode', userCode);

                if (updateError) throw updateError;
            } else {
                // 3. Get max Id to generate a new unique Id
                const { data: maxIdData, error: maxIdError } = await supabase
                    .from('Account_SecuritySettings')
                    .select('Id')
                    .order('Id', { ascending: false })
                    .limit(1)
                    .single();

                if (maxIdError && maxIdError.code !== 'PGRST116') throw maxIdError;
                // PGRST116 = no rows found, safe to ignore

                const newId = maxIdData ? maxIdData.Id + 1 : 1;

                // 4. Insert new record with generated Id
                const { error: insertError } = await supabase
                    .from('Account_SecuritySettings')
                    .insert({
                        UserCode: userCode,
                        approvals: updatedSettings.approvals,
                        notifications: updatedSettings.notifications,
                        visaForms: updatedSettings.visaForms,
                        selectedDate: updatedSettings.selectedDate,
                        Id: newId,
                    });

                if (insertError) throw insertError;
            }
        } catch (error) {
            console.error('Error saving setting to Supabase:', error.message);
        }
    };






    const handleDateChange = (e) => {
        const newDate = e.target.value;
        setSettings(prev => ({ ...prev, selectedDate: newDate }));
        addLog(`Date selected: ${newDate}`);
    };


    // Fetch per-user audit logs
    const [settings, setSettings] = useState({
        notifications: false,
        approvals: false,
        visaForms: false,
        selectedDate: null,
    });
    const [logs, setLogs] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
                if (!currentUser?.UserID) {
                    console.warn('No logged in user found.');
                    return;
                }
                const userId = currentUser.UserID;

                // Fetch Security Settings
                const { data: securitySettings, error: settingsError } = await supabase
                    .from('Account_SecuritySettings')
                    .select('*')
                    .eq('UserCode', userId) // Use the correct column name (UserCode or userId)
                    .single();

                if (settingsError && settingsError.code !== 'PGRST116') {
                    console.error('Error fetching SecuritySettings:', settingsError.message);
                } else if (securitySettings) {
                    setSettings({
                        notifications: securitySettings.notifications ?? false,
                        approvals: securitySettings.approvals ?? false,
                        visaForms: securitySettings.visaForms ?? false,
                        selectedDate: securitySettings.selectedDate ?? null,
                    });
                }

                // Fetch Audit Logs
                const { data: auditLogs, error: auditError } = await supabase
                    .from('AuditLogs')
                    .select('*')
                    .eq('userId', userId)
                    .order('timestamp', { ascending: false });

                if (auditError) {
                    console.error('Error fetching AuditLogs:', auditError.message);
                } else {
                    setLogs(auditLogs || []);
                }

                // Fetch Recent Activity



            } catch (err) {
                console.error('Unexpected error fetching user data:', err);
            }
        };

        fetchUserData();
    }, []);

    const fetchRecentActivity = async (userId) => {
        if (!userId) {
            console.warn('No userId provided to fetchRecentActivity.');
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('RecentActivity')
                .select('*')
                .eq('userId', userId)
                .order('time', { ascending: false });

            if (error) {
                console.error('Error fetching RecentActivity:', error.message);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Unexpected error fetching RecentActivity:', err);
            return [];
        }
    };

    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
        if (!currentUser?.UserID) return;

        fetchRecentActivity(currentUser.UserID).then(setRecentActivities);
    }, []);

    const [licenseKey, setLicenseKey] = useState('');
    const [licenseNotification, setLicenseNotification] = useState('');
    const [licenseData, setLicenseData] = useState([]);

    useEffect(() => {
        fetchLicenses();
    }, []);

    const fetchLicenses = async () => {
        const { data, error } = await supabase
            .from('subscription_licenses')
            .select('*')
            .order('submitted_at', { ascending: false });

        if (!error) {
            // Save to state
            setLicenseData(data);

            // Save to localStorage
            localStorage.setItem('licenseData', JSON.stringify(data));

            // Log to console
            console.log('Fetched license data:', data);
        } else {
            console.error('Error fetching license data:', error);
        }
    };
    const handleDelete = async (id) => {
        const { error } = await supabase
            .from('subscription_licenses')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting license:', error);
            return;
        }

        // Refresh the data
        fetchLicenses();
    };


    const handleLicenseSubmit = async (e) => {
        e.preventDefault();

        const { error } = await supabase
            .from('subscription_licenses')
            .insert([{ key: licenseKey, submitted_at: new Date() }]);

        if (error) {
            setLicenseNotification('Error submitting license.');
            return;
        }

        setLicenseNotification('License submitted successfully!');
        setLicenseKey('');
        fetchLicenses();
    };

    const handleEditClick = (item) => {
        setEditId(item.id);
        setEditedKey(item.key);
    };

    const cancelEdit = () => {
        setEditId(null);
        setEditedKey('');
    };
    const [editId, setEditId] = useState(null);
    const [editedKey, setEditedKey] = useState('');

    const handleSave = async (id) => {
        const { error } = await supabase
            .from('subscription_licenses')
            .update({ key: editedKey })
            .eq('id', id);

        if (error) {
            setLicenseNotification('Error updating license.');
            return;
        }

        setLicenseNotification('License updated successfully!');
        cancelEdit();
        fetchLicenses();
    };
    const savedUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const isAdmin = savedUser?.role === 'admin';

    return (
        <div style={{ ...styles.page, maxWidth: isMobile ? '90vw' : 1500, padding: isMobile ? 20 : 30 }}>
            <h2 style={styles.header}>Security Settings</h2>
            <p style={styles.description}>These settings help you keep your account secure.</p>
            <div style={{ ...styles.flexContainer, flexDirection: isMobile ? 'column' : 'row' }}>
                {/* Form on the left */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
                    {isAdmin && (
                        <form onSubmit={handleLicenseSubmit} style={{ ...styles.card, flex: 1, marginRight: isMobile ? 0 : 20 }}>
                            <h3 style={styles.subHeader}>Subscription License</h3>
                            <p style={styles.description}>Enter your license key to activate subscription.</p>

                            <input
                                type="text"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                                placeholder="Enter license key"
                                style={{ ...styles.input, marginBottom: 10, width: isMobile ? '100%' : 400 }}
                            />
                            <button type="submit" style={styles.button}>
                                Submit License
                            </button>

                            {licenseNotification && (
                                <div style={styles.notification}>
                                    {licenseNotification}
                                </div>
                            )}
                        </form>
                    )}

                    <div style={{ ...styles.card, flex: 1 }}>
                        <h3 style={styles.subHeader}>Submitted License</h3>
                        {licenseData.map((item) => (
                            <li key={item.id} style={styles.licenseItem} onClick={() => isAdmin && handleEditClick(item)}>
                                {editId === item.id ? (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <input
                                            type="text"
                                            value={editedKey}
                                            onChange={(e) => setEditedKey(e.target.value)}
                                            style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                                        />
                                        <button onClick={() => handleSave(item.id)} style={styles.button}>
                                            Save
                                        </button>
                                        <button onClick={cancelEdit} style={{ ...styles.button, backgroundColor: '#ccc', color: '#000' }}>
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>
                                            <strong>{new Date(item.submitted_at).toLocaleString()}:</strong> {item.key}
                                        </span>
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); // prevent triggering edit mode
                                                    handleDelete(item.id);
                                                }}
                                                style={{ marginLeft: 10, padding: '4px 8px', cursor: 'pointer', backgroundColor: 'red', color: 'white', border: 'none', borderRadius: 4 }}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </div>
                </div>

            </div>


            {/* Notification box */}
            {notification && (
                <div style={styles.notification}>
                    {notification}
                </div>
            )}

            <div style={styles.card}>
                <SettingToggle
                    label="Enable Notifications"
                    checked={settings.notifications}
                    onChange={() => toggleSetting('notifications')}
                    description="Get notified about important updates and alerts."
                />
                <SettingToggle
                    label="Enable Approvals"
                    checked={settings.approvals}
                    onChange={() => toggleSetting('approvals')}
                    description="Turn on approvals for sensitive actions."
                />
                <SettingToggle
                    label="Enable  Forms"
                    checked={settings.visaForms}
                    onChange={() => toggleSetting('visaForms')}
                    description="Manage and submit  forms directly."
                />

                <div style={{ marginTop: 30 }}>
                    <label style={{ ...styles.dateLabel, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center' }}>
                        Select Date:
                        <input
                            type="date"
                            value={settings.selectedDate}
                            onChange={handleDateChange}
                            style={{
                                ...styles.dateInput,
                                marginTop: isMobile ? 8 : 0,
                                marginLeft: isMobile ? 0 : 16,
                                width: isMobile ? '100%' : 'auto'
                            }}
                        />
                    </label>
                </div>
            </div>

            <hr style={styles.divider} />

            <h3 style={styles.subHeader}>Recent Activity</h3>
            <p style={styles.description}>Last activities with your account.</p>

            <div style={{ border: '1px solid #ccc', maxHeight: '300px', overflow: 'hidden' }}>
                <table style={{ ...styles.table, minWidth: 600, borderCollapse: 'collapse', width: '100%' }}>
                    <thead style={{ display: 'table', tableLayout: 'fixed', width: '100%' }}>
                        <tr style={styles.tableHeaderRow}>
                            <th style={{ ...styles.th, width: '20%' }}>Device</th>
                            <th style={{ ...styles.th, width: '20%' }}>Location</th>
                            <th style={{ ...styles.th, width: '20%' }}>IP</th>
                            <th style={{ ...styles.th, width: '20%' }}>Time</th>
                            <th style={{ ...styles.th, width: '20%' }}>Action</th>
                        </tr>
                    </thead>
                </table>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table
                        style={{ ...styles.table, minWidth: 600, borderCollapse: 'collapse', width: '100%' }}
                    >
                        <tbody style={{ display: 'block', width: '100%' }}>
                            {recentActivities.length === 0 ? (
                                <tr style={{ display: 'table', width: '100%' }}>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                                        No recent activity recorded.
                                    </td>
                                </tr>
                            ) : (
                                recentActivities
                                    .sort((a, b) => new Date(b.time) - new Date(a.time)) // use lowercase 'time' from DB
                                    .map((activity, i) => (
                                        <tr
                                            key={i}
                                            style={{
                                                ...((i % 2 === 0) ? styles.evenRow : styles.oddRow),
                                                display: 'table',
                                                tableLayout: 'fixed',
                                                width: '100%',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e6f0ff')}
                                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#f9f9f9' : '#fff')}
                                        >
                                            <td
                                                style={{
                                                    ...styles.td,
                                                    maxWidth: '350px',
                                                    overflowX: 'auto',
                                                    whiteSpace: 'nowrap',
                                                    display: 'block',
                                                    scrollbarWidth: 'none',
                                                    msOverflowStyle: 'none',
                                                }}
                                                title={activity.device}
                                            >
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <div
                                                        style={{
                                                            overflowX: 'auto',
                                                            whiteSpace: 'nowrap',
                                                            scrollbarWidth: 'none',
                                                            msOverflowStyle: 'none',
                                                        }}
                                                    >
                                                        <span style={{ display: 'inline-block', minWidth: '100%' }}>
                                                            {activity.device}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ ...styles.td, width: '20%' }}>{activity.location}</td>
                                            <td style={{ ...styles.td, width: '20%' }}>{activity.ip}</td>
                                            <td style={{ ...styles.td, width: '20%' }}>
                                                {new Date(activity.time).toLocaleString()}
                                            </td>
                                            <td style={{ ...styles.td, width: '20%' }}>{activity.action}</td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


            <hr style={styles.divider} />

            {/* New Logs section */}
            <h3 style={styles.subHeader}>User Logs</h3>
            {logs.length === 0 ? (
                <p style={styles.description}>No logs recorded yet.</p>
            ) : (
                <ul style={styles.logList}>
                    {logs.map(log => (
                        <li key={log.id}>
                            <strong>{new Date(log.created_at).toLocaleString()}:</strong> {log.action}
                        </li>
                    ))}
                </ul>

            )}

        </div>
    );
};

const SettingToggle = ({ label, checked, onChange, description }) => (
    <div style={styles.settingItem}>
        <label style={styles.toggleLabel}>
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                style={styles.toggleInput}
            />
            <span style={{ ...styles.toggleSlider, ...(checked ? styles.toggleSliderActive : {}) }} />
            {label}
        </label>
        <p style={styles.subtext}>{description}</p>
    </div>
);

const styles = {
    page: {
        margin: '40px auto',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        backgroundColor: '#fff',
        borderRadius: 14,
        boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
        color: '#222',
    },
    header: {
        fontSize: 28,
        marginBottom: 8,
        fontWeight: '700',
    },
    subHeader: {
        fontSize: 22,
        marginBottom: 8,
        fontWeight: '600',
    },
    description: {
        color: '#666',
        fontSize: 16,
        marginBottom: 28,
    },
    card: {
        backgroundColor: '#f7faff',
        borderRadius: 12,
        padding: 30,
        boxShadow: 'inset 0 0 8px #d6e4ff',
    },
    settingItem: {
        marginBottom: 28,
    },
    toggleLabel: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        fontSize: 20,
        fontWeight: '600',
        gap: 16,
        userSelect: 'none',
    },
    toggleInput: {
        opacity: 0,
        width: 0,
        height: 0,
    },
    toggleSlider: {
        position: 'relative',
        width: 52,
        height: 28,
        backgroundColor: '#ccc',
        borderRadius: 28,
        transition: '0.4s',
        flexShrink: 0,
    },
    toggleSliderActive: {
        backgroundColor: '#1877f2',
    },
    subtext: {
        marginLeft: 68,
        marginTop: 6,
        color: '#444',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 1.3,
    },
    dateLabel: {
        fontSize: 20,
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
    },
    dateInput: {
        padding: '6px 12px',
        fontSize: 16,
        borderRadius: 8,
        border: '1.8px solid #ccc',
        outline: 'none',
        transition: 'border-color 0.3s',
    },
    divider: {
        margin: '40px 0',
        border: 'none',
        borderTop: '2px solid #eee',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 16,
        color: '#333',
    },
    tableHeaderRow: {
        backgroundColor: '#e9f0ff',
    },
    th: {
        textAlign: 'left',
        padding: '12px 10px',
        borderBottom: '3px solid #1877f2',
        fontWeight: '600',
        color: '#1877f2',
    },
    td: {
        padding: '14px 10px',
        borderBottom: '1px solid #eee',
    },
    evenRow: {
        backgroundColor: '#f9f9f9',
        transition: 'background-color 0.3s',
    },
    oddRow: {
        backgroundColor: '#fff',
        transition: 'background-color 0.3s',
    },
    notification: {
        backgroundColor: '#e6f0ff',
        border: '1.5px solid #1877f2',
        color: '#1877f2',
        padding: '12px 20px',
        borderRadius: 10,
        marginBottom: 24,
        fontWeight: '600',
        fontSize: 16,
    },
    logList: {
        listStyle: 'none',
        paddingLeft: 0,
        maxHeight: 200,
        overflowY: 'auto',
        border: '1px solid #ddd',
        borderRadius: 8,
        backgroundColor: '#fafafa',
    },
    logItem: {
        padding: '10px 16px',
        borderBottom: '1px solid #eee',
        fontSize: 14,
        color: '#555',
    },

    subHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    description: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    input: {
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        fontSize: '16px',
        width: '100%',
        boxSizing: 'border-box',
    },
    button: {
        padding: '10px 20px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        marginTop: 10,
    },
    notification: {
        marginTop: 10,
        padding: 10,
        backgroundColor: '#e6f7ff',
        border: '1px solid #91d5ff',
        borderRadius: 5,
        color: '#0050b3',
    },
    flexContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        width: '100%',
        maxWidth: 1500,
        marginBottom: 30,
    },
    licenseList: {
        listStyleType: 'none',
        paddingLeft: 0,
        maxHeight: 300,
        overflowY: 'auto',
    },
    licenseItem: {
        padding: '8px 0',
        borderBottom: '1px solid #eee',
        fontSize: 14,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        ':hover': {
            backgroundColor: '#f0f8ff',
        },
    },


};

export default SettingsPage;
