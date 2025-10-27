import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from "sweetalert2";
import { supabase } from "../supabaseClient";

const CoverVisa = () => {
  const [formData, setFormData] = useState({
    visaCode: "",
    coverCode: "",
    distributor: "",
    principal: "",
    accountType: "",
    amountbadget: "",
    PWPType: "COVER",
    createForm: "",
    Notification: false,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAgentName, setSelectedAgentName] = useState("");
  const [selectedUsername, setSelectedUsername] = useState('');
  const [usernames, setUsernames] = useState([]);
  const [userDistributorsForSelected, setUserDistributorsForSelected] = useState([]);
  const [submittedBudgets, setSubmittedBudgets] = useState([]);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selectedDistributorUsername, setSelectedDistributorUsername] = useState("");

  
const handleFormChange = async (e) => {
  const { name, value } = e.target;

  setFormData((prev) => ({ ...prev, [name]: value }));

  // 🧩 Handle when selecting username (createForm)
  if (name === "createForm") {
    setSelectedUsername(value);

    if (value) {
      console.log(`🧠 Selected username: ${value}`);

      // 🔍 Fetch UserID from Account_Users
      const { data: userData, error: userError } = await supabase
        .from("Account_Users")
        .select("UserID")
        .eq("name", value)
        .single();

      if (userError) {
        console.error("❌ Error fetching UserID:", userError);
        setUserDistributorsForSelected([]);
        setFilteredDistributors([]);
      } else if (userData) {
        const userId = userData.UserID;
        console.log(`✅ Found UserID for "${value}":`, userId);

        // 📦 Fetch distributors linked to this UserID
        const { data: distData, error: distError } = await supabase
          .from("distributors")
          .select("id, name, code, agent_code")
          .eq("agent_code", userId);

        if (distError) {
          console.error("❌ Error fetching distributors:", distError);
          setUserDistributorsForSelected([]);
          setFilteredDistributors([]);
        } else {
          console.log(`📋 Distributors fetched for UserID ${userId}:`, distData.length);
          const distributorNames = distData.map((item) => item.name);
          setUserDistributorsForSelected(distributorNames);
          setFilteredDistributors(distData);
        }
      }
    } else {
      console.warn("⚠️ No username selected — clearing distributor data");
      setUserDistributorsForSelected([]);
      setFilteredDistributors([]);
    }

    setFormData((prev) => ({ ...prev, distributor: "" }));
    setSelectedAgentName("");
    return;
  }

  // 🏢 Handle when selecting distributor
  if (name === "distributor") {
    try {
      const selectedDistributor = distributors.find((d) => d.code === Number(value));

      if (!selectedDistributor) {
        console.warn("⚠️ Distributor not found for code:", value);
        setAccountTypes([]);
        setSelectedAgentName("");
        return;
      }

      console.log("🏢 Selected distributor:", selectedDistributor);

      // 👤 Fetch agent name using agent_code
      if (selectedDistributor.agent_code) {
        console.log("🔗 Fetching agent name for agent_code:", selectedDistributor.agent_code);

        const { data: agentData, error: agentError } = await supabase
          .from("Account_Users")
          .select("name")
          .eq("UserID", selectedDistributor.agent_code)
          .single();

        if (agentError) {
          console.warn("⚠️ Agent not found:", selectedDistributor.agent_code);
          setSelectedAgentName("No agent assigned");
        } else {
          console.log(`👤 Found agent name: ${agentData.name}`);
          setSelectedAgentName(agentData.name);
        }
      } else {
        setSelectedAgentName("No agent assigned");
      }

      const isBadOrder = selectedDistributor.name === "BAD ORDER";

      setFormData((prev) => ({
        ...prev,
        distributor: value,
        distributorName: selectedDistributor.name || "",
        categoryName: isBadOrder ? [] : prev.categoryName,
        accountType: isBadOrder ? [] : prev.accountType,
      }));

      if (isBadOrder) {
        console.log("⛔ BAD ORDER selected — skipping categories");
        setAccountTypes([]);
        return;
      }

      // 🧾 Fetch categorydetails in batches
      const batchSize = 1000;
      let allData = [];
      let hasMore = true;
      let offset = 0;

      console.log(`📥 Fetching categories for distributor ID: ${selectedDistributor.id}`);

      while (hasMore) {
        const { data, error } = await supabase
          .from("categorydetails")
          .select("code, name, description")
          .eq("principal_id", selectedDistributor.id)
          .order("name", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data?.length) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      if (!allData.length) {
        console.log("⚠️ No categories found for this distributor");
        setAccountTypes([]);
        return;
      }

      const formatted = allData.map((item) => ({
        code: item.code,
        name: item.name,
        description: item.description,
      }));

      setAccountTypes(formatted);
      setAccountSearchTerm("");
      setFormData((prev) => ({ ...prev, accountType: [] }));

      console.log(`✅ Loaded ${formatted.length} category records`);
    } catch (error) {
      console.error("❌ Failed to fetch category details:", error.message);
      setAccountTypes([]);
    }
  }
};

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const [files, setFiles] = useState([]);




  const [accountTypes, setAccountTypes] = useState([]);
  const [approvedExpenses, setApprovedExpenses] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);

  useEffect(() => {
    const amountBudget = parseFloat(formData.amountbadget) || 0;
    const remaining = amountBudget - approvedExpenses;
    setRemainingBudget(remaining);
  }, [formData.amountbadget, approvedExpenses]);

  const formatCurrency = (value) => {
    if (value === "") return "";
    const number = parseFloat(value);
    if (isNaN(number)) return value;
    return number.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  };

  useEffect(() => {
    const fetchApprovedExpenses = async () => {
      if (!formData.visaCode) return;

      try {
        const { data, error } = await supabase
          .from("approved_pwp_expenses")
          .select("amount")
          .eq("visa_code", formData.visaCode)
          .eq("status", "approved");

        if (error) {
          console.error("Error fetching approved expenses:", error);
          return;
        }

        const totalExpenses = data.reduce(
          (sum, expense) => sum + (parseFloat(expense.amount) || 0),
          0
        );
        setApprovedExpenses(totalExpenses);
      } catch (err) {
        console.error("Error calculating approved expenses:", err);
      }
    };

    fetchApprovedExpenses();
  }, [formData.visaCode]);

  const [singleApprovals, setSingleApprovals] = useState([]);
  const [userApprovers, setUserApprovers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: approvalsData, error: approvalsError } = await supabase
        .from("singleapprovals")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: userApproversData, error: userApproversError } =
        await supabase
          .from("User_Approvers")
          .select("*")
          .order("created_at", { ascending: false });

      const { data: usersData, error: usersError } = await supabase
        .from("Account_Users")
        .select("name");

      if (approvalsError)
        console.error("Error fetching approvals:", approvalsError);
      if (userApproversError)
        console.error("Error fetching user approvers:", userApproversError);
      if (usersError) console.error("Error fetching users:", usersError);

      setSingleApprovals(approvalsData || []);
      setUserApprovers(userApproversData || []);
      setUsers(usersData || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const [totalRemaining, setTotalRemaining] = React.useState(null);

  const fetchRemainingBalance = React.useCallback(async () => {
    const storedUser = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!storedUser || !storedUser.id) return;

    const { data, error } = await supabase
      .from("amount_badget")
      .select("remainingbalance")
      .eq("createduser", storedUser.id)
      .or("Approved.is.null,Approved.eq.true");

    if (error) {
      console.error("Error fetching remaining balance:", error);
      return;
    }

    const total = data.reduce(
      (acc, item) => acc + parseFloat(item.remainingbalance),
      0
    );
    setTotalRemaining(total);
  }, []);

  React.useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!storedUser || !storedUser.id) return;

    fetchRemainingBalance();

    const subscription = supabase
      .channel("public:amount_badget")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "amount_badget",
          filter: `createduser=eq.${storedUser.id}`,
        },
        (payload) => {
          fetchRemainingBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchRemainingBalance]);

  const [accountSearchTerm, setAccountSearchTerm] = useState("");

  useEffect(() => {
    const fetchAccounts = async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("code", { ascending: true });
      if (error) {
        console.error("Error fetching account types:", error.message);
      } else {
        setAccountTypes(data);
      }
    };
    fetchAccounts();
  }, []);

  const [allCoverCodes, setAllCoverCodes] = useState([]);
  const [loadingCoverCode, setLoadingCoverCode] = useState(true);

  const generateCoverCode = (existingCodes = []) => {
    const year = new Date().getFullYear();
    const prefix = `C${year}-`;

    const codesForYear = existingCodes
      .filter((code) => code?.startsWith(prefix))
      .map((code) => parseInt(code.replace(prefix, ""), 10))
      .filter((num) => !isNaN(num));

    const newNumber = (codesForYear.length ? Math.max(...codesForYear) : 0) + 1;
    const newCode = `${prefix}${newNumber}`;

    console.log("🔹 Existing cover codes:", existingCodes);
    console.log("🔹 Cover codes for this year:", codesForYear);
    console.log("🔹 Generated new cover code:", newCode);

    return newCode;
  };

