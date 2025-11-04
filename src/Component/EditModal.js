
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FaSearch } from "react-icons/fa";
import { Modal, Button } from "react-bootstrap";
import Swal from 'sweetalert2';
import { FiChevronRight } from "react-icons/fi";
import { Dropdown, DropdownButton, ButtonGroup } from 'react-bootstrap';

// ============ HELPER FUNCTIONS ============
const fixCategoryNameInput = (value) => {
  if (Array.isArray(value)) {
    if (value.every((char) => typeof char === "string" && char.length === 1)) {
      try {
        const str = value.join('');
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === "string") return [parsed];
        return [];
      } catch {
        return value;
      }
    }
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string") return [parsed];
      return [];
    } catch {
      return [value];
    }
  }

  return [];
};

const calculateBillingAmount = (srp, qty, discount) => {
  const quantity = parseFloat(qty) || 0;
  const price = parseFloat(srp) || 0;
  const disc = parseFloat(discount) || 0;
  return (price * quantity) - disc;
};

// ============ FIELD CONFIGS ============
const coverPwpFieldsConfig = [
  { name: "cover_code", label: "COVER CODE", disabled: true },
  { name: "distributor_code", label: "Distributor Code", type: "select" },
  { name: "account_type", label: "Account Type" },
  { name: "branchType", label: "branchType" },
  { name: "amount_badget", label: "Amount Budget" },
  { name: "pwp_type", label: "PWP TYPE", disabled: true },
  { name: "objective", label: "Objective Promo Scheme" },
  { name: "details", label: "Details" },
  { name: "remarks", label: "Remarks" },
  { name: "created_at", label: "Created At", disabled: true },
];

const regularPwpFieldsConfig = [
  { name: "regularpwpcode", label: "REGULAR CODE", disabled: true },
  { name: "pwptype", label: "PWP TYPE", disabled: true },
  { name: "distributor", label: "Distributor", type: "select" },
  { name: "accountType", label: "Account Type" },
  { name: "categoryName", label: "Category" },
  { name: "activity", label: "Activity" },
  { name: "objective", label: "Objective" },
  { name: "branchType", label: "branchType" },
  { name: "promoScheme", label: "Promo Scheme" },
  { name: "activityDurationFrom", label: "Activity Duration From", type: "date" },
  { name: "activityDurationTo", label: "Activity Duration To", type: "date" },
  { name: "isPartOfCoverPwp", label: "Is Part Of Cover PWP", type: "checkbox" },
  { name: "coverPwpCode", label: "Cover PWP Code" },
  { name: "remaining_balance", label: "Remaining Balance", disabled: true },
  { name: "credit_budget", label: "Credit Budget" },
  { name: "sku", label: "SKU", disabled: true },
  { name: "accounts", label: "Accounts", disabled: true },
  { name: "amount_display", label: "Amount Display", disabled: true },
  { name: "remarks", label: "Remarks" },
];

// ============ CUSTOM HOOKS ============
const useDistributors = (loggedInUsername) => {
  const [filteredDistributors, setFilteredDistributors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDistributors = async () => {
      if (!loggedInUsername) return;

      setLoading(true);
      const { data, error } = await supabase
        .from("user_distributors")
        .select("id, code, distributor_name, username")
        .eq("username", loggedInUsername);

      if (!error) setFilteredDistributors(data);
      setLoading(false);
    };

    fetchDistributors();
  }, [loggedInUsername]);

  return { filteredDistributors, loading };
};

const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [categoryDetails, setCategoryDetails] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAllCategories = async () => {
      setLoading(true);

      const { data: mainCat } = await supabase
        .from("category")
        .select("id, name, code, description")
        .order("code", { ascending: true });

      const { data: detailsCat } = await supabase
        .from("categorydetails")
        .select("*")
        .order("code", { ascending: true });

      const { data: listingCat } = await supabase
        .from('category_listing')
        .select('sku_code, name');

      if (mainCat) setCategories(mainCat);
      if (detailsCat) setCategoryDetails(detailsCat);

      if (listingCat) {
        const map = {};
        listingCat.forEach((cat) => {
          map[cat.sku_code] = cat.name;
        });
        setCategoryMap(map);
      }

      setLoading(false);
    };

    fetchAllCategories();
  }, []);

  return { categories, categoryDetails, categoryMap, loading };
};

const useActivities = () => {
  const [activities, setActivities] = useState([]);
  const [settingsMap, setSettingsMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchActivitiesAndSettings = async () => {
      setLoading(true);

      const { data: actData } = await supabase
        .from('activity')
        .select('*')
        .order('code', { ascending: true });

      const { data: settingsData } = await supabase
        .from('activity_settings')
        .select('activity_code, sku, accounts, amount_display');

      if (actData) setActivities(actData);

      if (settingsData) {
        const map = {};
        settingsData.forEach(setting => {
          map[setting.activity_code] = {
            sku: setting.sku === true,
            accounts: setting.accounts === true,
            amount_display: setting.amount_display === true,
          };
        });
        setSettingsMap(map);
      }

      setLoading(false);
    };

    fetchActivitiesAndSettings();
  }, []);

  return { activities, settingsMap, loading };
};

