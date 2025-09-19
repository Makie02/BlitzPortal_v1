import React, { useEffect, useState, useRef } from 'react';
import ApprovalDropdownButtons from './ApprovalDropdownButton';
import './ApprovalsPage.css';
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

    // Only fetch if user is logged in and we haven't fetched yet
    if (!currentUser?.UserID || hasFetched) return;

    const fetchData = async () => {
      try {
        const myName = currentUser.name?.toLowerCase().trim();
        const userId = currentUser.UserID;
        const isAdmin = currentUser.role?.toLowerCase() === 'admin';

        // Tables to fetch from
        const visaTables = ['cover_pwp', 'regular_pwp'];
        let combinedData = [];
        let allowedNames = [];

        // TODO: Fetch allowed approvers here, example:
        // const { data: approverData, error: approverError } = await supabase.from('User_Approvers').select('*');
        // if (!approverError && approverData) allowedNames = approverData.map(a => a.name);

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
                company: item.distributor_code || 'N/A',
                principal: item.objective || 'N/A',
                brand: item.promo_scheme || 'N/A',
                approver: item.approver || 'N/A',
                createForm: item.CreatedForm || item.createForm || 'N/A',
                status: item.notification === true ? 'Approved' : 'Pending',
                responseDate: '', // add if you have date field
                sourceTable: table,
                created_at: item.created_at || 'N/A',
              };
            } else if (table === 'regular_pwp') {
              return {
                code: item.regularpwpcode || '',
                title: item.pwptype || 'N/A',
                type: item.accountType ? item.accountType.join(', ') : 'N/A',
                company: item.distributor || 'N/A',
                principal: item.objective || 'N/A',
                brand: item.promoScheme || 'N/A',
                approver: item.approver || 'N/A',
                createForm: item.CreatedForm || item.createForm || 'N/A',
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
        if (isMounted) setHasFetched(true); // prevent infinite retry on error
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
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

      // User permission
      const isUserAllowed = createdFormName
        ? allowedApproverNames.includes(createdFormName) || createdFormName === myName.toLowerCase()
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



  const handleSendBackClick = async (entryCode) => {
    const entry = approvals.find(item => item.code === entryCode);
    if (!entry?.code) return;

    const dateTime = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const userId = currentUser?.UserID || "unknown";

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
        });

      if (supError) {
        console.error("Supabase insert error:", supError.message);
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
        };

        const { error: activityError } = await supabase
          .from("RecentActivity")
          .insert(activityEntry);

        if (activityError) {
          console.error("RecentActivity log error:", activityError.message);
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

      window.location.reload();

    } catch (error) {
      console.error(`Failed to send back ${entry.code}:`, error.message);
    }
  };



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


  const handleApproveClick = async (entryCode) => {
    const entry = approvals.find((item) => item.code === entryCode);
    if (!entry || !entry.code) return;

    console.log("Approving entry code:", entry.code);  // <-- Added console.log here

    const dateTime = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const userId = currentUser?.UserID || "unknown";

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
          CreatedForm: entry.createdForm,
        });

      if (historyError) {
        console.error("Supabase insert error:", historyError.message);
        return;
      }

      // 2. Fetch credit_budget AND coverPwpCode from regular_pwp
      const { data: pwpData, error: pwpError } = await supabase
        .from("regular_pwp")
        .select("credit_budget, coverPwpCode")
        .eq("regularpwpcode", entry.code)
        .single();

      if (pwpError || !pwpData) {
        console.error("Failed to fetch data from regular_pwp:", pwpError?.message || "No data found");
        return;
      }

      const creditBudget = parseFloat(pwpData.credit_budget);
      const coverPwpCode = pwpData.coverPwpCode;

      if (isNaN(creditBudget) || !coverPwpCode) {
        console.error("Invalid credit_budget or missing coverPwpCode");
        return;
      }

      // 3. Update amount_badget where pwp_code === entry.code
      const { data: updatedRows, error: updateError } = await supabase
        .from("amount_badget")
        .update({
          Approved: true,
          createdate: dateTime,
        })
        .eq("pwp_code", entry.code)
        .select();

      if (updateError) {
        console.error("Failed to update amount_badget:", updateError.message);
      } else {
        console.log("Updated amount_badget rows:", updatedRows);
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
          console.error("Activity logging failed:", activityError.message);
        }
      } catch (logErr) {
        console.warn("Activity logging failed:", logErr.message);
      }

      // 5. Update local state only (no page reload)
      setApprovals((prev) =>
        prev.map((item) =>
          item.code === entryCode
            ? { ...item, status: "Approved", responseDate: dateTime }
            : item
        )
      );

      // Removed window.location.reload();
    } catch (error) {
      console.error(`Failed to approve ${entry.code}:`, error.message || error);
    }
  };









  const handleDeclineClick = async (entryCode) => {
    const entry = approvals.find((item) => item.code === entryCode);
    if (!entry || !entry.code) return;

    const dateTime = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const userId = currentUser?.UserID || "unknown";

    try {
      // 1. Insert into Supabase Approval History
      const { error: supabaseError } = await supabase
        .from("Approval_History")
        .insert({
          PwpCode: entry.code,
          ApproverId: userId,
          DateResponded: dateTime,
          Response: "Declined",
          Type: userType || null,
          Notication: false,
        });

      if (supabaseError) {
        console.error("Supabase insert error:", supabaseError.message);
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
          ip: ip,
          time: dateTime,
          action: `Declined the ${entry.code}`,
        };

        const { error: activityError } = await supabase
          .from("RecentActivity")
          .insert(activity);

        if (activityError) {
          console.error("RecentActivity log error:", activityError.message);
        }
      } catch (logErr) {
        console.warn("Activity logging failed:", logErr.message);
      }

      // 3. Update UI state and reload
      setApprovals((prevApprovals) =>
        prevApprovals.map((item) =>
          item.code === entryCode
            ? { ...item, status: "Declined", responseDate: dateTime }
            : item
        )
      );

      window.location.reload();

    } catch (error) {
      console.error(`Failed to decline ${entry.code}:`, error.message);
    }
  };



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



  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '90vh',
        padding: '15px',
        boxSizing: 'border-box',
      }}
    >
      <h2 style={{
        color: "#2c3e50",
        backgroundColor: "#e3f2fd",
        padding: "10px 20px",
        borderLeft: "5px solid #2196f3",
        borderRadius: "5px",

      }}>
        Approvals
      </h2>

      {/* Filters */}
      {/* Filters Section */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
            <div className="filter-item" style={{ flexGrow: 1, minWidth: '200px' }}>
          <input
            type="text"
            placeholder="🔍 Search Approvals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #e1e8ed',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.3s ease',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#2575fc')}
            onBlur={(e) => (e.target.style.borderColor = '#e1e8ed')}
          />
        </div>

        {/* Marketing Type Filter */}
        <div className="filter-item">
          
          <select
            value={visaTypeFilter}
            onChange={(e) => setVisaTypeFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              width: '100%',
              cursor: 'pointer',
              border: '2px solid #e1e8ed',
            }}
          >
            <option value="">All Marketing Types</option>
            <option value="REGULAR">REGULAR</option>
            <option value="COVER">COVER</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-item">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              width: '100%',
              cursor: 'pointer',
              border: '2px solid #e1e8ed',
            }}
          >
            <option value="">All Status</option>
            <option value="Approved">Approved</option>
            <option value="Declined">Declined</option>
            <option value="Sent back for revision">Sent back for revision</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Date Range */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'white',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #e1e8ed',
          }}
        >
          <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>📅 Date:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
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
            }}
          />
        </div>

        {/* Search */}
    
        {/* Today Filter (Checkbox) */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            color: '#444',
            gap: '6px',
            padding: '8px 12px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e1e8ed',
            borderRadius: '8px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => setTodayOnly(e.target.checked)}
          />
          TODAY
        </label>
      </div>

      {/* Delete Selected Button */}
      {selectedRows.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '10px',
          }}
        >
          <button
            onClick={handleDeleteSelected}
            style={{
              padding: '8px 20px',
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background 0.3s ease',
            }}
          >
            🗑️ Delete Selected
          </button>
        </div>
      )}

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
            color: '#1E40AF', // Blue text color (Tailwind blue-800)
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          }}
        >
          <thead
            style={{
              backgroundColor: '#2575fc', // Light blue background (Tailwind blue-100)
              position: 'sticky',
              top: 0,
              zIndex: 1,
              fontSize: '14px',
              color: '#ffffffff', // Dark blue text
            }}
          >
            <tr>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}></th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Code</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Created At</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Created</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Response Date</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>Action</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '12px', color: '#000000ff' }}>
            {paginatedData.length > 0 ? (
              [...paginatedData]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // sort latest first
                .map((entry, index) => {
                  const status = getLatestResponseStatus(entry.code, approvalHistory);
                  const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
                  const currentUserId = currentUser?.name?.toLowerCase().trim();
                  const isOwner = entry.createdForm?.toLowerCase().trim() === currentUserId;

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
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>{entry.code}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {new Date(entry.created_at)
                          .toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: undefined,
                            hour12: true,
                          })
                          .replace(',', '')}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{entry.createForm}</td>
                      <td
                        style={{
                          padding: '8px 12px',
                          color:
                            status === 'Approved'
                              ? 'green'
                              : status === 'Sent back for revision'
                                ? 'orange'
                                : status === 'Declined'
                                  ? 'red'
                                  : status === 'Cancelled'
                                    ? 'black'
                                    : '#2563eb',
                          fontWeight: 'bold',
                        }}
                      >
                        {status}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {getLatestResponseDate(entry.code, approvalHistory)}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          gap: '6px',
                          position: 'relative',
                          justifyContent: 'flex-start',
                        }}
                      >
                        {userType === 'Allowed' ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveClick(entry.code);
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: status === 'Approved' ? '#888' : '#2563eb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: status === 'Approved' ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {status === 'Approved' ? 'Approved' : 'Approve'}
                            </button>
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
                                  padding: '6px 12px',
                                  backgroundColor: '#dc2626',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                }}
                              >
                                {status === 'Declined' ? 'Declined' : 'Actions'}
                              </button>

                              {openDropdownIndex === index && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    right: 0,
                                    backgroundColor: '#fff',
                                    border: '1px solid #ddd',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    borderRadius: '6px',
                                    zIndex: 1000,
                                    minWidth: '180px',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      disableModal();
                                      handleDeclineClick(entry.code);
                                      setOpenDropdownIndex(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '10px 16px',
                                      border: 'none',
                                      background: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      color: '#dc2626',
                                      fontWeight: '600',
                                    }}
                                  >
                                    Decline
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      disableModal();
                                      handleSendBackClick(entry.code);
                                      setOpenDropdownIndex(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '10px 16px',
                                      border: 'none',
                                      background: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      color: '#2563eb',
                                      fontWeight: '600',
                                    }}
                                  >
                                    Send Back for Revision
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#6b7280' }}>View Only</span>
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

