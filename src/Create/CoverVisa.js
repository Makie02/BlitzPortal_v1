import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from "sweetalert2"; // <---- import sweetalert2
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
  const [selectedDistributorUsername, setSelectedDistributorUsername] = useState("");
  const [selectedUsername, setSelectedUsername] = useState('');
  const [usernames, setUsernames] = useState([]);
  const [userDistributorsForSelected, setUserDistributorsForSelected] = useState([]);
  // Auto-generate Visa Code on mount

  const handleFormChange = async (e) => {
    const { name, value } = e.target;

    // Update formData with the new field value
    setFormData((prev) => {
      const updatedFormData = { ...prev, [name]: value };
      return updatedFormData;
    });

    if (name === "createForm") {

      setSelectedUsername(value);
      setSelectedDistributorUsername(value);

      if (value) {
        // Fetch distributors for selected username
        const { data, error } = await supabase
          .from('user_distributors')
          .select('distributor_name')
          .eq('username', value);

        if (error) {
          console.error('Error fetching user distributors:', error);
          setUserDistributorsForSelected([]);
        } else {
          setUserDistributorsForSelected(data.map(item => item.distributor_name));
        }
      } else {
        setUserDistributorsForSelected([]);
      }

      // Reset distributor selection when username changes
      setFormData(prev => ({ ...prev, distributor: '' }));
      setSelectedDistributorUsername('');
      return;
    }


    if (name === "distributor") {
      try {
        const selectedDistributor = distributors.find(
          (d) => d.code === Number(value)
        );

        if (!selectedDistributor) {
          console.warn("⚠️ Distributor not found for code:", value);
          setAccountTypes([]);
          return;
        }

        console.log("📦 Selected distributor:", selectedDistributor);

        const { data: userDistributorData, error: userDistributorError } =
          await supabase
            .from("user_distributors")
            .select("username")
            .or(
              `distributor_name.eq.${selectedDistributor.name
              },distributor_name.eq.${selectedDistributor.name.replace(
                " -",
                "-"
              )},distributor_name.eq.${selectedDistributor.name.replace(
                "- ",
                "-"
              )}`
            )
            .single();

        //if (userDistributorError) {
        //    console.warn(
        //      "⚠️ Username not found for distributor:",
        //     selectedDistributor.name
        //   );
        //  setSelectedDistributorUsername("No user assigned");
        //  } else {
        //    setSelectedDistributorUsername(userDistributorData.username);
        //   console.log("👤 Found username:", userDistributorData.username);
        // }
        const isBadOrder = selectedDistributor.name === "BAD ORDER";

        setFormData((prev) => ({
          ...prev,
          distributor: value,
          distributorName: selectedDistributor.name || "",
          categoryName: isBadOrder ? [] : prev.categoryName,
          accountType: isBadOrder ? [] : prev.accountType,
        }));

        if (isBadOrder) {
          console.log("⛔ BAD ORDER selected → skipping categories");
          setAccountTypes([]);
          return;
        }

        // Fetch all categorydetails in batches
        const batchSize = 1000;
        let allData = [];
        let hasMore = true;
        let offset = 0;

        console.log(
          `🔍 Starting to fetch all categories for distributor ID: ${selectedDistributor.id}`
        );

        while (hasMore) {
          console.log(
            `📥 Fetching batch ${Math.floor(offset / batchSize) + 1
            }... (offset: ${offset})`
          );

          const { data, error } = await supabase
            .from("categorydetails")
            .select("code, name, description")
            .eq("principal_id", selectedDistributor.id)
            .order("name", { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (error) {
            console.error("❌ Batch fetch error:", error);
            throw error;
          }

          console.log(
            `✅ Batch ${Math.floor(offset / batchSize) + 1} fetched: ${data?.length || 0
            } records`
          );

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize;
            console.log(`📊 Total records so far: ${allData.length}`);
          } else {
            hasMore = false;
            console.log("🏁 No more records to fetch");
          }
        }

        if (allData.length === 0) {
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

        console.log(
          "✅ All formatted accountTypes set:",
          formatted.length,
          "records"
        );
        console.log("🧹 Reset formData.accountType after distributor change");
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
  const fileInputRef = useRef();

  const handleFiles = (selectedFiles) => {
    const newFiles = Array.from(selectedFiles).map((file) => {
      // Create preview URL for images
      if (file.type.startsWith("image/")) {
        file.preview = URL.createObjectURL(file);
      }
      return file;
    });
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInputChange = (e) => {
    handleFiles(e.target.files);
  };

  const removeFile = (index) => {
    const updated = [...files];
    // Revoke preview URL to avoid memory leaks
    if (updated[index].preview) {
      URL.revokeObjectURL(updated[index].preview);
    }
    updated.splice(index, 1);
    setFiles(updated);
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const [accountTypes, setAccountTypes] = useState([]);

  //albert
  const [approvedExpenses, setApprovedExpenses] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);

  //albert
  // Add this useEffect to calculate remaining budget whenever amount budget or approved expenses change
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
      maximumFractionDigits: 0, // No decimal places
    });
  };

  //albert
  useEffect(() => {
    const fetchApprovedExpenses = async () => {
      if (!formData.visaCode) return;

      try {
        // Fetch approved regular PWP budget expenses
        const { data, error } = await supabase
          .from("approved_pwp_expenses") // Replace with your actual table name
          .select("amount")
          .eq("visa_code", formData.visaCode)
          .eq("status", "approved");

        if (error) {
          console.error("Error fetching approved expenses:", error);
          return;
        }

        // Calculate total approved expenses
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

      // Fetch singleapprovals
      const { data: approvalsData, error: approvalsError } = await supabase
        .from("singleapprovals")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch user approvers
      const { data: userApproversData, error: userApproversError } =
        await supabase
          .from("User_Approvers")
          .select("*")
          .order("created_at", { ascending: false });

      // Fetch users for name lookup
      const { data: usersData, error: usersError } = await supabase
        .from("Account_Users")
        .select( "name");

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
      .eq("createduser", storedUser.id) // ✅ Query by user ID
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
          filter: `createduser=eq.${storedUser.id}`, // ✅ Filter by user ID
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
  // Helper: get name from user_id

  // Combine and normalize data into one array for the table

  const [accountSearchTerm, setAccountSearchTerm] = useState("");

  // Toggle selection of accountType

  // fetch account types
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

  // toggle checkbox

  const [allCoverCodes, setAllCoverCodes] = useState([]);
  const [loadingCoverCode, setLoadingCoverCode] = useState(true);

  // ---------------- Generate cover code ----------------
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

  // ---------------- Fetch cover codes ----------------
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

      // Generate new code if empty or already used
      if (!formData.coverCode || codes.includes(formData.coverCode)) {
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

  // ---------------- Real-time polling ----------------
  useEffect(() => {
    fetchCoverCodes(); // Initial fetch

    const intervalId = setInterval(() => {
      fetchCoverCodes();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId); // Cleanup
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
        .select("id, name, code");
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




// 🔹 Utility function to convert files to Base64 with prefix
const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file); // includes "data:<type>;base64,..." prefix
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
    // ✅ Get logged-in user from localStorage
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

    // ✅ Fetch the user ID for the selected username from formData.createForm
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
    const accountCodes = formData.accountType; // array of codes

    // ✅ Insert into main cover_pwp
    const dataToInsert = {
      cover_code: formData.coverCode,
      distributor_code: formData.distributor,
      account_type: accountCodes.join(","),
      amount_badget: parseFloat(formData.amountbadget),
      pwp_type: formData.coverType || "COVER_PWP",
      objective: formData.objective,
      promo_scheme: formData.promoScheme,
      details: formData.details,
      remarks: formData.remarks,
      notification: false,
      createForm: selectedUserId, // save user ID
    };

    const { error: mainError } = await supabase
      .from("cover_pwp")
      .insert([dataToInsert]);
    if (mainError) throw mainError;

    // ✅ Insert into amount_badget
    const { error: budgetError } = await supabase.from("amount_badget").insert([
      {
        pwp_code: formData.coverCode,
        amountbadget: parseFloat(formData.amountbadget),
        createduser: selectedUserId,
        distributor: formData.distributor,
        remainingbalance: parseFloat(formData.amountbadget),
        Approved: false,
      },
    ]);
    if (budgetError) throw budgetError;

    // ✅ Handle file attachments with Base64 (with prefix)
    if (files.length > 0) {
      const attachmentInserts = [];

      for (const file of files) {
        const base64Data = await toBase64(file);
        attachmentInserts.push({
          cover_code: formData.coverCode,
          file_name: file.name,
          file_type: file.type || null,
          file_size: file.size || null,
          file_data: base64Data, // ✅ full Base64 string with prefix
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
      text: "Form and attachments submitted successfully!",
      confirmButtonText: "Great",
    });

    window.location.reload();
    setCurrentStep(2);
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


  const storedUser = localStorage.getItem("loggedInUser");
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;
  const loggedInUsername = parsedUser?.name || "Unknown";

  const [userDistributors, setUserDistributors] = useState([]);
  const [filteredDistributors, setFilteredDistributors] = useState([]);

  useEffect(() => {
    const fetchUserDistributors = async () => {
      const { data, error } = await supabase
        .from("user_distributors")
        .select("distributor_name")
        .eq("username", loggedInUsername);

      if (error) {
        console.error("[ERROR] Fetching user_distributors:", error);
      } else {
        const names = data.map((d) => d.distributor_name);
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
      const { data, error } = await supabase
        .from("distributors")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("[ERROR] Fetching distributors:", error);
      } else {
        setDistributors(data);

        // Filter distributors based on selected username or logged-in user
        const distributorNames = selectedUsername ? userDistributorsForSelected : userDistributors;
        const allowed = data.filter((dist) =>
          distributorNames.includes(dist.name)
        );
        setFilteredDistributors(allowed);
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
      const { data, error } = await supabase
        .from('user_distributors')
        .select('username')
        .order('username', { ascending: true });

      if (error) {
        console.error('Error fetching usernames:', error);
      } else {
        const uniqueUsernames = [...new Set(data.map(item => item.username))];
        setUsernames(uniqueUsernames);
      }
    };

    fetchUsernames();
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

const handleSelectUsername = (username) => {
  setSelectedUsername(username);
  setFormData({ ...formData, createForm: username });
  setSearchTerm(username);
  setIsOpen(false);
  
  // Trigger the existing handleFormChange logic
  handleFormChange({ target: { name: 'createForm', value: username } });
};

const handleInputChange = (e) => {
  setSearchTerm(e.target.value);
  setIsOpen(true);
  if (!e.target.value) {
    setSelectedUsername('');
    setFormData({ ...formData, createForm: '' });
  }
};
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

          <div className="mt-4 d-flex justify-content-end gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
            >
              Next →
            </button>
          </div>
        </form>
      )}

      {currentStep === 2 && (
        <>
          <div className="mb-3" style={{ textAlign: "right" }}>
            <h5>
              Total of Balances Budget:{" "}
              <span style={{ color: "green" }}>
                PHP {formatCurrency(formData.amountbadget)}
              </span>
            </h5>
          </div>

          <h4 className="mb-3">Your Approval </h4>

          <div className="table-responsive">
            {loading ? (
              <p>Loading approvals...</p>
            ) : (
              <table className="table table-bordered table-striped table-hover">
                <thead className="table-success">
                  <tr>
                    <th>Approver</th>
                    <th>Position</th>
                    <th>Date Created</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalList.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center">
                        No approval data found.
                      </td>
                    </tr>
                  ) : (
                    approvalList.map(
                      ({ id, username, allowed_to_approve, created_at }) => (
                        <tr key={id}>
                          <td>{username}</td>
                          <td>
                            {allowed_to_approve ? (
                              <span className="badge bg-success">Allowed</span>
                            ) : (
                              <span className="badge bg-warning text-dark">
                                Not Allowed
                              </span>
                            )}
                          </td>
                          <td>
                            {created_at
                              ? new Date(created_at).toLocaleDateString()
                              : "-"}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            )}

            <h4 className="mt-4">Attachments</h4>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current.click()}
              className="border border-primary rounded p-4 mb-3"
              style={{
                cursor: "pointer",
                minHeight: "150px",
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                alignItems: "center",
                justifyContent: files.length === 0 ? "center" : "flex-start",
                backgroundColor: "#f8f9fa",
                position: "relative",
                transition: "background-color 0.3s",
              }}
            >
              {files.length === 0 && (
                <p className="text-muted">
                  Drag & Drop files here or click to upload
                </p>
              )}

              {files.map((file, index) => (
                <div
                  key={index}
                  className="position-relative"
                  style={{
                    width: "100px",
                    height: "100px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    overflow: "hidden",
                    textAlign: "center",
                    padding: "5px",
                    backgroundColor: "white",
                    boxShadow: "0 0 4px rgba(0,0,0,0.1)",
                  }}
                >
                  {file.type.startsWith("image/") ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "80px",
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: "12px",
                        wordWrap: "break-word",
                        marginTop: "30px",
                      }}
                    >
                      <i
                        className="bi bi-file-earmark"
                        style={{ fontSize: "28px", color: "#0d6efd" }}
                      ></i>
                      <div>
                        {file.name.length > 15
                          ? file.name.slice(0, 15) + "..."
                          : file.name}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="btn btn-sm btn-danger position-absolute top-0 end-0"
                    style={{ borderRadius: "0 0 0 6px" }}
                    title="Remove file"
                  >
                    &times;
                  </button>
                </div>
              ))}

              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileInputChange}
                style={{ display: "none" }}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Remarks</label>
              <textarea
                name="remarks"
                className="form-control"
                value={formData.remarks}
                onChange={handleFormChange}
                rows={4}
              />
            </div>
            <div className="mt-4 d-flex justify-content-between">
              <button className="btn btn-outline-secondary" onClick={prevStep}>
                ← Previous
              </button>
              <button className="btn btn-success" onClick={handleSubmits}>
                Submit To Approvers
              </button>{" "}
            </div>
          </div>
        </>
      )}

      {currentStep === 3 && <></>}
    </div>
  );
};

export default CoverVisa;