const useBudgetList = (regularpwpcode, formData, setFormData) => {
  const [budgetList, setBudgetList] = useState([]);
  const [originalTotalBudget, setOriginalTotalBudget] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regularpwpcode) {
      setBudgetList([]);
      setOriginalTotalBudget(0);
      return;
    }

    const fetchBudgetList = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("regular_accountlis_badget")
        .select("*")
        .eq("regularcode", regularpwpcode);

      if (error) {
        console.error("Error fetching budget list:", error.message);
        setBudgetList([]);
        setOriginalTotalBudget(0);
      } else {
        setBudgetList(data);
        const originalTotal = data.reduce((sum, item) => sum + Number(item.budget || 0), 0);
        setOriginalTotalBudget(originalTotal);
      }
      setLoading(false);
    };

    fetchBudgetList();
  }, [regularpwpcode]);

  const handleBudgetChange = (id, newBudget) => {
    setBudgetList(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, budget: parseFloat(newBudget) || 0 } : item
      );

      // Update formData.remaining_balance in real-time
      const newTotalBudget = updated.reduce((sum, item) => sum + Number(item.budget || 0), 0);
      const budgetDiff = newTotalBudget - originalTotalBudget;
      const newRemainingBalance = Number(formData?.initial_remaining_balance || 0) - budgetDiff;

      setFormData(prev => ({
        ...prev,
        remaining_balance: newRemainingBalance
      }));

      return updated;
    });
  };

  const currentTotalBudget = budgetList.reduce((sum, item) => sum + Number(item.budget || 0), 0);

  return {
    budgetList,
    setBudgetList,
    originalTotalBudget,
    currentTotalBudget,
    handleBudgetChange,
    loading
  };
};

const useSkuList = (regularpwpcode) => {
  const [skuList, setSkuList] = useState([]);
  const [originalTotalBilling, setOriginalTotalBilling] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regularpwpcode) {
      setSkuList([]);
      setOriginalTotalBilling(0);
      return;
    }

    const fetchSkuList = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("regular_sku")
          .select("*")
          .eq("regular_code", regularpwpcode);

        if (error) {
          console.error("Error fetching SKU list:", error.message);
          setSkuList([]);
          setOriginalTotalBilling(0);
        } else {
          const skuDataWithZeroDiscount = data.map(item => ({
            ...item,
            discount: Number(item.discount) || 0,
            billing_amount: Number(item.billing_amount) || 0,
          }));

          setSkuList(skuDataWithZeroDiscount);

          const originalTotal = skuDataWithZeroDiscount
            .filter((item) => item.sku !== "Total:")
            .reduce((acc, { total_amount }) => acc + (Number(total_amount) || 0), 0);

          setOriginalTotalBilling(originalTotal);
        }
      } catch (error) {
        console.error("Unexpected error fetching SKU list:", error);
        setSkuList([]);
        setOriginalTotalBilling(0);
      }
      setLoading(false);
    };

    fetchSkuList();
  }, [regularpwpcode]);

  const handleSkuChange = (id, field, value) => {
    const updatedSkuList = skuList.map((item) => {
      if (item.id !== id) return item;

      let updatedValue = value;
      if (field === "discount" && (value === undefined || value === "" || value === null)) {
        updatedValue = 0;
      }

      const updatedItem = { ...item, [field]: updatedValue };

      if (["srp", "qty", "discount"].includes(field)) {
        const srpNum = Number(updatedItem.srp || 0);
        const qtyNum = Number(updatedItem.qty || 0);
        const discountNum = Number(updatedItem.discount || 0);
        updatedItem.total_amount = srpNum * qtyNum - discountNum;
      }

      return updatedItem;
    });

    setSkuList(updatedSkuList);
  };

  const currentTotalBilling = skuList.reduce(
    (sum, { total_amount }) => sum + Number(total_amount || 0),
    0
  );

  const totalDiscountAll = skuList.reduce(
    (sum, { discount }) => sum + Number(discount || 0),
    0
  );

  return {
    skuList,
    setSkuList,
    originalTotalBilling,
    currentTotalBilling,
    totalDiscountAll,
    handleSkuChange,
    loading
  };
};