const fetchCoverCodes = async () => {
    try {
      console.log("⏳ Fetching cover codes...");
      const { data, error } = await supabase
        .from("cover_pwp")
        .select("cover_code");

      if (error) throw error;

      const codes = data.map((row) => row.cover_code).filter(Boolean);
      console.log("✅ Fetched cover codes:", codes);

      setAllCoverCodes(codes);

      // Only generate new code if we're NOT editing
      if (!editingBudget && (!formData.coverCode || codes.includes(formData.coverCode))) {
        const newCode = generateCoverCode(codes);
        console.log("✏️ Updating formData with new cover code:", newCode);
        setFormData((prev) => ({ ...prev, coverCode: newCode }));
      }

      setLoadingCoverCode(false);
    } catch (err) {
      console.error("❌ Error fetching cover codes:", err);
      setLoadingCoverCode(false);
    }
  };

  useEffect(() => {
    fetchCoverCodes();

    const intervalId = setInterval(() => {
      fetchCoverCodes();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [formData.coverCode]);

  useEffect(() => {
    if (!formData.coverCode && allCoverCodes.length > 0) {
      const newCode = generateCoverCode(allCoverCodes);
      setFormData((prev) => ({ ...prev, coverCode: newCode }));
    }
  }, [allCoverCodes]);

  const [distributors, setDistributors] = useState([]);

  useEffect(() => {
    async function fetchDistributors() {
      const { data, error } = await supabase
        .from("distributors")
        .select("id, name, code, agent_code");
      if (error) {
        console.error("Error fetching distributors:", error);
      } else {
        setDistributors(data);
      }
    }

    fetchDistributors();
  }, []);

  const selectedDistributor = distributors.find(
    (d) => d.code === formData.distributor
  );
  const selectedName = selectedDistributor ? selectedDistributor.name : "";

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

const handleSubmits = async (e) => {
  e.preventDefault();

  if (
    !formData.coverCode ||
    !formData.distributor ||
    !formData.amountbadget ||
    !formData.createForm
  ) {
    await Swal.fire({
      icon: "warning",
      title: "Missing fields",
      text: "Please fill in all required fields including Assign Name.",
      confirmButtonText: "OK",
    });
    return;
  }

  try {
    const storedUser = localStorage.getItem("loggedInUser");
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;

    if (!parsedUser) {
      await Swal.fire({
        icon: "error",
        title: "Login Required",
        text: "You must be logged in to submit.",
        confirmButtonText: "OK",
      });
      return;
    }

    // ✅ Get UserID of the selected creator
    const { data: selectedUserData, error: userError } = await supabase
      .from("Account_Users")
      .select("UserID")
      .eq("name", formData.createForm)
      .single();

    if (userError || !selectedUserData) {
      await Swal.fire({
        icon: "error",
        title: "User Not Found",
        text: "Could not find user ID for the selected name.",
        confirmButtonText: "OK",
      });
      return;
    }

    const selectedUserId = selectedUserData.UserID;

    // ---------------------------
    // ✳️ UPDATE EXISTING BUDGET
    // ---------------------------
if (editingBudget) {
  const { error: mainError } = await supabase
    .from("cover_pwp")
    .update({
      distributor_code: formData.distributor,
      amount_badget: parseFloat(formData.amountbadget),
      remarks: formData.remarks,
      createForm: selectedUserId,
      updatedCreated: new Date().toISOString(),
    })
    .eq("cover_code", editingBudget.cover_code);

  if (mainError) throw mainError;

  const { error: budgetError } = await supabase
    .from("amount_badget")
    .update({
      amountbadget: parseFloat(formData.amountbadget),
      distributor: formData.distributor,
      remainingbalance: parseFloat(formData.amountbadget),
      createduser: selectedUserId,
      Approved: true,
      updatedCreated: new Date().toISOString(),
    })
    .eq("pwp_code", editingBudget.cover_code);

  if (budgetError) throw budgetError;

  // ✅ UPDATE existing Approval_History instead of inserting new
  const { error: approvalError } = await supabase
    .from("Approval_History")
    .update({
      ApproverId: selectedUserId.toString(),
      DateResponded: new Date().toISOString(),
      Response: "Approved",
      Type: "COVER_PWP",
      Notication: true,
      CreatedForm: parsedUser.name,
    })
    .eq("PwpCode", editingBudget.cover_code);

  if (approvalError) throw approvalError;

      // ✅ Handle file attachments
      if (files.length > 0) {
        const attachmentInserts = [];
        for (const file of files) {
          const base64Data = await toBase64(file);
          attachmentInserts.push({
            cover_code: editingBudget.cover_code,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size || null,
            file_data: base64Data,
          });
        }

        const { error: attachmentError } = await supabase
          .from("cover_attachments")
          .insert(attachmentInserts);

        if (attachmentError) throw attachmentError;
      }

      await Swal.fire({
        icon: "success",
        title: "Updated!",
        text: "Budget updated successfully and automatically approved!",
        confirmButtonText: "Great",
      });
    }

    // ---------------------------
    // ✳️ CREATE NEW BUDGET
    // ---------------------------
    else {
      const dataToInsert = {
        cover_code: formData.coverCode,
        distributor_code: formData.distributor,
        amount_badget: parseFloat(formData.amountbadget),
        pwp_type: formData.coverType || "COVER_PWP",
        remarks: formData.remarks,
        notification: false,
        createForm: selectedUserId,
      };

      const { error: mainError } = await supabase
        .from("cover_pwp")
        .insert([dataToInsert]);
      if (mainError) throw mainError;

      const { error: budgetError } = await supabase.from("amount_badget").insert([
        {
          pwp_code: formData.coverCode,
          amountbadget: parseFloat(formData.amountbadget),
          createduser: selectedUserId,
          distributor: formData.distributor,
          remainingbalance: parseFloat(formData.amountbadget),
          Approved: true,
        },
      ]);
      if (budgetError) throw budgetError;

      // ✅ Insert into Approval_History (automatic Approved)
      const { error: approvalError } = await supabase
        .from("Approval_History")
        .insert([
          {
            PwpCode: formData.coverCode,
            ApproverId:parsedUser.name ,
            DateResponded: new Date().toISOString(),
            Response: "Approved",
            Type: "Allowed",
            Notication: true,
            CreatedForm: selectedUserId.toString(),
          },
        ]);
      if (approvalError) throw approvalError;

      // ✅ Handle file attachments
      if (files.length > 0) {
        const attachmentInserts = [];
        for (const file of files) {
          const base64Data = await toBase64(file);
          attachmentInserts.push({
            cover_code: formData.coverCode,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size || null,
            file_data: base64Data,
          });
        }

        const { error: attachmentError } = await supabase
          .from("cover_attachments")
          .insert(attachmentInserts);

        if (attachmentError) throw attachmentError;
      }

      await Swal.fire({
        icon: "success",
        title: "Success!",
        text: "Budget submitted and automatically approved!",
        confirmButtonText: "Great",
      });
    }

    // ✅ Reset form after success
    setFormData({
      visaCode: "",
      coverCode: "",
      distributor: "",
      principal: "",
      accountType: "",
      amountbadget: "",
      PWPType: "COVER",
      createForm: "",
      Notification: false,
    });
    setFiles([]);
    setEditingBudget(null);
    setCurrentStep(1);
    setSearchTerm("");
    setSelectedUsername("");
    setUserDistributorsForSelected([]);
  } catch (err) {
    console.error("Unexpected error during submit:", err);
    await Swal.fire({
      icon: "error",
      title: "Unexpected Error",
      text: "Something went wrong. See console for details.",
      confirmButtonText: "OK",
    });
  }
};



  const handleDeleteBudget = async (coverCode) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the budget and all related data!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      const { error: attachError } = await supabase
        .from("cover_attachments")
        .delete()
        .eq("cover_code", coverCode);

      if (attachError) throw attachError;

      const { error: budgetError } = await supabase
        .from("amount_badget")
        .delete()
        .eq("pwp_code", coverCode);

      if (budgetError) throw budgetError;

      const { error: mainError } = await supabase
        .from("cover_pwp")
        .delete()
        .eq("cover_code", coverCode);

      if (mainError) throw mainError;

      await Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Budget has been deleted.",
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Error deleting budget:", err);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to delete budget. Please try again.",
        confirmButtonText: "OK",
      });
    }
  };

