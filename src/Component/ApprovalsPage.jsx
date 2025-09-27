import React, { useEffect, useState, useRef } from 'react';
import ApprovalDropdownButtons from './ApprovalDropdownButton';
import './ApprovalsPage.css';
import Swal from 'sweetalert2'; // Make sure you have this at the top

import { supabase } from '../supabaseClient';
import ViewDataModal from './ViewData/ViewDataModal';
export default function ApprovalsPage() {
  const storedUser = localStorage.getItem("loggedInUser");
  const currentUser = storedUser ? JSON.parse(storedUser) : null;
  const [modalVisaCode, setModalVisaCode] = React.useState(null);
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null); // To track which row's dropdown is open
  const dropdownRefs = useRef([]); // To track refs for closing
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

  const handleRowClick = (entry) => {
    console.log("Clicked row:", entry.code); // Add this
    setModalVisaCode(entry.code);
  };

  const disableModal = () => {
    setModalVisaCode(false);
  };

  const [approvals, setApprovals] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);


  const itemsPerPage = 8;

  function getLatestResponseStatus(visaCode, approvalHistory) {
    const filtered = approvalHistory.filter(a => a.PwpCode === visaCode);
    if (filtered.length === 0) return 'Pending';

    filtered.sort((a, b) => new Date(b.DateResponded) - new Date(a.DateResponded));
    return filtered[0].Response || 'Pending';
  }

  function getLatestResponseDate(visaCode, approvalHistory) {
    const filtered = approvalHistory.filter(a => a.PwpCode === visaCode);
    if (filtered.length === 0) return '-';

    filtered.sort((a, b) => new Date(b.DateResponded) - new Date(a.DateResponded));
    const latestDate = filtered[0].DateResponded;

    // Format date/time nicely, e.g. "2025-07-02 14:30"
    const dateObj = new Date(latestDate);
    return dateObj.toLocaleString(); // You can customize locale and options here
  }




  const [hasFetched, setHasFetched] = useState(false);
  useEffect(() => {
    let isMounted = true;

    if (!currentUser?.UserID || hasFetched) return;

    const fetchData = async () => {
      try {
        const myName = currentUser.name?.toLowerCase().trim();
        const userId = currentUser.UserID;
        const isAdmin = currentUser.role?.toLowerCase() === 'admin';

        const visaTables = ['cover_pwp', 'regular_pwp', 'Claims_pwp']; // <-- added Claims_pwp
        let combinedData = [];
        let allowedNames = [];

        for (const table of visaTables) {
          const { data, error } = await supabase.from(table).select('*');

          if (error) {
            console.error(`Error fetching from ${table}:`, error.message);
            continue;
          }

          const normalizedAllowedNames = allowedNames.map(n => n.toLowerCase().trim());

          const filteredData = isAdmin
            ? data
            : normalizedAllowedNames.length === 0
              ? data
              : data.filter(item => {
                const createdBy = (item.CreatedForm || item.createForm || '').toLowerCase().trim();
                if (createdBy === myName) return true;
                return normalizedAllowedNames.includes(createdBy);
              });

          const formatted = filteredData.map(item => {
            if (table === 'cover_pwp') {
              return {
                code: item.cover_code || '',
                title: item.pwp_type || 'N/A',
                type: item.account_type || 'N/A',
                distributor: item.distributor_code || 'N/A',
                principal: item.objective || 'N/A',
                brand: item.promo_scheme || 'N/A',
                approver: item.approver || 'N/A',
                createForm: item.CreatedForm || item.createForm || 'N/A',
                status: item.notification === true ? 'Approved' : 'Pending',
                responseDate: '',
                sourceTable: table,
                created_at: item.created_at || 'N/A',
              };
            } else if (table === 'regular_pwp') {
              return {
                code: item.regularpwpcode || '',
                title: item.pwptype || 'N/A',
                type: item.accountType ? item.accountType.join(', ') : 'N/A',
                distributor: item.distributor || 'N/A',
                principal: item.objective || 'N/A',
                brand: item.promoScheme || 'N/A',
                approver: item.approver || 'N/A',
                createForm: item.CreatedForm || item.createForm || 'N/A',
                status: item.notification === true ? 'Approved' : 'Pending',
                responseDate: '',
                sourceTable: table,
                created_at: item.created_at || 'N/A',
              };
            } else if (table === 'Claims_pwp') {
              return {
                code: item.code_pwp || '',
                title: item.activity || 'N/A',
                type: Array.isArray(item.account_types) && item.account_types.length > 0
                  ? item.account_types.join(', ')
                  : 'N/A',
                distributor: item.distributor || 'N/A',
                principal: '', // not in schema
                brand: Array.isArray(item.category_names) && item.category_names.length > 0
                  ? item.category_names.join(', ')
                  : 'N/A',
                approver: '', // not in schema
                createForm: item.createForm || 'N/A',
                status: item.notification === true ? 'Approved' : 'Pending',
                responseDate: '',
                sourceTable: table,
                created_at: item.created_at || 'N/A',
              };
            }

            return null;
          }).filter(x => x !== null);

          combinedData = [...combinedData, ...formatted];
        }

        if (isMounted) {
          setAllowedApproverNames(allowedNames);
          setApprovals(combinedData);
          setHasFetched(true);
        }
      } catch (error) {
        console.error("Unexpected fetch error:", error);
        if (isMounted) setHasFetched(true);
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [currentUser?.UserID, hasFetched, supabase]);






  const [allowedApproverNames, setAllowedApproverNames] = useState([]);

  const myName = currentUser?.name?.toLowerCase().trim();
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const [visaTypeFilter, setVisaTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);

  const [filteredData, setFilteredData] = useState(approvals || []);

  // Filter logic inside useEffect so it updates when filters or approvals change
  const [totalPages, setTotalPages] = useState(1);

  const pageSize = 10;

  // Pagination handler
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [visaTypeFilter, statusFilter, fromDate, toDate, searchTerm, todayOnly]);

  // Filter logic
  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
    const role = currentUser?.role || ""; // <-- get role here
    console.log("User name:", currentUser?.name || "");
    console.log("Role:", role);

    const newFilteredData = approvals.filter((entry) => {
      const entryType = entry.pwp_type?.toLowerCase();
      const entryStatus = entry.status?.toLowerCase();
      const createdFormName = entry.CreatedForm?.toLowerCase();
      const entryDate = entry.created_at ? new Date(entry.created_at) : null;

      // Search filter
      const matchesSearch = Object.values(entry)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter
        ? entryStatus === statusFilter.toLowerCase()
        : true;

      // Date range filter
      const matchesDateRange = fromDate && toDate
        ? (() => {
          if (!entryDate) return false;
          const from = new Date(fromDate);
          const to = new Date(toDate);
          return entryDate >= from && entryDate <= to;
        })()
        : true;

      // Today-only filter
      const matchesToday = todayOnly
        ? (() => {
          if (!entryDate) return false;
          const now = new Date();
          return (
            entryDate.getFullYear() === now.getFullYear() &&
            entryDate.getMonth() === now.getMonth() &&
            entryDate.getDate() === now.getDate()
          );
        })()
        : true;

      // User permission + CreatedForm match with current user
      const isUserAllowed = role === 'admin'
        ? true
        : createdFormName
          ? (allowedApproverNames.includes(createdFormName) || createdFormName === myName.toLowerCase())
          && createdFormName === currentUserName
          : true;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDateRange &&
        matchesToday &&
        isUserAllowed
      );
    });

    setFilteredData(newFilteredData);
  }, [
    approvals,
    visaTypeFilter,
    statusFilter,
    fromDate,
    toDate,
    searchTerm,
    todayOnly,
    allowedApproverNames,
    myName,
  ]);

  // Update total pages after filtering
  useEffect(() => {
    setTotalPages(Math.ceil(filteredData.length / pageSize));
  }, [filteredData]);

  // Calculate paginated data
  const paginatedData = filteredData
    .filter(entry => {
      if (!visaTypeFilter) return true;
      const firstLetter = entry.code?.charAt(0).toUpperCase();
      let type = "";
      if (firstLetter === "R") type = "REGULAR";
      else if (firstLetter === "C") type = "COVER";
      return type === visaTypeFilter;
    })
    .slice((currentPage - 1) * pageSize, currentPage * pageSize);







  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = filteredData.slice(indexOfFirstItem, indexOfLastItem);







  const [userType, setUserType] = useState(null);
  const [approvalSetting, setApprovalSetting] = useState(null);

  useEffect(() => {
    // Fetch approval settings once
    async function fetchSettings() {
      const { data, error } = await supabase
        .from("approval_settings")
        .select("single_approval, multiple_approval")
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching approval settings:", error);
        return;
      }

      console.log("Single Approval is:", data?.single_approval);
      console.log("Multiple Approval is:", data?.multiple_approval);

      setApprovalSetting(data);
    }

    fetchSettings();
  }, []);

  useEffect(() => {
    if (!approvalSetting || !currentUser?.UserID) return;

    async function fetchUserDetails() {
      try {
        // Fetch user name
        const { data: accountData, error: accountError } = await supabase
          .from("Account_Users")
          .select("name")
          .eq("UserID", currentUser.UserID)
          .single();

        if (accountError) {
          console.error("Error fetching name from Account_Users:", accountError);
          setUserType(null);
          return;
        }
        if (!accountData) {
          console.warn("Account_Users: no record found for this UserID:", currentUser.UserID);
          setUserType(null);
          return;
        }

        const userName = accountData.name;
        console.log("Fetched username:", userName);
        if (approvalSetting.single_approval) {
          const username = userName?.toLowerCase().trim();
          console.log("Single approval mode. Normalized username to search:", `"${username}"`);

          const { data: singleApprovalData, error: singleApprovalError } = await supabase
            .from("Single_Approval")
            .select("username, allowed_to_approve")
            .ilike("username", username)  // ✅ use ilike here
            .maybeSingle();

          if (singleApprovalError) {
            console.error("Error fetching from Single_Approval:", singleApprovalError);
            setUserType(null);
            return;
          }

          if (!singleApprovalData) {
            console.warn("No Single_Approval record found for user:", username);
            setUserType(null);
            return;
          }

          console.log(`Match found: username='${singleApprovalData.username}', allowed_to_approve=${singleApprovalData.allowed_to_approve}`);
          setUserType(singleApprovalData.allowed_to_approve ? "Allowed" : "Not Allowed");
          return;
        }


        if (approvalSetting.multiple_approval) {
          // similar debug as above
          const { data: approverData, error: approverError } = await supabase
            .from("User_Approvers")
            .select("Type, UserID, Approver_Name")
            .eq("UserID", currentUser.UserID)
            .single();

          if (approverError) {
            console.error("Error fetching from User_Approvers:", approverError);
            setUserType(null);
            return;
          }
          if (!approverData) {
            console.warn("No User_Approvers record found for UserID:", currentUser.UserID);
            setUserType(null);
            return;
          }

          console.log(`Found User_Approvers: Type='${approverData.Type}', Name='${approverData.Approver_Name}'`);

          setUserType(approverData.Type ?? "Not Allowed");
        }
      } catch (err) {
        console.error("Unexpected error in fetchUserDetails:", err);
        setUserType(null);
      }
    }

    fetchUserDetails();
  }, [approvalSetting, currentUser?.UserID]);





  const [approvalHistory, setApprovalHistory] = useState([]);

  useEffect(() => {
    const fetchApprovalHistory = async () => {
      const { data, error } = await supabase
        .from("Approval_History")
        .select("*");

      if (error) {
        console.error("Error fetching approval history:", error);
        setApprovalHistory([]);
      } else {
        setApprovalHistory(data);
      }
    };

    fetchApprovalHistory();
  }, []);


  const [selectedRows, setSelectedRows] = useState([]);
  const handleCheckboxChange = (code) => {
    setSelectedRows((prevSelected) =>
      prevSelected.includes(code)
        ? prevSelected.filter((item) => item !== code)
        : [...prevSelected, code]
    );
  };

  const handleDeleteSelected = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || "unknown";
      const actionUser = currentUser?.name || "unknown";

      for (const code of selectedRows) {
        const entry = approvals.find((item) => item.code === code);
        if (!entry) continue;

        const prefix = entry.code[0].toUpperCase();

        let table = "";
        if (prefix === "R") {
          table = "Regular_Visa";
        } else if (prefix === "C") {
          table = "Corporate_Visa";
        } else if (prefix === "V") {
          table = "Cover_Visa";
        } else {
          console.warn(`Unrecognized visa code prefix for ${code}`);
          continue;
        }

        // 1. Delete related visa sub-tables based on prefix
        const relatedTables = {
          R: [
            "Regular_Visa_Attachments",
            "Regular_Visa_CostDetails",
            "Regular_Visa_VolumePlan",
          ],
          C: [
            "Corporate_Visa_Attachments",
            "Corporate_Visa_Details",
          ],
          V: [
            "Cover_Visa_Attachments",
            "Cover_Visa_CostDetails",
            "Cover_Visa_VolumePlan",
          ],
        };

        for (const relTable of relatedTables[prefix] || []) {
          const { error: relErr } = await supabase
            .from(relTable)
            .delete()
            .eq("visaCode", code);

          if (relErr) {
            console.warn(`Failed to delete from ${relTable}:`, relErr.message);
          }
        }

        // 2. Delete the visa main record
        const { error: visaDeleteError } = await supabase
          .from(table)
          .delete()
          .eq("visaCode", code);

        if (visaDeleteError) {
          console.error(`Failed to delete visa from ${table}:`, visaDeleteError.message);
          continue;
        }

        // 3. Fetch related amount_badget record to archive it before delete
        const { data: amountBadgetData, error: amountFetchError } = await supabase
          .from("amount_badget")
          .select("*")
          .eq("visacode", code)
          .single();

        if (amountFetchError) {
          console.warn("Could not fetch amount_badget record for archiving:", amountFetchError.message);
        }

        // 4. Insert into amount_badget_history (archive)
        if (amountBadgetData) {
          const {
            id: original_id,
            visacode,
            amountbadget,
            createduser,
            createdate,
            remainingbalance,
            RegularID,
          } = amountBadgetData;

          const { error: historyError } = await supabase
            .from("amount_badget_history")
            .insert({
              original_id,
              visacode,
              amountbadget,
              createduser,
              createdate,
              remainingbalance,
              RegularID,
              action_type: "DELETE",
              action_user: actionUser,
              action_date: new Date().toISOString(),
              TotalCost: null, // add if applicable
            });

          if (historyError) {
            console.warn("Failed to insert into amount_badget_history:", historyError.message);
          }
        }

        // 5. Delete from amount_badget
        const { error: amountDeleteError } = await supabase
          .from("amount_badget")
          .delete()
          .eq("visacode", code);

        if (amountDeleteError) {
          console.warn("Failed to delete from amount_badget:", amountDeleteError.message);
        }

        // 6. Log RecentActivity
        try {
          const ipRes = await fetch("https://api.ipify.org?format=json");
          const { ip } = await ipRes.json();

          const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
          const geo = await geoRes.json();

          const activityLog = {
            userId: userId,
            device: navigator.userAgent || "Unknown Device",
            location: `${geo.city || "Unknown"}, ${geo.region || "Unknown"}, ${geo.country_name || "Unknown"}`,
            ip,
            time: new Date().toISOString(),
            action: `Deleted visa with code: ${code}`,
          };

          const { error: activityError } = await supabase
            .from("RecentActivity")
            .insert(activityLog);

          if (activityError) {
            console.warn("Failed to log visa deletion activity:", activityError.message);
          }
        } catch (logError) {
          console.warn("Error logging visa deletion activity:", logError.message);
        }
      }

      // Refresh the approvals list locally (UI)
      setApprovals((prevApprovals) =>
        prevApprovals.filter((item) => !selectedRows.includes(item.code))
      );
      setSelectedRows([]); // Clear selected rows
    } catch (error) {
      console.error("Failed to delete selected entries:", error.message);
    }
  };

  const handleDeclineClick = async (entryCode) => {
    const entry = approvals.find((item) => item.code === entryCode);
    if (!entry?.code) return;

    const dateTime = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const userId = currentUser?.UserID || "unknown";
    const createdForm = entry.createForm || "unknown"; // normalize CreatedForm

    try {
      // 1. Insert into Supabase Approval_History
      const { error: supabaseError } = await supabase
        .from("Approval_History")
        .insert({
          PwpCode: entry.code,
          ApproverId: userId,
          DateResponded: dateTime,
          Response: "Declined",
          Type: userType || null,
          Notication: false,
          CreatedForm: createdForm, // include CreatedForm
        });

      if (supabaseError) {
        console.error("Supabase insert error:", supabaseError.message);
        Swal.fire("Error", "Failed to log the decline action.", "error");
        return;
      }

      // 2. Log to RecentActivity
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const { ip } = await ipRes.json();

        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const geo = await geoRes.json();

        const activity = {
          userId,
          device: navigator.userAgent || "Unknown Device",
          location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
          ip,
          time: dateTime,
          action: `Declined the ${entry.code}`,
          createdForm, // optional, log CreatedForm
        };

        const { error: activityError } = await supabase
          .from("RecentActivity")
          .insert(activity);

        if (activityError) {
          console.error("RecentActivity log error:", activityError.message);
        } else {
          console.log("📝 Activity logged:", activity);
        }
      } catch (logErr) {
        console.warn("Activity logging failed:", logErr.message);
      }

      // 3. Update UI state
      setApprovals((prevApprovals) =>
        prevApprovals.map((item) =>
          item.code === entryCode
            ? { ...item, status: "Declined", responseDate: dateTime }
            : item
        )
      );

      // 4. Swal success alert
      Swal.fire({
        icon: "success",
        title: "Declined",
        text: `${entry.code} has been declined successfully.`,
        confirmButtonText: "OK",
      }).then(() => {
        window.location.reload();
      });

    } catch (error) {
      console.error(`Failed to decline ${entry.code}:`, error.message || error);
      Swal.fire("Error", "Something went wrong while declining the entry.", "error");
    }
  };


  const handleSendBackClick = async (entryCode) => {
    const entry = approvals.find(item => item.code === entryCode);
    if (!entry?.code) return;

    const dateTime = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const userId = currentUser?.UserID || "unknown";
    const createdForm = entry.createForm || "unknown"; // normalize CreatedForm

    try {
      // 🔹 Supabase insert into Approval_History
      const { error: supError } = await supabase
        .from("Approval_History")
        .insert({
          PwpCode: entry.code,
          ApproverId: userId,
          DateResponded: dateTime,
          Response: "Sent back for revision",
          Type: userType || null,
          Notication: false,
          CreatedForm: createdForm, // include CreatedForm
        });

      if (supError) {
        console.error("Supabase insert error:", supError.message);
        Swal.fire("Error", "Failed to log the send-back action.", "error");
        return;
      }

      // 🔹 Supabase insert into RecentActivity
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const { ip } = await ipRes.json();

        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const geo = await geoRes.json();

        const activityEntry = {
          userId,
          device: navigator.userAgent || "Unknown Device",
          location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
          ip: ip,
          time: dateTime,
          action: `Sent back ${entry.code} for revision`,
          createdForm, // optional, log CreatedForm in activity
        };

        const { error: activityError } = await supabase
          .from("RecentActivity")
          .insert(activityEntry);

        if (activityError) {
          console.error("RecentActivity log error:", activityError.message);
        } else {
          console.log("📝 Activity logged:", activityEntry);
        }
      } catch (logErr) {
        console.warn("Activity logging failed:", logErr.message);
      }

      // 🔹 Update local state
      setApprovals(prev =>
        prev.map(item =>
          item.code === entryCode
            ? { ...item, status: "Revision", responseDate: dateTime }
            : item
        )
      );

      // 🔹 Swal success alert
      Swal.fire({
        icon: "success",
        title: "Success",
        text: `${entry.code} has been sent back for revision.`,
        confirmButtonText: "OK",
      }).then(() => {
        window.location.reload();
      });

    } catch (error) {
      console.error(`Failed to send back ${entry.code}:`, error.message || error);
      Swal.fire("Error", "Something went wrong while sending back the entry.", "error");
    }
  };


  const handleApproveClick = async (entryCode) => {
    const entry = approvals.find((item) => item.code === entryCode);
    if (!entry || !entry.code) return;

    console.log("🔍 Entry being approved:", entry);

    const dateTime = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const userId = currentUser?.UserID || "unknown";

    // 🔒 Prevent duplicate click
    if (entry.isSubmitting) return;

    // Set "submitting" flag in local state
    setApprovals((prev) =>
      prev.map((item) =>
        item.code === entryCode ? { ...item, isSubmitting: true } : item
      )
    );

    let remainingBalance = null; // remaining_balance for amount_badget
    let creditBudget = null;     // credit_budget from regular_pwp
    let coverPwpCode = null;     // coverPwpCode from regular_pwp

    try {
      // 1. Insert into Approval_History
      const { error: historyError } = await supabase
        .from("Approval_History")
        .insert({
          PwpCode: entry.code,
          ApproverId: userId,
          DateResponded: dateTime,
          Response: "Approved",
          Type: userType || "admin",
          Notication: false,
          CreatedForm: entry.createForm || "unknown",
        });

      if (historyError) {
        console.error("❌ Supabase insert error:", historyError.message);
        Swal.fire("Error", "Failed to log approval. Please try again.", "error");
        return;
      }

      console.log("✅ Approval_History updated with:", {
        PwpCode: entry.code,
        CreatedForm: entry.createForm,
        ApproverId: userId,
      });

      // Prepare update payload for amount_badget
      let updatePayload = {
        Approved: true,
        createdate: dateTime,
      };

      // 2. If code starts with 'R', fetch credit_budget and coverPwpCode
      if (entry.code.startsWith("R")) {
        const { data: pwpData, error: pwpError } = await supabase
          .from("regular_pwp")
          .select("remaining_balance, coverPwpCode, credit_budget")
          .eq("regularpwpcode", entry.code)
          .single();

        if (pwpError || !pwpData) {
          console.error("❌ Failed to fetch regular_pwp:", pwpError?.message || "No data");
          Swal.fire("Error", "Missing budget data.", "error");
          return;
        }

        remainingBalance = parseFloat(pwpData.remaining_balance); // for amount_badget
        creditBudget = parseFloat(pwpData.credit_budget);        // for approved_history_budget
        coverPwpCode = pwpData.coverPwpCode;

        if (isNaN(remainingBalance) || isNaN(creditBudget) || !coverPwpCode) {
          console.error("❌ Invalid budget data");
          Swal.fire("Error", "Invalid budget or missing cover code.", "error");
          return;
        }

        // Update amount_badget where pwp_code === coverPwpCode
        const { data: updateData, error: updateError } = await supabase
          .from("amount_badget")
          .update({
            remainingbalance: remainingBalance,
            ...updatePayload,
          })
          .eq("pwp_code", coverPwpCode)
          .select();

        if (updateError) {
          console.error("❌ Failed to update amount_badget with coverPwpCode:", updateError.message);
          Swal.fire("Error", "Failed to update budget approval.", "error");
          return;
        }

        console.log("✅ amount_badget updated with coverPwpCode:", updateData);

      } else {
        // Update amount_badget where pwp_code === entry.code
        const { data: updatedRows, error: updateError } = await supabase
          .from("amount_badget")
          .update(updatePayload)
          .eq("pwp_code", entry.code)
          .select();

        if (updateError) {
          console.error("❌ Failed to update amount_badget:", updateError.message);
          Swal.fire("Error", "Failed to update budget approval.", "error");
          return;
        } else {
          console.log("✅ amount_badget updated:", updatedRows);
        }
      }

      // 3. Insert into approved_history_budget (with correct credit_budget & coverPwpCode)
      const { data: historyBudgetData, error: historyBudgetError } = await supabase
        .from("approved_history_budget")
        .insert({
          pwp_code: entry.code,
          approver_id: userId,
          date_responded: dateTime,
          response: "Approved",
          type: userType || "admin",
          created_form: entry.createForm || "unknown",
          remaining_balance: remainingBalance, // for amount_badget
          credit_budget: creditBudget,          // now correctly from regular_pwp.credit_budget
          cover_pwp_code: coverPwpCode,         // from regular_pwp
          updated_amount_badget: true
        })
        .select();

      if (historyBudgetError) {
        console.error("❌ Failed to insert into approved_history_budget:", historyBudgetError.message);
        Swal.fire("Error", "Failed to log approval + budget.", "error");
        return;
      } else {
        console.log("✅ approved_history_budget inserted:", historyBudgetData);
      }

      // 4. Log to RecentActivity
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const { ip } = await ipRes.json();

        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const geo = await geoRes.json();

        const activity = {
          userId,
          device: navigator.userAgent || "Unknown Device",
          location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
          ip,
          time: dateTime,
          action: `Approved the ${entry.code}`,
        };

        const { error: activityError } = await supabase
          .from("RecentActivity")
          .insert(activity);

        if (activityError) {
          console.error("⚠️ Activity log failed:", activityError.message);
        } else {
          console.log("📝 Activity logged:", activity);
        }
      } catch (logErr) {
        console.warn("⚠️ Activity logging failed:", logErr.message);
      }

      // 5. Update local state (UI only)
      setApprovals((prev) =>
        prev.map((item) =>
          item.code === entryCode
            ? {
              ...item,
              status: "Approved",
              responseDate: dateTime,
              isSubmitting: false,
            }
            : item
        )
      );

      // ✅ Swal success popup
      Swal.fire({
        icon: "success",
        title: "Approved!",
        text: `Entry ${entry.code} was approved successfully.`,
        confirmButtonText: "OK",
      }).then(() => {
        window.location.reload(); // reload page after user clicks OK
      });


    } catch (error) {
      console.error(`❌ Failed to approve ${entry.code}:`, error.message || error);
      Swal.fire("Error", "Something went wrong during approval.", "error");

      // Reset submitting flag on error
      setApprovals((prev) =>
        prev.map((item) =>
          item.code === entryCode ? { ...item, isSubmitting: false } : item
        )
      );
    }
  };

  const [allowedToApprove, setAllowedToApprove] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');

  // Load current user and fetch approval permission
  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const username = parsedUser?.username || parsedUser?.email || parsedUser?.user_id || '';
    setCurrentUsername(username.toLowerCase().trim());

    async function fetchApprovalPermission() {
      if (!username) return;
      const { data, error } = await supabase
        .from('Single_Approval')
        .select('allowed_to_approve')
        .eq('username', username.toLowerCase().trim())
        .single();

      if (!error && data) {
        setAllowedToApprove(data.allowed_to_approve);
      } else {
        setAllowedToApprove(false);
      }
    }

    fetchApprovalPermission();
  }, []);


  const [distributors, setDistributors] = useState([]);

  useEffect(() => {
    const fetchDistributors = async () => {
      const { data, error } = await supabase
        .from('distributors')
        .select('code, name');

      if (error) {
        console.error('❌ Error fetching distributors:', error);
      } else {
        console.log('✅ Fetched Distributors:', data);
        setDistributors(data);
      }
    };

    fetchDistributors();
  }, []);

  const getDistributorName = (code) => {
    const distributor = distributors.find((d) => Number(d.code) === Number(code));
    return distributor ? distributor.name : `Code: ${code}`;
  };

  const userId = currentUser?.UserID || "unknown";
  const names = currentUser?.name || "";
  console.log("User name:", names);  // <--- console log here
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '90vh',
        padding: '20px', // Increased padding for more space
        boxSizing: 'border-box',
        backgroundColor: '#ffffff', // Explicit white background
      }}
    >
      {/* 1. Header (Updated with Gradient) */}
      <h2
        style={{
          color: "#ffffff", // White text for contrast
          // Premium Blue Gradient
          background: "linear-gradient(to right, #4f46e5, #2575fc)",
          padding: "15px 25px", // More padding
          borderLeft: "8px solid #f97316", // Accent Orange border
          borderRadius: "10px", // Smoother corners
          marginBottom: "25px",
          fontSize: "20px",
          fontWeight: '700',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', // Soft shadow for lift
        }}
      >
        Approvals
      </h2>

      {/* 2. Filters Section (Refined Layout and Styling) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px', // Increased gap between filters
          alignItems: 'center',
          marginBottom: '20px',
          padding: '15px', // Added padding to filter bar itself
          backgroundColor: '#f8f9fa', // Light gray background for the filter bar
          borderRadius: '10px',
          border: '1px solid #e1e8ed',
        }}
      >

        {/* Search (Primary Filter - Enhanced) */}
        <div className="filter-item" style={{ flexGrow: 1, minWidth: '250px' }}>
          <input
            type="text"
            placeholder="🔍 Search Code, Created By..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 18px', // Taller padding
              border: '1px solid #c8d3db', // Slightly darker initial border
              borderRadius: '10px',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.3s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4f46e5'; // Primary Blue focus
              e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.2)'; // Ring shadow
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#c8d3db';
              e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            }}
          />
        </div>

        {/* Marketing Type Filter (Standardized Selects) */}
        <div className="filter-item" style={{ minWidth: '150px' }}>
          <select
            value={visaTypeFilter}
            onChange={(e) => setVisaTypeFilter(e.target.value)}
            style={{
              padding: '12px 16px', // Standardized height
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              width: '100%',
              border: '1px solid #c8d3db',
              backgroundColor: '#fff',
              appearance: 'none', // Hide default arrow (requires custom arrow with CSS or icon)
              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010H7Z%22%20fill%3D%22%236b7280%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: '30px',
            }}
          >
            <option value="">All Marketing Types</option>
            <option value="REGULAR">REGULAR</option>
            <option value="COVER">COVER</option>
          </select>
        </div>

        {/* Status Filter (Standardized Selects) */}
        <div className="filter-item" style={{ minWidth: '150px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '12px 16px', // Standardized height
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              width: '100%',
              border: '1px solid #c8d3db',
              backgroundColor: '#fff',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010H7Z%22%20fill%3D%22%236b7280%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: '30px',
            }}
          >
            <option value="">All Status</option>
            <option value="Approved">Approved</option>
            <option value="Declined">Declined</option>
            <option value="Sent back for revision">Revision</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Date Range (Styled as a unified component) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#fff',
            padding: '8px 15px', // More vertical padding
            borderRadius: '8px',
            border: '1px solid #c8d3db',
          }}
        >
          <span style={{ fontSize: '14px', color: '#666', fontWeight: '600' }}>🗓️ Range:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#333',
            }}
          />
          <span style={{ color: '#666' }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#333',
            }}
          />
        </div>

        {/* TODAY Filter (Styled as a primary/secondary toggle button) */}
        <button
          onClick={() => setTodayOnly(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px', // Button-like padding
            // Dynamic background color for toggle state
            backgroundColor: todayOnly ? '#4f46e5' : '#e1e8ed',
            color: todayOnly ? '#fff' : '#444',
            border: 'none',
            borderRadius: '9999px', // Bubble shape
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            userSelect: 'none',
            transition: 'all 0.3s ease',
            boxShadow: todayOnly ? '0 4px 10px rgba(79, 70, 229, 0.2)' : 'none',
          }}
          onMouseOver={(e) => { if (!todayOnly) e.currentTarget.style.backgroundColor = '#d1d8df'; }}
          onMouseOut={(e) => { if (!todayOnly) e.currentTarget.style.backgroundColor = '#e1e8ed'; }}
        >
          {todayOnly ? '☑️' : '☐'} TODAY
        </button>
      </div>

      {/* 3. Delete Selected Button (Enhanced with Bubble Style) */}
      {selectedRows.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '15px',
          }}
        >
          <button
            onClick={handleDeleteSelected}
            style={{
              padding: '10px 25px', // Taller button
              backgroundColor: '#ef4444', // Tailwind Red-500
              color: '#fff',
              border: 'none',
              borderRadius: '9999px', // Bubble shape
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '700',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)', // Soft red shadow
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')} // Darker red on hover
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
          >
            🗑️ Delete {selectedRows.length} Selected
          </button>
        </div>
      )}

      {/* The Table Component goes here (as previously provided) */}



      {/* Table */}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: '#fff',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: '800px',
            color: '#1E40AF',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          }}
        >
          <thead
            style={{
              backgroundColor: '#2575fc',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              fontSize: '14px',
              color: '#ffffff',
            }}
          >
            <tr>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}></th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Code</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Distributor</th>

              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Created At</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Created</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Response Date</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '240px' }}>Action</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '12px', color: '#000000ff' }}>
            {paginatedData.length > 0 ? (
              [...paginatedData]
                // Filter to show only entries where createForm matches current user (case-insensitive)
                .filter(entry => {
                  const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
                  const currentUserId = currentUser?.name?.toLowerCase().trim() || "";
                  const role = currentUser?.role?.toLowerCase() || "";

                  // Show all if Admin
                  if (role === "admin") return true;

                  // Otherwise, only show if createForm matches
                  return (entry.createForm || "").toLowerCase().trim() === currentUserId;
                })
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map((entry, index) => {
                  // --- BEGIN STATUS & OWNERSHIP LOGIC ---
                  const status = getLatestResponseStatus(entry.code, approvalHistory);
                  const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
                  const currentUserId = currentUser?.name?.toLowerCase().trim();
                  const isOwner = entry.createForm?.toLowerCase().trim() === currentUserId;

                  // Improved Status Display Text
                  const statusDisplayText = (s) => {
                    switch (s) {
                      case 'Approved':
                        return 'APPROVED';
                      case 'Sent back for revision':
                        return 'REVISION';
                      case 'Declined':
                        return 'DECLINED';
                      case 'Cancelled':
                        return 'CANCELLED';
                      default:
                        return 'PENDING';
                    }
                  };

                  // Status Color Map
                  const statusColorMap = {
                    'Approved': '#059669', // Green-600
                    'Sent back for revision': '#f59e0b', // Amber-600
                    'Declined': '#dc2626', // Red-600
                    'Cancelled': '#4b5563', // Gray-600
                    'default': '#4f46e5', // Indigo-600 (Pending)
                  };
                  const statusColor = statusColorMap[status] || statusColorMap['default'];
                  // --- END STATUS & OWNERSHIP LOGIC ---

                  return (
                    <tr
                      key={index}
                      style={{
                        borderBottom: '1px solid #cbd5e1',
                        cursor: 'pointer',
                        backgroundColor: index % 2 === 0 ? '#f9fafb' : 'transparent',
                      }}
                      onClick={() => handleRowClick(entry)}
                    >
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(entry.code)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleCheckboxChange(entry.code);
                          }}
                        // Only one stopPropagation is needed here
                        />
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{entry.code}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>
                        {getDistributorName(entry.distributor)}
                      </td>

                      <td style={{ padding: '8px 12px' }}>
                        {/* Clean up date formatting for better legibility */}
                        {new Date(entry.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) +
                          ' ' +
                          new Date(entry.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: 'numeric',
                            hour12: true,
                          })}
                      </td>
                      {/* 4. Created By (Now with Random User Icon/Initial) */}
                      <td style={{ padding: '12px 16px', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {(() => {
                          const initial = entry.createForm.charAt(0).toUpperCase();
                          const colorSeed = entry.code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                          const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
                          const bgColor = colors[colorSeed % colors.length];

                          return (
                            <span
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: bgColor,
                                color: '#ffffff',
                                fontWeight: '700',
                                fontSize: '11px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                flexShrink: 0,
                                title: `User: ${entry.createForm}`,
                              }}
                            >
                              {initial}
                            </span>
                          );
                        })()}

                        <span style={{ color: '#374151', fontWeight: '500' }}>
                          {entry.createForm}
                        </span>
                      </td>
                      {/* 5. Status (Using consolidated logic) */}
                      <td
                        style={{
                          padding: '12px 16px',
                          color: statusColor,
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {statusDisplayText(status)}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {getLatestResponseDate(entry.code, approvalHistory)}
                      </td>
                      <td
                        style={{
                          padding: '16px 12px',
                          display: 'flex',
                          gap: '12px',
                          position: 'relative',
                          justifyContent: 'flex-start', // Align left for better flow
                          alignItems: 'center',
                          minWidth: '240px',
                        }}
                      >
                        {userType === 'Allowed' ? (
                          <>
                            {/* 1. Approve Button (Primary Action) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveClick(entry.code);
                              }}
                              disabled={status === 'Approved'}
                              style={{
                                padding: '10px 18px', // Standardized padding
                                backgroundColor: status === 'Approved' ? '#c4b5fd' : '#4f46e5',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '9999px',
                                cursor: status === 'Approved' ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: '700',
                                boxShadow: status === 'Approved' ? 'none' : '0 6px 15px rgba(79, 70, 229, 0.4)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                minWidth: '110px',
                                letterSpacing: '0.5px',
                                transform: status === 'Approved' ? 'scale(1)' : 'scale(1.00)', // Subtle lift removed for better consistency
                              }}
                              onMouseOver={(e) => {
                                if (status !== 'Approved') {
                                  e.currentTarget.style.backgroundColor = '#6366f1';
                                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(79, 70, 229, 0.5)';
                                  e.currentTarget.style.transform = 'scale(1.02)';
                                }
                              }}
                              onMouseOut={(e) => {
                                if (status !== 'Approved') {
                                  e.currentTarget.style.backgroundColor = '#4f46e5';
                                  e.currentTarget.style.boxShadow = '0 6px 15px rgba(79, 70, 229, 0.4)';
                                  e.currentTarget.style.transform = 'scale(1.00)';
                                }
                              }}
                            >
                              {status === 'Approved' ? '✅ Approved' : 'Approve'}
                            </button>

                            {/* 2. Actions Dropdown (Secondary Action) */}
                            <div
                              ref={(el) => (dropdownRefs.current[index] = el)}
                              style={{ position: 'relative' }}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownIndex(openDropdownIndex === index ? null : index);
                                }}
                                style={{
                                  padding: '10px 18px', // Standardized padding
                                  backgroundColor: '#f97316',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '9999px',
                                  cursor: 'pointer',
                                  fontWeight: '700',
                                  fontSize: '14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  boxShadow: '0 4px 10px rgba(249, 115, 22, 0.3)',
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
                              >
                                Options
                                <span
                                  style={{
                                    marginLeft: '2px',
                                    transition: 'transform 0.3s',
                                    transform: openDropdownIndex === index ? 'rotate(180deg)' : 'rotate(0deg)',
                                    display: 'inline-block',
                                  }}
                                >
                                  &#9660;
                                </span>
                              </button>

                              {openDropdownIndex === index && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 10px)',
                                    right: 0,
                                    backgroundColor: '#fff',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                                    borderRadius: '12px',
                                    zIndex: 1000,
                                    minWidth: '230px',
                                    overflow: 'hidden',
                                    // The animation assumes CSS keyframes are defined elsewhere
                                    // For inline-only, you might consider using React state for opacity/height transition
                                  }}
                                >
                                  {/* Decline Button (Dangerous Action - Red) */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      disableModal();
                                      handleDeclineClick(entry.code);
                                      setOpenDropdownIndex(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '12px 18px',
                                      border: 'none',
                                      borderBottom: '1px solid #f3f4f6',
                                      background: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      color: '#ef4444',
                                      fontWeight: '600',
                                      fontSize: '14px',
                                      transition: 'background-color 0.15s',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px',
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                                  >
                                    ❌ **Decline**
                                  </button>

                                  {/* Send Back for Revision Button (Neutral Action) */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      disableModal();
                                      handleSendBackClick(entry.code);
                                      setOpenDropdownIndex(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '12px 18px',
                                      border: 'none',
                                      background: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      color: '#6b7280',
                                      fontWeight: '600',
                                      fontSize: '14px',
                                      transition: 'background-color 0.15s',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px',
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                                  >
                                    🔄 **Send Back for Revision**
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        ) : isOwner ? (
                          // IMPROVEMENT: Action for the owner who can only view/edit their own pending request
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(entry); // Assume this function opens the view/edit form
                            }}
                            style={{
                              padding: '10px 18px',
                              backgroundColor: '#10b981', // Emerald green for view
                              color: '#fff',
                              border: 'none',
                              borderRadius: '9999px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '700',
                              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.4)',
                              transition: 'all 0.3s',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
                          >
                            View Submission
                          </button>
                        ) : (
                          // View Only State - Styled as a badge
                          <span style={{
                            color: '#6b7280',
                            fontSize: '12px',
                            fontStyle: 'italic',
                            padding: '6px 12px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '9999px',
                            fontWeight: '500',
                          }}>
                            View Only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
            ) : (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '20px', color: '#1e40af' }}>
                  No approval requests found.
                </td>
              </tr>
            )}
          </tbody>


          {modalVisaCode && (
            <ViewDataModal visaCode={modalVisaCode} onClose={() => setModalVisaCode(null)} />
          )}
        </table>
      </div>


      {/* Pagination */}
      <div
        style={{
          padding: "0.5rem 1rem",
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: "10px",
          borderTop: "1px solid #ccc",
        }}
      >
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '5px 15px',
            backgroundColor: currentPage === 1 ? '#ccc' : '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          }}
        >
          Prev
        </button>
        <span style={{ alignSelf: 'center' }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '5px 15px',
            backgroundColor: currentPage === totalPages ? '#ccc' : '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

