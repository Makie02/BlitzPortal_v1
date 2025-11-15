import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function HighestClaimed({ setCurrentView }) {
  const [distributors, setDistributors] = useState([]);
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [distributorData, setDistributorData] = useState([]);
  const [distributorActivityColumns, setDistributorActivityColumns] = useState([]);
  const [distributorMonthFilter, setDistributorMonthFilter] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [previousMonthData, setPreviousMonthData] = useState({});
  const [currentMonthData, setCurrentMonthData] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchDistributors();
  }, []);

  const cleanAccountName = (name) => {
    if (!name) return name;
    return name.replace(/[\[\]"]/g, '').trim();
  };

 const fetchDistributors = async () => {
    try {
      const { data: pwpData, error: pwpError } = await supabase
        .from('regular_pwp')
        .select('distributor, createForm');

      if (pwpError) throw pwpError;

      console.log("PWP RAW DATA:", pwpData);

      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || null;
      const role = currentUser?.role || null;

      console.log("=== USER INFO ===");
      console.log("UserID:", userId);
      console.log("Role:", role);

      let matchedCreateForm;

      if (role?.toLowerCase() === 'admin') {
        console.log("=== ADMIN MODE: Showing all distributors ===");
        matchedCreateForm = pwpData;
      } else {
        matchedCreateForm = pwpData.filter(
          item => String(item.createForm) === String(userId)
        );
        console.log("=== USER MODE: Filtered by createForm ===");
      }

      console.log("=== MATCHED DISTRIBUTORS COUNT ===", matchedCreateForm.length);

      const uniqueCodes = [...new Set(
        matchedCreateForm.map(item => item.distributor).filter(Boolean)
      )];

      if (uniqueCodes.length === 0) {
        setDistributors([]);
        return;
      }

      const { data: distData, error: distError } = await supabase
        .from('distributors')
        .select('name, code')
        .in('code', uniqueCodes)
        .order('name', { ascending: true });

      if (distError) throw distError;

      setDistributors(distData || []);

    } catch (error) {
      console.error('Error fetching distributors:', error.message);
    }
  };


const fetchDistributorData = async (distributor, monthFilter = '') => {
  try {
    setLoading(true);

    console.log("\n========================================");
    console.log("🚀 FETCHING DISTRIBUTOR DATA");
    console.log("========================================");
    console.log("Distributor Code:", distributor);
    console.log("Month Filter:", monthFilter || "ALL TIME");

    const { data: approvalData, error: approvalError } = await supabase
      .from('Approval_History')
      .select('PwpCode, Response, DateResponded');

    if (approvalError) throw approvalError;

    const approvedPwpCodes = new Set();
    const pwpDateMap = {};

    approvalData.forEach(approval => {
      if (approval.Response && approval.Response.toLowerCase() === 'approved') {
        approvedPwpCodes.add(approval.PwpCode);
        pwpDateMap[approval.PwpCode] = approval.DateResponded;
      }
    });

    console.log("\n✅ APPROVED PWP CODES:", approvedPwpCodes.size);

    const months = [...new Set(approvalData
      .filter(a => a.Response && a.Response.toLowerCase() === 'approved' && a.DateResponded)
      .map(a => {
        const date = new Date(a.DateResponded);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      })
    )].sort().reverse();
    setAvailableMonths(months);

    console.log("📅 Available Months:", months);

    const { data: activities, error: actError } = await supabase
      .from('activity')
      .select('code, name');
    if (actError) throw actError;

    const activityMap = {};
    activities.forEach(act => {
      activityMap[act.code] = act.name;
    });

    console.log("\n🎯 ACTIVITY MAP:", activityMap);

    const { data: pwpData, error: pwpError } = await supabase
      .from('regular_pwp')
      .select('regularpwpcode, distributor, activity, credit_budget, amount_display, branchType')
      .eq('distributor', distributor);

    if (pwpError) throw pwpError;

    console.log("\n📦 PWP DATA (filtered by distributor):", pwpData.length, "records");

    const filteredPwp = pwpData.filter(item => approvedPwpCodes.has(item.regularpwpcode));

    console.log("✅ APPROVED PWP DATA:", filteredPwp.length, "records");

    const pwpActivityMap = {};
    filteredPwp.forEach(pwp => {
      pwpActivityMap[pwp.regularpwpcode] = pwp.activity;
    });

    const { data: budgetData, error: budgetError } = await supabase
      .from('regular_accountlis_badget')
      .select('regularcode, account_name, budget')
      .in('regularcode', filteredPwp.map(p => p.regularpwpcode));

    if (budgetError) throw budgetError;

    console.log("\n💰 BUDGET DATA:", budgetData.length, "records");

    const storeMap = {};

    console.log("\n🔍 PROCESSING BUDGET DATA ONLY:");
    budgetData.forEach(item => {
      const accountNames = item.account_name ? item.account_name.split(',').map(n => n.trim()) : [''];
      const activityCode = pwpActivityMap[item.regularcode];
      const activityName = activityMap[activityCode] || activityCode || 'Unknown';
      const dateResponded = pwpDateMap[item.regularcode];
      const totalAmount = parseFloat(item.budget) || 0;
      const amountPerStore = accountNames.length > 0 ? totalAmount / accountNames.length : 0;

      accountNames.forEach(accountName => {
        const storeName = cleanAccountName(accountName);
        if (!storeName || storeName === '') return;

        console.log(`💰 BUDGET: ${item.regularcode} | ${storeName} | ${activityName} | ${amountPerStore}`);

        if (!storeMap[storeName]) {
          storeMap[storeName] = {
            store: storeName,
            activities: {},
            dates: {},
            activitiesByMonth: {}
          };
        }
        if (!storeMap[storeName].activities[activityName]) {
          storeMap[storeName].activities[activityName] = 0;
        }
        storeMap[storeName].activities[activityName] += amountPerStore;

        if (dateResponded) {
          const d = new Date(dateResponded);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

          if (!storeMap[storeName].activitiesByMonth[monthKey]) {
            storeMap[storeName].activitiesByMonth[monthKey] = {};
          }
          if (!storeMap[storeName].activitiesByMonth[monthKey][activityName]) {
            storeMap[storeName].activitiesByMonth[monthKey][activityName] = 0;
          }
          storeMap[storeName].activitiesByMonth[monthKey][activityName] += amountPerStore;

          if (!storeMap[storeName].dates[activityName]) {
            storeMap[storeName].dates[activityName] = [];
          }
          storeMap[storeName].dates[activityName].push(dateResponded);
        }
      });
    });

    let allTimeData = Object.values(storeMap).sort((a, b) => a.store.localeCompare(b.store));

    console.log("\n🏪 TOTAL STORES:", allTimeData.length);

    const calculateMonthData = (monthKey) => {
      const monthTotals = {};
      allTimeData.forEach(store => {
        if (store.activitiesByMonth && store.activitiesByMonth[monthKey]) {
          Object.entries(store.activitiesByMonth[monthKey]).forEach(([activity, amount]) => {
            monthTotals[activity] = (monthTotals[activity] || 0) + amount;
          });
        }
      });
      return monthTotals;
    };

    const currentMonthKey = monthFilter || (() => {
      const allMonths = new Set();
      allTimeData.forEach(r => {
        if (r.activitiesByMonth) {
          Object.keys(r.activitiesByMonth).forEach(k => allMonths.add(k));
        }
      });
      return Array.from(allMonths).sort().reverse()[0] || null;
    })();

    const prevMonthKey = currentMonthKey ? (() => {
      const [year, month] = currentMonthKey.split('-').map(Number);
      const prev = new Date(year, month - 2);
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    })() : null;

    setCurrentMonthData(calculateMonthData(currentMonthKey));
    setPreviousMonthData(calculateMonthData(prevMonthKey));

    let displayData = allTimeData;
    if (monthFilter) {
      displayData = allTimeData.map(store => {
        const filteredActivities = store.activitiesByMonth && store.activitiesByMonth[monthFilter]
          ? { ...store.activitiesByMonth[monthFilter] }
          : {};
        return { ...store, activities: filteredActivities };
      }).filter(store => Object.keys(store.activities).length > 0);
    }

    const allActivities = new Set();
    displayData.forEach(store => {
      Object.keys(store.activities).forEach(activity => allActivities.add(activity));
    });
    const sortedActivities = Array.from(allActivities).sort();

    console.log("\n📋 ACTIVITIES FOUND:", sortedActivities);

    console.log("\n========================================");
    console.log("📊 STORE-LEVEL DATA TABLE");
    console.log("========================================");

    const tableData = displayData.map(store => {
      const row = { Store: store.store };
      sortedActivities.forEach(activity => {
        row[activity] = store.activities[activity]
          ? parseFloat(store.activities[activity]).toFixed(2)
          : '-';
      });
      row['Grand Total'] = Object.values(store.activities)
        .reduce((sum, val) => sum + val, 0)
        .toFixed(2);
      return row;
    });

    console.table(tableData);

    console.log("\n========================================");
    console.log("📈 ACTIVITY SUMMARY");
    console.log("========================================");

    const activityTotals = {};
    displayData.forEach(store => {
      Object.entries(store.activities).forEach(([activity, amount]) => {
        activityTotals[activity] = (activityTotals[activity] || 0) + amount;
      });
    });

    const grandTotal = Object.values(activityTotals).reduce((sum, val) => sum + val, 0);

    const summaryTable = Object.entries(activityTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([activity, amount]) => ({
        Activity: activity,
        Amount: parseFloat(amount).toFixed(2),
        Percentage: ((amount / grandTotal) * 100).toFixed(1) + '%'
      }));

    console.table(summaryTable);

    console.log("\n💵 GRAND TOTAL:", parseFloat(grandTotal).toFixed(2));
    console.log("========================================\n");

    setDistributorActivityColumns(sortedActivities);
    setDistributorData(displayData);

  } catch (error) {
    console.error('❌ Error fetching distributor data:', error);
    alert('Error loading distributor data: ' + error.message);
  } finally {
    setLoading(false);
  }
};

  const formatCurrency = (value) => {
    if (!value) return '0.00';
    return parseFloat(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const generateExcel = () => {
    if (!selectedDistributor || distributorData.length === 0) {
      alert('No data to export');
      return;
    }

    const wb = XLSX.utils.book_new();
    const distributorName = distributors.find(d => d.code === selectedDistributor)?.name || 'Distributor';
    const monthDisplay = distributorMonthFilter ? (() => {
      const [year, m] = distributorMonthFilter.split('-');
      return new Date(year, parseInt(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    })() : 'All Time';

    const storeGrandTotal = filteredDistributorData.reduce((sum, row) => {
      return sum + Object.values(row.activities).reduce((s, v) => s + v, 0);
    }, 0);

    const activityTotals = {};
    filteredDistributorData.forEach(row => {
      Object.entries(row.activities).forEach(([activity, amount]) => {
        activityTotals[activity] = (activityTotals[activity] || 0) + amount;
      });
    });

    const sortedActivities = Object.entries(activityTotals).sort((a, b) => b[1] - a[1]);
    const prevTotal = Object.values(previousMonthData).reduce((sum, val) => sum + val, 0);

    const summaryData = [
      [`Highest Claimed Support - ${distributorName}`],
      [`Period: ${monthDisplay}`],
      [],
      ['Activity', 'Current Month %', 'Previous Month %', 'Amount']
    ];

    sortedActivities.forEach(([activity, amount]) => {
      const currentPct = storeGrandTotal > 0 ? (amount / storeGrandTotal) * 100 : 0;
      const prevAmt = previousMonthData[activity] || 0;
      const prevPct = prevTotal > 0 ? (prevAmt / prevTotal) * 100 : 0;

      summaryData.push([
        activity,
        `${currentPct.toFixed(0)}%`,
        prevAmt > 0 ? `${prevPct.toFixed(0)}%` : '-',
        amount
      ]);
    });

    summaryData.push([]);
    summaryData.push(['GRAND TOTAL', '', '', storeGrandTotal]);

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    const breakdownData = [
      [`Store-Level Breakdown - ${distributorName}`],
      [`Period: ${monthDisplay}`],
      [],
      ['Store', 'Last Claim Date', ...distributorActivityColumns, 'Grand Total']
    ];

    filteredDistributorData.forEach(row => {
      const grandTotal = Object.values(row.activities).reduce((sum, val) => sum + val, 0);
      const latestDate = row.dates && Object.values(row.dates).flat().sort().reverse()[0];
      const displayDate = latestDate
        ? new Date(latestDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '-';

      const rowData = [
        row.store,
        displayDate,
        ...distributorActivityColumns.map(activity => row.activities[activity] || 0),
        grandTotal
      ];
      breakdownData.push(rowData);
    });

    const totalsRow = [
      'GRAND TOTAL',
      '',
      ...distributorActivityColumns.map(activity => {
        return filteredDistributorData.reduce((sum, r) => sum + (r.activities[activity] || 0), 0);
      }),
      filteredDistributorData.reduce((sum, r) => sum + Object.values(r.activities).reduce((s, v) => s + v, 0), 0)
    ];
    breakdownData.push(totalsRow);

    const ws2 = XLSX.utils.aoa_to_sheet(breakdownData);
    const colWidths = [
      { wch: 25 },
      { wch: 15 },
      ...distributorActivityColumns.map(() => ({ wch: 18 })),
      { wch: 18 }
    ];
    ws2['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws2, 'Store Breakdown');

    const filename = `Highest_Claimed_Support_${distributorName.replace(/\s+/g, '_')}_${monthDisplay.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const filteredDistributorData = distributorData;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: isMobile ? '12px' : '24px' }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? '18px' : '24px', fontWeight: 'bold', color: '#333' }}>
              Highest Support to Claim
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {selectedDistributor && distributorData.length > 0 && (
                <button
                  onClick={generateExcel}
                  style={{
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Export to Excel"
                >
                  📊 Export Excel
                </button>
              )}

              <button
                onClick={() => {
                  if (selectedDistributor) {
                    setDistributorMonthFilter('');
                    setDistributorData([]);
                    setAvailableMonths([]);
                    setPreviousMonthData({});
                    setCurrentMonthData({});
                    fetchDistributorData(selectedDistributor, '');
                  }
                }}
                style={{
                  background: '#1976D2',
                  color: 'white',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🔄 Reset
              </button>

              <button
                onClick={() => setCurrentView('/')}
                style={{
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                ← Back
              </button>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              gap: '20px',
              marginBottom: '24px',
              alignItems: 'flex-start',
              flexDirection: isMobile ? 'column' : 'row'
            }}>

              <div style={{ flex: 1, width: '100%' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>Select Distributor</label>
                <select
                  value={selectedDistributor}
                  onChange={(e) => {
                    const newDistributorCode = e.target.value;
                    console.log("\n========================================");
                    console.log("🔵 DISTRIBUTOR SELECTED:", newDistributorCode);
                    console.log("========================================");

                    setSelectedDistributor(newDistributorCode);
                    setDistributorMonthFilter('');

                    if (newDistributorCode) {
                      // Find distributor name
                      const distName = distributors.find(d => d.code === newDistributorCode)?.name;
                      console.log("📌 Distributor Name:", distName);
                      console.log("📌 Distributor Code:", newDistributorCode);
                      console.log("⏳ Fetching data...\n");

                      fetchDistributorData(newDistributorCode, '');
                    } else {
                      setDistributorData([]);
                      setAvailableMonths([]);
                    }
                  }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
                >
                  <option value="">-- Select Distributor --</option>
                  {distributors.map((dist, idx) => (
                    <option key={dist.code || idx} value={dist.code}>
                      {dist.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDistributor && availableMonths.length > 0 && (
                <div style={{ flex: 1, width: '100%' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
                    Filter by Month
                  </label>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={distributorMonthFilter}
                      onChange={(e) => {
                        const newMonth = e.target.value;
                        setDistributorMonthFilter(newMonth);
                        fetchDistributorData(selectedDistributor, newMonth);
                      }}
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
                    >
                      <option value="" disabled>Select Month</option>
                      {availableMonths.map((month, idx) => {
                        const [year, m] = month.split('-');
                        const monthName = new Date(year, parseInt(m) - 1).toLocaleString('default', { month: 'long' });
                        return (
                          <option key={idx} value={month}>
                            {monthName} {year}
                          </option>
                        );
                      })}
                    </select>

                    {distributorMonthFilter && (
                      <button
                        onClick={() => {
                          setDistributorMonthFilter('');
                          fetchDistributorData(selectedDistributor, '');
                        }}
                        style={{
                          padding: '10px 16px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          height: '42px'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  border: '4px solid #e0e0e0',
                  borderTopColor: '#2196F3',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <p style={{ color: '#666', fontSize: '14px' }}>Loading data...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {!loading && selectedDistributor && distributorData.length > 0 && (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', flexDirection: isMobile ? 'column' : 'row' }}>

                    <div style={{
                      flex: '1',
                      minWidth: isMobile ? '100%' : '350px',
                      background: 'white',
                      padding: '24px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      border: '1px solid #e0e0e0'
                    }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {distributorMonthFilter ? (() => {
                          const [year, m] = distributorMonthFilter.split('-');
                          return `FOR THE MONTH OF ${new Date(year, parseInt(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}`;
                        })() : 'FOR THE MONTH OF ALL TIME'}
                      </h3>

                      {(() => {
                        const storeGrandTotal = filteredDistributorData.reduce((sum, row) => {
                          return sum + Object.values(row.activities).reduce((s, v) => s + v, 0);
                        }, 0);

                        const activityTotals = {};
                        filteredDistributorData.forEach(row => {
                          Object.entries(row.activities).forEach(([activity, amount]) => {
                            activityTotals[activity] = (activityTotals[activity] || 0) + amount;
                          });
                        });

                        const sortedActivities = Object.entries(activityTotals).sort((a, b) => b[1] - a[1]);
                        const prevMonthKey = distributorMonthFilter ? (() => {
                          const [year, month] = distributorMonthFilter.split('-').map(Number);
                          const prev = new Date(year, month - 2);
                          return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
                        })() : null;

                        const formatMonth = (mk) => {
                          if (!mk) return 'PREVIOUS';
                          const [yy, mm] = mk.split('-');
                          const dt = new Date(Number(yy), Number(mm) - 1);
                          return dt.toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();
                        };
                        const currentMonthName = distributorMonthFilter
                          ? (() => {
                            const [year, m] = distributorMonthFilter.split('-');
                            return new Date(year, parseInt(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();
                          })()
                          : 'ALL TIME';
                        const prevMonthName = prevMonthKey ? formatMonth(prevMonthKey) : 'PREVIOUS';

                        return (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid #2196F3' }}>
                                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', color: '#333', minWidth: '160px' }}>
                                    HIGHEST CLAIMED SUPPORT
                                  </th>
                                  <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '700', color: '#3B82F6', minWidth: '70px' }}>
                                    {currentMonthName}
                                  </th>
                                  <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '700', color: '#F97316', minWidth: '70px' }}>
                                    {prevMonthName}
                                  </th>
                                  <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: '#333', minWidth: '120px' }}>
                                    {formatCurrency(storeGrandTotal)}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedActivities.map(([activity, amount]) => {
                                  const currentPct = storeGrandTotal > 0 ? (amount / storeGrandTotal) * 100 : 0;
                                  const prevAmt = previousMonthData[activity
                                  ] || 0;
                                  const prevTotal = Object.values(previousMonthData).reduce((s, v) => s + v, 0);
                                  const prevPct = prevTotal > 0 ? (prevAmt / prevTotal) * 100 : 0;

                                  return (
                                    <tr key={activity} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                      <td style={{ padding: '10px 8px', color: '#333', fontWeight: '500' }}>{activity}</td>
                                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#3B82F6', fontWeight: '600' }}>
                                        {currentPct.toFixed(0)}%
                                      </td>
                                      <td style={{ padding: '10px 8px', textAlign: 'center', color: prevAmt > 0 ? '#F97316' : '#ccc', fontWeight: '600' }}>
                                        {prevAmt > 0 ? `${prevPct.toFixed(0)}%` : '-'}
                                      </td>
                                      <td style={{ padding: '10px 8px', textAlign: 'right', color: amount > 0 ? '#333' : '#999', fontWeight: '600' }}>
                                        {amount > 0 ? formatCurrency(amount) : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{
                      flex: '2',
                      minWidth: isMobile ? '100%' : '550px',
                      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                      padding: '32px',
                      borderRadius: '16px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
                    }}>
                      <h3 style={{ margin: '0 0 28px 0', fontSize: '22px', fontWeight: '700', color: 'white', textAlign: 'center', letterSpacing: '1px', textTransform: 'uppercase' }}>Activity Chart</h3>
                      <div style={{ position: 'relative', height: '380px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <svg width="100%" height="100%" viewBox="0 0 900 320" preserveAspectRatio="xMidYMid meet">
                          <defs>
                            <linearGradient id="blueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" style={{ stopColor: '#60A5FA', stopOpacity: 1 }} />
                              <stop offset="100%" style={{ stopColor: '#3B82F6', stopOpacity: 1 }} />
                            </linearGradient>
                            <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" style={{ stopColor: '#FB923C', stopOpacity: 1 }} />
                              <stop offset="100%" style={{ stopColor: '#F97316', stopOpacity: 1 }} />
                            </linearGradient>
                            <filter id="shadow">
                              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                            </filter>
                          </defs>

                          {[0, 20, 40, 60, 80, 100].map((val, i) => {
                            const yPos = 260 - (val / 100) * 220;
                            return (
                              <g key={i}>
                                <line x1="90" y1={yPos} x2="820" y2={yPos} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="5,5" />
                                <text x="75" y={yPos + 5} fill="rgba(255,255,255,0.7)" fontSize="12" textAnchor="end" fontWeight="500">{val}%</text>
                              </g>
                            );
                          })}

                          {(() => {
                            const storeGrandTotal = filteredDistributorData.reduce((sum, row) => {
                              return sum + Object.values(row.activities).reduce((s, v) => s + v, 0);
                            }, 0);

                            const activityTotals = {};
                            filteredDistributorData.forEach(row => {
                              Object.entries(row.activities).forEach(([activity, amount]) => {
                                activityTotals[activity] = (activityTotals[activity] || 0) + amount;
                              });
                            });

                            const prevTotal = Object.values(previousMonthData).reduce((sum, val) => sum + val, 0);

                            const sortedActivities = Object.entries(activityTotals)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 6);

                            const barWidth = 28;
                            const groupWidth = 85;
                            const startX = 140;
                            const MAX_CHART_HEIGHT = 220;

                            const getCurrentMonthName = () => {
                              if (!distributorMonthFilter) return 'CURRENT';
                              const [year, m] = distributorMonthFilter.split('-');
                              return new Date(year, parseInt(m) - 1).toLocaleString('default', { month: 'short' }).toUpperCase();
                            };

                            const getPrevMonthName = () => {
                              if (!distributorMonthFilter) return 'PREVIOUS';
                              const [year, m] = distributorMonthFilter.split('-');
                              const prev = new Date(year, parseInt(m) - 2);
                              return prev.toLocaleString('default', { month: 'short' }).toUpperCase();
                            };

                            return (
                              <>
                                {sortedActivities.map(([activity, total], idx) => {
                                  const currentPercentage = storeGrandTotal > 0 ? (total / storeGrandTotal * 100) : 0;
                                  const currentBarHeight = (currentPercentage / 100) * MAX_CHART_HEIGHT;
                                  const xPos = startX + (idx * groupWidth);

                                  const prevAmount = previousMonthData[activity] || 0;
                                  const prevPercentage = prevTotal > 0 ? (prevAmount / prevTotal * 100) : 0;
                                  const prevBarHeight = (prevPercentage / 100) * MAX_CHART_HEIGHT;

                                  return (
                                    <g key={activity}>
                                      {prevTotal > 0 && (
                                        <>
                                          <rect
                                            x={xPos}
                                            y={260 - prevBarHeight}
                                            width={barWidth}
                                            height={prevBarHeight}
                                            fill="url(#orangeGrad)"
                                            rx="3"
                                            filter="url(#shadow)"
                                          />
                                          <text
                                            x={xPos + barWidth / 2}
                                            y={260 - prevBarHeight - 8}
                                            fill="white"
                                            fontSize="13"
                                            fontWeight="700"
                                            textAnchor="middle"
                                          >
                                            {prevPercentage.toFixed(0)}%
                                          </text>
                                        </>
                                      )}

                                      <rect
                                        x={xPos + (prevTotal > 0 ? barWidth + 6 : 0)}
                                        y={260 - currentBarHeight}
                                        width={barWidth}
                                        height={currentBarHeight}
                                        fill="url(#blueGrad)"
                                        rx="3"
                                        filter="url(#shadow)"
                                      />
                                      <text
                                        x={xPos + (prevTotal > 0 ? barWidth + 6 : 0) + barWidth / 2}
                                        y={260 - currentBarHeight - 8}
                                        fill="white"
                                        fontSize="13"
                                        fontWeight="700"
                                        textAnchor="middle"
                                      >
                                        {currentPercentage.toFixed(0)}%
                                      </text>

                                      <text
                                        x={xPos + barWidth}
                                        y={275}
                                        fill="rgba(255,255,255,0.9)"
                                        fontSize="11"
                                        textAnchor="middle"
                                        transform={`rotate(-35, ${xPos + barWidth}, 275)`}
                                        fontWeight="500"
                                      >
                                        {activity.length > 18 ? activity.substring(0, 18) + '...' : activity}
                                      </text>
                                    </g>
                                  );
                                })}

                                <g transform="translate(340, 305)">
                                  {Object.keys(previousMonthData).length > 0 && (
                                    <>
                                      <rect x="0" y="0" width="18" height="12" fill="url(#orangeGrad)" rx="3" filter="url(#shadow)" />
                                      <text x="24" y="10" fill="white" fontSize="12" fontWeight="600">{getPrevMonthName()}</text>
                                    </>
                                  )}

                                  <rect x={Object.keys(previousMonthData).length > 0 ? "110" : "0"} y="0" width="18" height="12" fill="url(#blueGrad)" rx="3" filter="url(#shadow)" />
                                  <text x={Object.keys(previousMonthData).length > 0 ? "134" : "24"} y="10" fill="white" fontSize="12" fontWeight="600">{getCurrentMonthName()}</text>
                                </g>
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>
                  </div>

                  <h3 style={{ margin: '32px 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#333', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Store-Level Breakdown
                  </h3>

                  <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#2196F3', color: 'white' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', minWidth: '180px', position: 'sticky', left: 0, background: '#2196F3', zIndex: 3 }}>Store</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', minWidth: '120px' }}>Last Claim Date</th>
                          {distributorActivityColumns.map((activity, idx) => (
                            <th key={idx} style={{ padding: '12px', textAlign: 'right', fontWeight: '600', minWidth: '140px', whiteSpace: 'normal', wordWrap: 'break-word' }} title={activity}>{activity}</th>
                          ))}
                          <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', background: '#1976D2', minWidth: '140px', position: 'sticky', right: 0, zIndex: 3 }}>Grand Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDistributorData.map((row, idx) => {
                          const grandTotal = Object.values(row.activities).reduce((sum, val) => sum + val, 0);
                          const latestDate = row.dates && Object.values(row.dates).flat().sort().reverse()[0];
                          const displayDate = latestDate
                            ? new Date(latestDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                            : '-';

                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                              <td style={{ padding: '12px', fontWeight: '500', color: '#333', position: 'sticky', left: 0, background: 'inherit', zIndex: 2 }}>
                                {row.store}
                              </td>
                              <td style={{ padding: '12px', color: '#666', fontSize: '12px' }}>{displayDate}</td>
                              {distributorActivityColumns.map((activity, actIdx) => {
                                const value = row.activities[activity] || 0;
                                return (
                                  <td key={actIdx} style={{ padding: '12px', textAlign: 'right', color: value > 0 ? '#333' : '#999' }}>
                                    {value > 0 ? formatCurrency(value) : '-'}
                                  </td>
                                );
                              })}
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#1976D2', background: idx % 2 === 0 ? '#E3F2FD' : '#BBDEFB', position: 'sticky', right: 0, zIndex: 2 }}>
                                {formatCurrency(grandTotal)}
                              </td>
                            </tr>
                          );
                        })}

                        <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
                          <td style={{ padding: '12px', fontWeight: '700', color: '#333', position: 'sticky', left: 0, background: '#f5f5f5', zIndex: 2 }} colSpan="2">
                            GRAND TOTAL
                          </td>
                          {distributorActivityColumns.map((activity, actIdx) => {
                            const total = filteredDistributorData.reduce((sum, r) => sum + (r.activities[activity] || 0), 0);
                            return (
                              <td key={actIdx} style={{ padding: '12px', textAlign: 'right', color: '#1976D2' }}>
                                {formatCurrency(total)}
                              </td>
                            );
                          })}
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: 'white', background: '#1976D2', position: 'sticky', right: 0, zIndex: 2 }}>
                            {formatCurrency(filteredDistributorData.reduce((sum, r) => sum + Object.values(r.activities).reduce((s, v) => s + v, 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!loading && selectedDistributor && distributorData.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: '#999', fontSize: '14px' }}>
                No data found for this distributor
              </div>
            )}

            {!loading && !selectedDistributor && (
              <div style={{ textAlign: 'center', padding: '48px', color: '#999', fontSize: '14px' }}>
                Please select a distributor to view data
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
