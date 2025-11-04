
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";
import RecordViewModal from "./RecordViewModal";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import PDFViewModal from "./PDFViewModal";
function RecordsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState([]);
  const [updating] = useState(false);
  const [filter, setFilter] = useState("regular"); // all | cover | regular
  const [statusFilter, setStatusFilter] = useState("all"); // all | approved | declined | sent_back | cancelled
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [setRowsPerPage] = useState(10);

  // Define the specific columns to show for each table (moved outside component or use useMemo)

  const handleViewRecord = (record) => {
    console.log("Selected record:", record);

    if (record.source === "cover_pwp") {
      console.log("Cover code:", record.cover_code);
    } else {
      console.log("Regular PWP code:", record.regularpwpcode);
    }

    setSelectedRecord(record);
    setShowModal(true);
  };


  // Function to filter object keys based on allowed columns


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
  const [categoryMap, setCategoryMap] = useState({});

  useEffect(() => {
    const fetchCategoryMap = async () => {
      const { data, error } = await supabase
        .from("categorydetails")
        .select("code, name");

      if (error) {
        console.error("Error fetching categories:", error);
        return;
      }

      const map = {};
      data.forEach(cat => {
        map[cat.code] = cat.name;
      });

      setCategoryMap(map);
    };

    fetchCategoryMap();
  }, []);

  const fetchData = useCallback(async () => {
    if (!Object.keys(categoryMap).length) return;

    try {
      setLoading(true);
      setError(null);

      let coverData = [];
      let regularData = [];

      // --- FETCH COVER PWP ---
     if (filter === "all" || filter === "cover") {
  const { data: cData, error: cError } = await supabase
    .from("cover_pwp")
    .select(`
      id,
      cover_code,
      activity,
      credit_budget,
      amountbadget,
      distributor,
      created_at,
      createForm
    `)
    .order("id", { ascending: false })
    .limit(50);

  if (cError) throw cError;

  coverData = (cData || []).map(item => ({
    ...item,
    source: "cover_pwp",
    pwp_code: item.cover_code,
  }));
}

// ✅ FETCH FOR REGULAR PWP
if (filter === "all" || filter === "regular") {
  const { data: rData, error: rError } = await supabase
    .from("regular_pwp")
    .select(`
      id,
      regularpwpcode,
      activity,
      credit_budget,
      amountbadget,
      distributor,
      created_at,
      branchType,
      createForm
    `)
    .order("id", { ascending: false })
    .limit(50);

  if (rError) throw rError;

  regularData = (rData || []).map(item => ({
    ...item,
    source: "regular_pwp",
    pwp_code: item.regularpwpcode,
  }));
}

      const mergedData = [...coverData, ...regularData];

      // --- FETCH ACTIVITY NAMES ---
      const activityCodes = [...new Set(mergedData.map(item => item.activity).filter(Boolean))];
      let activityMap = {};

      if (activityCodes.length > 0) {
        const { data: actData, error: actError } = await supabase
          .from("activity")
          .select("code, name")
          .in("code", activityCodes);

        if (actError) throw actError;

        activityMap = (actData || []).reduce((acc, cur) => {
          acc[cur.code] = cur.name;
          return acc;
        }, {});
      }

      // --- FETCH APPROVAL STATUS AND APPROVED DATE ---
      const allPwpCodes = mergedData.map(item => item.pwp_code).filter(Boolean);
      const approvalStatusMap = await getApprovalStatus(allPwpCodes);

      const { data: approvalHistoryData, error: approvalHistoryError } = await supabase
        .from("Approval_History")
        .select("PwpCode, DateResponded")
        .in("PwpCode", allPwpCodes);

      if (approvalHistoryError) throw approvalHistoryError;

      const approvalDateMap = {};
      (approvalHistoryData || []).forEach(item => {
        if (!approvalDateMap[item.PwpCode]) {
          approvalDateMap[item.PwpCode] = item.DateResponded;
        }
      });

      // --- MERGE APPROVAL + ACTIVITY NAME ---
      const dataWithApprovalStatus = mergedData.map(item => ({
        ...item,
        activity_name: activityMap[item.activity] || item.activity || "-", // <-- replace with name
        approval_status: approvalStatusMap[item.pwp_code]?.status || "Pending",
        date_responded: approvalStatusMap[item.pwp_code]?.date_responded || approvalDateMap[item.pwp_code] || null,
        approval_created: approvalStatusMap[item.pwp_code]?.approval_created,
      }));

      // --- SEARCH FILTER ---
      let filteredData = dataWithApprovalStatus;
      if (searchQuery) {
        filteredData = filteredData.filter(item => {
          const searchFields = [
            item.code,
            item.cover_code,
            item.regularpwpcode,
            item.id,
            item.activity_name, // now searchable by name too
            item.distributor,

          ];
          return searchFields.some(
            field =>
              field &&
              field.toString().toLowerCase().includes(searchQuery.toLowerCase())
          );
        });
      }

      // --- STATUS FILTER ---
      if (statusFilter !== "all") {
        filteredData = filteredData.filter(item => {
          const itemStatus = item.approval_status?.toLowerCase() || "pending";
          if (statusFilter === "sent_back")
            return (
              itemStatus === "sent back for revision" || itemStatus === "sent back"
            );
          if (statusFilter === "cancelled") return itemStatus === "cancelled";
          if (statusFilter === "pending")
            return itemStatus === "pending" || !item.approval_status;
          if (statusFilter === "approved") return itemStatus === "approved";
          if (statusFilter === "declined") return itemStatus === "declined";
          return itemStatus === statusFilter;
        });
      }

      // --- DATE FILTERS ---
      if (dateFrom) {
        filteredData = filteredData.filter(
          item =>
            item.created_at &&
            new Date(item.created_at) >= new Date(dateFrom)
        );
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filteredData = filteredData.filter(
          item =>
            item.created_at &&
            new Date(item.created_at) <= toDate
        );
      }

      // --- NORMALIZE FINAL DATA ---
      if (filteredData.length > 0) {
        const normalizedData = filteredData.map(item => ({
          ...item,
          code: item.regularpwpcode || item.cover_code || "-",
          distributor: item.distributor || "-",
          activity: item.activity_name || "-", // show readable name
          credit_budget: item.credit_budget ?? 0,
          amountbadget: item.amountbadget ?? 0,
          approved_date: item.date_responded || null,
        }));

        setColumns([
          "pwp_code",
          "distributor",
          "activity",
          "credit_budget",
          "created_at",
          "approved_date",
          "branchType"
        ]);
        setData(normalizedData);
      } else {
        setColumns([]);
        setData([]);
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter, searchQuery, dateFrom, dateTo, categoryMap]);




  const [showPDFModal, setShowPDFModal] = useState(false);
  const [selectedPDFRecord, setSelectedPDFRecord] = useState(null);

  // 3. Add handler function
  const handleViewPDF = (record) => {
    setSelectedPDFRecord(record);
    setShowPDFModal(true);
  };

  const exportToExcel = async () => {
    if (!data.length) return;

    try {
      // --- FETCH DISTRIBUTOR NAMES USING CODE ---
      const distributorCodes = [...new Set(data.map(d => d.distributor).filter(Boolean))];
      let distributorMap = {};

      if (distributorCodes.length > 0) {
        const { data: distData, error: distError } = await supabase
          .from("distributors")
          .select("code, name")
          .in("code", distributorCodes);

        if (distError) throw distError;

        distributorMap = (distData || []).reduce((acc, cur) => {
          acc[cur.code] = cur.name;
          return acc;
        }, {});
      }

      // --- DEFINE EXPORT HEADERS ---
      const exportColumns = [
        { header: "REG PWP CODE", key: "pwp_code" },
        { header: "DISTRIBUTOR", key: "distributor" },
        { header: "ACTIVITY", key: "activity" },
        { header: "AMOUNT", key: "credit_budget" },
        { header: "CREATED DATE", key: "created_at" },
        { header: "APPROVED DATE", key: "date_responded" },
        { header: "STATUS", key: "approval_status" },
        { header: "Account Type", key: "branchType" },
      ];

      // --- PREPARE DATA FOR EXPORT ---
      const exportData = data.map(row => {
        const obj = {};
        exportColumns.forEach(col => {
          if (col.key === "created_at" || col.key === "date_responded") {
            obj[col.header] = row[col.key]
              ? new Date(row[col.key]).toLocaleDateString()
              : "";
          } else if (col.key === "approval_status") {
            obj[col.header] = row[col.key] || "Pending";
          } else if (col.key === "distributor") {
            // Replace distributor code with name
            obj[col.header] = distributorMap[row[col.key]] || row[col.key] || "-";
          } else {
            obj[col.header] = row[col.key] ?? "";
          }
        });
        return obj;
      });

      // --- CREATE WORKSHEET & AUTO WIDTH ---
      const worksheet = XLSX.utils.json_to_sheet(exportData, {
        header: exportColumns.map(c => c.header),
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "PWP Records");

      // Auto column width
      const colWidths = exportColumns.map(col => ({
        wch: Math.max(
          col.header.length,
          ...exportData.map(r => (r[col.header] ? r[col.header].toString().length : 0))
        ) + 2,
      }));
      worksheet["!cols"] = colWidths;

      // --- SAVE FILE ---
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, `PWP_Records_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Error exporting Excel:", err.message);
    }
  };



  const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));

  const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
  const currentUserId = currentUser?.UserID ? Number(currentUser.UserID) : null;
  const role = currentUser?.role || "";

  const filteredData = useMemo(() => {
    if (role === 'admin') return data;

    return data.filter(row => {
      const createForm = row.createForm;

      if (!createForm) return false;

      // Normalize string for comparison
      if (typeof createForm === 'string') {
        const createFormStr = createForm.toLowerCase().trim();

        // Check if createForm string matches username
        if (createFormStr === currentUserName) return true;

        // Also, if createForm looks like a number string, compare with UserID
        const createFormNum = Number(createFormStr);
        if (!isNaN(createFormNum) && createFormNum === currentUserId) return true;

        return false;
      }

      // If createForm is a number, compare directly to UserID
      if (typeof createForm === 'number') {
        return createForm === currentUserId;
      }

      return false;
    });
  }, [data, currentUserName, currentUserId, role]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase
        .from('Account_Users')
        .select('UserID, name');

      if (error) {
        console.error('Error fetching users:', error);
      } else {
        setUsers(data || []);
      }
    }

    fetchUsers();
  }, []);

  // Pagination using filteredData
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

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


  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase
        .from('Account_Users')
        .select('UserID, name');
      if (error) {
        console.error('Failed to fetch users:', error);
      } else {
        setUsers(data || []);
      }
    }

    fetchUsers();
  }, []);

  const userIdToNameMap = useMemo(() => {
    const map = new Map();
    users.forEach(user => {
      if (user.UserID && user.name) {
        map.set(user.UserID, user.name.toLowerCase().trim());
      }
    });
    return map;
  }, [users]);
  const formatColumnName = (colName) => {
    return colName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Pwp', 'PWP')
      .replace('Id', 'ID');
  };
  // Fetch distributors (code → name)
  const [distributorMap, setDistributorMap] = useState({});

  useEffect(() => {
    const fetchDistributorMap = async () => {
      const { data, error } = await supabase
        .from("distributors") // ⚠️ change table name if different
        .select("code, name");

      if (error) {
        console.error("❌ Error fetching distributors:", error);
        return;
      }

      const map = {};
      data.forEach((item) => {
        map[String(item.code)] = item.name;
      });
      setDistributorMap(map);
    };

    fetchDistributorMap();
  }, []);

  const getUserNameById = (userId) => {
    if (!userId) return '-';

    // If it's already a string (name), return it in uppercase
    if (typeof userId === 'string' && isNaN(Number(userId))) {
      return userId.toUpperCase();
    }

    // Convert to number and lookup in map
    const numericId = Number(userId);
    const userName = userIdToNameMap.get(numericId);

    return userName ? userName.toUpperCase() : String(userId); // return uppercase or fallback
  };
 const formatCellValue = (value, colName) => {
  if (!value && value !== 0) return '-';

  if (colName === "distributor" || colName === "distributor_code") {
    const strCode = String(value).trim();
    const name = distributorMap[strCode];
    console.log("👉 Converting distributor:", strCode, "=>", name || "NOT FOUND");
    return name || strCode;
  }

  // Convert UserID to name for createForm column
  if (colName === "createForm") {
    return getUserNameById(value);
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

  // Don't truncate branchType - let it wrap naturally
  if (colName === 'branchType') {
    return String(value);
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
  },
  tdBranchType: {
    padding: '16px 20px',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '13px',
    color: '#000000ff',
    width: '260px',            // Wider to show at least 1 full branch name
    maxWidth: '260px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'help'
  }
};

  useEffect(() => {
    if (Object.keys(categoryMap).length > 0) {
      fetchData();
    }
  }, [categoryMap, filter, searchQuery, statusFilter, dateFrom, dateTo]);
  useEffect(() => {
    fetchData();
  }, [fetchData, rowsPerPage]);



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
                  placeholder="🔍 Search Customer...."
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
              <div className="filter-item">
                <button
                  onClick={exportToExcel}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    backgroundColor: '#4caf50',
                    color: '#fff',
                    fontWeight: '500',
                    width: '100%'
                  }}
                >
                  📥 Export to Excel
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
                  width: '220px'
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
  <td key={col} style={col === 'branchType' ? styles.tdBranchType : styles.td}>
    {col === 'branchType' ? (
      // branchType - show truncated with full text on hover
      <span title={row[col] || ''}>
        {formatCellValue(row[col], col)}
      </span>
    ) : (
      // Other columns
      <span 
        style={{
          maxWidth: window.innerWidth <= 568 ? '100px' : col === 'created_at' ? '150px' : '200px',
          display: 'inline-block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {formatCellValue(row[col], col)}
      </span>
    )}
  </td>
))}
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {getStatusBadge(row.approval_status)}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      {/* View Button */}
                      <button
                        onClick={() => handleViewRecord(row)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#1976d2',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = '#115293')}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = '#1976d2')}
                      >
                        🔍 View
                      </button>

                      {/* PDF Button */}
                      <button
                        onClick={() => handleViewPDF(row)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#d32f2f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = '#9a0007')}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = '#d32f2f')}
                      >
                        📄 PDF
                      </button>
                    </div>


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

      {showPDFModal && (
        <PDFViewModal
          record={selectedPDFRecord}
          onClose={() => {
            setShowPDFModal(false);
            setSelectedPDFRecord(null);
          }}
        />
      )}
    </div>
  );
}

export default RecordsPage;
