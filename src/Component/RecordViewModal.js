import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const RecordViewModal = ({ record, onClose }) => {
  const [fullRecord, setFullRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allRecords, setAllRecords] = useState({ regular: [], cover: [] });
  const [showAllData, setShowAllData] = useState(false);

  useEffect(() => {
    if (record) {
      fetchFullRecord();
    }
  }, [record]); // Fixed: Added record as dependency

  useEffect(() => {
    if (showAllData && record) {
      fetchAllRecords();
    }
  }, [showAllData, record]); // Fixed: Added dependencies

  const fetchFullRecord = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tableName = record.source || 'regular_pwp';
      const { data, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', record.id)
        .single();

      if (fetchError) throw fetchError;
      
      setFullRecord(data);
    } catch (err) {
      setError(`Failed to fetch record details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRecords = async () => {
    try {
      // Fetch all regular PWP records
      const { data: regularData, error: regularError } = await supabase
        .from('regular_pwp')
        .select('*')
        .order('id', { ascending: false });

      if (regularError) throw regularError;

      // Fetch all cover PWP records
      const { data: coverData, error: coverError } = await supabase
        .from('cover_pwp')
        .select('*')
        .order('id', { ascending: false });

      if (coverError) throw coverError;

      setAllRecords({
        regular: regularData || [],
        cover: coverData || []
      });
    } catch (err) {
      setError(`Failed to fetch all records: ${err.message}`);
    }
  };

  const formatColumnName = (colName) => {
    return colName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Pwp', 'PWP')
      .replace('Id', 'ID');
  };

  const formatCellValue = (value, colName) => {
    if (!value && value !== 0) return '-';
    
    if (colName === 'created_at' && value) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    
    return String(value);
  };

  const exportTableData = (data, tableName) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]).map(col => formatColumnName(col)).join(',');
    const rows = data.map(row => 
      Object.keys(data[0]).map(col => {
        const value = row[col] || '';
        return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      }).join(',')
    );
    
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${tableName}_records_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!record) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: showAllData ? '95vw' : '800px',
        maxHeight: '90vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '24px 30px',
          backgroundColor: '#1976d2',
          color: 'white',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>
              {showAllData ? 'All PWP Records Database View' : 'Record Details'}
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
              {showAllData 
                ? `Regular: ${allRecords.regular.length} | Cover: ${allRecords.cover.length} records`
                : `ID: ${record.id} - ${record.source === 'cover_pwp' ? 'Cover PWP' : 'Regular PWP'}`
              }
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Toggle View Buttons */}
        <div style={{
          padding: '16px 30px',
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setShowAllData(false)}
            style={{
              padding: '8px 16px',
              backgroundColor: !showAllData ? '#1976d2' : 'white',
              color: !showAllData ? 'white' : '#1976d2',
              border: '1px solid #1976d2',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📋 Single Record View
          </button>
          <button
            onClick={() => setShowAllData(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: showAllData ? '#1976d2' : 'white',
              color: showAllData ? 'white' : '#1976d2',
              border: '1px solid #1976d2',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            🗄️ All Database Records
          </button>
        </div>

        {/* Modal Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '0'
        }}>
          {loading ? (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center' 
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #e3f2fd',
                borderTop: '4px solid #1976d2',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
              }}></div>
              <p>Loading {showAllData ? 'all records' : 'record details'}...</p>
            </div>
          ) : error ? (
            <div style={{ 
              padding: '30px',
              textAlign: 'center',
              color: '#d32f2f'
            }}>
              <p>{error}</p>
              <button
                onClick={() => showAllData ? fetchAllRecords() : fetchFullRecord()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Retry
              </button>
            </div>
          ) : showAllData ? (
            /* All Records View */
            <div>
              {/* Regular PWP Section */}
              <div style={{ marginBottom: '30px' }}>
                <div style={{
                  padding: '20px 30px',
                  backgroundColor: '#e3f2fd',
                  borderBottom: '2px solid #1976d2',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ margin: 0, color: '#1976d2' }}>
                    Regular PWP Records ({allRecords.regular.length})
                  </h3>
                  <button
                    onClick={() => exportTableData(allRecords.regular, 'regular_pwp')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    📊 Export Regular
                  </button>
                </div>
                {allRecords.regular.length > 0 ? (
                  <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f5f5f5' }}>
                        <tr>
                          {Object.keys(allRecords.regular[0]).map(col => (
                            <th key={col} style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              borderBottom: '2px solid #ddd',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#f5f5f5'
                            }}>
                              {formatColumnName(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allRecords.regular.map((row, index) => (
                          <tr key={row.id || index} style={{
                            backgroundColor: index % 2 === 0 ? 'white' : '#fafafa'
                          }}>
                            {Object.keys(allRecords.regular[0]).map(col => (
                              <td key={col} style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #eee',
                                fontSize: '12px',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {formatCellValue(row[col], col)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    No regular PWP records found
                  </div>
                )}
              </div>

              {/* Cover PWP Section */}
              <div>
                <div style={{
                  padding: '20px 30px',
                  backgroundColor: '#e8f5e8',
                  borderBottom: '2px solid #4caf50',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ margin: 0, color: '#4caf50' }}>
                    Cover PWP Records ({allRecords.cover.length})
                  </h3>
                  <button
                    onClick={() => exportTableData(allRecords.cover, 'cover_pwp')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    📊 Export Cover
                  </button>
                </div>
                {allRecords.cover.length > 0 ? (
                  <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f5f5f5' }}>
                        <tr>
                          {Object.keys(allRecords.cover[0]).map(col => (
                            <th key={col} style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              borderBottom: '2px solid #ddd',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#f5f5f5'
                            }}>
                              {formatColumnName(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allRecords.cover.map((row, index) => (
                          <tr key={row.id || index} style={{
                            backgroundColor: index % 2 === 0 ? 'white' : '#fafafa'
                          }}>
                            {Object.keys(allRecords.cover[0]).map(col => (
                              <td key={col} style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #eee',
                                fontSize: '12px',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {formatCellValue(row[col], col)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    No cover PWP records found
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Single Record View */
            fullRecord && (
              <div style={{ padding: '30px' }}>
                <div style={{ 
                  display: 'grid', 
                  gap: '20px',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
                }}>
                  {Object.entries(fullRecord).map(([key, value]) => (
                    <div key={key} style={{
                      padding: '16px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#666',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '8px'
                      }}>
                        {formatColumnName(key)}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#333',
                        lineHeight: '1.4',
                        wordBreak: 'break-word',
                        whiteSpace: typeof value === 'object' ? 'pre-wrap' : 'normal',
                        fontFamily: typeof value === 'object' ? 'monospace' : 'inherit'
                      }}>
                        {formatCellValue(value, key)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#f5f5f5',
          borderTop: '1px solid #e0e0e0',
          borderRadius: '0 0 12px 12px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          {showAllData && (
            <button
              onClick={() => {
                // Export both tables combined
                const combinedData = [
                  ...allRecords.regular.map(r => ({...r, table_source: 'regular_pwp'})),
                  ...allRecords.cover.map(r => ({...r, table_source: 'cover_pwp'}))
                ];
                exportTableData(combinedData, 'combined_pwp');
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📊 Export All Combined
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Close
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
};

export default RecordViewModal;