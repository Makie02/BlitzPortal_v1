import React, { useEffect, useState, useRef } from "react";
import "./ApprovalsPage.css";
import Swal from "sweetalert2";
import { supabase } from "../supabaseClient";
import ViewDataModal from "./ViewData/ViewDataModal";

export default function ApprovalsPage() {
  const storedUser = localStorage.getItem("loggedInUser");
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const [modalVisaCode, setModalVisaCode] = React.useState(null);
  const [modalLoading, setIsModalLoading] = React.useState(null);

  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  const dropdownRefs = useRef([]);
  const [userNames, setUserNames] = useState({});
  const [distributors, setDistributors] = useState([]);

  // ✅ Add online status monitoring
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ✅ Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log("🟢 Internet connection restored");
      setIsOnline(true);
    };
    const handleOffline = () => {
      console.log("🔴 Internet connection lost");
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchDistributors = async () => {
      console.log("📦 Fetching distributors from database...");
      const { data, error } = await supabase
        .from("distributors")
        .select("code, name");

      if (error) {
        console.error("❌ Error fetching distributors:", error);
      } else {
        console.log(`✅ Successfully fetched ${data.length} distributors`);
        setDistributors(data);
      }
    };

    fetchDistributors();
  }, []);

  const getDistributorName = (code) => {
    const distributor = distributors.find(
      (d) => Number(d.code) === Number(code)
    );
    return distributor ? distributor.name : `Code: ${code}`;
  };

  useEffect(() => {
    const fetchUserNames = async () => {
      console.log("👥 Fetching user names from database...");
      const { data, error } = await supabase
        .from("Account_Users")
        .select("UserID, name");

      if (error) {
        console.error("❌ Error fetching user names:", error);
        return;
      }

      const nameMap = {};
      data.forEach(user => {
        nameMap[user.UserID] = user.name;
      });

      console.log(`✅ Successfully fetched ${data.length} user names`);
      setUserNames(nameMap);
    };

    fetchUserNames();
  }, []);

  const getUserNameById = (userId) => {
    return userNames[userId] || ` ${userId}`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRefs.current &&
        !dropdownRefs.current.some((ref) => ref?.contains(event.target))
      ) {
        setOpenDropdownIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ IMPROVED handleRowClick with detailed logging
  const handleRowClick = async (entry) => {
    console.log("═══════════════════════════════════════════════");
    console.log("🔵 VIEW DETAILS BUTTON CLICKED");
    console.log("═══════════════════════════════════════════════");
    console.log("📋 Entry Details:", {
      code: entry.code,
      distributor: entry.distributor,
      createdBy: entry.createForm,
      status: entry.status,
      sourceTable: entry.sourceTable,
      created_at: entry.created_at
    });

    // Check internet connection first
    if (!navigator.onLine) {
      console.warn("⚠️ No internet connection detected");
      await Swal.fire({
        icon: 'error',
        title: 'No Internet Connection',
        text: 'Please check your internet connection and try again.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3b82f6',
      });
      return;
    }

    console.log("🌐 Internet connection: OK");
    console.log(`🔍 Opening modal for code: ${entry.code}`);
    
    // ✅ Show modal immediately - NO automatic approval history posting
    setModalVisaCode(entry.code);
    
    console.log("✅ Modal opened successfully");
    console.log("═══════════════════════════════════════════════");
  };

  const disableModal = () => {
    console.log("🔴 Closing modal");
    setModalVisaCode(false);
  };

  const [approvals, setApprovals] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    const fetchApprovalHistory = async () => {
      console.log("📜 Fetching approval history from database...");
      const { data, error } = await supabase
        .from("Approval_History")
        .select("*");

      if (error) {
        console.error("❌ Error fetching approval history:", error);
        setApprovalHistory([]);
      } else {
        console.log(`✅ Successfully fetched ${data.length} approval history records`);
        setApprovalHistory(data || []);
      }
    };

    fetchApprovalHistory();
  }, []);

  function getLatestResponseStatus(visaCode, approvalHistory) {
    const filtered = approvalHistory.filter((a) => a.PwpCode === visaCode);
    if (filtered.length === 0) return "Pending";

    filtered.sort(
      (a, b) => new Date(b.DateResponded) - new Date(a.DateResponded)
    );
    return filtered[0].Response || "Pending";
  }

  function getLatestResponseDate(visaCode, approvalHistory) {
    const filtered = approvalHistory.filter((a) => a.PwpCode === visaCode);
    if (filtered.length === 0) return "-";

    filtered.sort(
      (a, b) => new Date(b.DateResponded) - new Date(a.DateResponded)
    );
    const latestDate = filtered[0].DateResponded;
    const dateObj = new Date(latestDate);
    return dateObj.toLocaleString();
  }

  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!currentUser?.UserID || hasFetched) return;

    const fetchData = async () => {
      console.log("🔄 Starting data fetch...");
      console.log("👤 Current User:", {
        UserID: currentUser.UserID,
        name: currentUser.name,
        role: currentUser.role
      });

      try {
        const myName = currentUser.name?.toLowerCase().trim();
        const userId = currentUser.UserID;
        const isAdmin = currentUser.role?.toLowerCase() === "admin";

        console.log(`🔑 User Role: ${isAdmin ? 'ADMIN' : 'REGULAR USER'}`);

        const visaTables = ["cover_pwp", "regular_pwp", "Claims_pwp"];
        let combinedData = [];
        let allowedNames = [];

        for (const table of visaTables) {
          console.log(`📊 Fetching from table: ${table}...`);
          const { data, error } = await supabase.from(table).select("*");

          if (error) {
            console.error(`❌ Error fetching from ${table}:`, error.message);
            continue;
          }

          console.log(`✅ Fetched ${data.length} records from ${table}`);

          const normalizedAllowedNames = allowedNames.map((n) =>
            n.toLowerCase().trim()
          );

          const filteredData = isAdmin
            ? data
            : normalizedAllowedNames.length === 0
              ? data
              : data.filter((item) => {
                const createdBy = (item.CreatedForm || item.createForm || "")
                  .toLowerCase()
                  .trim();
                if (createdBy === myName) return true;
                return normalizedAllowedNames.includes(createdBy);
              });

          console.log(`🔍 Filtered ${filteredData.length} records for current user`);

          const formatted = filteredData
            .map((item) => {
              if (table === "cover_pwp") {
                return {
                  code: item.cover_code || "",
                  title: item.pwp_type || "N/A",
                  type: item.account_type || "N/A",
                  distributor: item.distributor_code || "N/A",
                  principal: item.objective || "N/A",
                  brand: item.promo_scheme || "N/A",
                  approver: item.approver || "N/A",
                  createForm: item.CreatedForm || item.createForm || "N/A",
                  status: item.notification === true ? "Approved" : "Pending",
                  responseDate: "",
                  sourceTable: table,
                  created_at: item.created_at || "N/A",
                };
              } else if (table === "regular_pwp") {
                return {
                  code: item.regularpwpcode || "",
                  title: item.pwptype || "N/A",
                  type: item.accountType ? item.accountType.join(", ") : "N/A",
                  distributor: item.distributor || "N/A",
                  principal: item.objective || "N/A",
                  brand: item.promoScheme || "N/A",
                  approver: item.approver || "N/A",
                  createForm: item.CreatedForm || item.createForm || "N/A",
                  status: item.notification === true ? "Approved" : "Pending",
                  responseDate: "",
                  sourceTable: table,
                  created_at: item.created_at || "N/A",
                };
              } else if (table === "Claims_pwp") {
                return {
                  code: item.code_pwp || "",
                  title: item.activity || "N/A",
                  type:
                    Array.isArray(item.account_types) &&
                      item.account_types.length > 0
                      ? item.account_types.join(", ")
                      : "N/A",
                  distributor: item.distributor || "N/A",
                  principal: "",
                  brand:
                    Array.isArray(item.category_names) &&
                      item.category_names.length > 0
                      ? item.category_names.join(", ")
                      : "N/A",
                  approver: "",
                  createForm: item.createForm || "N/A",
                  status: item.notification === true ? "Approved" : "Pending",
                  responseDate: "",
                  sourceTable: table,
                  created_at: item.created_at || "N/A",
                };
              }

              return null;
            })
            .filter((x) => x !== null);

          combinedData = [...combinedData, ...formatted];
        }

        if (isMounted) {
          console.log(`✅ Total combined data: ${combinedData.length} records`);
          setAllowedApproverNames(allowedNames);
          setApprovals(combinedData);
          setHasFetched(true);
        }
      } catch (error) {
        console.error("❌ Unexpected fetch error:", error);
        if (isMounted) setHasFetched(true);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.UserID, hasFetched]);

  const [allowedApproverNames, setAllowedApproverNames] = useState([]);
  const myName = currentUser?.name?.toLowerCase().trim();
  const [visaTypeFilter, setVisaTypeFilter] = useState("REGULAR");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const handlePageChange = (newPage) => {
    console.log(`📄 Page changed from ${currentPage} to ${newPage}`);
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  useEffect(() => {
    console.log("🔄 Filters changed - resetting to page 1");
    setCurrentPage(1);
  }, [visaTypeFilter, statusFilter, fromDate, toDate, searchTerm, todayOnly]);

  const filteredData = approvals.filter((entry) => {
    const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
    const role = currentUser?.role?.toLowerCase() || "";
    const entryDate = entry.created_at ? new Date(entry.created_at) : null;

    if (visaTypeFilter) {
      const code = entry.code?.toUpperCase() || "";
      let type = "";

      if (code.startsWith("R")) type = "REGULAR";
      else if (code.startsWith("CL")) type = "CLAIMS";
      else if (code.startsWith("C")) type = "COVER";

      if (type !== visaTypeFilter) return false;
    }

    if (searchTerm) {
      const searchValue = searchTerm.toLowerCase().trim();
      const distributorName = getDistributorName(entry.distributor)?.toLowerCase() || "";
      const userName = getUserNameById(entry.createForm)?.toLowerCase() || "";
      const codeMatch = entry.code?.toLowerCase().includes(searchValue);
      const createdFormMatch = (entry.createForm || "").toLowerCase().includes(searchValue);

      const matchesSearch =
        codeMatch ||
        distributorName.includes(searchValue) ||
        userName.includes(searchValue) ||
        createdFormMatch;

      if (!matchesSearch) return false;
    }

    if (statusFilter) {
      const entryStatus = getLatestResponseStatus(entry.code, approvalHistory);
      const normalizedEntryStatus = entryStatus.toLowerCase();
      const normalizedStatusFilter = statusFilter.toLowerCase();

      if (
        normalizedStatusFilter === "revision" ||
        normalizedStatusFilter === "sent back for revision"
      ) {
        if (
          normalizedEntryStatus !== "sent back for revision" &&
          normalizedEntryStatus !== "revision"
        ) {
          return false;
        }
      } else if (normalizedEntryStatus !== normalizedStatusFilter) {
        return false;
      }
    }

    if (fromDate && toDate && entryDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      if (entryDate < from || entryDate > to) return false;
    }

    if (todayOnly && entryDate) {
      const now = new Date();
      const isToday =
        entryDate.getFullYear() === now.getFullYear() &&
        entryDate.getMonth() === now.getMonth() &&
        entryDate.getDate() === now.getDate();

      if (!isToday) return false;
    }

    const createdFormName = (entry.createForm || "").toLowerCase().trim();
    if (role !== "admin") {
      if (createdFormName !== currentUserName) return false;
    }

    return true;
  });

  useEffect(() => {
    const newTotalPages = Math.ceil(filteredData.length / pageSize);
    console.log(`📊 Filtered data: ${filteredData.length} records, Total pages: ${newTotalPages}`);
    setTotalPages(newTotalPages);
  }, [filteredData]);

  const paginatedData = [...filteredData]
    .sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    })
    .slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const [userType, setUserType] = useState(null);
  const [approvalSetting, setApprovalSetting] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      console.log("⚙️ Fetching approval settings...");
      const { data, error } = await supabase
        .from("approval_settings")
        .select("single_approval, multiple_approval")
        .limit(1)
        .single();

      if (error) {
        console.error("❌ Error fetching approval settings:", error);
        return;
      }

      console.log("✅ Approval settings:", data);
      setApprovalSetting(data);
    }

    fetchSettings();
  }, []);

  useEffect(() => {
    if (!approvalSetting || !currentUser?.UserID) return;

    async function fetchUserDetails() {
      console.log("👤 Fetching user approval details...");
      try {
        const { data: accountData, error: accountError } = await supabase
          .from("Account_Users")
          .select("name")
          .eq("UserID", currentUser.UserID)
          .single();

        if (accountError) {
          console.error("❌ Error fetching name from Account_Users:", accountError);
          setUserType(null);
          return;
        }
        if (!accountData) {
          setUserType(null);
          return;
        }

        const userName = accountData.name;
        console.log(`👤 User name: ${userName}`);

        if (approvalSetting.single_approval) {
          console.log("🔍 Checking Single_Approval table...");
          const username = userName?.toLowerCase().trim();

          const { data: singleApprovalData, error: singleApprovalError } =
            await supabase
              .from("Single_Approval")
              .select("username, allowed_to_approve")
              .ilike("username", username)
              .maybeSingle();

          if (singleApprovalError) {
            console.error("❌ Error fetching from Single_Approval:", singleApprovalError);
            setUserType(null);
            return;
          }

          if (!singleApprovalData) {
            console.log("⚠️ User not found in Single_Approval");
            setUserType(null);
            return;
          }

          const userType = singleApprovalData.allowed_to_approve ? "Allowed" : "Not Allowed";
          console.log(`✅ User type: ${userType}`);
          setUserType(userType);
          return;
        }

        if (approvalSetting.multiple_approval) {
          console.log("🔍 Checking User_Approvers table...");
          const { data: approverData, error: approverError } = await supabase
            .from("User_Approvers")
            .select("Type, UserID, Approver_Name")
            .eq("UserID", currentUser.UserID)
            .single();

          if (approverError) {
            console.error("❌ Error fetching from User_Approvers:", approverError);
            setUserType(null);
            return;
          }
          if (!approverData) {
            console.log("⚠️ User not found in User_Approvers");
            setUserType(null);
            return;
          }

          console.log(`✅ User type: ${approverData.Type ?? "Not Allowed"}`);
          setUserType(approverData.Type ?? "Not Allowed");
        }
      } catch (err) {
        console.error("❌ Unexpected error in fetchUserDetails:", err);
        setUserType(null);
      }
    }

    fetchUserDetails();
  }, [approvalSetting, currentUser?.UserID]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "90vh",
        padding: "24px",
        boxSizing: "border-box",
        backgroundColor: "#f9fafb",
      }}
    >
      <h2
        style={{
          color: "#0f172a",
          fontSize: "26px",
          fontWeight: "700",
          padding: "12px 16px",
          background: "linear-gradient(to right, #3b82f6, #06b6d4)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "20px",
          borderBottom: "3px solid #e2e8f0",
          display: "inline-block",
          letterSpacing: "0.5px",
        }}
      >
        Approvals Management
      </h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          marginBottom: "20px",
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
        }}
      >
        <div className="filter-item" style={{ flexGrow: 1, minWidth: "250px" }}>
          <input
            type="text"
            placeholder="Search Code, Created By..."
            value={searchTerm}
            onChange={(e) => {
              console.log(`🔍 Search term changed: "${e.target.value}"`);
              setSearchTerm(e.target.value);
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#d1d5db";
            }}
          />
        </div>

        <div className="filter-item" style={{ minWidth: "150px" }}>
          <select
            value={visaTypeFilter}
            onChange={(e) => {
              console.log(`🏷️ Visa type filter changed: ${e.target.value}`);
              setVisaTypeFilter(e.target.value);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              fontSize: "14px",
              cursor: "pointer",
              width: "100%",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
            }}
          >
            <option value="REGULAR">REGULAR</option>
          </select>
        </div>

        <div className="filter-item" style={{ minWidth: "150px" }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              console.log(`📊 Status filter changed: ${e.target.value}`);
              setStatusFilter(e.target.value);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              fontSize: "14px",
              cursor: "pointer",
              width: "100%",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
            }}
          >
            <option value="">All Status</option>
            <option value="Approved">Approved</option>
            <option value="Sent back for revision">Disapproved</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
          }}
        >
          <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>
            Range:
          </span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              console.log(`📅 From date changed: ${e.target.value}`);
              setFromDate(e.target.value);
            }}
            style={{
              padding: "6px 8px",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "13px",
              color: "#374151",
            }}
          />
          <span style={{ color: "#6b7280" }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              console.log(`📅 To date changed: ${e.target.value}`);
              setToDate(e.target.value);
            }}
            style={{
              padding: "6px 8px",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "13px",
              color: "#374151",
            }}
          />
        </div>

        <button
          onClick={() => {
            console.log(`📆 Today filter toggled: ${!todayOnly}`);
            setTodayOnly((prev) => !prev);
          }}
          style={{
            padding: "10px 16px",
            backgroundColor: todayOnly ? "#3b82f6" : "#f3f4f6",
            color: todayOnly ? "#fff" : "#374151",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500",
            fontSize: "14px",
            transition: "all 0.2s",
          }}
        >
          {todayOnly ? "✓" : ""} TODAY
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          backgroundColor: "#fff",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "800px",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
          }}
        >
          <thead
            style={{
              backgroundColor: "#0063c5ff",
              position: "sticky",
              top: 0,
              zIndex: 1,
              fontSize: "13px",
              color: "#6b7280",
              fontWeight: "600",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <tr>
              <th style={{ padding: "12px 16px", textAlign: "left", backgroundColor: "#0d78e4ff", color: '#ffff' }}>Code</th>
              <th style={{ padding: "12px 16px", textAlign: "left", backgroundColor: "#0d78e4ff", color: '#ffff' }}>Distributor</th>
              <th style={{ padding: "12px 16px", textAlign: "left", backgroundColor: "#0d78e4ff", color: '#ffff' }}>Created At</th>
              <th style={{ padding: "12px 16px", textAlign: "left", backgroundColor: "#0d78e4ff", color: '#ffff' }}>Created By</th>
              <th style={{ padding: "12px 16px", textAlign: "left", backgroundColor: "#0d78e4ff", color: '#ffff' }}>Status</th>
              <th style={{ padding: "12px 16px", textAlign: "left", backgroundColor: "#0d78e4ff", color: '#ffff' }}>Response Date</th>
              <th style={{ padding: "12px 16px", textAlign: "left", backgroundColor: "#0d78e4ff", color: '#ffff' }}>Action</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: "13px", color: "#374151" }}>
            {paginatedData.length > 0 ? (
              [...paginatedData]
                .filter((entry) => {
                  const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
                  const currentUserId = currentUser?.name?.toLowerCase().trim() || "";
                  const role = currentUser?.role?.toLowerCase() || "";

                  if (role === "admin") return true;
                  return (entry.createForm || "").toLowerCase().trim() === currentUserId;
                })
                .map((entry, index) => {
                  const status = getLatestResponseStatus(entry.code, approvalHistory);
                  const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
                  const currentUserId = currentUser?.name?.toLowerCase().trim();
                  const isOwner = entry.createForm?.toLowerCase().trim() === currentUserId;

                  const statusDisplayText = (s) => {
                    switch (s) {
                      case "Approved": return "Approved";
                      case "Sent back for revision": return "Revision";
                      default: return "Pending";
                    }
                  };

                  const statusColorMap = {
                    Approved: "#10b981",
                    "Sent back for revision": "#f59e0b",
                    Declined: "#ef4444",
                    Cancelled: "#6b7280",
                    default: "#3b82f6",
                  };
                  const statusColor = statusColorMap[status] || statusColorMap["default"];

                  return (
                    <tr
                      key={index}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        transition: "background-color 0.15s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <button
                          style={{
                            backgroundColor:
                              entry.code.startsWith("CL")
                                ? "#47a347ff"
                                : entry.code.startsWith("R")
                                  ? "royalblue"
                                  : entry.code.startsWith("C")
                                    ? "skyblue"
                                    : "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "15px",
                            padding: "8px 16px",
                            fontWeight: "600",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                            transition: "all 0.2s ease-in-out",
                            transform: "translateY(0)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0, 0, 0, 0.3)";
                            e.currentTarget.style.opacity = "0.9";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.2)";
                            e.currentTarget.style.opacity = "1";
                          }}
                          onClick={() => {
                            console.log(`🔵 Code button clicked: ${entry.code}`);
                          }}
                        >
                          {entry.code}
                        </button>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        {getDistributorName(entry.distributor)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {new Date(entry.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {getUserNameById(entry.createForm)}
                      </td>
                      <td style={{ padding: "12px 16px", color: statusColor, fontWeight: "600" }}>
                        {statusDisplayText(status)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {getLatestResponseDate(entry.code, approvalHistory)}
                      </td>
                      <td style={{ padding: "12px 16px", display: "flex", gap: "8px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log(`🖱️ View Details button clicked for: ${entry.code}`);
                            handleRowClick(entry);
                          }}
                          style={{
                            padding: "10px 18px",
                            backgroundColor: "#3b82f6",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "600",
                            transition: "all 0.3s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = "#2563eb";
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.4)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = "#3b82f6";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.3)";
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
                  No approval requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {modalVisaCode && (
        <ViewDataModal
          visaCode={modalVisaCode}
          onClose={() => {
            console.log("🔴 Modal closed from ViewDataModal");
            setModalVisaCode(null);
          }}
        />
      )}

      <div
        style={{
          padding: "16px",
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: "10px",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: "8px 16px",
            backgroundColor: currentPage === 1 ? "#e5e7eb" : "#3b82f6",
            color: currentPage === 1 ? "#9ca3af" : "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            fontWeight: "500",
            fontSize: "14px",
          }}
        >
          Prev
        </button>
        <span style={{ color: "#6b7280", fontSize: "14px" }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: "8px 16px",
            backgroundColor: currentPage === totalPages ? "#e5e7eb" : "#3b82f6",
            color: currentPage === totalPages ? "#9ca3af" : "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            fontWeight: "500",
            fontSize: "14px",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
