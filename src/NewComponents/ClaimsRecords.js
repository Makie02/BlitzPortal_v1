import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";
import RecordViewModal from "./RecordViewModal";

function ClaimsRecords() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState([]);
  const [updating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const CLAIMS_COLUMNS = useMemo(() => [
    'id', 
    'code_pwp',      
    'distributor',
    'account_types',    
    'created_at', 
    'createForm'       
  ], []);

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const paginatedData = data.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Helper function to convert codes to readable text
const convertCodeToText = useCallback((code, type, accountTypesMap, distributorsMap) => {
  if (!code) return '-';
  
  // 🔁 ACCOUNT TYPES LOGIC
  if (type === 'account_types') {
    let codes = [];

    // ✅ JSON array (e.g. "['A123', 'B456']")
    if (typeof code === 'string' && code.includes('[')) {
      try {
        codes = JSON.parse(code.replace(/'/g, '"'));
      } catch {
        // fallback kung hindi valid JSON
        const matches = code.match(/[A-Z0-9]+/g);
        if (matches) codes = matches;
      }
    } else {
      // ✅ Single code
      codes = [code];
    }

    // ✅ Convert each code to text name
    return codes
      .map(singleCode => {
        const cleanCode = singleCode.toString().trim().toUpperCase();
        return accountTypesMap.get(cleanCode) || `Unknown (${cleanCode})`;
      })
      .join(', ');
  }

  // 🔁 DISTRIBUTOR LOGIC
  if (type === 'distributor') {
    const cleanCode = code.toString().trim();
    return distributorsMap.get(cleanCode) || `Unknown Distributor (${cleanCode})`;
  }

  return code;
}, []);

  // Helper function to format cell values
  const formatCellValue = useCallback((value, colName, accountTypesMap, distributorsMap) => {
    if (!value && value !== 0) return '-';

    if (colName === 'distributor') {
      return convertCodeToText(value, 'distributor', accountTypesMap, distributorsMap);
    }

    if (colName === 'account_types') {
      return convertCodeToText(value, 'account_types', accountTypesMap, distributorsMap);
    }

    if (colName === 'created_at' && value) {
      try {
        return new Date(value).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      } catch {
        return value;
      }
    }

    return String(value);
  }, [convertCodeToText]);

  // Function to filter object keys based on allowed columns
  const filterColumns = useCallback((obj, allowedColumns) => {
    const filtered = {};
    allowedColumns.forEach(col => {
      if (obj.hasOwnProperty(col)) {
        filtered[col] = obj[col];
      }
    });
    return filtered;
  }, []);

  // Function to get approval status for PWP codes
  const getApprovalStatus = useCallback(async (pwpCodes) => {
    try {
      const { data: approvalData, error } = await supabase
        .from("Approval_History")
        .select("PwpCode, Response, DateResponded, created_at")
        .in("PwpCode", pwpCodes);

      if (error) {
        console.error("Error fetching approval status:", error);
        return {};
      }

      const approvalMap = {};
      approvalData?.forEach(approval => {
        approvalMap[approval.PwpCode] = {
          status: approval.Response || 'Pending',
          date_responded: approval.DateResponded,
          approval_created: approval.created_at
        };
      });

      return approvalMap;
    } catch (err) {
      console.error("Unexpected error fetching approval status:", err);
      return {};
    }
  }, []);

  // Main fetch function

const fetchData = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    const [distributorsResult, claimsResult] = await Promise.all([
      supabase.from("distributors").select("code, name"),
      supabase.from("Claims_pwp").select(CLAIMS_COLUMNS.join(',')).order("id", { ascending: false }).limit(100)
    ]);

    if (distributorsResult.error) throw distributorsResult.error;
    if (claimsResult.error) throw claimsResult.error;

    // Step 1 — Kunin ang lahat ng needed account_types codes mula sa claims
    const neededAccountTypeCodes = new Set();
    (claimsResult.data || []).forEach(item => {
      if (item.account_types) {
        if (typeof item.account_types === "string" && item.account_types.includes("[")) {
          try {
            const codes = JSON.parse(item.account_types.replace(/'/g, '"'));
            codes.forEach(code => neededAccountTypeCodes.add(code.trim()));
          } catch (innerErr) {
            console.error("Error parsing account_types:", innerErr);
            const matches = item.account_types.match(/[A-Z0-9]+/g);
            if (matches) matches.forEach(code => neededAccountTypeCodes.add(code.trim()));
          }
        } else {
          neededAccountTypeCodes.add(item.account_types.trim());
        }
      }
    });

    // Step 2 — Fetch only those account_types from categorydetails
    const { data: accountTypesData, error: accountTypesError } = await supabase
      .from("categorydetails")
      .select("code, name")
      .in("code", Array.from(neededAccountTypeCodes));

    if (accountTypesError) throw accountTypesError;

    // Step 3 — Build maps
    const distributorsMap = new Map();
    const accountTypesMap = new Map();

    distributorsResult.data?.forEach(distributor => {
      distributorsMap.set(distributor.code.toString(), distributor.name);
    });

    accountTypesData?.forEach(accountType => {
      accountTypesMap.set(accountType.code.toString().trim(), accountType.name);
    });

    console.log("✅ Account Types Map:", Array.from(accountTypesMap.entries()));

    // Step 4 — Process claims
    const processedData = (claimsResult.data || []).map((item) => ({
      ...filterColumns(item, CLAIMS_COLUMNS),
      source: "Claims_pwp",
      code_pwp: item.code_pwp || item.code || item.claim_code,
      distributor_text: convertCodeToText(item.distributor, 'distributor', accountTypesMap, distributorsMap),
      account_types_text: (() => {
        let codes = [];
        if (typeof item.account_types === "string" && item.account_types.includes("[")) {
          try {
            codes = JSON.parse(item.account_types.replace(/'/g, '"'));
          } catch (innerErr) {
            console.error("Error parsing account_types in map:", innerErr);
            const matches = item.account_types.match(/[A-Z0-9]+/g);
            if (matches) codes = matches;
          }
        } else {
          codes = [item.account_types];
        }
        return codes
          .map(code => accountTypesMap.get(code?.toString().trim()) || `Unknown (${code})`)
          .join(", ");
      })()
    }));

    setColumns(CLAIMS_COLUMNS);
    setData(processedData);
    setCurrentPage(1);

  } catch (err) {
    console.error("❌ fetchData error:", err);
    setError(`Unexpected error: ${err?.message || err}`);
  } finally {
    setLoading(false);
  }
}, [CLAIMS_COLUMNS, filterColumns, convertCodeToText]);


  // Event handlers
  const handleViewRecord = useCallback((record) => {
    setSelectedRecord(record);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setSelectedRecord(null);
  }, []);

  // Status badge component
  const getStatusBadge = useCallback((status) => {
    const statusLower = status ? status.toLowerCase() : 'pending';
    let bgColor, textColor, borderColor;

    switch (statusLower) {
      case 'approved':
        bgColor = '#e8f5e8';
        textColor = '#2e7d32';
        borderColor = '#c8e6c9';
        break;
      case 'declined':
        bgColor = '#ffebee';
        textColor = '#c62828';
        borderColor = '#ffcdd2';
        break;
      case 'sent back for revision':
      case 'sent back':
        bgColor = '#fff3e0';
        textColor = '#e65100';
        borderColor = '#ffcc02';
        break;
      case 'cancelled':
        bgColor = '#f3e5f5';
        textColor = '#7b1fa2';
        borderColor = '#e1bee7';
        break;
      case 'pending':
      default:
        bgColor = '#fff3cd';
        textColor = '#8a6d3b';
        borderColor = '#ffeaa7';
    }

    return (
      <span
        style={{
          padding: '4px 12px',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: '600',
          backgroundColor: bgColor,
          color: textColor,
          border: `1px solid ${borderColor}`,
          textTransform: 'capitalize',
          letterSpacing: '0.5px',
        }}
      >
        {status || 'Pending'}
      </span>
    );
  }, []);

  // Format column names
  const formatColumnName = useCallback((colName) => {
    return colName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Pwp', 'PWP')
      .replace('Id', 'ID');
  }, []);

  // Render cell value
  const renderCellValue = useCallback((row, col) => {
    if (col === 'distributor') {
      return row.distributor_text || '-';
    }
    if (col === 'account_types') {
      return row.account_types_text || '-';
    }
    if (col === 'created_at' && row[col]) {
      try {
        return new Date(row[col]).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        });
      } catch {
        return row[col];
      }
    }
    return row[col] || '-';
  }, []);

  // Load data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Styles
  const styles = {
    td: {
      padding: '16px 20px',
      borderBottom: '1px solid #e0e0e0',
      fontSize: '14px',
      color: '#000000ff'
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        minHeight: '100vh'
      }}>
        <div style={{
          display: 'inline-block',
          padding: '20px 40px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
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
          <h2 style={{ margin: 0, color: '#333' }}>Loading Claims Database...</h2>
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
  }

  if (error) {
    return (
      <div style={{
        padding: '40px',
        backgroundColor: '#f8f9fa',
        minHeight: '100vh'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            backgroundColor: '#ffebee',
            border: '1px solid #ef5350',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: 0, color: '#d32f2f' }}>{error}</p>
          </div>
          <button
            onClick={fetchData}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '24px 30px', color: 'white' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            gap: '12px', 
            flexWrap: 'wrap' 
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '10px 0',
              maxWidth: '100%',
            }}>
              <h1 style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: '700',
                color: '#000000ff',
                letterSpacing: '0.5px',
                lineHeight: '1.2'
              }}>
                📊 CLAIMS RECORDS
              </h1>
              <p style={{
                margin: 0,
                fontSize: '15px',
                color: '#555',
                opacity: 0.85,
                lineHeight: '1.4',
                fontStyle: 'italic'
              }}>
                {data.length} claims records found
              </p>
            </div>

            {/* Controls */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
            }}>
              {/* Search */}
              <div className="filter-item">
                <input
                  type="text"
                  placeholder="🔍 Search by PWP Code, Account Type...."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'border-color 0.3s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2575fc'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              <div className="filter-item">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%',
                    minWidth: '0',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                  <option value="sent_back">Sent Back</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Date Range */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                backgroundColor: 'white',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e1e8ed'
              }}>
                <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>📅 Date:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                />
                <span style={{ color: '#666' }}>to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div className="filter-item">
                <button
                  onClick={fetchData}
                  disabled={updating}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    backgroundColor: '#2575fc',
                    color: '#fff',
                    fontWeight: '500',
                    width: '100%',
                    opacity: updating ? 0.7 : 1,
                  }}
                >
                  {updating ? 'Updating...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            padding: '5px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#2575fc', color: '#ffff' }}>
                {columns.map(col => (
                  <th key={col} style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#eeeeeeff',
                    fontSize: '14px',
                    borderBottom: '2px solid #e0e0e0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {formatColumnName(col)}
                  </th>
                ))}
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#fcfcfcff',
                  fontSize: '14px',
                  borderBottom: '2px solid #e0e0e0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: '120px'
                }}>
                  Status
                </th>
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#fcfcfcff',
                  fontSize: '14px',
                  borderBottom: '2px solid #e0e0e0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: '120px'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, index) => (
                <tr key={row.id || index} style={{
                  backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                  transition: 'background-color 0.2s ease'
                }}>
                  {columns.map(col => (
                    <td key={col} style={styles.td}>
                      <span style={{ 
                        maxWidth: window.innerWidth <= 768 ? '100px' : col === 'created_at' ? '150px' : '200px',
                        display: 'inline-block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {renderCellValue(row, col)}
                      </span>
                    </td>
                  ))}
                  <td style={{...styles.td, textAlign: 'center'}}>
                    {getStatusBadge(row.approval_status)}
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <button 
                      onClick={() => handleViewRecord(row)} 
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#2196f3', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px',
                        cursor: 'pointer', 
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        margin: '0 auto',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#1976d2'}
                      onMouseOut={(e) => e.target.style.backgroundColor = '#2196f3'}
                    >
                      🔍 View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginTop: '16px', 
        alignItems: 'center', 
        gap: '12px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setCurrentPage(1);
            }}
            style={{
              padding: '4px 8px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{
              padding: '6px 12px',
              backgroundColor: currentPage === 1 ? '#e0e0e0' : '#1976d2',
              color: currentPage === 1 ? '#555' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: '14px' }}>
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 12px',
              backgroundColor: currentPage === totalPages ? '#e0e0e0' : '#1976d2',
              color: currentPage === totalPages ? '#555' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Record View Modal */}
      {showModal && (
        <RecordViewModal
          record={selectedRecord}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

export default ClaimsRecords;