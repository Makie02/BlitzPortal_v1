import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from "sweetalert2"; // <---- import sweetalert2
import { supabase } from "../supabaseClient";
import { Modal, Button, Nav } from "react-bootstrap";
import { FaExclamationTriangle } from "react-icons/fa";
import { Table, Form, Card, Spinner } from "react-bootstrap";
import * as XLSX from "xlsx";
import { FaFileExcel, FaCloudUploadAlt, FaDownload, FaSave, FaSearch } from "react-icons/fa";
import { FiChevronRight } from "react-icons/fi"; // or FaArrowRight


const RegularVisaForm = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  // 👉 Add these states at the top of your component
  const [showPack, setShowPack] = useState(true);
  const [showCase, setShowCase] = useState(true);
  const [manualSrp, setManualSrp] = useState(false);
  const [activeBranchTabKey, setActiveBranchTabKey] = useState(null);
  const [branchPage, setBranchPage] = useState(1);
  const BRANCH_PAGE_SIZE = 15;
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // ✅ Fetch only Account_Users table
        const { data: usersData, error: usersError } = await supabase
          .from("Account_Users")
          .select("UserID, name")
          .order("created_at", { ascending: false });

        if (usersError) throw usersError;

        setUsers(usersData || []);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const [settings, setSettings] = useState({});
  const [motherAccount2List, setMotherAccount2List] = useState([]);

  const [accountSkuRows, setAccountSkuRows] = useState({}); // Object to store SKU rows per account
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
    activityDurationFrom: new Date().toISOString().split("T")[0],
    activityDurationTo: new Date().toISOString().split("T")[0],
    rowsCategories: [
      { category: "", amount: "" },
      { category: "", amount: "" },
    ],
    branchType: [],
    isPartOfCoverPwp: false,
    coverPwpCode: "",
    distributor: "",
    amountbadget: "0",
    categoryCode: [],
    categoryName: [],
    sku: null,
    accounts: null,
    amount_display: null,
    accountType2: "",
    MotherAccount2: null, // ✅ Added
  });

  const [allRegularPwpCodes, setAllRegularPwpCodes] = useState([]);
  const [loadingRegularPwpCodes, setLoadingRegularPwpCodes] = useState(true);
  // ---------------- Generate code with database lock ----------------
  // ---------------- Generate PREVIEW code (for UI display) ----------------


  // NEW
  const generatePreviewCode = (nextId) => {
    const year = new Date().getFullYear();
    return `R${year}-${nextId}`;
  };

  // ✅ Fetch current max id sa regular_pwp para malaman ang susunod na id
  const fetchMaxId = async () => {
    const { data, error } = await supabase
      .from("regular_pwp")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      console.error("❌ Error fetching max id:", error);
      return 0;
    }

    return data && data.length > 0 ? data[0].id : 0;
  };

  // NEW
  const generateAndClaimCode = async (supabase) => {
    const year = new Date().getFullYear();

    try {
      // 1️⃣ Insert placeholder record na may TEMPORARY code muna (hindi null, satisfies not-null constraint)
      const tempCode = `TEMP-${Date.now()}`;

      const { data: insertedData, error: insertError } = await supabase
        .from("regular_pwp")
        .insert([{
          regularpwpcode: tempCode,
          pwptype: "Regular",
          created_at: new Date().toISOString(),
          // Placeholder values - will be updated later
          credit_budget: 0,
          remaining_balance: 0,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // 2️⃣ Build FINAL code base sa DB id (guaranteed unique, walang race condition)
      const generatedCode = `R${year}-${insertedData.id}`;

      // 3️⃣ Update the same row, palitan yung temp code ng final code
      const { error: updateError } = await supabase
        .from("regular_pwp")
        .update({ regularpwpcode: generatedCode })
        .eq("id", insertedData.id);

      if (updateError) throw updateError;

      console.log(`✅ Successfully claimed code: ${generatedCode} (id: ${insertedData.id})`);
      return { code: generatedCode, recordId: insertedData.id };

    } catch (err) {
      console.error("❌ Failed to generate code:", err.message);
      throw new Error("Failed to generate unique code");
    }
  };
  // ---------------- Real-time subscription ----------------
  useEffect(() => {
    fetchRegularPwpCodes();

    // NEW (2 occurrences)
    const subscription = supabase
      .channel("public:regular_pwp")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "regular_pwp" },
        (payload) => {
          console.log("🔔 New row inserted, id:", payload.new.id);

          // ✅ Update preview to next id real-time
          const nextId = payload.new.id + 1;
          const newPreview = generatePreviewCode(nextId);

          setFormData((prevForm) => ({
            ...prevForm,
            regularpwpcode: newPreview,
            isPreviewCode: true
          }));

          console.log("📋 Updated preview:", newPreview);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // ✅ Update preview when codes array changes
  useEffect(() => {
    if (allRegularPwpCodes.length > 0) {
      const previewCode = generatePreviewCode(allRegularPwpCodes);
      setFormData((prev) => ({
        ...prev,
        regularpwpcode: previewCode,
        isPreviewCode: true
      }));
    }
  }, [allRegularPwpCodes]);


  useEffect(() => {
    const fetchMotherAccount2 = async () => {
      try {
        const { data, error } = await supabase
          .from("MotherAccount2")
          .select("*")
          .eq("status", true) // Only get active records
          .order("name", { ascending: true });

        if (error) {
          console.error("❌ Error fetching MotherAccount2:", error);
          return;
        }

        console.log("✅ MotherAccount2 data fetched:", data);
        setMotherAccount2List(data || []);
      } catch (err) {
        console.error("❌ Unexpected error fetching MotherAccount2:", err);
      }
    };

    fetchMotherAccount2();
  }, []);

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
  const fetchActivitySettings = async () => {
    const { data: settingsData, error: settingsError } = await supabase
      .from('activity_settings')
      .select('*');

    if (settingsError) {
      console.error('Error loading activity settings:', settingsError.message);
      return;
    }

    const settingsMap = {};
    settingsData.forEach(s => {
      settingsMap[s.activity_code] = s;
    });

    setSettings(settingsMap);
  };

  // Call it in useEffect
  useEffect(() => {
    fetchActivities();
    fetchActivitySettings(); // ✅ Add this
  }, []);

  React.useEffect(() => {
    async function fetchCoverPwpWithStatus() {
      try {
        console.log("🚀 Fetching PWP data with distributor names and approval status...");
        console.log("UserID:", UserID);

        // 1️⃣ Fetch amount_badget - INCLUDING THE APPROVED FIELD! 🔥
        const { data: amountData, error: amountError } = await supabase
          .from("amount_badget")
          .select("*, Approved"); // ✅ Make sure we get the Approved field
        if (amountError) throw amountError;

        console.log("📦 Raw amount_badget data:", amountData);

        // 🔍 Filter amountData to only include entries created by current user
        const filteredAmountData = amountData.filter(
          item => String(item.createduser) === String(UserID)
        );

        // 2️⃣ Fetch distributors
        const { data: distributorsData, error: distributorError } = await supabase
          .from("distributors")
          .select("code, name");
        if (distributorError) throw distributorError;

        // 3️⃣ Merge with distributor names
        const mergedData = filteredAmountData.map((item) => {
          // Find distributor name
          const matchingDistributor = distributorsData.find(
            (d) => String(d.code) === String(item.distributor)
          );

          // ✅ USE THE APPROVED FIELD DIRECTLY FROM amount_badget TABLE!
          const isApproved = item.Approved === true;

          console.log(`🔍 PWP ${item.pwp_code}:`, {
            Approved_field: item.Approved,
            isApproved: isApproved,
            distributor: matchingDistributor?.name || item.distributor
          });

          return {
            ...item,
            distributor: matchingDistributor ? matchingDistributor.name : item.distributor,
            approved: isApproved, // ✅ This now comes from amount_badget.Approved
          };
        });

        console.log("📦 Final mergedData with CORRECT approval:", mergedData);
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
      } else if (field === "TOTAL_AMOUNT") {
        // ✅ Manual total amount input — skip auto-computation
        row.TOTAL_AMOUNT = Number(value) || 0;
        rows[index] = row;
        updated[branchKey] = rows;
        return updated;
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
      // ✅ Don't overwrite a manually entered total
      if (row.TOTAL_AMOUNT === undefined || row.TOTAL_AMOUNT === null) {
        row.TOTAL_AMOUNT = row.BILLING_AMOUNT - discountAmount;
      }

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
      totals.TOTAL_AMOUNT += Number(row.TOTAL_AMOUNT || 0); // ✅ manual total
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

        totalQty += qty;
        totalBilling += billingAmount;
        totalDiscount += discount;
        totalAmount += Number(row.TOTAL_AMOUNT || 0); // ✅ manual total
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
      .select('category,activity_code,sku,accounts,amount_display,various,walk_in,mother1,"VariousAccount",branch,"MotherAccount2",sku_addional,"isPenalties","Supplies/M.E"');
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
        branch: setting.branch === true,
        category: setting.category === true,
        mother1: setting.mother1 === true,
        VariousAccount: setting.VariousAccount === true,
        various: setting.various === true,
        walk_in: setting.walk_in === true,
        MotherAccount2: setting.MotherAccount2 === true,
        sku_addional: setting.sku_addional === true,
        isPenalties: setting.isPenalties === true,
        suppliesME: setting["Supplies/M.E"] === true,

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



  const fetchMotherAccountsList = async () => {
    try {
      const distributorCode = formData.distributor;
      if (!distributorCode) return [];

      const { data: distributor, error: distributorError } = await supabase
        .from("distributors")
        .select("id, name, code, mother_accounts_code")
        .eq("code", distributorCode)
        .single();

      if (distributorError || !distributor) {
        console.warn("⚠️ No distributor record found for:", distributorCode);
        return [];
      }

      let motherCodes = [];
      if (distributor.mother_accounts_code) {
        if (Array.isArray(distributor.mother_accounts_code)) {
          motherCodes = distributor.mother_accounts_code;
        } else {
          motherCodes = distributor.mother_accounts_code
            .split(",")
            .map((code) => code.replace(/[()]/g, "").trim())
            .filter(Boolean);
        }
      }

      if (motherCodes.length === 0) {
        console.warn("⚠️ Distributor has no mother_accounts_code defined.");
        return [];
      }

      const { data: motherAccounts, error: motherError } = await supabase
        .from("mother_account")
        .select("code, name")
        .in("code", motherCodes.map(Number));

      if (motherError) throw motherError;

      const formattedData = motherCodes.map((code, index) => {
        const matched = motherAccounts?.find((acc) => String(acc.code) === String(code));
        return {
          id: index + 1,
          code,
          name: matched ? matched.name : code,
        };
      });

      setAccountTypes(formattedData); // keep state in sync too, harmless
      return formattedData;
    } catch (err) {
      console.error("❌ Error fetching mother accounts list:", err.message);
      return [];
    }
  };
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
  const [showModal_Account2, setShowModal_Account2] = useState(false);
  const [accountSearchTerm2, setAccountSearchTerm2] = useState("");
  const [isVariousAccountMode, setIsVariousAccountMode] = useState(false);
  const [selectedVariousAccount, setSelectedVariousAccount] = useState(null);

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

  const [accountsListCache, setAccountsListCache] = useState({});
  const [agentNamesMap, setAgentNamesMap] = useState({});
  const [motherAccountNamesMap, setMotherAccountNamesMap] = useState({});
  const [bpNamesMap, setBpNamesMap] = useState({});

  // ✅ STEP 1: Fetch Accounts_List ONLY when distributor changes
  // ✅ Main form change handler
  // ✅ 1. handleFormChange - Fixed version
  const handleFormChange = async (e) => {
    const { name, value } = e.target;
    console.log(`📝 Form change detected - Field: "${name}", Value: "${value}"`);

    if (name === "distributor") {
      setRowsAccounts([]);
      console.log("🧹 Cleared rowsAccounts due to distributor change");

      const selectedDistrib = distributors.find(
        (d) => String(d.code) === String(value)
      );

      if (!selectedDistrib) {
        console.warn("⚠️ Distributor not found for code:", value);
        return;
      }

      console.log(`📦 Selected Distributor:
    Code: ${selectedDistrib.code}
    Name: ${selectedDistrib.name}
    Description: ${selectedDistrib.description?.trim() || "N/A"}
    Agent Code: ${selectedDistrib.agent_code || "N/A"}`);

      // ✅ Check if data already cached
      if (accountsListCache[selectedDistrib.code]) {
        console.log("⚡ Using cached Accounts_List!");
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          distributorName: selectedDistrib.name || "",
        }));
        return;
      }

      // ✅ Fetch ALL Accounts_List for this distributor
      console.log("🔄 Fetching ALL Accounts_List for distributor...");

      try {
        // ✅ Fetch all lookup tables in parallel
        console.log(
          "📥 Fetching lookup tables (Account_Users, sub_mother_account, Bp_Accounts)..."
        );

        const [userResult, motherResult, bpResult] = await Promise.all([
          supabase.from("Account_Users").select("UserID, name"),
          supabase.from("sub_mother_account").select("dscode, name"),
          supabase.from("Bp_Accounts").select("bp_code, bp_name"),
        ]);

        // ✅ Process Account_Users mapping
        if (userResult.error) {
          console.error("❌ Failed to fetch Account_Users:", userResult.error);
        } else {
          const userMap = {};
          userResult.data.forEach((user) => {
            userMap[user.UserID] = user.name;
          });
          setAgentNamesMap(userMap);
          console.log(`✅ Mapped ${userResult.data.length} agent names`);
        }

        // ✅ Process sub_mother_account mapping
        if (motherResult.error) {
          console.error("❌ Failed to fetch sub_mother_account:", motherResult.error);
        } else {
          const motherMap = {};
          motherResult.data.forEach((mother) => {
            const cleanCode = mother.dscode?.trim() || "";
            const displayName =
              mother.name && mother.name.trim() !== ""
                ? mother.name.trim()
                : cleanCode;
            motherMap[cleanCode] = displayName;
            motherMap[mother.dscode] = displayName;
          });

          setMotherAccountNamesMap(motherMap);
          console.log(
            `✅ Mapped ${motherResult.data.length} mother account names (normalized):`,
            Object.keys(motherMap).slice(0, 10)
          );
        }

        // ✅ Process Bp_Accounts mapping
        if (bpResult.error) {
          console.error("❌ Failed to fetch Bp_Accounts:", bpResult.error);
        } else {
          const bpMap = {};
          bpResult.data.forEach((bp) => {
            bpMap[bp.bp_code.trim()] = bp.bp_name;
          });
          setBpNamesMap(bpMap);
          console.log(`✅ Mapped ${bpResult.data.length} BP names`);
          console.log("Sample BP mappings:", Object.entries(bpMap).slice(0, 5));
        }

        // ✅ Batched fetch for Accounts_List
        console.log("📦 Starting batched fetch for Accounts_List...");

        const batchSize = 1000;
        let allData = [];
        let hasMore = true;
        let offset = 0;
        let batchNumber = 1;

        while (hasMore) {
          console.log(`📥 Fetching batch ${batchNumber} (offset: ${offset})`);

          const { data, error } = await supabase
            .from("Accounts_List")
            .select("*")
            .eq("distributor_code", String(selectedDistrib.code))
            .order("id", { ascending: true })
            .range(offset, offset + batchSize - 1);

          if (error) {
            console.error("❌ Failed to fetch Accounts_List:", error);
            break;
          }

          const fetchedCount = data?.length || 0;
          console.log(`✅ Fetched batch ${batchNumber}: ${fetchedCount} records`);

          if (fetchedCount > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            batchNumber++;
            hasMore = fetchedCount === batchSize;
            console.log(`📊 Total records so far: ${allData.length}`);
          } else {
            hasMore = false;
            console.log("🏁 Finished fetching all Accounts_List records");
          }
        }

        // ✅ Check results
        if (allData.length === 0) {
          console.warn(
            `⚠️ No Accounts_List records found for distributor_code: ${selectedDistrib.code}`
          );
          Swal.fire("Notice", "No Accounts_List records found.", "info");
          return;
        }

        // ✅ Cache the data
        setAccountsListCache((prev) => ({
          ...prev,
          [selectedDistrib.code]: allData,
        }));

        console.log(
          `✅ Cached ${allData.length} records for distributor ${selectedDistrib.code}`
        );

        // ✅ Show *ALL* records in console
        console.group(
          `📊 Accounts_List for distributor_code: ${selectedDistrib.code}`
        );
        console.table(allData, [
          "id",
          "distributor_code",
          "mother_code",
          "bp_code",
          "agent_code",
          "group_code",
          "status",
        ]);
        console.groupEnd();
      } catch (err) {
        console.error("❌ Error fetching Accounts_List:", err.message);
      }
    }

    // Main state update block
    setAllowCoverToggle(true);
    setFormData((prev) => {
      const newForm = { ...prev, [name]: value };

      if (name === "activity") {
        const selectedActivity = activities.find((a) => a.code === value);
        newForm.activityName = selectedActivity?.name || "";

        const activitySetting = settingsMap[value] || {};
        newForm.sku = activitySetting.sku === true;
        newForm.accounts = activitySetting.accounts === true;
        newForm.amount_display = activitySetting.amount_display === true;
        newForm.category = activitySetting.category === true;
        newForm.various = activitySetting.various === true;
        newForm.walk_in = activitySetting.walk_in === true;
        newForm.sku_addional = activitySetting.sku_addional === true;
        newForm.isPenalties = activitySetting.isPenalties === true;
        newForm.suppliesME = activitySetting.suppliesME === true;
      }

      console.log("📋 Updated formData:", newForm);
      return newForm;
    });
  };
  const getAvailableGroupCodes = () => {
    const distributorCode = selectedDistributor?.code;
    if (!distributorCode) return new Set();

    const cachedData = accountsListCache[distributorCode];
    if (!cachedData?.length) return new Set();

    // Get unique group codes from cached data
    const groupCodes = new Set(
      cachedData
        .map(item => item.group_code?.toString().trim())
        .filter(Boolean)
    );

    console.log('📊 Available group_codes in cache:', Array.from(groupCodes));
    console.log('📋 Mother accounts (accountTypes):', accountTypes.map(a => ({ name: a.name, code: a.code })));

    return groupCodes;
  };
  // ✅ 2. fetchSubAccounts - Fixed version with agent_code matching
  const fetchSubAccounts = async (mother) => {
    try {
      setSelectedMother(mother);

      // Prevent duplicate fetch
      if (subAccounts[mother.id]) {
        console.log("✅ Using cached sub-accounts");
        return;
      }

      console.log("🟡 Fetching sub-accounts for mother:", mother);

      const distributorCode = selectedDistributor?.code;
      if (!distributorCode) {
        console.error("❌ No distributor selected!");
        return;
      }

      // ✅ Get logged-in user's ID
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const loggedInUserId = String(parsedUser?.UserID || parsedUser?.id || "");

      console.log(`👤 Logged in UserID: ${loggedInUserId}`);

      // ✅ Use cached data
      const cachedData = accountsListCache[distributorCode];
      if (!cachedData?.length) {
        console.warn("⚠️ No cached Accounts_List found.");
        console.log("Available cache keys:", Object.keys(accountsListCache));
        return;
      }

      console.log(`⚡ Using cached data: ${cachedData.length} records`);

      // --- clean + normalize strings safely ---
      const safeLower = (val) =>
        typeof val === "string"
          ? val.trim().toLowerCase()
          : String(val ?? "").toLowerCase();

      const selectedDistributorCode = safeLower(distributorCode);
      const selectedGroupCode = safeLower(mother.code);

      console.log("🔑 [DEBUG] Matching criteria:");
      console.log("  - Distributor Code:", selectedDistributorCode);
      console.log("  - Group Code:", selectedGroupCode);
      console.log("  - Agent Code:", loggedInUserId);

      // ✅ Filter by distributor_code AND group_code AND agent_code
      // ✅ Filter by distributor_code AND group_code ONLY
      const filteredData = cachedData.filter((item) => {
        const itemDistributorCode = safeLower(item.distributor_code);
        const itemGroupCode = safeLower(item.group_code);

        const distributorMatch = itemDistributorCode === selectedDistributorCode;
        const groupMatch = itemGroupCode === selectedGroupCode;

        return distributorMatch && groupMatch;
      });

      console.log(`🔍 After filtering: ${filteredData.length} records for group_code "${mother.code}" and agent "${loggedInUserId}"`);

      if (filteredData.length === 0) {
        console.warn(`⚠️ No records found for group_code "${mother.code}" and agent "${loggedInUserId}"`);
        Swal.fire({
          icon: 'info',
          title: 'No Sub-Accounts Found',
          text: `No branches assigned to you under "${mother.name}"`,
          timer: 2000
        });

        // ✅ Set empty array instead of leaving undefined
        setSubAccounts((prev) => ({ ...prev, [mother.id]: [] }));
        return;
      }

      // ✅ Remove duplicates (unique mother_code)
      const uniqueData = Array.from(
        new Map(
          filteredData.map((item) => {
            const cleanCode = (item.mother_code || "").trim();
            return [cleanCode.toLowerCase(), { ...item, mother_code: cleanCode }];
          })
        ).values()
      );

      console.log(`✨ After dedup: ${uniqueData.length} unique records`);
      console.log("🔍 Mother codes:", uniqueData.map((d) => d.mother_code));

      // ✅ Format for display
      const formattedData = uniqueData
        .map((item) => {
          const cleanCode = item.mother_code;
          const displayName = motherAccountNamesMap[cleanCode] ||
            motherAccountNamesMap[cleanCode.toLowerCase()] ||
            cleanCode;

          console.log(`🏷️ ${cleanCode} -> ${displayName}`);

          return {
            id: item.id,
            name: displayName,
            code: cleanCode,
            bp_code: item.bp_code ?? "",
            agent_code: item.agent_code ?? "",
            agent_name: agentNamesMap[item.agent_code] || item.agent_code,
            group_code: item.group_code,
            rawName: displayName.toUpperCase(),
          };
        })
        .sort((a, b) => {
          const isANonChain = a.rawName.includes("NON CHAIN");
          const isBNonChain = b.rawName.includes("NON CHAIN");
          if (isANonChain && !isBNonChain) return 1;
          if (!isANonChain && isBNonChain) return -1;
          return a.rawName.localeCompare(b.rawName);
        })
        .map(({ rawName, ...rest }) => rest);

      console.log(`[✅ FINAL] Displaying ${formattedData.length} sub-account(s) for group_code "${mother.code}" and agent "${loggedInUserId}"`);
      console.table(formattedData);

      setSubAccounts((prev) => ({ ...prev, [mother.id]: formattedData }));

      if (formattedData.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'No Results',
          text: 'No sub-accounts assigned to you',
          timer: 2000
        });
      }
    } catch (err) {
      console.error("❌ Unexpected error fetching sub-accounts:", err);
      Swal.fire("Error", err.message, "error");
    }
  };
  const fetchBranches = async (motherAccountCode, groupCode) => {
    try {
      console.log(`🔍 Fetching branches for Mother: ${motherAccountCode}, Group: ${groupCode}`);

      const distributorCode = selectedDistributor?.code;
      if (!distributorCode) {
        console.error("❌ No distributor selected!");
        return;
      }

      // ✅ Get logged-in user's ID
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const loggedInUserId = String(parsedUser?.UserID || parsedUser?.id || "");

      console.log(`👤 Logged in UserID: ${loggedInUserId}`);

      const cachedData = accountsListCache[distributorCode];
      if (!cachedData || cachedData.length === 0) {
        console.warn("⚠️ No cached Accounts_List found.");
        return;
      }

      const safeLower = (val) =>
        typeof val === "string"
          ? val.trim().toLowerCase()
          : String(val ?? "").toLowerCase();

      const selectedGroupCode = safeLower(groupCode);

      // ✅ Filter by: mother_code + group_code + bp_code + agent_code
      // ✅ Filter by: mother_code + group_code + bp_code ONLY
      const filteredData = cachedData.filter((item) => {
        const motherMatch = (item.mother_code || "").trim() === motherAccountCode.trim();
        const groupMatch = safeLower(item.group_code) === selectedGroupCode;
        const hasBpCode = item.bp_code && item.bp_code.trim() !== "";

        return motherMatch && groupMatch && hasBpCode;
      });

      console.log(`🔍 Filtered ${filteredData.length} branches for agent ${loggedInUserId}`);

      if (filteredData.length === 0) {
        console.warn("⚠️ No branches found for this agent.");
        Swal.fire({
          icon: 'info',
          title: 'No Branches Assigned',
          text: 'You do not have access to any branches under this mother account.',
          timer: 2000
        });
        setBranchTypes([]);
        return;
      }
      // 🔥 Get all unique BP codes from filtered data
      const allBpCodes = [...new Set(filteredData.map(row => (row.bp_code || "").trim()).filter(Boolean))];
      console.log(`📊 Total unique BP codes to fetch: ${allBpCodes.length}`);
      let allBpData = [];
      const batchSize = 1000;
      // 🔥 Fetch ALL BP names in batches (Supabase limit is 1000 per query)
      for (let i = 0; i < allBpCodes.length; i += batchSize) {
        const batch = allBpCodes.slice(i, i + batchSize);
        const { data: bpData, error: bpError } = await supabase
          .from("Bp_Accounts")
          .select("bp_code, bp_name")
          .in("bp_code", batch);

        if (bpError) {
          console.error("❌ Failed to fetch Bp_Accounts batch:", bpError);
          continue;
        }
        allBpData = [...allBpData, ...bpData];
      }

      const bpMap = {};
      allBpData.forEach((bp) => {
        if (bp.bp_code) bpMap[bp.bp_code.trim()] = bp.bp_name;
      });

      setBpNamesMap(prev => ({ ...prev, ...bpMap }));
      // Deduplicate by bp_code first
      const seenBpCodes = new Set();
      let uniqueBranches = filteredData
        .filter((row) => {
          const bpCode = (row.bp_code || "").trim();
          if (!bpCode || seenBpCodes.has(bpCode)) return false;
          seenBpCodes.add(bpCode);
          return true;
        })
        .map((row) => {
          const bpCode = (row.bp_code || "").trim();
          const branchName = bpMap[bpCode];

          return {
            id: row.id,
            name: branchName || bpCode,
            code: bpCode,
            bp_name: branchName || bpCode,
            status: row.status,
            distributor_code: row.distributor_code,
            agent_code: row.agent_code,
            group_code: row.group_code,
            mother_code: row.mother_code,
            agent_name: agentNamesMap[row.agent_code] || row.agent_code,
          };
        })
        .filter(Boolean);

      uniqueBranches.sort((a, b) => a.name.localeCompare(b.name));

      setBranchTypes(uniqueBranches);
      console.log(`✨ ${uniqueBranches.length} branches accessible by this agent`);
      console.table(uniqueBranches.slice(0, 10));

    } catch (err) {
      console.error("❌ Error fetching branches:", err.message);
      Swal.fire("Error", err.message, "error");
    }
  };


  const SUPPLIES_ME_OPTIONS = [
    "Supplies and Material Expense",
    "Ballpen",
    "Photocopy",
    "Diser Uniform",
    "Inventory Form",
    "Shelf Tag",
    "Barcode",
    "Tape",
    "BO Plastic",
  ];
  // ✅ NEW: Filter mother accounts based on agent access
  const getAvailableMotherAccounts = () => {
    const distributorCode = selectedDistributor?.code;
    if (!distributorCode) return [];

    const cachedData = accountsListCache[distributorCode];

    // ✅ If cache not yet loaded, show all accountTypes (fallback)
    if (!cachedData?.length) {
      console.log(`⚡ Cache not yet loaded for ${distributorCode}, showing all ${accountTypes.length} mother accounts`);
      return accountTypes;
    }

    const storedUser = localStorage.getItem("loggedInUser");
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const loggedInUserId = String(parsedUser?.UserID || parsedUser?.id || "");

    // Get unique group_codes where agent has access
    // ✅ No agent filter — all group_codes in cache are accessible
    const accessibleGroupCodes = new Set(
      cachedData
        .map(item => item.group_code?.toString().trim())
        .filter(Boolean)
    );

    console.log(`📊 Agent ${loggedInUserId} has access to group_codes:`, Array.from(accessibleGroupCodes));

    // ✅ If agent has no matching group_codes but cache is loaded, still show all (safety fallback)
    if (accessibleGroupCodes.size === 0) {
      console.warn(`⚠️ No group_codes found for agent ${loggedInUserId} in cache — showing all mother accounts as fallback`);
      return accountTypes;
    }

    const filteredMotherAccounts = accountTypes.filter(opt => {
      const hasAccess = accessibleGroupCodes.has(opt.code?.toString().trim());
      if (!hasAccess) {
        console.log(`🚫 Hiding "${opt.name}" (${opt.code}) - no branches assigned to this agent`);
      }
      return hasAccess;
    });

    console.log(`✅ Showing ${filteredMotherAccounts.length} out of ${accountTypes.length} mother accounts`);
    return filteredMotherAccounts;
  };
  // ✅ Helper: kunin lahat ng chain branches sa LAHAT ng group, hindi lang last-clicked
  const getAllBranchItemsFlat = () => {
    return groupedBranches
      .filter((g) => !g.isNonChain)
      .flatMap((g) => g.items);
  };

  const getFilteredBranchesWithExtras = () => {
    const allItems = getAllBranchItemsFlat();

    let filtered = allItems.filter((opt) =>
      formData.branchType.includes(opt.name) && // ✅ dapat naka-select talaga
      opt.name.toLowerCase().includes(branchSearchTerm.toLowerCase())
    );

    // dedupe kung may parehong pangalan sa magkaibang group
    const seen = new Set();
    filtered = filtered.filter((opt) => {
      if (seen.has(opt.name)) return false;
      seen.add(opt.name);
      return true;
    });

    if (formData.various) {
      filtered.push({ id: "various", name: "Various", distributor_code: "N/A", status: true });
    }
    if (formData.walk_in) {
      filtered.push({ id: "walk_in", name: "Walk In", distributor_code: "N/A", status: true });
    }

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

    // Remove existing commas
    value = value.replace(/,/g, "");

    // Allow only digits and one decimal
    if (/^\d*\.?\d*$/.test(value)) {
      // Split whole + decimal
      let [whole, decimal] = value.split(".");

      // Format whole part with commas
      if (whole) {
        whole = formatNumberWithCommas(whole);
      }

      // Rebuild formatted value
      const formattedValue = decimal !== undefined ? `${whole}.${decimal}` : whole;

      setRawAmount(formattedValue);

      // Save **unformatted value** to formData
      handleFormChange({
        target: {
          name: "amountbadget",
          value: value, // unformatted number with decimal
        },
      });
    }
  };

  // 1st page for SKU

  const UOM_OPTIONS = ["Case", "PC", "IBX"];

  const PENALTY_OPTIONS = [
    "Lacking of 1 item",
    "Pilferage",
    "Rat Bites",
    "Lacking 1box upon delivery",
    "Absent Merchandiser",
    "Late Merchandiser",
  ];

  // Helper para sa SKU / Penalty / Budget updates sa rowsAccounts
  const updateBranchRowField = (accountCode, field, value) => {
    setRowsAccounts((prevRows) => {
      const existingIndex = prevRows.findIndex((r) => r.account_code === accountCode);
      if (existingIndex !== -1) {
        const updated = [...prevRows];
        updated[existingIndex] = { ...updated[existingIndex], [field]: value };
        return updated;
      }
      const newRow = {
        account_code: accountCode,
        account_name: accountCode,
        budget: 0,
        sku: "",
        penalty: "",
        created_at: new Date().toISOString(),
        [field]: value,
      };
      return [...prevRows, newRow];
    });
  };

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

  // ✅ Supplies / Material Expense fixed item list
  const SUPPLIES_ITEMS = [
    "Ballpen",
    "Photocopy",
    "Diser Uniform",
    "Inventory Form",
    "Shelf Tag",
    "Barcode",
    "Tape",
    "BO Plastic",
  ];

  const [suppliesRows, setSuppliesRows] = useState(
    SUPPLIES_ITEMS.map((item) => ({ item, amount: "" }))
  );

  const handleSuppliesAmountChange = (index, value) => {
    setSuppliesRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount: value };
      return updated;
    });
  };

  const calculateSuppliesTotal = () => {
    return suppliesRows.reduce(
      (sum, row) => sum + (parseFloat(row.amount) || 0),
      0
    );
  };

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
  const loggedInUserId = String(parsedUser?.UserID || parsedUser?.id || "");
  console.log("[DEBUG] Logged in user ID:", loggedInUserId);

  // ✅ Fetch distributors assigned to the logged-in agent
  useEffect(() => {
    const fetchDistributorsByAgent = async () => {
      if (!loggedInUserId) {
        console.warn("[WARN] No logged-in user ID found, skipping distributor fetch.");
        return;
      }

      console.log(`🔍 Logged in UserID: ${loggedInUserId}`);

      try {
        setLoading(true);

        // 1️⃣ Fetch all distributors
        const { data: distributorsData, error: distributorsError } = await supabase
          .from("distributors")
          .select("*")
          .order("name", { ascending: true });

        if (distributorsError) throw distributorsError;
        if (!distributorsData || distributorsData.length === 0) {
          console.warn("⚠️ No distributors found.");
          Swal.fire("Notice", "No distributors found in the database.", "info");
          return;
        }

        console.log(`📦 Total distributors fetched: ${distributorsData.length}`);

        // 2️⃣ Filter only those where loggedInUserId is inside agent_code list
        const filtered = distributorsData.filter((d) => {
          const agentCodes = (d.agent_code || "")
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          return agentCodes.includes(String(loggedInUserId));
        });

        console.log(`✅ Distributors assigned to agent ${loggedInUserId}:`, filtered);

        // 3️⃣ Fetch Account_Users for name lookup
        const { data: usersData, error: usersError } = await supabase
          .from("Account_Users")
          .select("UserID, name");

        if (usersError) throw usersError;

        // 4️⃣ Create a map for UserID → name
        const userMap = {};
        usersData.forEach((u) => {
          userMap[String(u.UserID)] = u.name;
        });

        // 5️⃣ Add readable agent names for display
        const distributorsWithAgentNames = filtered.map((dist) => {
          const agentCodes = (dist.agent_code || "")
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          const agentNames = agentCodes
            .map((code) => userMap[code] || code)
            .join(", ");
          return { ...dist, agentNames };
        });

        console.log("📋 Distributors with agent names:", distributorsWithAgentNames);

        // 6️⃣ Update state
        setDistributors(distributorsWithAgentNames);
        setFilteredDistributors(distributorsWithAgentNames);
      } catch (err) {
        console.error("[ERROR] Fetching distributors by agent_code:", err);
        Swal.fire("Error", "Failed to load distributors.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchDistributorsByAgent();
  }, [loggedInUserId]);

  // ✅ NEW helper — ilagay malapit sa formatGroupLabelForDisplay
  const getGroupInnerLabel = (group) => {
    const { bold, rest } = formatGroupLabelForDisplay(group.groupLabel);
    return `${bold}${rest}`;
  };

  // ✅ NEW helper — ginagamit ng parehong submit functions sa baba
  const buildConvertedAccountType = (accountTypeArray) => {
    if (!Array.isArray(accountTypeArray)) return [];

    const labels = accountTypeArray
      .map((id) => {
        // 1) chain sub-account groups
        const chainGroup = groupedBranches.find(
          (g) => !g.isNonChain && g.subAccountId === id
        );
        if (chainGroup) return getGroupInnerLabel(chainGroup);

        // 2) ✅ NEW: NON-CHAIN items galing sa bagong Branch modal
        for (const g of groupedBranches) {
          if (g.isNonChain) {
            const item = g.items.find((i) => i.id === id);
            if (item) return item.name;
          }
        }

        // 3) fallback: legacy subAccounts (lumang modal flow)
        const legacy = Object.values(subAccounts).flat().find((s) => s.id === id);
        return legacy?.name;
      })
      .filter(Boolean);

    return [...new Set(labels)];
  };


  const [approvalList, setApprovalList] = useState([]);
  const [penaltyOptions, setPenaltyOptions] = useState([]);
  const [suppliesOptions, setSuppliesOptions] = useState([]);

  useEffect(() => {
    const fetchDynamicOptions = async () => {
      try {
        const { data, error } = await supabase
          .from("activity_change_ps")
          .select("*")
          .eq("status", true)
          .order("id", { ascending: true });

        if (error) throw error;

        setPenaltyOptions((data || []).filter((row) => row.option_type === "penalty"));
        setSuppliesOptions((data || []).filter((row) => row.option_type === "supplies"));
      } catch (err) {
        console.error("❌ Error fetching activity_change_ps:", err.message);
        setPenaltyOptions([]);
        setSuppliesOptions([]);
      }
    };

    fetchDynamicOptions();
  }, []);
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

  const handleSku = async (generatedCode) => {
    setLoading(true);
    setMessage("");

    try {
      const allRows = Object.keys(accountSkuRows).flatMap((accountCode) =>
        (accountSkuRows[accountCode] || []).map((row) => {
          const account = accountTypes.find((acc) => acc.code === accountCode);
          const srp = toNumber(row.SRP);
          const qty = toNumber(row.QTY);
          const discountValue = toNumber(row.DISCOUNT);
          const billingAmount = srp * qty;
          const totalAmount = billingAmount - discountValue;

          return {
            account_name: account?.name || accountCode,
            sku_code: row.SKUITEM ?? null,
            srp,
            qty,
            uom: row.UOM?.trim() ? row.UOM : "pc",
            billing_amount: billingAmount,
            discount: discountValue,
            total_amount: totalAmount,
            remaining_balance: 0,
            regular_code: generatedCode,
            created_at: new Date().toISOString(),
          };
        })
      );

      if (!allRows.length) {
        setMessage("⚠️ No SKUs to submit.");
        setLoading(false);
        return;
      }

      const totalBilling = allRows.reduce((sum, r) => sum + r.billing_amount, 0);
      const totalDiscount = allRows.reduce((sum, r) => sum + r.discount, 0);
      const grandTotal = totalBilling - totalDiscount;

      const selected = parseFloat(selectedBalance || 0);
      const creditBudget = parseFloat(formData?.amountbadget || 0);
      const remainingSkuBudget = selected - grandTotal - creditBudget;

      const rowsWithTotals = allRows.map((r) => ({
        ...r,
        remaining_balance: remainingSkuBudget,
      }));

      const { error: insertError } = await supabase
        .from("regular_sku")
        .insert(rowsWithTotals);

      if (insertError) throw insertError;

      console.log("✅ SKUs inserted:", rowsWithTotals.length);

      await upsertRegularPwp(supabase, generatedCode, remainingSkuBudget, grandTotal);

      setMessage("✅ SKUs submitted successfully!");
    } catch (err) {
      console.error("❌ SKU submit error:", err.message);
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  async function upsertRegularPwp(supabase, regularpwpcode, remainingSkuBudget, totalAmount) {
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

  const postBadOrderCategories = async (generatedCode) => {
    if (!generatedCode) {
      alert("PWP Code is missing.");
      return false;
    }

    if (formData.rowsCategories.length === 0) {
      alert("No bad order categories to submit.");
      return false;
    }

    const totalAmount = formData.rowsCategories.reduce((sum, row) => {
      return sum + (parseFloat(row.amount) || 0);
    }, 0);

    const safeSelectedBalance = isNaN(selectedBalance) ? 0 : selectedBalance;
    const amountBadgetMinusTotal = safeSelectedBalance - totalAmount;

    const rowsToInsert = formData.rowsCategories.map((row) => ({
      code_pwp: generatedCode,
      category: row.category,
      amount: parseFloat(row.amount) || 0,
      remarks: formData.remarks || "",
      created_at: new Date().toISOString(),
      total: totalAmount,
      remaining_budget: amountBadgetMinusTotal,
    }));

    try {
      const { data, error } = await supabase
        .from("regular_badorder")
        .insert(rowsToInsert);

      if (error) throw error;

      console.log("✅ Bad order categories submitted");

      await upsertRegularPwp(supabase, generatedCode, amountBadgetMinusTotal, totalAmount);

      return true;
    } catch (error) {
      console.error("❌ Error submitting bad order:", error.message);
      alert(`Error: ${error.message}`);
      return false;
    }
  };


  // ✅ Function to insert/update into regular_pwp
  // ✅ Function to insert/update into regular_pwp//////////////////////////////
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



  // 🔹 Handle All Submissions (SKU + Form + Budgets)


  // ============================================================
  const submit_all = async (e) => {
    e.preventDefault();

    // 🔒 LOCK to prevent multiple simultaneous submits from same user
    if (window.isSubmitting) {
      console.warn("⚠️ Already submitting, please wait...");
      return;
    }
    window.isSubmitting = true;

    let generatedCode = null;
    let recordId = null;

    try {
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const createdBy = parsedUser?.name || "Unknown";

      // 📊 Calculate remaining budget (can be negative)
      // ✅ FIX: Ensure selectedBalance is a valid number, default to 0
      let remainingBudget = parseFloat(selectedBalance) || 0;

      if (rowsAccounts.length > 0 && selectedBalance != null) {
        const totalFromBranches = rowsAccounts.reduce(
          (sum, row) => sum + (parseFloat(row.budget) || 0),
          0
        );
        remainingBudget = parseFloat(selectedBalance) - totalFromBranches;
        console.log(`💰 Remaining Budget (Branches): ₱${remainingBudget.toLocaleString()}`);
      }

      if (formData.amountbadget && parseFloat(formData.amountbadget) > 0 && selectedBalance != null) {
        const allocatedAmount = parseFloat(formData.amountbadget);
        remainingBudget = parseFloat(selectedBalance) - allocatedAmount;
        console.log(`💰 Remaining Budget (Form): ₱${remainingBudget.toLocaleString()}`);
      }

      // 🌀 Show loading modal
      Swal.fire({
        title: "⏳ Generating Code...",
        html: `
        <div style="width:100%; background:#eee; border-radius:6px; height:10px; margin-top:10px;">
          <div style="width:30%; height:100%; background:linear-gradient(90deg, #4f46e5, #06b6d4); border-radius:6px; animation:pulse 1s infinite;"></div>
        </div>
        <p style="margin-top:8px; font-size:14px; color:#555;">Claiming unique PWP code...</p>
      `,
        allowOutsideClick: false,
        showConfirmButton: false,
      });

      // 🔐 ATOMIC CODE GENERATION - This prevents duplicates!
      const codeResult = await generateAndClaimCode(supabase);
      generatedCode = codeResult.code;
      recordId = codeResult.recordId;

      console.log(`🎯 Claimed code: ${generatedCode}, ID: ${recordId}`);

      // Update loading message
      Swal.update({
        title: "⏳ Submitting Data...",
        html: `
        <div id="progress-container" style="width:100%; background:#eee; border-radius:6px; height:10px; margin-top:10px;">
          <div id="progress-bar" style="width:0%; height:100%; background:linear-gradient(90deg, #4f46e5, #06b6d4); border-radius:6px; transition:width 0.3s;"></div>
        </div>
        <p style="margin-top:8px; font-size:14px; color:#555;">Please wait...</p>
        <p style="font-size:12px; color:#888; margin-top:4px;">PWP Code: <strong>${generatedCode}</strong></p>
      `,
      });

      const progressBar = Swal.getHtmlContainer().querySelector("#progress-bar");
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 2;
        if (progressBar) progressBar.style.width = `${Math.min(progress, 90)}%`;
        if (progress >= 90) clearInterval(progressInterval);
      }, 100);

      // Update formData with the claimed code
      const updatedFormData = {
        ...formData,
        regularpwpcode: generatedCode,
        isPreviewCode: false
      };

      // 📝 Now update the placeholder record with full data
      await updateRegularPwpRecord(recordId, updatedFormData, createdBy);

      // 📝 Submit related data
      await handleSku(generatedCode);
      await saveRecentActivity();

      // 🔍 Submit BAD ORDER if applicable
      if (updatedFormData.activityName === "BAD ORDER") {
        const badorderSuccess = await postBadOrderCategories(generatedCode);
        if (!badorderSuccess) {
          throw new Error("Bad order submission failed");
        }
      }

      // 💾 Save to regular_accountlis_badget
      if (rowsAccounts.length > 0) {
        console.log(`💾 Saving budget data...`);

        const filteredRows =
          (updatedFormData.branchType || []).length > 0
            ? rowsAccounts.filter((row) =>
              (updatedFormData.branchType || []).includes(row.account_name)
            )
            : rowsAccounts;

        const totalBudget = filteredRows
          .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0)
          .toFixed(2);

        // 🔴 Note: Budget can be negative if exceeded
        const budgetRowsToInsert = filteredRows.map((row) => ({
          regularcode: generatedCode,
          account_name: row.account_name,
          budget: row.budget || 0,
          created_at: row.created_at || new Date().toISOString(),
          createform: createdBy,
          total_budget: totalBudget,
        }));

        const { error: budgetError } = await supabase
          .from("regular_accountlis_badget")
          .insert(budgetRowsToInsert);

        if (budgetError) throw budgetError;

        // ✅ FIX: Safely format remainingBudget
        const formattedBudget = (remainingBudget != null && !isNaN(remainingBudget))
          ? remainingBudget.toLocaleString()
          : '0';

        console.log(`✅ Budget data saved (Remaining: ₱${formattedBudget})`);
      }

      // Upload attachments
      if (files.length > 0) {
        await Promise.all(
          files.map(async (file) => {
            const base64String = await toBase64(file);
            const attachmentPayload = {
              regularpwpcode: generatedCode,
              filename: file.name,
              mimetype: file.type,
              size: file.size,
              file_data: base64String,
            };
            const { error: attachmentError } = await supabase
              .from("regular_attachments")
              .insert([attachmentPayload]);
            if (attachmentError) {
              throw new Error(`Attachment failed for ${file.name}: ${attachmentError.message}`);
            }
          })
        );
        console.log("✅ Attachments uploaded");
      }

      clearInterval(progressInterval);
      if (progressBar) progressBar.style.width = "100%";

      // ✅ FIX: Safe formatting for success modal
      const formattedRemainingBudget = (remainingBudget != null && !isNaN(remainingBudget))
        ? remainingBudget.toLocaleString()
        : '0';

      // ✅ Success modal
      await Swal.fire({
        title: "✅ Success!",
        html: `
        <p>Your data has been successfully submitted!</p>
        <p style="margin-top:8px;"><strong>PWP Code:</strong> <span style="color:#16a34a;">${generatedCode}</span></p>
        ${remainingBudget < 0 ? `<p style="margin-top:4px; color:#dc2626;"><strong>⚠️ Budget Exceeded:</strong> ₱${formattedRemainingBudget}</p>` : ''}
        <div style="height:6px; background:linear-gradient(90deg,#16a34a,#4ade80); width:100%; border-radius:4px;"></div>
      `,
        icon: "success",
        showConfirmButton: false,
        timer: 2000,
      });

      window.location.reload();

    } catch (error) {
      console.error(`❌ Submit Error:`, error);

      // If we claimed a code but submission failed, delete the placeholder
      if (recordId) {
        try {
          await supabase.from("regular_pwp").delete().eq("id", recordId);
          console.log(`🗑️ Rolled back placeholder record ${recordId}`);
        } catch (rollbackError) {
          console.error("❌ Rollback failed:", rollbackError);
        }
      }

      Swal.fire({
        title: "Error!",
        text: `There was an issue submitting your data: ${error.message}`,
        icon: "error",
        confirmButtonText: "Try Again",
      });
    } finally {
      window.isSubmitting = false;
    }
  };
  // ============================================================
  // 🔄 Helper: Update the placeholder record with full data
  // ============================================================

  const updateRegularPwpRecord = async (recordId, updatedFormData) => {
    try {
      let distributorCode = updatedFormData.distributor?.trim() || null;
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
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const createdBy = parsedUser?.UserID || "Unknown";
      const amountBudget = parseFloat(updatedFormData.amountbadget || 0);
      const billingAmountSKU = rows.reduce((acc, row) => acc + (parseFloat(row.BILLING_AMOUNT) || 0), 0);
      const totalAllocatedFromAccounts = rowsAccounts.reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);
      const creditBudget = amountBudget || billingAmountSKU || totalAllocatedFromAccounts;
      const remainingBalance = selectedBalance !== null ? selectedBalance - creditBudget : null;

      const convertedAccountType = buildConvertedAccountType(updatedFormData.accountType);
      let finalAccountType = convertedAccountType;
      if (updatedFormData.MotherAccount2) {
        finalAccountType = [updatedFormData.MotherAccount2];
      } else if (updatedFormData.accountType2) {
        finalAccountType = [updatedFormData.accountType2];
      }

      const updateData = {
        accountType: finalAccountType,
        VariousAccount: updatedFormData.accountType2,
        branchType: updatedFormData.branchType || [],
        activity: updatedFormData.activity,
        pwptype: updatedFormData.pwptype || "Regular",
        notification: updatedFormData.notification,
        objective: updatedFormData.objective,
        promoScheme: updatedFormData.promoScheme,
        activityDurationFrom: updatedFormData.activityDurationFrom,
        activityDurationTo: updatedFormData.activityDurationTo,
        isPartOfCoverPwp: updatedFormData.isPartOfCoverPwp,
        coverPwpCode: updatedFormData.coverPwpCode,
        distributor: distributorCode,
        amountbadget: updatedFormData.amountbadget,
        categoryCode: updatedFormData.categoryCode || [],
        categoryName: updatedFormData.categoryName || [],
        sku: updatedFormData.sku,
        accounts: updatedFormData.accounts,
        amount_display: updatedFormData.amount_display,
        remarks: updatedFormData.remarks || "",
        createForm: createdBy,
        credit_budget: creditBudget,
        remaining_balance: remainingBalance,
      };

      const { error: updateError } = await supabase
        .from("regular_pwp")
        .update(updateData)
        .eq("id", recordId);

      if (updateError) throw new Error(`Record update failed: ${updateError.message}`);

      console.log("✅ Main record updated");

    } catch (error) {
      console.error("❌ Update record error:", error.message);
      throw error;
    }
  };

  // ============================================================
  // 📋 Real-time preview code updates (unchanged)
  // ============================================================

  // NEW
  const fetchRegularPwpCodes = async () => {
    try {
      setLoadingRegularPwpCodes(true);

      const maxId = await fetchMaxId();
      const nextId = maxId + 1;

      // ✅ Set initial preview code base sa susunod na id
      const previewCode = generatePreviewCode(nextId);
      setFormData((prev) => ({
        ...prev,
        regularpwpcode: previewCode,
        isPreviewCode: true
      }));

      console.log("📋 Preview code:", previewCode, "(next id:", nextId, ")");
    } catch (err) {
      console.error("❌ Error fetching preview code:", err);
    } finally {
      setLoadingRegularPwpCodes(false);
    }
  };

  // Real-time subscription for preview updates
  useEffect(() => {
    fetchRegularPwpCodes();

    const subscription = supabase
      .channel("public:regular_pwp")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "regular_pwp" },
        (payload) => {
          console.log("🔔 New PWP code inserted:", payload.new.regularpwpcode);

          setAllRegularPwpCodes((prev) => {
            const updated = [...prev, payload.new.regularpwpcode];

            // ✅ Update preview to next available
            const newPreview = generatePreviewCode(updated);
            setFormData((prevForm) => ({
              ...prevForm,
              regularpwpcode: newPreview,
              isPreviewCode: true
            }));

            console.log("📋 Updated preview:", newPreview);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);




  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const handleSubmitFormAndAttachments = async (updatedFormData) => {
    try {
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const createdBy = parsedUser?.UserID || "Unknown";

      if (!updatedFormData.regularpwpcode?.trim()) {
        throw new Error("Regular PWP Code is required.");
      }

      let distributorCode = updatedFormData.distributor?.trim() || null;
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

      const amountBudget = parseFloat(updatedFormData.amountbadget || 0);
      const billingAmountSKU = rows.reduce((acc, row) => acc + (parseFloat(row.BILLING_AMOUNT) || 0), 0);
      const totalAllocatedFromAccounts = rowsAccounts.reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);
      const creditBudget = amountBudget || billingAmountSKU || totalAllocatedFromAccounts;
      const remainingBalance = selectedBalance !== null ? selectedBalance - creditBudget : null;

      let convertedAccountType = [];
      if (Array.isArray(updatedFormData.accountType)) {
        convertedAccountType = updatedFormData.accountType
          .map((id) => Object.values(subAccounts).flat().find((s) => s.id === id)?.name)
          .filter(Boolean);
      } else if (updatedFormData.accountType) {
        const name = Object.values(subAccounts).flat().find((s) => s.id === updatedFormData.accountType)?.name;
        convertedAccountType = name ? [name] : [];
      }

      let finalAccountType = convertedAccountType;
      if (updatedFormData.MotherAccount2) {
        finalAccountType = [updatedFormData.MotherAccount2];
      } else if (updatedFormData.accountType2) {
        finalAccountType = [updatedFormData.accountType2];
      }

      const submissionData = {
        regularpwpcode: updatedFormData.regularpwpcode,
        accountType: finalAccountType,
        VariousAccount: updatedFormData.accountType2,
        branchType: updatedFormData.branchType || [],
        activity: updatedFormData.activity,
        pwptype: updatedFormData.pwptype || "Regular",
        notification: updatedFormData.notification,
        objective: updatedFormData.objective,
        promoScheme: updatedFormData.promoScheme,
        activityDurationFrom: updatedFormData.activityDurationFrom,
        activityDurationTo: updatedFormData.activityDurationTo,
        isPartOfCoverPwp: updatedFormData.isPartOfCoverPwp,
        coverPwpCode: updatedFormData.coverPwpCode,
        distributor: distributorCode,
        amountbadget: updatedFormData.amountbadget,
        categoryCode: updatedFormData.categoryCode || [],
        categoryName: updatedFormData.categoryName || [],
        sku: updatedFormData.sku,
        accounts: updatedFormData.accounts,
        amount_display: updatedFormData.amount_display,
        remarks: updatedFormData.remarks || "",
        created_at: new Date().toISOString(),
        createForm: createdBy,
        credit_budget: creditBudget,
        remaining_balance: remainingBalance,
      };

      const { error: formInsertError } = await supabase
        .from("regular_pwp")
        .insert([submissionData])
        .select();

      if (formInsertError) throw new Error(`Form Insert failed: ${formInsertError.message}`);

      console.log("✅ Main form submitted");

      if (files.length > 0) {
        await Promise.all(
          files.map(async (file) => {
            const base64String = await toBase64(file);
            const attachmentPayload = {
              regularpwpcode: updatedFormData.regularpwpcode,
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
              throw new Error(`Attachment failed for ${file.name}: ${attachmentError.message}`);
            }
          })
        );
        console.log("✅ Attachments uploaded");
      }

      // Reset state
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

    } catch (error) {
      console.error("❌ Form submission error:", error.message);
      throw error;
    }
  };

  const saveRecentActivity = async () => {
    try {
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const userId = parsedUser?.UserID || "Unknown";

      const ipRes = await fetch("https://api.ipify.org?format=json");
      const { ip } = await ipRes.json();

      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geo = await geoRes.json();

      const activity = {
        Device: navigator.userAgent || "Unknown Device",
        Location: `${geo.city || "Unknown"}, ${geo.region || "Unknown"}, ${geo.country_name || "Unknown"}`,
        IP: ip,
        Time: new Date().toISOString(),
        Action: "Create Form Regular PWP",
      };

      const { error } = await supabase.from("RecentActivity").insert([
        {
          userId: userId,
          device: activity.Device,
          location: activity.Location,
          ip: activity.IP,
          time: activity.Time,
          action: activity.Action,
        },
      ]);

      if (error) {
        console.error("❌ Activity log error:", error.message);
      } else {
        console.log("✅ Activity logged");
      }
    } catch (err) {
      console.error("❌ Failed to log activity:", err.message || err);
    }
  };

  const [message, setMessage] = useState("");

  // Handle Excel Import

  // Trigger hidden file input


  const [tabs, setTabs] = useState([]);








  const [subAccounts, setSubAccounts] = useState({});
  const [selectedMother, setSelectedMother] = useState(null);
  const [subSearchTerm, setSubSearchTerm] = useState("");
  const [selectedBranchForSku, setSelectedBranchForSku] = useState("ALL_BRANCHES");

  const [showModal_Branch, setShowModal_Branch] = useState(false);

  const [branchTypes, setBranchTypes] = useState([]);
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [groupedBranches, setGroupedBranches] = useState([]);
  const [loadingGroupedBranches, setLoadingGroupedBranches] = useState(false);

  useEffect(() => {
    setBranchPage(1);
  }, [activeBranchTabKey, branchSearchTerm, showModal_Branch]);

  // Kinukuha lang laman sa loob ng () at hinihiwalay ang unang part (Direct Mega/Direct Distributor) para gawing bold
  const formatGroupLabelForDisplay = (label) => {
    const match = label.match(/\(([^)]+)\)/); // kunin laman sa loob ng ()
    const inner = match ? match[1] : label; // fallback sa buong label kung walang ()
    const dashIndex = inner.indexOf(" - ");
    if (dashIndex === -1) return { bold: inner, rest: "" };
    return {
      bold: inner.slice(0, dashIndex),
      rest: inner.slice(dashIndex), // kasama yung " - ..."
    };
  };

  // NEW - add after the existing fetchBranches function

  // Pure version of fetchSubAccounts — returns data, walang side effects
  const computeSubAccountsForMother = (mother) => {
    const distributorCode = selectedDistributor?.code;
    if (!distributorCode) return [];

    const cachedData = accountsListCache[distributorCode];
    if (!cachedData?.length) return [];

    const safeLower = (val) =>
      typeof val === "string" ? val.trim().toLowerCase() : String(val ?? "").toLowerCase();

    const selectedDistributorCode = safeLower(distributorCode);
    const selectedGroupCode = safeLower(mother.code);

    const filteredData = cachedData.filter((item) => {
      const itemDistributorCode = safeLower(item.distributor_code);
      const itemGroupCode = safeLower(item.group_code);
      return itemDistributorCode === selectedDistributorCode && itemGroupCode === selectedGroupCode;
    });

    if (filteredData.length === 0) return [];

    const uniqueData = Array.from(
      new Map(
        filteredData.map((item) => {
          const cleanCode = (item.mother_code || "").trim();
          return [cleanCode.toLowerCase(), { ...item, mother_code: cleanCode }];
        })
      ).values()
    );

    return uniqueData.map((item) => {
      const cleanCode = item.mother_code;
      const displayName =
        motherAccountNamesMap[cleanCode] || motherAccountNamesMap[cleanCode.toLowerCase()] || cleanCode;
      return {
        id: item.id,
        name: displayName,
        code: cleanCode,
        group_code: item.group_code,
      };
    });
  };

  // Pure version of fetchBranches — returns data instead of setState
  const fetchBranchesForSub = async (motherAccountCode, groupCode) => {
    const distributorCode = selectedDistributor?.code;
    if (!distributorCode) return [];

    const cachedData = accountsListCache[distributorCode];
    if (!cachedData || cachedData.length === 0) return [];

    const safeLower = (val) =>
      typeof val === "string" ? val.trim().toLowerCase() : String(val ?? "").toLowerCase();

    const selectedGroupCode = safeLower(groupCode);

    const filteredData = cachedData.filter((item) => {
      const motherMatch = (item.mother_code || "").trim() === motherAccountCode.trim();
      const groupMatch = safeLower(item.group_code) === selectedGroupCode;
      const hasBpCode = item.bp_code && item.bp_code.trim() !== "";
      return motherMatch && groupMatch && hasBpCode;
    });

    if (filteredData.length === 0) return [];

    const allBpCodes = [...new Set(filteredData.map((row) => (row.bp_code || "").trim()).filter(Boolean))];
    let allBpData = [];
    const batchSize = 1000;

    for (let i = 0; i < allBpCodes.length; i += batchSize) {
      const batch = allBpCodes.slice(i, i + batchSize);
      const { data: bpData, error: bpError } = await supabase
        .from("Bp_Accounts")
        .select("bp_code, bp_name")
        .in("bp_code", batch);
      if (bpError) {
        console.error("❌ Failed to fetch Bp_Accounts batch:", bpError);
        continue;
      }
      allBpData = [...allBpData, ...bpData];
    }

    const bpMap = {};
    allBpData.forEach((bp) => {
      if (bp.bp_code) bpMap[bp.bp_code.trim()] = bp.bp_name;
    });
    setBpNamesMap((prev) => ({ ...prev, ...bpMap }));

    const seenBpCodes = new Set();
    const uniqueBranches = filteredData
      .filter((row) => {
        const bpCode = (row.bp_code || "").trim();
        if (!bpCode || seenBpCodes.has(bpCode)) return false;
        seenBpCodes.add(bpCode);
        return true;
      })
      .map((row) => {
        const bpCode = (row.bp_code || "").trim();
        const branchName = bpMap[bpCode];
        return {
          id: row.id,
          name: branchName || bpCode,
          code: bpCode,
          status: row.status,
          distributor_code: row.distributor_code,
          mother_code: row.mother_code,
          group_code: row.group_code,
        };
      });

    uniqueBranches.sort((a, b) => a.name.localeCompare(b.name));
    return uniqueBranches;
  };

  // Master builder: lahat ng mother accounts → sub-accounts → branches, naka-group
  const fetchAllGroupedBranches = async () => {
    if (!formData.distributor) return;
    setLoadingGroupedBranches(true);

    try {
      let motherAccounts = await fetchMotherAccountsList();

      // Filter by agent access, same logic as getAvailableMotherAccounts, but
      // working off the freshly-fetched list instead of stale state
      const distributorCode = selectedDistributor?.code;
      const cachedData = accountsListCache[distributorCode];
      if (cachedData?.length) {
        const accessibleGroupCodes = new Set(
          cachedData.map((item) => item.group_code?.toString().trim()).filter(Boolean)
        );
        if (accessibleGroupCodes.size > 0) {
          motherAccounts = motherAccounts.filter((opt) =>
            accessibleGroupCodes.has(opt.code?.toString().trim())
          );
        }
      }

      console.log("🏢 Mother accounts to build groups from:", motherAccounts);

      const groups = [];

      for (const mother of motherAccounts) {
        const subs = computeSubAccountsForMother(mother);

        if (mother.name === "NON-CHAIN") {
          if (subs.length === 0) continue;
          groups.push({
            groupKey: `mother-${mother.id}`,
            groupLabel: mother.name,
            isNonChain: true,
            motherId: mother.id,
            motherCode: mother.code,
            motherName: mother.name,
            items: subs.map((s) => ({
              id: s.id,
              name: s.name,
              code: s.code,
              groupCode: s.group_code,
            })),
          });
          continue;
        }

        for (const sub of subs) {
          const branches = await fetchBranchesForSub(sub.code, sub.group_code);
          if (branches.length === 0) continue;

          groups.push({
            groupKey: `sub-${sub.id}`,
            groupLabel: `${sub.code} = (${mother.name} - ${sub.name})`,
            isNonChain: false,
            motherId: mother.id,
            motherCode: mother.code,
            motherName: mother.name,
            subAccountId: sub.id,
            subAccountCode: sub.code,
            subAccountGroupCode: sub.group_code,
            items: branches.map((b) => ({
              id: b.id,
              name: b.name,
              code: b.code,
              status: b.status,
              distributor_code: b.distributor_code,
            })),
          });
        }
      }

      setGroupedBranches(groups);

      // ✅ NEW: keep branchTypes in sync so Step 1 (SKU Listing) can find them
      const flatBranches = groups
        .filter((g) => !g.isNonChain)
        .flatMap((g) => g.items);

      const uniqueFlatBranches = Array.from(
        new Map(flatBranches.map((b) => [b.code, b])).values()
      );

      setBranchTypes(uniqueFlatBranches);
    } catch (err) {
      console.error("❌ Error building grouped branches:", err.message);
      Swal.fire("Error", "Failed to load branches.", "error");
    } finally {
      setLoadingGroupedBranches(false);
    }
  };
  // Toggle a branch/sub-account checkbox inside the unified modal
  const toggleGroupedBranchItem = (group, item) => {
    if (group.isNonChain) {
      setSelectedMother({ id: group.motherId, name: "NON-CHAIN", code: group.motherCode });
      setFormData((prev) => {
        const current = Array.isArray(prev.accountType) ? prev.accountType : [];
        const updated = current.includes(item.id)
          ? current.filter((x) => x !== item.id)
          : [...current, item.id];
        return { ...prev, accountType: updated }; // ✅ branchType hindi na nag-cclear
      });
    } else {
      setSelectedMother({ id: group.motherId, name: group.motherName, code: group.motherCode });
      setFormData((prev) => {
        const currentAccountTypes = Array.isArray(prev.accountType) ? prev.accountType : [];
        const updatedAccountTypes = currentAccountTypes.includes(group.subAccountId)
          ? currentAccountTypes
          : [...currentAccountTypes, group.subAccountId]; // ✅ array na, accumulate

        const currentBranchType = prev.branchType || []; // ✅ hindi na nire-reset
        const updatedBranchType = currentBranchType.includes(item.name)
          ? currentBranchType.filter((n) => n !== item.name)
          : [...currentBranchType, item.name];

        return { ...prev, accountType: updatedAccountTypes, branchType: updatedBranchType };
      });
    }
    setShowBranchInput(true);
  };

  // ✅ Updated: checkbox state check regardless of active tab/group
  const isGroupedItemChecked = (group, item) => {
    if (group.isNonChain) {
      return (formData.accountType || []).includes(item.id);
    }
    return (formData.branchType || []).includes(item.name);
    // ✅ hindi na dependent sa "active" group — laging tama kahit anong tab
  };
  // Chips shown sa closed "Branch" field
  const getSelectedBranchChips = () => {
    const chips = [];

    (formData.branchType || []).forEach((name) => {
      chips.push({
        key: `branch-${name}`,
        label: name,
        onRemove: () =>
          setFormData((prev) => ({ ...prev, branchType: prev.branchType.filter((n) => n !== name) })),
      });
    });

    if (Array.isArray(formData.accountType)) {
      const nonChainGroup = groupedBranches.find((g) => g.isNonChain);
      formData.accountType.forEach((id) => {
        const item = nonChainGroup?.items.find((i) => i.id === id);
        if (item) {
          chips.push({
            key: `sub-${id}`,
            label: item.name,
            onRemove: () =>
              setFormData((prev) => ({
                ...prev,
                accountType: prev.accountType.filter((x) => x !== id),
              })),
          });
        }
      });
    }

    return chips.map((c) => (
      <span
        key={c.key}
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
        {c.label}
        <span
          onClick={(e) => {
            e.stopPropagation();
            c.onRemove();
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
  // Fetch mother accounts when modal opens

  useEffect(() => {
    if (showModal_Account) fetchAccounts();
  }, [showModal_Account]);

  const fetchAccounts = async () => {
    try {
      const distributorCode = formData.distributor;

      if (!distributorCode) {
        console.warn("⚠️ No distributor selected — skipping mother account fetch.");
        setAccountTypes([]);
        return;
      }

      console.log("🔍 Fetching mother account(s) for distributor:", distributorCode);

      // ✅ Fetch the distributor by its code
      const { data: distributor, error: distributorError } = await supabase
        .from("distributors")
        .select("id, name, code, mother_accounts_code")
        .eq("code", distributorCode)
        .single();

      if (distributorError) throw distributorError;
      if (!distributor) {
        console.warn("⚠️ No distributor record found for:", distributorCode);
        setAccountTypes([]);
        return;
      }

      console.log("✅ Distributor record:", distributor);

      // ✅ Parse mother_accounts_code — may be single or comma-separated
      let motherCodes = [];
      if (distributor.mother_accounts_code) {
        if (Array.isArray(distributor.mother_accounts_code)) {
          motherCodes = distributor.mother_accounts_code;
        } else {
          motherCodes = distributor.mother_accounts_code
            .split(",")
            .map((code) => code.replace(/[()]/g, "").trim()) // remove parentheses like (6001)
            .filter(Boolean);
        }
      }

      if (motherCodes.length === 0) {
        console.warn("⚠️ Distributor has no mother_accounts_code defined.");
        setAccountTypes([]);
        return;
      }

      console.log("📦 Mother Account Codes:", motherCodes);

      // ✅ Fetch corresponding mother account names
      const { data: motherAccounts, error: motherError } = await supabase
        .from("mother_account")
        .select("code, name")
        .in("code", motherCodes.map(Number)); // convert to numbers

      if (motherError) throw motherError;

      console.log("✅ Mother accounts fetched from DB:", motherAccounts);

      // ✅ Map codes to names (fallback to code if no match)
      const formattedData = motherCodes.map((code, index) => {
        const matched = motherAccounts?.find(
          (acc) => String(acc.code) === String(code)
        );
        return {
          id: index + 1,
          code,
          name: matched ? matched.name : code, // fallback if name not found
        };
      });

      setAccountTypes(formattedData);
      console.table(formattedData);
    } catch (err) {
      console.error("❌ Error fetching mother accounts:", err.message);
      setAccountTypes([]);
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

  const handleBack = () => {
    setActiveCategoryCode(null); // go back to category list
  };

  // Filter SKUs for active category
  const activeSkus = (categoryListing || []).filter(
    (sku) =>
      sku.category_code?.toLowerCase() === activeCategoryCode?.toLowerCase() &&
      (sku.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sku.description || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        sku.category_code?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
  );













  const hasValidBudgetData = () => {
    console.log('=== CHECKING BUDGET VALIDATION ===');
    console.log('rowsAccounts:', rowsAccounts);

    // Check if may laman ang rowsAccounts
    if (!rowsAccounts || rowsAccounts.length === 0) {
      console.log('No rows in rowsAccounts');
      return false;
    }

    // Get the relevant rows based on mother account
    const relevantRows = rowsAccounts.filter((row) => {
      if (selectedMother?.name === "NON-CHAIN") {
        return (formData.accountType || []).includes(row.account_code);
      } else {
        return formData.branchType.includes(row.account_code);
      }
    });

    console.log('Relevant rows for validation:', relevantRows);

    // Check if may at least 1 row with budget > 0
    const hasValidBudget = relevantRows.some((row) => {
      const budget = parseFloat(row.budget) || 0;
      console.log('Checking row:', row.account_code, 'budget:', budget);
      return budget > 0;
    });

    console.log('Has valid budget:', hasValidBudget);
    console.log('===================================');

    return hasValidBudget;
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
                        color: "red",
                      }}
                    >
                      <span className={formData.regularpwpcode ? "text-danger" : "text-muted"}>
                        {loadingRegularPwpCodes ? "Generating..." : formData.regularpwpcode}
                      </span>
                    </h2>
                  </div>
                </div>
              </div>
              <div className="row g-3">
                {/* Distributor */}
                <div className="col-md-4">
                  <label>
                    Distributor<span style={{ color: "red" }}>*</span>
                  </label>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                          branchType: [],
                        }));
                        setShowBranchInput(false);
                        setSubAccounts({});
                        setGroupedBranches([]);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        borderColor: formData.distributor ? "green" : "",
                        transition: "border-color 0.3s",
                      }}
                    >
                      <option value="">Select Distributor</option>
                      {filteredDistributors.map((dist) => (
                        <option key={dist.id} value={dist.code}>
                          {dist.name}
                        </option>
                      ))}
                    </select>

                    {formData.distributor && (
                      <span
                        style={{
                          color: "green",
                          fontWeight: "bold",
                          fontSize: "22px",
                          flexShrink: 0,
                          userSelect: "none",
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* Activity */}
                <div className="col-md-4">
                  <label>
                    Activity <span style={{ color: "red" }}>*</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <select
                      name="activity"
                      className="form-control"
                      value={formData.activity}
                      onChange={handleFormChange}
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <option value="">Select Activity</option>
                      {activities
                        .filter(opt => {
                          const setting = settings[opt.code] || {};
                          return setting.regular === true; // ✅ Filter by 'regular' checkbox
                        })
                        .map((opt) => (
                          <option key={opt.id} value={opt.code}>
                            {opt.name}
                          </option>
                        ))}
                    </select>

                    {formData.activity && (
                      <span
                        style={{
                          color: "green",
                          fontWeight: "bold",
                          fontSize: "22px",
                          flexShrink: 0,
                          userSelect: "none",
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
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


                  </div>
                )}


                {/* Mother Account1 - Conditionally displayed */}
                {/* {formData.activity && settingsMap[formData.activity]?.mother1 ? (
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
                  </div>
                ) : null} */}

                {/* Various Account  - Conditionally displayed */}
                {formData.activity && settingsMap[formData.activity]?.VariousAccount ? (
                  <div className="col-md-4" style={{ position: "relative" }}>
                    <label>
                      Various Account  <span style={{ color: "red" }}>*</span>
                    </label>

                    <div
                      className="form-control"
                      onClick={() => {
                        setShowModal_Account(true);
                        setIsVariousAccountMode(true);
                      }}
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
                      {formData.accountType2 ? (
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
                          VARIOUS
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVariousAccount(null);
                              setFormData({ ...formData, accountType2: null });
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
                        <span style={{ color: "#888" }}>Select Various Account</span>
                      )}

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
                  </div>
                ) : null}
                {/* Mother Account 2 - Conditionally displayed */}
                {formData.activity && settingsMap[formData.activity]?.MotherAccount2 ? (
                  <div className="col-md-4" style={{ position: "relative" }}>
                    <label>
                      Mother Account <span style={{ color: "red" }}>*</span>
                    </label>

                    <div
                      className="form-control"
                      onClick={() => setShowModal_Account2(true)}
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
                      {formData.MotherAccount2 ? (
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
                          {formData.MotherAccount2}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData({ ...formData, MotherAccount2: null });
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
                        <span style={{ color: "#888" }}>Select Mother Account </span>
                      )}

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
                  </div>
                ) : null}
                {/* Branch Selector - Conditionally displayed */}
                {formData.activity && settingsMap[formData.activity]?.branch ? (
                  <div className="col-md-4" style={{ position: "relative" }}>
                    <label>
                      Branch <span style={{ color: "red" }}>*</span>
                    </label>
                    <div
                      className="form-control"
                      onClick={() => {
                        setShowModal_Branch(true);
                        fetchAllGroupedBranches();
                      }}
                      style={{
                        cursor: "pointer",
                        minHeight: "40px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "5px",
                      }}
                    >
                      {getSelectedBranchChips().length > 0 ? (
                        getSelectedBranchChips()
                      ) : (
                        <span style={{ color: "#888" }}>Select Branch</span>
                      )}
                    </div>
                  </div>
                ) : null}


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
                        min={formData.activityDurationFrom || undefined} // ✅ block dates earlier than "From"
                        onChange={(e) => {
                          const newTo = e.target.value;
                          if (formData.activityDurationFrom && newTo < formData.activityDurationFrom) {
                            Swal.fire({
                              icon: "warning",
                              title: "Invalid Date",
                              text: "Activity Duration To cannot be earlier than Activity Duration From.",
                              confirmButtonColor: "#0d6efd",
                            });
                            return; // ✅ reject the change
                          }
                          handleFormChange(e);
                        }}
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



              {/* Modal Categories */}
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

              {/* Modal Mother Account1 */}
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

                      {(() => {
                        // ✅ Use filtered list instead of all accountTypes
                        const availableMotherAccounts = getAvailableMotherAccounts();

                        // Filter by search term
                        const filteredAccounts = availableMotherAccounts.filter((opt) => {
                          const matchesSearch = opt.name.toLowerCase().includes(accountSearchTerm.toLowerCase());
                          return matchesSearch;
                        });

                        console.log(`📋 Showing ${filteredAccounts.length} mother accounts after search filter`);

                        if (filteredAccounts.length === 0) {
                          return (
                            <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                              {availableMotherAccounts.length === 0
                                ? "No mother accounts with assigned branches for this agent"
                                : "No mother accounts found matching your search"
                              }
                            </div>
                          );
                        }

                        return filteredAccounts.map((opt) => (
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
                              console.log('🔍 Selected Mother Account:', opt);

                              if (isVariousAccountMode) {
                                setSelectedVariousAccount(opt);
                                setFormData((prev) => ({
                                  ...prev,
                                  accountType2: "VARIOUS"
                                }));
                                setShowModal_Account(false);
                                setIsVariousAccountMode(false);
                              } else {
                                setSelectedMother(opt);
                                fetchSubAccounts(opt);

                                if (opt.name === "NON-CHAIN") {
                                  setShowBranchInput(false);
                                  setFormData((prev) => ({
                                    ...prev,
                                    accountType: [],
                                    branchType: []
                                  }));
                                } else {
                                  setShowBranchInput(true);
                                  setFormData((prev) => ({
                                    ...prev,
                                    branchType: []
                                  }));
                                }
                              }
                            }}
                          >
                            <span>{opt.name}</span>
                            <strong style={{ color: '#ffffffff' }}>({opt.code})</strong>
                            <FiChevronRight style={{ color: "#888", fontSize: "16px" }} />
                          </div>
                        ));
                      })()}
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

                      {(() => {
                        const subAccountsList = subAccounts[selectedMother.id] || [];

                        // ✅ Check if empty
                        if (subAccountsList.length === 0) {
                          return (
                            <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                              <p>No sub-accounts assigned to you under this mother account.</p>
                            </div>
                          );
                        }

                        // ✅ Filter by search term
                        const filteredSubs = subAccountsList.filter((s) =>
                          s.name.toLowerCase().includes(subSearchTerm.toLowerCase())
                        );

                        if (filteredSubs.length === 0) {
                          return (
                            <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                              <p>No sub-accounts found matching "{subSearchTerm}"</p>
                            </div>
                          );
                        }

                        // ✅ Sort and render
                        return filteredSubs
                          .sort((a, b) => {
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
                                      accountType: updated,
                                      branchType: []
                                    }));
                                    setShowBranchInput(false);
                                  } else {
                                    setFormData((prev) => ({
                                      ...prev,
                                      accountType: s.id,
                                      branchType: []
                                    }));
                                    setShowBranchInput(true);
                                    fetchBranches(s.code, s.group_code);
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
                          ));
                      })()}
                    </>
                  )}
                </Modal.Body>

                <Modal.Footer>
                  <Button variant="light" onClick={() => setShowModal_Account(false)}>
                    Close
                  </Button>
                </Modal.Footer>
              </Modal>
              {/* Modal Mother Account2 */}
              <Modal
                show={showModal_Account2}
                onHide={() => setShowModal_Account2(false)}
                centered
                size="lg"
              >
                <Modal.Header closeButton style={{ background: "rgb(70, 137, 166)", color: "white" }}>
                  <Modal.Title style={{ width: "100%", textAlign: "center" }}>
                    Select Mother Account Type 2
                  </Modal.Title>
                </Modal.Header>

                <Modal.Body style={{ maxHeight: "500px", overflowY: "auto", padding: "1rem" }}>
                  <input
                    type="text"
                    className="form-control mb-3"
                    placeholder="Search mother accounts..."
                    value={accountSearchTerm2}
                    onChange={(e) => setAccountSearchTerm2(e.target.value)}
                    style={{ borderColor: "#007bff" }}
                  />

                  {(() => {
                    // Filter by search term
                    const filteredAccounts = motherAccount2List.filter((opt) => {
                      const matchesSearch = opt.name.toLowerCase().includes(accountSearchTerm2.toLowerCase()) ||
                        opt.code.toString().includes(accountSearchTerm2.toLowerCase());
                      return matchesSearch;
                    });

                    console.log(`📋 Showing ${filteredAccounts.length} out of ${motherAccount2List.length} mother accounts (Mother 2)`);

                    if (filteredAccounts.length === 0) {
                      return (
                        <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                          No mother accounts available
                        </div>
                      );
                    }

                    return filteredAccounts.map((opt) => (
                      <div
                        key={opt.id}
                        style={{
                          padding: "12px 16px", // ✅ Reduced padding (was 8px 10px)
                          borderBottom: "1px solid #eee",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "background-color 0.2s",
                        }}
                        onClick={() => {
                          console.log('🔍 Selected Mother Account 2:', opt);
                          console.log('📋 Code:', opt.code);
                          console.log('📝 Name:', opt.name);
                          console.log('🆔 ID:', opt.id);

                          // Save the mother account name to MotherAccount2 field
                          setFormData((prev) => ({
                            ...prev,
                            MotherAccount2: opt.name
                          }));
                          setShowModal_Account2(false);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f5f5f5";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        {/* ✅ Only show name, hide code */}
                        <span style={{ fontSize: "15px", color: "#333" }}>{opt.name}</span>
                      </div>
                    ));
                  })()}
                </Modal.Body>

                <Modal.Footer>
                  <Button variant="light" onClick={() => setShowModal_Account2(false)}>
                    Close
                  </Button>
                </Modal.Footer>
              </Modal>
              {/* Modal Branch */}
              <Modal
                show={showModal_Branch}
                onHide={() => {
                  setShowModal_Branch(false);
                  setBranchSearchTerm("");
                }}
                centered
                size="xl"
                dialogClassName="branch-select-modal"
              >
                <Modal.Header closeButton style={{ background: "rgb(70, 137, 166)", color: "white" }}>
                  <Modal.Title style={{ width: "100%", textAlign: "center" }}>
                    Select Branch
                  </Modal.Title>
                </Modal.Header>

                <Modal.Body
                  style={{
                    minHeight: "70vh",
                    display: "flex",
                    flexDirection: "column",
                    padding: "1rem",
                  }}
                >
                  <input
                    type="text"
                    className="form-control mb-3"
                    placeholder="Search branches or accounts..."
                    value={branchSearchTerm}
                    onChange={(e) => setBranchSearchTerm(e.target.value)}
                    style={{ borderColor: "#007bff", flexShrink: 0 }}
                  />

                  {loadingGroupedBranches ? (
                    <div className="text-center p-4">
                      <Spinner animation="border" variant="primary" />
                      <p className="text-muted mt-2">Loading branches...</p>
                    </div>
                  ) : (
                    (() => {
                      if (groupedBranches.length === 0) {
                        return (
                          <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                            No branches found.
                          </div>
                        );
                      }

                      const currentKey =
                        activeBranchTabKey &&
                          (activeBranchTabKey === "ALL" || groupedBranches.some((g) => g.groupKey === activeBranchTabKey))
                          ? activeBranchTabKey
                          : "ALL";

                      const isAllTab = currentKey === "ALL";
                      const activeGroup = isAllTab ? null : groupedBranches.find((g) => g.groupKey === currentKey);

                      const allFilteredItems = isAllTab
                        ? groupedBranches.flatMap((group) =>
                          group.items
                            .filter((item) => item.name.toLowerCase().includes(branchSearchTerm.toLowerCase()))
                            .map((item) => ({ item, group }))
                        )
                        : (activeGroup?.items || [])
                          .filter((item) => item.name.toLowerCase().includes(branchSearchTerm.toLowerCase()))
                          .map((item) => ({ item, group: activeGroup }));

                      // ── Pagination ──
                      const totalPages = Math.max(1, Math.ceil(allFilteredItems.length / BRANCH_PAGE_SIZE));
                      const safePage = Math.min(branchPage, totalPages);
                      const startIdx = (safePage - 1) * BRANCH_PAGE_SIZE;
                      const pagedItems = allFilteredItems.slice(startIdx, startIdx + BRANCH_PAGE_SIZE);

                      return (
                        <>
                          <Nav
                            variant="tabs"
                            activeKey={currentKey}
                            onSelect={(k) => setActiveBranchTabKey(k)}
                            style={{ flexWrap: "nowrap", overflowX: "auto", marginBottom: "10px" }}
                          >
                            <Nav.Item style={{ whiteSpace: "nowrap" }}>
                              <Nav.Link eventKey="ALL">All</Nav.Link>
                            </Nav.Item>
                            {groupedBranches.map((group) => {
                              const { bold, rest } = formatGroupLabelForDisplay(group.groupLabel);
                              return (
                                <Nav.Item key={group.groupKey} style={{ whiteSpace: "nowrap" }}>
                                  <Nav.Link eventKey={group.groupKey}>
                                    <strong>{bold}</strong>{rest}
                                  </Nav.Link>
                                </Nav.Item>
                              );
                            })}
                          </Nav>

                          <div style={{ overflowY: "auto", flexGrow: 1 }}>
                            {pagedItems.length === 0 ? (
                              <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                                No branches found.
                              </div>
                            ) : (
                              pagedItems.map(({ item, group }) => (
                                <div
                                  key={`${group.groupKey}-${item.id}`}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "8px 10px",
                                    borderBottom: "1px solid #eee",
                                    gap: "8px",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
                                    <input
                                      type="checkbox"
                                      checked={isGroupedItemChecked(group, item)}
                                      onChange={() => toggleGroupedBranchItem(group, item)}
                                      id={`grouped-branch-${group.groupKey}-${item.id}`}
                                      style={{
                                        width: "20px",
                                        height: "20px",
                                        transform: "scale(1.3)",
                                        cursor: "pointer",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <label
                                      htmlFor={`grouped-branch-${group.groupKey}-${item.id}`}
                                      style={{
                                        marginLeft: "8px",
                                        cursor: "pointer",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {item.name}
                                    </label>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                    {isAllTab && (() => {
                                      const { bold, rest } = formatGroupLabelForDisplay(group.groupLabel);
                                      return (
                                        <span
                                          style={{
                                            backgroundColor: group.isNonChain ? "#fff3cd" : "#e7f1ff",
                                            color: group.isNonChain ? "#92400e" : "#0050a5",
                                            border: `1px solid ${group.isNonChain ? "#fbbf24" : "#bfdbfe"}`,
                                            borderRadius: "999px",
                                            padding: "2px 10px",
                                            fontSize: "11px",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          <strong>{bold}</strong>
                                          {rest}
                                        </span>
                                      );
                                    })()}

                                    {!group.isNonChain && (
                                      <span
                                        style={{
                                          fontSize: "0.85rem",
                                          fontWeight: 500,
                                          color: item.status ? "#28a745" : "#dc3545",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {item.status ? "Active" : "Inactive ❌"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Pagination controls */}
                          {allFilteredItems.length > BRANCH_PAGE_SIZE && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "10px",
                                paddingTop: "10px",
                                borderTop: "1px solid #eee",
                                marginTop: "8px",
                                flexShrink: 0,
                              }}
                            >
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                disabled={safePage <= 1}
                                onClick={() => setBranchPage((p) => Math.max(1, p - 1))}
                              >
                                ← Prev
                              </Button>
                              <span style={{ fontSize: "13px", color: "#555" }}>
                                Page {safePage} of {totalPages} ({allFilteredItems.length} items)
                              </span>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                disabled={safePage >= totalPages}
                                onClick={() => setBranchPage((p) => Math.min(totalPages, p + 1))}
                              >
                                Next →
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
                </Modal.Body>

                <Modal.Footer style={{ display: "flex", justifyContent: "space-between" }}>
                  <Button
                    variant="warning"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, branchType: [], accountType: null }));
                      setSelectedMother(null);
                      setShowBranchInput(false);
                    }}
                  >
                    Clear All
                  </Button>

                  <Button
                    variant="light"
                    onClick={() => {
                      setShowModal_Branch(false);
                      setBranchSearchTerm("");
                    }}
                  >
                    Close
                  </Button>
                </Modal.Footer>
              </Modal>



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
                    const missingFields = [];

                    // ✅ Check required fields dynamically
                    if (!formData.activity) {
                      missingFields.push("Activity");
                    }

                    if (formData.isPartOfCoverPwp && !formData.coverPwpCode) {
                      missingFields.push("Total Budget for The Year");
                    }

                    const setting = settingsMap[formData.activity];

                    if (
                      setting?.amount_display &&
                      (
                        formData.amountbadget === "" ||
                        formData.amountbadget === null ||
                        Number(formData.amountbadget) === 0 ||
                        isNaN(Number(formData.amountbadget))
                      )
                    ) {
                      missingFields.push("Amount Budget");
                    }

                    // ✅ If any required field is missing → show Swal warning
                    if (missingFields.length > 0) {
                      Swal.fire({
                        icon: "warning",
                        title: "Missing Required Fields",
                        html: `
            Please fill in the following required fields before proceeding:<br/><br/>
            <b>${missingFields.join("<br/>")}</b>
          `,
                        confirmButtonColor: "#0d6efd",
                      });
                      return;
                    }

                    console.log(
                      "▶️ Next pressed. formData.activity:",
                      formData.activity,
                      "setting:",
                      setting
                    );

                    // ✅ Step navigation logic
                    // ✅ Step navigation logic
                    // ✅ Step navigation logic
                    if (formData.activityName === "BAD ORDER") {
                      setStep(4);
                      console.log("⛔ BAD ORDER selected → skipping SKU/accounts checks, going to Step 4");
                    } else if (setting?.sku) {
                      setStep(1);
                      console.log("🛒 SKU found → going to Step 1");
                    } else if (setting?.accounts || setting?.sku_addional || setting?.isPenalties || setting?.suppliesME) {
                      setStep(2);
                      console.log("💼 Accounts/SKU Addional/Penalties/SuppliesME found → going to Step 2");
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
                    <div className="d-flex align-items-center gap-3">
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

                      {/* Manual SRP Toggle */}
                      <button
                        type="button"
                        onClick={() => setManualSrp(!manualSrp)}
                        style={{
                          height: "38px",
                          padding: "0 16px",
                          borderRadius: "8px",
                          border: "none",
                          fontWeight: "600",
                          fontSize: "14px",
                          cursor: "pointer",
                          backgroundColor: manualSrp ? "#28a745" : "#e9ecef",
                          color: manualSrp ? "white" : "#333",
                          transition: "all 0.2s ease-in-out",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {manualSrp ? "✅ Manual SRP" : "Manual SRP"}
                      </button>
                    </div>
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
                              : branchTypes.filter((branch) => branch.code === selectedBranchForSku) // ✅ FIXED: compare by code, matches <option value={branch.code}>
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
                                    <th style={{ display: "none" }}>SRP</th>
                                    <th style={{ display: "none" }}>QTY</th>
                                    <th style={{ display: "none" }}>UOM</th>
                                    <th style={{ display: "none" }}>Billing Amount</th>
                                    <th style={{ display: "none" }}>Discount </th>
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

                                        <td style={{ display: "none" }}>
                                          <Form.Control
                                            type="number"
                                            step="0.01"
                                            value={row.SRP || 0}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "SRP", e.target.value)
                                            }
                                            disabled={!manualSrp}
                                          />
                                        </td>

                                        <td style={{ display: "none" }}>
                                          <Form.Control
                                            type="number"
                                            value={row.QTY || 0}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "QTY", e.target.value)
                                            }
                                          />
                                        </td>

                                        <td style={{ display: "none" }}>
                                          <Form.Select
                                            value={row.UOM || "PC"}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "UOM", e.target.value)
                                            }
                                          >
                                            {["CASE", "PACK"].map((uom) => (
                                              <option key={uom} value={uom}>
                                                {uom}
                                              </option>
                                            ))}
                                          </Form.Select>
                                        </td>

                                        <td style={{ display: "none" }}>{totalBeforeDiscount.toFixed(2)}</td>

                                        <td style={{ display: "none" }}>
                                          <Form.Control
                                            type="number"
                                            step="0.01"
                                            value={discountAmount}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "DISCOUNT", e.target.value)
                                            }
                                          />
                                        </td>

                                        <td>
                                          <Form.Control
                                            type="number"
                                            step="0.01"
                                            value={row.TOTAL_AMOUNT ?? 0}
                                            onChange={(e) =>
                                              handleChangeSkuForBranch(branchName, idx, "TOTAL_AMOUNT", e.target.value)
                                            }
                                          />
                                        </td>

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
                                    <td style={{ display: "none" }}>{totals.SRP.toFixed(2)}</td>
                                    <td style={{ display: "none" }}>{totals.QTY}</td>
                                    <td style={{ display: "none" }}></td>
                                    <td style={{ display: "none" }}>{totals.BILLING_AMOUNT.toFixed(2)}</td>
                                    <td style={{ display: "none" }}>{totals.DISCOUNT.toFixed(2)}</td>
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
                          checked={manualSrp}
                          onChange={() => setManualSrp(!manualSrp)}
                          style={{
                            transform: "scale(1.5)",
                            marginRight: "8px",
                            cursor: "pointer",
                          }}
                        />
                        Manual SRP
                      </label>
                    </div>


                    {/* Selected Categories */}
                    <div style={{ overflowY: "auto", flexGrow: 1 }}>
                      {!activeCategoryCode ? (
                        // ✅ Category List View
                        <div>
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
                                return (
                                  <div
                                    key={index}
                                    onClick={() => handleCategoryClick(code)}
                                    style={{
                                      padding: "8px 12px",
                                      border: "1px solid #ccc",
                                      borderRadius: "6px",
                                      backgroundColor: "#f9f9f9",
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
                                    <span style={{ fontWeight: "bold", fontSize: "18px", color: "#666" }}>
                                      {">"}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <div>None</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        // ✅ SKU Tab View
                        <div>
                          <button
                            onClick={handleBack}
                            style={{
                              marginBottom: "12px",
                              padding: "6px 12px",
                              borderRadius: "4px",
                              backgroundColor: "#eee",
                              border: "1px solid #ccc",
                              cursor: "pointer",
                            }}
                          >
                            ← Back
                          </button>

                          <div style={{ maxHeight: "550px", overflowY: "auto" }}>
                            {activeSkus.length > 0 ? (
                              activeSkus.map((sku) => (
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
                                      handleChangeSkuForBranch(
                                        selectedBranchName,
                                        selectedRowIndex,
                                        "SKUITEM",
                                        sku.sku_code
                                      );

                                      setShowSkuModal(false);
                                    }
                                  }}

                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <div>
                                    <strong>{sku.sku_code}</strong> – {sku.name}
                                  </div>
                                  <small style={{ color: "#666" }}>{sku.description || "No description"}</small>
                                </div>
                              ))
                            ) : (
                              <div className="text-center text-muted p-3">No SKUs found for this category.</div>
                            )}
                          </div>
                        </div>
                      )}
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
                          {formData.sku_addional && <th>SKU</th>}
                          {formData.isPenalties && <th>Penalties</th>}
                          {formData.suppliesME && <th>Supplies/M.E</th>}
                          <th>Budget</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allBranches = getFilteredBranchesWithExtras();
                          console.log('=== BRANCH RENDERING DEBUG ===');
                          console.log('All branches from getFilteredBranchesWithExtras():', allBranches);
                          console.log('formData.branchType:', formData.branchType);
                          console.log('selectedMother:', selectedMother);
                          console.log('rowsAccounts:', rowsAccounts);

                          const filteredBranches = allBranches.filter((branch) => {
                            const isIncluded = formData.branchType.includes(branch.name);
                            console.log('Branch check:', {
                              branchName: branch.name,
                              branchCode: branch.code,
                              branchId: branch.id,
                              isIncluded: isIncluded
                            });
                            return isIncluded;
                          });

                          console.log('Filtered branches count:', filteredBranches.length);
                          console.log('Filtered branches:', filteredBranches);
                          console.log('============================');

                          return filteredBranches.map((branch) => {
                            console.log('Rendering branch:', {
                              name: branch.name,
                              code: branch.code,
                              id: branch.id,
                              fullBranch: branch
                            });

                            const existingRow =
                              rowsAccounts.find((r) => r.account_code === branch.name) || {};
                            const budgetValue =
                              existingRow.budget !== undefined ? existingRow.budget : "";

                            console.log('Existing row for', branch.name, ':', existingRow);
                            console.log('Budget value:', budgetValue);

                            return (
                              <tr key={branch.id}>
                                <td>
                                  <Form.Control value={branch.name} disabled />
                                </td>
                                {formData.sku_addional && (
                                  <td>
                                    <Form.Control
                                      value={existingRow.sku || ""}
                                      onChange={(e) =>
                                        updateBranchRowField(branch.name, "sku", e.target.value)
                                      }
                                      placeholder="Enter SKU"
                                    />
                                  </td>
                                )}
                                {formData.isPenalties && (
                                  <td>
                                    <Form.Select
                                      value={existingRow.penalty || ""}
                                      onChange={(e) =>
                                        updateBranchRowField(branch.name, "penalty", e.target.value)
                                      }
                                    >
                                      <option value="">Select Penalty</option>
                                      {penaltyOptions.map((p) => (
                                        <option key={p.id} value={p.label}>{p.label}</option>
                                      ))}
                                    </Form.Select>
                                  </td>
                                )}
                                {formData.suppliesME && (
                                  <td>
                                    <Form.Select
                                      value={existingRow.suppliesme || ""}
                                      onChange={(e) =>
                                        updateBranchRowField(branch.name, "suppliesme", e.target.value)
                                      }
                                    >
                                      <option value="">Select Item</option>
                                      <option value="">Select Item</option>
                                      {suppliesOptions.map((item) => (
                                        <option key={item.id} value={item.label}>{item.label}</option>
                                      ))}
                                    </Form.Select>
                                  </td>
                                )}
                                <td>
                                  <Form.Control
                                    type="number"
                                    step="0.01"
                                    value={budgetValue === "" ? "" : budgetValue}
                                    onChange={(e) => {
                                      console.log('Budget change event for', branch.name);
                                      console.log('Input value:', e.target.value);

                                      let newBudget = parseFloat(e.target.value);
                                      if (isNaN(newBudget)) newBudget = 0;

                                      const updatedRow = {
                                        id: existingRow.id || branch.id,
                                        account_code: branch.name,
                                        account_name: branch.name,
                                        budget: newBudget,
                                        created_at: existingRow.created_at || new Date().toISOString(),
                                      };

                                      console.log('Updated row object:', updatedRow);

                                      setRowsAccounts((prevRows) => {
                                        console.log('Previous rows:', prevRows);

                                        const existingIndex = prevRows.findIndex(
                                          (r) => r.account_code === branch.name
                                        );

                                        console.log('Existing index:', existingIndex);

                                        let updated;
                                        if (existingIndex !== -1) {
                                          updated = [...prevRows];
                                          updated[existingIndex] = {
                                            ...updated[existingIndex],
                                            budget: newBudget,
                                          };
                                          console.log('Updated existing row at index', existingIndex);
                                        } else {
                                          updated = [...prevRows, updatedRow];
                                          console.log('Added new row');
                                        }

                                        console.log('New rows state:', updated);
                                        return updated;
                                      });
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          });
                        })()}

                        {/* NON-CHAIN: render multiple sub-accounts if selected */}
                        {(() => {

                          if (!Array.isArray(formData.accountType) || formData.accountType.length === 0) {
                            return null; // ✅ hindi na dependent sa "active" mother
                          }

                          console.log('=== NON-CHAIN RENDERING ===');
                          console.log('formData.accountType:', formData.accountType);
                          console.log('subAccounts:', subAccounts);

                          if (!Array.isArray(formData.accountType)) {
                            console.log('accountType is not an array');
                            return null;
                          }

                          return formData.accountType.map((subId) => {
                            console.log('Looking for sub-account with id:', subId);

                            const sub = Object.values(subAccounts).flat().find((s) => s.id === subId);

                            if (!sub) {
                              console.log('Sub-account not found for id:', subId);
                              return null;
                            }

                            console.log('Found sub-account:', sub);

                            const existingRow = rowsAccounts.find((r) => r.account_code === sub.id) || {};
                            const budgetValue = existingRow.budget ?? "";

                            console.log('Existing row for', sub.name, ':', existingRow);
                            console.log('Budget value:', budgetValue);

                            return (
                              <tr key={sub.id}>
                                <td>
                                  <Form.Control value={sub.name} disabled />
                                </td>
                                {formData.sku_addional && (
                                  <td>
                                    <Form.Control
                                      value={existingRow.sku || ""}
                                      onChange={(e) =>
                                        updateBranchRowField(sub.id, "sku", e.target.value)
                                      }
                                      placeholder="Enter SKU"
                                    />
                                  </td>
                                )}
                                {formData.isPenalties && (
                                  <td>
                                    <Form.Select
                                      value={existingRow.penalty || ""}
                                      onChange={(e) =>
                                        updateBranchRowField(sub.id, "penalty", e.target.value)
                                      }
                                    >
                                      <option value="">Select Penalty</option>
                                      {PENALTY_OPTIONS.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                      ))}
                                    </Form.Select>
                                  </td>
                                )}
                                {formData.suppliesME && (
                                  <td>
                                    <Form.Select
                                      value={existingRow.suppliesme || ""}
                                      onChange={(e) =>
                                        updateBranchRowField(sub.id, "suppliesme", e.target.value)
                                      }
                                    >
                                      <option value="">Select Item</option>
                                      {SUPPLIES_ME_OPTIONS.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                      ))}
                                    </Form.Select>
                                  </td>
                                )}
                                <td>
                                  <Form.Control
                                    type="number"
                                    step="0.01"
                                    value={budgetValue === "" ? "" : budgetValue}
                                    onChange={(e) => {
                                      console.log('Budget change event for NON-CHAIN:', sub.name);
                                      console.log('Input value:', e.target.value);

                                      let newBudget = parseFloat(e.target.value);
                                      if (isNaN(newBudget)) newBudget = 0;

                                      const updatedRow = {
                                        id: existingRow.id || sub.id,
                                        account_code: sub.id,
                                        account_name: sub.name,
                                        budget: newBudget,
                                        created_at: existingRow.created_at || new Date().toISOString(),
                                      };

                                      console.log('Updated row object:', updatedRow);

                                      setRowsAccounts((prevRows) => {
                                        console.log('Previous rows:', prevRows);

                                        const existingIndex = prevRows.findIndex((r) => r.account_code === sub.id);

                                        console.log('Existing index:', existingIndex);

                                        let updated;
                                        if (existingIndex !== -1) {
                                          updated = [...prevRows];
                                          updated[existingIndex] = { ...updated[existingIndex], budget: newBudget };
                                          console.log('Updated existing row at index', existingIndex);
                                        } else {
                                          updated = [...prevRows, updatedRow];
                                          console.log('Added new row');
                                        }

                                        console.log('New rows state:', updated);
                                        return updated;
                                      });
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          });
                        })()}

                        {/* Total Row */}
                        <tr>
                          <td
                            colSpan={
                              1 +
                              (formData.sku_addional ? 1 : 0) +
                              (formData.isPenalties ? 1 : 0) +
                              (formData.suppliesME ? 1 : 0)
                            }
                            style={{ fontWeight: "bold", textAlign: "right" }}
                          >
                            Total
                          </td>
                          <td style={{ fontWeight: "bold" }}>
                            {(() => {
                              console.log('=== CALCULATING TOTAL ===');
                              console.log('selectedMother?.name:', selectedMother?.name);
                              console.log('formData.accountType:', formData.accountType);
                              console.log('formData.branchType:', formData.branchType);
                              console.log('rowsAccounts:', rowsAccounts);

                              const filteredRows = rowsAccounts.filter((row) =>
                                (formData.accountType || []).includes(row.account_code) ||
                                formData.branchType.includes(row.account_code) // ✅ pareho pwedeng kasama
                              );

                              console.log('Filtered rows for total:', filteredRows);

                              const total = filteredRows.reduce((sum, row) => {
                                const budget = parseFloat(row.budget) || 0;
                                console.log('Adding budget:', budget, 'from row:', row.account_code);
                                return sum + budget;
                              }, 0);

                              console.log('Total calculated:', total);
                              console.log('========================');

                              return total.toFixed(2);
                            })()}
                          </td>
                        </tr>
                      </tbody>


                    </Table>
                  </div>
                )}
              </Card.Body>

              <Card.Footer className="d-flex justify-content-between align-items-center">
                <button
                  className="btn btn-outline-secondary"
                  onClick={handlePrevious}
                >
                  ← Previous
                </button>
                {/* Left side */}
                <Button
                  variant="primary"
                  onClick={() => setStep(3)}
                  disabled={!hasValidBudgetData()}
                  title={!hasValidBudgetData() ? "Please enter at least one budget amount" : ""}
                >
                  Next →
                </Button>

                {/* Optional: Add warning message */}
                {!hasValidBudgetData() && (
                  <small className="text-danger d-block mt-2">
                    ⚠️ Please enter at least one budget amount to proceed
                  </small>
                )}

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
                            Expenses Total Budget
                          </div>
                          <div className="card-body text-center d-flex align-items-center justify-content-center">
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