// ============ MAIN COMPONENT ============
function EditModal({ isOpen, onClose, rowData, filter = "all" }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    sku: false,
    accounts: false,
    amount_display: false,
  });

  const storedUser = localStorage.getItem('loggedInUser');
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;
  const loggedInUsername = parsedUser?.name || 'Unknown';

  // Custom hooks
  const { filteredDistributors } = useDistributors(loggedInUsername);
  const { categories, categoryDetails, categoryMap, loading: categoriesLoading } = useCategories();
  const { activities, settingsMap } = useActivities();
  const {
    budgetList,
    setBudgetList,
    originalTotalBudget,
    currentTotalBudget,
    handleBudgetChange,
    loading: budgetLoading
  } = useBudgetList(formData?.regularpwpcode, formData, setFormData);

  const {
    skuList,
    setSkuList,
    originalTotalBilling,
    currentTotalBilling,
    totalDiscountAll,
    handleSkuChange,
    loading: skuLoading
  } = useSkuList(formData?.regularpwpcode);

  // State
  const [showModalCategory, setShowModalCategory] = useState({ accountType: false, account_type: false });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTerms, setSearchTerms] = useState("");
  const [isCreditBudgetEditable, setIsCreditBudgetEditable] = useState(false);
  const [accountTypes, setAccountTypes] = useState([]);
  const [subAccounts, setSubAccounts] = useState({});
  const [selectedMother, setSelectedMother] = useState(null);
  const [accountSearchTerm, setAccountSearchTerm] = useState("");
  const [subSearchTerm, setSubSearchTerm] = useState("");
  const [showBranchInput, setShowBranchInput] = useState(true);
  const [formValues, setFormValues] = useState({
    amountbadget: 0,
    remaining_balance: 0,
    credit_budget: 0,
  });

  // Calculated values
  const budgetDifference = currentTotalBudget - originalTotalBudget;
  const adjustedRemainingBalanceForBudget = Number(formData?.initial_remaining_balance || 0) - budgetDifference;
  const unifiedRemainingBalance = (() => {
    const currentRemainingBalance = Number(formData?.remaining_balance || 0);
    const billingChange = currentTotalBilling - originalTotalBilling;
    return currentRemainingBalance - billingChange;
  })();

  const showBudgetTable = formData.accounts === true || formData.activity === "LISTING FEE"; const isCoverPwp = !!formData.cover_code;
  const fieldsToRender = isCoverPwp
    ? coverPwpFieldsConfig
    : regularPwpFieldsConfig.filter(field => !['sku', 'accounts', 'amount_display'].includes(field.name));

  // Initialize form data
  useEffect(() => {
    if (isOpen && rowData) {
      const normalized = {
        ...rowData,
        distributor: rowData.distributor_id || rowData.distributor || "",
        distributor_code: rowData.distributor_code_id || rowData.distributor_code || "",
        categoryName: Array.isArray(rowData.categoryName)
          ? rowData.categoryName
          : typeof rowData.categoryName === 'string' && rowData.categoryName.startsWith("[")
            ? JSON.parse(rowData.categoryName)
            : rowData.categoryName || [],
        initial_remaining_balance: Number(rowData.remaining_balance) || 0,
      };
      setFormData(normalized);
    }
  }, [isOpen, rowData]);

  // Update form values
  useEffect(() => {
    const initialBalance = Number(formData?.initial_remaining_balance || 0);
    const totalBudget = budgetList.reduce((sum, item) => sum + Number(item.budget || 0), 0);
    const updatedRemainingBalance = initialBalance - totalBudget;

    setFormValues(prev => ({
      ...prev,
      amountbadget: totalBudget,
      credit_budget: totalBudget,
      remaining_balance: updatedRemainingBalance,
    }));
  }, [budgetList, formData?.initial_remaining_balance]);

  // Fetch mother accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      const { data, error } = await supabase
        .from("mother_account")
        .select("id, code, name")
        .eq("status", true)
        .order("name");

      if (!error) setAccountTypes(data);
    };

    fetchAccounts();
  }, []);

  // ============ HANDLERS ============
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleChanges = (e) => {
    const { name, value } = e.target;

    if (name !== "credit_budget") {
      handleChange(e);
      return;
    }

    setFormData((prevData) => {
      const previousCreditBudget = parseFloat(prevData.credit_budget) || 0;
      const newCreditBudget = parseFloat(value) || 0;
      const creditDifference = newCreditBudget - previousCreditBudget;
      const currentAmountBudget = parseFloat(prevData.amountbadget) || 0;
      const newAmountBudget = currentAmountBudget + creditDifference;

      return {
        ...prevData,
        credit_budget: newCreditBudget,
        amountbadget: newAmountBudget,
      };
    });
  };

  const handleChangeCreditBudget = async () => {
    console.log("🔴 handleChangeCreditBudget STARTED");

    try {
      const pwpCode = formData.coverPwpCode || formData.cover_code;

      if (!pwpCode) {
        console.error("❌ No PWP code found");
        return;
      }

      console.log("🔍 Fetching from amount_badget table...");
      console.log("📌 PWP Code:", pwpCode);

      const { data: amountBadgetData, error } = await supabase
        .from('amount_badget')
        .select('remainingbalance')
        .eq('pwp_code', pwpCode)
        .maybeSingle();

      console.log("📦 Database Response:", { data: amountBadgetData, error });

      let originalRemainingBalance;

      if (error || !amountBadgetData) {
        console.log("⚠️ No amount_badget record found, using initial_remaining_balance");
        originalRemainingBalance = parseFloat(formData.initial_remaining_balance || 0);
      } else {
        console.log("✅ Found amount_badget record");
        originalRemainingBalance = parseFloat(amountBadgetData.remainingbalance || 0);
      }

      console.log("💰 originalRemainingBalance (final):", originalRemainingBalance);

      // RESET ang budgetList to original values
      setBudgetList(prev => prev.map(item => ({
        ...item,
        budget: 0
      })));

      setFormData((prevData) => {
        console.log("🔄 Resetting to Original State:", {
          originalRemainingBalance: originalRemainingBalance,
          resetBudgetsTo: 0
        });

        return {
          ...prevData,
          credit_budget: 0,
          amountbadget: 0,
          remaining_balance: originalRemainingBalance,
          initial_remaining_balance: originalRemainingBalance
        };
      });

      setIsCreditBudgetEditable(true);
      console.log("🟢 handleChangeCreditBudget COMPLETED");

    } catch (err) {
      console.error("💥 Error in handleChangeCreditBudget:", err);
    }
  };

  const handleChange_rem = (e) => {
    const { name, value } = e.target;
    const newValue = parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
      initial_remaining_balance: newValue,
    }));
  };

  const handleCategoryChange = (category, isChecked) => {
    setFormData((prev) => {
      let newCategoryNames = fixCategoryNameInput(prev.categoryName);
      let newCategoryCodes = prev.categoryCode ? [...prev.categoryCode] : [];

      if (isChecked) {
        if (!newCategoryNames.includes(category.name)) newCategoryNames.push(category.name);
        if (!newCategoryCodes.includes(category.code)) newCategoryCodes.push(category.code);
      } else {
        newCategoryNames = newCategoryNames.filter((name) => name !== category.name);
        newCategoryCodes = newCategoryCodes.filter((code) => code !== category.code);
      }

      return {
        ...prev,
        categoryName: newCategoryNames,
        categoryCode: newCategoryCodes,
      };
    });
  };

  const fetchSubAccounts = async (mother) => {
    setSelectedMother(mother);
    if (!subAccounts[mother.id]) {
      const { data, error } = await supabase
        .from("sub_mother_account")
        .select("id, name")
        .eq("mother_id", mother.id)
        .eq("status", true)
        .order("name");

      if (!error) setSubAccounts((prev) => ({ ...prev, [mother.id]: data }));
    }
  };

  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerms.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchTerms.toLowerCase())
  );

  // ============ SUBMIT FUNCTIONS ============
