import React, { useState, useEffect } from 'react';
import { supabase } from "../supabaseClient";
import * as XLSX from 'xlsx';

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
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || null;
      const userName = currentUser?.name || null;

      if (!userId && !userName) {
        console.warn("⚠️ No logged-in user found");
        setData([]);
        setLoading(false);
        return;
      }

      const { data: records, error } = await supabase
        .from('approved_history_budget')
        .select('*')
        .order('date_responded', { ascending: false });

      if (error) throw error;

      const { data: budgetData, error: budgetError } = await supabase
        .from('amount_badget')
        .select('pwp_code, remainingbalance');

      if (budgetError) throw budgetError;

      const budgetMap = {};
      (budgetData || []).forEach(item => {
        budgetMap[item.pwp_code] = item.remainingbalance;
      });

      const filteredByUser = (records || []).filter(record => {
        const createdForm = String(record.created_form || "").toLowerCase();
        const status = String(record.status || "").toLowerCase();

        if (createdForm === "" || createdForm === "n/a") {
          return false;
        }
        if (status === "" || status === "n/a") {
          return false;
        }


        return createdForm === String(userId) ||
          createdForm?.toLowerCase() === userName?.toLowerCase();
      });

      // Sa enrichedData mapping mo:
      const enrichedData = filteredByUser.map(record => {
        const lookupCode = record.cover_pwp_code || record.pwp_code;

        return {
          ...record,
          remaining_balance: budgetMap[lookupCode] || record.remaining_balance || 0,

          // ❌ MALI TO - case sensitive ang Supabase!
          // isPartOfBudget: record.is_part_of_budget_amount ?? null,
          // notPartOfBudget: record.not_part_budget_amount ?? null

          // ✅ DAPAT GANITO (based sa schema mo)
          isPartOfBudget: record.isPartOfBudget ?? null,
          notPartOfBudget: record.notPartOfBudget ?? null
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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const approvedData = filteredData.filter(item =>
    item.response?.toLowerCase() === 'approved'
  );

  // ✅ FIXED: Total Credit Budget - only isPartOfBudget = true
  const totalCreditBudget = approvedData.reduce((sum, item) => {
    if (item.isPartOfBudget === true) {
      return sum + (parseFloat(item.credit_budget) || 0);
    }
    return sum;
  }, 0);

  // ✅ FIXED: Total Remaining Balance - only isPartOfBudget = true
  const totalRemainingBalance = approvedData.reduce((sum, item) => {
    if (item.isPartOfBudget === true) {
      return sum + (parseFloat(item.remaining_balance) || 0);
    }
    return sum;
  }, 0);

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

  // ========== EXPORT TO EXCEL FUNCTION - ETO NA KUPAL! ==========
  const exportToExcel = () => {
    try {
      const exportData = filteredData.map((item, index) => ({
        'No.': index + 1,
        'ID': item.id,
        'PWP Code': item.pwp_code || 'N/A',
        'Cover PWP Code': item.cover_pwp_code || 'N/A',
        'Created By': item.created_form || 'N/A',
        'Approver ID': item.approver_id || 'N/A',
        'Response': item.response || 'N/A',
        'Status': item.status || 'N/A',
        'Credit Budget': parseFloat(item.credit_budget || 0).toFixed(2),
        'Remaining Balance': parseFloat(item.remaining_balance || 0).toFixed(2),
        'Date Responded': formatDate(item.date_responded)
      }));

      exportData.push({
        'No.': '',
        'ID': '',
        'PWP Code': '',
        'Cover PWP Code': '',
        'Created By': '',
        'Approver ID': '',
        'Response': '',
        'Status': '⭐ GRAND TOTAL',

        'Credit Budget': totalCreditBudget.toFixed(2),
        'Remaining Balance': totalRemainingBalance.toFixed(2),
        'Date Responded': `Total Records: ${filteredData.length}`
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      worksheet['!cols'] = [
        { wch: 5 }, { wch: 8 }, { wch: 15 }, { wch: 15 },
        { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
        { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 20 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved History Budget');

      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Approved_History_Budget_${currentDate}.xlsx`;

      XLSX.writeFile(workbook, filename);

      alert('✅ Excel file exported successfully!');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('❌ Failed to export Excel file. Please try again.');
    }
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
            width: 60, height: 60,
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
    <div style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
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
                History Budget
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={fetchData} style={{
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
              }}>
                🔄 Refresh Data
              </button>
              <button onClick={exportToExcel} style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                padding: '14px 32px',
                borderRadius: 12,
                border: 'none',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                📥 Export to Excel
              </button>
            </div>
          </div>

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
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 10,
                  fontSize: 15,
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                📊 Status Filter
              </label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
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
                onChange={(e) => { setFilterResponse(e.target.value); setCurrentPage(1); }}
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

        <div style={{
          background: 'white',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#2563eb" }}>
                  {[
                    "ID",
                    "PWP Code",
                    "Cover PWP",
                    "Created By",
                    "Response",
                    "Status",
                    "IsPartOfBudget",

                    "Credit Budget",
                    "Remaining",
                    "Date",
                  ].map((text) => (
                    <th
                      key={text}
                      style={{
                        padding: "14px 18px",
                        textAlign: text === "Credit Budget" || text === "Remaining" ? "right" : "left",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 13,
                        letterSpacing: 0.3,
                      }}
                    >
                      {text}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {currentItems.map((item, index) => (
                  <tr
                    key={item.id}
                    style={{
                      background: index % 2 === 0 ? "#f8fafc" : "#ffffff",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={{ padding: "12px 18px" }}>
                      <span
                        style={{
                          background: "#2563eb",
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        #{item.id}
                      </span>
                    </td>

                    <td style={{ padding: "12px 18px", fontWeight: 700, color: "#1e293b" }}>
                      {item.pwp_code}
                    </td>

                    <td style={{ padding: "12px 18px", color: "#475569" }}>
                      {item.cover_pwp_code || "N/A"}
                    </td>

                    <td style={{ padding: "12px 18px", color: "#334155" }}>
                      {item.created_form || "N/A"}
                    </td>

                    <td style={{ padding: "12px 18px", textAlign: "center" }}>
                      <span
                        style={{
                          background: getResponseColor(item.response),
                          color: "white",
                          padding: "5px 14px",
                          borderRadius: 14,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {item.response}
                      </span>
                    </td>

                    <td style={{ padding: "12px 18px", textAlign: "center" }}>
                      <span
                        style={{
                          color: getStatusColor(item.status),
                          background: `${getStatusColor(item.status)}22`,
                          padding: "5px 14px",
                          borderRadius: 14,
                          fontSize: 12,
                          fontWeight: 700,
                          border: `1px solid ${getStatusColor(item.status)}`,
                        }}
                      >
                        {item.status || "N/A"}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        background: item.isPartOfBudget === true ? '#10b98122' : '#ef444422',
                        color: item.isPartOfBudget === true ? '#10b981' : '#ef4444',
                        padding: '5px 14px',
                        borderRadius: 14,
                        fontSize: 12,
                        fontWeight: 700,
                        border: `1px solid ${item.isPartOfBudget === true ? '#10b981' : '#ef4444'}`
                      }}>
                        {item.isPartOfBudget === true ? 'Yes' : item.isPartOfBudget === false ? 'No' : 'N/A'}
                      </span>
                    </td>


                    <td style={{
                      padding: "12px 18px",
                      textAlign: "right",
                      color: item.isPartOfBudget === true ? "#059669" : item.isPartOfBudget === false ? "#3b82f6" : "#6b7280",
                      fontWeight: 800
                    }}>
                      {item.isPartOfBudget === true
                        ? formatCurrency(item.credit_budget)
                        : item.isPartOfBudget === false
                          ? formatCurrency(item.notPartOfBudget)
                          : '-'}
                    </td>

                    <td style={{ padding: "12px 18px", textAlign: "right", color: "#d97706", fontWeight: 800 }}>
                      {formatCurrency(item.remaining_balance)}
                    </td>

                    <td style={{ padding: "12px 18px", color: "#475569", fontSize: 13 }}>
                      {formatDate(item.date_responded)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr style={{ background: "#1e293b" }}>
                  <td
                    colSpan="7"
                    style={{
                      padding: "20px 18px",
                      textAlign: "right",
                      color: "white",
                      fontWeight: 800,
                      fontSize: 16,
                    }}
                  >
                    📊 GRAND TOTALS
                  </td>

                  <td style={{ padding: "20px 18px", textAlign: "right" }}>
                    <div style={{ color: "#10b981", fontSize: 18, fontWeight: 800 }}>
                      {formatCurrency(totalCreditBudget)}
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: 11 }}>CREDIT BUDGET</div>
                  </td>

                  <td style={{ padding: "20px 18px", textAlign: "right" }}>
                    <div style={{ color: "#f59e0b", fontSize: 18, fontWeight: 800 }}>
                      {formatCurrency(totalRemainingBalance)}
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: 11 }}>REMAINING</div>
                  </td>

                  <td style={{ padding: "20px 18px", textAlign: "center" }}>
                    <div style={{ color: "#60a5fa", fontSize: 18, fontWeight: 800 }}>
                      {filteredData.length}
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: 11 }}>RECORDS</div>
                  </td>
                </tr>
              </tfoot>
            </table>

          </div>

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
                    fontWeight: 600
                  }}
                >
                  ← Previous
                </button>

                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
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
                    fontWeight: 600
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
              <p style={{ color: '#6b7280', fontSize: 16 }}>Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
