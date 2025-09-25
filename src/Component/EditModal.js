import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FaSearch } from "react-icons/fa";  // Import FaSearch
import { Modal, } from "react-bootstrap"; // Import Modal and Button from react-bootstrap
import Swal from 'sweetalert2';

import { Dropdown, DropdownButton, ButtonGroup } from 'react-bootstrap'
function EditModal({ isOpen, onClose, rowData, filter = "all", }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);


  const [filteredDistributors, setFilteredDistributors] = useState([]);

  useEffect(() => {
    async function fetchDistributors() {
      setLoading(true);
      const { data, error } = await supabase
        .from("distributors")
        .select("id, name, code, description")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching distributors:", error);
      } else {
        setFilteredDistributors(data);
      }
      setLoading(false);
    }

    fetchDistributors();
  }, []);

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
  const [originalTotalBudget, setOriginalTotalBudget] = useState(0);

  const [showModalCategory, setShowModalCategory] = useState({ accountType: false, account_type: false });
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [categoryDetails, setCategoryDetails] = useState([]);
  const [originalTotalBilling, setOriginalTotalBilling] = useState(0);
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
    // Ensure that the accountType or account_type field is always an array
    let updatedAccountTypes = Array.isArray(formData[name]) ? [...formData[name]] : [];

    if (updatedAccountTypes.includes(code)) {
      // If the code is already in the array, remove it
      updatedAccountTypes = updatedAccountTypes.filter((c) => c !== code);
      // Also remove from budgetList
      setBudgetList((prev) => prev.filter((item) => item.account_code !== code));
    } else {
      // If the code is not in the array, add it
      updatedAccountTypes.push(code);
      // Add the new account to the budgetList with a default budget of 0
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

    // Update formData with the modified accountType or account_type
    setFormData((prev) => ({
      ...prev,
      [name]: updatedAccountTypes,  // Dynamically update based on 'name'
    }));
  };





  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerms, setSearchTerms] = useState("");
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
      cat.name.toLowerCase().includes(searchTerms.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchTerms.toLowerCase())
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
      // Fix categoryName to be proper array
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

  // Helper function to safely parse categoryName string to array
  const fixCategoryNameInput = (value) => {
    if (Array.isArray(value)) {
      // Check if it's an array of single characters forming a JSON string
      if (value.every((char) => typeof char === "string" && char.length === 1)) {
        try {
          const str = value.join(''); // join chars to string
          const parsed = JSON.parse(str);
          if (Array.isArray(parsed)) return parsed;
          if (typeof parsed === "string") return [parsed];
          return [];
        } catch {
          // failed parsing, fallback to original array (probably incorrect format)
          return value;
        }
      } else {
        // It's already an array of category names
        return value;
      }
    } else if (typeof value === "string") {
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
  const currentTotalBudget = budgetList.reduce((sum, item) => sum + Number(item.budget || 0), 0);
  const budgetDifference = currentTotalBudget - originalTotalBudget;
  const adjustedRemainingBalanceForBudget = Number(formData?.initial_remaining_balance || 0) - budgetDifference;
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
      setOriginalTotalBudget(0); // Reset when no code
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
        setOriginalTotalBudget(0);
      } else {
        setBudgetList(data);

        // Calculate and store original total budget
        const originalBudgetTotal = data.reduce((sum, item) => sum + Number(item.budget || 0), 0);
        setOriginalTotalBudget(originalBudgetTotal);
        console.log("Original Total Budget:", originalBudgetTotal);
      }
      setBudgetLoading(false);
    };

    fetchBudgetList();
  }, [formData?.regularpwpcode]);

  const showBudgetTable = formData.accounts === true; // or any logic you want

  //  const handleSubmit = async () => {
  //     setUpdating(true);
  //     setError(null);

  //     try {
  //       const table = formData.source;
  //       const updatedData = { ...formData };
  //       delete updatedData.source;

  //       // Code mapping
  //       if (filter === "all" && updatedData.code) {
  //         if (table === "regular_pwp") {
  //           updatedData.regularpwpcode = updatedData.code;
  //         } else if (table === "cover_pwp") {
  //           updatedData.cover_code = updatedData.code;
  //         }
  //         delete updatedData.code;
  //       }

  //       // Remove fields that don't exist in table schema:
  //       if (table === "cover_pwp") {
  //         // cover_pwp has distributor_code, NOT distributor
  //         delete updatedData.distributor;
  //       } else if (table === "regular_pwp") {
  //         // regular_pwp has distributor, NOT distributor_code
  //         delete updatedData.distributor_code;
  //       }

  //       const { error: updateError } = await supabase
  //         .from(table)
  //         .update(updatedData)
  //         .eq("id", formData.id);

  //       if (updateError) {
  //         setError(`Update Error: ${updateError.message}`);
  //       } else {
  //         alert("Record updated successfully!");
  //         onClose(); // close modal
  //       }
  //     } catch (err) {
  //       setError(`Unexpected error: ${err.message}`);
  //     } finally {
  //       setUpdating(false);
  //     }
  //   };
  const submitRegularPWP = async () => {
    try {
      // Create the regular PWP data from the form
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
        amountbadget: formData.amountbadget,
        remaining_balance: formData.remaining_balance,
        credit_budget: formData.credit_budget,
        sku: formData.sku,
        accounts: formData.accounts,
        amount_display: formData.amount_display,
        remarks: formData.remarks,
        created_at: new Date().toISOString(),
      };

      // Ensure that required fields are valid
      if (!formData.regularpwpcode) {
        throw new Error("Regular PWP Code is required but missing.");
      }

      // Check if the regular_pwp record already exists
      const { data: existingRegularPwp, error: selectRegularError } = await supabase
        .from('regular_pwp')
        .select('id')
        .eq('regularpwpcode', formData.regularpwpcode);

      if (selectRegularError) {
        throw new Error(`Error checking regular_pwp: ${selectRegularError.message}`);
      }

      if (existingRegularPwp.length > 0) {
        // Update the existing record if it exists
        const regularPwpId = existingRegularPwp[0].id;
        const { error: updateRegularError } = await supabase
          .from('regular_pwp')
          .update(regularPwpData)
          .eq('id', regularPwpId);

        if (updateRegularError) {
          throw new Error(`Error updating regular_pwp: ${updateRegularError.message}`);
        }

      } else {
        // Insert a new record if it doesn't exist
        const { error: insertRegularError } = await supabase
          .from('regular_pwp')
          .insert([regularPwpData]);

        if (insertRegularError) {
          throw new Error(`Error inserting regular_pwp: ${insertRegularError.message}`);
        }

        alert('Regular PWP record created successfully!');
      }

      // Close the modal after successful operation
      onClose(); // Call onClose here to close the modal

    } catch (err) {
      alert(`Error: ${err.message}`); // Handle the error and show an alert
      console.error("Error in submitRegularPWP:", err); // Log error for debugging
    }
  };


  const submitCoverPWP = async () => {
    try {
      const coverPwpData = {
        cover_code: formData.cover_code,
        distributor_code: formData.distributor_code,
        account_type: formData.account_type,
        amount_badget: formData.amount_badget,
        pwp_type: formData.pwp_type,
        objective: formData.objective,
        details: formData.details,
        remarks: formData.remarks,
        created_at: new Date().toISOString(), // Current date
      };

      // Ensure cover_code and other required fields are valid
      if (!formData.cover_code) {
        throw new Error("Cover code is required but missing.");
      }

      // Check if the cover_pwp record already exists for the cover_code
      const { data: existingCoverPwp, error: selectCoverError } = await supabase
        .from('cover_pwp')
        .select('id')
        .eq('cover_code', formData.cover_code);

      if (selectCoverError) {
        throw new Error(`Error checking cover_pwp: ${selectCoverError.message}`);
      }

      if (existingCoverPwp.length > 0) {
        // Update the existing record if it exists
        const coverPwpId = existingCoverPwp[0].id;
        const { error: updateCoverError } = await supabase
          .from('cover_pwp')
          .update(coverPwpData)
          .eq('id', coverPwpId);

        if (updateCoverError) {
          throw new Error(`Error updating cover_pwp: ${updateCoverError.message}`);
        }

        alert('Cover PWP record updated successfully!');
      } else {
        // Insert a new record if it doesn't exist
        const { error: insertCoverError } = await supabase
          .from('cover_pwp')
          .insert([coverPwpData]);

        if (insertCoverError) {
          throw new Error(`Error inserting cover_pwp: ${insertCoverError.message}`);
        }

        alert('Cover PWP record created successfully!');
      }

      // Close the modal after successful insertion or update
      onClose(); // Call onClose here to close the modal

    } catch (err) {
      // Handle any errors during submission
      alert(`Error: ${err.message}`); // Optionally, you can show an alert for errors
      console.error("Error in submitCoverPWP:", err); // Log error for debugging purposes
    }
  };

  const handleSaveAccountstable = async () => {
    try {
      if (!formData.regularpwpcode) {
        throw new Error('Regular PWP Code is required but missing.');
      }

      const accountData = budgetList.map((item) => ({
        id: item.id,
        account_code: item.account_code,
        account_name: item.account_name,
        budget: item.budget,
        total_budget: item.budget,
      }));

      let accountsUpdated = true;

      for (const account of accountData) {
        const { data: existingAccounts, error: selectAccountError } = await supabase
          .from('regular_accountlis_badget')
          .select('id, account_code, regularcode, total_budget')
          .eq('account_code', account.account_code)
          .eq('regularcode', formData.regularpwpcode);

        if (selectAccountError) {
          throw new Error(`Error checking account budget: ${selectAccountError.message}`);
        }

        if (existingAccounts && existingAccounts.length > 0) {
          const { error: updateError } = await supabase
            .from('regular_accountlis_badget')
            .update({
              account_code: account.account_code,
              account_name: account.account_name,
              budget: account.budget,
              total_budget: account.total_budget,
            })
            .eq('id', existingAccounts[0].id);

          if (updateError) {
            accountsUpdated = false;
            console.error(`Error updating account with account_code ${account.account_code}: ${updateError.message}`);
          } else {
            console.log(`Account with account_code ${account.account_code} updated successfully`);
          }
        } else {
          console.log(`No matching account found for account_code ${account.account_code}, skipping update.`);
        }
      }

      return accountsUpdated; // <-- Return whether all accounts updated successfully

    } catch (err) {
      setError(`Error saving accounts: ${err.message}`);
      console.error('Error in handleSaveAccountstable:', err);
      return false;  // Return false on error
    }
  };




  const handleSubmit = async () => {
    setUpdating(true);
    setError(null);

    try {
      if (formData.cover_code) {
        await submitCoverPWP();

        await Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Success Update all data',
        }).then(() => {
          window.location.reload();
        });

        return;
      }

      const accountsUpdated = await handleSaveAccountstable(); // get success flag
      await submitSkuTable();
      await submitRegularPWP();

      await submitAccountToRegular(accountsUpdated);  // pass flag here

      await submitSkuTotalToRegular(
        formData.regularpwpcode,
        adjustedRemainingBalance,
        currentTotalBilling,
        formValues.amountbadget
      );

      await Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Success Update all data',
      });

    } catch (err) {
      console.error('❌ Submit error:', err);
      await Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: err.message || 'Something went wrong during submission.',
      });
      setError(`Submit Error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const submitAccountToRegular = async (accountsUpdated) => {
    try {
      if (!formData.regularpwpcode) {
        throw new Error('Regular PWP Code is required but missing.');
      }

      if (!accountsUpdated) {
        throw new Error('One or more account updates failed, cannot update regular PWP.');
      }

      console.log('🟦 remaining_balance:', adjustedRemainingBalanceForBudget);
      console.log('🟦 currentTotalBudget:', currentTotalBudget);

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
            remaining_balance: adjustedRemainingBalanceForBudget,
            credit_budget: currentTotalBudget,    // ✅ force match with currentTotalBudget
            amountbadget: currentTotalBudget      // ✅ same here
          })
          .eq('regularpwpcode', formData.regularpwpcode);

        if (updatePwpError) {
          throw new Error(`Error updating regular PWP: ${updatePwpError.message}`);
        }

        console.log(`✅ regular_pwp updated successfully:`);
        console.log('remaining_balance:', adjustedRemainingBalanceForBudget);
        console.log('credit_budget:', currentTotalBudget);
        console.log('amountbadget:', currentTotalBudget);


      } else {
        console.log(`❌ No matching PWP found for: ${formData.regularpwpcode}`);
        alert('No matching PWP found. Update skipped.');
      }
    } catch (error) {
      console.error('❌ Error in submitAccountToRegular:', error.message);
      alert(`Failed to update regular PWP: ${error.message}`);
    }
  };



  const submitSkuTotalToRegular = async (regularpwpcode, remaining_balance, _credit_budget, amountbadget) => {
    try {
      console.log("🔄 Attempting to update regular_pwp with values:");
      console.log("regularpwpcode:", regularpwpcode);
      console.log("remaining_balance:", remaining_balance);
      console.log("credit_budget (will use amountbadget):", amountbadget);
      console.log("amountbadget:", amountbadget);
      console.log("🔍 Debugging <tfoot> Data:");
      console.log("formValues.remaining_balance:", formValues.remaining_balance);
      console.log("originalTotalBilling:", originalTotalBilling);
      console.log("currentTotalBilling:", currentTotalBilling);
      console.log("billingDifference:", billingDifference);
      console.log("adjustedRemainingBalance:", adjustedRemainingBalance);

      const resolvedAmountBudget = (amountbadget && amountbadget > 0) ? amountbadget : currentTotalBilling;

      const { data: pwpUpdateResult, error: updatePwpError } = await supabase
        .from('regular_pwp')
        .update({
          remaining_balance,
          credit_budget: resolvedAmountBudget,
          amountbadget: resolvedAmountBudget,
        })
        .eq('regularpwpcode', regularpwpcode)
        .select();

      if (updatePwpError) {
        console.error('❌ Failed to update regular_pwp:', updatePwpError.message);
        alert('❌ Error updating regular PWP data.');
        return false;
      } else {
        console.log('✅ regular_pwp updated successfully:', pwpUpdateResult);
        return true;
      }

    } catch (err) {
      console.error('❌ Exception during regular_pwp update:', err.message);
      return false;
    }
  };





  const submitSkuTable = async () => {
    try {
      if (!formData.regularpwpcode) {
        throw new Error('Regular PWP Code is required but missing.');
      }

      const regular_code = formData.regularpwpcode;
      let allSuccess = true;

      // Filter normal SKUs only
      const normalSkuRows = skuList.filter(row => row.sku_code !== 'Total:');

      for (const row of normalSkuRows) {
        const computedBilling = Number(row.srp || 0) * Number(row.qty || 0) * (1 - Number(row.discount || 0) / 100);

        const payload = {
          srp: row.srp || 0,
          qty: row.qty || 0,
          uom: row.uom || 'pc',
          discount: row.discount || 0,
          billing_amount: computedBilling,
          total_amount: computedBilling,
          created_at: new Date().toISOString(),
        };

        // Update only if SKU exists
        const { data: existingSku, error: checkError } = await supabase
          .from('regular_sku')
          .select('id')
          .eq('regular_code', regular_code)
          .eq('sku_code', row.sku_code)
          .limit(1)
          .maybeSingle();

        if (checkError) {
          console.error(`Error checking SKU ${row.sku_code}:`, checkError.message);
          allSuccess = false;
          continue;
        }

        if (existingSku) {
          const { error: updateError } = await supabase
            .from('regular_sku')
            .update(payload)
            .eq('id', existingSku.id);

          if (updateError) {
            console.error(`Error updating SKU ${row.sku_code}:`, updateError.message);
            allSuccess = false;
          } else {
            console.log(`SKU ${row.sku_code} updated successfully`);
          }
        } else {
          console.log(`SKU ${row.sku_code} does not exist. Skipping insert.`);
        }
      }

      // Update Total row dynamically
      const totalBilling = normalSkuRows.reduce((sum, r) => sum + Number(r.srp || 0) * Number(r.qty || 0) * (1 - Number(r.discount || 0) / 100), 0);
      const { data: existingTotal, error: checkTotalError } = await supabase
        .from('regular_sku')
        .select('id')
        .eq('regular_code', regular_code)
        .eq('sku_code', 'Total:')
        .limit(1)
        .maybeSingle();

      if (checkTotalError) {
        console.error('Error checking Total row:', checkTotalError.message);
        allSuccess = false;
      } else if (existingTotal) {
        const { error: updateTotalError } = await supabase
          .from('regular_sku')
          .update({ billing_amount: totalBilling, total_amount: totalBilling, updated_at: new Date().toISOString() })
          .eq('id', existingTotal.id);

        if (updateTotalError) {
          console.error('Error updating Total row:', updateTotalError.message);
          allSuccess = false;
        } else {
          console.log('Total row updated successfully');
        }
      }

      if (allSuccess) {
        console.log('All SKUs updated successfully!');
      } else {
        alert('Some SKUs failed to update. Check console.');
      }

    } catch (err) {
      console.error('Error updating SKU table:', err);
      setError(`Error updating SKU table: ${err.message}`);
    }
  };




  useEffect(() => {
    console.log("Remaining Balance:", Number(formValues.remaining_balance).toFixed(2));
  }, [formValues.remaining_balance]);







  // State initialization
  const [skuList, setSkuList] = useState([]); // Holds the SKU data list
  const [skuLoading, setSkuLoading] = useState(false); // Tracks loading state for SKU fetch

  // Update the useEffect that fetches SKU list to store original total billing
  useEffect(() => {
    if (!formData?.regularpwpcode) {
      setSkuList([]);
      setOriginalTotalBilling(0); // Reset when no code
      return;
    }

    const fetchSkuList = async () => {
      setSkuLoading(true);
      try {
        const { data, error } = await supabase
          .from("regular_sku")
          .select("*")
          .eq("regular_code", formData.regularpwpcode);

        if (error) {
          console.error("Error fetching SKU list:", error.message);
          setSkuList([]);
          setOriginalTotalBilling(0);
        } else {
          setSkuList(data);

          // Calculate and store original total billing (excluding "Total:" row)
          const originalTotal = data
            .filter((item) => item.sku !== "Total:")
            .reduce((acc, { billing_amount }) => acc + (Number(billing_amount) || 0), 0);

          setOriginalTotalBilling(originalTotal);
          console.log("Original Total Billing:", originalTotal);
          console.log("Fetched SKU List:", data);
        }
      } catch (error) {
        console.error("Unexpected error fetching SKU list:", error);
        setSkuList([]);
        setOriginalTotalBilling(0);
      }
      setSkuLoading(false);
    };

    fetchSkuList();
  }, [formData?.regularpwpcode]);

  // Log SKU List whenever it updates
  useEffect(() => {
    console.log("Updated SKU List after fetch or change:", skuList);
  }, [skuList]); // Logs whenever skuList changes
  const [formEdited, setFormEdited] = useState(false);



  // Handle changes to a specific SKU item
  const handleSkuChange = (id, field, value) => {
    setFormEdited(true); // ✅ Safe here

    const updatedSkuList = skuList.map((item) => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };

        if (field === "srp" || field === "qty" || field === "discount") {
          updatedItem.billing_amount = calculateBillingAmount(
            updatedItem.srp,
            updatedItem.qty,
            updatedItem.discount
          );
        }

        return updatedItem;
      }
      return item;
    });


    setSkuList(updatedSkuList); // Update the state with the new sku list
    console.log("Updated SKU List after handleSkuChange:", updatedSkuList);
  };

  // Calculate Billing Amount based on SRP, Quantity, and Discount
  const calculateBillingAmount = (srp, qty, discount) => {
    const quantity = parseFloat(qty) || 0;
    const price = parseFloat(srp) || 0;
    const disc = parseFloat(discount) || 0;
    return (price * quantity) - disc;
  };

  const [prevRemainingBalance, setPrevRemainingBalance] = useState(0);

  const [isCreditBudgetEditable, setIsCreditBudgetEditable] = useState(false);

  // Function to handle changes to the form data
  const handleChanges = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => {
      if (name === "credit_budget") {
        const newCreditBudget = parseFloat(value) || 0;
        const oldCreditBudget = parseFloat(prevData.credit_budget) || 0;
        const currentAmountBudget = parseFloat(prevData.amountbadget) || 0;

        // Calculate difference between old and new credit budget
        const creditBudgetDifference = newCreditBudget - oldCreditBudget;

        // Update amount budget by adding the difference
        const newAmountBudget = currentAmountBudget + creditBudgetDifference;

        // Update remaining balance by subtracting the difference  
        const newRemainingBalance = prevData.remaining_balance - creditBudgetDifference;

        return {
          ...prevData,
          credit_budget: newCreditBudget,
          amountbadget: newAmountBudget,
          remaining_balance: newRemainingBalance
        };
      }

      // For other fields, just update normally
      return {
        ...prevData,
        [name]: value
      };
    });
  };

  // Function to handle the "Change?" button click
  const handleChangeCreditBudget = () => {
    setFormData((prevData) => {
      // Reset both credit budget and amount budget, restore remaining balance
      const creditBudgetToRestore = parseFloat(prevData.credit_budget) || 0;
      const amountBudgetToRestore = parseFloat(prevData.amountbadget) || 0;

      // Calculate original amount budget (before any credit budget was added)
      const originalAmountBudget = amountBudgetToRestore - creditBudgetToRestore;

      // Restore remaining balance by adding back the credit budget amount
      const newRemainingBalance = prevData.remaining_balance + creditBudgetToRestore;

      return {
        ...prevData,
        credit_budget: 0,
        amountbadget: originalAmountBudget, // Reset to original amount
        remaining_balance: newRemainingBalance
      };
    });

    setIsCreditBudgetEditable(true);
  };

  const [categoryListing, setCategoryListing] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [showSkuModal, setShowSkuModal] = useState(false);

  // Fetch category listing (SKUs) from the database
  useEffect(() => {
    const fetchCategoryListing = async () => {
      const { data, error } = await supabase
        .from('category_listing')
        .select('*')
        .order('sku_code', { ascending: true });

      if (error) {
        console.error('Error fetching category listing:', error.message);
      } else {
        setCategoryListing(data);
      }
    };

    fetchCategoryListing();
  }, []);

  // Handle SKU change in the table row
  // const handleSkuChange = (id, field, value) => {
  //   const updatedSkuList = [...skuList];
  //   const index = updatedSkuList.findIndex(item => item.id === id);
  //   if (index !== -1) {
  //     updatedSkuList[index][field] = value;
  //     setSkuList(updatedSkuList);
  //   }
  // };

  // Handle SKU selection from the modal
  const handleChangesku = (index, field, value) => {
    const updatedSkuList = [...skuList];
    updatedSkuList[index][field] = value;
    setSkuList(updatedSkuList);
  };

  // Calculate current total billing amount (excluding "Total:" row)
  const currentTotalBilling = skuList
    .filter((item) => item.sku !== "Total:")
    .reduce((acc, { billing_amount }) => acc + (Number(billing_amount) || 0), 0);

  // Calculate the difference between current and original billing
  const billingDifference = currentTotalBilling - originalTotalBilling;

  // Calculate the adjusted remaining balance
  const adjustedRemainingBalance = Number(formValues.remaining_balance) - billingDifference;

  // Calculate the total billing amount and remaining excluding the "Total:" row
  const [categoryMap, setCategoryMap] = useState({}); // key = sku_code, value = name

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('category_listing')
          .select('sku_code, name');

        if (error) throw error;

        const map = {};
        data.forEach((cat) => {
          map[cat.sku_code] = cat.name;
        });

        setCategoryMap(map);
      } catch (err) {
        console.error('Error fetching categories:', err.message);
      }
    };

    fetchCategories();
  }, []);


  const [badorderList, setBadorderList] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // Fetch badorder data when formData.regularpwpcode changes
  useEffect(() => {
    if (!formData?.regularpwpcode) {
      setBadorderList([]);
      return;
    }

    const fetchBadorder = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("regular_badorder")
          .select("*")
          .eq("code_pwp", formData.regularpwpcode)
          .order("id", { ascending: true });

        if (error) throw error;
        setBadorderList(data || []);
      } catch (err) {
        console.error("Error fetching badorder:", err.message);
        setBadorderList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBadorder();
  }, [formData?.regularpwpcode]);

  // Handle input changes




  // Delete row

  if (!isOpen || !formData) return null;


  const isCoverPwp = !!formData.cover_code;


  const coverPwpFields = [
    { name: "cover_code", label: "COVER CODE", disabled: true },
    { name: "distributor_code", label: "Distributor Code", type: "select" },  // dropdown here
    { name: "account_type", label: "Account Type", },
    { name: "amount_badget", label: "Amount Badget" },
    { name: "pwp_type", label: "PWP TYPE", disabled: true },
    { name: "objective", label: "Objective Promo Scheme" },
    { name: "details", label: "Details" },
    { name: "remarks", label: "Remarks" },
    { name: "created_at", label: "Created At", disabled: true },
  ];

  const regularPwpFields = [
    { name: "regularpwpcode", label: "REGULAR CODE", disabled: true },
    { name: "pwptype", label: "PWP TYPE", disabled: true },
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
    { name: "amountbadget", label: "Amount Badget", disabled: true },
    { name: "remaining_balance", label: "Remaining Balance", disabled: true },
    { name: "credit_budget", label: "Credit Budget" },
    { name: "sku", label: "SKU", disabled: true },
    { name: "accounts", label: "Accounts", disabled: true },
    { name: "amount_display", label: "Amount Display", disabled: true },
    { name: "remarks", label: "Remarks" },
  ];

  // Dynamically exclude the fields if it's a cover PWP
  const fieldsToRender = isCoverPwp
    ? coverPwpFields
    : regularPwpFields.filter(field => !['sku', 'accounts', 'amount_display'].includes(field.name));  // Exclude specific fields in regular PWP


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
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <option value="">-- Select --</option>
                      {filteredDistributors.map((dist) => (
                        <option key={dist.id} value={dist.code}>
                          {dist.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              // inside fieldsToRender.map(...)
              // For credit budget, handle change to adjust remaining balance
              if (name === "credit_budget") {
                return (
                  <div key={name} style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
                    <input
                      type="number"
                      name={name}
                      value={formData[name] || ""}
                      onChange={handleChanges}
                      disabled={!isCreditBudgetEditable || disabled || updating} // Disable input unless it's editable
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        background: !isCreditBudgetEditable ? "#f9f9f9" : "#fff", // Change background color based on editable state
                      }}
                    />
                    {/* Change button */}
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
                      }}
                    >
                      Change?
                    </button>
                  </div>
                );
              }
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

              {/* Render toggles using regularPwpFields config */ }


              if (name === "categoryName") {
                return (
                  <div key={name} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
                    <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>

                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        readOnly
                        value={fixCategoryNameInput(formData.categoryName).join(", ")}
                        onClick={handleOpenCategoryModal}
                        placeholder="Select Categories"
                        style={{
                          padding: "10px",
                          paddingRight: "35px", // space for icon
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
                // Ensure that formData[name] is always an array (default to an empty array if undefined or not an array)
                const selectedValues = Array.isArray(formData[name]) ? formData[name] : (formData[name] ? [formData[name]] : []);

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
                      </tbody>
                      <tfoot>
                        {/* Original Remaining Balance */}
                        <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                          <td colSpan={2} style={{ padding: "8px", border: "1px solid #ddd" }}>
                            Original Remaining Balance
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {Number(formData?.initial_remaining_balance || 0).toFixed(2)}
                          </td>
                        </tr>

                        {/* Original Total Budget */}
                        <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                          <td colSpan={2} style={{ padding: "8px", border: "1px solid #ddd" }}>
                            Original Total Budget
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {originalTotalBudget.toFixed(2)}
                          </td>
                        </tr>

                        {/* Current Total Budget */}
                        <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                          <td colSpan={2} style={{ padding: "8px", border: "1px solid #ddd" }}>
                            Current Total Budget
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {currentTotalBudget.toFixed(2)}
                          </td>
                        </tr>

                        {/* Budget Difference */}
                        <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                          <td colSpan={2} style={{ padding: "8px", border: "1px solid #ddd" }}>
                            Budget Difference
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {budgetDifference.toFixed(2)}
                          </td>
                        </tr>

                        {/* Adjusted Remaining Balance */}
                        <tr style={{
                          fontWeight: "bold",
                          backgroundColor: "#e3f2fd",
                          color: "#1565c0",
                          fontSize: "16px"
                        }}>
                          <td colSpan={2} style={{ padding: "12px", border: "2px solid #1976d2" }}>
                            Remaining Balance
                          </td>
                          <td style={{ padding: "12px", border: "2px solid #1976d2" }}>
                            {adjustedRemainingBalanceForBudget.toFixed(2)}
                          </td>
                        </tr>

                        {/* Credit Budget */}
                        <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                          <td colSpan={2} style={{ padding: "8px", border: "1px solid #ddd" }}>
                            Credit Budget
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {currentTotalBudget.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                )}
              </div>
            ) : (
              // Toggle buttons UI when showBudgetTable is false
              <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
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
              maxHeight: "800px",
              overflowY: "auto",
            }}
          >
            {skuLoading ? (
              <p style={{ textAlign: "center", color: "#888" }}>Loading SKU list...</p>
            ) : skuList.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888" }}>
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  backgroundColor: "#f9f9f9",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#3b82f6",
                      color: "white",
                      fontWeight: "bold",
                      textAlign: "center",
                      fontSize: "14px",
                    }}
                  >
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>SKU</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>SRP</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>Qty</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>UOM</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>Discount</th>
                    <th style={{ padding: "12px", border: "1px solid #ddd" }}>Billing Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {skuList.map(({ id, sku_code, srp, qty, uom, discount, billing_amount }, idx) => {
                    // Skip Total row, we'll compute it dynamically in footer
                    if (sku_code === "Total:") return null;

                    const computedBilling = Number(srp || 0) * Number(qty || 0) * (1 - Number(discount || 0) / 100);

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
                        <td style={{ width: '300px', padding: "10px", border: "1px solid #ddd" }}>
                          <input
                            type="text"
                            value={categoryMap[sku_code] || sku_code || ""}
                            onChange={(e) => handleSkuChange(id, "sku_code", e.target.value)}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              padding: "8px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                              fontSize: "14px",
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

                        <td style={{ width: '50px', padding: "10px", border: "1px solid #ddd" }}>
                          <input
                            type="number"
                            value={discount || 0}
                            step="0.01"
                            onChange={(e) => handleSkuChange(id, "discount", e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                            }}
                          />
                        </td>

                        <td style={{ width: '50px', padding: "10px", border: "1px solid #ddd" }}>
                          <span>{computedBilling.toFixed(2)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td colSpan="5" style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      Original Remaining Balance:
                    </td>
                    <td style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      {Number(formValues.remaining_balance).toFixed(2)}
                    </td>
                  </tr>

                  <tr>
                    <td colSpan="5" style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      Original Total Billing:
                    </td>
                    <td style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      {originalTotalBilling.toFixed(2)}
                    </td>
                  </tr>

                  <tr>
                    <td colSpan="5" style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      Current Total Billing:
                    </td>
                    <td style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      {currentTotalBilling.toFixed(2)}
                    </td>
                  </tr>

                  <tr>
                    <td colSpan="5" style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      Billing Difference:
                    </td>
                    <td style={{ textAlign: "right", padding: "12px", border: "1px solid #ddd" }}>
                      {billingDifference.toFixed(2)}
                    </td>
                  </tr>

                  <tr>
                    <td
                      colSpan="6"
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
                      Remaining Balance: {adjustedRemainingBalance.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          {formData?.activityName === "BAD ORDER" && badorderList.length > 0 && (
            <div>
              <h2 style={{textAlign:'left'}}>BAD ORDER  </h2>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#1976d2", color: "#fff" }}>
                    <th style={{ padding: "8px" }}>Category</th>
                    <th style={{ padding: "8px" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {badorderList.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #ccc" }}>
                      <td style={{ padding: "8px" }}>{row.category}</td>
                      <td style={{ padding: "8px" }}>{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: "#f0f0f0", fontWeight: "bold" }}>
                    <td style={{ padding: "8px" }}>Total</td>
                    <td style={{ padding: "8px" }}>
                      {badorderList[badorderList.length - 1]?.total || 0}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: "#f0f0f0", fontWeight: "bold" }}>
                    <td style={{ padding: "8px" }}>Remaining Budget</td>
                    <td style={{ padding: "8px" }}>
                      {badorderList[badorderList.length - 1]?.remaining_budget || 0}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}


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

