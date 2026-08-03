import React, { useState, useEffect, useMemo } from "react";
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
  const [filterStatus, setFilterStatus] = useState("All");
  const [accountUsers, setAccountUsers] = useState([]);
  const [distributorMap, setDistributorMap] = useState({});
  const [activityMap, setActivityMap] = useState({});

  // ── Remarks Modal ──────────────────────────────────────────
  const [selectedRemarks, setSelectedRemarks] = useState(null);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  // ─────────────────────────────────────────────────────────

  // ── Accounting Access ─────────────────────────────────────────
  const [assignedDistributorCodes, setAssignedDistributorCodes] = useState(null);
  const [isAccessLoaded, setIsAccessLoaded] = useState(false);

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('loggedInUser')), []);
  const currentUserId = currentUser?.UserID ? Number(currentUser.UserID) : null;
  const role = currentUser?.role || "";

  useEffect(() => {
    const fetchAccountingAccess = async () => {
      if (!currentUser) { setIsAccessLoaded(true); return; }

      const posCode = currentUser.position || "";
      const uid = currentUser.UserID || currentUser.id;

      try {
        const { data: posData } = await supabase
          .from("position")
          .select("name")
          .eq("code", posCode)
          .single();

        const posName = (posData?.name || "").toLowerCase().trim();

        if (!posName.includes("account")) {
          setAssignedDistributorCodes(null);
          setIsAccessLoaded(true);
          return;
        }

        const { data: accessRows, error: accessErr } = await supabase
          .from("accounting_account_access_for_distributor")
          .select("distributor_id")
          .eq("user_id", uid);

        if (accessErr) throw accessErr;

        const distIds = (accessRows || []).map(r => r.distributor_id);

        if (distIds.length === 0) {
          setAssignedDistributorCodes(new Set());
          setIsAccessLoaded(true);
          return;
        }

        const { data: distRows, error: distErr } = await supabase
          .from("distributors")
          .select("id, code")
          .in("id", distIds);

        if (distErr) throw distErr;

        const codes = (distRows || []).map(d => String(d.code));
        setAssignedDistributorCodes(new Set(codes));
      } catch (err) {
        console.error("Error fetching accounting access:", err);
        setAssignedDistributorCodes(new Set());
      } finally {
        setIsAccessLoaded(true);
      }
    };

    fetchAccountingAccess();
  }, [currentUser]);
  // ─────────────────────────────────────────────────────────────

  // Fetch distributor map
  useEffect(() => {
    const fetchDistributors = async () => {
      const { data, error } = await supabase.from("distributors").select("code, name");
      if (error) { console.error("Error fetching distributors:", error); return; }
      const map = {};
      data.forEach(d => { map[String(d.code)] = d.name; });
      setDistributorMap(map);
    };
    fetchDistributors();
  }, []);

  // Fetch activity map
  useEffect(() => {
    const fetchActivities = async () => {
      const { data, error } = await supabase.from("activity").select("code, name");
      if (error) { console.error("Error fetching activities:", error); return; }
      const map = {};
      data.forEach(a => { map[String(a.code)] = a.name; });
      setActivityMap(map);
    };
    fetchActivities();
  }, []);

  useEffect(() => {
    const fetchAccountUsers = async () => {
      try {
        let allData = [];
        let hasMore = true;
        let offset = 0;
        const batchSize = 1000;

        while (hasMore) {
          const { data, error } = await supabase
            .from("Account_Users")
            .select("UserID, name")
            .range(offset, offset + batchSize - 1);

          if (error) { console.error("Error fetching account users:", error); break; }

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        setAccountUsers(allData);
      } catch (err) {
        console.error("Unexpected error fetching account users:", err);
      }
    };
    fetchAccountUsers();
  }, []);

  const userIdToNameMap = useMemo(() => {
    const map = new Map();
    accountUsers.forEach(u => {
      if (u.UserID && u.name) map.set(Number(u.UserID), u.name);
    });
    return map;
  }, [accountUsers]);

  const getUserNameById = (userId) => {
    if (!userId) return '-';
    const name = userIdToNameMap.get(Number(userId));
    return name || String(userId);
  };

  // Fetch Approval_History + join PWP details
  useEffect(() => {
    if (!isAccessLoaded) return;

    const fetchApprovals = async () => {
      setLoading(true);
      setError(null);

      try {
        let allData = [];
        let hasMore = true;
        let offset = 0;
        const batchSize = 1000;

        while (hasMore) {
          const { data, error } = await supabase
            .from("Approval_History")
            .select("*")
            .order("created_at", { ascending: false })
            .range(offset, offset + batchSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        // ── Enrich with PWP details (distributor, activity, amount, branchType) ──
        const pwpCodes = [...new Set(allData.map(r => r.PwpCode).filter(Boolean))];

        let regularMap = {};
        let coverMap = {};

        if (pwpCodes.length > 0) {
          for (let i = 0; i < pwpCodes.length; i += 1000) {
            const batch = pwpCodes.slice(i, i + 1000);

            const [{ data: regData }, { data: covData }] = await Promise.all([
              supabase
                .from("regular_pwp")
                .select('regularpwpcode, distributor, activity, credit_budget, branchType, "activityDurationFrom", "activityDurationTo"')
                .in("regularpwpcode", batch),
              supabase
                .from("cover_pwp")
                .select("cover_code, distributor, activity, credit_budget")
                .in("cover_code", batch),
            ]);

            (regData || []).forEach(r => {
              regularMap[r.regularpwpcode] = r;
            });
            (covData || []).forEach(r => {
              coverMap[r.cover_code] = r;
            });
          }
        }

        const enriched = allData.map(item => {
          const pwpDetail = regularMap[item.PwpCode] || coverMap[item.PwpCode] || {};
          return {
            ...item,
            distributor: pwpDetail.distributor || null,
            activity_code: pwpDetail.activity || null,
            credit_budget: pwpDetail.credit_budget || null,
            branchType: pwpDetail.branchType || null,
            activityDurationFrom: pwpDetail.activityDurationFrom || null,
            activityDurationTo: pwpDetail.activityDurationTo || null,
            pwpType: regularMap[item.PwpCode] ? "Regular" : coverMap[item.PwpCode] ? "Cover" : "-",
          };
        });

        setApprovalData(enriched);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching approvals:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [isAccessLoaded]);

  // Filter logic
  useEffect(() => {
    let filtered = approvalData;

    // ── Accounting restriction ────────────────────────────────
    if (assignedDistributorCodes !== null) {
      filtered = filtered.filter(item =>
        assignedDistributorCodes.has(String(item.distributor))
      );
    }
    // ─────────────────────────────────────────────────────────

    // Role filter (non-admin sees own records only, unless accounting)
    if (role !== "admin" && assignedDistributorCodes === null) {
      filtered = filtered.filter(item => {
        const createdForm = item.CreatedForm;
        if (!createdForm) return false;
        return Number(createdForm) === currentUserId;
      });
    }

    if (filterStatus !== "All") {
      filtered = filtered.filter(item => item.Response === filterStatus);
    }

    filtered = filtered.filter(item => {
      const matchesSearch =
        item.PwpCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Response?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (distributorMap[String(item.distributor)] || "").toLowerCase().includes(searchTerm.toLowerCase());

      let matchesDate = true;
      if (dateFrom || dateTo) {
        const itemDate = new Date(item.created_at);
        if (dateFrom && itemDate < new Date(dateFrom)) matchesDate = false;
        if (dateTo && itemDate > new Date(dateTo + 'T23:59:59')) matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [approvalData, searchTerm, dateFrom, dateTo, currentUserId, role,
      filterStatus, assignedDistributorCodes, distributorMap]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const getStatusStyle = (response) => {
    switch (response) {
      case 'Approved':   return { bg: '#e8f5e8', color: '#2e7d32' };
      case 'Disapproved': return { bg: '#ffebee', color: '#c62828' };
      case 'Cancelled':  return { bg: '#fff3e0', color: '#e65100' };
      default:           return { bg: '#fff3cd', color: '#8a6d3b' };
    }
  };

  const handleExportToExcel = async () => {
    setExportLoading(true);
    try {
      const exportData = filteredData.map(item => ({
        ID: item.id,
        'PWP Code': item.PwpCode,
        'PWP Type': item.pwpType,
        Distributor: distributorMap[String(item.distributor)] || item.distributor || '-',
        Activity: activityMap[String(item.activity_code)] || item.activity_code || '-',
        Amount: item.credit_budget ?? '-',
        'Branch Type': item.branchType || '-',
        'Activity From': item.activityDurationFrom
          ? new Date(item.activityDurationFrom).toLocaleDateString() : '-',
        'Activity To': item.activityDurationTo
          ? new Date(item.activityDurationTo).toLocaleDateString() : '-',
        Response: item.Response || '-',
        'Date Responded': item.DateResponded
          ? new Date(item.DateResponded).toLocaleString() : '-',
        'Assigned By': getUserNameById(item.CreatedForm),
        'Created At': item.created_at
          ? new Date(item.created_at).toLocaleString() : '-',
        'Remarks/Notes': item.RemarksNote || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "ApprovalHistory");

      const maxLengths = {};
      exportData.forEach(row => {
        Object.keys(row).forEach(key => {
          const length = String(row[key] || '').length;
          maxLengths[key] = Math.max(maxLengths[key] || 0, length, key.length);
        });
      });
      worksheet['!cols'] = Object.keys(maxLengths).map(key => ({
        wch: Math.min(maxLengths[key] + 2, 50)
      }));

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([excelBuffer], { type: "application/octet-stream" }),
        `ApprovalHistory_${new Date().toISOString().split('T')[0]}.xlsx`
      );
    } catch (err) {
      setError('Failed to export Excel file');
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportToPDF = async () => {
    setExportLoading(true);
    try {
      const printWindow = window.open('', '_blank');
      const htmlContent = `
        <!DOCTYPE html><html><head>
          <title>Approval History Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1976d2; }
            .header h1 { color: #1976d2; margin: 0 0 10px; font-size: 24px; }
            .export-info { color: #666; font-size: 14px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px 6px; text-align: left; font-size: 11px; }
            th { background-color: #1976d2; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            @media print { body { margin: 0; } }
          </style>
        </head><body>
          <div class="header">
            <h1>Approval History Report</h1>
            <div class="export-info">
              Generated on: ${new Date().toLocaleDateString()} |
              Total Records: ${filteredData.length}
              ${dateFrom || dateTo ? ` | Date Range: ${dateFrom || 'Start'} to ${dateTo || 'End'}` : ''}
            </div>
          </div>
          <table>
            <thead><tr>
              <th>ID</th><th>PWP Code</th><th>PWP Type</th><th>Distributor</th>
              <th>Activity</th><th>Amount</th><th>Branch Type</th>
              <th>Activity From</th><th>Activity To</th>
              <th>Response</th><th>Date Responded</th><th>Assigned By</th><th>Created At</th><th>Remarks/Notes</th>
            </tr></thead>
            <tbody>
              ${filteredData.map(item => `
                <tr>
                  <td>${item.id}</td>
                  <td>${item.PwpCode || ''}</td>
                  <td>${item.pwpType || '-'}</td>
                  <td>${distributorMap[String(item.distributor)] || item.distributor || '-'}</td>
                  <td>${activityMap[String(item.activity_code)] || item.activity_code || '-'}</td>
                  <td>${item.credit_budget != null ? '₱' + Number(item.credit_budget).toLocaleString() : '-'}</td>
                  <td>${item.branchType || '-'}</td>
                  <td>${item.activityDurationFrom ? new Date(item.activityDurationFrom).toLocaleDateString() : '-'}</td>
                  <td>${item.activityDurationTo ? new Date(item.activityDurationTo).toLocaleDateString() : '-'}</td>
                  <td>${item.Response || ''}</td>
                  <td>${item.DateResponded ? new Date(item.DateResponded).toLocaleString() : '-'}</td>
                  <td>${getUserNameById(item.CreatedForm)}</td>
                  <td>${item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                  <td>${item.RemarksNote || '-'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div class="footer"><p>Automatically generated from the Approval History system.</p></div>
        </body></html>`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } catch (err) {
      setError('Failed to generate PDF');
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setFilterStatus("All");
  };

  const tdStyle = {
    padding: '14px 16px',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '13px',
    color: '#111',
  };

  return (
    <div style={{ padding: "20px", backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 30px', backgroundColor: '#f8f8f8' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '700', color: '#111' }}>
            📋 Approval History
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            {filteredData.length} records found
            {(dateFrom || dateTo) && ` · filtered by date`}
            {role !== 'admin' && assignedDistributorCodes === null && ` · showing your records only`}
            {assignedDistributorCodes !== null && ` · accounting view (${assignedDistributorCodes.size} distributor${assignedDistributorCodes.size !== 1 ? 's' : ''})`}
          </p>
        </div>

        {/* Filters */}
        <div style={{ padding: '20px 30px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>

            {/* Search */}
            <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
              <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: '14px' }} />
              <input
                type="search"
                placeholder="Search PWP Code, Response, Distributor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '10px 12px 10px 35px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', width: '100%', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <FaCalendarAlt style={{ color: '#666', fontSize: '14px' }} />
              <span style={{ fontSize: '14px', color: '#666' }}>From:</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
              <span style={{ color: '#666' }}>To:</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
            </div>

            {/* Status Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['All', 'Approved', 'Disapproved', 'Cancelled'].map(status => {
                const colors = { Approved: '#4caf50', Disapproved: '#f44336', Cancelled: '#ff9800', All: '#2196f3' };
                const color = colors[status];
                return (
                  <button key={status} onClick={() => setFilterStatus(status)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: filterStatus === status ? color : 'white',
                      color: filterStatus === status ? 'white' : '#666',
                      border: `2px solid ${color}`,
                      borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s'
                    }}>
                    {status === 'Approved' && '✓ '}{status === 'Disapproved' && '✕ '}{status === 'Cancelled' && '⊘ '}{status}
                  </button>
                );
              })}
            </div>

            <button onClick={clearFilters}
              style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              Clear Filters
            </button>
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleExportToExcel} disabled={exportLoading}
              style={{ padding: '10px 20px', backgroundColor: exportLoading ? '#ccc' : '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: exportLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaFileExcel />{exportLoading ? 'Generating...' : 'Generate Excel'}
            </button>
            <button onClick={handleExportToPDF} disabled={exportLoading}
              style={{ padding: '10px 20px', backgroundColor: exportLoading ? '#ccc' : '#f44336', color: 'white', border: 'none', borderRadius: '6px', cursor: exportLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaFilePdf />{exportLoading ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #e3f2fd', borderTop: '4px solid #1976d2', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#666' }}>Loading approval history...</p>
          </div>
        )}
        {error && (
          <div style={{ padding: '20px 30px', backgroundColor: '#ffebee', border: '1px solid #ef5350', margin: '20px 30px', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#c62828' }}><strong>Error:</strong> {error}</p>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#2575fc', color: 'white' }}>
                  {['ID', 'PWP Code', 'PWP Type', 'Distributor', 'Activity', 'Amount', 'Branch Type', 'Activity From', 'Activity To', 'Response', 'Date Responded', 'Assigned By', 'Created At', 'Status'].map(h => (
                    <th key={h} style={{ padding: '14px 16px', textAlign: h === 'Status' ? 'center' : 'left', fontWeight: '600', fontSize: '13px', borderBottom: '2px solid #1565c0', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '16px', backgroundColor: '#fafafa' }}>
                      No approval records found.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item, index) => {
                    const statusStyle = getStatusStyle(item.Response);
                    return (
                      <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={tdStyle}>{item.id}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{item.PwpCode || '-'}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', backgroundColor: item.pwpType === 'Regular' ? '#e3f2fd' : '#f3e5f5', color: item.pwpType === 'Regular' ? '#1565c0' : '#6a1b9a' }}>
                            {item.pwpType || '-'}
                          </span>
                        </td>
                        <td style={tdStyle}>{distributorMap[String(item.distributor)] || item.distributor || '-'}</td>
                        <td style={tdStyle}>{activityMap[String(item.activity_code)] || item.activity_code || '-'}</td>
                        <td style={tdStyle}>
                          {item.credit_budget != null
                            ? `₱${Number(item.credit_budget).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
                            : '-'}
                        </td>
                        <td style={{ ...tdStyle, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.branchType || ''}>
                          {item.branchType || '-'}
                        </td>
                        <td style={tdStyle}>
                          {item.activityDurationFrom ? new Date(item.activityDurationFrom).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </td>
                        <td style={tdStyle}>
                          {item.activityDurationTo ? new Date(item.activityDurationTo).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.color}33` }}>
                            {item.Response || 'Pending'}
                          </span>
                        </td>
                        <td style={tdStyle}>{item.DateResponded ? new Date(item.DateResponded).toLocaleString() : '-'}</td>
                        <td style={tdStyle}>{getUserNameById(item.CreatedForm)}</td>
                        <td style={tdStyle}>{item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {item.Response === "Approved" && (
                            <button
                              onClick={() => {
                                setSelectedRemarks(item);
                                setShowRemarksModal(true);
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', backgroundColor: '#e8f5e8',
                                color: '#2e7d32', border: '1px solid #4caf50',
                                borderRadius: '6px', cursor: 'pointer',
                                fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap'
                              }}
                            >
                              <FaCheckCircle size={14} />
                              View Remarks/Notes
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ padding: '20px 30px', backgroundColor: '#fafafa', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Showing {paginatedData.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to{' '}
            {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} records
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
              style={{ padding: '8px 16px', backgroundColor: currentPage === 1 ? '#f5f5f5' : '#2196f3', color: currentPage === 1 ? '#999' : 'white', border: 'none', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
              Previous
            </button>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                    style={{ padding: '8px 12px', backgroundColor: currentPage === pageNum ? '#1976d2' : 'white', color: currentPage === pageNum ? 'white' : '#333', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', minWidth: '40px' }}>
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}
              style={{ padding: '8px 16px', backgroundColor: currentPage === totalPages || totalPages === 0 ? '#f5f5f5' : '#2196f3', color: currentPage === totalPages || totalPages === 0 ? '#999' : 'white', border: 'none', borderRadius: '6px', cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Remarks/Notes Modal */}
      {showRemarksModal && selectedRemarks && (
        <div
          onClick={() => setShowRemarksModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white', borderRadius: '10px', padding: '24px',
              width: '90%', maxWidth: '450px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#111' }}>Remarks / Notes</h3>
              <button
                onClick={() => setShowRemarksModal(false)}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
              PWP Code: <strong>{selectedRemarks.PwpCode}</strong>
            </div>
            <div style={{
              backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: '6px',
              padding: '14px', fontSize: '14px', color: '#333', minHeight: '60px', whiteSpace: 'pre-wrap'
            }}>
              {selectedRemarks.RemarksNote || 'No remarks/notes available.'}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
    </div>
  );
};

export default ApprovalList;
