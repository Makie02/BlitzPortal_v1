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
  const [filter, setFilter] = useState("regular");
  const [statusFilter, setStatusFilter] = useState("all");
  const [distributorFilter, setDistributorFilter] = useState("all"); // ✅ NEW
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryMap, setCategoryMap] = useState({});
  const [users, setUsers] = useState([]);
  const [distributorMap, setDistributorMap] = useState({});
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [selectedPDFRecord, setSelectedPDFRecord] = useState(null);

  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  const handleViewPDF = (record) => {
    setSelectedPDFRecord(record);
    setShowPDFModal(true);
  };

  const getApprovalStatus = async (pwpCodes) => {
    try {
      let allApprovalData = [];
      const batchSize = 1000;

      for (let i = 0; i < pwpCodes.length; i += batchSize) {
        const batch = pwpCodes.slice(i, i + batchSize);

        const { data: approvalData, error } = await supabase
          .from("Approval_History")
          .select("PwpCode, Response, DateResponded, created_at")
          .in("PwpCode", batch);

        if (error) {
          console.error("Error fetching approval status:", error);
          continue;
        }

        if (approvalData) {
          allApprovalData = [...allApprovalData, ...approvalData];
        }
      }

      const approvalMap = {};
      allApprovalData?.forEach(approval => {
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

  useEffect(() => {
    const fetchDistributorMap = async () => {
      const { data, error } = await supabase
        .from("distributors")
        .select("code, name");

      if (error) {
        console.error("Error fetching distributors:", error);
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

  const fetchData = useCallback(async () => {
    if (!Object.keys(categoryMap).length) return;

    try {
      setLoading(true);
      setError(null);

      let coverData = [];
      let regularData = [];

      if (filter === "all" || filter === "cover") {
        let allCoverData = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: cData, error: cError } = await supabase
            .from("cover_pwp")
            .select("id, cover_code, activity, credit_budget, amountbadget, distributor, created_at, createForm")
            .order("id", { ascending: false })
            .range(from, from + batchSize - 1);

          if (cError) throw cError;

          if (cData && cData.length > 0) {
            allCoverData = [...allCoverData, ...cData];
            from += batchSize;
            if (cData.length < batchSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        coverData = (allCoverData || []).map(item => ({
          ...item,
          source: "cover_pwp",
          pwp_code: item.cover_code,
        }));
      }

      if (filter === "all" || filter === "regular") {
        let allRegularData = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: rData, error: rError } = await supabase
            .from("regular_pwp")
            .select("id, regularpwpcode, activity, credit_budget, amountbadget, distributor, created_at, branchType, createForm")
            .order("id", { ascending: false })
            .range(from, from + batchSize - 1);

          if (rError) throw rError;

          if (rData && rData.length > 0) {
            allRegularData = [...allRegularData, ...rData];
            from += batchSize;
            if (rData.length < batchSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        regularData = (allRegularData || []).map(item => ({
          ...item,
          source: "regular_pwp",
          pwp_code: item.regularpwpcode,
        }));
      }

      const mergedData = [...coverData, ...regularData];

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

      const allPwpCodes = mergedData.map(item => item.pwp_code).filter(Boolean);
      const approvalStatusMap = await getApprovalStatus(allPwpCodes);

      let allApprovalHistoryData = [];
      const batchSize = 1000;

      for (let i = 0; i < allPwpCodes.length; i += batchSize) {
        const batch = allPwpCodes.slice(i, i + batchSize);

        const { data: approvalHistoryData, error: approvalHistoryError } = await supabase
          .from("Approval_History")
          .select("PwpCode, DateResponded")
          .in("PwpCode", batch);

        if (approvalHistoryError) throw approvalHistoryError;

        if (approvalHistoryData) {
          allApprovalHistoryData = [...allApprovalHistoryData, ...approvalHistoryData];
        }
      }

      const approvalDateMap = {};
      (allApprovalHistoryData || []).forEach(item => {
        if (!approvalDateMap[item.PwpCode]) {
          approvalDateMap[item.PwpCode] = item.DateResponded;
        }
      });

      const dataWithApprovalStatus = mergedData.map(item => ({
        ...item,
        activity_name: activityMap[item.activity] || item.activity || "-",
        approval_status: approvalStatusMap[item.pwp_code]?.status || "Pending",
        date_responded: approvalStatusMap[item.pwp_code]?.date_responded || approvalDateMap[item.pwp_code] || null,
        approval_created: approvalStatusMap[item.pwp_code]?.approval_created,
      }));

      let filteredData = dataWithApprovalStatus;

      // ✅ DISTRIBUTOR FILTER
      if (distributorFilter !== "all") {
        filteredData = filteredData.filter(item => String(item.distributor) === distributorFilter);
      }

      if (searchQuery) {
        filteredData = filteredData.filter(item => {
          const query = searchQuery.toLowerCase();
          const distributorName = distributorMap[item.distributor] || item.distributor || "";

          if (searchField === "all") {
            const searchFields = [
              item.code,
              item.cover_code,
              item.regularpwpcode,
              item.id?.toString(),
              item.activity_name,
              distributorName,
              item.branchType
            ];
            return searchFields.some(field => field && field.toString().toLowerCase().includes(query));
          }

          let fieldValue = "";
          switch (searchField) {
            case "pwp_code":
              fieldValue = item.code || item.cover_code || item.regularpwpcode || "";
              break;
            case "distributor":
              fieldValue = distributorName;
              break;
            case "activity":
              fieldValue = item.activity_name || "";
              break;
            case "branchType":
              fieldValue = item.branchType || "";
              break;
            default:
              return false;
          }

          return fieldValue.toString().toLowerCase().includes(query);
        });
      }

      if (statusFilter !== "all") {
        filteredData = filteredData.filter(item => {
          const itemStatus = item.approval_status?.toLowerCase() || "pending";
          if (statusFilter === "disapproved") return itemStatus === "disapproved";
          if (statusFilter === "pending") return itemStatus === "pending" || !item.approval_status;
          if (statusFilter === "approved") return itemStatus === "approved";
          return itemStatus === statusFilter;
        });
      }

      if (dateFrom) {
        filteredData = filteredData.filter(
          item => item.created_at && new Date(item.created_at) >= new Date(dateFrom)
        );
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filteredData = filteredData.filter(
          item => item.created_at && new Date(item.created_at) <= toDate
        );
      }

      if (filteredData.length > 0) {
        const normalizedData = filteredData.map(item => ({
          ...item,
          code: item.regularpwpcode || item.cover_code || "-",
          distributor: item.distributor || "-",
          activity: item.activity_name || "-",
          credit_budget: item.credit_budget ?? 0,
          amountbadget: item.amountbadget ?? 0,
          approved_date: item.date_responded || null,
        }));

        setColumns([
          "id",
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
  }, [filter, statusFilter, distributorFilter, searchQuery, dateFrom, dateTo, categoryMap, searchField, distributorMap]);

  const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
  const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
  const currentUserId = currentUser?.UserID ? Number(currentUser.UserID) : null;
  const role = currentUser?.role || "";

  const filteredData = useMemo(() => {
    if (role === 'admin') return data;

    return data.filter(row => {
      const createForm = row.createForm;
      if (!createForm) return false;

      if (typeof createForm === 'string') {
        const createFormStr = createForm.toLowerCase().trim();
        if (createFormStr === currentUserName) return true;
        const createFormNum = Number(createFormStr);
        if (!isNaN(createFormNum) && createFormNum === currentUserId) return true;
        return false;
      }

      if (typeof createForm === 'number') {
        return createForm === currentUserId;
      }

      return false;
    });
  }, [data, currentUserName, currentUserId, role]);

const safeExcelText = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str.length > EXCEL_TEXT_LIMIT
    ? str.substring(0, EXCEL_TEXT_LIMIT - 3) + "..."
    : str;
};
const EXCEL_TEXT_LIMIT = 32767;

const exportToExcel = async () => {
  if (!filteredData || !filteredData.length) {
    alert("No data to export!");
    return;
  }

  try {
    console.log("🔄 Starting Excel export...");

    // ✅ Columns
    const exportColumns = [
      { header: "ID", key: "id" },
      { header: "REG PWP CODE", key: "pwp_code" },
      { header: "DISTRIBUTOR", key: "distributor" },
      { header: "ACTIVITY", key: "activity" },
      { header: "AMOUNT", key: "credit_budget" },
      { header: "CREATED DATE", key: "created_at" },
      { header: "APPROVED DATE", key: "date_responded" },
      { header: "STATUS", key: "approval_status" },
      { header: "Account Type", key: "branchType" },
    ];

    // ✅ DATA MAP (SAFE)
    const exportData = filteredData.map(row => {
      const obj = {};

      exportColumns.forEach(col => {
        if (col.key === "created_at" || col.key === "date_responded") {
          obj[col.header] = row[col.key]
            ? new Date(row[col.key]).toLocaleDateString()
            : "";

        } else if (col.key === "approval_status") {
          obj[col.header] = safeExcelText(row[col.key] || "Pending");

        } else if (col.key === "distributor") {
          obj[col.header] = safeExcelText(
            distributorMap[row[col.key]] || row[col.key] || "-"
          );

        } else if (col.key === "credit_budget") {
          obj[col.header] = Number(row[col.key] || 0);

        } else {
          obj[col.header] = safeExcelText(row[col.key]);
        }
      });

      return obj;
    });

    // ✅ TOTAL CALCULATION
    const totalAmount = exportData.reduce(
      (sum, row) => sum + (Number(row["AMOUNT"]) || 0),
      0
    );

    // ✅ TOTAL ROW
    const totalRow = {};
    exportColumns.forEach(col => {
      if (col.key === "credit_budget") {
        totalRow[col.header] = totalAmount;
      } else if (col.key === "activity") {
        totalRow[col.header] = "TOTAL:";
      } else {
        totalRow[col.header] = "";
      }
    });

    exportData.push(totalRow);

    console.log(`✅ Prepared ${exportData.length} rows for export`);

    // ✅ CREATE SHEET
    const worksheet = XLSX.utils.json_to_sheet(exportData, {
      header: exportColumns.map(c => c.header),
    });

    // ✅ AUTO COLUMN WIDTH
    worksheet["!cols"] = exportColumns.map(col => ({
      wch: Math.max(
        col.header.length,
        ...exportData.map(r =>
          r[col.header] ? r[col.header].toString().length : 0
        )
      ) + 2,
    }));

    // ✅ WORKBOOK
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PWP Records");

    // ✅ EXPORT
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    const filename = `PWP_Records_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    saveAs(blob, filename);

    console.log(`✅ Excel file saved: ${filename}`);
  } catch (err) {
    console.error("❌ Error exporting Excel:", err);
    alert("Error exporting Excel. Please try again.");
  }
};

  const userIdToNameMap = useMemo(() => {
    const map = new Map();
    users.forEach(user => {
      if (user.UserID && user.name) {
        map.set(user.UserID, user.name.toLowerCase().trim());
      }
    });
    return map;
  }, [users]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const getStatusBadge = (status) => {
    const statusLower = status ? status.toLowerCase() : 'pending';
    let bgColor, textColor, borderColor;

    switch (statusLower) {
      case 'approved':
        bgColor = '#e8f5e8';
        textColor = '#2e7d32';
        borderColor = '#c8e6c9';
        break;
      case 'disapproved':
        bgColor = '#ffebee';
        textColor = '#c62828';
        borderColor = '#ffcdd2';
        break;
      case 'cancelled':
        bgColor = '#ffebee';
        textColor = '#ff0022ff';
        borderColor = '#ffcdd2';
        break;
      case 'pending':
      default:
        bgColor = '#fff3cd';
        textColor = '#8a6d3b';
        borderColor = '#ffeaa7';
    }

    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '16px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        textTransform: 'capitalize',
        letterSpacing: '0.5px',
      }}>
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

  const getUserNameById = (userId) => {
    if (!userId) return '-';
    if (typeof userId === 'string' && isNaN(Number(userId))) {
      return userId.toUpperCase();
    }
    const numericId = Number(userId);
    const userName = userIdToNameMap.get(numericId);
    return userName ? userName.toUpperCase() : String(userId);
  };

  const formatCellValue = (value, colName) => {
    if (!value && value !== 0) return '-';
    if (colName === 'id') return String(value);
    if (colName === "distributor" || colName === "distributor_code") {
      const strCode = String(value).trim();
      const name = distributorMap[strCode];
      return name || strCode;
    }
    if (colName === "createForm") return getUserNameById(value);
    if (colName === 'credit_budget' || colName === 'amountbadget') {
      const numValue = Number(value);
      if (isNaN(numValue)) return '-';
      if (numValue % 1 === 0) {
        return `₱ ${numValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      }
      return `₱ ${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    if (colName === 'approved_date' && value) {
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
    if (colName === 'branchType') return String(value);
    return String(value);
  };

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
      width: '500px',
      maxWidth: '500px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      cursor: 'help'
    }
  };

  // ✅ Get unique distributors for filter dropdown
  // ✅ TAMA - kumuha from filteredData para sa current view lang
  const uniqueDistributors = useMemo(() => {
    const codes = [...new Set(filteredData.map(item => item.distributor).filter(Boolean))];
    return codes.map(code => ({
      code: String(code),
      name: distributorMap[String(code)] || String(code)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData, distributorMap]);
  useEffect(() => {
    if (Object.keys(categoryMap).length > 0) {
      fetchData();
    }
  }, [categoryMap, filter, searchQuery, statusFilter, distributorFilter, dateFrom, dateTo, fetchData]);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '24px 30px', color: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 0', maxWidth: '100%' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#000000ff', letterSpacing: '0.5px', lineHeight: '1.2' }}>
              📊 RECORDS
            </h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
            {/* ✅ LEFT SIDE - Title */}


            {/* ✅ RIGHT SIDE - All Filters and Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minWidth: '300px' }}>

              {/* Row 1: Search Field + Search Input */}
              <div style={{ display: 'flex', gap: '0', alignItems: 'center' }}>
                <select
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '8px 0 0 8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    outline: 'none',
                    backgroundColor: '#f8f9fa',
                    minWidth: '140px',
                    borderRight: 'none'
                  }}
                >
                  <option value="all">All Fields</option>
                  <option value="pwp_code">PWP Code</option>
                  <option value="distributor">Distributor</option>
                  <option value="activity">Activity</option>
                  <option value="branchType">Branch Type</option>
                </select>

                <input
                  type="text"
                  placeholder={searchField === "all" ? "🔍 Search all fields..." : `🔍 Search ${searchField.replace('_', ' ')}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '250px',
                    padding: '12px 16px',
                    border: '2px solid #e1e8ed',
                    borderRadius: '0 8px 8px 0',
                    fontSize: '14px',
                    transition: 'border-color 0.3s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2575fc'}
                  onBlur={(e) => e.target.style.borderColor = '#e1e8ed'}
                />
              </div>

              {/* Row 2: Status + Distributor + PWP Type Filters */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    flex: '1',
                    minWidth: '150px',
                    cursor: 'pointer',
                    border: '1px solid #e1e8ed'
                  }}
                >
                  <option value="all">📋 All Status</option>
                  <option value="approved">✅ Approved</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="cancelled">❌ Cancelled</option>
                  <option value="disapprove">🚫 Disapproved</option>
                </select>

                {/* ✅ NEW DISTRIBUTOR FILTER */}
                <select
                  value={distributorFilter}
                  onChange={(e) => setDistributorFilter(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    flex: '1',
                    minWidth: '150px',
                    cursor: 'pointer',
                    border: '1px solid #e1e8ed'
                  }}
                >
                  <option value="all">🏢 All Distributors</option>
                  {uniqueDistributors.map(dist => (
                    <option key={dist.code} value={dist.code}>
                      {dist.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    flex: '1',
                    minWidth: '150px',
                    cursor: 'pointer',
                    border: '1px solid #e1e8ed'
                  }}
                >
                  <option value="all">📁 All Records</option>
                  <option value="cover">📄 Cover PWP Only</option>
                  <option value="regular">📋 Regular PWP Only</option>
                </select>
              </div>

              {/* Row 3: Date Range */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#f8f9fa',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #e1e8ed',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>📅 Date:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px',
                    flex: '1',
                    minWidth: '130px'
                  }}
                />
                <span style={{ color: '#666' }}>to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px',
                    flex: '1',
                    minWidth: '130px'
                  }}
                />
              </div>

              {/* Row 4: Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={fetchData}
                  disabled={updating}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '5px',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    backgroundColor: '#2575fc',
                    color: '#fff',
                    fontWeight: '500',
                    border: 'none',
                    opacity: updating ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => !updating && (e.target.style.backgroundColor = '#1557b0')}
                  onMouseLeave={(e) => !updating && (e.target.style.backgroundColor = '#2575fc')}
                >
                  {updating ? '🔄 Updating' : '🔄 Refresh'}
                </button>

                <button
                  onClick={exportToExcel}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '5px',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    backgroundColor: '#08af3a',
                    color: '#fff',
                    fontWeight: '500',
                    border: 'none',
                    opacity: updating ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => (e.target.style.backgroundColor = '#388e3c')}
                  onMouseLeave={(e) => (e.target.style.backgroundColor = '#4caf50')}
                >
                  📥 Export
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Table Section */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', padding: '5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#2575fc', color: '#ffff' }}>
                {columns.map(col => (
                  <th key={col} style={{ padding: '16px 20px', textAlign: 'left', fontWeight: '600', color: '#eeeeeeff', fontSize: '14px', borderBottom: '2px solid #e0e0e0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {formatColumnName(col)}
                  </th>
                ))}
                <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#fcfcfcff', fontSize: '14px', borderBottom: '2px solid #e0e0e0', textTransform: 'uppercase', letterSpacing: '0.5px', width: '220px' }}>
                  Status
                </th>
                <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: '600', color: '#fcfcfcff', fontSize: '14px', borderBottom: '2px solid #e0e0e0', textTransform: 'uppercase', letterSpacing: '0.5px', width: '120px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 2} style={{ textAlign: 'center', padding: '40px' }}>Loading...</td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={columns.length + 2} style={{ textAlign: 'center', padding: '40px' }}>No records found</td></tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr key={row.id || index} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fafafa', transition: 'background-color 0.2s ease' }}>
                    {columns.map(col => (
                      <td key={col} style={col === 'branchType' ? styles.tdBranchType : styles.td}>
                        {col === 'branchType' ? (
                          <span title={row[col] || ''}>{formatCellValue(row[col], col)}</span>
                        ) : (
                          <span style={{ maxWidth: window.innerWidth <= 368 ? '100px' : col === 'created_at' ? '150px' : '200px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        <button onClick={() => handleViewRecord(row)} style={{ padding: '8px 16px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.2s ease' }} onMouseEnter={(e) => (e.target.style.backgroundColor = '#115293')} onMouseLeave={(e) => (e.target.style.backgroundColor = '#1976d2')}>
                          🔍 View
                        </button>
                        <button onClick={() => handleViewPDF(row)} style={{ padding: '8px 16px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.2s ease' }} onMouseEnter={(e) => (e.target.style.backgroundColor = '#9a0007')} onMouseLeave={(e) => (e.target.style.backgroundColor = '#d32f2f')}>
                          📄 PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '500' }}>Rows per page:</span>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px 10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}>
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '8px 16px', backgroundColor: currentPage === 1 ? '#e0e0e0' : '#1976d2', color: currentPage === 1 ? '#555' : 'white', border: 'none', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s ease' }}>
            ◀ Prev
          </button>
          <span style={{ fontSize: '14px', fontWeight: '500', padding: '0 10px' }}>Page {currentPage} of {totalPages || 1}</span>
          <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '8px 16px', backgroundColor: currentPage === totalPages ? '#e0e0e0' : '#1976d2', color: currentPage === totalPages ? '#555' : 'white', border: 'none', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s ease' }}>
            Next ▶
          </button>
        </div>
      </div>

      {showModal && <RecordViewModal record={selectedRecord} onClose={() => { setShowModal(false); setSelectedRecord(null); }} />}
      {showPDFModal && <PDFViewModal record={selectedPDFRecord} onClose={() => { setShowPDFModal(false); setSelectedPDFRecord(null); }} />}
    </div>
  );
}

export default RecordsPage;