const handleEditBudget = async (budget) => {
  console.log("🔧 Editing budget:", budget);
  setEditingBudget(budget);

  // 1️⃣ Get user info from createForm (UserID)
  const { data: userData, error: userError } = await supabase
    .from("Account_Users")
    .select("name, UserID")
    .eq("UserID", budget.createForm)
    .single();

  const username = userData ? userData.name : "";
  const userId = userData ? userData.UserID : null;

  console.log(`👤 Found user: ${username} (ID: ${userId})`);

  // 2️⃣ Fetch ALL distributors from database
  const { data: allDistributorsData, error: allDistError } = await supabase
    .from('distributors')
    .select('id, name, code, agent_code');

  if (allDistError) {
    console.error("❌ Error fetching all distributors:", allDistError);
  }

  // 3️⃣ Filter distributors that match this user's agent_code
  let userDistributors = [];
  
  if (userId && allDistributorsData) {
    const userIdString = String(userId);
    
    userDistributors = allDistributorsData.filter((dist) => {
      if (!dist.agent_code) return false;

      // Handle both array and comma-separated string
      const agentCodes = Array.isArray(dist.agent_code)
        ? dist.agent_code.map(String)
        : String(dist.agent_code).split(',').map((c) => c.trim());

      return agentCodes.includes(userIdString);
    });

    console.log(`📦 Found ${userDistributors.length} distributors for user ${username}`);
    
    // ✅ Update states
    const distributorNames = userDistributors.map(item => item.name);
    setUserDistributorsForSelected(distributorNames);
    setFilteredDistributors(userDistributors);
  }

  // 4️⃣ Find the selected distributor from the budget
  const selectedDist = allDistributorsData?.find(
    (d) => d.code === parseInt(budget.distributor_code)
  );
  
  console.log(`🏢 Selected distributor code: ${budget.distributor_code}`);
  console.log(`🏢 Found distributor:`, selectedDist);

  // 5️⃣ Get agent name for the selected distributor (for display purposes)
  if (selectedDist && selectedDist.agent_code) {
    const { data: agentData } = await supabase
      .from("Account_Users")
      .select("name")
      .eq("UserID", selectedDist.agent_code)
      .single();
    
    if (agentData) {
      console.log(`👤 Agent for distributor: ${agentData.name}`);
      setSelectedAgentName(agentData.name);
    }
  }

  // 6️⃣ Set form data with ALL values
  setFormData({
    visaCode: "",
    coverCode: budget.cover_code,
    distributor: parseInt(budget.distributor_code), // ✅ Ensure it's a number
    principal: "",
    accountType: "",
    amountbadget: budget.amount_badget?.toString() || "",
    PWPType: "COVER",
    createForm: username,
    Notification: false,
    remarks: budget.remarks || "",
  });

  // 7️⃣ Update UI states
  setSearchTerm(username);
  setSelectedUsername(username);

  // 8️⃣ Fetch attachments
  const { data: attachments, error: attachError } = await supabase
    .from("cover_attachments")
    .select("*")
    .eq("cover_code", budget.cover_code);

  if (!attachError && attachments) {
    console.log(`📎 Found ${attachments.length} attachments`);
  }

  // 9️⃣ Go back to form
  setCurrentStep(1);
  
  console.log("✅ Edit mode activated!");
  console.log("✅ Distributor code set to:", parseInt(budget.distributor_code));
  console.log("✅ Available distributors:", userDistributors.length);
};


  const storedUser = localStorage.getItem("loggedInUser");
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;
  const loggedInUsername = parsedUser?.name || "Unknown";

  const [userDistributors, setUserDistributors] = useState([]);
  const [filteredDistributors, setFilteredDistributors] = useState([]);

  useEffect(() => {
    const fetchUserDistributors = async () => {
      const { data: userData, error: userError } = await supabase
        .from("Account_Users")
        .select("UserID")
        .eq("name", loggedInUsername)
        .single();

      if (userError) {
        console.error("[ERROR] Fetching user ID:", userError);
        return;
      }

      const userId = userData.UserID;
      console.log("[DEBUG] User ID:", userId);

      const { data, error } = await supabase
        .from("distributors")
        .select("name")
        .eq("agent_code", userId);

      if (error) {
        console.error("[ERROR] Fetching distributors by agent_code:", error);
      } else {
        const names = data.map((d) => d.name);
        console.log("[DEBUG] Distributors assigned to user:", names);
        setUserDistributors(names);
      }
    };

    if (loggedInUsername !== "Unknown") {
      fetchUserDistributors();
    }
  }, [loggedInUsername]);

  useEffect(() => {
    const fetchDistributors = async () => {
      try {
        console.log("🔍 Fetching ALL distributors...");
        
        let allDistributors = [];
        let hasMore = true;
        let offset = 0;
        const batchSize = 1000;

        while (hasMore) {
          const { data, error } = await supabase
            .from("distributors")
            .select("*")
            .order("name", { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allDistributors = [...allDistributors, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
            console.log(`📦 Batch fetched: ${data.length}, Total: ${allDistributors.length}`);
          } else {
            hasMore = false;
          }
        }

        console.log(`✅ Total distributors fetched: ${allDistributors.length}`);
        setDistributors(allDistributors);

        const distributorNames = selectedUsername ? userDistributorsForSelected : userDistributors;
        const allowed = allDistributors.filter((dist) =>
          distributorNames.includes(dist.name)
        );
        setFilteredDistributors(allowed);
        console.log(`✅ Filtered distributors: ${allowed.length}`);
      } catch (error) {
        console.error("[ERROR] Fetching distributors:", error);
      }
    };

    const distributorNames = selectedUsername ? userDistributorsForSelected : userDistributors;

    if (distributorNames.length > 0) {
      fetchDistributors();
    } else {
      setFilteredDistributors([]);
    }
  }, [userDistributors, selectedUsername, userDistributorsForSelected]);

  const [approvalList, setApprovalList] = useState([]);

  useEffect(() => {
    const fetchApprovalData = async () => {
      try {
        const { data, error } = await supabase
          .from("Single_Approval")
          .select("*");

        if (error) throw error;
        setApprovalList(data);
      } catch (err) {
        console.error("❌ Error fetching approval list:", err.message);
        setApprovalList([]);
      }
    };

    fetchApprovalData();
  }, []);

useEffect(() => {
  const fetchUsernames = async () => {
    // ✅ Fetch from Account_Users instead of user_distributors
    const { data, error } = await supabase
      .from('Account_Users')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching usernames:', error);
    } else {
      const uniqueUsernames = [...new Set(data.map(item => item.name))];
      setUsernames(uniqueUsernames);
      console.log('✅ Loaded usernames from Account_Users:', uniqueUsernames);
    }
  };

  fetchUsernames();
  
  // ✅ Set up realtime subscription for Account_Users changes
   const subscription = supabase
    .channel('account_users_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Account_Users',
      },
      (payload) => {
        console.log('Account_Users changed:', payload);
        fetchUsernames(); // Refresh usernames when table changes
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}, []);


  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const filteredUsernames = usernames.filter(username =>
    username.toLowerCase().includes(searchTerm.toLowerCase())
  );
const handleSelectUsername = async (username) => {
  try {
    setSelectedUsername(username);
    setFormData({ ...formData, createForm: username });
    setSearchTerm(username);
    setIsOpen(false);

    console.log(`👤 Selected username: ${username}`);

    // 1️⃣ Get the agent_code (UserID) for this username
    const { data: userData, error: userError } = await supabase
      .from('Account_Users')
      .select('UserID, name')
      .eq('name', username)
      .single();

    if (userError || !userData) {
      console.error('❌ Error fetching user info or no match:', userError);
      setUserDistributorsForSelected([]);
      setFilteredDistributors([]);
      return;
    }

    const userAgentCode = String(userData.UserID); // make sure it's a string
    console.log(`🆔 Found UserID (agent_code): ${userAgentCode} for ${username}`);

    // 2️⃣ Fetch all distributors
    const { data: distributorsData, error: distError } = await supabase
      .from('distributors')
      .select('*');

    if (distError) {
      console.error('❌ Error fetching distributors:', distError);
      setUserDistributorsForSelected([]);
      setFilteredDistributors([]);
      return;
    }

    // 3️⃣ Filter distributors whose agent_code contains the userAgentCode
    const matchingDistributors = distributorsData.filter((dist) => {
      if (!dist.agent_code) return false;

      // Handle both arrays and comma-separated strings
      const agentCodes = Array.isArray(dist.agent_code)
        ? dist.agent_code.map(String)
        : dist.agent_code.split(',').map((c) => c.trim());

      return agentCodes.includes(userAgentCode);
    });

    // 4️⃣ Extract distributor names and update UI
    const distributorNames = matchingDistributors.map((d) => d.name);
    setUserDistributorsForSelected(distributorNames);
    setFilteredDistributors(matchingDistributors);

    console.log(
      `✅ Found ${matchingDistributors.length} distributor(s) for agent_code ${userAgentCode}:`,
      distributorNames
    );

    // 5️⃣ Reset distributor selection in form
    setFormData((prev) => ({ ...prev, distributor: '' }));
  } catch (err) {
    console.error('💥 Unexpected error in handleSelectUsername:', err);
    setUserDistributorsForSelected([]);
    setFilteredDistributors([]);
  }
};


useEffect(() => {
  const fetchSubmittedBudgets = async () => {
    try {
      // Fetch ALL cover_pwp records (no user filter)
      const { data: coverData, error: coverError } = await supabase
        .from("cover_pwp")
        .select("*")
        .order("created_at", { ascending: false });

      if (coverError) {
        console.error("Error fetching cover_pwp:", coverError);
        return;
      }

      console.log("Fetched ALL cover_pwp data:", coverData);

      // Fetch corresponding amount_badget data
      if (coverData && coverData.length > 0) {
        const coverCodes = coverData.map(item => item.cover_code);
        
        const { data: budgetData, error: budgetError } = await supabase
          .from("amount_badget")
          .select("pwp_code, remainingbalance, amountbadget")
          .in("pwp_code", coverCodes);

        if (budgetError) {
          console.error("Error fetching amount_badget:", budgetError);
        }

        console.log("Fetched amount_badget data:", budgetData);

        // Merge the data
        const mergedData = coverData.map(cover => {
          const budget = budgetData?.find(b => b.pwp_code === cover.cover_code);
          return {
            ...cover,
            remainingbalance: budget?.remainingbalance || 0,
            amountbadget_table: budget?.amountbadget || 0
          };
        });

        console.log("Merged data:", mergedData);
        setSubmittedBudgets(mergedData);
      } else {
        setSubmittedBudgets([]);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setSubmittedBudgets([]);
    }
  };

  // ✅ Initial fetch
  fetchSubmittedBudgets();

  // ✅ Real-time subscription to cover_pwp changes
  const coverSubscription = supabase
    .channel("cover_pwp_realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cover_pwp",
      },
      (payload) => {
        console.log("Cover PWP changed:", payload);
        fetchSubmittedBudgets();
      }
    )
    .subscribe();

  // ✅ Real-time subscription to amount_badget changes
  const budgetSubscription = supabase
    .channel("amount_badget_realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "amount_badget",
      },
      (payload) => {
        console.log("Amount Budget changed:", payload);
        fetchSubmittedBudgets();
      }
    )
    .subscribe();

  // ✅ Cleanup subscriptions
  return () => {
    supabase.removeChannel(coverSubscription);
    supabase.removeChannel(budgetSubscription);
  };
}, []); // Empty dependency array - runs once on mount



  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    if (!e.target.value) {
      setSelectedUsername('');
      setFormData({ ...formData, createForm: '' });
    }
  };


  const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 10; // Change this number to adjust rows per page

