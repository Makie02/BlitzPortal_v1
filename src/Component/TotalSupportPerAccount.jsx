import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function TotalSupportPerAccount({ setCurrentView }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  const [pivotData, setPivotData] = useState([]);
  const [activityColumns, setActivityColumns] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [paginatedData, setPaginatedData] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = pivotData.filter(item =>
        item.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.pwp_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
      setCurrentPage(1);
    } else {
      setFilteredData(pivotData);
    }
  }, [searchTerm, pivotData]);

  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedData(filteredData.slice(startIndex, endIndex));
  }, [currentPage, itemsPerPage, filteredData]);

  const cleanAccountName = (name) => {
    if (!name) return name;
    return name.replace(/[\[\]"]/g, '').trim();
  };

  const transformToPivot = (sourceData) => {
    const activities = Array.from(new Set(sourceData.map(item => item.activity_name))).filter(Boolean).sort();
    setActivityColumns(activities);

    // Group by account name ONLY (merge same stores from different PWP codes)
    const grouped = {};
    sourceData.forEach(item => {
      const cleanName = cleanAccountName(item.account_name);
      const key = cleanName; // Only use account name as key

      if (!grouped[key]) {
        grouped[key] = {
          pwp_code: item.pwp_code, // Store first PWP code for reference
          account_name: cleanName,
          activities: {}
        };
      }

      if (item.activity_name) {
        if (!grouped[key].activities[item.activity_name]) {
          grouped[key].activities[item.activity_name] = 0;
        }
        const budget = parseFloat(item.budget) || 0;
        const skuTotal = parseFloat(item.sku_total_amount) || 0;
        const creditBudget = parseFloat(item.credit_budget) || 0;
        grouped[key].activities[item.activity_name] += (budget + skuTotal + creditBudget);
      }
    });

    const pivotArray = Object.values(grouped).map((item, idx) => {
      const grandTotal = Object.values(item.activities).reduce((sum, val) => sum + val, 0);
      return {
        ...item,
        grandTotal,
        id: idx
      };
    });

    // Sort by account name
    pivotArray.sort((a, b) => (a.account_name || '').localeCompare(b.account_name || ''));

    setPivotData(pivotArray);
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: approvalData, error: approvalError } = await supabase
        .from('Approval_History')
        .select('PwpCode, Response, DateResponded');

      if (approvalError) throw approvalError;

      const approvedPwpCodes = new Set();
      const pwpDateMap = {};

      approvalData.forEach(approval => {
        if (approval.Response && approval.Response.toLowerCase() === 'approved') {
          const dateRespondedStr = new Date(approval.DateResponded).toISOString().split('T')[0];

          if (dateFrom && dateTo) {
            if (dateRespondedStr >= dateFrom && dateRespondedStr <= dateTo) {
              approvedPwpCodes.add(approval.PwpCode);
              pwpDateMap[approval.PwpCode] = dateRespondedStr;
            }
          } else {
            approvedPwpCodes.add(approval.PwpCode);
            pwpDateMap[approval.PwpCode] = dateRespondedStr;
          }
        }
      });

      const { data: activities, error: actError } = await supabase
        .from('activity')
        .select('code, name');
      if (actError) throw actError;

      const activityMap = {};
      activities.forEach(act => {
        activityMap[act.code] = act.name;
      });

      // ✅ GET CURRENT USER
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || null;
      const userName = currentUser?.name || null;
      const role = currentUser?.UserType || null;

      console.log("=== USER INFO ===");
      console.log("UserID:", userId);
      console.log("UserName:", userName);
      console.log("Role:", role);

      const { data: pwpData, error: pwpError } = await supabase
        .from('regular_pwp')
        .select('regularpwpcode, activity, credit_budget, amount_display, branchType, createForm'); // ✅ Added createForm
      if (pwpError) throw pwpError;

      console.log("\n=== ALL PWP DATA ===");
      console.log("Total:", pwpData.length);
      pwpData.forEach(pwp => {
        console.log(`${pwp.regularpwpcode} | Creator: ${pwp.createForm}`);
      });

      // ✅ FILTER BY USER
      let filteredPwpData = pwpData;
      if (role !== 'admin' && role !== 'Admin') {
        filteredPwpData = pwpData.filter(pwp =>
          String(pwp.createForm) === String(userId) ||
          String(pwp.createForm).toLowerCase() === userName?.toLowerCase()
        );
        console.log("\n=== FILTERED (User only) ===");
        console.log("Count:", filteredPwpData.length);
      } else {
        console.log("\n=== ADMIN MODE (All data) ===");
      }

      const pwpActivityMap = {};
      const pwpCreditBudgetMap = {};
      const pwpAmountDisplayMap = {};
      const pwpBranchTypeMap = {};

      filteredPwpData.forEach(pwp => {
        pwpActivityMap[pwp.regularpwpcode] = pwp.activity;
        pwpCreditBudgetMap[pwp.regularpwpcode] = parseFloat(pwp.credit_budget) || 0;
        pwpAmountDisplayMap[pwp.regularpwpcode] = pwp.amount_display === true;
        pwpBranchTypeMap[pwp.regularpwpcode] = pwp.branchType;
      });



      const { data: budgetData, error: budgetError } = await supabase
        .from('regular_accountlis_badget')
        .select('regularcode, account_name, budget');
      if (budgetError) throw budgetError;

      const { data: skuData, error: skuError } = await supabase
        .from('regular_sku')
        .select('regular_code, account_name, total_amount');
      if (skuError) throw skuError;

      // ✅ FILTER APPROVED CODES: Only include PWP codes from filteredPwpData
      const userPwpCodes = new Set(filteredPwpData.map(pwp => pwp.regularpwpcode));

      console.log("\n=== USER'S PWP CODES ===");
      console.log("Codes:", Array.from(userPwpCodes));

      // ✅ Only show approved PWP codes that belong to this user (or all if admin)
      const filteredApprovedCodes = new Set(
        Array.from(approvedPwpCodes).filter(code => userPwpCodes.has(code))
      );

      console.log("\n=== FILTERED APPROVED CODES ===");
      console.log("Count:", filteredApprovedCodes.size);
      console.log("Codes:", Array.from(filteredApprovedCodes));

      const approvedBudget = budgetData.filter(item => filteredApprovedCodes.has(item.regularcode));
      const approvedSku = skuData.filter(item => filteredApprovedCodes.has(item.regular_code));

      console.log("\n=== FINAL DATA ===");
      console.log("Budget entries:", approvedBudget.length);
      console.log("SKU entries:", approvedSku.length);
      // Split account names with commas and create separate entries
      const expandedBudget = [];
      approvedBudget.forEach(item => {
        const accountNames = item.account_name ? item.account_name.split(',').map(n => n.trim()) : [''];
        accountNames.forEach(singleAccount => {
          expandedBudget.push({
            ...item,
            account_name: singleAccount
          });
        });
      });

      const expandedSku = [];
      approvedSku.forEach(item => {
        const accountNames = item.account_name ? item.account_name.split(',').map(n => n.trim()) : [''];
        accountNames.forEach(singleAccount => {
          expandedSku.push({
            ...item,
            account_name: singleAccount
          });
        });
      });

      const budgetMap = {};
      expandedBudget.forEach(item => {
        const key = `${item.regularcode}|${item.account_name}`;
        if (!budgetMap[key]) budgetMap[key] = 0;
        budgetMap[key] += parseFloat(item.budget) || 0;
      });

      const skuMap = {};
      expandedSku.forEach(item => {
        const key = `${item.regular_code}|${item.account_name}`;
        if (!skuMap[key]) skuMap[key] = 0;
        skuMap[key] += parseFloat(item.total_amount) || 0;
      });

      const accountsSet = new Set([
        ...expandedBudget.map(item => `${item.regularcode}|${item.account_name}`),
        ...expandedSku.map(item => `${item.regular_code}|${item.account_name}`)
      ]);

      let transformedData = [];
      accountsSet.forEach(accountKey => {
        const [pwpCode, accountName] = accountKey.split('|');
        const cleanedAccountName = cleanAccountName(accountName);
        const activityCode = pwpActivityMap[pwpCode];
        const activityName = activityMap[activityCode] || activityCode || 'Unknown';
        const budget = budgetMap[accountKey] || 0;
        const skuTotal = skuMap[accountKey] || 0;
        const showAmount = pwpAmountDisplayMap[pwpCode];
        const creditBudget = pwpCreditBudgetMap[pwpCode] || 0;
        const branchType = pwpBranchTypeMap[pwpCode];

        let finalAmount = budget + skuTotal;
        if (showAmount && branchType && accountName &&
          branchType.toLowerCase().trim() === accountName.toLowerCase().trim()) {
          finalAmount += creditBudget;
        }

        transformedData.push({
          pwp_code: pwpCode,
          account_name: cleanedAccountName,
          activity_name: activityName,
          budget,
          sku_total_amount: skuTotal,
          credit_budget: showAmount && branchType && accountName &&
            branchType.toLowerCase().trim() === accountName.toLowerCase().trim()
            ? creditBudget : 0,
          total_amount: finalAmount,
          DateResponded: pwpDateMap[pwpCode] || null,
        });
      });

      // Handle PWP data with amount_display and split branch types
      const existingKeys = new Set(transformedData.map(d => `${d.pwp_code}|${d.account_name}`));
      const newPwpRows = [];

      filteredPwpData  // ✅ CHANGE THIS!
        .filter(item => item.amount_display === true && filteredApprovedCodes.has(item.regularpwpcode))  // ✅ AND THIS!
        .forEach(item => {
          const branchType = item.branchType || 'Unknown';
          const branches = branchType.split(',').map(name => cleanAccountName(name.trim()));

          branches.forEach(branch => {
            const key = `${item.regularpwpcode}|${branch}`;
            if (!existingKeys.has(key)) {
              newPwpRows.push({
                pwp_code: item.regularpwpcode,
                account_name: branch,
                activity_name: activityMap[item.activity] || item.activity || 'N/A',
                budget: 0,
                sku_total_amount: 0,
                credit_budget: parseFloat(item.credit_budget) || 0,
                total_amount: parseFloat(item.credit_budget) || 0,
                DateResponded: pwpDateMap[item.regularpwpcode] || null,
              });
            }
          });
        });

      const finalData = [...transformedData, ...newPwpRows];

      setData(finalData);
      setFilteredData(finalData);
      transformToPivot(finalData);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (itemId) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map(item => item.id)));
    }
  };

  const getSelectedSummary = () => {
    const selectedItems = filteredData.filter(item => selectedRows.has(item.id));
    const summaryActivities = {};
    let totalGrandTotal = 0;

    selectedItems.forEach(item => {
      Object.entries(item.activities).forEach(([activity, amount]) => {
        summaryActivities[activity] = (summaryActivities[activity] || 0) + amount;
      });
      totalGrandTotal += item.grandTotal;
    });

    return { summaryActivities, totalGrandTotal, count: selectedItems.length };
  };

  const generatePDF = async () => {
    if (selectedRows.size === 0) {
      alert('Please select at least one account to generate PDF');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('l', 'mm', 'a4');

      const selectedItems = filteredData.filter(item => selectedRows.has(item.id));
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Support Per Account - Selected Items', pageWidth / 2, 15, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`, pageWidth / 2, 22, { align: 'center' });

      const tableHeaders = [['Store', ...activityColumns, 'Grand Total']];
      const tableData = selectedItems.map(item => {
        return [
          item.account_name || '',
          ...activityColumns.map(activity => {
            const value = item.activities?.[activity] || 0;
            return value > 0 ? parseFloat(value).toFixed(2) : '-';
          }),
          parseFloat(item.grandTotal).toFixed(2)
        ];
      });

      doc.autoTable({
        head: tableHeaders,
        body: tableData,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [33, 150, 243], fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 7, halign: 'right' },
        columnStyles: {
          0: { cellWidth: 50, halign: 'left' }
        },
        styles: { overflow: 'linebreak', cellPadding: 1.5 },
        margin: { left: 8, right: 8 }
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      const { summaryActivities, totalGrandTotal, count } = getSelectedSummary();

      if (finalY + 60 > pageHeight) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('FOR THE MONTH - HIGHEST CLAIMED SUPPORT', 15, 20);

        const summaryHeaders = [['Activity', 'Percentage', 'Amount']];
        const summaryData = Object.entries(summaryActivities)
          .sort((a, b) => b[1] - a[1])
          .map(([activity, amount]) => {
            const percentage = totalGrandTotal > 0 ? ((amount / totalGrandTotal) * 100).toFixed(1) : '0.0';
            return [
              activity,
              `${percentage}%`,
              parseFloat(amount).toFixed(2)
            ];
          });

        summaryData.push(['GRAND TOTAL', '100%', parseFloat(totalGrandTotal).toFixed(2)]);

        doc.autoTable({
          head: summaryHeaders,
          body: summaryData,
          startY: 25,
          theme: 'grid',
          headStyles: { fillColor: [33, 150, 243], fontSize: 10, fontStyle: 'bold', halign: 'center' },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 100, halign: 'left' },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 50, halign: 'right' }
          },
          styles: { cellPadding: 3 },
          margin: { left: 15 }
        });
      } else {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('FOR THE MONTH - HIGHEST CLAIMED SUPPORT', 15, finalY);

        const summaryHeaders = [['Activity', 'Percentage', 'Amount']];
        const summaryData = Object.entries(summaryActivities)
          .sort((a, b) => b[1] - a[1])
          .map(([activity, amount]) => {
            const percentage = totalGrandTotal > 0 ? ((amount / totalGrandTotal) * 100).toFixed(1) : '0.0';
            return [
              activity,
              `${percentage}%`,
              parseFloat(amount).toFixed(2)
            ];
          });

        summaryData.push(['GRAND TOTAL', '100%', parseFloat(totalGrandTotal).toFixed(2)]);

        doc.autoTable({
          head: summaryHeaders,
          body: summaryData,
          startY: finalY + 5,
          theme: 'grid',
          headStyles: { fillColor: [33, 150, 243], fontSize: 10, fontStyle: 'bold', halign: 'center' },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 100, halign: 'left' },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 50, halign: 'right' }
          },
          styles: { cellPadding: 3 },
          margin: { left: 15 }
        });
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text(`Total Selected Accounts: ${count}`, 15, pageHeight - 10);
      doc.text(`Page ${currentPage}`, pageWidth - 20, pageHeight - 10);

      doc.save(`selected_accounts_report_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please make sure you have internet connection to load jsPDF library.');
    }
  };

  const exportToCSV = () => {
    const dataToExport = selectedRows.size > 0
      ? filteredData.filter(item => selectedRows.has(item.id))
      : filteredData;

    const headers = ['Store', ...activityColumns, 'Grand Total'];
    const rows = dataToExport.map(item => [
      item.account_name || '',
      ...activityColumns.map(activity => {
        const value = item.activities?.[activity] || 0;
        return value ? parseFloat(value).toFixed(2) : '0.00';
      }),
      item.grandTotal ? parseFloat(item.grandTotal).toFixed(2) : '0.00'
    ]);

    const { summaryActivities, totalGrandTotal } = getSelectedSummary();
    const footerTotals = activityColumns.map(activity => {
      const total = summaryActivities[activity] || 0;
      return parseFloat(total).toFixed(2);
    });

    rows.push(['', ...activityColumns.map(() => ''), '']);

    const footerLabel = selectedRows.size > 0
      ? `GRAND TOTAL (${selectedRows.size} selected)`
      : 'GRAND TOTAL';

    rows.push([
      footerLabel,
      ...footerTotals,
      parseFloat(totalGrandTotal).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filename = selectedRows.size > 0
      ? `selected_accounts_${new Date().toISOString().split('T')[0]}.csv`
      : `total_support_per_account_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const script1 = document.createElement('script');
    script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script1.async = true;
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
    script2.async = true;
    document.body.appendChild(script2);

    return () => {
      document.body.removeChild(script1);
      document.body.removeChild(script2);
    };
  }, []);

  const formatCurrency = (value) => {
    if (!value) return '0.00';
    return parseFloat(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = isMobile ? 3 : 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 2) {
        for (let i = 1; i <= Math.min(3, totalPages); i++) pages.push(i);
        if (totalPages > 3) pages.push('...');
        if (totalPages > 3) pages.push(totalPages);
      } else if (currentPage >= totalPages - 1) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 2; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const { summaryActivities, totalGrandTotal, count } = getSelectedSummary();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ textAlign: 'center', background: 'white', padding: isMobile ? '24px' : '32px', borderRadius: '8px', border: '1px solid #e0e0e0', width: '100%', maxWidth: '400px' }}>
          <div style={{
            width: isMobile ? '40px' : '48px',
            height: isMobile ? '40px' : '48px',
            border: '4px solid #e0e0e0',
            borderTopColor: '#2196F3',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#333', fontSize: isMobile ? '14px' : '16px', margin: 0 }}>Loading data...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: isMobile ? '12px' : '24px' }}>
      <div style={{ maxWidth: '100%', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #e0e0e0', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
          <h1 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 'bold', color: '#333', margin: '0 0 16px 0' }}>Total Support Per Account</h1>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginBottom: '16px' }}>
            <input type="text" placeholder={isMobile ? "Search..." : "Search by Store or PWP Code..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: '1', width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {selectedRows.size > 0 && (
                <button
                  onClick={generatePDF}
                  style={{
                    flex: isMobile ? '1' : 'initial',
                    padding: '8px 16px',
                    background: '#FF5722',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}
                >
                  📄 Generate PDF
                </button>
              )}
              <button
                onClick={() => setCurrentView('HighestClaimed')}
                style={{ flex: isMobile ? '1' : 'initial', padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
              >
                Highest Support to Claim
              </button>
              <button onClick={() => setShowDateFilter(!showDateFilter)} style={{ flex: isMobile ? '1' : 'initial', padding: '8px 16px', background: showDateFilter ? '#2196F3' : 'white', color: showDateFilter ? 'white' : '#2196F3', border: '1px solid #2196F3', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>{showDateFilter ? 'Hide' : 'Dates'}</button>
              <button onClick={fetchData} style={{ flex: isMobile ? '1' : 'initial', padding: '8px 16px', background: 'white', color: '#2196F3', border: '1px solid #2196F3', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Refresh</button>
              <button onClick={exportToCSV} style={{ flex: isMobile ? '1' : 'initial', padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Export</button>
            </div>
          </div>
          {showDateFilter && (
            <div style={{ padding: '16px', background: '#f9f9f9', borderRadius: '4px', marginBottom: '16px', border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '12px' }}>Filter by Date Responded</div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', alignItems: isMobile ? 'stretch' : 'center' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>From</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }} /></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>To</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }} /></div>
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', marginTop: isMobile ? '0' : '20px' }}>Clear</button>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '12px', fontSize: isMobile ? '12px' : '14px', color: '#666' }}>
            <div><div style={{ fontWeight: 'bold', color: '#333' }}>Accounts</div><div>{filteredData.length}</div></div>
            <div><div style={{ fontWeight: 'bold', color: '#333' }}>Selected</div><div style={{ color: selectedRows.size > 0 ? '#2196F3' : '#666', fontWeight: selectedRows.size > 0 ? 'bold' : 'normal' }}>{selectedRows.size}</div></div>
            <div><div style={{ fontWeight: 'bold', color: '#333' }}>Activities</div><div>{activityColumns.length}</div></div>
            <div><div style={{ fontWeight: 'bold', color: '#333' }}>Page</div><div>{currentPage} / {totalPages}</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontWeight: 'bold', color: '#333' }}>Per Page</div>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: isMobile ? '12px' : '14px' }}>
                <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {!isMobile && (
          <>
            <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: 'max-content', borderCollapse: 'collapse', minWidth: '100%' }}>
                  <thead><tr style={{ background: '#2196F3' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'white', minWidth: '60px', position: 'sticky', left: 0, background: '#2196F3', zIndex: 3 }}>
                      <input
                        type="checkbox"
                        checked={paginatedData.length > 0 && selectedRows.size === paginatedData.length}
                        onChange={handleSelectAll}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'white', minWidth: '250px', position: 'sticky', left: '60px', background: '#2196F3', zIndex: 3 }}>Store</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'white', minWidth: '140px', background: '#1976D2', position: 'sticky', left: '310px', zIndex: 3 }}>Grand Total</th>
                    {activityColumns.map((activity, idx) => <th key={idx} style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: 'white', minWidth: '140px', whiteSpace: 'normal', wordWrap: 'break-word' }} title={activity}>{activity}</th>)}
                  </tr></thead>
                  <tbody>
                    {paginatedData.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #e0e0e0', background: selectedRows.has(item.id) ? '#E3F2FD' : (index % 2 === 0 ? 'white' : '#fafafa') }}>
                        <td style={{ padding: '12px 16px', textAlign: 'center', position: 'sticky', left: 0, background: selectedRows.has(item.id) ? '#E3F2FD' : 'inherit', zIndex: 2 }}>
                          <input
                            type="checkbox"
                            checked={selectedRows.has(item.id)}
                            onChange={() => handleCheckboxChange(item.id)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#666', position: 'sticky', left: '60px', background: selectedRows.has(item.id) ? '#E3F2FD' : 'inherit', zIndex: 2 }} title={item.account_name}>{item.account_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#1976D2', textAlign: 'right', background: selectedRows.has(item.id) ? '#BBDEFB' : (index % 2 === 0 ? '#E3F2FD' : '#BBDEFB'), position: 'sticky', left: '310px', zIndex: 2 }}>{formatCurrency(item.grandTotal)}</td>
                        {activityColumns.map((activity, idx) => {
                          const value = item.activities?.[activity] || 0;
                          return <td key={idx} style={{ padding: '12px 16px', fontSize: '13px', color: value > 0 ? '#333' : '#999', textAlign: 'right' }}>{value > 0 ? formatCurrency(value) : '-'}</td>;
                        })}
                      </tr>
                    ))}
                    <tr style={{ background: '#f5f5f5', fontWeight: 'bold', borderTop: '2px solid #2196F3' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#333', position: 'sticky', left: 0, background: '#f5f5f5', zIndex: 2 }} colSpan="2">
                        GRAND TOTAL {selectedRows.size > 0 && `(${count} selected)`}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '700', color: 'white', textAlign: 'right', background: '#1976D2', position: 'sticky', left: '310px', zIndex: 2 }}>
                        {formatCurrency(totalGrandTotal)}
                      </td>
                      {activityColumns.map((activity, idx) => {
                        const total = summaryActivities[activity] || 0;
                        return <td key={idx} style={{ padding: '12px 16px', fontSize: '13px', color: '#1976D2', textAlign: 'right', fontWeight: '600' }}>{total > 0 ? formatCurrency(total) : '-'}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {paginatedData.length === 0 && <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>No data found</div>}
            </div>
          </>
        )}
        {isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {paginatedData.length === 0 ? <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #e0e0e0', padding: '32px', textAlign: 'center', color: '#999' }}>No data found</div> : (
              paginatedData.map((item, index) => (
                <div key={index} style={{ background: selectedRows.has(item.id) ? '#E3F2FD' : 'white', borderRadius: '4px', border: selectedRows.has(item.id) ? '2px solid #2196F3' : '1px solid #e0e0e0', padding: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                    <input
                      type="checkbox"
                      checked={selectedRows.has(item.id)}
                      onChange={() => handleCheckboxChange(item.id)}
                      style={{ cursor: 'pointer', width: '20px', height: '20px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '2px solid #2196F3' }}><div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>Store</div><div style={{ fontSize: '14px', fontWeight: '600', color: '#333', wordBreak: 'break-word', paddingRight: '32px' }}>{item.account_name}</div></div>
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '2px solid #2196F3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><div style={{ fontSize: '14px', fontWeight: '600', color: '#1976D2' }}>Grand Total</div><div style={{ fontSize: '16px', fontWeight: '700', color: '#1976D2' }}>{formatCurrency(item.grandTotal)}</div></div>
                  <div><div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', fontWeight: '600' }}>Activities</div>
                    {activityColumns.map((activity, idx) => {
                      const value = item.activities?.[activity] || 0;
                      if (value <= 0) return null;
                      return <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9f9f9' }}><div style={{ fontSize: '13px', color: '#666', flex: 1, paddingRight: '8px' }}>{activity}</div><div style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>{formatCurrency(value)}</div></div>;
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {totalPages > 1 && (
          <div style={{ background: 'white', borderRadius: '4px', border: '1px solid #e0e0e0', marginTop: '16px', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: '#666', fontSize: isMobile ? '12px' : '13px', textAlign: isMobile ? 'center' : 'left' }}>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={{ padding: isMobile ? '6px 10px' : '6px 12px', background: currentPage === 1 ? '#f5f5f5' : 'white', color: currentPage === 1 ? '#999' : '#2196F3', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: isMobile ? '12px' : '13px' }}>First</button>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ padding: isMobile ? '6px 10px' : '6px 12px', background: currentPage === 1 ? '#f5f5f5' : 'white', color: currentPage === 1 ? '#999' : '#2196F3', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: isMobile ? '12px' : '13px' }}>Prev</button>
              {getPageNumbers().map((page, idx) => page === '...' ? <span key={idx} style={{ padding: isMobile ? '6px 8px' : '6px 12px', color: '#999', fontSize: isMobile ? '12px' : '13px' }}>...</span> : <button key={idx} onClick={() => goToPage(page)} style={{ padding: isMobile ? '6px 10px' : '6px 12px', background: currentPage === page ? '#2196F3' : 'white', color: currentPage === page ? 'white' : '#333', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: 'pointer', fontSize: isMobile ? '12px' : '13px', minWidth: isMobile ? '32px' : '36px' }}>{page}</button>)}
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: isMobile ? '6px 10px' : '6px 12px', background: currentPage === totalPages ? '#f5f5f5' : 'white', color: currentPage === totalPages ? '#999' : '#2196F3', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: isMobile ? '12px' : '13px' }}>Next</button>
              <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: isMobile ? '6px 10px' : '6px 12px', background: currentPage === totalPages ? '#f5f5f5' : 'white', color: currentPage === totalPages ? '#999' : '#2196F3', border: '1px solid #e0e0e0', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: isMobile ? '12px' : '13px' }}>Last</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