const submitRegularPWP = async () => {
  // Calculate the correct credit_budget value
  const creditBudgetToSave = isCreditBudgetEditable && formData.credit_budget
    ? parseFloat(formData.credit_budget)
    : currentTotalBudget;

  // Calculate new remaining balance by subtracting credit budget from original
  const newRemainingBalance = parseFloat(formData.initial_remaining_balance || 0) - creditBudgetToSave;

  const regularPwpData = {
    regularpwpcode: formData.regularpwpcode,
    pwptype: formData.pwptype,
    distributor: formData.distributor,
    accountType: formData.accountType,
    categoryName: formData.categoryName,
    activity: formData.activity,
    objective: formData.objective,
    promoScheme: formData.promoScheme,
    activityDurationFrom: formData.activityDurationFrom,
    activityDurationTo: formData.activityDurationTo,
    isPartOfCoverPwp: formData.isPartOfCoverPwp,
    coverPwpCode: formData.coverPwpCode,
    amountbadget: creditBudgetToSave,
    remaining_balance: parseFloat(newRemainingBalance.toFixed(2)),
    credit_budget: creditBudgetToSave,
    sku: formData.sku,
    accounts: formData.accounts,
    amount_display: formData.amount_display,
    remarks: formData.remarks,
    created_at: new Date().toISOString(),
  };

  if (!formData.regularpwpcode) {
    throw new Error("Regular PWP Code is required but missing.");
  }

  const { data: existingRegularPwp, error: selectRegularError } = await supabase
    .from('regular_pwp')
    .select('id')
    .eq('regularpwpcode', formData.regularpwpcode);

  if (selectRegularError) {
    throw new Error(`Error checking regular_pwp: ${selectRegularError.message}`);
  }

  if (existingRegularPwp.length > 0) {
    const { error: updateRegularError } = await supabase
      .from('regular_pwp')
      .update(regularPwpData)
      .eq('id', existingRegularPwp[0].id);

    if (updateRegularError) {
      throw new Error(`Error updating regular_pwp: ${updateRegularError.message}`);
    }
  } else {
    const { error: insertRegularError } = await supabase
      .from('regular_pwp')
      .insert([regularPwpData]);

    if (insertRegularError) {
      throw new Error(`Error inserting regular_pwp: ${insertRegularError.message}`);
    }
  }

  return { creditBudgetToSave, newRemainingBalance };
};
const submitCoverPWP = async () => {
  const coverPwpData = {
    cover_code: formData.cover_code,
    distributor_code: formData.distributor_code,
    account_type: formData.account_type,
    amount_badget: formData.amount_badget,
    pwp_type: formData.pwp_type,
    objective: formData.objective,
    details: formData.details,
    remarks: formData.remarks,
    created_at: new Date().toISOString(),
  };

  if (!formData.cover_code) {
    throw new Error("Cover code is required but missing.");
  }

  const { data: existingCoverPwp, error: selectCoverError } = await supabase
    .from('cover_pwp')
    .select('id')
    .eq('cover_code', formData.cover_code);

  if (selectCoverError) {
    throw new Error(`Error checking cover_pwp: ${selectCoverError.message}`);
  }

  if (existingCoverPwp.length > 0) {
    const { error: updateCoverError } = await supabase
      .from('cover_pwp')
      .update(coverPwpData)
      .eq('id', existingCoverPwp[0].id);

    if (updateCoverError) {
      throw new Error(`Error updating cover_pwp: ${updateCoverError.message}`);
    }
  } else {
    const { error: insertCoverError } = await supabase
      .from('cover_pwp')
      .insert([coverPwpData]);

    if (insertCoverError) {
      throw new Error(`Error inserting cover_pwp: ${insertCoverError.message}`);
    }
  }

  // REMOVED: onClose(); - Let handleSubmit handle this
};

  const handleSaveAccountstable = async () => {
    if (!formData.regularpwpcode) {
      throw new Error('Regular PWP Code is required but missing.');
    }

    const accountData = budgetList.map((item) => ({
      id: item.id,
      account_name: item.account_name,
      budget: item.budget,
      total_budget: item.budget,
    }));

    let accountsUpdated = true;

    for (const account of accountData) {
      const { data: existingAccounts, error: selectAccountError } = await supabase
        .from('regular_accountlis_badget')
        .select('id, regularcode, total_budget')
        .eq('regularcode', formData.regularpwpcode)
        .eq('id', account.id);

      if (selectAccountError) {
        throw new Error(`Error checking account budget: ${selectAccountError.message}`);
      }

      if (existingAccounts && existingAccounts.length > 0) {
        const { error: updateError } = await supabase
          .from('regular_accountlis_badget')
          .update({
            account_name: account.account_name,
            budget: account.budget,
            total_budget: account.total_budget,
          })
          .eq('id', existingAccounts[0].id);

        if (updateError) {
          accountsUpdated = false;
          console.error(`Error updating account with id ${account.id}: ${updateError.message}`);
        }
      }
    }

    return accountsUpdated;
  };