const totalPages = Math.ceil(submittedBudgets.length / itemsPerPage);

  return (
    <div style={{ padding: "30px", height: "90vh" }} className="containers">
      <div className="row align-items-center mb-4">
        <div className="col-12 col-md-6">
          <div
            className="card p-4 animate-fade-slide-up shadow-sm"
            style={{
              background: "linear-gradient(135deg, #a8d0ff, #d9edf7)", // gentle blue gradient
              borderRadius: "12px",
              border: "1px solid #99cfff",
              color: "#1a3e72",
              boxShadow: "0 4px 8px rgba(26, 62, 114, 0.15)",
            }}
          >
            <h3
              className="mb-0"
              style={{
                fontWeight: "700",
                letterSpacing: "2px",
                textTransform: "uppercase",
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                textShadow: "1px 1px 2px rgba(26, 62, 114, 0.3)",
              }}
            >
              TOTAL AMOUNT BUDGET
            </h3>
          </div>
        </div>
        {/* Remaining Budget */}
        <div
          className="col-md-4 d-flex justify-content-end align-items-center"
          style={{ position: "absolute", top: "40px", right: "20px" }} // ⬅ added margin-top effect
        >
          <span
            style={{
              fontSize: "18px", // ⬅ mas malaki label
              fontWeight: "600",
              marginRight: "12px",
              color: "#444",
            }}
          >
            Remaining Budget:
          </span>
          <span
            style={{
              fontSize: "24px", // ⬅ mas malaki value
              fontWeight: "bold",
              color: "#000",
              background: "#ffffff",
              padding: "8px 20px", // ⬅ mas spacious
              borderRadius: "10px",
              boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
            }}
          >
            {totalRemaining !== null
              ? `₱${totalRemaining.toLocaleString()}`
              : "Loading..."}
          </span>
        </div>

        <div className="col-12 col-md-6 text-md-end pt-3 pt-md-0"></div>
      </div>

      {currentStep === 1 && (
        <form style={{ marginTop: "50px" }} onSubmit={handleSubmits}>
          <h2
            className="fw-bold mb-0"
            style={{
              letterSpacing: "1px",
              fontSize: "24px",
              marginBottom: "50px",
              textAlign: "right",
            }}
          >
            <h2
              className="fw-bold mb-0"
              style={{
                letterSpacing: "1px",
                fontSize: "24px",
                textAlign: "right",
              }}
            >
              <span
                className={formData.coverCode ? "text-danger" : "text-muted"}
              >
                {loadingCoverCode
                  ? "Generating..."
                  : formData.coverCode || generateCoverCode(allCoverCodes)}
              </span>
            </h2>
          </h2>
          <div className="row g-3">

            {/* ADD THIS NEW USERNAME FIELD: */}
            <div className="col-md-3" style={{ position: "relative", width: "550px" }} ref={dropdownRef}>
              <label className="form-label">
                Assign Name <span style={{ color: "red" }}>*</span>
              </label>

              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search or select username"
                  value={searchTerm}
                  onChange={handleInputChange}
                  onFocus={() => setIsOpen(true)}
                  style={{
                    paddingRight: "30px",
                    borderColor: selectedUsername ? "green" : "",
                    transition: "border-color 0.3s",
                  }}
                />

                {selectedUsername && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '20px',
                      top: '8px',
                      color: 'green',
                      fontWeight: 'bold',
                      fontSize: '25px',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    ✓
                  </span>
                )}

                {isOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '500px',
                      overflowY: 'auto',
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderTop: 'none',
                      zIndex: 1000,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    {filteredUsernames.length > 0 ? (
                      filteredUsernames.map((username, index) => (
                        <div
                          key={index}
                          onClick={() => handleSelectUsername(username)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            backgroundColor: selectedUsername === username ? '#e9ecef' : 'white',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = selectedUsername === username ? '#e9ecef' : 'white'}
                        >
                          {username}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px', color: '#6c757d', textAlign: 'center' }}>
                        No results found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="col-md-3" style={{ position: "relative", width: "550px" }}>
              <label className="form-label">
                Distributor <span style={{ color: "red" }}>*</span>
              </label>

              <select
                name="distributor"
                className="form-control"
                value={formData.distributor}
                onChange={handleFormChange}
                style={{
                  paddingRight: "30px",
                  borderColor: formData.distributor ? "green" : "",
                  transition: "border-color 0.3s",
                }}
                onMouseEnter={(e) => {
                  if (formData.distributor)
                    e.currentTarget.style.borderColor = "green";
                }}
                onMouseLeave={(e) => {
                  if (formData.distributor)
                    e.currentTarget.style.borderColor = "green";
                  else e.currentTarget.style.borderColor = "";
                }}
              >
                <option value="">Select Distributor</option>
                {filteredDistributors.map((dist) => (
                  <option key={dist.id} value={dist.code}>
                    {dist.name}
                  </option>
                ))}
              </select>
              {selectedDistributorUsername && (
                <div
                  style={{
                    marginTop: "8px",
                    padding: "6px 12px",
                    backgroundColor: "#e7f3ff",
                    border: "1px solid #b3d9ff",
                    borderRadius: "4px",
                    fontSize: "14px",
                    color: "#0066cc",
                  }}
                >
                  <strong>Assigned to:</strong> {selectedDistributorUsername}
                </div>
              )}

              <span
                style={{
                  position: "absolute",
                  top: "75%",
                  right: "20px",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  fontSize: "0.8rem",
                  color: "#666",
                }}
              >
                ▼
              </span>
              {formData.principal !== "" && (
                <span
                  style={{
                    position: "absolute",
                    right: "40px",
                    top: "55%",
                    transform: "translateY(-20%)",
                    color: "green",
                    fontWeight: "bold",
                    fontSize: "25px",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  ✓
                </span>
              )}
            </div>

            <div className="col-md-3" style={{ position: "relative" }}>
              <label className="form-label">
                Amount Budget <span style={{ color: "red" }}>*</span>
              </label>
              <input
                type="text"
                name="amountbadget"
                className="form-control"
                value={formatCurrency(formData.amountbadget)}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/,/g, "");
                  if (/^[0-9]*\.?[0-9]*$/.test(rawValue)) {
                    handleFormChange({
                      target: { name: "amountbadget", value: rawValue },
                    });
                  }
                }}
                style={{ paddingRight: "30px" }}
              />
              {formData.amountbadget !== "" && (
                <span
                  style={{
                    position: "absolute",
                    right: "20px",
                    top: "50%",
                    transform: "translateY(-20%)",
                    color: "green",
                    fontWeight: "bold",
                    fontSize: "25px",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  ✓
                </span>
              )}
            </div>
            <div className="col-md-3" style={{ position: "relative" }}>
              <label className="form-label" style={{ color: "#888" }}>
                Marketing Type
              </label>
              <select
                name="coverType"
                className="form-control"
                value={formData.coverType}
                onChange={handleFormChange}
                style={{
                  paddingRight: "30px",
                  textTransform: "uppercase",
                  backgroundColor: "#f5f5f5",
                  cursor: "not-allowed",
                }}
                disabled
              >
                <option value="COVER_PWP">TOTAL AMOUNT BUDGET</option>
              </select>

              {formData.coverType !== "" && (
                <span
                  style={{
                    position: "absolute",
                    right: "20px",
                    top: "50%",
                    transform: "translateY(-20%)",
                    color: "green",
                    fontWeight: "bold",
                    fontSize: "25px",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  ✓
                </span>
              )}
            </div>
          </div>

         NEW CODE:
<div className="mt-4 d-flex justify-content-between gap-3">
  <button
    type="button"
    className="btn btn-outline-secondary"
    onClick={() => setCurrentStep(2)}
  >
    View Submitted Budgets
  </button>
  <button type="submit" className="btn btn-success">
    {editingBudget ? "Update Budget" : "Submit Budget"}
  </button>
</div>
        </form>
      )}

{currentStep === 2 && (
  <>
    <div className="mb-4">
      <h4 className="mb-3">Submitted Budgets</h4>

      {submittedBudgets.length === 0 ? (
        <div className="alert alert-info">No budgets submitted yet.</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-bordered table-striped table-hover">
          <thead className="table-primary">
  <tr>
    <th>Cover Code</th>
    <th>Distributor</th>
    <th>Amount Budget</th>
    <th>Remaining Balance</th>
    <th>PWP Type</th>
    <th>Date Created</th>
    <th>Last Updated</th>
    <th>Actions</th>
  </tr>
</thead>

              <tbody>
                {submittedBudgets
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((budget) => {
                    const dist = distributors.find(
                      (d) =>
                        String(d.code).trim() ===
                        String(budget.distributor_code).trim()
                    );

                    return (
                      <tr key={budget.id}>
                        <td>{budget.cover_code}</td>

                        {/* ✅ Distributor Name Conversion */}
                        <td>
                          {dist
                            ? dist.name
                            : `Code: ${budget.distributor_code || "N/A"}`}
                        </td>

                        <td className="text-end">
                          ₱{formatCurrency(budget.amount_badget?.toString() || "0")}
                        </td>

                        <td className="text-end">
                          ₱{formatCurrency(
                            budget.remainingbalance?.toString() || "0"
                          )}
                        </td>

                        <td>{budget.pwp_type || "COVER_PWP"}</td>

                        <td>
                          {budget.created_at
                            ? new Date(budget.created_at).toLocaleDateString()
                            : "-"}
                        </td>
<td>
  {budget.updatedCreated
    ? new Date(budget.updatedCreated).toLocaleDateString()
    : "-"}
</td>

                        <td>
                          <button
                            className="btn btn-sm btn-warning me-2"
                            onClick={() => handleEditBudget(budget)}
                            title="Edit Budget"
                          >
                            <i className="bi bi-pencil"></i> Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteBudget(budget.cover_code)}
                            title="Delete Budget"
                          >
                            <i className="bi bi-trash"></i> Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* ✅ Pagination Controls */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              Page {currentPage} of {totalPages}
            </div>

            <div>
              <button
                className="btn btn-secondary btn-sm me-2"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                « First
              </button>

              <button
                className="btn btn-secondary btn-sm me-2"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                ‹ Prev
              </button>

              <button
                className="btn btn-secondary btn-sm me-2"
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(prev + 1, totalPages)
                  )
                }
                disabled={currentPage === totalPages}
              >
                Next ›
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last »
              </button>
            </div>
          </div>
        </>
      )}
    </div>

       <div className="mt-4">
            <button
              className="btn btn-primary"
              onClick={() => {
                setFormData({
                  visaCode: "",
                  coverCode: "",
                  distributor: "",
                  principal: "",
                  accountType: "",
                  amountbadget: "",
                  PWPType: "COVER",
                  createForm: "",
                  Notification: false,
                });
                setFiles([]);
                setEditingBudget(null);
                setCurrentStep(1); // ✅ Switch to Step 1
                setSearchTerm("");
                setSelectedUsername("");
                setUserDistributorsForSelected([]);
                setFilteredDistributors([]); // ✅ Clear filtered distributors
              }}
            >
              + Create New Budget
            </button>
          </div>
  </>
)}

      {currentStep === 3 && <></>}
    </div>
  );
};

export default CoverVisa;
