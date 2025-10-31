import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";
import EditModal from "./EditModal";
import { FaEdit, FaTrash } from 'react-icons/fa'

function EnhancedDatabaseInterface() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState("regular");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const COVER_COLUMNS = useMemo(() => ['id', 'cover_code', 'pwp_type', 'created_at', 'createForm'], []);
  const REGULAR_COLUMNS = useMemo(() => ['id', 'regularpwpcode', 'pwptype', 'created_at', 'createForm'], []);
  const CLAIMS_COLUMNS = useMemo(() => [
    'id',
    'code_pwp',
    'distributor',
    'account_types',
    'created_at',
    'createForm'
  ], []);

  // Get logged-in user info from localStorage
  const storedUser = localStorage.getItem('loggedInUser');
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;
  const loggedInUsername = parsedUser?.name?.toUpperCase().trim() || 'UNKNOWN';
  const loggedInUserID = parsedUser?.UserID ?? null;
  const userRole = parsedUser?.role?.toLowerCase() || '';

  console.log('🔐 Logged in user:', { username: loggedInUsername, userID: loggedInUserID, role: userRole });

  const filterColumns = (obj, allowedColumns) => {
    const filtered = {};
    allowedColumns.forEach(col => {
      if (obj.hasOwnProperty(col)) {
        filtered[col] = obj[col];
      }
    });
    return filtered;
  };

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
  const [rowsPerPage, setRowsPerPage] = useState(9);

  // Filter data based on user role and permissions
  const filteredDataByUser = useMemo(() => {
    return data.filter(row => {
      // Admin can see all records
      if (userRole === 'admin') {
        return true;
      }
      
      // For non-admin users, only show their own records
      const rowCreator = row.createForm?.toUpperCase().trim() || '';
      return rowCreator === loggedInUsername;
    });
  }, [data, userRole, loggedInUsername]);

  // Smart pagination - only paginate if there are many records
  const shouldPaginate = filteredDataByUser.length > 15;
  
  const totalPages = shouldPaginate ? Math.ceil(filteredDataByUser.length / rowsPerPage) : 1;

  const displayData = shouldPaginate 
    ? filteredDataByUser.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
      )
    : filteredDataByUser;

  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data: usersData, error: usersError } = await supabase
          .from('Account_Users')
          .select('UserID, name');
        if (usersError) throw usersError;
        setUsers(usersData || []);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(false);
      setError(null);

      let coverData = [];
      let regularData = [];
      let allColumns = [];

      if (filter === "all" || filter === "cover") {
        const { data: cData, error: cError } = await supabase
          .from("cover_pwp")
          .select(COVER_COLUMNS.join(','))
          .order("id", { ascending: false })
          .limit(100);

        if (cError) throw cError;
        coverData = (cData || []).map((item) => ({
          ...filterColumns(item, COVER_COLUMNS),
          source: "cover_pwp",
          pwp_code: item.cover_code
        }));
      }

      if (filter === "all" || filter === "claims") {
        const [distributorsResult, claimsResult] = await Promise.all([
          supabase.from("distributors").select("code, name"),
          supabase.from("Claims_pwp").select(CLAIMS_COLUMNS.join(',')).order("id", { ascending: false }).limit(100)
        ]);

        if (distributorsResult.error) throw distributorsResult.error;
        if (claimsResult.error) throw claimsResult.error;

        const neededAccountTypeCodes = new Set();
        (claimsResult.data || []).forEach(item => {
          if (item.account_types) {
            if (typeof item.account_types === "string" && item.account_types.includes("[")) {
              try {
                const codes = JSON.parse(item.account_types.replace(/'/g, '"'));
                codes.forEach(code => neededAccountTypeCodes.add(code.trim()));
              } catch {
                const matches = item.account_types.match(/[A-Z0-9]+/g);
                if (matches) matches.forEach(code => neededAccountTypeCodes.add(code.trim()));
              }
            } else {
              neededAccountTypeCodes.add(item.account_types.trim());
            }
          }
        });

        const { data: accountTypesData, error: accountTypesError } = await supabase
          .from("categorydetails")
          .select("code, name")
          .in("code", Array.from(neededAccountTypeCodes));

        if (accountTypesError) throw accountTypesError;

        const distributorsMap = new Map();
        const accountTypesMap = new Map();

        distributorsResult.data?.forEach(distributor => {
          distributorsMap.set(distributor.code.toString(), distributor.name);
        });

        accountTypesData?.forEach(accountType => {
          accountTypesMap.set(accountType.code.toString().trim(), accountType.name);
        });

        const claimsFormatted = (claimsResult.data || []).map((item) => {
          const distributorText = distributorsMap.get(item.distributor?.toString()) || item.distributor || '-';

          let accountTypesText = '-';
          if (item.account_types) {
            let codes = [];
            if (typeof item.account_types === "string" && item.account_types.includes("[")) {
              try {
                codes = JSON.parse(item.account_types.replace(/'/g, '"'));
              } catch {
                const matches = item.account_types.match(/[A-Z0-9]+/g);
                if (matches) codes = matches;
              }
            } else {
              codes = [item.account_types];
            }
            accountTypesText = codes
              .map(code => accountTypesMap.get(code?.toString().trim()) || code)
              .join(", ");
          }

          return {
            ...filterColumns(item, CLAIMS_COLUMNS),
            source: "Claims_pwp",
            pwp_code: item.code_pwp,
            distributor: distributorText,
            account_types: accountTypesText
          };
        });

        coverData = [...coverData, ...claimsFormatted];
      }

      if (filter === "all" || filter === "regular") {
        const { data: rData, error: rError } = await supabase
          .from("regular_pwp")
          .select(REGULAR_COLUMNS.join(','))
          .order("id", { ascending: false })
          .limit(100);

        if (rError) throw rError;
        regularData = (rData || []).map((item) => ({
          ...filterColumns(item, REGULAR_COLUMNS),
          source: "regular_pwp",
          pwp_code: item.regularpwpcode
        }));
      }

      const mergedData = [...coverData, ...regularData];

      const allPwpCodes = mergedData
        .map(item => item.pwp_code)
        .filter(code => code);

      const approvalStatusMap = await getApprovalStatus(allPwpCodes);

      const dataWithApprovalStatus = mergedData.map(item => ({
        ...item,
        approval_status: approvalStatusMap[item.pwp_code]?.status || 'Pending',
        date_responded: approvalStatusMap[item.pwp_code]?.date_responded,
        approval_created: approvalStatusMap[item.pwp_code]?.approval_created
      }));

      let filteredData = dataWithApprovalStatus;

      if (searchQuery) {
        filteredData = filteredData.filter(item => {
          const searchFields = [
            item.code,
            item.cover_code,
            item.regularpwpcode,
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
        const regularCols = REGULAR_COLUMNS.filter(col => col !== 'regularpwpcode');
        const coverCols = COVER_COLUMNS.filter(col => col !== 'cover_code');

        if (filter === "all") {
          allColumns = ['id', 'code', 'pwptype', 'created_at', 'createForm'];
        } else if (filter === "cover") {
          allColumns = ['id', 'cover_code', ...coverCols.slice(1)];
        } else if (filter === "regular") {
          allColumns = ['id', 'regularpwpcode', ...regularCols.slice(1)];
        } else if (filter === "claims") {
          allColumns = CLAIMS_COLUMNS;
        }

        const userIdToNameMap = new Map(
          users.map(u => [u.UserID, u.name.toUpperCase().trim()])
        );

        const normalizedData = filteredData.map(item => {
          let createFormValue = item.createForm;
          if (createFormValue) {
            const numVal = Number(createFormValue);
            if (!isNaN(numVal) && userIdToNameMap.has(numVal)) {
              createFormValue = userIdToNameMap.get(numVal);
            }
          }

          if (filter === "all") {
            return {
              ...item,
              createForm: createFormValue,
              code: item.regularpwpcode || item.cover_code || item.code_pwp || '-',
              accountType: item.accountType || item.account_type || '-',
              pwptype: item.pwptype || item.pwp_type || '-',
              pwp_type: item.pwp_type || item.pwptype || '-',
            };
          }

          return {
            ...item,
            createForm: createFormValue
          };
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
  }, [filter, REGULAR_COLUMNS, COVER_COLUMNS, CLAIMS_COLUMNS, statusFilter, searchQuery, dateFrom, dateTo, users]);

  const handleEdit = async (row) => {
    let tableName = "regular_pwp";

    if (row.source === "cover_pwp" || row.source === "cover") {
      tableName = "cover_pwp";
    } else if (row.source === "regular_pwp" || row.source === "regular") {
      tableName = "regular_pwp";
    }

    try {
      const { data: record, error: recordError } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", row.id)
        .single();

      if (recordError) {
        console.error("Error fetching full record:", recordError);
        return;
      }

      let activityName = null;
      if (record.activity) {
        const { data: activityData, error: activityError } = await supabase
          .from("activity")
          .select("name")
          .eq("code", record.activity)
          .single();

        if (activityError) {
          console.error("Error fetching activity name:", activityError);
        } else {
          activityName = activityData?.name || record.activity;
        }
      }

      setSelectedRow({
        ...record,
        activityName,
        source: row.source,
      });

      setIsModalOpen(true);
    } catch (err) {
      console.error("Unexpected error fetching record:", err);
    }
  };

  const handleSave = async (updatedData) => {
    setUpdating(true);
    try {
      const table = updatedData.source;
      const updateData = { ...updatedData };
      delete updateData.source;

      if (filter === "all" && updateData.code) {
        if (table === "regular_pwp") {
          updateData.regularpwpcode = updateData.code;
        } else if (table === "cover_pwp") {
          updateData.cover_code = updateData.code;
        }
        delete updateData.code;
      }

      const { error: updateError } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", updatedData.id);

      if (updateError) {
        setError(`Update Error: ${updateError.message}`);
      } else {
        await fetchData();
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingData({});
  };

  const handleDelete = async (rowId) => {
    setUpdating(true);
    try {
      const row = data.find((r) => r.id === rowId);
      if (!row) {
        setError("Row not found.");
        setUpdating(false);
        return;
      }

      if (row.source === "Claims_pwp") {
        const claimsCode = row.code_pwp || row.pwp_code;
        if (!claimsCode) {
          setError("Claims code missing for deletion.");
          setUpdating(false);
          return;
        }

        await supabase.from("Claims_AccountBudgetTable").delete().eq("code_pwp", claimsCode);
        await supabase.from("Claims_Badorder").delete().eq("code_pwp", claimsCode);
        await supabase.from("cover_attachments").delete().eq("cover_code", claimsCode);
        await supabase.from("approved_history_budget").delete().eq("pwp_code", claimsCode);
        await supabase.from("Approval_History").delete().eq("PwpCode", claimsCode);
        await supabase.from("amount_badget").delete().eq("pwp_code", claimsCode);

        const { error: claimsError } = await supabase
          .from("Claims_pwp")
          .delete()
          .eq("id", rowId);
        if (claimsError) throw new Error(`Failed to delete claims PWP: ${claimsError.message}`);
      } else if (row.source === "cover_pwp") {
        const coverCode = row.cover_code || row.pwp_code;
        if (!coverCode) {
          setError("Cover code missing for deletion.");
          setUpdating(false);
          return;
        }

        await supabase.from("cover_attachments").delete().eq("cover_code", coverCode);
        await supabase.from("Approval_History").delete().eq("PwpCode", coverCode);
        await supabase.from("amount_badget").delete().eq("pwp_code", coverCode);
        await supabase.from("approved_history_budget").delete().eq("pwp_code", coverCode);

        const { error: coverError } = await supabase
          .from("cover_pwp")
          .delete()
          .eq("id", rowId);
        if (coverError) throw new Error(`Failed to delete cover PWP: ${coverError.message}`);
      } else if (row.source === "regular_pwp") {
        const regularCode = row.regularpwpcode || row.pwp_code;
        if (!regularCode) {
          setError("Regular code missing for deletion.");
          setUpdating(false);
          return;
        }

        await supabase.from("regular_accountlis_badget").delete().eq("regularcode", regularCode);
        await supabase.from("regular_attachments").delete().eq("regularpwpcode", regularCode);
        await supabase.from("Approval_History").delete().eq("PwpCode", regularCode);
        await supabase.from("regular_sku").delete().eq("regular_code", regularCode);
        await supabase.from("amount_badget").delete().eq("pwp_code", regularCode);
        await supabase.from("approved_history_budget").delete().eq("pwp_code", regularCode);
        await supabase.from("regular_badorder").delete().eq("code_pwp", regularCode);

        const { error: mainDeleteError } = await supabase
          .from("regular_pwp")
          .delete()
          .eq("id", rowId);
        if (mainDeleteError) throw new Error(`Failed to delete regular PWP: ${mainDeleteError.message}`);
      }

      setDeleteConfirm(null);
      await fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      setError(`Delete failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const [modalTitle, setModalTitle] = useState("");
  const [userDistributors, setUserDistributors] = useState([]);
  const [filteredDistributors, setFilteredDistributors] = useState([]);
  const [distributors, setDistributors] = useState([]);

  useEffect(() => {
    const fetchUserDistributors = async () => {
      const { data, error } = await supabase
        .from('user_distributors')
        .select('distributor_name')
        .eq('username', loggedInUsername);

      if (error) {
        console.error('[ERROR] Fetching user_distributors:', error);
      } else {
        const names = data.map((d) => d.distributor_name);
        setUserDistributors(names);
      }
    };

    fetchUserDistributors();
  }, [loggedInUsername]);

  useEffect(() => {
    const fetchDistributors = async () => {
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('[ERROR] Fetching distributors:', error);
      } else {
        setDistributors(data);
        const allowed = data.filter((dist) => userDistributors.includes(dist.name));
        setFilteredDistributors(allowed);
      }
    };

    if (userDistributors.length > 0) {
      fetchDistributors();
    }
  }, [userDistributors]);

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
        });
      } catch {
        return value;
      }
    }

    return String(value);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    <div style={{ padding: '20px' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '24px 30px', color: 'white' }}>
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
                📊 PWP Database Management
              </h1>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#666',
                fontWeight: '500'
              }}>
                {userRole === 'admin' ? '👑 Admin View' : `👤 ${loggedInUsername}`} • 
                {shouldPaginate 
                  ? ` Showing ${displayData.length} of ${filteredDataByUser.length} records` 
                  : ` ${filteredDataByUser.length} record${filteredDataByUser.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
            }}>
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
                  <option value="cover">Total Budget</option>
                  <option value="regular">Regular PWP</option>
                  <option value="claims">Claims</option>
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
                  width: '200px'
                }}>
                  Status
                </th>
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#ffffffff',
                  fontSize: '14px',
                  borderBottom: '2px solid #e0e0e0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: '250px'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map((row, index) => (
                  <tr
                    key={row.id || index}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {columns.map(col => (
                      <td
                        key={col}
                        style={{
                          padding: '16px 20px',
                          borderBottom: '1px solid #e0e0e0',
                          fontSize: '14px',
                          color: '#000000ff'
                        }}
                      >
                        {editingId === row.id && col !== 'id' && col !== 'createdat' ? (
                          <input
                            type="text"
                            value={editingData[col] || ''}
                            onChange={(e) => setEditingData({ ...editingData, [col]: e.target.value })}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              width: '100%',
                              minWidth: '120px'
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              maxWidth: col === 'createdat' ? '150px' : '200px',
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
                    <td
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        textAlign: 'center',
                        width: "250px"
                      }}
                    >
                      {getStatusBadge(row.approval_status)}
                    </td>
                    <td
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #e0e0e0',
                        textAlign: 'center'
                      }}
                    >
                      {editingId === row.id ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={handleSave}
                            disabled={updating}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: updating ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              opacity: updating ? 0.7 : 1
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={updating}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#757575',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: updating ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              opacity: updating ? 0.7 : 1
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleEdit(row)}
                            disabled={updating || row.approval_status !== "Pending"}
                            aria-label={`Edit ${row.name}`}
                            title={row.approval_status === "Pending" ? "Edit" : `Edit disabled (${row.approval_status})`}
                            style={{
                              border: "none",
                              background: "none",
                              cursor: updating || row.approval_status !== "Pending" ? "not-allowed" : "pointer",
                              padding: "8px",
                              color: row.approval_status === "Pending" ? "orange" : "#6c757d",
                              transition: "transform 0.3s ease, box-shadow 0.3s ease",
                              boxShadow: row.approval_status === "Pending"
                                ? "0 4px 6px rgba(0,0,0,0.2)"
                                : "0 4px 6px rgba(108, 117, 125, 0.5)",
                              borderRadius: "8px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginLeft: "8px",
                              outline: "none",
                              opacity: updating || row.approval_status !== "Pending" ? 0.5 : 1,
                              pointerEvents: updating || row.approval_status !== "Pending" ? "none" : "auto"
                            }}
                            onMouseEnter={(e) => {
                              if (row.approval_status === "Pending") {
                                e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                                e.currentTarget.style.boxShadow = "0 8px 15px rgba(0, 252, 34, 0.5)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1) rotateX(0) rotateY(0)";
                              e.currentTarget.style.boxShadow = row.approval_status === "Pending"
                                ? "0 4px 6px rgba(0,0,0,0.2)"
                                : "0 4px 6px rgba(108, 117, 125, 0.5)";
                            }}
                            onMouseDown={(e) => {
                              if (row.approval_status === "Pending") {
                                e.currentTarget.style.transform = "scale(0.95) rotateX(5deg) rotateY(5deg)";
                                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
                              }
                            }}
                            onMouseUp={(e) => {
                              if (row.approval_status === "Pending") {
                                e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                                e.currentTarget.style.boxShadow = "0 8px 15px rgba(0, 255, 128, 0.5)";
                              }
                            }}
                          >
                            <FaEdit
                              style={{
                                color: row.approval_status === "Pending" ? "orange" : "#6c757d",
                                fontSize: "20px"
                              }}
                            />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm(row.id)}
                            disabled={updating}
                            aria-label={`Delete ${row.name}`}
                            title="Delete"
                            style={{
                              border: "none",
                              background: "none",
                              cursor: updating ? "not-allowed" : "pointer",
                              padding: "8px",
                              color: "#d32f2f",
                              transition: "transform 0.3s ease, box-shadow 0.3s ease",
                              boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
                              borderRadius: "8px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginLeft: "8px",
                              outline: "none",
                              opacity: updating ? 0.5 : 1,
                              pointerEvents: updating ? 'none' : 'auto'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                              e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 47, 47, 0.7)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1) rotateX(0) rotateY(0)";
                              e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = "scale(0.95) rotateX(5deg) rotateY(5deg)";
                              e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                              e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 0, 0, 0.7)";
                            }}
                          >
                            <FaTrash style={{ color: "red", fontSize: "20px" }} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Smart Pagination - Only show if there are many records */}
      {shouldPaginate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '4px 8px',
                fontSize: '14px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            >
              {[10, 20, 50, 100].map((size) => (
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
              Page {currentPage} of {totalPages}
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
      )}

      <EditModal
        isOpen={isModalOpen}
        title={modalTitle}
        rowData={selectedRow}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        updating={updating}
        filter="all"
        filteredDistributors={filteredDistributors}
      />

      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 15px', color: '#333' }}>Confirm Delete</h3>
            <p style={{ margin: '0 0 20px', color: '#666' }}>
              Are you sure you want to delete this record? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={updating}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#757575',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: updating ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={updating}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: updating ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: updating ? 0.7 : 1
                }}
              >
                {updating ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedDatabaseInterface;
