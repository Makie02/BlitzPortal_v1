import React, { useEffect, useState, useRef } from 'react';
import ApprovalDropdownButtons from './ApprovalDropdownButton';
import './ApprovalsPage.css';
import { supabase } from '../supabaseClient';
import ViewData from './ViewData';
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

  function handleRowClick(entry) {
    setSelectedEntryCode(entry.code);
    setModalVisaCode(entry.code); // or just use selectedEntryCode for modalVisaCode
  }

  const disableModal = () => {
    setModalVisaCode(false);
  };

  const [approvals, setApprovals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [userPlans, setUserPlans] = useState([]);
  const [visaTypeFilter, setVisaTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [principalFilter, setPrincipalFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // useEffect(() => {
  //   if (currentUser?.id) {
  //     supabase
  //       .from('User_Brands')
  //       .select('Brand')
  //       .eq('UserID', currentUser.id)
  //       .then(({ data, error }) => {
  //         if (error) {
  //           console.error('Error fetching user brands:', error);
  //           setUserPlans([]); // or setUserBrands
  //         } else if (data && data.length > 0) {
  //           const brands = data.map(row => row.Brand);
  //           setUserPlans(brands); // or setUserBrands
  //         } else {
  //           setUserPlans([]); // no brands found
  //         }
  //       });
  //   } else {
  //     setUserPlans([]);
  //   }
  // }, [currentUser]);

  const itemsPerPage = 8;

  function getLatestResponseStatus(visaCode, approvalHistory) {
    const filtered = approvalHistory.filter(a => a.BabyVisaId === visaCode);
    if (filtered.length === 0) return 'Pending';

    filtered.sort((a, b) => new Date(b.DateResponded) - new Date(a.DateResponded));
    return filtered[0].Response || 'Pending';
  }

  function getLatestResponseDate(visaCode, approvalHistory) {
    const filtered = approvalHistory.filter(a => a.BabyVisaId === visaCode);
    if (filtered.length === 0) return '-';

    filtered.sort((a, b) => new Date(b.DateResponded) - new Date(a.DateResponded));
    const latestDate = filtered[0].DateResponded;

    // Format date/time nicely, e.g. "2025-07-02 14:30"
    const dateObj = new Date(latestDate);
    return dateObj.toLocaleString(); // You can customize locale and options here
  }




  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;

      const myName = currentUser.name?.toLowerCase().trim();
      const userId = currentUser.UserID;
      const isAdmin = currentUser.role?.toLowerCase() === 'admin';
      const visaTables = ['Cover_Visa', 'Corporate_Visa', 'Regular_Visa'];
      let combinedData = [];

      let allowedNames = [];

      if (!isAdmin) {
        // ✅ Try to fetch from User_Approvers
        const { data: approvers, error: approversError } = await supabase
          .from("User_Approvers")
          .select("UserID, Approver_Name, Type");

        let fallbackToSingleApprovals = false;

        if (approversError || !approvers || approvers.length === 0) {
          console.warn("User_Approvers not available or empty, checking singleapprovals...");
          fallbackToSingleApprovals = true;
        } else {
          const matchedApprovers = approvers.filter(row =>
            row.Approver_Name?.toLowerCase().trim() === myName
          );

          const userIds = [...new Set(matchedApprovers.map(row => row.UserID))];

          if (matchedApprovers.length === 0 || userIds.length === 0) {
            fallbackToSingleApprovals = true;
          } else {
            // ✅ Step 2: Fetch user names for those UserIDs
            const { data: accountUsers, error: usersError } = await supabase
              .from("Account_Users")
              .select("UserID, name")
              .in("UserID", userIds);

            if (usersError) {
              console.error("Error fetching Account_Users:", usersError.message);
              return;
            }

            // ✅ Map UserID to name
            const userIdToName = {};
            accountUsers.forEach(user => {
              userIdToName[user.UserID] = user.name;
            });

            // ✅ Log approval access
            const uniqueLogs = new Set();
            matchedApprovers.forEach(match => {
              const realName = userIdToName[match.UserID] || "Unknown";
              const logMessage = `The DATA form of UserID: ${match.UserID} - ${realName} is allowed to approve the Type: ${match.Type} and the Approver_Name: ${match.Approver_Name}`;
              if (!uniqueLogs.has(logMessage)) {
                console.log(logMessage);
                uniqueLogs.add(logMessage);
              }
            });

            // ✅ Prepare full list of allowed creators
            allowedNames = [
              myName,
              ...Object.values(userIdToName).map(name => name?.toLowerCase().trim()),
            ];

          }
        }

        // ✅ Fallback: Check singleapprovals table if no match in User_Approvers
        if (fallbackToSingleApprovals) {
          const { data: approvalRow, error: approvalError } = await supabase
            .from('singleapprovals')
            .select('allowed_to_approve')
            .eq('user_id', userId)
            .single();

          if (approvalError) {
            console.error("Error checking singleapprovals:", approvalError.message);
            setApprovals([]);
            return;
          }

          if (approvalRow?.allowed_to_approve === true) {
            console.log("User allowed via singleapprovals — viewing all data");
            allowedNames = []; // <- match everything below
          } else {
            console.warn("User is not allowed to approve or view data.");
            setApprovals([]);
            return;
          }
        }
      }

      // ✅ Step 4: Fetch visa data
      for (const table of visaTables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.error(`Error fetching from ${table}:`, error.message);
          continue;
        }

        const normalizedAllowedNames = allowedNames.map(name => name.toLowerCase().trim());

        const filteredData = isAdmin
          ? data
          : normalizedAllowedNames.length === 0
            ? data // full access if allowed_to_approve === true
            : data.filter(item => {
              const createdBy = item.CreatedForm?.toLowerCase().trim();
              if (createdBy === myName) return true;
              return normalizedAllowedNames.includes(createdBy);
            });


        const formatted = filteredData.map(item => ({
          code: item.visaCode || '',
          title: item.visaTitle || 'N/A',
          type: item.visaType || 'N/A',
          company: item.company || item.account || 'N/A',
          principal: item.principal || 'N/A',
          brand: item.brand || 'N/A',
          approver: item.approver || 'N/A',
          createdAt: item.created_at
            ? new Date(item.created_at)
              .toISOString()
              .replace('T', ' ')
              .replace('Z', '')
            : '—',
          status: item.approved === true ? 'Approved' : 'Pending',
          responseDate: item.responseDate || '',
          sourceTable: table,
          createdForm: item.CreatedForm || '',
        }));

        combinedData = [...combinedData, ...formatted];
      }
      setAllowedApproverNames(allowedNames); // ✅ Add this

      setApprovals(combinedData);
    };

    fetchData();
  }, [currentUser]);




  const [todayOnly, setTodayOnly] = React.useState(false);



  const [allowedApproverNames, setAllowedApproverNames] = useState([]);

  const myName = currentUser?.name?.toLowerCase().trim();
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const filteredData = approvals.filter((entry) => {
    const entryBrand = entry.principal?.toLowerCase();
    const entryType = entry.type?.toLowerCase();
    const entryStatus = entry.status?.toLowerCase();
    const createdFormName = entry.CreatedForm?.toLowerCase();
    const entryDate = entry.createdAt ? new Date(entry.createdAt) : null;

    const matchesSearch = Object.values(entry)
      .join(' ')
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesType = visaTypeFilter
      ? entryType === visaTypeFilter.toLowerCase()
      : true;

    const matchesStatus = statusFilter
      ? entryStatus === statusFilter.toLowerCase()
      : true;

    const matchesPrincipal = principalFilter
      ? entryBrand === principalFilter.toLowerCase()
      : true;

    const matchesDateRange = fromDate && toDate
      ? (() => {
        if (!entryDate) return false;
        const from = new Date(fromDate);
        const to = new Date(toDate);
        return entryDate >= from && entryDate <= to;
      })()
      : true;

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

    const isUserAllowed = createdFormName
      ? allowedApproverNames.includes(createdFormName) || createdFormName === myName
      : true;

    return (
      matchesSearch &&
      matchesType &&
      matchesStatus &&
      matchesPrincipal &&
      matchesDateRange &&
      matchesToday &&
      isUserAllowed
    );
  });







  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = filteredData.slice(indexOfFirstItem, indexOfLastItem);


  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };


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
          BabyVisaId: entry.code,
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
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!currentUser?.UserID) return;

      try {
        // Fetch name from Account_Users
        const { data: accountData, error: accountError } = await supabase
          .from('Account_Users')
          .select('name')
          .eq('UserID', currentUser.UserID)
          .limit(1)
          .single();

        if (accountError || !accountData) {
          console.error('Error fetching name from Account_Users:', accountError);
          return;
        }

        const userName = accountData.name;

        // Fetch Type from User_Approvers
        const { data: approverData, error: approverError } = await supabase
          .from('User_Approvers')
          .select('Type, UserID, Approver_Name')
          .eq('UserID', currentUser.UserID)
          .limit(1)
          .single();

        if (approverError || !approverData) {
          setUserType(null);
          return;
        }

        const { Type, UserID, Approver_Name } = approverData;

        console.log(
          `User Type: '${Type}' in UserID: ${UserID} or the name is ${userName}`
        );

        setUserType(Type);
      } catch (error) {
        console.error('Unexpected error:', error);
      }
    };

    fetchUserDetails();
  }, [currentUser]);



  const handleApproveClick = async (entryCode) => {
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
          BabyVisaId: entry.code,
          ApproverId: userId,
          DateResponded: dateTime,
          Response: "Approved",
          Type: userType || 'admin',
          Notication: false,
          CreatedForm: entry.createdForm,  // <-- existing
        });

      if (supabaseError) {
        console.error("Supabase insert error:", supabaseError.message);
        return; // exit if history insert fails
      }

      // 2. Update Approved column to true in amount_badget for matching visacode
      const { error: updateError } = await supabase
        .from('amount_badget')
        .update({ Approved: true })
        .eq('visacode', entry.code);

      if (updateError) {
        console.error("Failed to update amount_badget Approved:", updateError.message);
        // You can decide if you want to continue or return here
      }

      // 3. Log to RecentActivity
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
          action: `Approved the ${entry.code}`,
        };

        const { error: activityError } = await supabase
          .from("RecentActivity")
          .insert(activity);

        if (activityError) {
          console.error("Failed to log activity:", activityError.message);
        }
      } catch (logErr) {
        console.warn("Activity logging failed:", logErr.message);
      }

      // 4. Update local state
      setApprovals((prevApprovals) =>
        prevApprovals.map((item) =>
          item.code === entryCode
            ? { ...item, status: "Approved", responseDate: dateTime }
            : item
        )
      );

      window.location.reload();

    } catch (error) {
      console.error(`Failed to approve ${entry.code}:`, error.message || error);
    }
  };
  const [selectedEntryCode, setSelectedEntryCode] = useState(null);