const submitAccountToRegular = async (accountsUpdated, creditBudgetValue, remainingBalanceValue) => {
  if (!formData.regularpwpcode) {
    throw new Error('Regular PWP Code is required but missing.');
  }

  if (!accountsUpdated) {
    throw new Error('One or more account updates failed, cannot update regular PWP.');
  }

  const { data: pwpData, error: pwpSelectError } = await supabase
    .from('regular_pwp')
    .select('id')
    .eq('regularpwpcode', formData.regularpwpcode);

  if (pwpSelectError) {
    throw new Error(`Error checking regular PWP: ${pwpSelectError.message}`);
  }

  if (pwpData && pwpData.length > 0) {
    const { error: updatePwpError } = await supabase
      .from('regular_pwp')
      .update({
        remaining_balance: remainingBalanceValue,
        credit_budget: creditBudgetValue,
        amountbadget: creditBudgetValue
      })
      .eq('regularpwpcode', formData.regularpwpcode);

    if (updatePwpError) {
      throw new Error(`Error updating regular PWP: ${updatePwpError.message}`);
    }
  }
};
  const submitSkuTable = async () => {
    if (!formData.regularpwpcode) {
      throw new Error('Regular PWP Code is required but missing.');
    }

    const regular_code = formData.regularpwpcode;
    const normalSkuRows = skuList.filter(row => row.sku_code !== 'Total:');

    for (const row of normalSkuRows) {
      const computedBilling = (Number(row.srp || 0) * Number(row.qty || 0)) - Number(row.discount || 0);

      const payload = {
        srp: row.srp || 0,
        qty: row.qty || 0,
        uom: row.uom || 'pc',
        discount: row.discount || 0,
        billing_amount: computedBilling,
        total_amount: computedBilling,
        created_at: new Date().toISOString(),
      };

      const { data: existingSku, error: checkError } = await supabase
        .from('regular_sku')
        .select('id')
        .eq('regular_code', regular_code)
        .eq('sku_code', row.sku_code)
        .limit(1)
        .maybeSingle();

      if (checkError) {
        console.error(`Error checking SKU ${row.sku_code}:`, checkError.message);
        continue;
      }

      if (existingSku) {
        await supabase
          .from('regular_sku')
          .update(payload)
          .eq('id', existingSku.id);
      }
    }
  };

  const submitSkuTotalToRegular = async (regularpwpcode, remaining_balance, _credit_budget, amountbadget) => {
    const resolvedAmountBudget = (amountbadget && amountbadget > 0) ? amountbadget : currentTotalBilling;

    const { error: updatePwpError } = await supabase
      .from('regular_pwp')
      .update({
        remaining_balance,
        credit_budget: resolvedAmountBudget,
        amountbadget: resolvedAmountBudget,
      })
      .eq('regularpwpcode', regularpwpcode);

    if (updatePwpError) {
      throw new Error(`Failed to update regular_pwp: ${updatePwpError.message}`);
    }
  };

