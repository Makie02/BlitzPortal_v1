import React, { useState, useEffect } from 'react';
import { supabase } from "../supabaseClient";

export default function ApprovedHistoryBudgetTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterResponse, setFilterResponse] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // ✅ Get logged-in user info
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || null;
      const userName = currentUser?.name || null;

      if (!userId && !userName) {
        console.warn("⚠️ No logged-in user found");
        setData([]);
        setLoading(false);
        return;
      }

      // ✅ Fetch approved history records
      const { data: records, error } = await supabase
        .from('approved_history_budget')
        .select('*')
        .order('date_responded', { ascending: false });

      if (error) throw error;

      // ✅ Fetch amount_badget data for remaining balances
      const { data: budgetData, error: budgetError } = await supabase
        .from('amount_badget')
        .select('pwp_code, remainingbalance');

      if (budgetError) throw budgetError;

      // Create a map for quick lookup of remaining balance by pwp_code
      const budgetMap = {};
      (budgetData || []).forEach(item => {
        budgetMap[item.pwp_code] = item.remainingbalance;
      });

      // ✅ Filter by created_form matching either UserID or name, and exclude N/A status
      const filteredByUser = (records || []).filter(record => {
        const createdForm = record.created_form;
        const status = record.status;
        
        // ❌ Skip if created_form is null, undefined, empty, or 'N/A'
        if (!createdForm || createdForm.toLowerCase() === 'n/a') {
          return false;
        }

        // ❌ Skip if status is 'N/A' (case-insensitive)
        if (!status || status.toLowerCase() === 'n/a') {
          return false;
        }
        
        // Check if created_form matches UserID or name (case-insensitive)
        return createdForm === String(userId) || 
               createdForm?.toLowerCase() === userName?.toLowerCase();
      });

      // ✅ Merge remaining balance from amount_badget table
      // Use cover_pwp_code if available, otherwise use pwp_code
      const enrichedData = filteredByUser.map(record => {
        const lookupCode = record.cover_pwp_code || record.pwp_code;
        return {
          ...record,
          remaining_balance: budgetMap[lookupCode] || record.remaining_balance || 0
        };
      });

      setData(enrichedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const filteredData = data.filter(item => {
    const matchesSearch = 
      item.pwp_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cover_pwp_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.approver_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.created_form?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesResponse = filterResponse === 'all' || item.response === filterResponse;

    return matchesSearch && matchesStatus && matchesResponse;
  });

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // ✅ Only total APPROVED records for credit budget
  const approvedData = filteredData.filter(item => 
    item.response?.toLowerCase() === 'approved'
  );

  const totalCreditBudget = approvedData.reduce((sum, item) => 
    sum + (parseFloat(item.credit_budget) || 0), 0
  );

  // ✅ Get remaining balance from the original remaining_balance (from amount_badget)
  const totalRemainingBalance = approvedData.reduce((sum, item) => 
    sum + (parseFloat(item.remaining_balance) || 0), 0
  );

  const getStatusColor = (status) => {
    const colors = {
      'Approved': '#10b981',
      'Pending': '#f59e0b',
      'Rejected': '#ef4444',
      'Refund Amount': '#3b82f6',
    };
    return colors[status] || '#6b7280';
  };

  const getResponseColor = (response) => {
    const colors = {
      'Approved': '#059669',
      'Cancelled': '#dc2626',
      'Pending': '#d97706',
    };
    return colors[response] || '#6b7280';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₱0.00';
    return `₱${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 60,
            height: 60,
            border: '6px solid rgba(255,255,255,0.3)',
            borderTop: '6px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: 'white', fontSize: 18, fontWeight: 600 }}>Loading Budget History...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
        {/* Header Section */}
        <div style={{
          background: 'white',
          borderRadius: 20,
          padding: 40,
          marginBottom: 30,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 30,
            flexWrap: 'wrap',
            gap: 20
          }}>
            <div>
              <h1 style={{
                fontSize: 42,
                fontWeight: 800,
                background: 'linear-gradient(135deg, #667eea 0%, #0040b8ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: 10
              }}>
                💰 Approved History Budget
              </h1>
            </div>
            <button
              onClick={fetchData}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #0040b8ff 100%)',
                color: 'white',
                padding: '14px 32px',
                borderRadius: 12,
                border: 'none',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
              }}
            >
              🔄 Refresh Data
            </button>
          </div>

          {/* Filters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 20
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                🔍 Search
              </label>
              <input
                type="text"
                placeholder="Search PWP Code, Approver..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 10,
                  fontSize: 15,
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                📊 Status Filter
              </label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 10,
                  fontSize: 15,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Status</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
                <option value="Refund Amount">Refund Amount</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                ✅ Response Filter
              </label>
              <select
                value={filterResponse}
                onChange={(e) => {
                  setFilterResponse(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 10,
                  fontSize: 15,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Responses</option>
                <option value="Approved">Approved</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          marginBottom: 30
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 20,
            padding: 30,
            color: 'white',
            boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 120, opacity: 0.1 }}>📋</div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Total Records</p>
              <p style={{ fontSize: 48, fontWeight: 800, margin: 0 }}>{filteredData.length}</p>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: 20,
            padding: 30,
            color: 'white',
            boxShadow: '0 12px 40px rgba(16, 185, 129, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 120, opacity: 0.1 }}>💳</div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Total Credit Budget</p>
              <p style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>{formatCurrency(totalCreditBudget)}</p>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: 20,
            padding: 30,
            color: 'white',
            boxShadow: '0 12px 40px rgba(245, 158, 11, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 120, opacity: 0.1 }}>💰</div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>Total Remaining</p>
              <p style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>{formatCurrency(totalRemainingBalance)}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{
          background: 'white',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{                background: 'linear-gradient(135deg, #667eea 0%, #0040b8ff 100%)',
 }}>
                  <th style={{ padding: 20, textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>ID</th>
                  <th style={{ padding: 20, textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>PWP Code</th>
                  <th style={{ padding: 20, textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Cover PWP</th>
                  <th style={{ padding: 20, textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Created By</th>
                  <th style={{ padding: 20, textAlign: 'center', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Response</th>
                  <th style={{ padding: 20, textAlign: 'center', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Status</th>
                  <th style={{ padding: 20, textAlign: 'center', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Type</th>
                  <th style={{ padding: 20, textAlign: 'right', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Credit Budget</th>
                  <th style={{ padding: 20, textAlign: 'right', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Remaining</th>
                  <th style={{ padding: 20, textAlign: 'left', color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item, index) => (
                  <tr 
                    key={item.id}
                    style={{
                      background: index % 2 === 0 ? '#f9fafb' : 'white',
                      borderBottom: '1px solid #e5e7eb',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#eef2ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#f9fafb' : 'white'}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '6px 14px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 700
                      }}>
                        #{item.id}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1f2937', fontSize: 15 }}>
                      {item.pwp_code}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#6b7280', fontSize: 14 }}>
                      {item.cover_pwp_code || 'N/A'}
                    </td>
           
                    <td style={{ padding: '16px 20px', color: '#374151', fontSize: 14 }}>
                      {item.created_form || 'N/A'}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        background: getResponseColor(item.response),
                        color: 'white',
                        padding: '6px 16px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5
                      }}>
                        {item.response}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        color: getStatusColor(item.status),
                        background: `${getStatusColor(item.status)}20`,
                        padding: '6px 16px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        border: `2px solid ${getStatusColor(item.status)}`
                      }}>
                        {item.status || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        background: '#f3f4f6',
                        color: '#374151',
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600
                      }}>
                        {item.type || 'admin'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#059669', fontWeight: 800, fontSize: 15 }}>
                      {formatCurrency(item.credit_budget)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', color: '#d97706', fontWeight: 800, fontSize: 15 }}>
                      {formatCurrency(item.remaining_balance)}
                    </td>
                    <td style={{ padding: '16px 20px', color: '#6b7280', fontSize: 13 }}>
                      {formatDate(item.date_responded)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Grand Totals Footer */}
              <tfoot>
                <tr style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' }}>
                  <td colSpan="8" style={{ padding: '24px 20px', textAlign: 'right', color: 'white', fontWeight: 800, fontSize: 18 }}>
                    📊 GRAND TOTALS
                  </td>
                  <td style={{ padding: '24px 20px', textAlign: 'right' }}>
                    <div style={{ color: '#10b981', fontSize: 20, fontWeight: 800 }}>
                      {formatCurrency(totalCreditBudget)}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4, fontWeight: 600 }}>CREDIT BUDGET</div>
                  </td>
                  <td style={{ padding: '24px 20px', textAlign: 'right' }}>
                    <div style={{ color: '#f59e0b', fontSize: 20, fontWeight: 800 }}>
                      {formatCurrency(totalRemainingBalance)}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4, fontWeight: 600 }}>REMAINING</div>
                  </td>
                  <td style={{ padding: '24px 20px', textAlign: 'center' }}>
                    <div style={{ color: '#667eea', fontSize: 20, fontWeight: 800 }}>
                      {filteredData.length}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4, fontWeight: 600 }}>RECORDS</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {filteredData.length > 0 && (
            <div style={{
              padding: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '2px solid #e5e7eb',
              flexWrap: 'wrap',
              gap: 16
            }}>
              <div style={{ color: '#6b7280', fontSize: 14, fontWeight: 600 }}>
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} records
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '10px 20px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 10,
                    background: currentPage === 1 ? '#f3f4f6' : 'white',
                    color: currentPage === 1 ? '#9ca3af' : '#374151',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s ease'
                  }}
                >
                  ← Previous
                </button>
                
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => paginate(pageNum)}
                        style={{
                          padding: '10px 16px',
                          border: '2px solid',
                          borderColor: currentPage === pageNum ? '#667eea' : '#e5e7eb',
                          borderRadius: 10,
                          background: currentPage === pageNum ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                          color: currentPage === pageNum ? 'white' : '#374151',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 14,
                          transition: 'all 0.2s ease',
                          minWidth: 45
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return <span key={pageNum} style={{ padding: '10px 5px', color: '#9ca3af' }}>...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '10px 20px',
                    border: '2px solid #e5e7eb',
                    borderRadius: 10,
                    background: currentPage === totalPages ? '#f3f4f6' : 'white',
                    color: currentPage === totalPages ? '#9ca3af' : '#374151',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    transition: 'all 0.2s ease'
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {filteredData.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
            }}>
              <div style={{ fontSize: 80, marginBottom: 20 }}>📭</div>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: '#374151', marginBottom: 12 }}>No Records Found</h3>
              <p style={{ color: '#6b7280', fontSize: 16 }}>Try adjusting your search or filters to find what you're looking for</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}