useEffect(() => {
  if (modalVisaCode && selectedEntryCode) {
    async function fetchAndSaveData() {
      try {
        // Fetch totalCostSum from Regular_Visa_CostDetails
        const { data: costData, error: costError } = await supabase
          .from("Regular_Visa_CostDetails")
          .select("totalCostSum")
          .eq("visaCode", selectedEntryCode)
          .single();

        if (costError) {
          console.error("Error fetching totalCostSum:", costError);
        } else if (costData?.totalCostSum !== undefined) {
          localStorage.setItem(`totalCostSum_${selectedEntryCode}`, costData.totalCostSum);
          console.log(`Saved totalCostSum for ${selectedEntryCode}:`, costData.totalCostSum);
        }

        // Fetch coverVisaCode from Regular_Visa
        const { data: visaData, error: visaError } = await supabase
          .from("Regular_Visa")
          .select("coverVisaCode")
          .eq("visaCode", selectedEntryCode)
          .single();

        if (visaError) {
          console.error("Error fetching coverVisaCode:", visaError);
        } else if (visaData?.coverVisaCode) {
          const coverVisaCode = visaData.coverVisaCode;
          localStorage.setItem(`coverVisaCode_${selectedEntryCode}`, coverVisaCode);
          console.log(`Saved coverVisaCode for ${selectedEntryCode}:`, coverVisaCode);

          // Fetch remainingbalance from amount_badget based on coverVisaCode
          const { data: balanceData, error: balanceError } = await supabase
            .from("amount_badget")
            .select("remainingbalance")
            .eq("visacode", coverVisaCode)
            .order("createdate", { ascending: false })
            .limit(1);

          if (balanceError) {
            console.error("Error fetching remainingbalance:", balanceError);
          } else if (balanceData && balanceData.length > 0) {
            const remainingBalance = balanceData[0].remainingbalance;
            localStorage.setItem(`remainingbalance_${coverVisaCode}`, remainingBalance);
            console.log(`Saved remainingbalance for ${coverVisaCode}:`, remainingBalance);
          } else {
            console.warn(`No remainingbalance data found for coverVisaCode ${coverVisaCode}`);
            localStorage.removeItem(`remainingbalance_${coverVisaCode}`);
          }
        } else {
          localStorage.removeItem(`coverVisaCode_${selectedEntryCode}`);
          console.warn(`No coverVisaCode found for visaCode ${selectedEntryCode}`);
        }
      } catch (err) {
        console.error("Unexpected error fetching visa data:", err);
      }
    }

    fetchAndSaveData();
  }
}, [modalVisaCode, selectedEntryCode]);



