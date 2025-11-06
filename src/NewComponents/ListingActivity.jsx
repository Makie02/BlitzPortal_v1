import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ListingActivity() {
  const [activities, setActivities] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const exclusiveFields = ['accounts', 'amount_display', 'sku'];
  const accountTypeFields = ['mother1', 'VariousAccount', 'MotherAccount2'];
  const otherFields = [
    'branch',
    'category',
    'claims',
    'distributor',
    'regular',
    'various',
    'walk_in'
  ];

  const fetchData = async () => {
    setLoading(true);
    const { data: activityData, error: activityError } = await supabase
      .from('activity')
      .select('*')
      .order('id');

    if (activityError) {
      alert('Error loading activities: ' + activityError.message);
      setLoading(false);
      return;
    }

    const { data: settingsData, error: settingsError } = await supabase
      .from('activity_settings')
      .select('*');

    if (settingsError) {
      alert('Error loading activity settings: ' + settingsError.message);
      setLoading(false);
      return;
    }

    const settingsMap = {};
    settingsData.forEach(s => {
      settingsMap[s.activity_code] = s;
    });

    setActivities(activityData);
    setSettings(settingsMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSetting = async (activityCode, field) => {
    setUpdating(true);
    const currentSetting = settings[activityCode] || {};
    const newValue = !currentSetting[field];

    if (!currentSetting.id) {
      const newSetting = { activity_code: activityCode, [field]: newValue };
      const { error } = await supabase.from('activity_settings').insert([newSetting]);

      if (error) {
        alert('Error inserting setting: ' + error.message);
        setUpdating(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('activity_settings')
        .update({ [field]: newValue })
        .eq('id', currentSetting.id);

      if (error) {
        alert('Error updating setting: ' + error.message);
        setUpdating(false);
        return;
      }
    }

    await fetchData();
    setUpdating(false);
  };

  const resetExclusiveSettings = async (activityCode, fieldType) => {
    setUpdating(true);
    const currentSetting = settings[activityCode];
    if (!currentSetting || !currentSetting.id) {
      setUpdating(false);
      return;
    }

    const updates = {};
    const fieldsToReset = fieldType === 'exclusive' ? exclusiveFields : accountTypeFields;
    
    fieldsToReset.forEach(f => {
      updates[f] = false;
    });

    const { error } = await supabase
      .from('activity_settings')
      .update(updates)
      .eq('id', currentSetting.id);

    if (error) {
      alert('Error resetting settings: ' + error.message);
    }

    await fetchData();
    setUpdating(false);
  };

  const isOtherExclusiveChecked = (setting, currentField, fieldGroup) => {
    return fieldGroup.some(
      (field) => field !== currentField && setting[field]
    );
  };

  const handleExclusiveCheckboxClick = async (activityCode, field, isDisabled, fieldType) => {
    if (isDisabled) {
      await resetExclusiveSettings(activityCode, fieldType);
      await toggleSetting(activityCode, field);
    } else {
      await toggleSetting(activityCode, field);
    }
  };

  const getFieldLabel = (field) => {
    const labels = {
      'accounts': 'Accounts',
      'amount_display': 'Amount Display',
      'sku': 'SKU',
      'mother1': 'Mother 1',
      'VariousAccount': 'Various Account',
      'MotherAccount2': 'Mother Account 2',
      'branch': 'Branch',
      'category': 'Category',
      'claims': 'Claims',
      'distributor': 'Distributor',
      'regular': 'Regular',
      'various': 'Various',
      'walk_in': 'Walk In'
    };
    return labels[field] || field.replace('_', ' ');
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh',  padding: '24px' }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        {/* Header Card */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '24px', 
          marginBottom: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1a202c', margin: '0 0 8px 0' }}>
                Activity Settings Manager
              </h1>
              <p style={{ fontSize: '14px', color: '#718096', margin: 0 }}>
                Configure activity settings and permissions
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading || updating}
              style={{
                padding: '10px 20px',
                background: loading || updating ? '#cbd5e0' : 'linear-gradient(135deg, #0027d6ff 0%, #4b95a2ff 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || updating ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s'
              }}
            >
              {loading || updating ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Main Table Card */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '4px solid #e2e8f0',
                borderTopColor: '#667eea',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ 
                width: 'max-content', 
                minWidth: '100%', 
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #4b78a2ff 100%)' }}>
                    <th style={{
                      position: 'sticky',
                      left: 0,
                      background: 'linear-gradient(135deg, #667eea 0%, #0d4dadff 100%)',
                      color: 'white',
                      padding: '16px 20px',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: '700',
                      minWidth: '200px',
                      zIndex: 3,
                      boxShadow: '2px 0 5px rgba(0,0,0,0.1)'
                    }}>
                      ACTIVITY NAME
                    </th>
                    
                    {/* Exclusive Group Header */}
                    <th colSpan={exclusiveFields.length} style={{
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        padding: '8px',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.3)'
                      }}>
                        <div style={{ color: 'white', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
                          📊 EXCLUSIVE GROUP
                        </div>
                      </div>
                    </th>

                    {/* Account Type Group Header */}
                    <th colSpan={accountTypeFields.length} style={{
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        padding: '8px',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.3)'
                      }}>
                        <div style={{ color: 'white', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
                          👥 ACCOUNT TYPE
                        </div>
                      </div>
                    </th>

                    {/* Other Settings Header */}
                    <th colSpan={otherFields.length} style={{
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        padding: '8px',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.3)'
                      }}>
                        <div style={{ color: 'white', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
                          ⚙️ OTHER SETTINGS
                        </div>
                      </div>
                    </th>
                  </tr>
                  
                  {/* Sub headers */}
                  <tr style={{ background: '#f7fafc' }}>
                    <th style={{
                      position: 'sticky',
                      left: 0,
                      background: '#f7fafc',
                      padding: '0',
                      zIndex: 2
                    }}></th>
                    
                    {exclusiveFields.map((field) => (
                      <th key={field} style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#4a5568',
                        borderRight: '1px solid #e2e8f0',
                        minWidth: '120px'
                      }}>
                        {getFieldLabel(field)}
                      </th>
                    ))}

                    {accountTypeFields.map((field) => (
                      <th key={field} style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#4a5568',
                        borderRight: '1px solid #e2e8f0',
                        minWidth: '140px',
                        background: '#fef5e7'
                      }}>
                        {getFieldLabel(field)}
                      </th>
                    ))}

                    {otherFields.map((field) => (
                      <th key={field} style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#4a5568',
                        borderRight: '1px solid #e2e8f0',
                        minWidth: '110px'
                      }}>
                        {getFieldLabel(field)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {activities.map((activity, idx) => {
                    const setting = settings[activity.code] || {};
                    return (
                      <tr 
                        key={activity.code}
                        style={{
                          background: idx % 2 === 0 ? 'white' : '#f7fafc',
                          transition: 'all 0.2s',
                          borderBottom: '1px solid #e2e8f0'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#edf2f7'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#f7fafc'}
                      >
                        <td style={{
                          position: 'sticky',
                          left: 0,
                          background: 'inherit',
                          padding: '16px 20px',
                          fontWeight: '600',
                          color: '#2d3748',
                          fontSize: '14px',
                          zIndex: 1,
                          boxShadow: '2px 0 5px rgba(0,0,0,0.05)'
                        }}>
                          {activity.name}
                        </td>

                        {/* Exclusive Fields */}
                        {exclusiveFields.map((field) => {
                          const disableCheckbox = isOtherExclusiveChecked(setting, field, exclusiveFields);
                          return (
                            <td key={field} style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                              <div style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                position: 'relative'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={!!setting[field]}
                                  onChange={() => handleExclusiveCheckboxClick(activity.code, field, disableCheckbox, 'exclusive')}
                                  disabled={updating}
                                  title={disableCheckbox ? 'Click to select this option (will deselect others)' : ''}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    cursor: updating ? 'not-allowed' : 'pointer',
                                    accentColor: '#667eea',
                                    transform: 'scale(1.2)'
                                  }}
                                />
                                {disableCheckbox && (
                                  <span style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    width: '16px',
                                    height: '16px',
                                    background: '#f59e0b',
                                    borderRadius: '50%',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold'
                                  }}>
                                    !
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Account Type Fields */}
                        {accountTypeFields.map((field) => {
                          const disableCheckbox = isOtherExclusiveChecked(setting, field, accountTypeFields);
                          return (
                            <td key={field} style={{ 
                              padding: '12px 16px', 
                              textAlign: 'center', 
                              borderRight: '1px solid #e2e8f0',
                              background: idx % 2 === 0 ? '#fffbf0' : '#fef5e7'
                            }}>
                              <div style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                position: 'relative'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={!!setting[field]}
                                  onChange={() => handleExclusiveCheckboxClick(activity.code, field, disableCheckbox, 'accountType')}
                                  disabled={updating}
                                  title={disableCheckbox ? 'Click to select this account type (will deselect others)' : ''}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    cursor: updating ? 'not-allowed' : 'pointer',
                                    accentColor: '#f59e0b',
                                    transform: 'scale(1.2)'
                                  }}
                                />
                                {disableCheckbox && (
                                  <span style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    width: '16px',
                                    height: '16px',
                                    background: '#ef4444',
                                    borderRadius: '50%',
                                    fontSize: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold'
                                  }}>
                                    !
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Other Fields */}
                        {otherFields.map((field) => (
                          <td key={field} style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                            <input
                              type="checkbox"
                              checked={!!setting[field]}
                              onChange={() => toggleSetting(activity.code, field)}
                              disabled={updating}
                              style={{
                                width: '18px',
                                height: '18px',
                                cursor: updating ? 'not-allowed' : 'pointer',
                                accentColor: '#10b981',
                                transform: 'scale(1.1)'
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#2d3748', marginBottom: '16px' }}>
            Legend
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', background: '#667eea', borderRadius: '4px' }}></div>
              <span style={{ fontSize: '14px', color: '#4a5568' }}>
                <strong>Exclusive Group:</strong> Only one can be selected
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', background: '#f59e0b', borderRadius: '4px' }}></div>
              <span style={{ fontSize: '14px', color: '#4a5568' }}>
                <strong>Account Type:</strong> Only one can be selected
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', background: '#10b981', borderRadius: '4px' }}></div>
              <span style={{ fontSize: '14px', color: '#4a5568' }}>
                <strong>Other Settings:</strong> Multiple can be selected
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
