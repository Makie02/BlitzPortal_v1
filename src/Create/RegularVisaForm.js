import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from "sweetalert2"; // <---- import sweetalert2
import { supabase } from "../supabaseClient";
import { Modal, Button, Nav } from "react-bootstrap";
import { FaExclamationTriangle } from "react-icons/fa";
import { Table, Form, Card, Spinner } from "react-bootstrap";
import * as XLSX from "xlsx";
import {
  FaFileExcel,
  FaCloudUploadAlt,
  FaDownload,
  FaSave,
  FaSearch,
} from "react-icons/fa";
import { saveAs } from "file-saver";
import { motion } from "framer-motion";
import { FiChevronRight } from "react-icons/fi"; // or FaArrowRight
import Papa from "papaparse"; // make sure you have this installed

const RegularVisaForm = () => {
  const [userApprovers, setUserApprovers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  // 👉 Add these states at the top of your component
  const [showPack, setShowPack] = useState(true);
  const [showCase, setShowCase] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: userApproversData, error: userApproversError } =
        await supabase
          .from("User_Approvers")
          .select("*")
          .order("created_at", { ascending: false });

      // Fetch users for name lookup
      const { data: usersData, error: usersError } = await supabase
        .from("Account_Users")
        .select("UserID, name");

      // if (approvalsError) console.error('Error fetching approvals:', approvalsError);
      if (userApproversError)
        console.error("Error fetching user approvers:", userApproversError);
      if (usersError) console.error("Error fetching users:", usersError);

      // setSingleApprovals(approvalsData || []);
      setUserApprovers(userApproversData || []);
      setUsers(usersData || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const [accountSkuRows, setAccountSkuRows] = useState({}); // Object to store SKU rows per account
  const [selectedAccountForSku, setSelectedAccountForSku] =
    useState("ALL_ACCOUNTS");
  // Step 0: Form data
  const [formData, setFormData] = useState({
    regularpwpcode: "",
    accountType: "",
    activity: "",
    pwptype: "Regular",
    notification: false,
    objective: "",
    promoScheme: "",
    activityDurationFrom: new Date().toISOString().split("T")[0], // today
    activityDurationTo: new Date().toISOString().split("T")[0], // today
    rowsCategories: [
      { category: "", amount: "" },
      { category: "", amount: "" },
    ],
    branchType: [], // add this

    isPartOfCoverPwp: false,
    coverPwpCode: "",
    distributor: "",
    amountbadget: "0",
    categoryCode: [],
    categoryName: [],
    sku: null, // New Field
    accounts: null, // New Field
    amount_display: null, // New Field
  });

  const [allRegularPwpCodes, setAllRegularPwpCodes] = useState([]); // Stores all regular pwp codes
  const [loadingRegularPwpCodes, setLoadingRegularPwpCodes] = useState(true); // Loading state

  // ---------------- Generate new code ----------------
  const generateRegularCode = (existingCodes = []) => {
    const year = new Date().getFullYear(); // Current year
    const prefix = `R${year}-`;

    // Filter existing codes with this year's prefix and extract numbers
    const codesForYear = existingCodes
      .filter((code) => code?.startsWith(prefix))
      .map((code) => parseInt(code.replace(prefix, ""), 10))
      .filter((num) => !isNaN(num));

    const newNumber = (codesForYear.length ? Math.max(...codesForYear) : 0) + 1;
    const newCode = `${prefix}${newNumber}`;

    console.log("🔹 Existing codes:", existingCodes);
    console.log("🔹 Codes for this year:", codesForYear);
    console.log("🔹 Generated new code:", newCode);

    return newCode;
  };

  // ---------------- Fetch codes ----------------
  const fetchRegularPwpCodes = async () => {
    try {
      console.log("⏳ Fetching regular PWP codes...");
      const { data, error } = await supabase
        .from("regular_pwp")
        .select("regularpwpcode");

      if (error) throw error;

      const codes = data.map((row) => row.regularpwpcode).filter(Boolean);
      console.log("✅ Fetched codes:", codes);

      setAllRegularPwpCodes(codes);

      // If formData code is empty or already exists, generate a new one
      if (!formData.regularpwpcode || codes.includes(formData.regularpwpcode)) {
        const newCode = generateRegularCode(codes);
        console.log("✏️ Updating formData with new code:", newCode);
        setFormData((prev) => ({ ...prev, regularpwpcode: newCode }));
      }

      setLoadingRegularPwpCodes(false);
    } catch (err) {
      console.error("❌ Error fetching regular pwp codes:", err);
      setLoadingRegularPwpCodes(false);
    }
  };

  // ---------------- Real-time polling ----------------
  useEffect(() => {
    fetchRegularPwpCodes(); // Initial fetch

    const intervalId = setInterval(() => {
      fetchRegularPwpCodes();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId); // Cleanup
  }, [formData.regularpwpcode]);

  useEffect(() => {
    // This effect runs whenever `allRegularPwpCodes` changes
    if (!formData.regularpwpcode && allRegularPwpCodes.length > 0) {
      const newCode = generateRegularCode(allRegularPwpCodes); // Generate the new cover code
      setFormData((prev) => ({ ...prev, regularpwpcode: newCode })); // Update formData with the new coverCode
    }
  }, [allRegularPwpCodes]); // Dependencies are the fetched codes

  // Generate a new code based on the existing ones

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

  const [hovered, setHovered] = useState(false);

  const borderColor = formData.company ? "green" : hovered ? "#ccc" : "";

  const [accountTypes, setAccountTypes] = useState([]);

  const [showSkuModal, setShowSkuModal] = useState(false);

  // State to hold filtered brands for selected principal
  const [filteredBrands, setFilteredBrands] = useState([]); // Always an array

  useEffect(() => {
    if (!formData.principal) {
      setFilteredBrands([]);
      return;
    }

    let isMounted = true;

    const fetchBrands = async () => {
      const { data, error } = await supabase
        .from("Branddetails")
        .select("*")
        .eq("parentname", formData.principal); // Match selected principal

      if (error) {
        console.error("Error fetching Branddetails:", error);
        if (isMounted) setFilteredBrands([]);
        return;
      }

      if (isMounted) {
        setFilteredBrands(data || []); // Always an array
      }
    };

    fetchBrands();

    return () => {
      isMounted = false;
    };
  }, [formData.principal]);
  const [name, setname] = React.useState("User");

  const [coverPwpWithStatus, setCoverPwpWithStatus] = React.useState([]);
  const [coverPwpSearch, setCoverPwpSearch] = React.useState("");
  const [selectedBalance, setSelectedBalance] = React.useState(null);
  const [UserID, setUserId] = React.useState(null); // ✅ Add this state

  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");

    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);

        // ✅ Extract UserID and name
        const UserID = userObj.UserID || "Unknown ID";
        const userName = userObj.name || "User";

        // ✅ Set name and UserID to state
        setname(userName);
        setUserId(UserID);

        // ✅ Log both to console
        console.log("[DEBUG] Logged in user info:");
        console.log("UserID:", UserID);
        console.log("User Name:", userName);
      } catch (err) {
        console.error("[ERROR] Failed to parse loggedInUser from localStorage:", err);
        setname("User");
      }
    } else {
      console.warn("[DEBUG] No loggedInUser found in localStorage.");
    }
  }, []);


  React.useEffect(() => {
    async function fetchCoverPwpWithStatus() {
      try {
        console.log("🚀 Fetching PWP data with distributor names and approval status...");
        console.log("UserID:", UserID); // UserID must be defined somewhere in your component

        // 1️⃣ Fetch amount_badget
        const { data: amountData, error: amountError } = await supabase
          .from("amount_badget")
          .select("*");
        if (amountError) throw amountError;

        // 🔍 Filter amountData to only include entries created by current user
        const filteredAmountData = amountData.filter(item => String(item.createduser) === String(UserID));

        // 2️⃣ Fetch distributors
        const { data: distributorsData, error: distributorError } = await supabase
          .from("distributors")
          .select("code, name");
        if (distributorError) throw distributorError;

        // 3️⃣ Fetch approval history
        const { data: approvalData, error: approvalError } = await supabase
          .from("Approval_History")
          .select("PwpCode, Response")
          .order("DateResponded", { ascending: false }); // get latest first
        if (approvalError) throw approvalError;

        // 4️⃣ Merge: distributor + approval info
        const mergedData = filteredAmountData.map((item) => {
          // find distributor name
          const matchingDistributor = distributorsData.find(
            (d) => String(d.code) === String(item.distributor)
          );

          // find latest approval for this PWP
          const matchingApproval = approvalData.find(
            (a) => a.PwpCode === item.pwp_code
          );

          // determine approval status
          const isApproved = matchingApproval?.Response?.toLowerCase() === "approved";

          return {
            ...item,
            distributor: matchingDistributor ? matchingDistributor.name : item.distributor,
            approved: isApproved,
          };
        });

        console.log("📦 mergedData with approval:", mergedData);
        setCoverPwpWithStatus(mergedData);
      } catch (err) {
        console.error("❌ Error fetching PWP data:", err);
        setCoverPwpWithStatus([]);
      }
    }

    fetchCoverPwpWithStatus();
  }, [UserID]);



  const [showCoverModal, setShowCoverModal] = useState(false);

  const [showModal, setShowModal] = useState(false);

  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [listings, setListings] = useState([]);
  const [selectedListings, setSelectedListings] = useState([]);
  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState([]);

  const [loadingListings, setLoadingListings] = useState(false);

  useEffect(() => {
    // Sync rows to selectedSkus
    const newRows = selectedSkus.map((sku) => {
      const existingRow = rows.find((row) => row.SKU === sku);
      return (
        existingRow || {
          SKU: sku,
          SRP: "",
          QTY: "",
          UOM: "",
          DISCOUNT: "",
          BILLING_AMOUNT: "",
        }
      );
    });
    setRows(newRows);
  }, [selectedSkus]);

  // const handleAccountSkuChange = (selectedCode) => {
  //     setSelectedAccountForSku(selectedCode);

  //     if (selectedCode && selectedCode !== 'ALL_ACCOUNTS') {
  //         setAccountSkuRows(prev => {
  //             const existingRows = prev[selectedCode] || [];

  //             // Only create a default row if this account truly has none
  //             if (existingRows.length === 0) {
  //                 return {
  //                     ...prev,
  //                     [selectedCode]: [{
  //                         accountCode: selectedCode,  // 👈 keep code reference
  //                         SKUITEM: '',
  //                         SRP: '',
  //                         QTY: '',
  //                         UOM: '',
  //                         BILLING_AMOUNT: '',
  //                         DISCOUNT: '',
  //                         TOTAL_AMOUNT: '',
  //                     }]
  //                 };
  //             }

  //             return prev; // Keep existing rows
  //         });
  //     }
  // };
  const [branchSkuRows, setBranchSkuRows] = useState({});

  const handleChangeSkuForBranch = (branchKey, index, field, value) => {
    setAccountSkuRows((prev) => {
      const updated = { ...prev };
      const rows = [...(updated[branchKey] || [])];
      const row = { ...rows[index] };

      if (field === "SKUITEM") {
        row.SKUITEM = value;
        const skuData = categoryListing.find((sku) => sku.sku_code === value);

        if (skuData) {
          row.SRP = skuData.srp || 0;
          row.QTY = 0;
          row.DISCOUNT = 0;
          row.BILLING_AMOUNT = 0;
          row.TOTAL_AMOUNT = 0;
          row.UOM = skuData.uoms?.[0] || "";
        } else {
          row.SRP = 0;
          row.QTY = 0;
          row.DISCOUNT = 0;
          row.BILLING_AMOUNT = 0;
          row.TOTAL_AMOUNT = 0;
          row.UOM = "";
        }
      } else {
        // For numeric fields convert to number, otherwise just assign
        if (["SRP", "QTY", "DISCOUNT"].includes(field)) {
          row[field] = Number(value) || 0;
        } else {
          row[field] = value;
        }
      }

      const srp = Number(row.SRP || 0);
      const qty = Number(row.QTY || 0);
      const discountAmount = Number(row.DISCOUNT || 0); // discount as fixed amount

      row.BILLING_AMOUNT = srp * qty;
      row.TOTAL_AMOUNT = row.BILLING_AMOUNT - discountAmount;

      // Just in case total goes negative, set minimum 0
      if (row.TOTAL_AMOUNT < 0) row.TOTAL_AMOUNT = 0;

      rows[index] = row;
      updated[branchKey] = rows;

      return updated;
    });
  };



  const addSkuRowForBranch = (brandname) => {
    if (brandname === "ALL_BRANCHES") {
      setAccountSkuRows((prev) => ({
        ...prev,
        ALL_BRANCHES: [
          ...(prev.ALL_BRANCHES || []),
          { SKUITEM: "", SRP: 0, QTY: 0, UOM: "Case", DISCOUNT: 0 },
        ],
      }));
    } else {
      setAccountSkuRows((prev) => ({
        ...prev,
        [brandname]: [
          ...(prev[brandname] || []),
          { SKUITEM: "", SRP: 0, QTY: 0, UOM: "Case", DISCOUNT: 0 },
        ],
      }));
    }
  };

  const removeSkuRowForBranch = (brandname, index) => {
    setAccountSkuRows((prev) => ({
      ...prev,
      [brandname]: (prev[brandname] || []).filter((_, i) => i !== index),
    }));
  };





  // Calculate totals per branch/sub-account
  const calculateBranchSkuTotals = (branchCode) => {
    const rows = accountSkuRows[branchCode] || [];
    const totals = {
      SRP: 0,
      QTY: 0,
      BILLING_AMOUNT: 0,
      DISCOUNT: 0,
      TOTAL_AMOUNT: 0,
    };

    rows.forEach((row) => {
      const srp = Number(row.SRP || 0);
      const qty = Number(row.QTY || 0);
      const discount = Number(row.DISCOUNT || 0);  // discount as fixed amount

      const billing = srp * qty;
      const discountAmount = discount;  // fixed discount amount

      totals.SRP += srp;
      totals.QTY += qty;
      totals.BILLING_AMOUNT += billing;
      totals.DISCOUNT += discountAmount;
      totals.TOTAL_AMOUNT += (billing - discountAmount);
    });

    return totals;
  };

  // Calculate Grand Totals (for ALL branches OR selected NON-CHAIN sub-accounts)
  const calculateGrandTotals = () => {
    let totalQty = 0;
    let totalBilling = 0;
    let totalDiscount = 0;
    let totalAmount = 0;

    Object.keys(accountSkuRows).forEach((branchName) => {
      const rows = accountSkuRows[branchName] || [];

      rows.forEach((row) => {
        const srp = Number(row.SRP || 0);
        const qty = Number(row.QTY || 0);
        const discount = Number(row.DISCOUNT || 0);
        const billingAmount = srp * qty;
        const total = billingAmount - discount;

        totalQty += qty;
        totalBilling += billingAmount;
        totalDiscount += discount;
        totalAmount += total;
      });
    });

    return {
      QTY: totalQty,
      BILLING_AMOUNT: totalBilling,
      DISCOUNT: totalDiscount,
      TOTAL_AMOUNT: totalAmount,
    };
  };



  const renderGrandTotalSummary = () => {
    const grandTotals = calculateGrandTotals();

    return (
      <div className="mt-4">
        <h4 className="text-center mb-4">📊 Grand Total Summary</h4>
        <Table bordered hover responsive className="text-center align-middle">
          <thead className="table-primary text-white">
            <tr>
              <th>Total QTY</th>
              <th>Total Billing</th>
              <th>Total Discount</th>
              <th>Grand Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{grandTotals.QTY}</td>
              <td>{grandTotals.BILLING_AMOUNT.toFixed(2)}</td>
              <td>{grandTotals.DISCOUNT.toFixed(2)}</td>
              <td>{grandTotals.TOTAL_AMOUNT.toFixed(2)}</td>
            </tr>
          </tbody>
        </Table>
      </div>
    );
  };

  // Calculate Grand Totals (for ALL branches OR selected NON-CHAIN sub-accounts)


  const handleCloseModal = () => {
    setShowModal(false);
  };

  // Fetch categories
  useEffect(() => {
    if (showModal) fetchCategories();
  }, [showModal]);

  async function fetchCategories() {
    setLoading(true);
    const { data, error } = await supabase
      .from("category")
      .select("*")
      .order("code", { ascending: true });
    if (error) {
      console.error("Error fetching categories:", error.message);
      setCategories([]);
    } else {
      setCategories(data);
    }
    setLoading(false);
  }

  // Filter by name or code
  const filteredList = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Click input to open modal
  const handleInputClick = () => {
    if (formData.distributor) {
      setShowModal(true);
      setSearchTerm("");
    }
  };

  const [activities, setActivities] = useState([]);

  const [step, setStep] = useState(0);

  const handlePrevious = () => {
    const setting = settingsMap[formData.activity];

    if (step === 2 && setting?.sku) {
      setStep(1);
    } else {
      setStep(0);
    }
  };

  const [settingsMap, setSettingsMap] = useState({});
  const fetchActivities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("activity")
      .select("*")
      .order("code", { ascending: true });

    if (error) {
      alert("Error fetching activities: " + error.message);
    } else {
      setActivities(data);
    }
    setLoading(false);
  };

  // Fetch activity settings (e.g., amount_display)
  // In your fetchSettings
  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("activity_settings")
      .select("category,activity_code, sku, accounts,amount_display,various,walk_in");
    if (error) {
      console.error("❌ Error loading settings:", error);
      return;
    }
    const map = {};
    data.forEach((setting) => {
      map[setting.activity_code] = {
        sku: setting.sku === true,
        accounts: setting.accounts === true,
        amount_display: setting.amount_display === true,
        category: setting.category === true,

        various: setting.various === true,
        walk_in: setting.walk_in === true,



      };
    });
    console.log("✅ Settings map loaded:", map);
    setSettingsMap(map);
  };

  // In handleFormChange or wherever formData.activity gets set

  useEffect(() => {
    fetchActivities();
    fetchSettings();
  }, []);

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
    (d) => String(d.code) === String(formData.distributor)
  ) || null;

  if (!selectedDistributor) {
    console.warn("❌ No distributor found for:", formData.distributor);
  }
  const selectedName = selectedDistributor ? selectedDistributor.name : "";

  // Toggle selection of accountType

  const [accountSearchTerm, setAccountSearchTerm] = useState("");
  const [showModal_Account, setShowModal_Account] = useState(false);

  // Get selected account names for display
  // const getAccountNames = () => {
  //   if (!formData.accountType.length) return "";

  //   const selectedNames = accountTypes
  //     .filter((opt) => formData.accountType.includes(opt.code))
  //     .map((opt) => opt.name);

  //   return selectedNames.join(", ");
  // };

  // // Toggle checkbox selection of account types
  // const toggleAccountType = (code) => {
  //   setFormData((prev) => {
  //     const accountType = prev.accountType.includes(code)
  //       ? prev.accountType.filter((c) => c !== code) // remove
  //       : [...prev.accountType, code]; // add
  //     return { ...prev, accountType };
  //   });
  // };

  // Handle changes on form inputs, including distributor change
  // Fixed version of handleFormChange function
  // Fixed version of handleFormChange function

  const shouldShowCategory = () => {
    // ✅ Always show on initial step when activity is not selected
    if (!formData.activity) {
      return true;
    }

    // ❌ Hide if distributor is BAD ORDER
    if (formData.distributorName?.trim().toUpperCase() === "BAD ORDER") {
      return false;
    }

    // ❌ Hide if activity is BAD ORDER (by name or code)
    const selectedActivity = activities.find(
      (act) => act.code === formData.activity
    );

    if (
      selectedActivity &&
      (selectedActivity.name?.toUpperCase().includes("BAD ORDER") ||
        selectedActivity.code === 10007)
    ) {
      return false;
    }

    // ✅ Show only if settingsMap says category is enabled
    return formData?.category === true;
  };




  const [allowCoverToggle, setAllowCoverToggle] = useState(false);

  const handleFormChange = async (e) => {
    const { name, value } = e.target;
    console.log(
      `📝 Form change detected - Field: "${name}", Value: "${value}"`
    );

    // If "distributor" changes, clear rowsAccounts early

    if (name === "distributor") {
      setRowsAccounts([]);
      console.log("🧹 Cleared rowsAccounts due to distributor/accountType change");

      // Find selected distributor by code
      const selectedDistributor = distributors.find(
        (d) => String(d.code) === String(value)
      );

      if (!selectedDistributor) {
        console.warn("⚠️ Distributor not found for code:", value);
      } else {
        console.log(`📦 Selected Distributor:
Code: ${selectedDistributor.code}
Distributor: ${selectedDistributor.name}
Description: ${selectedDistributor.description?.trim() || "N/A"}`);

        console.log(
          `🧾 Mother Accounts Name: ${selectedDistributor.mother_accounts_name ?? "null"}`
        );
        console.log(
          `🧾 Mother Accounts Code: ${selectedDistributor.mother_accounts_code ?? "null"}`
        );

        // Fetch all master_data_list records for this distributor in batches
        (async () => {
          try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            while (hasMore) {
              const { data, error } = await supabase
                .from("master_data_list")
                .select("*")
                .eq("distributor_code", selectedDistributor.code)
                .range(offset, offset + batchSize - 1)
                .order("id", { ascending: true });

              if (error) {
                console.error("❌ Failed to fetch master_data_list:", error);
                break;
              }

              if (data && data.length > 0) {
                allData = [...allData, ...data];
                offset += batchSize;
                hasMore = data.length === batchSize;
              } else {
                hasMore = false;
              }
            }

            if (allData.length === 0) {
              console.warn(`⚠️ No master_data_list records found for distributor_code: ${selectedDistributor.code}`);
              return;
            }

            // ✅ Display all rows as a table in console
            console.group(`📊 master_data_list for distributor_code: ${selectedDistributor.code}`);
            console.table(allData, [
              "id",
              "distributor_code",
              "distributor_name",
              "mother_code",
              "mother_acct",
              "bp_code",
              "bp_name",
              "agent_code",
              "agent_name",
              "group_code",
              "group_name",
              "status",
              "created_at",
              "updated_at"
            ]);
            console.groupEnd();
          } catch (err) {
            console.error("❌ Error fetching master_data_list:", err.message);
          }
        })();
      }
    }



    // Main state update block
    setAllowCoverToggle(true);
    setFormData((prev) => {
      const newForm = { ...prev, [name]: value };

      if (name === "activity") {
        const selectedActivity = activities.find((a) => a.code === value);
        newForm.activityName = selectedActivity?.name || "";
        console.log(
          "🎯 Selected activity:",
          selectedActivity
            ? `${selectedActivity.code} - ${selectedActivity.name}`
            : "Not found"
        );
        console.log("📛 Selected Activity Name:", newForm.activityName);

        if (settingsMap[value]) {
          newForm.sku = settingsMap[value].sku;
          newForm.accounts = settingsMap[value].accounts;
          newForm.amount_display = settingsMap[value].amount_display;
          newForm.category = settingsMap[value].category; // ✅ Add this line
          newForm.various = settingsMap[value].various; // ✅ Add this line
          newForm.walk_in = settingsMap[value].walk_in; // ✅ Add this line


          console.log("🔍 Applied settingsMap values:", {
            sku: newForm.sku,
            accounts: newForm.accounts,
            amount_display: newForm.amount_display,
            various: newForm.various,

            walk_in: newForm.walk_in,

          });
        }
      }

      console.log("📋 Updated formData:", newForm);
      return newForm;
    });

    // 🔄 If distributor changes, fetch related data
    // if (name === "distributor") {
    //   try {
    //     const selectedDistributor = distributors.find(
    //       (d) => d.code === Number(value)
    //     );

    //     if (!selectedDistributor) {
    //       console.warn("⚠️ Distributor not found for code:", value);
    //       setAccountTypes([]);
    //       return;
    //     }

    //     // ✅ Log the selected distributor's name and code
    //     console.log(
    //       `📦 Selected Distributor → Name: ${selectedDistributor.name}, Code: ${selectedDistributor.code}`
    //     );

    //     const isBadOrder = selectedDistributor.name === "BAD ORDER";

    //     setFormData((prev) => ({
    //       ...prev,
    //       distributor: value,
    //       distributorName: selectedDistributor.name || "",
    //       categoryName: isBadOrder ? [] : prev.categoryName,
    //       accountType: isBadOrder ? [] : prev.accountType,
    //     }));

    //     if (isBadOrder) {
    //       console.log("⛔ 'BAD ORDER' selected — skipping category fetch.");
    //       setAccountTypes([]);
    //       return;
    //     }

    //     // 🔄 Fetch categories in batches
    //     const batchSize = 1000;
    //     let allData = [];
    //     let hasMore = true;
    //     let offset = 0;

    //     console.log(
    //       `🔍 Fetching categories for distributor ID: ${selectedDistributor.name}`
    //     );

    //     while (hasMore) {
    //       console.log(
    //         `📥 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`
    //       );

    //       const { data, error } = await supabase
    //         .from("categorydetails")
    //         .select("code, name, description")
    //         .eq("principal_id", selectedDistributor.id)
    //         .order("name", { ascending: true })
    //         .range(offset, offset + batchSize - 1);

    //       if (error) {
    //         console.error("❌ Error during batch fetch:", error);
    //         throw error;
    //       }

    //       console.log(
    //         `✅ Fetched batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`
    //       );

    //       if (data && data.length > 0) {
    //         allData = [...allData, ...data];
    //         offset += batchSize;
    //         hasMore = data.length === batchSize;
    //         console.log(`📊 Total records so far: ${allData.length}`);
    //       } else {
    //         hasMore = false;
    //         console.log("🏁 Finished fetching all category data");
    //       }
    //     }

    //     if (allData.length === 0) {
    //       console.log("⚠️ No categories found for selected distributor");
    //       setAccountTypes([]);
    //       return;
    //     }

    //     const formatted = allData.map((item) => ({
    //       code: item.code,
    //       name: item.name,
    //       description: item.description,
    //     }));
    //     setAllowCoverToggle(true);

    //     setAccountTypes(formatted);
    //     setAccountSearchTerm("");
    //     setFormData((prev) => ({ ...prev, accountType: [] }));

    //     console.log(
    //       `✅ Formatted and set ${formatted.length} account types`
    //     );
    //     console.log("🧹 Cleared previous accountType selection");
    //   } catch (error) {
    //     console.error("❌ Failed to fetch category details:", error.message);
    //     setAccountTypes([]);
    //   }
    // }

  };


  const getFilteredBranchesWithExtras = () => {
    let filtered = branchTypes
      .filter((opt) =>
        opt.name.toLowerCase().includes(branchSearchTerm.toLowerCase())
      )
      .filter((opt) => {
        if (!formData.distributor) return false;

        const distributorCodes = opt.distributor_code
          ? opt.distributor_code.split(",").map((code) => code.trim()).filter(Boolean)
          : [];

        if (Array.isArray(formData.distributor)) {
          return formData.distributor.some((d) => distributorCodes.includes(d));
        }
        return distributorCodes.includes(formData.distributor);
      });

    // ✅ Add "Various" and "Walk In" if enabled in formData
    if (formData.various) {
      filtered.push({
        id: "various",
        name: "Various",
        distributor_code: "N/A",
      });
    }

    if (formData.walk_in) {
      filtered.push({
        id: "walk_in",
        name: "Walk In",
        distributor_code: "N/A",
      });
    }

    // ✅ Sort alphabetically
    return filtered.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  };

  const [rawAmount, setRawAmount] = React.useState(formData.amountbadget || "");

  const formatNumberWithCommas = (num) => {
    if (!num) return "";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleAmountChange = (e) => {
    let value = e.target.value;

    // Remove all commas
    value = value.replace(/,/g, "");

    // Allow only digits (empty string allowed for deletion)
    if (/^\d*$/.test(value)) {
      // Format with commas
      const formattedValue = formatNumberWithCommas(value);
      setRawAmount(formattedValue);
      handleFormChange({ target: { name: "amountbadget", value } }); // Save unformatted value in formData
    }
  };

  // 1st page for SKU

  const UOM_OPTIONS = ["Case", "PC", "IBX"];

  const [rows, setRows] = useState([]);

  const [totals, setTotals] = useState({
    SRP: 0,
    QTY: 0,
    DISCOUNT: 0,
    BILLING_AMOUNT: 0,
    UOMCount: {},
  });

  useEffect(() => {
    const newTotals = rows.reduce(
      (acc, row) => {
        acc.SRP += parseFloat(row.SRP) || 0;
        acc.QTY += parseInt(row.QTY) || 0;
        acc.DISCOUNT += parseFloat(row.DISCOUNT) || 0;
        acc.BILLING_AMOUNT += parseFloat(row.BILLING_AMOUNT) || 0;

        if (row.UOM && UOM_OPTIONS.includes(row.UOM)) {
          acc.UOMCount[row.UOM] = (acc.UOMCount[row.UOM] || 0) + 1;
        }
        return acc;
      },
      { SRP: 0, QTY: 0, DISCOUNT: 0, BILLING_AMOUNT: 0, UOMCount: {} }
    );

    setTotals(newTotals);
  }, [rows]);

  const [rowsAccounts, setRowsAccounts] = useState([]); // Account rows from database or imported data
  const [loadingAccounts, setLoadingAccounts] = useState(false); // Loading state

  // Fetch data from Supabase
  const fetchRowsAccounts = async () => {
    setLoadingAccounts(true);

    const { data, error } = await supabase
      .from("regular_accountlis_badget") // ✅ Correct table name
      .select("*")
      .order("id", { ascending: true }); // Optional, but fine

    if (error) {
      console.error("Error fetching data:", error);
      // Optional: show alert
    } else {
      setRowsAccounts(data); // ✅ Assuming `setRowsAccounts` updates state
    }

    setLoadingAccounts(false);
  };

  useEffect(() => {
    fetchRowsAccounts();
  }, []);

  const [importError, setImportError] = React.useState("");
  const fileInputRefs = useRef(null); // Reference to file input for triggering the file picker

  const handleImportCSV = (file) => {
    if (!file) return;

    setImportError("");

    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const requiredColumns = ["BRANCH_NAME", "BUDGET"];
      const headerRowIndex = data.findIndex((row) =>
        requiredColumns.every((col) => row.includes(col))
      );

      if (headerRowIndex === -1) {
        const errMsg =
          "Oops! The imported file must have columns: BRANCH_NAME and BUDGET.";
        Swal.fire({ icon: "error", title: "Import Error", text: errMsg });
        setImportError(errMsg);
        return;
      }

      const headerRow = data[headerRowIndex];
      const importedRows = data.slice(headerRowIndex + 1);

      const importedBranchNames = importedRows
        .map((row) => row[headerRow.indexOf("BRANCH_NAME")] || "")
        .filter((name) => name !== "");

      const uiBranchNames = branchTypes
        .filter((branch) => formData.branchType.includes(branch.name))
        .map((branch) => branch.name);

      if (importedBranchNames.length !== uiBranchNames.length) {
        const errMsg = `Oops! Imported data row count (${importedBranchNames.length}) does not match the UI table row count (${uiBranchNames.length}).`;
        Swal.fire({ icon: "error", title: "Import Error", text: errMsg });
        setImportError(errMsg);
        return;
      }

      const invalidBranches = importedBranchNames.filter(
        (name) => !uiBranchNames.includes(name)
      );

      if (invalidBranches.length > 0) {
        const errMsg = `Oops! Imported file contains invalid branches not in the UI table: ${invalidBranches.join(
          ", "
        )}`;
        Swal.fire({ icon: "error", title: "Import Error", text: errMsg });
        setImportError(errMsg);
        return;
      }

      // ✅ FIXED: Add account_code field
      const newRows = importedRows.map((row, index) => {
        const branchName = row[headerRow.indexOf("BRANCH_NAME")] || "";
        const budgetValue =
          row[headerRow.indexOf("BUDGET")] !== "" &&
            row[headerRow.indexOf("BUDGET")] !== null
            ? parseFloat(row[headerRow.indexOf("BUDGET")]) || 0
            : 0;

        return {
          id: `import-${index + 1}`,
          account_code: branchName, // ✅ Added
          account_name: branchName,
          budget: budgetValue,
          created_at: new Date().toISOString(),
        };
      });

      console.log("✅ Imported Rows:", newRows);

      setRowsAccounts((prevRows) => {
        const updatedRows = [...prevRows];
        newRows.forEach((newRow) => {
          const existingIndex = updatedRows.findIndex(
            (r) => r.account_code === newRow.account_code
          );
          if (existingIndex !== -1) {
            updatedRows[existingIndex] = newRow;
          } else {
            updatedRows.push(newRow);
          }
        });
        return updatedRows;
      });

      Swal.fire({
        icon: "success",
        title: "Import Successful 🎉",
        text: "Your branch budget data has been successfully imported.",
        timer: 2000,
        showConfirmButton: false,
      });

      setImportError("");
    };

    reader.readAsBinaryString(file);
  };


  const handleExportCSV = () => {
    // 1️⃣ Filter only the selected branches from branchTypes
    const selectedBranches = branchTypes.filter((branch) =>
      formData.branchType.includes(branch.name)
    );

    // 2️⃣ If no branches selected, show alert
    if (selectedBranches.length === 0) {
      alert("No branch selected to export.");
      return;
    }

    // 3️⃣ Prepare export data by matching each selected branch with its budget
    const exportData = selectedBranches.map((branch) => {
      const existingRow =
        rowsAccounts.find((r) => r.account_code === branch.name) || {};
      const budgetValue =
        existingRow.budget !== undefined ? existingRow.budget : 0;

      return {
        BRANCH_NAME: branch.name || "",
        BUDGET: budgetValue.toString(),
      };
    });

    // 4️⃣ Create Excel worksheet + workbook (no total row)
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branch_Budget_Data");

    // 5️⃣ Auto-fit column width (optional, makes it cleaner)
    const columnWidths = [
      { wch: 30 }, // BRANCH_NAME
      { wch: 15 }, // BUDGET
    ];
    worksheet["!cols"] = columnWidths;

    // 6️⃣ Download Excel file
    XLSX.writeFile(workbook, "RegularBranchBudget.xlsx");
  };


  // Handle file change from input
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      handleImportCSV(e.target.files[0]);
    }
  };

  // Trigger file input
  const triggerFileInputs = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("File input ref not found.");
    }
  };



  // Handle drag & drop file import
  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleImportCSV(e.dataTransfer.files[0]);
    }
  };

  // Handle export to Excel

  // Delete row function
  const deleteRowAccounts = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this row?"
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("Regular_AccountLis_badget")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting row:", error);
      alert("Failed to delete row");
    } else {
      fetchRowsAccounts();
    }
  };

  // Handle export to Excel

  const handleCategoryChange = (cat, isSelected) => {
    setFormData((prevData) => {
      let newCodes = [...(prevData.categoryCode || [])];
      let newNames = [...(prevData.categoryName || [])];

      if (isSelected) {
        if (!newCodes.includes(cat.code)) {
          newCodes.push(cat.code);
          newNames.push(cat.name);
        }
      } else {
        newCodes = newCodes.filter((code) => code !== cat.code);
        newNames = newNames.filter((name) => name !== cat.name);
      }

      // Update rows based on codes
      setRows((prevRows) => {
        return newCodes.map((code) => {
          const existingRow = prevRows.find((row) => row.SKUITEM === code);
          return {
            SKUITEM: code,
            SRP: existingRow?.SRP || "",
            QTY: existingRow?.QTY || "",
            UOM: existingRow?.UOM || "",
            DISCOUNT: existingRow?.DISCOUNT || "",
            BILLING_AMOUNT: existingRow?.BILLING_AMOUNT || "",
          };
        });
      });

      // ✅ Log selected categories (code + name)
      console.log("Updated Selected Categories:");
      newCodes.forEach((code, index) => {
        console.log(`Code: ${code}, Name: ${newNames[index]}`);
      });

      return {
        ...prevData,
        categoryCode: newCodes, // This will be saved to DB
        categoryName: newNames, // Only for display
      };
    });
  };

  const updateSelectedCategories = (newCodes, newNames) => {
    console.log("Updated Selected Categories:");
    newCodes.forEach((code, index) => {
      console.log(`Code: ${code}, Name: ${newNames[index]}`);
    });

    setFormData((prevData) => ({
      ...prevData,
      categoryCode: newCodes, // Save codes to DB later
      categoryName: newNames, // Display names only
    }));
  };

  const totalAllocatedBudget = rowsAccounts.reduce(
    (sum, row) => sum + (parseFloat(row.budget) || 0),
    0
  );

  const [remainingBalance, setRemainingBalance] = useState(null);
  const storedUser = localStorage.getItem("loggedInUser");
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;
  const createdBy = parsedUser?.name || "Unknown";

  useEffect(() => {
    const fetchRemainingBalance = async () => {
      if (formData.coverPwpCode && createdBy) {
        const { data, error } = await supabase
          .from("amount_badget")
          .select("remainingbalance")
          .eq("pwp_code", formData.coverPwpCode)
          .eq("createduser", createdBy)
          .eq("Approved", true)
          .order("createdate", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Error fetching remaining balance:", error);
        } else if (data && data.length > 0) {
          setRemainingBalance(data[0].remainingbalance);
        } else {
          setRemainingBalance(0); // or null if you prefer
        }
      }
    };

    fetchRemainingBalance();
  }, [formData.coverPwpCode, createdBy]);

  const [selectedRowIndex, setSelectedRowIndex] = useState(null);

  const [userDistributors, setUserDistributors] = useState([]);
  const [filteredDistributors, setFilteredDistributors] = useState([]);

  const loggedInUsername = parsedUser?.name || "Unknown";
  console.log("[DEBUG] Logged in user:", loggedInUsername);

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

    fetchUserDistributors();
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
        console.log("[DEBUG] All distributors from DB:", data);
        setDistributors(data);

        const allowed = data.filter((dist) =>
          userDistributors.includes(dist.name)
        );
        console.log("[DEBUG] Filtered distributors for dropdown:", allowed);
        setFilteredDistributors(allowed);
      }
    };

    if (userDistributors.length > 0) {
      fetchDistributors();
    }
  }, [userDistributors]);

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

  const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
  const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
  const role = currentUser?.role || "";

  const [categoryListing, setCategoryListing] = useState([]);
  const [activeCategoryCode, setActiveCategoryCode] = useState(null);

  useEffect(() => {
    const fetchCategoryListing = async () => {
      const { data, error } = await supabase
        .from("category_listing")
        .select("*")
        .order("category_code", { ascending: true });

      if (error) {
        console.error("Error fetching category listing:", error.message);
      } else {
        console.log("😎 Data from category_listing:", data);
        setCategoryListing(data);
      }
    };

    fetchCategoryListing();
  }, []);

  const handleCategoryClick = (code) => {
    console.log("🔍 Clicked category:", code);
    setActiveCategoryCode(code);
    setSearchTerm("");
    // optionally open modal if it's not shown yet
    if (!showSkuModal) {
      setShowSkuModal(true);
    }
  };

  // const submitTosku = async () => {

  //     try {
  //         // ✅ Skip submitting if SKU is disabled
  //         if (!formData.sku) {
  //             console.log('🚫 SKU submission skipped (SKU not enabled for this activity).');
  //             return; // Exit early if SKU is not enabled
  //         }

  //         // Prepare rows to submit with defaults
  //         const rowsToSubmit = rows.map(row => ({
  //             sku: row.SKUITEM,
  //             srp: parseFloat(row.SRP) || 0,
  //             qty: parseInt(row.QTY, 10) || 0,
  //             uom: row.UOM || 'CASE',
  //             discount: parseFloat(row.DISCOUNT) || 0,
  //             billing_amount: parseFloat(row.BILLING_AMOUNT) || 0,
  //             regular_code: row.regularpwpcode || generateRegularCode(allRegularPwpCodes),
  //             remarks: formData.remarks || '',
  //         }));

  //         if (rows.length === 1) {
  //             const updatedRow = rowsToSubmit[0];
  //             updatedRow.regular_code = updatedRow.regular_code || generateRegularCode(allRegularPwpCodes);
  //             rowsToSubmit.push(updatedRow);
  //         } else {
  //             const regularCodeForTotals = rowsToSubmit[0].regular_code || 'Total:';
  //             const totalsData = {
  //                 sku: 'Total:',
  //                 srp: totals.SRP.toFixed(2),
  //                 qty: totals.QTY,
  //                 uom: 'EA',
  //                 discount: totals.DISCOUNT.toFixed(2),
  //                 billing_amount: totals.BILLING_AMOUNT.toFixed(2),
  //                 regular_code: regularCodeForTotals,
  //                 remarks: formData.remarks || 'Summary of all entries',
  //             };
  //             rowsToSubmit.push(totalsData);
  //         }

  //         // Removed Swal loading modal here

  //         const { error } = await supabase
  //             .from('regular_sku_listing')
  //             .insert(rowsToSubmit);

  //         if (error) {
  //             throw new Error(error.message);
  //         }

  //         Swal.fire({
  //             title: 'Success!',
  //             text: 'Your data has been successfully submitted to the database.',
  //             icon: 'success',
  //             confirmButtonText: 'Ok',
  //         });

  //     } catch (error) {
  //         Swal.fire({
  //             title: 'Error!',
  //             text: `There was an issue submitting your data: ${error.message}`,
  //             icon: 'error',
  //             confirmButtonText: 'Try Again',
  //         });
  //     }
  // };

  const handleAddCategoryRow = () => {
    setFormData((prev) => ({
      ...prev,
      rowsCategories: [...prev.rowsCategories, { category: "", amount: "" }],
    }));
  };

  const handleCategoryRowChange = (index, field, value) => {
    const updatedRows = [...formData.rowsCategories];
    updatedRows[index][field] = value;
    setFormData((prev) => ({
      ...prev,
      rowsCategories: updatedRows,
    }));
  };

  const handleDeleteCategoryRow = (index) => {
    const updatedRows = formData.rowsCategories.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      rowsCategories: updatedRows,
    }));
  };
  const calculateTotalAmount = () => {
    return formData.rowsCategories.reduce((total, row) => {
      const amount = parseFloat(row.amount);
      return total + (isNaN(amount) ? 0 : amount);
    }, 0);
  };
  const [selectedCategoryRowIndex, setSelectedCategoryRowIndex] =
    useState(null);
  const [BadOrderSearch, setBadOrderSearch] = useState("");
  const [badOrderCategoryList, setBadOrderCategoryList] = useState([]);
  const [categoryMode, setCategoryMode] = useState(null); // 'category' | 'subcategory' | null

  const handleSelectCategory = (cat) => {
    if (selectedCategoryRowIndex !== null) {
      const updatedRows = [...formData.rowsCategories];
      updatedRows[
        selectedCategoryRowIndex
      ].category = `${cat.code} - ${cat.name}`;
      setFormData((prev) => ({ ...prev, rowsCategories: updatedRows }));
      setShowModal(false);
    }
  };

  useEffect(() => {
    if (showModal) {
      BadOrderFetchCategories();
    }
  }, [showModal]);

  const BadOrderFetchCategories = async () => {
    setLoading(true);

    try {
      // 🔧 Get the first row from mapping_category_claims
      const { data: mappingData, error: mappingError } = await supabase
        .from("mapping_category_claims")
        .select("category, subcategory")
        .limit(1);

      if (mappingError) throw mappingError;

      const mapping = mappingData?.[0];

      if (!mapping) {
        console.warn("⚠️ No mapping row found in mapping_category_claims.");
        setCategoryMode(null);
        setBadOrderCategoryList([]);
        setLoading(false);
        return;
      }

      console.log("📌 Mapping flags:", mapping);

      if (mapping.category) {
        setCategoryMode("category");

        const { data, error } = await supabase
          .from("category_listing")
          .select("id, name, sku_code, category_code, description")
          .order("name", { ascending: true });

        if (error) throw error;

        setBadOrderCategoryList(data || []);
      } else if (mapping.subcategory) {
        setCategoryMode("subcategory");

        const { data, error } = await supabase
          .from("claims_listing")
          .select("id, name, code, description")
          .order("name", { ascending: true });

        if (error) throw error;

        setBadOrderCategoryList(data || []);
      } else {
        console.warn("⚠️ Both category and subcategory are false.");
        setCategoryMode(null);
        setBadOrderCategoryList([]);
      }
    } catch (error) {
      console.error(
        "❌ Error fetching categories/subcategories:",
        error.message
      );
      setCategoryMode(null);
      setBadOrderCategoryList([]);
    }

    setLoading(false);
  };

  const filtered = badOrderCategoryList.filter(
    (cat) =>
      cat.name.toLowerCase().includes(BadOrderSearch.toLowerCase()) ||
      cat.code.toLowerCase().includes(BadOrderSearch.toLowerCase())
  );

  const toNumber = (val) => {
    if (val === null || val === undefined || val === "") return 0;
    return Number(val) || 0;
  };

  // 🔹 Handle SKU Insert
  const handleSku = async () => {
    setLoading(true);
    setMessage("");

    try {
      // Flatten SKUs from all accounts
      const allRows = Object.keys(accountSkuRows).flatMap((accountCode) =>
        (accountSkuRows[accountCode] || []).map((row) => {
          const account = accountTypes.find((acc) => acc.code === accountCode);

          const srp = toNumber(row.SRP);
          const qty = toNumber(row.QTY);
          const discountValue = toNumber(row.DISCOUNT); // 💰 Peso discount

          const billingAmount = srp * qty; // before discount
          const totalAmount = billingAmount - discountValue;

          return {
            account_name: account?.name || accountCode,
            sku_code: row.SKUITEM ?? null,
            srp,
            qty,
            uom: row.UOM?.trim() ? row.UOM : "pc",
            billing_amount: billingAmount,
            discount: discountValue, // 💰 Save as peso value
            total_amount: totalAmount,
            remaining_balance: 0, // placeholder
            regular_code:
              formData.regularpwpcode ||
              generateRegularCode(allRegularPwpCodes),
            created_at: new Date().toISOString(),
          };
        })
      );

      if (!allRows.length) {
        setMessage("⚠️ No SKUs to submit.");
        setLoading(false);
        return;
      }

      // ✅ Compute totals
      const totalBilling = allRows.reduce(
        (sum, r) => sum + r.billing_amount,
        0
      );
      const totalDiscount = allRows.reduce((sum, r) => sum + r.discount, 0);
      const grandTotal = totalBilling - totalDiscount;

      const selected = parseFloat(selectedBalance || 0);
      const creditBudget = parseFloat(formData?.amountbadget || 0);
      const remainingSkuBudget = selected - grandTotal - creditBudget;

      // ✅ Attach consistent totals to every row
      const rowsWithTotals = allRows.map((r) => ({
        ...r,
        total_amount: r.total_amount,
        remaining_balance: remainingSkuBudget,
      }));

      const regularpwpcode =
        formData.regularpwpcode || generateRegularCode(allRegularPwpCodes);

      // ✅ Step 1: Insert SKUs into regular_sku
      const { error: insertError } = await supabase
        .from("regular_sku")
        .insert(rowsWithTotals);

      if (insertError) throw insertError;

      console.log("✅ Inserted SKUs:", rowsWithTotals);

      // ✅ Step 2: Upsert into regular_pwp
      await upsertRegularPwp(
        supabase,
        regularpwpcode,
        remainingSkuBudget,
        grandTotal
      );

      setMessage("✅ SKUs submitted and regular_pwp updated successfully!");
    } catch (err) {
      console.error("❌ Submit error:", err.message);
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Function to insert/update into regular_pwp
  // ✅ Function to insert/update into regular_pwp
  async function upsertRegularPwp(
    supabase,
    regularpwpcode,
    remainingSkuBudget,
    totalAmount
  ) {
    try {
      const { data: existingPwp, error: fetchError } = await supabase
        .from("regular_pwp")
        .select("id")
        .eq("regularpwpcode", regularpwpcode)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingPwp) {
        const { error: updateError } = await supabase
          .from("regular_pwp")
          .update({
            remaining_balance: remainingSkuBudget,
            credit_budget: totalAmount,
          })
          .eq("id", existingPwp.id);

        if (updateError) throw updateError;
        console.log("🔁 Updated regular_pwp:", existingPwp.id);
      } else {
        const { error: insertError } = await supabase
          .from("regular_pwp")
          .insert([
            {
              regularpwpcode,
              remaining_balance: remainingSkuBudget,
              credit_budget: totalAmount,
            },
          ]);

        if (insertError) throw insertError;
        console.log("🆕 Inserted new regular_pwp:", regularpwpcode);
      }
    } catch (err) {
      console.error("❌ Upsert regular_pwp error:", err.message);
      throw err;
    }
  }

  const postBadOrderCategories = async () => {
    if (!formData.regularpwpcode) {
      alert("PWP Code is missing.");
      return false;
    }

    if (formData.rowsCategories.length === 0) {
      alert("No bad order categories to submit.");
      return false;
    }

    // Calculate total amount of bad order categories
    const totalAmount = formData.rowsCategories.reduce((sum, row) => {
      return sum + (parseFloat(row.amount) || 0);
    }, 0);

    const safeSelectedBalance = isNaN(selectedBalance) ? 0 : selectedBalance;
    const amountBadgetMinusTotal = safeSelectedBalance - totalAmount;

    console.log("✅ Amountbadget - Total Amount:", amountBadgetMinusTotal);
    console.log("✅ Amount Budget:", totalAmount || 0);

    // Build rows to insert
    const rowsToInsert = formData.rowsCategories.map((row) => ({
      code_pwp: formData.regularpwpcode,
      category: row.category,
      amount: parseFloat(row.amount) || 0,
      remarks: formData.remarks || "",
      created_at: new Date().toISOString(),
      total: totalAmount,
      remaining_budget: amountBadgetMinusTotal, // <- Use this value
    }));

    try {
      const { data, error } = await supabase
        .from("regular_badorder")
        .insert(rowsToInsert);

      if (error) {
        throw error;
      }

      console.log("✅ Bad order categories submitted successfully:", data);

      // ✅ Update or insert into regular_pwp as well
      await upsertRegularPwp(
        supabase,
        formData.regularpwpcode,
        amountBadgetMinusTotal,
        totalAmount
      );

      return true;
    } catch (error) {
      console.error("❌ Error submitting bad order categories:", error.message);
      alert(`Error submitting bad order categories: ${error.message}`);
      return false;
    }
  };

  // 🔹 Handle All Submissions (SKU + Form + Budgets)
  const submit_all = async (e) => {
    e.preventDefault();

    try {
      // Show loading modal
      await Swal.fire({
        title: "Submitting...",
        html: "Please wait while we save your data.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        timer: 3000,
        timerProgressBar: true,
      });

      // Step 1: Save SKUs

      // Step 2: Save Form Data + Attachments
      console.log(
        `[${new Date().toLocaleString()}] 📝 Submitting form data...`
      );
      await handleSubmitFormAndAttachments();
      console.log(`[${new Date().toLocaleString()}] ✅ Form data submitted.`);

      console.log(`[${new Date().toLocaleString()}] 📝 Submitting SKUs...`);
      await handleSku();
      console.log(`[${new Date().toLocaleString()}] ✅ SKUs submitted.`);

      // 🔍 Only submit Bad Order data if activity is "BAD ORDER"
      if (formData.activityName === "BAD ORDER") {
        const badorderSuccess = await postBadOrderCategories();
        if (!badorderSuccess) return;
      }

      // Step 3: Save Budget Data
      // Step 3: Save Budget Data
      console.log(
        `[${new Date().toLocaleString()}] 💾 Saving budget data to Supabase...`
      );

      const filteredRows = rowsAccounts.filter((row) =>
        (formData.branchType || []).includes(row.account_name) // ✅ match by name only
      );

      const totalBudget = filteredRows
        .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0)
        .toFixed(2);

      const budgetRowsToInsert = filteredRows.map((row) => ({
        regularcode: formData.regularpwpcode,
        account_name: row.account_name, // ✅ only name
        budget: row.budget || 0,
        created_at: row.created_at || new Date().toISOString(),
        createform: "ADMINISTRATOR",
        total_budget: totalBudget,
      }));

      if (budgetRowsToInsert.length > 0) {
        const { data, error } = await supabase
          .from("regular_accountlis_badget")
          .insert(budgetRowsToInsert);

        if (error) throw error;

        console.log(
          `[${new Date().toLocaleString()}] ✅ Budget data saved:`,
          data
        );
      } else {
        console.log(
          `[${new Date().toLocaleString()}] ℹ️ No budget rows to insert.`
        );
      }


      // Success Modal
      await Swal.fire({
        title: "Success!",
        text: "Your data has been successfully submitted and saved.",
        icon: "success",
        confirmButtonText: "Ok",
      });

      window.location.reload();
    } catch (error) {
      console.error(
        `[${new Date().toLocaleString()}] ❌ Submit All Error:`,
        error
      );
      Swal.fire({
        title: "Error!",
        text: `There was an issue submitting your data: ${error.message}`,
        icon: "error",
        confirmButtonText: "Try Again",
      });
    }
  };


  // Convert file to base64 string
  // Convert file to base64 string (with Data URL)
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file); // includes "data:<type>;base64,..." prefix
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  // Submit main form and attachments
  const handleSubmitFormAndAttachments = async () => {
    try {
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const createdBy = parsedUser?.name || "Unknown";

      // ✅ Required validation
      if (!formData.regularpwpcode?.trim()) {
        throw new Error("Regular PWP Code is required.");
      }

      // ✅ Validate distributor
      let distributorCode = formData.distributor?.trim() || null;
      if (distributorCode) {
        const { data: distributorsData, error: distributorError } = await supabase
          .from("distributors")
          .select("code")
          .eq("code", distributorCode)
          .single();
        if (distributorError || !distributorsData) {
          throw new Error(`Distributor code "${distributorCode}" is invalid.`);
        }
      }

      // ✅ Calculate budgets
      const amountBudget = parseFloat(formData.amountbadget || 0);
      const billingAmountSKU = rows.reduce((acc, row) => acc + (parseFloat(row.BILLING_AMOUNT) || 0), 0);
      const totalAllocatedFromAccounts = rowsAccounts.reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);
      const creditBudget = amountBudget || billingAmountSKU || totalAllocatedFromAccounts;
      const remainingBalance = selectedBalance !== null ? selectedBalance - creditBudget : null;

      // ✅ Convert accountType IDs → names
      let convertedAccountType = [];
      if (Array.isArray(formData.accountType)) {
        convertedAccountType = formData.accountType
          .map((id) => Object.values(subAccounts).flat().find((s) => s.id === id)?.name)
          .filter(Boolean);
      } else if (formData.accountType) {
        const name = Object.values(subAccounts).flat().find((s) => s.id === formData.accountType)?.name;
        convertedAccountType = name ? [name] : [];
      }

      // ✅ Prepare main submission object
      const submissionData = {
        regularpwpcode: formData.regularpwpcode,
        accountType: convertedAccountType,
        branchType: formData.branchType || [],
        activity: formData.activity,
        pwptype: formData.pwptype || "Regular",
        notification: formData.notification,
        objective: formData.objective,
        promoScheme: formData.promoScheme,
        activityDurationFrom: formData.activityDurationFrom,
        activityDurationTo: formData.activityDurationTo,
        isPartOfCoverPwp: formData.isPartOfCoverPwp,
        coverPwpCode: formData.coverPwpCode,
        distributor: distributorCode,
        amountbadget: formData.amountbadget,
        categoryCode: formData.categoryCode || [],
        categoryName: formData.categoryName || [],
        sku: formData.sku,
        accounts: formData.accounts,
        amount_display: formData.amount_display,
        remarks: formData.remarks || "",
        created_at: new Date().toISOString(),
        createForm: createdBy,
        credit_budget: creditBudget,
        remaining_balance: remainingBalance,
      };

      // ✅ Insert main form
      const { error: formInsertError } = await supabase.from("regular_pwp").insert([submissionData]).select();
      if (formInsertError) throw new Error(`Form Insert failed: ${formInsertError.message}`);

      // ✅ Insert attachments (Base64, downloadable later)
      if (files.length > 0) {
        await Promise.all(
          files.map(async (file) => {
            const base64String = await toBase64(file); // includes Data URL
            const attachmentPayload = {
              regularpwpcode: formData.regularpwpcode,
              filename: file.name,
              mimetype: file.type,
              size: file.size,
              file_data: base64String,
            };
            const { error: attachmentError } = await supabase
              .from("regular_attachments")
              .insert([attachmentPayload])
              .select();
            if (attachmentError) {
              throw new Error(`Attachment insert failed for ${file.name}: ${attachmentError.message}`);
            }
          })
        );
      }

      // ✅ Reset form state
      setFiles([]);
      setRows([]);
      setRowsAccounts([]);
      setFormData({
        regularpwpcode: "",
        accountType: [],
        branchType: [],
        activity: "",
        pwptype: "Regular",
        notification: false,
        objective: "",
        promoScheme: "",
        activityDurationFrom: new Date().toISOString().split("T")[0],
        activityDurationTo: new Date().toISOString().split("T")[0],
        isPartOfCoverPwp: false,
        coverPwpCode: "",
        distributor: "",
        amountbadget: "0",
        categoryCode: [],
        categoryName: [],
        sku: null,
        accounts: null,
        amount_display: null,
        remarks: "",
      });

      Swal.fire("Success!", "Form and attachments submitted successfully!", "success");
    } catch (error) {
      console.error("Submission Error:", error.message);
      Swal.fire("Error", error.message, "error");
    }
  };



  const saveRecentActivity = async ({ UserId }) => {
    try {
      // 1. Get public IP
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const { ip } = await ipRes.json();

      // 2. Get geolocation info
      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geo = await geoRes.json();

      // 3. Build activity entry
      const activity = {
        Device: navigator.userAgent || "Unknown Device",
        Location: `${geo.city || "Unknown"}, ${geo.region || "Unknown"}, ${geo.country_name || "Unknown"
          }`,
        IP: ip,
        Time: new Date().toISOString(),
        Action: "Create Form Regular PWP",
      };

      // 4. Save to Supabase only
      const { error } = await supabase.from("RecentActivity").insert([
        {
          userId: UserId,
          device: activity.Device,
          location: activity.Location,
          ip: activity.IP,
          time: activity.Time,
          action: activity.Action,
        },
      ]);

      if (error) {
        console.error("❌ Supabase insert error:", error.message);
      } else {
        console.log("✅ Activity saved to Supabase");
      }
    } catch (err) {
      console.error("❌ Failed to log activity:", err.message || err);
    }
  };

  const [message, setMessage] = useState("");

  // Handle Excel Import

  // Trigger hidden file input
  const triggerFileInput = () => {
    if (window.excelInput) {
      window.excelInput.click();
    }
  };


  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const importedData = results.data.map((row) => ({
          SKUITEM: row.SKU || "",
          SRP: parseFloat(row.SRP) || 0,
          QTY: parseInt(row.QTY) || 0,
          UOM: row.UOM || "PC",
          DISCOUNT: parseFloat(row["Discount %"]) || 0,
        }));

        setRows(importedData);
        alert("✅ Import successful! Data loaded into table.");
      },
    });
  };

  const handleExport = () => {
    if (!accountSkuRows || Object.keys(accountSkuRows).length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No Data to Export",
        text: "There is no data available for export.",
      });
      return;
    }

    // ✅ Combine all branches into one export array (no totals, no SKUITEM)
    let exportData = [];

    Object.keys(accountSkuRows).forEach((branchName) => {
      const branchRows = accountSkuRows[branchName] || [];
      branchRows.forEach((row) => {
        exportData.push({
          BRANCH_NAME: branchName,
          SRP: row.SRP || 0,
          QTY: row.QTY || 0,
          UOM: row.UOM || "PC",
          DISCOUNT: row.DISCOUNT || 0,

        });
      });
    });

    if (exportData.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Empty Data",
        text: "No records found to export.",
      });
      return;
    }

    // ✅ Convert JSON to Excel worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branch_Data");

    // ✅ Create Excel file and trigger download
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });
    saveAs(blob, "Branch_Export.xlsx");

    Swal.fire({
      icon: "success",
      title: "Export Successful 🎉",
      text: "Your branch data has been exported to Excel.",
      timer: 2000,
      showConfirmButton: false,
    });
  };

  const [tabs, setTabs] = useState([]);

  const handleAccountSkuChange = (value) => {
    setSelectedAccountForSku(value);

    if (value && !tabs.includes(value)) {
      setTabs((prev) => [...prev, value]); // add new tab if not already added
    }
  };






  const [subAccounts, setSubAccounts] = useState({});
  const [selectedMother, setSelectedMother] = useState(null);
  const [subSearchTerm, setSubSearchTerm] = useState("");
  const [selectedBranchForSku, setSelectedBranchForSku] = useState("ALL_BRANCHES");

  const [showModal_Branch, setShowModal_Branch] = useState(false);

  const [branchTypes, setBranchTypes] = useState([]);
  const [branchSearchTerm, setBranchSearchTerm] = useState("");

  // Fetch mother accounts when modal opens
  useEffect(() => {
    if (showModal_Account) fetchAccounts();
  }, [showModal_Account]);
  const fetchAccounts = async () => {
    try {
      // Fetch all data from user_savemotheraccount_link
      const { data, error } = await supabase
        .from("user_savemotheraccount_link")
        .select("mother_account_id, mother_account_code, mother_account_name, username")
        .order("mother_account_name", { ascending: true });

      if (error) throw error;

      // Get logged-in user
      const loggedInUsername = parsedUser?.name || "Unknown";
      console.log("[DEBUG] Logged in user:", loggedInUsername);

      // Filter results by username
      const filteredData = data.filter(
        (item) => item.username === loggedInUsername
      );

      // Format to match your UI structure
      const formattedData = filteredData.map((item) => ({
        id: item.mother_account_id, // ✅ use mother_account_id as ID
        code: item.mother_account_code,
        name: item.mother_account_name,
      }));

      // Save to state for display
      setAccountTypes(formattedData);

      console.log("✅ Mother Accounts for user:", loggedInUsername);
      console.table(
        formattedData.map((item) => ({
          ID: item.id,
          Code: item.code,
          Name: item.name,
        }))
      );
    } catch (err) {
      console.error("❌ Error fetching accounts:", err.message);
    }
  };



  const fetchSubAccounts = async (mother) => {
    try {
      setSelectedMother(mother);

      // prevent duplicate fetch
      if (subAccounts[mother.id]) return;

      console.log("🟡 Fetching sub-accounts for mother:", mother);

      const batchSize = 1000;
      let allData = [];
      let hasMore = true;
      let offset = 0;

      // 🔁 Fetch all batches
      while (hasMore) {
        console.log(
          `📥 Fetching master_data_list batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`
        );

        const { data, error } = await supabase
          .from("master_data_list")
          .select(
            `id, mother_acct, mother_code, group_code, agent_name, agent_code, distributor_name, distributor_code`
          )
          .eq("group_code", mother.code)
          .order("mother_acct")
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error("❌ Supabase error:", error);
          Swal.fire("Error", "Failed to fetch master data list", "error");
          break;
        }

        console.log(
          `✅ Fetched batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0
          } records`
        );

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
          console.log(`📊 Total records so far: ${allData.length}`);
        } else {
          hasMore = false;
        }
      }

      if (!allData.length) {
        console.warn(`⚠️ No records found for group_code ${mother.code}`);
        return;
      }

      // --- clean + normalize strings safely ---
      const safeLower = (val) =>
        typeof val === "string" ? val.trim().toLowerCase() : String(val ?? "").toLowerCase();

      const loggedInUsername = safeLower(parsedUser?.name);
      const loggedInUserID = safeLower(parsedUser?.UserID);
      const selectedDistributorName = safeLower(selectedDistributor?.name);
      const selectedDistributorCode = safeLower(selectedDistributor?.code);

      console.log("[DEBUG] Logged in user:", loggedInUsername);
      console.log("[DEBUG] Logged in UserID:", loggedInUserID);
      console.log("Distributor_Name:", selectedDistributorName);
      console.log("Distributor_Code:", selectedDistributorCode);

      // ✅ Filter by distributor + agent
      const filteredData = allData.filter((item) => {
        const distributorName = safeLower(item.distributor_name);
        const distributorCode = safeLower(item.distributor_code);
        const agentName = safeLower(item.agent_name);
        const agentCode = safeLower(item.agent_code);

        const distributorMatch =
          distributorName === selectedDistributorName ||
          distributorCode === selectedDistributorCode;

        const agentMatch =
          agentName === loggedInUsername || agentCode === loggedInUserID;

        return distributorMatch && agentMatch;
      });

      if (filteredData.length === 0) {
        console.warn("⚠️ No matching data for this distributor and user.");
        console.table(allData);
        return;
      }

      // ✅ Remove duplicates (unique mother_acct + mother_code)
      const uniqueData = Array.from(
        new Map(
          filteredData.map((item) => [
            `${safeLower(item.mother_acct)}_${safeLower(item.mother_code)}`,
            item,
          ])
        ).values()
      );

      // ✅ Format for display
      const formattedData = uniqueData.map((item) => ({
        id: item.id,
        name: `${item.mother_acct ?? ""} (${item.mother_code ?? ""})`,
        code: item.mother_code ?? "",
      }));

      console.log(`[✅ INFO] Displaying ${formattedData.length} master_data_list record(s):`);
      console.table(formattedData);

      setSubAccounts((prev) => ({ ...prev, [mother.id]: formattedData }));
    } catch (err) {
      console.error("❌ Unexpected error fetching master_data_list:", err);
    }
  };



  const fetchBranches = async (motherAccountCode) => {
    try {
      console.log(`🔍 Fetching branches for Mother Account Code: ${motherAccountCode}`);

      const batchSize = 1000;
      let allData = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        console.log(`📥 Fetching branches batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`);

        const { data, error } = await supabase
          .from("master_data_list")
          .select("*")
          .eq("mother_code", motherAccountCode) // ✅ Match mother_code column
          .not("bp_name", "is", null) // Filter only records with bp_name
          .range(offset, offset + batchSize - 1);

        console.log(`✅ Fetched branches batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`);

        if (error) {
          console.error("❌ Supabase error:", error);
          Swal.fire("Error", "Failed to fetch branches", "error");
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
          console.log(`📊 Total branch records so far: ${allData.length}`);
        } else {
          hasMore = false;
        }
      }

      // Extract unique branches based on bp_name
      const uniqueBranches = [];
      const seen = new Set();

      allData.forEach((row) => {
        const branchName = row.bp_name?.trim();
        if (branchName && !seen.has(branchName)) {
          seen.add(branchName);
          uniqueBranches.push({
            id: row.id,
            name: branchName,
            code: row.bp_code || "",
            description: row.bp_code || "",
            status: row.status,
            distributor_code: row.distributor_code,
            created_at: row.created_at,
          });
        }
      });

      setBranchTypes(uniqueBranches);

      console.group(`🏢 Branches fetched for Mother Account Code: ${motherAccountCode}`);
      console.log(`🎉 Finished fetching all branches: ${allData.length} total records`);
      console.log(`✨ Unique branches (bp_name): ${uniqueBranches.length}`);
      console.table(uniqueBranches);
      console.groupEnd();
    } catch (err) {
      console.error("❌ Error fetching branches:", err.message);
      Swal.fire("Error", err.message, "error");
    }
  };






  const toggleBranchType = (code) => {
    const updated = formData.branchType.includes(code)
      ? formData.branchType.filter((c) => c !== code)
      : [...formData.branchType, code];
    setFormData({ ...formData, branchType: updated });

    console.log("Selected mother account:", selectedMother?.name, selectedMother?.code);
    console.log(
      "Selected branches:",
      updated.map((c) => {
        const found = branchTypes.find((b) => b.code === c);
        return found ? `${found.name} (${found.code})` : c;
      })
    );
  };

  const getBranchNames = () => {
    return formData.branchType
      .map((code) => {
        const found = branchTypes.find((b) => b.code === code);
        return found ? { code: found.code, name: found.name } : { code, name: code };
      })
      .map(({ code, name }) => (
        <span
          key={code}
          style={{
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: "#0050a5ff",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: "5px",
            fontSize: "14px",
            marginRight: "5px",
          }}
        >
          {name}
          <span
            onClick={(e) => {
              e.stopPropagation();
              setFormData({
                ...formData,
                branchType: formData.branchType.filter((c) => c !== code),
              });
            }}
            style={{
              marginLeft: "5px",
              cursor: "pointer",
              fontWeight: "bold",
              color: "#fff",
              backgroundColor: "#ff4d4f",
              borderRadius: "5%",
              width: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
          >
            ✖
          </span>
        </span>
      ));
  };



  const [showBranchInput, setShowBranchInput] = useState(true);

  console.log("Distributor_Name:", selectedDistributor?.name);
  console.log("Distributor_Code:", selectedDistributor?.code);

  const motherAccountCodes =
    selectedDistributor?.mother_accounts_code
      ?.split(",")
      .map((code) => code.trim())
      .filter((code) => code !== "") || [];

  console.log("🧾 Raw mother_accounts_code:", selectedDistributor?.mother_accounts_code);



  const [selectedBranchName, setSelectedBranchName] = useState(null);

  const updateRowSku = (branchCode, rowIndex, updatedRow) => {
    setAccountSkuRows((prevRows) => {
      const currentRows = [...(prevRows[branchCode] || [])];
      currentRows[rowIndex] = {
        ...currentRows[rowIndex],
        ...updatedRow,
      };

      return {
        ...prevRows,
        [branchCode]: currentRows,
      };
    });
  };


  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          // ...inside the Step 0 case in renderStepContent function:

          <div>
            <form onSubmit={submit_all}>
              <div
                style={{ padding: "30px", overflowX: "auto" }}
                className="containers"
              >
                <div className="row align-items-center mb-4">
                  <div className="col-12 col-md-6">
                    <div
                      className="card p-4 animate-fade-slide-up shadow-sm"
                      style={{
                        background:
                          "linear-gradient(135deg,rgb(11, 48, 168), #d9edf7)", // gentle blue gradient
                        borderRadius: "12px",
                        border: "1px solid #99cfff",
                        color: "#ffff",
                        boxShadow: "0 4px 8px rgba(26, 62, 114, 0.15)",
                      }}
                    >
                      <h3
                        className="mb-0"
                        style={{
                          fontWeight: "700",
                          letterSpacing: "2px",
                          textTransform: "uppercase",
                          fontFamily:
                            "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                          textShadow: "1px 1px 2px rgba(26, 62, 114, 0.3)",
                        }}
                      >
                        Regular PWP
                      </h3>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 text-md-end pt-3 pt-md-0">
                    <h2
                      className="fw-bold mb-0"
                      style={{
                        letterSpacing: "1px",
                        fontSize: "24px",
                        textAlign: "right",
                        color: "red", // This ensures the whole <h2> is red
                      }}
                    >
                      <span
                        className={
                          formData.regularpwpcode ? "text-danger" : "text-muted"
                        }
                      >
                        {loadingRegularPwpCodes
                          ? "Generating..."
                          : formData.regularpwpcode ||
                          generateRegularCode(allRegularPwpCodes)}
                      </span>
                    </h2>
                  </div>
                </div>
              </div>
              <div className="row g-3">
                {/* Distributor */}
                <div className="col-md-4" style={{ position: "relative" }}>
                  <label>
                    Distributor<span style={{ color: "red" }}>*</span>
                  </label>

                  <select
                    name="distributor"
                    className="form-control"
                    value={formData.distributor}
                    onChange={(e) => {
                      handleFormChange(e); // keep your existing handler

                      const selected = filteredDistributors.find(
                        (dist) => dist.code === e.target.value
                      );

                      if (selected) {
                        console.log(`Code: ${selected.code}`);
                        console.log(`Distributor: ${selected.name}`);
                      } else {
                        console.log("⚠️ No distributor selected or found.");
                      }

                      // ✅ Reset related data when distributor changes
                      setSelectedMother(null);
                      setFormData((prev) => ({
                        ...prev,
                        accountType: selectedMother?.name === "NON-CHAIN" ? [] : null,
                      }));
                      setShowBranchInput(false);
                      setSubAccounts({});
                    }}
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


                  <span
                    style={{
                      position: "absolute",
                      right: "20px",
                      top: "70%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#555",
                      fontSize: "14px",
                      userSelect: "none",
                    }}
                  >
                    ▼
                  </span>

                  {formData.distributor && (
                    <span
                      style={{
                        position: "absolute",
                        right: "40px",
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


                {/* Account Type */}

                {/* // ============================
                                // Activity + Amount Budget
                                // ============================ */}

                {/* Activity */}
                <div className="col-md-4" style={{ position: "relative" }}>
                  <label>
                    Activity <span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    name="activity"
                    className="form-control"
                    value={formData.activity}
                    onChange={handleFormChange}
                  >
                    <option value="">Select Activity</option>
                    {activities
                      .filter(
                        (opt) =>
                          opt.name === "BUNDLING / TIE UP" ||
                          opt.name === "LISTING FEE" ||
                          opt.name === "DISPLAY ALLOWANCE" ||
                          opt.name === "DISTRIBUTION" ||
                          opt.name === "TRADE DEALS" ||
                          opt.name === "LISTING FEE" ||
                          opt.name === "ANNIVERSARY SUPPORT" ||
                          opt.name === "CHRISTMAS SUPPORT" ||
                          opt.name === "OPENING SUPPORT" ||
                          opt.name === "SPONSORSHIPS" ||
                          opt.name === "LOGISTIC" ||
                          opt.name === "FREIGHT" ||
                          opt.name === "MERCHANDISER IN-HOUSE SALARYT" ||
                          opt.name === "MERCHANDISER/DISER PENALTY" ||
                          opt.name === "STORE EXPENSE" ||
                          opt.name === "TRADE DISCOUNT SHARING" ||
                          opt.name === "TARGET INCENTIVE" ||
                          opt.name === "VOLUME INCENTIVE" ||
                          opt.name === "SALES REBATES" ||
                          opt.name === "PAYOLA ADMIN" ||
                          opt.name === "PAYOLA DELIVERY" ||
                          opt.name === "PAYOLA SELLING"
                      )
                      .map((opt, index) => (
                        <option key={index} value={opt.code}>
                          {opt.name}
                        </option>
                      ))}
                  </select>

                  {/* Dropdown arrow */}
                  <span
                    style={{
                      position: "absolute",
                      right: "20px",
                      top: "70%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#555",
                      fontSize: "14px",
                      userSelect: "none",
                    }}
                  >
                    ▼
                  </span>

                  {/* Checkmark */}
                  {formData.activity && (
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

                {shouldShowCategory() && (
                  <div className="col-md-4" style={{ position: "relative" }}>
                    <label>
                      Category <span style={{ color: "red" }}>*</span>
                    </label>

                    <div
                      onClick={() => setShowModal(true)}
                      style={{
                        cursor: "pointer",
                        minHeight: "40px",
                        border: "1px solid",
                        borderColor: formData.categoryName?.length > 0 ? "green" : "#ffffffff",
                        borderRadius: "4px",
                        padding: "5px 35px 5px 8px",
                        overflowX: "auto",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "border-color 0.3s",
                        scrollbarWidth: "none", // Firefox
                        msOverflowStyle: "none", // IE 10+
                        backgroundColor: "#fff",  // <-- Added white background
                      }}
                      onWheel={(e) => {
                        // enable horizontal scroll with mouse wheel
                        const container = e.currentTarget;
                        container.scrollLeft += e.deltaY;
                      }}
                    >
                      {/* Tags */}
                      {formData.categoryName?.length > 0 ? (
                        formData.categoryName.map((name, idx) => (
                          <span
                            key={name}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              backgroundColor: "#0050a5ff",
                              color: "#fff",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              fontSize: "14px",
                              flexShrink: 0,
                            }}
                          >
                            {name}
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                const updatedNames = [...formData.categoryName];
                                const updatedCodes = [...formData.categoryCode];
                                updatedNames.splice(idx, 1);
                                updatedCodes.splice(idx, 1);

                                setFormData({
                                  ...formData,
                                  categoryName: updatedNames,
                                  categoryCode: updatedCodes,
                                });
                              }}
                              style={{
                                marginLeft: "5px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                color: "#fff",
                                backgroundColor: "#ff4d4f",
                                borderRadius: "5%",
                                width: "16px",
                                height: "16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                              }}
                            >
                              ✖
                            </span>
                          </span>
                        ))
                      ) : (
                        <span style={{ color: "#999" }}>Select Categories</span>
                      )}
                    </div>


                    {/* 🔍 Magnifying Glass */}
                    <span
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        color: "#555",
                        fontSize: "18px",
                        userSelect: "none",
                      }}
                    >
                      🔍
                    </span>

                    {/* ✓ Checkmark */}
                    {formData.categoryName?.length > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          right: "35px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "green",
                          fontWeight: "bold",
                          fontSize: "22px",
                          pointerEvents: "none",
                          userSelect: "none",
                        }}
                      >
                        ✓
                      </span>
                    )}

                    {/* Modal */}
                    <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
                      <Modal.Header
                        closeButton
                        style={{ background: "#4689a6", color: "white" }}
                      >
                        <Modal.Title style={{ width: "100%", textAlign: "center" }}>
                          Select Categories
                        </Modal.Title>
                      </Modal.Header>
                      <Modal.Body>
                        <input
                          type="text"
                          className="form-control mb-3"
                          placeholder="Search category by name or code..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />

                        {loading ? (
                          <p>Loading categories...</p>
                        ) : (
                          <ul
                            className="list-group"
                            style={{ maxHeight: "300px", overflowY: "auto" }}
                          >
                            {filteredList.length > 0 ? (
                              filteredList.map((cat) => {
                                const isChecked = formData.categoryCode?.includes(cat.code);

                                return (
                                  <li
                                    key={cat.id}
                                    className="list-group-item d-flex justify-content-between align-items-center"
                                  >
                                    <div className="form-check">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`cat-check-${cat.id}`}
                                        checked={isChecked}
                                        onChange={(e) =>
                                          handleCategoryChange(cat, e.target.checked)
                                        }
                                        style={{
                                          width: "20px",
                                          height: "20px",
                                          transform: "scale(1.3)",
                                          cursor: "pointer",

                                        }}
                                      />
                                      <label
                                        className="form-check-label"
                                        htmlFor={`cat-check-${cat.id}`}
                                        style={{ marginLeft: '5px' }}
                                      >
                                        {cat.name} <strong style={{ color: '#fff' }}>{cat.code}</strong>
                                      </label>
                                    </div>
                                  </li>
                                );
                              })
                            ) : (
                              <li className="list-group-item text-muted">
                                No categories found
                              </li>
                            )}
                          </ul>
                        )}
                      </Modal.Body>
                      <Modal.Footer
                        style={{ display: "flex", justifyContent: "space-between" }}
                      >
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="btn btn-success"
                            onClick={() => {
                              const allCodes = filteredList.map((cat) => cat.code);
                              const allNames = filteredList.map((cat) => cat.name);
                              setFormData((prev) => ({
                                ...prev,
                                categoryCode: allCodes,
                                categoryName: allNames,
                              }));
                            }}
                          >
                            Select All
                          </button>

                          <button
                            className="btn btn-warning"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                categoryCode: [],
                                categoryName: [],
                              }));
                            }}
                          >
                            Clear All
                          </button>
                        </div>

                        <button className="btn btn-secondary" onClick={handleCloseModal}>
                          Close
                        </button>
                      </Modal.Footer>
                    </Modal>
                  </div>
                )}


                <div className="col-md-4" style={{ position: "relative" }}>
                  <label>
                    Mother Account <span style={{ color: "red" }}>*</span>
                  </label>

                  <div
                    className="form-control"
                    onClick={() => setShowModal_Account(true)}
                    style={{
                      cursor: "pointer",
                      position: "relative",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "5px",
                      minHeight: "40px",
                    }}
                  >
                    {selectedMother?.name === "NON-CHAIN"
                      ? (formData.accountType || []).map((id) => {
                        const sub = Object.values(subAccounts)
                          .flat()
                          .find((s) => s.id === id);
                        if (!sub) return null;
                        return (
                          <span
                            key={id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              backgroundColor: "#0050a5ff",
                              color: "#fff",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              fontSize: "14px",
                              fontWeight: "500",
                              marginRight: "5px",
                            }}
                          >
                            {sub.name}
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData((prev) => ({
                                  ...prev,
                                  accountType: prev.accountType.filter((x) => x !== id),
                                }));
                              }}
                              style={{
                                marginLeft: "5px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                color: "#fff",
                                backgroundColor: "#ff4d4f",
                                borderRadius: "5%",
                                width: "16px",
                                height: "16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                              }}
                            >
                              ✖
                            </span>
                          </span>
                        );
                      })
                      : (() => {
                        const sub = Object.values(subAccounts)
                          .flat()
                          .find((s) => s.id === formData.accountType);
                        return sub ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              backgroundColor: "#0050a5ff",
                              color: "#fff",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              fontSize: "14px",
                              fontWeight: "500",
                            }}
                          >
                            {sub.name}
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData({ ...formData, accountType: null });
                                setShowBranchInput(false);
                              }}
                              style={{
                                marginLeft: "5px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                color: "#fff",
                                backgroundColor: "#ff4d4f",
                                borderRadius: "5%",
                                width: "16px",
                                height: "16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                              }}
                            >
                              ✖
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: "#888" }}>Select Account Type</span>
                        );
                      })()}

                    <span
                      style={{
                        pointerEvents: "none",
                        fontSize: "18px",
                        color: "#555",
                        marginLeft: "auto",
                      }}
                    >
                      🔍
                    </span>
                  </div>

                  <Modal
                    show={showModal_Account}
                    onHide={() => setShowModal_Account(false)}
                    centered
                    size="lg"
                  >
                    <Modal.Header closeButton style={{ background: "rgb(70, 137, 166)", color: "white" }}>
                      <Modal.Title style={{ width: "100%", textAlign: "center" }}>
                        {selectedMother ? `Sub Accounts of ${selectedMother.name}` : "Select Mother Account Type"}
                      </Modal.Title>
                    </Modal.Header>

                    <Modal.Body style={{ maxHeight: "500px", overflowY: "auto", padding: "1rem" }}>
                      {!selectedMother && (
                        <>
                          <input
                            type="text"
                            className="form-control mb-3"
                            placeholder="Search mother accounts..."
                            value={accountSearchTerm}
                            onChange={(e) => setAccountSearchTerm(e.target.value)}
                            style={{ borderColor: "#007bff" }}
                          />

                          {accountTypes
                            .filter((opt) =>
                              opt.name.toLowerCase().includes(accountSearchTerm.toLowerCase())
                            )
                            .map((opt) => (
                              <div
                                key={opt.id}
                                style={{
                                  padding: "8px 10px",
                                  borderBottom: "1px solid #eee",
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                                onClick={() => {
                                  setSelectedMother(opt);
                                  fetchSubAccounts(opt);
                                  if (opt.name === "NON-CHAIN") {
                                    setShowBranchInput(false);
                                    setFormData((prev) => ({ ...prev, accountType: [] }));
                                  } else {
                                    setShowBranchInput(true);
                                  }
                                }}
                              >
                                <span> {opt.name}</span> <strong style={{ color: '#ffff' }}>({opt.code}) </strong>
                                <FiChevronRight style={{ color: "#888", fontSize: "16px" }} />
                              </div>
                            ))}
                        </>
                      )}

                      {selectedMother && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedMother(null)}
                            style={{ marginBottom: "10px" }}
                          >
                            ← Back to Mother Accounts
                          </Button>
                          <input
                            type="text"
                            className="form-control mb-2"
                            placeholder="Search sub accounts..."
                            value={subSearchTerm}
                            onChange={(e) => setSubSearchTerm(e.target.value)}
                            style={{ borderColor: "#007bff" }}
                          />
                          {subAccounts[selectedMother.id]
                            ?.filter((s) =>
                              s.name.toLowerCase().includes(subSearchTerm.toLowerCase())
                            )
                            .sort((a, b) => {
                              // Put NON CHAIN ACCT variations at the bottom
                              const isANonChain = a.name === "NON CHAIN ACCT" || a.name === "NON CHAIN ACCT.";
                              const isBNonChain = b.name === "NON CHAIN ACCT" || b.name === "NON CHAIN ACCT.";

                              if (isANonChain && !isBNonChain) return 1;
                              if (!isANonChain && isBNonChain) return -1;
                              return 0;
                            })
                            .map((s) => (
                              <div
                                key={s.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "4px 0"
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedMother.name === "NON-CHAIN"
                                      ? (formData.accountType || []).includes(s.id)
                                      : formData.accountType === s.id
                                  }
                                  onChange={() => {
                                    if (selectedMother.name === "NON-CHAIN") {
                                      let updated = [...(formData.accountType || [])];
                                      if (updated.includes(s.id)) {
                                        updated = updated.filter((x) => x !== s.id);
                                      } else {
                                        updated.push(s.id);
                                      }
                                      setFormData((prev) => ({
                                        ...prev,
                                        accountType: updated
                                      }));
                                      setShowBranchInput(false);
                                    } else {
                                      setFormData((prev) => ({
                                        ...prev,
                                        accountType: s.id
                                      }));
                                      setShowBranchInput(true);
                                      fetchBranches(s.code);
                                    }
                                  }}
                                  id={`sub_${s.id}`}
                                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                                />
                                <label
                                  htmlFor={`sub_${s.id}`}
                                  style={{ marginLeft: "6px", cursor: "pointer" }}
                                >
                                  {s.name}{" "}
                                  <span style={{ color: "#ffffffff", fontSize: "12px" }}>
                                    ({s.code})
                                  </span>
                                </label>
                              </div>
                            ))}
                        </>
                      )}
                    </Modal.Body>

                    <Modal.Footer>
                      <Button variant="light" onClick={() => setShowModal_Account(false)}>
                        Close
                      </Button>
                    </Modal.Footer>
                  </Modal>
                </div>


                {/* Branch Selector */}
                {showBranchInput && (
                  <div className="col-md-4" style={{ position: "relative" }}>
                    <label>
                      Branch <span style={{ color: "red" }}>*</span>
                    </label>
                    <div
                      className="form-control"
                      onClick={() => {
                        if (!formData.accountType) return alert("Select a Sub Account first");

                        // Find the selected sub account object
                        const selectedSub = subAccounts[selectedMother.id]?.find(
                          (s) => s.id === formData.accountType
                        );

                        if (!selectedSub) return alert("Sub account not found!");

                        // Open modal and fetch branches using mother_account_code
                        setShowModal_Branch(true);
                        fetchBranches(selectedSub.code);
                      }}
                      style={{
                        cursor: "pointer",
                        minHeight: "40px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "5px",
                      }}
                    >
                      {getBranchNames()}
                    </div>
                  </div>
                )}

                {/* Branch Selector */}
                {/* Branch Selector */}


                <Modal
                  show={showModal_Branch}
                  onHide={() => setShowModal_Branch(false)}
                  centered
                  size="lg"
                >
                  <Modal.Header
                    closeButton
                    style={{ background: "rgb(70, 137, 166)", color: "white" }}
                  >
                    <Modal.Title style={{ width: "100%", textAlign: "center" }}>
                      Select Branch
                    </Modal.Title>
                  </Modal.Header>

                  <Modal.Body
                    style={{
                      maxHeight: "400px",
                      display: "flex",
                      flexDirection: "column",
                      padding: "1rem",
                    }}
                  >
                    <input
                      type="text"
                      className="form-control mb-3"
                      placeholder="Search branches..."
                      value={branchSearchTerm}
                      onChange={(e) => setBranchSearchTerm(e.target.value)}
                      style={{ borderColor: "#007bff", flexShrink: 0 }}
                    />

                    <div style={{ overflowY: "auto", flexGrow: 1 }}>
                      {(() => {
                        const filteredBranches = getFilteredBranchesWithExtras();

                        return (
                          <>
                            <p style={{ fontWeight: "bold", marginBottom: "10px" }}>
                              Showing {filteredBranches.length} branch
                              {filteredBranches.length !== 1 ? "es" : ""}
                            </p>

                            {filteredBranches.map((opt) => (
                              <div
                                key={opt.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between", // ✅ Push status to the right
                                  padding: "6px 10px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={formData.branchType.includes(opt.name)}
                                    onChange={() => toggleBranchType(opt.name)}
                                    id={`branchType-${opt.id}`}
                                    style={{
                                      width: "20px",
                                      height: "20px",
                                      transform: "scale(1.3)",
                                      cursor: "pointer",
                                    }}
                                  />
                                  <label
                                    htmlFor={`branchType-${opt.id}`}
                                    style={{ marginLeft: "8px", cursor: "pointer" }}
                                  >
                                    {opt.name}
                                  </label>
                                </div>

                                {/* ✅ Status shown here */}
                                <span
                                  style={{
                                    fontSize: "0.9rem",
                                    fontWeight: 500,
                                    color: opt.status ? "#28a745" : "#dc3545", // ✅ Green if active, red if inactive
                                  }}
                                >
                                  {opt.status ? "Active " : "Inactive ❌"}
                                </span>
                              </div>
                            ))}

                          </>
                        );
                      })()}

                    </div>
                  </Modal.Body>


                  <Modal.Footer style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button
                        variant="success"
                        onClick={() => {
                          const filteredBranches = branchTypes
                            .filter((opt) =>
                              opt.name.toLowerCase().includes(branchSearchTerm.toLowerCase())
                            )
                            .filter((opt) => {
                              if (!formData.distributor) return false;
                              const distributorCodes = opt.distributor_code
                                ? opt.distributor_code.split(",").map((code) => code.trim()).filter((code) => code.length > 0)
                                : [];
                              if (Array.isArray(formData.distributor)) {
                                return formData.distributor.some((d) => distributorCodes.includes(d));
                              }
                              return distributorCodes.includes(formData.distributor);
                            });

                          const allBranchNames = filteredBranches.map(opt => opt.name);
                          setFormData(prev => ({ ...prev, branchType: allBranchNames }));
                        }}
                      >
                        Select All
                      </Button>

                      <Button
                        variant="warning"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, branchType: [] }));
                        }}
                      >
                        Clear All
                      </Button>
                    </div>

                    <Button variant="light" onClick={() => setShowModal_Branch(false)}>
                      Close
                    </Button>
                  </Modal.Footer>
                </Modal>



                {/* Marketing Type */}
                <div className="col-md-4" style={{ position: "relative" }}>
                  <label>Marketing Type</label>
                  <select
                    name="visaType"
                    className="form-control"
                    value={formData.visaType}
                    disabled
                    style={{
                      paddingRight: "30px",
                      borderColor: borderColor,
                      transition: "border-color 0.3s",
                    }}
                  >
                    <option value="REGULAR">REGULAR</option>
                  </select>

                  {formData.visaType && (
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




                {/* Amount Budget (conditionally shown or empty placeholder) */}
                {formData.activity &&
                  settingsMap[formData.activity]?.amount_display ? (
                  <div className="col-md-4" style={{ position: "relative" }}>
                    <label className="form-label">
                      Amount Budget <span style={{ color: "red" }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="amountbadget"
                      className="form-control"
                      value={rawAmount}
                      onChange={handleAmountChange}
                      style={{
                        paddingRight: "30px",
                        position: "relative",
                        top: "-8px",
                        marginTop: 0,
                      }}
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
                ) : (
                  // Placeholder to keep layout stable
                  <div className="col-md-4"></div>
                )}

                <div className="row mt-3">
                  {/* Objective - Left Side */}
                  <div className="col-md-6" style={{ position: "relative" }}>
                    <label>Objective</label>
                    <textarea
                      name="objective"
                      className="form-control"
                      value={formData.objective}
                      onChange={handleFormChange}
                      style={{
                        paddingRight: "30px",
                        borderColor: formData.objective ? "green" : "",
                        transition: "border-color 0.3s",
                        resize: "vertical",
                      }}
                    />
                    {formData.objective && (
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

                  {/* Promo Scheme - Right Side */}
                  <div className="col-md-6" style={{ position: "relative" }}>
                    <label>Promo Scheme</label>
                    <textarea
                      name="promoScheme"
                      className="form-control"
                      value={formData.promoScheme}
                      onChange={handleFormChange}
                      style={{
                        paddingRight: "30px",
                        borderColor: formData.promoScheme ? "green" : "",
                        transition: "border-color 0.3s",
                        resize: "vertical",
                      }}
                    />
                    {formData.promoScheme && (
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
              </div>
              <div className="card mt-4 shadow-sm">
                <style>{`
                                    .card-header {
                                    background: linear-gradient(135deg,rgb(11, 48, 168),rgb(255, 255, 255));
                                    color: white;
                                    font-weight: 700;
                                    padding: 1rem 1.5rem;
                                    border-radius: 0.75rem 0.75rem 0 0;
                                    
                                    }
                                    .card-header h3 {
                                    margin-bottom: 0;
                                    }   
                                `}</style>

                <div className="card-header">
                  <h3 className="mb-0">Timeline</h3>
                </div>

                <div className="card-body">
                  <div className="row g-3">
                    {/* Activity Duration From */}
                    <div className="col-md-3" style={{ position: "relative" }}>
                      <label
                        htmlFor="activityDurationFrom"
                        className="form-label"
                      >
                        Activity Duration From
                      </label>
                      <input
                        type="date"
                        id="activityDurationFrom"
                        name="activityDurationFrom"
                        className="form-control"
                        value={formData.activityDurationFrom}
                        onChange={handleFormChange}
                        style={{ paddingRight: "35px" }}
                      />
                      {formData.activityDurationFrom && (
                        <span
                          style={{
                            position: "absolute",
                            right: "20px",
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

                    {/* Activity Duration To */}
                    <div className="col-md-3" style={{ position: "relative" }}>
                      <label
                        htmlFor="activityDurationTo"
                        className="form-label"
                      >
                        Activity Duration To
                      </label>
                      <input
                        type="date"
                        id="activityDurationTo"
                        name="activityDurationTo"
                        className="form-control"
                        value={formData.activityDurationTo}
                        onChange={handleFormChange}
                        style={{ paddingRight: "35px" }}
                      />
                      {formData.activityDurationTo && (
                        <span
                          style={{
                            position: "absolute",
                            right: "20px",
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
                  </div>
                </div>
              </div>

              <style>{`
                                .card-3d {
                                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                                    cursor: pointer;
                                    will-change: transform;
                                    border-radius: 0.75rem;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                                    padding: 1rem 1.5rem; /* add consistent padding */
                                }

                                .card-3d .card-header {
                                    background: 'linear-gradient(135deg,rgb(11, 48, 168), #d9edf7)', // gentle blue gradient
                                    color: white;
                                    font-weight: 700;
                                    font-size: 1.25rem;
                                    border-radius: 0.75rem 0.75rem 0 0;
                                    padding: 1rem 1.5rem;
                                    margin: -1rem -1.5rem 1rem; /* offset to align with card padding */
                                }

                                .toggle-group {
                                    display: flex;
                                    gap: 1rem;
                                }

                                .toggle-checkbox {
                                    display: none;
                                }

                                .toggle-label {
                                    padding: 0.5rem 1.25rem;
                                    border-radius: 50px;
                                    border: 2px solid #007bff;
                                    color: #007bff;
                                    font-weight: 600;
                                    cursor: pointer;
                                    user-select: none;
                                    transition: all 0.25s ease;
                                    box-shadow: 0 0 8px transparent;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    min-width: 70px; /* consistent button width */
                                    text-align: center;
                                }

                                .toggle-checkbox:checked + .toggle-label {
                                    background-color: #007bff;
                                    color: white;
                                    box-shadow: 0 0 12px #007bff;
                                }

                                .toggle-label:hover {
                                    background-color: #e6f0ff;
                                }

                                /* Fix input field container for better alignment */
                                .cover-visa-code-container {
                                    margin-top: 1rem;
                                    max-width: 320px;
                                }

                                .cover-visa-code-container label {
                                    font-weight: 600;
                                }
                                `}</style>

              <div className="card card-3d mt-4">
                <div className="card-header fw-bold">IS PART OF BUDGET?</div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginTop: "15px",
                    justifyContent: "flex-start", // 👈 align left
                  }}
                >
                  {/* YES Button */}
                  <button
                    type="button"
                    disabled={!allowCoverToggle}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        isPartOfCoverPwp: true,
                        coverPwpCode: "",
                      }));
                      setShowCoverModal(false);
                    }}
                    style={{
                      height: "40px",
                      minWidth: "100px",
                      padding: "0 15px",
                      fontSize: "14px",
                      fontWeight: "600",
                      borderRadius: "8px",
                      border: "none",
                      cursor: allowCoverToggle ? "pointer" : "not-allowed",
                      backgroundColor: !allowCoverToggle
                        ? "#bfbfbf"
                        : formData.isPartOfCoverPwp
                          ? "#28a745"
                          : "#e9ecef",
                      color: !allowCoverToggle
                        ? "#6c757d"
                        : formData.isPartOfCoverPwp
                          ? "white"
                          : "#333",
                      transition: "all 0.2s ease-in-out",
                    }}
                  >
                    ✅ YES
                  </button>

                  {/* NO Button */}
                  <button
                    type="button"
                    disabled={!allowCoverToggle}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        isPartOfCoverPwp: false,
                        coverPwpCode: "",
                      }));
                      setShowCoverModal(false);
                    }}
                    style={{
                      height: "40px",
                      minWidth: "100px",
                      padding: "0 15px",
                      fontSize: "14px",
                      fontWeight: "600",
                      borderRadius: "8px",
                      border: "none",
                      cursor: allowCoverToggle ? "pointer" : "not-allowed",
                      backgroundColor: !allowCoverToggle
                        ? "#bfbfbf"
                        : formData.isPartOfCoverPwp === false
                          ? "#dc3545"
                          : "#e9ecef",
                      color: !allowCoverToggle
                        ? "#6c757d"
                        : formData.isPartOfCoverPwp === false
                          ? "white"
                          : "#333",
                      transition: "all 0.2s ease-in-out",
                    }}
                  >
                    ❌ NO
                  </button>
                </div>




                {formData.isPartOfCoverPwp && (
                  <div
                    className="d-flex justify-content-between align-items-start"
                    style={{ gap: "1rem", marginTop: "30px" }}
                  >
                    {/* Left: Cover PWP Code Input */}
                    <div className="flex-grow-1" style={{ maxWidth: "22rem" }}>
                      <label className="form-label text-uppercase">
                        Total Budget for The Year {new Date().getFullYear()}
                      </label>

                      <input
                        type="text"
                        readOnly
                        className="form-control"
                        value={formData.coverPwpCode || ""}
                        placeholder="Select Total Budget "
                        onClick={() => setShowCoverModal(true)}
                        style={{
                          cursor: "pointer",
                          paddingRight: "40px",
                          borderColor: formData.coverPwpCode ? "green" : "",
                          transition: "border-color 0.3s",
                        }}
                      />


                    </div>

                    {/* Right: Remaining Budget Card */}
                    {formData.coverPwpCode && selectedBalance !== null && (
                      <div
                        className="card shadow-sm mb-3"
                        style={{
                          width: "52rem",
                          borderRadius: "12px",
                          border: "1px solid #e0e0e0",
                          overflow: "hidden",
                          backgroundColor: "#f8f9fa",
                        }}
                      >
                        {/* Header */}
                        <div
                          className="card-header text-white fw-bold text-center"
                          style={{
                            background:
                              "linear-gradient(90deg, #28a745, #218838)",
                            fontSize: "1.3rem",
                            letterSpacing: "1px",
                          }}
                        >
                          🎯 Remaining Budget
                        </div>

                        {/* Body */}
                        <div className="card-body text-center">
                          <p
                            className="card-text mb-2"
                            style={{
                              fontSize: "2.5rem",
                              fontWeight: "bold",
                              color:
                                selectedBalance -
                                  totals.BILLING_AMOUNT -
                                  parseFloat(formData.amountbadget || 0) <
                                  0
                                  ? "#dc3545"
                                  : "#198754",
                              marginBottom: "0.5rem",
                            }}
                          >
                            ₱
                            {(
                              selectedBalance -
                              totals.BILLING_AMOUNT -
                              parseFloat(formData.amountbadget || 0)
                            ).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-around",
                              marginTop: "1rem",
                            }}
                          >
                            <div>
                              <small className="text-muted d-block fw-bold">
                                Original
                              </small>
                              <span
                                style={{
                                  fontSize: "1.1rem",
                                  fontWeight: "500",
                                }}
                              >
                                ₱
                                {selectedBalance.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>

                            <div>
                              <small className="text-muted d-block fw-bold">
                                Allocated (Form)
                              </small>
                              <span
                                style={{
                                  fontSize: "1.1rem",
                                  fontWeight: "500",
                                }}
                              >
                                ₱
                                {parseFloat(
                                  formData.amountbadget || 0
                                ).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Footer / optional */}
                        <div
                          className="card-footer text-center text-muted"
                          style={{
                            fontSize: "0.9rem",
                            backgroundColor: "#e9ecef",
                          }}
                        >
                          Keep track of your remaining budget to avoid
                          overspending
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Modal */}
                <Modal
                  show={showCoverModal}
                  onHide={() => setShowCoverModal(false)}
                  centered
                >
                  <Modal.Header
                    closeButton
                    style={{
                      background: "linear-gradient(to right, #0d6efd, #6610f2)",
                      color: "white",
                    }}
                  >
                    <Modal.Title
                      style={{ color: "white" }}
                      className="w-100 text-center"
                    >
                      Total Budget for The Year {new Date().getFullYear()}
                    </Modal.Title>
                  </Modal.Header>

                  <Modal.Body>
                    <input
                      type="text"
                      className="form-control mb-3"
                      placeholder="Search PWP code..."
                      value={coverPwpSearch}
                      onChange={(e) => setCoverPwpSearch(e.target.value)}
                    />

                    <ul className="list-group" style={{ maxHeight: "250px", overflowY: "auto" }}>
                      {(() => {
                        console.log("Distributor_Name:", selectedDistributor?.name);
                        return coverPwpWithStatus
                          .filter(
                            (cp) =>
                              cp.distributor === selectedDistributor?.name && // ✅ Only show if distributor matches
                              (
                                (cp.pwp_code &&
                                  cp.pwp_code.toLowerCase().includes(coverPwpSearch.toLowerCase())) ||
                                (cp.distributor &&
                                  cp.distributor.toLowerCase().includes(coverPwpSearch.toLowerCase()))
                              )
                          )
                          .map((cp, idx) => {
                            console.log("📋 Displaying PWP item:", {
                              index: idx,
                              pwp_code: cp.pwp_code,
                              distributor: cp.distributor,
                              approved: cp.approved,
                              remainingbalance: cp.remainingbalance,
                              amountbadget: cp.amountbadget,
                              createduser: cp.createduser,
                            });

                            return (
                              <li
                                key={idx}
                                onClick={() => {
                                  if (!cp.approved) return;
                                  console.log("✅ Selected approved PWP:", cp.pwp_code);
                                  setFormData((prev) => ({
                                    ...prev,
                                    coverPwpCode: cp.pwp_code,
                                  }));
                                  setSelectedBalance(cp.remainingbalance);
                                  setShowCoverModal(false);
                                }}
                                className="list-group-item d-flex justify-content-between align-items-center list-group-item-action"
                                style={{
                                  cursor: cp.approved ? "pointer" : "not-allowed",
                                  fontFamily: "monospace",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  backgroundColor: cp.approved ? "white" : "#fff3cd",
                                  opacity: cp.approved ? 1 : 0.7,
                                }}
                              >
                                {/* Left side info */}
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: "bold" }}>
                                    {cp.pwp_code?.toUpperCase()}
                                  </div>

                                  {cp.distributor && (
                                    <div style={{ fontSize: "0.85em", color: "#0d6efd" }}>
                                      Distributor: {cp.distributor}
                                    </div>
                                  )}

                                  {!cp.approved && (
                                    <div style={{ fontSize: "0.85em", color: "#856404" }}>
                                      ⚠️ Pending Approval
                                    </div>
                                  )}

                                  <div style={{ fontSize: "0.85em", color: "#666" }}>
                                    {cp.amountbadget
                                      ? `Amount: ${cp.amountbadget.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                      : "No amount"}
                                  </div>
                                </div>

                                {/* Right side info */}
                                <div
                                  style={{
                                    minWidth: "140px",
                                    textAlign: "right",
                                    fontWeight: "bold",
                                  }}
                                >
                                  <div>
                                    {cp.remainingbalance !== null
                                      ? cp.remainingbalance.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })
                                      : "-"}
                                  </div>

                                  {cp.createduser && (
                                    <div
                                      style={{
                                        fontSize: "0.8em",
                                        color: "#6c757d",
                                        fontWeight: "normal",
                                        marginTop: "4px",
                                      }}
                                    >
                                      👤 {cp.createduser}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          });
                      })()}
                    </ul>





                  </Modal.Body>

                  <Modal.Footer
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "2px solid yellow",
                          borderRadius: "6px",
                          padding: "8px",
                          marginRight: "8px",
                          width: "40px",
                          height: "40px",
                          boxSizing: "border-box",
                          backgroundColor: "#222",
                        }}
                      >
                        <FaExclamationTriangle
                          style={{ color: "yellow", fontSize: "24px" }}
                        />
                      </div>
                      <span style={{ fontWeight: "bold" }}>
                        Yellow = Pending
                      </span>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => setShowCoverModal(false)}
                    >
                      Close
                    </Button>
                  </Modal.Footer>
                </Modal>
              </div>

              <div style={{ textAlign: "right" }}>
                <button
                  type="button"
                  className="btn btn-primary mt-3"
                  onClick={() => {
                    // ✅ Validation: If YES but no Cover PWP Code
                    if (formData.isPartOfCoverPwp && !formData.coverPwpCode) {
                      Swal.fire({
                        icon: "warning",
                        title: "Missing Total Budget for The Year ",
                        text: "Please select a Total Budget before proceeding.",
                        confirmButtonColor: "#0d6efd",
                      });
                      return;
                    }

                    const setting = settingsMap[formData.activity];

                    console.log(
                      "▶️ Next pressed. formData.activity:",
                      formData.activity,
                      "setting:",
                      setting
                    );

                    if (formData.activityName === "BAD ORDER") {
                      setStep(4);
                      console.log("⛔ BAD ORDER selected → skipping SKU/accounts checks, going to Step 3");
                    } else if (setting?.sku) {
                      setStep(1);
                      console.log("🛒 SKU found → going to Step 1");
                    } else if (setting?.accounts) {
                      setStep(2);
                      console.log("💼 Accounts found → going to Step 2");
                    } else {
                      setStep(3);
                      console.log("📄 Default case → going to Step 3");
                    }
                  }}
                  style={{ width: "85px" }}
                  disabled={!formData.activity}
                >
                  Next
                </button>
              </div>

            </form >
          </div >
        );

      case 1:
        return (
          <div>
            <Card border="primary" className="shadow">
              {formData.isPartOfCoverPwp &&
                formData.coverPwpCode &&
                selectedBalance !== null && (
                  <div
                    className="d-flex flex-column flex-lg-row justify-content-between align-items-start gap-3"
                    style={{ width: "100%" }}
                  >
                    {/* ✅ Left side: Table section */}
                    <div className="flex-grow-1 w-100">
                      {/* your existing Table code here */}
                    </div>

                    {/* ✅ Right side: Remaining Budget Card */}
                    <div
                      className="card border-success shadow w-100 w-lg-auto"
                      style={{
                        maxWidth: "22rem",
                        flexShrink: 0,
                        alignSelf: "stretch",
                      }}
                    >
                      <div className="card-header bg-success text-white fw-bold text-center">
                        📦 Remaining SKU Budget
                      </div>
                      <div className="card-body text-center">
                        {(() => {
                          const grandTotals = calculateGrandTotals();
                          const selected = parseFloat(selectedBalance || 0);
                          const creditBudget = parseFloat(formData?.amountbadget || 0);
                          const netTotal = grandTotals.BILLING_AMOUNT - grandTotals.DISCOUNT;
                          const remainingSkuBudget = selected - netTotal - creditBudget;

                          return (
                            <>
                              <p
                                className="card-text"
                                style={{
                                  fontSize: "2rem",
                                  fontWeight: "bold",
                                  color: remainingSkuBudget < 0 ? "#dc3545" : "#198754",
                                }}
                              >
                                ₱
                                {remainingSkuBudget.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                              <small className="text-muted">
                                Total Budget: ₱
                                {selected.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                })}
                                − SKU Net: ₱
                                {netTotal.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                })}
                              </small>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}


              <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                <h4 className="mb-0"> Branch-based SKU Listing</h4>
                <div className="d-flex gap-2 align-items-center">


                </div>
              </Card.Header>

              <Card.Body>
                {/* Branch / Sub-Account Selector */}
                <div className="mb-3">
                  <label className="form-label">
                    {selectedMother?.name === "NON-CHAIN"
                      ? "Sub-Accounts for SKU Entry:"
                      : "Select Branch for SKU Entry:"}
                  </label>

                  {selectedMother?.name !== "NON-CHAIN" && (
                    <select
                      className="form-control"
                      value={selectedBranchForSku}
                      onChange={(e) => setSelectedBranchForSku(e.target.value)}
                      style={{ maxWidth: "400px" }}
                    >
                      <option value="">Select branch...</option>
                      <option value="ALL_BRANCHES">🔍 View All Branches</option>
                      {branchTypes
                        .filter(
                          (branch) =>
                            Array.isArray(formData.branchType) &&
                            formData.branchType.includes(branch.code)
                        )
                        .map((branch) => (
                          <option key={branch.code} value={branch.code}>
                            {branch.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* SKU Table */}
                <div className="mt-3">
                  {selectedMother ? (
                    <>
                      {(
                        selectedMother.name === "NON-CHAIN"
                          ? // Only show sub-accounts that are selected
                          (subAccounts[selectedMother.id] || []).filter((s) =>
                            (formData.accountType || []).includes(s.id)
                          )
                          : selectedBranchForSku
                            ? selectedBranchForSku === "ALL_BRANCHES"
                              ? branchTypes.filter(
                                (branch) =>
                                  Array.isArray(formData.branchType) &&
                                  formData.branchType.includes(branch.name) // ✅ Compare by branch name
                              )
                              : branchTypes.filter((branch) => branch.name === selectedBranchForSku) // ✅ Compare by name
                            : []

                      ).map((branchOrSub) => {
                        const branchCode =
                          selectedMother.name === "NON-CHAIN"
                            ? branchOrSub.id
                            : branchOrSub.code;
                        const branchName =
                          selectedMother.name === "NON-CHAIN"
                            ? branchOrSub.name
                            : branchOrSub.name;


                        const rows =
                          accountSkuRows[branchName]?.length > 0
                            ? accountSkuRows[branchName]
                            : [{ SKUITEM: "", SRP: 0, QTY: 0, UOM: "PC", DISCOUNT: 0 }];

                        const totals = calculateBranchSkuTotals(branchName);

                        return (
                          <div key={branchName} className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <h6>
                                <span className="badge bg-primary me-2">{branchName}</span>
                                {branchName}
                              </h6>
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => addSkuRowForBranch(branchName)} // <-- use branchName here
                              >
                                Add SKU
                              </Button>

                            </div>

                            <div className="table-responsive">
                              <Table bordered hover size="sm" className="align-middle text-center">
                                <thead className="table-primary text-white">
                                  <tr>
                                    <th>SKU</th>
                                    <th>SRP</th>
                                    <th>QTY</th>
                                    <th>UOM</th>
                                    <th>Billing Amount</th>
                                    <th>Discount %</th>
                                    <th>Total Amount</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {rows.map((row, idx) => {
                                    const srp = Number(row.SRP || 0);
                                    const qty = Number(row.QTY || 0);
                                    const discountAmount = Number(row.DISCOUNT || 0);

                                    const totalBeforeDiscount = srp * qty;
                                    const totalAmount = totalBeforeDiscount - discountAmount;

                                    return (
                                      <tr key={`${branchName}-${idx}`}>
                                        <td
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            minWidth: "200px",
                                            gap: "8px",
                                          }}
                                        >
                                          <Form.Control
                                            value={
                                              categoryListing.find((sku) => sku.sku_code === row.SKUITEM)
                                                ? `${row.SKUITEM} - ${categoryListing.find((sku) => sku.sku_code === row.SKUITEM)?.name
                                                }`
                                                : row.SKUITEM || ""
                                            }
                                            readOnly
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedRowIndex(idx);
                                              setSelectedBranchName(branchName);
                                              setShowSkuModal(true);
                                            }}
                                            style={{
                                              border: "none",
                                              background: "none",
                                              cursor: "pointer",
                                              padding: "8px",
                                            }}
                                          >
                                            <FaSearch style={{ color: "blue", fontSize: "20px" }} />
                                          </button>
                                        </td>

                                        <td>
                                          <Form.Control
                                            type="number"
                                            step="0.01"
                                            value={row.SRP || 0}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "SRP", e.target.value)
                                            }
                                          />
                                        </td>

                                        <td>
                                          <Form.Control
                                            type="number"
                                            value={row.QTY || 0}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "QTY", e.target.value)
                                            }
                                          />
                                        </td>

                                        <td>
                                          <Form.Select
                                            value={row.UOM || "PC"}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "UOM", e.target.value)
                                            }
                                          >
                                            {["PC", "CASE", "IBX", "PACK"].map((uom) => (
                                              <option key={uom} value={uom}>
                                                {uom}
                                              </option>
                                            ))}
                                          </Form.Select>
                                        </td>

                                        <td>{totalBeforeDiscount.toFixed(2)}</td>

                                        <td>
                                          <Form.Control
                                            type="number"
                                            step="0.01"
                                            value={discountAmount}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "DISCOUNT", e.target.value)
                                            }
                                          />
                                        </td>

                                        <td>{totalAmount.toFixed(2)}</td>

                                        <td>
                                          <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => removeSkuRowForBranch(branchName, idx)}
                                          >
                                            Remove
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>

                                <tfoot className="table text-white">
                                  <tr>
                                    <td><strong>Total</strong></td>
                                    <td>{totals.SRP.toFixed(2)}</td>
                                    <td>{totals.QTY}</td>
                                    <td></td>
                                    <td>{totals.BILLING_AMOUNT.toFixed(2)}</td>
                                    <td>{totals.DISCOUNT.toFixed(2)}</td>
                                    <td>{totals.TOTAL_AMOUNT.toFixed(2)}</td>
                                    <td>-</td>
                                  </tr>
                                </tfoot>
                              </Table>
                            </div>

                          </div>
                        );
                      })}

                      {/* Grand Totals */}
                      {renderGrandTotalSummary()}


                    </>
                  ) : (
                    <div className="text-center p-4 bg-light rounded">
                      <p className="text-muted mb-0">
                        Please select a branch or sub-account to manage SKU listings
                      </p>
                    </div>
                  )}
                </div>
              </Card.Body>


              <Card.Footer>
                {/* SKU Modal - Update the onClick handler */}
                <Modal
                  show={showSkuModal}
                  onHide={() => setShowSkuModal(false)}
                  centered
                  dialogClassName="responsive-sku-modal"
                >
                  <Modal.Header
                    closeButton
                    style={{ background: "rgb(70, 137, 166)", color: "white" }}
                  >
                    <Modal.Title style={{ width: "100%", textAlign: "center" }}>
                      Select SKU{" "}
                      {activeCategoryCode ? `(Category: ${activeCategoryCode})` : ""}
                    </Modal.Title>
                  </Modal.Header>

                  <Modal.Body
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      height: "70vh",
                      padding: "1rem",
                    }}
                  >
                    {/* Search Input */}
                    <input
                      type="text"
                      className="form-control mb-3"
                      placeholder="Search SKUs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ borderColor: "#007bff", flexShrink: 0 }}
                    />

                    {/* ✅ Filter Checkboxes */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end", // ✅ Right side
                        gap: "30px",
                        marginBottom: "15px",
                        alignItems: "center",
                      }}
                    >
                      <label style={{ fontSize: "16px", fontWeight: "500", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={showPack}
                          onChange={() => setShowPack(!showPack)}
                          style={{
                            transform: "scale(1.5)", // ✅ Make checkbox larger
                            marginRight: "8px",
                            cursor: "pointer",
                          }}
                        />
                        SRP Pack
                      </label>

                      <label style={{ fontSize: "16px", fontWeight: "500", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={showCase}
                          onChange={() => setShowCase(!showCase)}
                          style={{
                            transform: "scale(1.5)", // ✅ Make checkbox larger
                            marginRight: "8px",
                            cursor: "pointer",
                          }}
                        />
                        SRP Case
                      </label>
                    </div>


                    {/* Selected Categories */}
                    <div style={{ overflowY: "auto", flexGrow: 1 }}>
                      <strong>Selected Categories:</strong>

                      <div
                        style={{
                          marginTop: "0.5rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {formData.categoryName && formData.categoryName.length > 0 ? (
                          formData.categoryName.map((name, index) => {
                            const code = formData.categoryCode[index];
                            const isActive = activeCategoryCode === code;

                            return (
                              <div key={index}>
                                {/* Category Item */}
                                <div
                                  onClick={() => handleCategoryClick(code)}
                                  style={{
                                    padding: "8px 12px",
                                    border: isActive ? "2px solid black" : "1px solid #ccc",
                                    borderRadius: "6px",
                                    backgroundColor: isActive ? "#e6e6e6" : "#f9f9f9",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                    fontWeight: "500",
                                    cursor: "pointer",
                                    userSelect: "none",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span>
                                    {code} - {name}
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "18px",
                                      color: "#666",
                                    }}
                                  >
                                    {">"}
                                  </span>
                                </div>

                                {/* SKU List (only active) */}
                                {isActive && (
                                  <div
                                    style={{
                                      marginTop: "0.5rem",
                                      padding: "0.5rem",
                                      backgroundColor: "#fff",
                                      border: "1px solid #ddd",
                                      borderRadius: "4px",
                                      maxHeight: "200px",
                                      overflowY: "auto",
                                    }}
                                  >
                                    {(categoryListing || [])
                                      .filter((sku) => {
                                        const matchesCategory =
                                          sku.category_code?.toLowerCase() === code.toLowerCase();
                                        const matchesSearch =
                                          sku.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          (sku.description || "")
                                            .toLowerCase()
                                            .includes(searchTerm.toLowerCase()) ||
                                          sku.category_code
                                            ?.toString()
                                            .toLowerCase()
                                            .includes(searchTerm.toLowerCase());
                                        return matchesCategory && matchesSearch;
                                      })
                                      .map((sku) => (
                                        <div
                                          key={sku.sku_code}
                                          style={{
                                            padding: "12px",
                                            cursor: "pointer",
                                            borderBottom: "1px solid #eee",
                                            borderRadius: "6px",
                                            transition: "background 0.2s",
                                          }}
                                          onClick={() => {
                                            if (selectedRowIndex !== null && selectedBranchName !== null) {
                                              // 1️⃣ Update SKUITEM for the selected row
                                              handleChangeSkuForBranch(
                                                selectedBranchName,
                                                selectedRowIndex,
                                                "SKUITEM",
                                                sku.sku_code
                                              );

                                              // 2️⃣ Set SRP and UOM depending on checkboxes and available data
                                              if (showPack && Number(sku.pack || 0) > 0) {
                                                handleChangeSkuForBranch(selectedBranchName, selectedRowIndex, "SRP", sku.pack);
                                                handleChangeSkuForBranch(selectedBranchName, selectedRowIndex, "UOM", "PACK");
                                              } else if (showCase && Number(sku.case || 0) > 0) {
                                                handleChangeSkuForBranch(selectedBranchName, selectedRowIndex, "SRP", sku.case);
                                                handleChangeSkuForBranch(selectedBranchName, selectedRowIndex, "UOM", "CASE");
                                              } else {
                                                handleChangeSkuForBranch(selectedBranchName, selectedRowIndex, "SRP", sku.default_srp || 0);
                                                handleChangeSkuForBranch(selectedBranchName, selectedRowIndex, "UOM", sku.default_uom || "PC");
                                              }

                                              // 3️⃣ Set default quantity
                                              handleChangeSkuForBranch(selectedBranchName, selectedRowIndex, "QTY", sku.default_qty || 1);

                                              // 4️⃣ Close modal and reset selections
                                              setShowSkuModal(false);
                                              setSelectedRowIndex(null);
                                              setSelectedBranchName(null);
                                            }
                                          }}

                                          onMouseEnter={(e) =>
                                            (e.currentTarget.style.backgroundColor = "#f5f5f5")
                                          }
                                          onMouseLeave={(e) =>
                                            (e.currentTarget.style.backgroundColor = "transparent")
                                          }
                                        >
                                          {/* SKU Code + Name */}
                                          <div>
                                            <strong>{sku.sku_code}</strong> – {sku.name}
                                          </div>

                                          {/* Description */}
                                          <small style={{ color: "#666" }}>
                                            {sku.description || "No description"}
                                          </small>

                                          {/* Prices */}
                                          <div
                                            style={{
                                              marginTop: "6px",
                                              fontSize: "13px",
                                              color: "#333",
                                              display: "flex",
                                              gap: "16px",
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            <strong>SRP:</strong>

                                            {showPack && (
                                              <span>
                                                🟦 Pack:{" "}
                                                <strong>
                                                  ₱
                                                  {Number(sku.pack || 0).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })}
                                                </strong>
                                              </span>
                                            )}

                                            {showCase && (
                                              <span>
                                                🟩 Case:{" "}
                                                <strong>
                                                  ₱
                                                  {Number(sku.case || 0).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })}
                                                </strong>
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                      ))}

                                    {/* No SKUs */}
                                    {categoryListing.filter(
                                      (sku) =>
                                        sku.category_code?.toLowerCase() === code.toLowerCase()
                                    ).length === 0 && (
                                        <div className="text-center text-muted p-3">
                                          No SKUs found for this category.
                                        </div>
                                      )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div>None</div>
                        )}
                      </div>
                    </div>
                  </Modal.Body>

                  <Modal.Footer>
                    <Button
                      variant="secondary"
                      onClick={() => setShowSkuModal(false)}
                    >
                      Close
                    </Button>
                  </Modal.Footer>
                </Modal>

              </Card.Footer>
            </Card>

            {/* Remarks Section */}
            <div className="mb-3 mt-4">
              <label className="form-label">Remarks</label>
              <textarea
                name="remarks"
                className="form-control"
                value={formData.remarks}
                onChange={handleFormChange}
                rows={4}
              />
            </div>

            {/* Navigation */}
            <div className="d-flex justify-content-between">
              <button
                className="btn btn-outline-secondary"
                onClick={handlePrevious}
              >
                ← Previous
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(3)}
                style={{ width: "85px" }}
              >
                Next
              </button>
            </div>
          </div>
        );

      case 2:
        // Cost Details table
        return (
          <div className="d-flex flex-column">
            {formData.isPartOfCoverPwp &&
              formData.coverPwpCode &&
              selectedBalance !== null &&
              (() => {
                const totalAllocatedFromBranches = rowsAccounts
                  .filter((row) =>
                    selectedMother?.name === "NON-CHAIN"
                      ? row.account_code === formData.accountType
                      : formData.branchType.includes(row.account_code)
                  )
                  .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);

                // Adjust if you want other allocations later
                const allocatedBudget = 0;

                const remainingBudget =
                  selectedBalance - totalAllocatedFromBranches - allocatedBudget;

                return (
                  <div className="d-flex justify-content-between align-items-start gap-4">
                    {/* Left: Drag & Drop */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) handleImportCSV(file);
                      }}
                      onClick={() => fileInputRef.current && fileInputRef.current.click()} // ✅ handle click
                      style={{
                        width: "100%", // ✅ Full width in container
                        maxWidth: "100%", // prevent overflow
                        minHeight: "160px", // keep height reasonable
                        border: "2px dashed #198754",
                        borderRadius: "12px",
                        padding: "30px 15px",
                        cursor: "pointer",
                        textAlign: "center",
                        backgroundColor: "#f8f9fa",
                        transition: "background 0.3s, transform 0.2s",
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#e9f7ef";
                        e.currentTarget.style.transform = "scale(1.01)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#f8f9fa";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <p
                        className="text-success fw-bold mb-2"
                        style={{ fontSize: "16px", margin: "0" }}
                      >
                        📂 Drag & Drop your Excel file here, or click to browse
                      </p>
                      <p
                        className="text-muted small mb-0"
                        style={{ fontSize: "13px", marginTop: "5px" }}
                      >
                        (Accepted formats: .xlsx, .xls, .csv)
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => e.target.files[0] && handleImportCSV(e.target.files[0])}
                      style={{ display: "none" }}
                    />


                    {/* Right: Remaining Budget Card */}
                    <div className="card border-success mb-3 shadow" style={{ width: "22rem" }}>
                      <div className="card-header bg-success text-white fw-bold text-center">
                        🎯 Remaining Budget
                      </div>
                      <div className="card-body text-center">
                        <p
                          className="card-text"
                          style={{
                            fontSize: "2rem",
                            fontWeight: "bold",
                            color: remainingBudget < 0 ? "#dc3545" : "#198754",
                          }}
                        >
                          ₱
                          {remainingBudget.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>

                        <small className="text-muted d-block">
                          Original: ₱
                          {selectedBalance.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </small>

                        <small className="text-muted d-block">
                          Total from Branches Table: ₱
                          {totalAllocatedFromBranches.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </small>
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Budget Table */}
            <Card border="primary" className="shadow mb-3">
              <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                <h4 className="mb-0"> Regular Branch Budget List</h4>
                <div className="d-flex gap-2 align-items-center">
                  <input

                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => e.target.files[0] && handleImportCSV(e.target.files[0])}
                  />

                  <Button
                    variant="success"
                    onClick={triggerFileInputs}
                    className="d-flex align-items-center"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => e.target.files[0] && handleImportCSV(e.target.files[0])}
                  >
                    <FaFileExcel className="me-2" /> Import Excel
                  </Button>

                  <Button
                    variant="primary"
                    style={{ backgroundColor: "gray" }}
                    onClick={handleExportCSV}
                    className="d-flex align-items-center"
                  >
                    <FaDownload className="me-2" /> Export Excel
                  </Button>
                </div>
              </Card.Header>


              <Card.Body>
                {loadingAccounts ? (
                  <div
                    className="d-flex justify-content-center align-items-center"
                    style={{ height: "150px" }}
                  >
                    <Spinner animation="border" variant="primary" />
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <Table bordered hover responsive className="align-middle text-center">
                      <thead className="bg-primary text-white">
                        <tr>
                          <th>Branch Name</th>
                          <th>Budget</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredBranchesWithExtras()
                          .filter((branch) => formData.branchType.includes(branch.name)) // ✅ Filter selected branches
                          .map((branch) => {
                            const existingRow =
                              rowsAccounts.find((r) => r.account_code === branch.name) || {};
                            const budgetValue =
                              existingRow.budget !== undefined ? existingRow.budget : "";

                            return (
                              <tr key={branch.id}>
                                <td>
                                  <Form.Control value={branch.name} disabled />
                                </td>
                                <td>
                                  <Form.Control
                                    type="number"
                                    step="0.01"
                                    value={budgetValue === "" ? "" : budgetValue}
                                    onChange={(e) => {
                                      let newBudget = parseFloat(e.target.value);
                                      if (isNaN(newBudget)) newBudget = 0;

                                      const updatedRow = {
                                        id: existingRow.id || branch.id,
                                        account_code: branch.name, // ✅ Save using branch name
                                        account_name: branch.name,
                                        budget: newBudget,
                                        created_at: existingRow.created_at || new Date().toISOString(),
                                      };

                                      setRowsAccounts((prevRows) => {
                                        const existingIndex = prevRows.findIndex(
                                          (r) => r.account_code === branch.name
                                        );
                                        let updated;
                                        if (existingIndex !== -1) {
                                          updated = [...prevRows];
                                          updated[existingIndex] = {
                                            ...updated[existingIndex],
                                            budget: newBudget,
                                          };
                                        } else {
                                          updated = [...prevRows, updatedRow];
                                        }
                                        return updated;
                                      });
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}


                        {/* NON-CHAIN: render multiple sub-accounts if selected */}
                        {selectedMother?.name === "NON-CHAIN" &&
                          Array.isArray(formData.accountType) &&
                          formData.accountType.map((subId) => {
                            const sub = Object.values(subAccounts).flat().find((s) => s.id === subId);
                            if (!sub) return null;

                            const existingRow = rowsAccounts.find((r) => r.account_code === sub.id) || {};
                            const budgetValue = existingRow.budget ?? "";

                            return (
                              <tr key={sub.id}>
                                <td>
                                  <Form.Control value={sub.name} disabled />
                                </td>
                                <td>
                                  <Form.Control
                                    type="number"
                                    step="0.01"
                                    value={budgetValue === "" ? "" : budgetValue}
                                    onChange={(e) => {
                                      let newBudget = parseFloat(e.target.value);
                                      if (isNaN(newBudget)) newBudget = 0;

                                      const updatedRow = {
                                        id: existingRow.id || sub.id,
                                        account_code: sub.id,
                                        account_name: sub.name,
                                        budget: newBudget,
                                        created_at: existingRow.created_at || new Date().toISOString(),
                                      };

                                      setRowsAccounts((prevRows) => {
                                        const existingIndex = prevRows.findIndex((r) => r.account_code === sub.id);
                                        let updated;
                                        if (existingIndex !== -1) {
                                          updated = [...prevRows];
                                          updated[existingIndex] = { ...updated[existingIndex], budget: newBudget };
                                        } else {
                                          updated = [...prevRows, updatedRow];
                                        }
                                        return updated;
                                      });
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}

                        {/* Total Row */}
                        <tr>
                          <td style={{ fontWeight: "bold", textAlign: "right" }}>Total</td>
                          <td style={{ fontWeight: "bold" }}>
                            {rowsAccounts
                              .filter((row) =>
                                selectedMother?.name === "NON-CHAIN"
                                  ? (formData.accountType || []).includes(row.account_code)
                                  : formData.branchType.includes(row.account_code)
                              )
                              .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0)
                              .toFixed(2)}
                          </td>
                        </tr>
                      </tbody>


                    </Table>
                  </div>
                )}
              </Card.Body>

              <Card.Footer className="d-flex justify-content-between align-items-center">
                {/* Left side */}
                <div>
                  <Button variant="outline-secondary" onClick={handlePrevious}>
                    ← Previous
                  </Button>
                </div>

                {/* Right side */}
                <div>
                  <Button variant="primary" onClick={() => setStep(3)}>
                    Next →
                  </Button>
                </div>
              </Card.Footer>
            </Card>
          </div>

        );

      case 3:
        // File upload step
        return (
          <div className="card shadow-sm p-4">
            <form onSubmit={submit_all}>
              <div className="col-12">
                {formData.isPartOfCoverPwp &&
                  formData.coverPwpCode &&
                  remainingBalance !== null && (
                    <div className="row mt-4 gx-4 gy-4">
                      {/* Left: Regular PWPs Card */}
                      <div className="col-12 col-md-7">
                        <div
                          className="card p-4 animate-fade-slide-up shadow-sm h-100"
                          style={{
                            background:
                              "linear-gradient(135deg,rgb(11, 48, 168), #d9edf7)",
                            borderRadius: "12px",
                            border: "1px solid #99cfff",
                            color: "#ffff",
                            boxShadow: "0 4px 8px rgba(26, 62, 114, 0.15)",
                          }}
                        >
                          <h3
                            className="mb-0"
                            style={{
                              fontWeight: "700",
                              letterSpacing: "2px",
                              textTransform: "uppercase",
                              fontFamily:
                                "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                              textShadow: "1px 1px 2px rgba(26, 62, 114, 0.3)",
                            }}
                          >
                            Regular PWPs
                          </h3>
                        </div>
                      </div>

                      {/* Right: Remaining Budget Card */}
                      <div className="col-12 col-md-5">
                        <div className="card border-success shadow h-100">
                          <div className="card-header bg-success text-white fw-bold text-center">
                            Total Budget
                          </div>
                          <div className="card-body text-center d-flex align-items-center justify-content-center">
                            <p
                              className="card-text mb-0"
                              style={{
                                fontSize: "2rem",
                                fontWeight: "bold",
                                color:
                                  remainingBalance < 0 ? "#dc3545" : "#198754",
                              }}
                            >
                              ₱
                              {Number(remainingBalance).toLocaleString(
                                "en-PH",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                          ({
                            id,
                            username,
                            allowed_to_approve,
                            created_at,
                          }) => (
                            <tr key={id}>
                              <td>{username}</td>
                              <td>
                                {allowed_to_approve ? (
                                  <span className="badge bg-success">
                                    Allowed
                                  </span>
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
                    justifyContent:
                      files.length === 0 ? "center" : "flex-start",
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
              </div>

              <div className="mt-4 d-flex justify-content-between">
                <button
                  className="btn btn-outline-secondary"
                  onClick={handlePrevious}
                >
                  ← Previous
                </button>

                <Button
                  variant="success"
                  onClick={submit_all}
                  className="d-flex align-items-center"
                  style={{ marginTop: "1rem" }}
                >
                  <FaSave className="me-2" /> Submit All
                </Button>
              </div>
            </form>
          </div>
        );

      case 4:
        return (
          formData.activityName === "BAD ORDER" && (
            <div>
              {formData.coverPwpCode && selectedBalance !== null && (
                <div
                  className="card mb-3 shadow-sm"
                  style={{
                    width: "32rem",
                    borderRadius: "12px",
                    border: "1px solid #198754",
                    overflow: "hidden",
                    fontFamily:
                      "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                  }}
                >
                  <div
                    className="card-header text-white fw-bold text-center"
                    style={{
                      background:
                        "linear-gradient(90deg, #198754 0%, #2ecc71 100%)",
                      fontSize: "1.25rem",
                      letterSpacing: "1px",
                      padding: "1rem",
                      borderBottom: "2px solid #145c32",
                      userSelect: "none",
                    }}
                  >
                    🎯 Remaining Budget
                  </div>

                  <div className="card-body text-center px-4 py-3">
                    <p
                      className="card-text mb-2"
                      style={{
                        fontSize: "2.5rem",
                        fontWeight: "900",
                        color:
                          selectedBalance -
                            totals.BILLING_AMOUNT -
                            parseFloat(formData.amountbadget || 0) <
                            0
                            ? "#dc3545"
                            : "#198754",
                        transition: "color 0.3s ease",
                      }}
                    >
                      ₱
                      {(
                        selectedBalance -
                        totals.BILLING_AMOUNT -
                        parseFloat(formData.amountbadget || 0)
                      ).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "2rem",
                        fontSize: "0.9rem",
                        color: "#6c757d",
                        userSelect: "none",
                      }}
                    >
                      <div>
                        <small>Original</small>
                        <br />
                        <strong>
                          ₱
                          {selectedBalance.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </strong>
                      </div>

                      <div>
                        <small>Allocated (Form)</small>
                        <br />
                        <strong>
                          ₱
                          {parseFloat(
                            formData.amountbadget || 0
                          ).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Card border="primary" className="shadow">
                <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">📦 Bad Order Category Listing</h4>
                  {/* <div className="d-flex gap-2 align-items-center">
                                                   <Button variant="success" onClick={triggerFileInput} className="d-flex align-items-center">
                                                       <FaFileExcel className="me-2" /> Import Excel
                                                   </Button>
                                                   <Button variant="secondary" onClick={handleExport} className="d-flex align-items-center">
                                                       <FaDownload className="me-2" /> Export Excel
                                                   </Button>
                                               </div> */}
                </Card.Header>

                <Card.Body>
                  <label>Category & Amount Table</label>
                  <table className="table table-bordered">
                    <thead className="thead-dark">
                      <tr>
                        <th style={{ width: "40%" }}>Category</th>
                        <th style={{ width: "40%" }}>Amount</th>
                        <th style={{ width: "20%" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.rowsCategories.length > 0 ? (
                        formData.rowsCategories.map((row, index) => (
                          <tr key={index}>
                            <td>
                              <div className="d-flex align-items-center">
                                <input
                                  type="text"
                                  className="form-control me-2"
                                  style={{ flexGrow: 1 }}
                                  value={row.category || ""}
                                  onChange={(e) =>
                                    handleCategoryRowChange(
                                      index,
                                      "category",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Enter category name or select from modal"
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() => {
                                    setSelectedCategoryRowIndex(index);
                                    setShowModal(true);
                                  }}
                                >
                                  🔍
                                </button>
                              </div>
                            </td>

                            <td>
                              <input
                                type="number"
                                className="form-control"
                                value={row.amount}
                                onChange={(e) =>
                                  handleCategoryRowChange(
                                    index,
                                    "amount",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter amount"
                              />
                            </td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteCategoryRow(index)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center text-muted">
                            No categories added
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* Modal component for category selection */}
                    <Modal
                      show={showModal}
                      onHide={() => setShowModal(false)}
                      size="lg"
                      centered
                    >
                      <Modal.Header
                        closeButton
                        style={{ background: "#4689a6", color: "white" }}
                      >
                        <Modal.Title className="w-100 text-center">
                          📂 Select{" "}
                          {categoryMode === "subcategory"
                            ? "Subcategory"
                            : "Category"}
                        </Modal.Title>
                      </Modal.Header>

                      <Modal.Body>
                        {categoryMode === null ? (
                          <div className="text-danger text-center">
                            🚫 No categories or subcategories available.
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              className="form-control mb-3"
                              placeholder={`Search ${categoryMode} by name or code...`}
                              value={BadOrderSearch}
                              onChange={(e) =>
                                setBadOrderSearch(e.target.value)
                              }
                            />

                            {loading ? (
                              <p>Loading {categoryMode}s...</p>
                            ) : (
                              <ul
                                className="list-group"
                                style={{
                                  maxHeight: "300px",
                                  overflowY: "auto",
                                }}
                              >
                                {filtered.length > 0 ? (
                                  filtered.map((cat) => (
                                    <li
                                      key={cat.id}
                                      className="list-group-item list-group-item-action"
                                      style={{ cursor: "pointer" }}
                                      onClick={() => handleSelectCategory(cat)}
                                    >
                                      <strong>{cat.code}</strong> - {cat.name}
                                      <div className="text-muted small">
                                        {cat.description || "No description"}
                                      </div>
                                    </li>
                                  ))
                                ) : (
                                  <li className="list-group-item text-muted">
                                    No results found
                                  </li>
                                )}
                              </ul>
                            )}
                          </>
                        )}
                      </Modal.Body>

                      <Modal.Footer>
                        <Button
                          variant="secondary"
                          onClick={() => setShowModal(false)}
                        >
                          Close
                        </Button>
                      </Modal.Footer>
                    </Modal>

                    <tfoot>
                      <tr>
                        <td className="text-end fw-bold">Total:</td>
                        <td colSpan="2" className="fw-bold">
                          ₱
                          {calculateTotalAmount().toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>

                      {formData.coverPwpCode &&
                        selectedBalance !== null &&
                        (() => {
                          const amountBadgetValue = selectedBalance; // Use selectedBalance as total budget
                          const safeAmountBadget = isNaN(amountBadgetValue)
                            ? 0
                            : amountBadgetValue;
                          const totalAmount = calculateTotalAmount();
                          const remainingBudget =
                            selectedBalance -
                            totals.BILLING_AMOUNT -
                            (parseFloat(formData.amountbadget) || 0);
                          const amountBadgetMinusTotal =
                            safeAmountBadget - totalAmount;

                          return (
                            <>
                              <tr>
                                <td className="text-end fw-bold">
                                  Remaining Budget:
                                </td>
                                <td
                                  colSpan="2"
                                  style={{
                                    fontWeight: "900",
                                    color:
                                      remainingBudget < 0
                                        ? "#dc3545"
                                        : "#198754",
                                    fontSize: "1.25rem",
                                    userSelect: "none",
                                  }}
                                >
                                  ₱
                                  {remainingBudget.toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>

                              <tr>
                                <td className="text-end fw-bold">
                                  Amountbadget - Total Amount:
                                </td>
                                <td
                                  colSpan="2"
                                  style={{
                                    fontWeight: "900",
                                    color:
                                      amountBadgetMinusTotal < 0
                                        ? "#dc3545"
                                        : "#198754",
                                    fontSize: "1.25rem",
                                    userSelect: "none",
                                  }}
                                >
                                  ₱
                                  {amountBadgetMinusTotal.toLocaleString(
                                    "en-PH",
                                    { minimumFractionDigits: 2 }
                                  )}
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                    </tfoot>
                  </table>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddCategoryRow}
                  >
                    + Add Category Row
                  </button>
                </Card.Body>
              </Card>

              {/* Remarks */}
              <div className="mb-3 mt-4">
                <label className="form-label">Remarks</label>
                <textarea
                  name="remarks"
                  className="form-control"
                  value={formData.remarks}
                  onChange={handleFormChange}
                  rows={4}
                />
              </div>

              {/* Navigation Buttons */}
              <div className="d-flex justify-content-between mt-3">
                <button
                  className="btn btn-outline-secondary"
                  onClick={handlePrevious}
                >
                  ← Previous
                </button>
                <div className="d-flex justify-content-end mt-3">
                  <Button
                    variant="success"
                    onClick={submit_all}
                    className="d-flex align-items-center"
                    style={{ marginTop: "1rem" }}
                  >
                    <FaSave className="me-2" /> Submit All
                  </Button>
                </div>
              </div>
            </div>
          )
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: "30px", overflowX: "auto" }} className="containes">
      {renderStepContent()}
    </div>
  );
};

export default RegularVisaForm;
