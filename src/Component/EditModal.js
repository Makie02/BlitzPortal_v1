import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function EditModal({ isOpen, onClose, rowData, filter = "all", filteredDistributors = [] }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && rowData) {
      setFormData({ ...rowData });
    }
  }, [isOpen, rowData]);
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    console.log("handleChange", name, value, checked);
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  useEffect(() => {
    if (isOpen && rowData) {
      const normalized = {
        ...rowData,
        distributor: rowData.distributor_id || rowData.distributor || "", // distributor_id should be the ID
        distributor_code: rowData.distributor_code_id || rowData.distributor_code || "",
      };
      setFormData(normalized);
    }
  }, [isOpen, rowData]);





  const [showModal_Account, setShowModal_Account] = useState(false);

  const [showModalCategory, setShowModalCategory] = useState({ accountType: false, account_type: false });
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [categoryDetails, setCategoryDetails] = useState([]);

  // Fetch all categories initially
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("categorydetails")
        .select("*")
        .order("code", { ascending: true });
      if (error) {
        console.error("Error fetching categories:", error.message);
      } else {
        setCategoryDetails(data);
      }
    };
    fetchCategories();
  }, []);


  // Get selected account names for display
  const getCategoryNames = (fieldName) => {
    if (!formData[fieldName]?.length) return "";
    const selectedNames = categoryDetails
      .filter((opt) => formData[fieldName].includes(opt.code))
      .map((opt) => opt.name);
    return selectedNames.join(", ");
  };

  const toggleCategoryType = (name, code) => {
    let updatedAccountTypes = [...formData.accountType];
    if (updatedAccountTypes.includes(code)) {
      // Remove
      updatedAccountTypes = updatedAccountTypes.filter((c) => c !== code);
      // Also remove from budgetList
      setBudgetList((prev) => prev.filter((item) => item.account_code !== code));
    } else {
      // Add
      updatedAccountTypes.push(code);
      // Add new account to budgetList with default budget 0
      const newAccount = categoryDetails.find((cat) => cat.code === code);
      if (newAccount) {
        setBudgetList((prev) => [
          ...prev,
          {
            id: newAccount.code, // Use code as id or generate unique
            account_code: newAccount.code,
            account_name: newAccount.name,
            budget: 0,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }

    setFormData((prev) => ({
      ...prev,
      accountType: updatedAccountTypes,
    }));
  };



  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("categorydetails")
        .select("*")
        .order("code", { ascending: true });
      if (error) {
        console.error("Error fetching categories:", error.message);
        setCategories([]);
      } else {
        setCategories(data);
      }
      setLoading(false);
    };
    fetchCategories();
  }, []);
  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const handleOpenCategoryModal = () => {
    setShowCategoryModal(true);
    setSearchTerm("");
  };

  const handleCloseCategoryModal = () => {
    setShowCategoryModal(false);
  };
  const handleCategoryChange = (category, isChecked) => {
    setFormData((prev) => {
      let newCategoryNames = prev.categoryName ? [...prev.categoryName] : [];
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
  // Helper function to safely parse categoryName string to array
  const parseCategoryName = (value) => {
    if (Array.isArray(value)) return value; // already array
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        // If parsed is not array, return as single element array
        return [parsed];
      } catch (e) {
        // If JSON.parse fails, return string in an array to display
        return [value];
      }
    }
    return [];
  };



  const [formData, setFormData] = useState({
    sku: false,
    accounts: false,
    amount_display: false,
    // ... rest
  });



  useEffect(() => {
    if (isOpen && rowData) {
      const parsed = {
        ...rowData,
        categoryName: Array.isArray(rowData.categoryName)
          ? rowData.categoryName
          : typeof rowData.categoryName === 'string' && rowData.categoryName.startsWith("[")
            ? JSON.parse(rowData.categoryName)
            : rowData.categoryName || [],
      };

      setFormData(parsed);
    }
  }, [isOpen, rowData]);

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
      .from('activity')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      alert('Error fetching activities: ' + error.message);
    } else {
      setActivities(data);
    }
    setLoading(false);
  };

  // Fetch activity settings (e.g., amount_display)
  // In your fetchSettings
  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('activity_settings')
      .select('activity_code, sku, accounts,amount_display');
    if (error) {
      console.error('❌ Error loading settings:', error);
      return;
    }
    const map = {};
    data.forEach(setting => {
      map[setting.activity_code] = {
        sku: setting.sku === true,
        accounts: setting.accounts === true,
        amount_display: setting.amount_display === true,

      };
    });
    console.log('✅ Settings map loaded:', map);
    setSettingsMap(map);
  };

  // In handleFormChange or wherever formData.activity gets set



  useEffect(() => {
    fetchActivities();
    fetchSettings();
  }, []);




  const [budgetList, setBudgetList] = useState([]);
  const [budgetLoading, setBudgetLoading] = useState(false);
  // Assume you have these in your component's state:

  // Handler for editing budget value

  // Assuming you get current remaining_balance value from formData or somewhere else:

  // 2. State for form values (add this)
  const [formValues, setFormValues] = useState({
    amountbadget: 0,
    remaining_balance: 0,
    credit_budget: 0,
    // ... other form fields if needed
  });

  // Calculate total budget from budgetList
  const totalBudget = budgetList.reduce((sum, item) => sum + Number(item.budget || 0), 0);

  // Save initial_remaining_balance on modal open
  useEffect(() => {
    if (isOpen && rowData) {
      setFormData(prev => ({
        ...rowData,
        initial_remaining_balance: Number(rowData.remaining_balance) || 0,
      }));
    }
  }, [isOpen, rowData]);

  // Update formValues whenever totalBudget or initial_remaining_balance changes
  useEffect(() => {
    const initialBalance = Number(formData?.initial_remaining_balance || 0);

    const updatedRemainingBalance = initialBalance - totalBudget;

    setFormValues(prev => ({
      ...prev,
      amountbadget: totalBudget,
      credit_budget: totalBudget,
      remaining_balance: updatedRemainingBalance,
    }));
  }, [totalBudget, formData?.initial_remaining_balance]);

  // Update budget list handler
  const handleBudgetChange = (id, newBudget) => {
    setBudgetList(prev =>
      prev.map(item =>
        item.id === id ? { ...item, budget: parseFloat(newBudget) || 0 } : item
      )
    );
  };

  // Fetch budget list when regularpwpcode changes
  useEffect(() => {
    if (!formData?.regularpwpcode) {
      setBudgetList([]);
      return;
    }

    const fetchBudgetList = async () => {
      setBudgetLoading(true);
      const { data, error } = await supabase
        .from("regular_accountlis_badget")
        .select("*")
        .eq("regularcode", formData.regularpwpcode);

      if (error) {
        console.error("Error fetching budget list:", error.message);
        setBudgetList([]);
      } else {
        setBudgetList(data);
      }
      setBudgetLoading(false);
    };

    fetchBudgetList();
  }, [formData?.regularpwpcode]);

  const showBudgetTable = formData.accounts === true; // or any logic you want

