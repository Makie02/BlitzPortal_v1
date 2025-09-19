import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";
import RecordViewModal from "./RecordViewModal";

function RecordsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState([]);
  const [updating] = useState(false);
  const [filter, setFilter] = useState("all"); // all | cover | regular
  const [statusFilter, setStatusFilter] = useState("all"); // all | approved | declined | sent_back | cancelled
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [setRowsPerPage] = useState(10);

  // Define the specific columns to show for each table (moved outside component or use useMemo)
  const COVER_COLUMNS = useMemo(() => ['id', 'cover_code', 'account_type', 'pwp_type', 'created_at', 'createForm'], []);
  const REGULAR_COLUMNS = useMemo(() => ['id', 'regularpwpcode', 'accountType', 'pwptype', 'created_at', 'createForm'], []);

  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  // Function to filter object keys based on allowed columns
  const filterColumns = (obj, allowedColumns) => {
    const filtered = {};
    allowedColumns.forEach(col => {
      if (obj.hasOwnProperty(col)) {
        filtered[col] = obj[col];
      }
    });
    return filtered;
  };

  // Function to get approval status for PWP codes
  const getApprovalStatus = async (pwpCodes) => {
    try {
      const { data: approvalData, error } = await supabase
        .from("Approval_History")
        .select("PwpCode, Response, DateResponded, created_at")
        .in("PwpCode", pwpCodes);

      if (error) {
        console.error("Error fetching approval status:", error);
        return {};
      }

      // Create a map of PWPCode to approval status
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
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

const totalPages = Math.ceil(data.length / rowsPerPage);

  const paginatedData = data.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Modified fetchData function - replace your existing fetchData with this
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let coverData = [];
      let regularData = [];
      let allColumns = [];

      if (filter === "all" || filter === "cover") {
        const { data: cData, error: cError } = await supabase
          .from("cover_pwp")
          .select(COVER_COLUMNS.join(','))
          .order("id", { ascending: false })
          .limit(50);

        if (cError) throw cError;
        coverData = (cData || []).map((item) => ({
          ...filterColumns(item, COVER_COLUMNS),
          source: "cover_pwp",
          pwp_code: item.cover_code // Use this to match with Approval_History
        }));
      }

      if (filter === "all" || filter === "regular") {
        const { data: rData, error: rError } = await supabase
          .from("regular_pwp")
          .select(REGULAR_COLUMNS.join(','))
          .order("id", { ascending: false })
          .limit(50);

        if (rError) throw rError;
        regularData = (rData || []).map((item) => ({
          ...filterColumns(item, REGULAR_COLUMNS),
          source: "regular_pwp",
          pwp_code: item.regularpwpcode // Use this to match with Approval_History
        }));
      }

      const mergedData = [...coverData, ...regularData];

      // Get all PWP codes to fetch approval status
      const allPwpCodes = mergedData
        .map(item => item.pwp_code)
        .filter(code => code); // Remove null/undefined codes

      // Fetch approval status for all PWP codes
      const approvalStatusMap = await getApprovalStatus(allPwpCodes);

      // Add approval status to each item
      const dataWithApprovalStatus = mergedData.map(item => ({
        ...item,
        approval_status: approvalStatusMap[item.pwp_code]?.status || 'Pending',
        date_responded: approvalStatusMap[item.pwp_code]?.date_responded,
        approval_created: approvalStatusMap[item.pwp_code]?.approval_created
      }));

      // Apply filters
      let filteredData = dataWithApprovalStatus;

      // Apply search filter
      if (searchQuery) {
        filteredData = filteredData.filter(item => {
          const searchFields = [
            item.code,                   // for "all" filter
            item.cover_code,             // for cover records
            item.regularpwpcode,        // for regular records
            item.id,
            item.account_type,
            item.accountType,
            item.pwp_type,
            item.pwptype,
            item.createForm
          ];

          return searchFields.some(field =>
            field && field.toString().toLowerCase().includes(searchQuery.toLowerCase())
          );
        });
      }

      // Apply status filter based on approval status
      if (statusFilter !== "all") {
        filteredData = filteredData.filter(item => {
          const itemStatus = item.approval_status ? item.approval_status.toLowerCase() : 'pending';
          if (statusFilter === "sent_back") {
            return itemStatus === "sent back for revision" || itemStatus === "sent back";
          }
          if (statusFilter === "cancelled") {
            return itemStatus === "cancelled";
          }
          if (statusFilter === "pending") {
            return itemStatus === "pending" || !item.approval_status;
          }
          if (statusFilter === "approved") {
            return itemStatus === "approved";
          }
          if (statusFilter === "declined") {
            return itemStatus === "declined";
          }
          return itemStatus === statusFilter;
        });
      }

      // Apply date filters
      if (dateFrom) {
        filteredData = filteredData.filter(item => {
          if (!item.created_at) return false;
          const itemDate = new Date(item.created_at);
          const fromDate = new Date(dateFrom);
          return itemDate >= fromDate;
        });
      }

      if (dateTo) {
        filteredData = filteredData.filter(item => {
          if (!item.created_at) return false;
          const itemDate = new Date(item.created_at);
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          return itemDate <= toDate;
        });
      }

      if (filteredData.length > 0) {
        // Create unified column set
        const regularCols = REGULAR_COLUMNS.filter(col => col !== 'regularpwpcode');
        const coverCols = COVER_COLUMNS.filter(col => col !== 'cover_code');

        // Create unified columns with code column as the second column
        if (filter === "all") {
          allColumns = ['id', 'code', ...regularCols.slice(1)]; // Skip id since it's already first
        } else if (filter === "cover") {
          allColumns = ['id', 'cover_code', ...coverCols.slice(1)];
        } else if (filter === "regular") {
          allColumns = ['id', 'regularpwpcode', ...regularCols.slice(1)];
        }

        // Normalize the data to have a unified 'code' column when showing all
        const normalizedData = filteredData.map(item => {
          if (filter === "all") {
            return {
              ...item,
              code: item.regularpwpcode || item.cover_code || '-',
              accountType: item.accountType || item.account_type || '-',
              pwptype: item.pwptype || item.pwp_type || '-'
            };
          }
          return item;
        });

        setColumns(allColumns);
        setData(normalizedData);
      } else {
        setData([]);
        setColumns([]);
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filter, REGULAR_COLUMNS, COVER_COLUMNS, statusFilter, searchQuery, dateFrom, dateTo]);

  // Updated getStatusBadge function - replace your existing one
  const getStatusBadge = (status) => {
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
        return new Date(value).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric"
        }); // e.g., Sep 17, 2025
      } catch {
        return value;
      }
    }

    return String(value);
  };

  // Define styles object
  const styles = {
    td: {
      padding: '16px 20px',
      borderBottom: '1px solid #e0e0e0',
      fontSize: '14px',
      color: '#000000ff'
    }
  };

  useEffect(() => {
  fetchData();
}, [fetchData, rowsPerPage]);

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
          <h2 style={{ margin: 0, color: '#333' }}>Loading Database...</h2>
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
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 30px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
                📊 RECORDS
              </h1>

              <p style={{
                margin: 0,
                fontSize: '15px',
                color: '#555',
                opacity: 0.85,
                lineHeight: '1.4',
                fontStyle: 'italic'
              }}>
                {data.length} records found {filter !== 'all' && (
                  <span style={{ color: '#0d47a1' }}>({filter.replaceAll("_", " ")} only)</span>
                )}
              </p>
            </div>

            {/* Controls */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              {/* Search */}
              <div className="filter-item">
                <input
                  type="text"
                  placeholder="🔍 Search by Code, AccountType...."
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
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%',
                    minWidth: '0',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Records</option>
                  <option value="cover">Cover PWP Only</option>
                  <option value="regular">Regular PWP Only</option>
                </select>
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
                        {formatCellValue(row[col], col)}
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
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', alignItems: 'center', gap: '12px' }}>
        {/* Rows per page selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const newRowsPerPage = Number(e.target.value);
              setRowsPerPage(newRowsPerPage);
              setCurrentPage(1); // reset to page 1 when rows per page changes
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

        {/* Pagination Buttons */}
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
          onClose={() => {
            setShowModal(false);
            setSelectedRecord(null);
          }}
        />
      )}
    </div>
  );
}

export default RecordsPage;