const handleSubmit = async () => {
  setUpdating(true);
  setError(null);

  try {
    const pwpCodeToDelete = formData.cover_code || formData.regularpwpcode;

    // Delete approval history
    if (pwpCodeToDelete) {
      await supabase
        .from('Approval_History')
        .delete()
        .eq('PwpCode', pwpCodeToDelete);
    }

    if (formData.cover_code) {
      // Handle Cover PWP
      await submitCoverPWP();
    } else {
      // Handle Regular PWP
      const creditBudgetToSave = isCreditBudgetEditable && formData.credit_budget
        ? parseFloat(formData.credit_budget)
        : currentTotalBudget;

      const newRemainingBalance = parseFloat(formData.initial_remaining_balance || 0) - creditBudgetToSave;

      // Execute all updates
      const accountsUpdated = await handleSaveAccountstable();
      await submitSkuTable();
      await submitRegularPWP();
      await submitAccountToRegular(
        accountsUpdated,
        creditBudgetToSave,
        newRemainingBalance
      );
      await submitSkuTotalToRegular(
        formData.regularpwpcode,
        newRemainingBalance,
        currentTotalBilling,
        creditBudgetToSave
      );
    }

    // Show success message
    await Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Successfully updated all data',
      timer: 2000,
      showConfirmButton: false
    });

    // Close modal and reload
    onClose();
    window.location.reload();

  } catch (err) {
    console.error('❌ Submit error:', err);
    
    // Show error message
    await Swal.fire({
      icon: 'error',
      title: 'Submission Failed',
      text: err.message || 'Something went wrong during submission.',
      confirmButtonColor: '#3b82f6'
    });
    
    setError(`Submit Error: ${err.message}`);
  } finally {
    setUpdating(false);
  }
};
  // ============ RENDER FIELD COMPONENTS ============
  const renderDistributorSelect = (name, label, value, disabled) => (
    <div key={name} style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <select
        name={name}
        value={value || ""}
        onChange={handleChange}
        disabled={disabled || updating}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: disabled ? "#f9f9f9" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <option value="">-- Select --</option>
        {filteredDistributors.map((dist) => (
          <option key={dist.id} value={dist.code}>
            {dist.distributor_name}
          </option>
        ))}
        {value && !filteredDistributors.some(d => d.code === value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    </div>
  );

  const renderDateInput = (name, label, value, disabled) => (
    <div key={name} style={{ display: "flex", flexDirection: "column", marginBottom: "16px", position: "relative" }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="date"
          name={name}
          value={formData[name] || ""}
          onChange={handleChanges}
          disabled={disabled || updating}
          style={{
            width: "100%",
            padding: "10px 40px 10px 10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: disabled ? "#f9f9f9" : "#fff",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
        <span style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          fontSize: "18px",
          color: "#888",
        }}>
          📅
        </span>
      </div>
    </div>
  );

const renderCreditBudgetInput = (name, label, disabled) => {
  const displayValue = isCreditBudgetEditable 
    ? (formData[name] || "") 
    : currentTotalBudget.toFixed(2);
  
  return (
    <div key={name} style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <input
        type="number"
        name={name}
        value={displayValue}
        onChange={(e) => {
          if (isCreditBudgetEditable) {
            handleChanges(e);
          }
        }}
        disabled={!isCreditBudgetEditable || disabled || updating}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: !isCreditBudgetEditable ? "#f9f9f9" : "#fff",
        }}
      />
      {/* Hide button when budget table is showing */}
      {!showBudgetTable && (
        <button
          type="button"
          onClick={handleChangeCreditBudget}
          disabled={disabled || updating}
          style={{
            marginTop: "10px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: "#ff5f5f",
            color: "#fff",
            cursor: "pointer",
            transform: "translateY(20px)",
          }}
        >
          Change?
        </button>
      )}
    </div>
  );
};
  const renderActivitySelect = (name, label) => (
    <div key={name} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <label style={{ marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
        {label} <span style={{ color: 'red' }}>*</span>
      </label>
      <select
        name="activity"
        value={formData.activity || ""}
        onChange={(e) => {
          handleChange(e);
          const selectedCode = e.target.value;
          const setting = settingsMap[selectedCode] || {};
          setFormData((prev) => ({
            ...prev,
            sku: setting.sku || false,
            accounts: setting.accounts || false,
            amount_display: setting.amount_display || false,
          }));
        }}
        disabled={updating}
        style={{
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          background: '#fff',
          appearance: 'none',
          paddingRight: '40px',
        }}
      >
        <option value="">Select Activity</option>
        {activities.map((opt, index) => (
          <option key={index} value={opt.code}>
            {opt.name}
          </option>
        ))}
      </select>
      <span style={{
        position: 'absolute',
        right: '20px',
        top: '65%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        color: '#555',
        fontSize: '14px',
        userSelect: 'none',
      }}>
        ▼
      </span>
    </div>
  );

  const renderCategoryInput = (name, label) => (
    <div key={name} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          readOnly
          value={fixCategoryNameInput(formData.categoryName).join(", ")}
          onClick={() => setShowCategoryModal(true)}
          placeholder="Select Categories"
          style={{
            padding: "10px",
            paddingRight: "35px",
            borderRadius: "8px",
            border: "1px solid",
            borderColor: fixCategoryNameInput(formData.categoryName).length > 0 ? "green" : "#ccc",
            cursor: "pointer",
            transition: "border-color 0.3s",
            width: "100%",
            boxSizing: "border-box",
          }}
          disabled={updating}
        />
        <span style={{
          position: "absolute",
          top: "50%",
          right: "10px",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: "#555",
          fontSize: "18px",
          userSelect: "none",
        }}>
          🔍
        </span>
      </div>

      {showCategoryModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
          }}
          onClick={() => setShowCategoryModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#e6f0ff",
              padding: "25px",
              borderRadius: "12px",
              width: "500px",
              maxHeight: "70vh",
              overflowY: "auto",
              boxShadow: "0 0 15px rgba(0, 70, 255, 0.4)",
              border: "2px solid #3b82f6",
            }}
          >
            <h3 style={{ marginTop: 0, textAlign: "center", color: "#1e40af", fontWeight: "700" }}>
              Select Categories
            </h3>
            <input
              type="text"
              placeholder="Search category by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "15px",
                borderRadius: "6px",
                border: "1.5px solid #3b82f6",
                outline: "none",
                fontSize: "14px",
                color: "#1e3a8a",
              }}
            />
            {categoriesLoading ? (
              <p style={{ color: "#1e40af" }}>Loading categories...</p>
            ) : filteredCategories.length === 0 ? (
              <p style={{ color: "#1e40af" }}>No categories found.</p>
            ) : (
              <ul style={{ listStyle: "none", paddingLeft: 0, maxHeight: "300px", overflowY: "auto", color: "#1e40af" }}>
                {filteredCategories.map((cat) => {
                  const isChecked = formData.categoryCode?.includes(cat.code);
                  return (
                    <li key={cat.id} style={{ marginBottom: "10px" }}>
                      <label style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        fontWeight: isChecked ? "600" : "400",
                        color: isChecked ? "#2563eb" : "#1e3a8a",
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleCategoryChange(cat, e.target.checked)}
                          style={{ marginRight: "10px", cursor: "pointer" }}
                        />
                        <strong style={{ marginRight: "6px" }}>{cat.code}</strong> - {cat.name}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              onClick={() => setShowCategoryModal(false)}
              style={{
                marginTop: "15px",
                padding: "10px 20px",
                cursor: "pointer",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "14px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderCheckbox = (name, label, value, disabled) => (
    <div key={name} style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <input
        type="checkbox"
        name={name}
        checked={value}
        onChange={handleChange}
        disabled={disabled || updating}
        style={{ width: "18px", height: "18px" }}
      />
    </div>
  );

  const renderAccountTypeInput = (name, label) => (
    <div key={name} style={{ position: "relative", minHeight: 60 }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <input
        type="text"
        className="form-control"
        placeholder="Select or type account"
        value={
          Array.isArray(formData.accountType)
            ? accountTypes
              .filter(acc => formData.accountType.includes(acc.id))
              .map(acc => acc.name)
              .join(", ")
            : accountTypes.find(acc => acc.id === formData.accountType)?.name || formData.accountType || ""
        }
        onChange={(e) => setFormData(prev => ({ ...prev, accountType: e.target.value }))}
        onClick={() => setShowModalCategory(prev => ({ ...prev, [name]: true }))}
        style={{ padding: "10px", cursor: "pointer" }}
      />

      {showModalCategory[name] && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={() => setShowModalCategory(prev => ({ ...prev, [name]: false }))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#f0f5ff",
              borderRadius: "12px",
              padding: "25px",
              width: "420px",
              maxHeight: "450px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ marginBottom: "16px", textAlign: "center", color: "#1e40af", fontWeight: "700", fontSize: "20px" }}>
              Select Account
            </h3>

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
                  .filter(opt => opt.name.toLowerCase().includes(accountSearchTerm.toLowerCase()))
                  .map(opt => (
                    <div
                      key={opt.id}
                      style={{ padding: "8px 10px", borderBottom: "1px solid #eee", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      onClick={() => {
                        setSelectedMother(opt);
                        fetchSubAccounts(opt);
                        if (opt.name === "NON-CHAIN") {
                          setShowBranchInput(false);
                          setFormData(prev => ({ ...prev, accountType: [] }));
                        } else {
                          setShowBranchInput(true);
                        }
                      }}
                    >
                      <span>({opt.code}) - {opt.name}</span>
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
                  ?.filter(s => s.name.toLowerCase().includes(subSearchTerm.toLowerCase()))
                  .map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", padding: "4px 0" }}>
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
                            if (updated.includes(s.id)) updated = updated.filter(x => x !== s.id);
                            else updated.push(s.id);
                            setFormData(prev => ({ ...prev, accountType: updated }));
                          } else {
                            setFormData(prev => ({ ...prev, accountType: s.name }));
                            setShowModalCategory(prev => ({ ...prev, [name]: false }));
                          }
                        }}
                        id={`sub_${s.id}`}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                      <label htmlFor={`sub_${s.id}`} style={{ marginLeft: "6px", cursor: "pointer" }}>
                        {s.name} <span style={{ color: "#888", fontSize: "12px" }}>({s.id})</span>
                      </label>
                    </div>
                  ))}
              </>
            )}

            <button
              onClick={() => setShowModalCategory(prev => ({ ...prev, [name]: false }))}
              style={{
                padding: "12px 20px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "16px",
                cursor: "pointer",
                alignSelf: "center",
                width: "100%",
                maxWidth: "180px",
                marginTop: "12px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderRemainingBalanceInput = (name, label, disabled) => (
    <div key={name} style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <input
        type="number"
        name={name}
        value={formData.remaining_balance || 0}
        onChange={handleChange_rem}
        disabled={disabled || updating}
        step="0.01"
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: (disabled || updating) ? "#f9f9f9" : "#fff",
          fontWeight: "600",
          color: (formData.remaining_balance || 0) < 0 ? "red" : "green",
        }}
      />
    </div>
  );

  const renderTextInput = (name, label, value, disabled) => (
    <div key={name} style={{ display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={handleChange}
        disabled={disabled || updating}
        style={{
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          background: disabled ? "#f9f9f9" : "#fff",
        }}
      />
    </div>
  );

  const renderField = ({ name, label, disabled, type }) => {
    const value = formData[name] ?? (type === "checkbox" ? false : "");

    if (type === "select" && (name === "distributor" || name === "distributor_code")) {
      return renderDistributorSelect(name, label, value, disabled);
    }

    if (name === "activityDurationFrom" || name === "activityDurationTo") {
      return renderDateInput(name, label, value, disabled);
    }

    if (name === "credit_budget") {
      return renderCreditBudgetInput(name, label, disabled);
    }

    if (name === "activity") {
      return renderActivitySelect(name, label);
    }

    if (name === "categoryName") {
      return renderCategoryInput(name, label);
    }

    if (type === "checkbox") {
      return renderCheckbox(name, label, value, disabled);
    }

    if (name === "accountType" || name === "account_type") {
      return renderAccountTypeInput(name, label);
    }

    if (name === "remaining_balance") {
      return renderRemainingBalanceInput(name, label, disabled);
    }

    return renderTextInput(name, label, value, disabled);
  };

  // ============ RENDER ============
  if (!isOpen || !formData) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        padding: "30px",
        width: "98%",
        maxWidth: "1300px",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>Edit Record</h2>
          <button
            onClick={onClose}
            disabled={updating}
            style={{
              fontSize: "20px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#555",
            }}
          >
            ✕
          </button>
        </div>

        {error && <p style={{ color: "red", marginBottom: "16px" }}>{error}</p>}

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "20px",
            marginBottom: "30px",
          }}>
            {fieldsToRender.map(renderField)}
          </div>

          {showBudgetTable && (
            <div style={{
              marginTop: "30px",
              borderTop: "1px solid #ddd",
              paddingTop: "20px",
              maxHeight: "500px",
              overflowY: "auto",
            }}>
              {budgetLoading ? (
                <p>Loading budgets...</p>
              ) : budgetList.length === 0 ? (
                <p>No budgets found for selected code.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "400px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#3b82f6", color: "white" }}>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>Account Name</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetList.map(({ id, account_name, budget }) => (
                      <tr key={id} style={{ borderBottom: "1px solid #ddd" }}>
                        <td style={{ padding: "8px", border: "1px solid #ddd", wordBreak: "break-word" }}>
                          {account_name}
                        </td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                          <input
                            type="number"
                            value={budget}
                            onChange={(e) => handleBudgetChange(id, e.target.value)}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              padding: "6px",
                              borderRadius: "4px",
                              border: "1px solid #ccc",
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                      <td style={{ padding: "8px", border: "1px solid #ddd" }}>Original Remaining Balance</td>
                      <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "right" }}>
                        {Number(formData?.initial_remaining_balance || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                      <td style={{ padding: "8px", border: "1px solid #ddd" }}>Original Total Budget</td>
                      <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "right" }}>
                        {originalTotalBudget.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                      <td style={{ padding: "8px", border: "1px solid #ddd" }}>Current Total Budget</td>
                      <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "right" }}>
                        {currentTotalBudget.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                      <td style={{ padding: "8px", border: "1px solid #ddd" }}>Budget Difference</td>
                      <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "right" }}>
                        {budgetDifference.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{
                      fontWeight: "bold",
                      backgroundColor: "#e3f2fd",
                      color: "#1565c0",
                      fontSize: "16px",
                    }}>
                      <td style={{ padding: "12px", border: "2px solid #1976d2" }}>Remaining Balance</td>
                      <td style={{ padding: "12px", border: "2px solid #1976d2", textAlign: "right" }}>
                        {adjustedRemainingBalanceForBudget.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                      <td style={{ padding: "8px", border: "1px solid #ddd" }}>Credit Budget</td>
                      <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "right" }}>
                        {currentTotalBudget.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}


          {/* SKU Table */}
          {skuList.length > 0 && (
            <div style={{
              marginTop: "30px",
              borderTop: "1px solid #ddd",
              paddingTop: "20px",
              maxHeight: "800px",
              overflowY: "auto",
            }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "#f9f9f9",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                borderRadius: "8px",
                overflow: "hidden",
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: "#3b82f6",
                    color: "white",
                    fontWeight: "bold",
                    textAlign: "center",
                    fontSize: "14px",
                  }}>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>Accounts</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>SKU</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>SRP</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>Qty</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>UOM</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>Total</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>Discount ₱</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>Billing Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {skuList.map(({ id, account_name, sku_code, srp, qty, uom, discount, total_amount }) => {
                    if (sku_code === "Total:") return null;

                    const srpNum = Number(srp || 0);
                    const qtyNum = Number(qty || 0);
                    const discountNum = Number(discount || 0);
                    const totalAmount = Number(total_amount || 0);
                    const totalBeforeDiscount = srpNum * qtyNum;

                    return (
                      <tr
                        key={id}
                        style={{
                          borderBottom: "1px solid #ddd",
                          textAlign: "center",
                          fontSize: "14px",
                          transition: "background-color 0.3s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f8ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                      >
                        <td style={{ minWidth: "180px", padding: "10px", border: "1px solid #ddd" }}>
                          <input
                            type="text"
                            value={account_name || ""}
                            onChange={(e) => handleSkuChange(id, "account_name", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                              fontSize: "14px",
                            }}
                            disabled
                          />
                        </td>
                        <td style={{ minWidth: "200px", padding: "10px", border: "1px solid #ddd" }}>
                          <input
                            type="text"
                            value={categoryMap[sku_code] || sku_code || ""}
                            onChange={(e) => handleSkuChange(id, "sku_code", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                            }}
                            disabled
                          />
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                          <input
                            type="number"
                            value={srp || 0}
                            step="0.01"
                            onChange={(e) => handleSkuChange(id, "srp", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                            }}
                          />
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                          <input
                            type="number"
                            value={qty || 0}
                            onChange={(e) => handleSkuChange(id, "qty", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                            }}
                          />
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                          <select
                            value={uom || "pc"}
                            onChange={(e) => handleSkuChange(id, "uom", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                            }}
                          >
                            <option value="pc">PC</option>
                            <option value="case">Case</option>
                            <option value="ibx">IBX</option>
                          </select>
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                          <span>{totalBeforeDiscount.toFixed(2)}</span>
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                          <input
                            type="number"
                            value={discount !== undefined && discount !== null ? discount : 0}
                            step="0.01"
                            onChange={(e) => {
                              const value = e.target.value;
                              handleSkuChange(id, "discount", value === "" ? 0 : parseFloat(value));
                            }}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                            }}
                          />
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                          <strong>{totalAmount.toFixed(2)}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="7" style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      Billing Amount:
                    </td>
                    <td style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      {skuList.reduce((sum, { total_amount }) => sum + Number(total_amount || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="7" style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      (-) Discount:
                    </td>
                    <td style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd", color: "red" }}>
                      -{totalDiscountAll.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="7" style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd", fontWeight: "bold" }}>
                      Total Billing (After Discount):
                    </td>
                    <td style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd", fontWeight: "bold" }}>
                      {skuList.reduce((sum, { total_amount }) => sum + Number(total_amount || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        textAlign: "right",
                        padding: "12px",
                        border: "1px solid #ddd",
                        fontWeight: "bold",
                        fontSize: "16px",
                        paddingTop: "20px",
                        backgroundColor: "#f0f8ff",
                      }}
                    >
                      Remaining Balance: {unifiedRemainingBalance.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", marginTop: "30px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={updating}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                backgroundColor: "#f1f5f9",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: updating ? "#9ca3af" : "#3b82f6",
                color: "white",
                fontWeight: "600",
                cursor: updating ? "not-allowed" : "pointer",
              }}
            >
              {updating ? "Saving..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditModal;