const handleSubmit = async () => {
  setUpdating(true);
  setError(null);

  try {
    // 1. Upsert budgets in regular_accountlis_badget (same as before)
    for (const budgetItem of budgetList) {
      const { account_code, account_name } = budgetItem;
      const budget = Number(budgetItem.budget) || 0;

      const { data: existingRows, error: selectError } = await supabase
        .from('regular_accountlis_badget')
        .select('id')
        .eq('regularcode', formData.regularpwpcode)
        .eq('account_code', account_code);

      if (selectError) throw new Error(`Error checking budget: ${selectError.message}`);

      if (existingRows.length > 0) {
        const budgetId = existingRows[0].id;
        const { error: updateError } = await supabase
          .from('regular_accountlis_badget')
          .update({ budget })
          .eq('id', budgetId);

        if (updateError) throw new Error(`Error updating budget for ${account_code}: ${updateError.message}`);
      } else {
        const { error: insertError } = await supabase
          .from('regular_accountlis_badget')
          .insert([{
            regularcode: formData.regularpwpcode,
            account_code,
            account_name,
            budget,
          }]);

        if (insertError) throw new Error(`Error inserting budget for ${account_code}: ${insertError.message}`);
      }
    }

    // 2. Calculate total account budget
    const accountBudget = budgetList.reduce((sum, item) => sum + (Number(item.budget) || 0), 0);

    // 3. Process SKU list and calculate skuBudget
    let skuBudget = 0;
    for (const skuItem of skuList) {
      if (skuItem.row_type === 'total') continue;

      const { id, sku, srp, qty, uom, discount } = skuItem;
      const srpNum = Number(srp) || 0;
      const qtyNum = Number(qty) || 0;
      const discountNum = Number(discount) || 0;

      const billing_amount = (srpNum * qtyNum) - discountNum;
      skuBudget += billing_amount;

      if (id) {
        const { error: skuUpdateError } = await supabase
          .from('regular_sku_listing')
          .update({ sku, srp: srpNum, qty: qtyNum, uom, discount: discountNum, billing_amount })
          .eq('id', id);

        if (skuUpdateError) throw new Error(`Error updating SKU ID ${id}: ${skuUpdateError.message}`);
      } else {
        const { error: skuInsertError } = await supabase
          .from('regular_sku_listing')
          .insert([{
            sku,
            srp: srpNum,
            qty: qtyNum,
            uom,
            discount: discountNum,
            billing_amount,
            regular_code: formData.regularpwpcode,
            row_type: 'regular',
          }]);

        if (skuInsertError) throw new Error(`Error inserting new SKU (${sku}): ${skuInsertError.message}`);
      }
    }

    // 4. Calculate total credit budget
    const creditBudget = accountBudget + skuBudget;

    // Use initial_remaining_balance if available, otherwise remaining_balance
    const initialRemainingBalance = Number(formData.initial_remaining_balance ?? formData.remaining_balance) || 0;

    // Calculate updated remaining balance
    const updatedRemainingBalance = initialRemainingBalance - creditBudget;

    // 5. Determine table and update data based on formData.source
    const table = formData.source || 'regular_pwp'; // fallback to regular_pwp

    // Prepare data to update
    const updatedData = {
      remaining_balance: updatedRemainingBalance,
      credit_budget: creditBudget,
    };

    // Handle code mapping (like in your old handleSave)
    if (filter === "all" && formData.code) {
      if (table === "regular_pwp") {
        updatedData.regularpwpcode = formData.code;
      } else if (table === "cover_pwp") {
        updatedData.cover_code = formData.code;
      }
    }

    // Remove fields that don't exist in table schema
    if (table === "cover_pwp") {
      // cover_pwp has distributor_code, NOT distributor
      delete updatedData.distributor;
    } else if (table === "regular_pwp") {
      // regular_pwp has distributor, NOT distributor_code
      delete updatedData.distributor_code;
    }

    if (!formData.id) throw new Error("No ID found for updating");

    const { error: updateParentError } = await supabase
      .from(table)
      .update(updatedData)
      .eq('id', formData.id);

    if (updateParentError) throw new Error(`Error updating ${table}: ${updateParentError.message}`);

    alert('All data saved successfully!');
    onClose();

  } catch (err) {
    setError(`Submit Error: ${err.message}`);
  } finally {
    setUpdating(false);
  }
};





  useEffect(() => {
    if (!formData?.regularpwpcode) {
      setSkuList([]);
      return;
    }

    const fetchSkuList = async () => {
      setSkuLoading(true);
      const { data, error } = await supabase
        .from("regular_sku_listing")
        .select("*")
        .eq("regular_code", formData.regularpwpcode);

      if (error) {
        console.error("Error fetching SKU list:", error.message);
        setSkuList([]);
      } else {
        setSkuList(data);
      }
      setSkuLoading(false);
    };

    fetchSkuList();
  }, [formData?.regularpwpcode]);
  const handleSkuChange = (id, field, value) => {
    setSkuList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: field === "qty" ? parseInt(value) || 0 : parseFloat(value) || value } : item
      )
    );
  };
  const [skuList, setSkuList] = useState([]);      // Holds the SKU data list
  const [skuLoading, setSkuLoading] = useState(false); // Tracks loading state for SKU fetch
  const [hasChanges, setHasChanges] = useState(false);


  if (!isOpen || !formData) return null;

  const isCoverPwp = !!formData.cover_code;

  const coverPwpFields = [
    { name: "cover_code", label: "COVER CODE", disabled: true },
    { name: "distributor_code", label: "Distributor Code", type: "select" },  // dropdown here
    { name: "account_type", label: "Account Type" },
    { name: "amount_badget", label: "Amount Badget" },
    { name: "pwp_type", label: "PWP Type" },
    { name: "objective", label: "Objective Promo Scheme" },
    { name: "details", label: "Details" },
    { name: "remarks", label: "Remarks" },
    { name: "created_at", label: "Created At" },
  ];

  const regularPwpFields = [
    { name: "regularpwpcode", label: "REGULAR CODE", disabled: true },
    { name: "pwptype", label: "PWP Type" },

    { name: "distributor", label: "Distributor", type: "select" }, // dropdown here
    { name: "accountType", label: "Account Type" },
    { name: "categoryName", label: "Category" },

    { name: "activity", label: "Activity" },
    { name: "objective", label: "Objective" },
    { name: "promoScheme", label: "Promo Scheme" },
    { name: "activityDurationFrom", label: "Activity Duration From" },
    { name: "activityDurationTo", label: "Activity Duration To" },
    { name: "isPartOfCoverPwp", label: "Is Part Of Cover PWP", type: "checkbox" },
    { name: "coverPwpCode", label: "Cover PWP Code" },
    { name: "amountbadget", label: "Amount Badget" },
    { name: "remaining_balance", label: "Remaining Balance" },
    { name: "credit_budget", label: "Credit Budget" },
    { name: "sku", label: "SKU", disabled: true },
    { name: "accounts", label: "Accounts", disabled: true },
    { name: "amount_display", label: "Amount Display", disabled: true },
    { name: "remarks", label: "Remarks" },
  ];

  const fieldsToRender = isCoverPwp ? coverPwpFields : regularPwpFields;

  return (
    <div
      style={{
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
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          padding: "30px",
          width: "90%",
          maxWidth: "1000px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
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

        {/* Error */}
        {error && <p style={{ color: "red", marginBottom: "16px" }}>{error}</p>}

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "20px",
              marginBottom: "30px",
            }}
          >
            {fieldsToRender.map(({ name, label, disabled, type }) => {
              const value = formData[name] ?? (type === "checkbox" ? false : "");

              // For distributor dropdowns, use filteredDistributors:
              if (type === "select" && (name === "distributor" || name === "distributor_code")) {
                return (
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
                      }}
                    >
                      <option value="">-- Select --</option>
                      {filteredDistributors.map((dist) => (
                        <option key={dist.id} value={dist.code /* use code here */}>
                          {dist.name}
                        </option>
                      ))}
                    </select>

                  </div>
                );
              }
              // inside fieldsToRender.map(...)


              if (name === "activity") {
                return (
                  <div key={name} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                      Activity <span style={{ color: 'red' }}>*</span>
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

                    {/* Dropdown arrow */}
                    <span
                      style={{
                        position: 'absolute',
                        right: '20px',
                        top: '45%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: '#555',
                        fontSize: '14px',
                        userSelect: 'none',
                      }}
                    >
                      ▼
                    </span>

                    {/* Checkmark */}

                  </div>
                );
              }
              <div
                style={{
                  display: "flex",
                  gap: "30px",
                  marginBottom: "20px",
                }}
              >
                {["sku", "accounts", "amount_display"].map((name) => {
                  const field = regularPwpFields.find((f) => f.name === name);
                  if (!field) return null;
                  const { label } = field;
                  return (
                    <div key={name} style={{ flex: 1 }}>
                      <label
                        style={{
                          fontWeight: "600",
                          fontSize: "14px",
                          display: "block",
                          marginBottom: "8px",
                        }}
                      >
                        {label}
                      </label>

                      <div style={{ display: "flex", gap: "10px" }}>
                        {["true", "false"].map((val) => {
                          const boolVal = val === "true";
                          const isSelected = formData[name] === boolVal;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({ ...prev, [name]: boolVal }))
                              }
                              style={{
                                padding: "8px 20px",
                                borderRadius: "20px",
                                border: isSelected
                                  ? `2px solid ${boolVal ? "#4CAF50" : "#f44336"}`
                                  : "1px solid #ccc",
                                backgroundColor: isSelected
                                  ? boolVal
                                    ? "#E8F5E9"
                                    : "#FFEBEE"
                                  : "#f9f9f9",
                                color: isSelected
                                  ? boolVal
                                    ? "#2e7d32"
                                    : "#c62828"
                                  : "#555",
                                fontWeight: isSelected ? "bold" : "normal",
                                cursor: "pointer",
                                transition: "all 0.3s ease",
                                minWidth: "80px",
                              }}
                            >
                              {val.charAt(0).toUpperCase() + val.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Render toggles using regularPwpFields config */ }
              {
                regularPwpFields
                  .filter(({ name }) => ["sku", "accounts", "amount_display"].includes(name))
                  .map(({ name, label, disabled }) => {
                    const currentValue = formData[name];
                    return (
                      <div key={name} style={{ marginBottom: "20px" }}>
                        <label
                          style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            display: "block",
                            marginBottom: "8px",
                            color: disabled ? "#999" : "#000",
                          }}
                        >
                          {label}
                        </label>

                        <div style={{ display: "flex", gap: "10px", opacity: disabled ? 0.5 : 1 }}>
                          {["true", "false"].map((val) => {
                            const boolVal = val === "true";
                            const isSelected = currentValue === boolVal;

                            return (
                              <button
                                key={val}
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  !disabled &&
                                  setFormData((prev) => ({
                                    ...prev,
                                    [name]: boolVal,
                                  }))
                                }
                                style={{
                                  padding: "8px 20px",
                                  borderRadius: "20px",
                                  border: isSelected
                                    ? `2px solid ${boolVal ? "#4CAF50" : "#f44336"}`
                                    : "1px solid #ccc",
                                  backgroundColor: isSelected
                                    ? boolVal
                                      ? "#E8F5E9"
                                      : "#FFEBEE"
                                    : "#f9f9f9",
                                  color: isSelected
                                    ? boolVal
                                      ? "#2e7d32"
                                      : "#c62828"
                                    : "#555",
                                  fontWeight: isSelected ? "bold" : "normal",
                                  cursor: disabled ? "not-allowed" : "pointer",
                                  transition: "all 0.3s ease",
                                  minWidth: "80px",
                                }}
                              >
                                {val.charAt(0).toUpperCase() + val.slice(1)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              }

              if (name === "categoryName") {
                return (
                  <div key={name} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
                    <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>

                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        readOnly
                        value={parseCategoryName(formData.categoryName).join(", ")}
                        onClick={handleOpenCategoryModal}
                        placeholder="Select Categories"
                        style={{
                          padding: "10px",
                          paddingRight: "35px", // space for icon
                          borderRadius: "8px",
                          border: "1px solid",
                          borderColor: parseCategoryName(formData.categoryName).length > 0 ? "green" : "#ccc",
                          cursor: "pointer",
                          transition: "border-color 0.3s",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                        disabled={updating}
                      />

                      {/* Magnifying glass icon inside relative wrapper */}
                      <span
                        style={{
                          position: "absolute",
                          top: "50%",
                          right: "10px",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          color: "#555",
                          fontSize: "18px",
                          userSelect: "none",
                        }}
                      >
                        🔍
                      </span>
                    </div>


                    {/* Modal */}
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
                        onClick={handleCloseCategoryModal}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            backgroundColor: "#e6f0ff", // very light blue background
                            padding: "25px",
                            borderRadius: "12px",
                            width: "500px",
                            maxHeight: "70vh",
                            overflowY: "auto",
                            boxShadow: "0 0 15px rgba(0, 70, 255, 0.4)", // subtle blue glow
                            border: "2px solid #3b82f6", // solid blue border
                          }}
                        >
                          <h3
                            style={{
                              marginTop: 0,
                              textAlign: "center",
                              color: "#1e40af", // deep blue text
                              fontWeight: "700",
                            }}
                          >
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
                              border: "1.5px solid #3b82f6", // blue border
                              outline: "none",
                              fontSize: "14px",
                              color: "#1e3a8a",
                            }}
                          />

                          {loading ? (
                            <p style={{ color: "#1e40af" }}>Loading categories...</p>
                          ) : filteredCategories.length === 0 ? (
                            <p style={{ color: "#1e40af" }}>No categories found.</p>
                          ) : (
                            <ul
                              style={{
                                listStyle: "none",
                                paddingLeft: 0,
                                maxHeight: "300px",
                                overflowY: "auto",
                                color: "#1e40af",
                              }}
                            >
                              {filteredCategories.map((cat) => {
                                const isChecked = formData.categoryCode?.includes(cat.code);
                                return (
                                  <li key={cat.id} style={{ marginBottom: "10px" }}>
                                    <label
                                      style={{
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        fontWeight: isChecked ? "600" : "400",
                                        color: isChecked ? "#2563eb" : "#1e3a8a",
                                      }}
                                    >
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
                            onClick={handleCloseCategoryModal}
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
                              transition: "background-color 0.3s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e40af")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              }


              // Checkbox
              if (type === "checkbox") {
                return (
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
              }

              if (name === "accountType" || name === "account_type") {
                const selectedValues = formData[name] || [];

                return (
                  <div key={name} style={{ position: "relative", cursor: "pointer", minHeight: 60 }}>
                    <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>

                    <div
                      className="form-control"
                      onClick={() => setShowModalCategory((prev) => ({ ...prev, [name]: true }))}
                      style={{ cursor: "pointer", padding: "10px", minHeight: "38px", display: "flex", alignItems: "center" }}
                    >
                      {selectedValues.length ? getCategoryNames(name) : "Select Category"}
                      <span style={{ marginLeft: "auto", color: "#555", fontSize: "18px", userSelect: "none" }}>🔍</span>
                    </div>

                    {showModalCategory[name] && (
                      <div
                        style={{
                          position: "fixed",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0, 0, 0, 0.6)", // darker overlay for focus
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          zIndex: 9999,
                        }}
                        onClick={() => setShowModalCategory((prev) => ({ ...prev, [name]: false }))}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            backgroundColor: "#f0f5ff", // very light blue background
                            borderRadius: "12px",
                            padding: "25px",
                            width: "420px",
                            maxHeight: "450px",
                            overflowY: "auto",
                            boxShadow: "0 8px 24px rgba(59, 130, 246, 0.3)", // subtle blue shadow
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          <h3
                            style={{
                              marginBottom: "16px",
                              textAlign: "center",
                              color: "#1e40af",
                              fontWeight: "700",
                              fontSize: "20px",
                            }}
                          >
                            Select Category
                          </h3>

                          <input
                            type="text"
                            value={categorySearchTerm}
                            onChange={(e) => setCategorySearchTerm(e.target.value)}
                            placeholder="Search categories..."
                            style={{
                              width: "100%",
                              padding: "12px 16px",
                              marginBottom: "20px",
                              borderRadius: "8px",
                              border: "2px solid #3b82f6",
                              fontSize: "14px",
                              color: "#1e3a8a",
                              outline: "none",
                              transition: "border-color 0.3s ease",
                            }}
                            onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                            onBlur={(e) => (e.target.style.borderColor = "#3b82f6")}
                          />

                          <div
                            style={{
                              flexGrow: 1,
                              overflowY: "auto",
                              paddingRight: "8px", // space for scrollbar
                              borderTop: "1px solid #dbeafe",
                              borderBottom: "1px solid #dbeafe",
                              marginBottom: "20px",
                            }}
                          >
                            {categoryDetails.length === 0 ? (
                              <p style={{ color: "#2563eb", textAlign: "center" }}>No categories found.</p>
                            ) : (
                              categoryDetails
                                .filter((opt) =>
                                  opt.name.toLowerCase().includes(categorySearchTerm.toLowerCase())
                                )
                                .map((opt) => (
                                  <label
                                    key={opt.code}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      marginBottom: "12px",
                                      cursor: "pointer",
                                      color: selectedValues.includes(opt.code) ? "#1e40af" : "#374151",
                                      fontWeight: selectedValues.includes(opt.code) ? "600" : "400",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedValues.includes(opt.code)}
                                      onChange={() => toggleCategoryType(name, opt.code)}
                                      style={{ marginRight: "12px", cursor: "pointer" }}
                                    />
                                    {opt.name}
                                  </label>
                                ))
                            )}
                          </div>

                          <button
                            onClick={() => setShowModalCategory((prev) => ({ ...prev, [name]: false }))}
                            style={{
                              padding: "12px 20px",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "8px",
                              fontWeight: "600",
                              fontSize: "16px",
                              cursor: "pointer",
                              transition: "background-color 0.3s ease",
                              alignSelf: "center",
                              width: "100%",
                              maxWidth: "180px",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#3b82f6")}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              }

              // Text input default
              return (
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
            })}

          </div>

          {/* Footer Table */}
          {
            showBudgetTable ? (
              <div
                style={{
                  marginTop: "30px",
                  borderTop: "1px solid #ddd",
                  paddingTop: "20px",
                  maxHeight: "500px",
                  overflowY: "auto",
                }}
              >
                <h3 style={{ marginBottom: "12px", color: "#1e40af" }}>Account Budget List</h3>

                {budgetLoading ? (
                  <p>Loading budgets...</p>
                ) : budgetList.length === 0 ? (
                  <p>No budgets found for selected code.</p>
                ) : (
                  <>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#3b82f6", color: "white" }}>
                          <th style={{ padding: "8px", border: "1px solid #ddd" }}>Account Code</th>
                          <th style={{ padding: "8px", border: "1px solid #ddd" }}>Account Name</th>
                          <th style={{ padding: "8px", border: "1px solid #ddd" }}>Budget</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetList.map(({ id, account_code, account_name, budget }) => (
                          <tr key={id} style={{ borderBottom: "1px solid #ddd" }}>
                            <td style={{ padding: "8px", border: "1px solid #ddd" }}>{account_code}</td>
                            <td style={{ padding: "8px", border: "1px solid #ddd" }}>{account_name}</td>
                            <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                              <input
                                type="number"
                                value={budget}
                                onChange={(e) => handleBudgetChange(id, e.target.value)}
                                style={{ width: "100%", boxSizing: "border-box" }}
                              />
                            </td>
                          </tr>
                        ))}

                        {/* Total Budget */}
                        <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                          <td colSpan={2} style={{ padding: "8px", border: "1px solid #ddd" }}>
                            Total Budget
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {totalBudget.toFixed(2)}
                          </td>
                        </tr>

                        {/* Remaining Balance */}
                        <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                          <td colSpan={2} style={{ padding: "8px", border: "1px solid #ddd" }}>
                            Remaining Balance
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {Number(formValues.remaining_balance).toFixed(2)}
                          </td>
                        </tr>

                        {/* Credit Budget */}
                        <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                          <td colSpan={2} style={{ padding: "8px", border: "1px solid #ddd" }}>
                            Credit Budget
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {Number(formValues.credit_budget).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            ) : (
              // Toggle buttons UI when showBudgetTable is false
              <div style={{ marginTop: "20px" }}>
                {regularPwpFields
                  .filter(({ name }) => ["sku", "accounts", "amount_display"].includes(name))
                  .map(({ name, label, disabled }) => {
                    const currentValue = formData[name];
                    return (
                      <div key={name} style={{ marginBottom: "20px" }}>
                        <label
                          style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            display: "block",
                            marginBottom: "8px",
                            color: disabled ? "#999" : "#000",
                          }}
                        >
                          {label}
                        </label>

                        <div style={{ display: "flex", gap: "10px", opacity: disabled ? 0.5 : 1 }}>
                          {["true", "false"].map((val) => {
                            const boolVal = val === "true";
                            const isSelected = currentValue === boolVal;

                            return (
                              <button
                                key={val}
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  !disabled &&
                                  setFormData((prev) => ({
                                    ...prev,
                                    [name]: boolVal,
                                  }))
                                }
                                style={{
                                  padding: "8px 20px",
                                  borderRadius: "20px",
                                  border: isSelected
                                    ? `2px solid ${boolVal ? "#4CAF50" : "#f44336"}`
                                    : "1px solid #ccc",
                                  backgroundColor: isSelected
                                    ? boolVal
                                      ? "#E8F5E9"
                                      : "#FFEBEE"
                                    : "#f9f9f9",
                                  color: isSelected
                                    ? boolVal
                                      ? "#2e7d32"
                                      : "#c62828"
                                    : "#555",
                                  fontWeight: isSelected ? "bold" : "normal",
                                  cursor: disabled ? "not-allowed" : "pointer",
                                  transition: "all 0.3s ease",
                                  minWidth: "80px",
                                }}
                              >
                                {val.charAt(0).toUpperCase() + val.slice(1)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )
          }

       <div
      style={{
        marginTop: "30px",
        borderTop: "1px solid #ddd",
        paddingTop: "20px",
        maxHeight: "500px",
        overflowY: "auto",
      }}
    >
      <h3 style={{ marginBottom: "12px", color: "#1e40af" }}>SKU Listing</h3>

      {skuLoading ? (
        <p>Loading SKU list...</p>
      ) : skuList.length === 0 ? (
        <p>No SKUs found for selected regular code.</p>
      ) : (
        (() => {
          // Calculate billing_amount dynamically per row (SRP * Qty - Discount)
          const updatedSkuList = skuList.map((item, idx) => {
            if (idx === skuList.length - 1) {
              // Total row will be updated after summing
              return item;
            }
            const srp = Number(item.srp || 0);
            const qty = Number(item.qty || 0);
            const discount = Number(item.discount || 0);
            const billing_amount = srp * qty - discount;
            return {
              ...item,
              billing_amount,
            };
          });

          // Sum billing_amount except last row
          const totalBilling = updatedSkuList
            .slice(0, updatedSkuList.length - 1)
            .reduce((sum, item) => sum + Number(item.billing_amount || 0), 0);

          // Update last row billing_amount with totalBilling
          updatedSkuList[updatedSkuList.length - 1] = {
            ...updatedSkuList[updatedSkuList.length - 1],
            billing_amount: totalBilling,
          };

          // Credit Budget = total billing amount
          const creditBudget = totalBilling;

          // Remaining Balance from formValues
          const originalRemainingBalance = Number(formValues.remaining_balance ?? 0);

          // Only subtract creditBudget if user has made changes
          const updatedRemainingBalance = hasChanges
            ? originalRemainingBalance - creditBudget
            : originalRemainingBalance;

          // Handle input changes except for total row's billing_amount
          const handleInputChange = (id, name, value) => {
            const isTotalRow = id === skuList[skuList.length - 1]?.id;
            if (isTotalRow) return;

            if (!hasChanges) setHasChanges(true);

            handleSkuChange(id, name, value);
          };

          return (
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#3b82f6",
                    color: "white",
                    textAlign: "left",
                    fontWeight: "600",
                  }}
                >
                  {["SKU", "SRP", "Qty", "UOM", "Discount", "Billing Amount"].map(
                    (header) => (
                      <th
                        key={header}
                        style={{
                          padding: "12px 10px",
                          borderBottom: "2px solid #2c6cd1",
                        }}
                      >
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {updatedSkuList.map(
                  (
                    { id, sku, srp, qty, uom, discount, billing_amount },
                    idx
                  ) => (
                    <tr
                      key={id}
                      style={{
                        borderBottom: "1px solid #eee",
                        fontWeight: idx === skuList.length - 1 ? "bold" : "normal",
                        backgroundColor:
                          idx === skuList.length - 1 ? "#f0f0f0" : "transparent",
                      }}
                    >
                      {[
                        { value: sku, name: "sku", type: "text" },
                        { value: srp, name: "srp", type: "number", step: "0.01" },
                        { value: qty, name: "qty", type: "number" },
                        {
                          value: uom,
                          name: "uom",
                          type: "select", // flag to render <select>
                        },
                        { value: discount, name: "discount", type: "number", step: "0.01" },
                        {
                          value: billing_amount.toFixed(2),
                          name: "billing_amount",
                          type: "number",
                          step: "0.01",
                        },
                      ].map(({ value, name, type, step }) => (
                        <td key={name} style={{ padding: "8px 10px" }}>
                          {type === "select" ? (
                            <select
                              value={value || ""}
                              onChange={(e) =>
                                handleInputChange(id, name, e.target.value)
                              }
                              style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "6px 8px",
                                borderRadius: "6px",
                                border: "1px solid #ccc",
                                fontSize: "14px",
                                backgroundColor: "white",
                                cursor: "pointer",
                                transition: "border-color 0.2s",
                              }}
                              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                              onBlur={(e) => (e.target.style.borderColor = "#ccc")}
                              disabled={idx === skuList.length - 1} // disable total row UOM as well
                            >
                              <option value="">Select</option>
                              <option value="CASE">CASE</option>
                              <option value="PC">PC</option>
                              <option value="IBX">IBX</option>
                            </select>
                          ) : (
                            <input
                              type={type}
                              value={value || ""}
                              step={step}
                              onChange={(e) =>
                                handleInputChange(id, name, e.target.value)
                              }
                              disabled={idx === skuList.length - 1 && name === "billing_amount"}
                              style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "6px 8px",
                                borderRadius: "6px",
                                border: "1px solid #ccc",
                                fontSize: "14px",
                                transition: "border-color 0.2s",
                                backgroundColor:
                                  idx === skuList.length - 1 && name === "billing_amount"
                                    ? "#e0e0e0"
                                    : "white",
                                cursor:
                                  idx === skuList.length - 1 && name === "billing_amount"
                                    ? "not-allowed"
                                    : "text",
                              }}
                              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                              onBlur={(e) => (e.target.style.borderColor = "#ccc")}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                )}

                {/* Remaining Balance */}
                <tr
                  style={{
                    fontWeight: "bold",
                    backgroundColor: "#f0f0f0",
                    borderTop: "2px solid #ddd",
                  }}
                >
                  <td colSpan={5} style={{ padding: "12px 10px" }}>
                    Remaining Balance
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    {updatedRemainingBalance.toFixed(2)}
                  </td>
                </tr>

                {/* Credit Budget */}
                <tr
                  style={{
                    fontWeight: "bold",
                    backgroundColor: "#f0f0f0",
                    borderTop: "1px solid #ddd",
                  }}
                >
                  <td colSpan={5} style={{ padding: "12px 10px" }}>
                    Credit Budget
                  </td>
                  <td style={{ padding: "12px 10px", color: "#1e40af" }}>
                    {creditBudget.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          );
        })()
      )}
    </div>




          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px" }}>
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