const handleDeclineClick = async (entryCode) => {
  // Confirm decline action
  const confirmed = window.confirm("Are you sure you want to decline this visa?");
  if (!confirmed) return;

  // Find the entry
  const entry = approvals.find((item) => item.code === entryCode);
  if (!entry) {
    console.error("Entry not found for code:", entryCode);
    alert("Visa entry not found.");
    return;
  }

  const dateTime = new Date().toISOString();
  const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
  const userId = currentUser?.UserID || "unknown";

  try {
    // 1. Insert into Approval_History
    const { error: approvalError } = await supabase
      .from("Approval_History")
      .insert({
        BabyVisaId: entry.code,
        ApproverId: userId,
        DateResponded: dateTime,
        Response: "Declined",
        Type: userType || null,
        Notication: false,
      });

    if (approvalError) {
      console.error("Approval_History insert error:", approvalError);
      alert("Failed to record decline action. Please try again.");
      return;
    }

    // 2. Log Recent Activity (optional, but good for audit)
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
        action: `Declined the visa ${entry.code}`,
      };

      const { error: activityError } = await supabase.from("RecentActivity").insert(activity);
      if (activityError) console.error("RecentActivity log error:", activityError);
    } catch (logErr) {
      console.warn("Activity logging failed:", logErr.message);
    }

    // 3. Update parent's remaining balance if conditions met
    const visaCode = entryCode;
    const coverVisaCode = localStorage.getItem(`coverVisaCode_${visaCode}`);
    const totalCostSumStr = localStorage.getItem(`totalCostSum_${visaCode}`);
    const totalCostSum = totalCostSumStr ? parseFloat(totalCostSumStr) : null;

    if (coverVisaCode && totalCostSum !== null && totalCostSum > 0) {
      // Fetch the latest parent balance entry
      const { data: parentData, error: parentError } = await supabase
        .from("amount_badget")
        .select("id, remainingbalance")
        .eq("visacode", coverVisaCode)
        .order("createdate", { ascending: false })
        .limit(1);

      if (parentError) {
        console.error("Failed to fetch parent cover visa balance:", parentError);
        alert("Failed to update parent's balance due to fetch error.");
      } else if (parentData && parentData.length > 0) {
        const parentEntry = parentData[0];
        const oldBalance = parseFloat(parentEntry.remainingbalance) || 0;
        const newBalance = oldBalance + totalCostSum;

        // Update the remainingbalance
        const { error: updateError } = await supabase
          .from("amount_badget")
          .update({ remainingbalance: newBalance })
          .eq("id", parentEntry.id);

        if (updateError) {
          console.error("Failed to update remaining balance:", updateError);
          alert("Failed to update parent's remaining balance.");
        } else {
          console.log(`Parent balance updated successfully. New balance: ${newBalance}`);
        }
      } else {
        console.warn("No parent entry found to update remaining balance.");
      }
    } else {
      console.log("Skipping parent's balance update: missing coverVisaCode or totalCostSum");
    }

    // 4. Update UI state
    setApprovals((prev) =>
      prev.map((item) =>
        item.code === entryCode
          ? { ...item, status: "Declined", responseDate: dateTime }
          : item
      )
    );

    alert("Visa declined successfully.");
  } catch (err) {
    console.error(`Failed to decline visa ${entry.code}:`, err);
    alert(`Failed to decline visa: ${err.message || err}`);
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
      <div className="filters-container">
        <select
          value={visaTypeFilter}
          onChange={(e) => setVisaTypeFilter(e.target.value)}
          className="filters-select"
        >
          <option value="">All Marketing Types</option>
          <option value="REGULAR">REGULAR</option>
          <option value="COVER">COVER</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filters-select"
        >
          <option value="">All Status</option>
          <option value="Approved">Approved</option>
          <option value="Declined">Declined</option>
          <option value="Sent back for revision">Sent back for revision</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <select
          value={principalFilter}
          onChange={(e) => setPrincipalFilter(e.target.value)}
          className="filters-select"
        >
          <option value="">All Distributor</option>
          {[...new Set(approvals.map((entry) => entry.principal))]
            .filter(Boolean)
            .sort()
            .map((p, i) => (
              <option key={i} value={p}>{p}</option>
            ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="filters-select"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="filters-select"
        />

        <input
          type="text"
          placeholder="Search Approvals..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="filters-input"
        />

        <label className="filters-checkbox">
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => setTodayOnly(e.target.checked)}
          />
          TODAY
        </label>
      </div>



      {selectedRows.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '10px',
        }}>
          <button
            onClick={handleDeleteSelected}
            style={{
              padding: '6px 20px',
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Delete Selected
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
          }}
        >
          <thead
            style={{
              backgroundColor: '#f4f4f4',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              fontSize: '14px',
            }}
          >
            <tr>
              <th></th>
              <th> Code</th>
              <th>Type</th>
              <th>Company</th>
              <th>Distributor</th>
              <th>Brand</th>

              <th>Created At</th>
              <th>Created</th>

              <th>Status</th>
              <th>Response Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '12px' }}>
            {currentData.length > 0 ? (
              currentData.map((entry, index) => {
                const status = getLatestResponseStatus(entry.code, approvalHistory);
                const isDisabled = ["Approved", "Declined", "Cancelled"].includes(status);
                const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
                const currentUserId = currentUser?.name?.toLowerCase().trim();
                const isOwner = entry.createdForm?.toLowerCase().trim() === currentUserId;
                return (
                  <tr
                    key={index}
                    style={{ borderBottom: "1px solid #ddd", cursor: "pointer" }}
                    onClick={() => handleRowClick(entry)} // This triggers modal opening
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(entry.code)}
                        onChange={(e) => {
                          e.stopPropagation(); // prevent row click when clicking checkbox
                          handleCheckboxChange(entry.code);
                        }}
                        onClick={(e) => e.stopPropagation()} // also stop on click to be safe
                      />
                    </td>
                    <td>{entry.code}</td>
                    <td>{entry.type}</td>
                    <td>{entry.company}</td>
                    <td>{entry.principal}</td>
                    <td>{entry.brand}</td>
                    <td>{entry.createdAt}</td>
                    <td>{entry.createdForm}</td>

                    <td
                      style={{
                        color:
                          status === "Approved"
                            ? "green"
                            : status === "Sent back for revision"
                              ? "orange"
                              : status === "Declined"
                                ? "red"
                                : status === "Cancelled"
                                  ? "black"
                                  : "blue",
                        fontWeight: "bold",
                      }}
                    >
                      {status}
                    </td>

                    <td>{getLatestResponseDate(entry.code, approvalHistory)}</td>

                    <td style={{ display: "flex", gap: "6px", position: "relative" }}>
                      {!isOwner ? (
                        <>
                          {/* Approve Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveClick(entry.code);
                            }}
                            disabled={isDisabled}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: status === "Approved" || isDisabled ? "#888" : "#28a745",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              cursor: isDisabled ? "not-allowed" : "pointer",
                            }}
                          >
                            {status === "Approved" ? "Approved" : "Approve"}
                          </button>

                          {/* Actions Dropdown */}
                          <div
                            ref={(el) => (dropdownRefs.current[index] = el)}
                            style={{ position: "relative" }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isDisabled) {
                                  setOpenDropdownIndex(openDropdownIndex === index ? null : index);
                                }
                              }}
                              disabled={isDisabled}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#dc3545",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                cursor: isDisabled ? "not-allowed" : "pointer",
                                fontWeight: "600",
                              }}
                              onMouseEnter={(e) => {
                                if (!isDisabled) e.currentTarget.style.backgroundColor = "#b02a37";
                              }}
                              onMouseLeave={(e) => {
                                if (!isDisabled) e.currentTarget.style.backgroundColor = "#dc3545";
                              }}
                            >
                              {status === "Declined" ? "Declined" : "Actions"}
                            </button>

                            {openDropdownIndex === index && !isDisabled && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "calc(100% + 6px)",
                                  right: 0,
                                  backgroundColor: "#fff",
                                  border: "1px solid #ddd",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                  borderRadius: "6px",
                                  zIndex: 1000,
                                  minWidth: "180px",
                                  overflow: "hidden",
                                }}
                              >
                                {/* Decline */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    disableModal();
                                    handleDeclineClick(entry.code);
                                    setOpenDropdownIndex(null);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "10px 16px",
                                    border: "none",
                                    background: "none",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    color: "#dc3545",
                                    fontWeight: "600",
                                    transition: "background-color 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fdecea")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  Decline
                                </button>

                                {/* Send Back for Revision */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    disableModal();
                                    handleSendBackClick(entry.code);
                                    setOpenDropdownIndex(null);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "10px 16px",
                                    border: "none",
                                    background: "none",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    color: "#007bff",
                                    fontWeight: "600",
                                    transition: "background-color 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e7f1ff")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  Send Back for Revision
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "#888" }}>View Only</span>
                      )}
                    </td>


                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="11" style={{ textAlign: "center", padding: "20px" }}>
                  No approval requests found.
                </td>
              </tr>
            )}
          </tbody>


          {modalVisaCode && (
            <ViewData visaCode={modalVisaCode} onClose={() => setModalVisaCode(false)} />
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

