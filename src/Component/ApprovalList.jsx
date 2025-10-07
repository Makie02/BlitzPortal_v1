import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FaCheckCircle, FaSearch, FaCalendarAlt, FaFileExcel, FaFilePdf } from "react-icons/fa";

const ApprovalList = () => {
  const [approvalData, setApprovalData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Approval_History data
  useEffect(() => {
    const fetchApprovals = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("Approval_History")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        setApprovalData(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, []);

  // Filter data based on search term and date range
  useEffect(() => {
    let filtered = approvalData.filter((item) => {
      const matchesSearch =
        item.ApproverId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.PwpCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Response?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesDate = true;

      if (dateFrom || dateTo) {
        const itemDate = new Date(item.created_at);
        const fromDate = dateFrom ? new Date(dateFrom) : null;
        const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;

        if (fromDate && itemDate < fromDate) matchesDate = false;
        if (toDate && itemDate > toDate) matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });

    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [approvalData, searchTerm, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Export to Excel
  const handleExportToExcel = async () => {
    setExportLoading(true);
    try {
      const exportData = filteredData.map(item => ({
        ID: item.id,
        'ApproverId': item.ApproverId,
        'PWP Code': item.PwpCode,
        Response: item.Response,
        'Date Responded': item.DateResponded ? new Date(item.DateResponded).toLocaleString() : '',
        'Created At': item.created_at ? new Date(item.created_at).toLocaleString() : ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "ApprovalHistory");

      // Auto-fit columns
      const cols = [];
      const maxLengths = {};
      exportData.forEach(row => {
        Object.keys(row).forEach(key => {
          const length = String(row[key] || '').length;
          maxLengths[key] = Math.max(maxLengths[key] || 0, length, key.length);
        });
      });
      Object.keys(maxLengths).forEach(key => {
        cols.push({ wch: Math.min(maxLengths[key] + 2, 50) });
      });
      worksheet['!cols'] = cols;

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
      const data = new Blob([excelBuffer], { type: "application/octet-stream" });
      const fileName = `ApprovalHistory_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(data, fileName);
    } catch (err) {
      setError('Failed to export Excel file');
    } finally {
      setExportLoading(false);
    }
  };
  const renderCreatedForm = (createdForm) => {
    if (!createdForm || createdForm.trim() === '') {
      return '-';
    }

    // If createdForm might be a string representing a form type, you can customize this
    // For example, you could add icons or styling based on form type

    // Example: if createdForm is one of predefined types, style accordingly
    switch (createdForm.toLowerCase()) {
      case 'purchase order':
        return <span style={{ color: '#1e88e5', fontWeight: '600' }}>{createdForm}</span>;
      case 'expense report':
        return <span style={{ color: '#f4511e', fontWeight: '600' }}>{createdForm}</span>;
      case 'leave request':
        return <span style={{ color: '#43a047', fontWeight: '600' }}>{createdForm}</span>;
      default:
        // Default fallback, just display as text
        return <span>{createdForm}</span>;
    }
  };

  // Export to PDF
  const handleExportToPDF = async () => {
    setExportLoading(true);
    try {
      const printWindow = window.open('', '_blank');

      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Approval History Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #1976d2;
            }
            .header h1 { 
              color: #1976d2; 
              margin: 0 0 10px;
              font-size: 24px;
            }
            .export-info {
              color: #666;
              font-size: 14px;
              margin-bottom: 20px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px 8px; 
              text-align: left;
              font-size: 12px;
            }
            th { 
              background-color: #1976d2; 
              color: white;
              font-weight: bold;
            }
            tr:nth-child(even) { 
              background-color: #f9f9f9; 
            }
            .approved {
              background-color: #e8f5e8;
              color: #2e7d32;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Approval History Report</h1>
            <div class="export-info">
              Generated on: ${new Date().toLocaleDateString()} | 
              Total Records: ${filteredData.length}
              ${dateFrom || dateTo ? ` | Date Range: ${dateFrom || 'Start'} to ${dateTo || 'End'}` : ''}
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>ApproverId</th>
                <th>PWP Code</th>
                <th>Response</th>
                <th>Date Responded</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
      `;

      filteredData.forEach(item => {
        const isApproved = item.Response === 'Approved';
        htmlContent += `
          <tr ${isApproved ? 'class="approved"' : ''}>
            <td>${item.id}</td>
            <td>${item.ApproverId || ''}</td>
            <td>${item.PwpCode || ''}</td>
            <td>${item.Response || ''}</td>
            <td>${item.DateResponded ? new Date(item.DateResponded).toLocaleString() : ''}</td>
            <td>${item.created_at ? new Date(item.created_at).toLocaleString() : ''}</td>
          </tr>
        `;
      });

      htmlContent += `
            </tbody>
          </table>
          <div class="footer">
            <p>This report was automatically generated from the Approval History system.</p>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();

      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (err) {
      setError('Failed to generate PDF');
    } finally {
      setExportLoading(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
  };
  const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
  const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
  const role = currentUser?.role || "";

  // Filter function for the rows:
  const filterByCreatedForm = (row) => {
    if (role === "admin") return true;
    return row.CreatedForm?.toLowerCase().trim() === currentUserName;
  };

  // Apply the filter before rendering:
  const filteredRows = paginatedData.filter(filterByCreatedForm);


  return (
    <div style={{
      padding: "20px",
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 30px',
          backgroundColor: '#f8f8f8ff',
          color: 'white'
        }}>
          <h1 style={{
            margin: '0 0 8px',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            Approval History
          </h1>
          <p style={{
            margin: 0,
            opacity: 0.9,
            fontSize: '14px'
          }}>
            {filteredData.length} records found
            {(dateFrom || dateTo) && ` (filtered by date)`}
          </p>
        </div>

        {/* Filters and Controls */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#fafafa',
          borderBottom: '1px solid #e0e0e0'
        }}>
          <div style={{
            display: 'flex',
            gap: '15px',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: '15px'
          }}>
            {/* Search */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flex: '1',
              minWidth: '250px'
            }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <FaSearch style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#666',
                  fontSize: '14px'
                }} />
                <input
                  type="search"
                  placeholder="Search by ApproverId, PwpCode, or Response"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '10px 12px 10px 35px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Date Range */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <FaCalendarAlt style={{ color: '#666', fontSize: '14px' }} />
              <span style={{ fontSize: '14px', color: '#666' }}>From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <span style={{ color: '#666' }}>To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Clear Filters
            </button>
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleExportToExcel}
              disabled={exportLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: exportLoading ? '#ccc' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FaFileExcel />
              {exportLoading ? 'Generating...' : 'Generate Excel'}
            </button>

            <button
              onClick={handleExportToPDF}
              disabled={exportLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: exportLoading ? '#ccc' : '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FaFilePdf />
              {exportLoading ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>
        </div>

        {/* Loading and Error States */}
        {loading && (
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
            <p style={{ color: '#666' }}>Loading approval history...</p>
          </div>
        )}

        {error && (
          <div style={{
            padding: '20px 30px',
            backgroundColor: '#ffebee',
            border: '1px solid #ef5350',
            margin: '20px 30px',
            borderRadius: '8px'
          }}>
            <p style={{ margin: 0, color: '#c62828' }}>
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#2575fc', color: 'white' }}>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #1565c0'
                  }}>ID</th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #1565c0'
                  }}>ApproverId</th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #1565c0'
                  }}>PWP Code</th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #1565c0'
                  }}>Response</th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #1565c0'
                  }}>Date Responded</th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #1565c0'
                  }}>Created At</th>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #1565c0'
                  }}>Created By</th>

                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #1565c0'
                  }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: '#666',
                        fontSize: '16px',
                        backgroundColor: '#fafafa'
                      }}
                    >
                      {filteredRows.length === 0 && !loading
                        ? 'No approval records found.'
                        : 'Loading...'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((item, index) => (
                    <tr
                      key={item.id}
                      style={{
                        backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <td style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        fontSize: '14px',
                        color: '#000000ff'
                      }}>{item.id}</td>
                      <td style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        fontSize: '14px',
                        color: '#000000ff'
                      }}>{item.ApproverId}</td>
                      <td style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        fontSize: '14px',
                        color: '#000000ff',
                        fontFamily: 'monospace'
                      }}>{item.PwpCode}</td>
                      <td style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        fontSize: '14px'
                      }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: item.Response === 'Approved' ? '#e8f5e8' : '#fff3e0',
                          color: item.Response === 'Approved' ? '#2e7d32' : '#ef6c00'
                        }}>
                          {item.Response}
                        </span>
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        fontSize: '14px',
                        color: '#000000ff',
                      }}>
                        {item.DateResponded
                          ? new Date(item.DateResponded).toLocaleString()
                          : '-'}
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        fontSize: '14px',
                        color: '#000000ff',
                      }}>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString()
                          : '-'}
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        fontSize: '14px',
                        color: '#000000ff',
                      }}>
                        {renderCreatedForm(item.CreatedForm)}
                      </td>

                      <td style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        textAlign: 'center'
                      }}>
                        {item.Response === "Approved" && (
                          <FaCheckCircle
                            color="#4caf50"
                            size={20}
                            title="Approved"
                          />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#fafafa',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          {/* Records Info */}
          <div style={{ fontSize: '14px', color: '#666' }}>
            Showing {paginatedData.length > 0 ? ((currentPage - 1) * rowsPerPage) + 1 : 0} to{' '}
            {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} records
          </div>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 16px',
                backgroundColor: currentPage === 1 ? '#f5f5f5' : '#2196f3',
                color: currentPage === 1 ? '#999' : 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Previous
            </button>

            {/* Page Numbers */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: currentPage === pageNum ? '#1976d2' : 'white',
                      color: currentPage === pageNum ? 'white' : '#333',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      minWidth: '40px',
                      fontWeight: '500'
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 16px',
                backgroundColor: currentPage === totalPages ? '#f5f5f5' : '#2196f3',
                color: currentPage === totalPages ? '#999' : 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Next
            </button>
          </div>
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

export default ApprovalList;