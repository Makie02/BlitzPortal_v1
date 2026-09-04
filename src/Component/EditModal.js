import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../supabaseClient";
import { FaSearch } from "react-icons/fa";
import { Modal, Button, Nav, Spinner } from "react-bootstrap";
import Swal from 'sweetalert2';
import { FiChevronRight } from "react-icons/fi";
import { Dropdown, DropdownButton, ButtonGroup } from 'react-bootstrap';

// ============ HELPER FUNCTIONS ============
const safeJsonArrayParse = (str) => {
  // Try normal JSON first
  try {
    return JSON.parse(str);
  } catch {
    // Fallback: Python-style single-quoted array e.g. ['24/7 STORE', 'Branch B']
    try {
      const sanitized = str
        .trim()
        .replace(/^\[|\]$/g, '')      // strip outer brackets
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, '')) // strip quotes per item
        .filter((s) => s.length > 0);
      return sanitized;
    } catch {
      return null;
    }
  }
};

const fixCategoryNameInput = (value) => {
  if (Array.isArray(value)) {
    if (value.every((char) => typeof char === "string" && char.length === 1)) {
      try {
        const str = value.join('');
        const parsed = safeJsonArrayParse(str);
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
    const parsed = safeJsonArrayParse(value);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "string") return [parsed];
    return [value];
  }

  return [];
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
  { name: "distributor", label: "Distributor", disabled: true },
  { name: "accountType", label: "Account Type", disabled: true },
  { name: "categoryName", label: "Category" },
  { name: "activity", label: "Activity", disabled: true },
  { name: "objective", label: "Objective" },
  { name: "branchType", label: "branchType", disabled: true },
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

const useDistributorMap = () => {
  const [distributorMap, setDistributorMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchDistributors() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('distributors')
          .select('code, name');

        if (error) throw error;

        const map = {};
        data?.forEach(d => {
          map[d.code] = d.name;
        });

        setDistributorMap(map);
      } catch (error) {
        console.error('Error fetching distributors:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDistributors();
  }, []);

  const getDistributorName = (code) => {
    return distributorMap[code] || code;
  };

  return { distributorMap, getDistributorName, loading };
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
        .select('activity_code, sku, accounts, amount_display, sku_addional, "isPenalties", "Supplies/M.E", branch');

      if (actData) setActivities(actData);

      if (settingsData) {
        const map = {};
        settingsData.forEach(setting => {
          map[setting.activity_code] = {
            sku: setting.sku === true,
            accounts: setting.accounts === true,
            amount_display: setting.amount_display === true,
            sku_addional: setting.sku_addional === true,
            isPenalties: setting.isPenalties === true,
            suppliesME: setting["Supplies/M.E"] === true,
            branch: setting.branch === true,
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

const useBudgetList = (regularpwpcode) => {
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
    setBudgetList(prev =>
      prev.map(item =>
        item.id === id ? { ...item, budget: parseFloat(newBudget) || 0 } : item
      )
    );
  };

  const handleBudgetFieldChange = (id, field, value) => {
    setBudgetList(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const currentTotalBudget = budgetList.reduce((sum, item) => sum + Number(item.budget || 0), 0);

  return {
    budgetList,
    setBudgetList,
    originalTotalBudget,
    currentTotalBudget,
    handleBudgetChange,
    handleBudgetFieldChange,
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

  const [distributors, setDistributors] = useState([]);
  const [distributorMap, setDistributorMap] = useState({});

  useEffect(() => {
    async function fetchDistributors() {
      try {
        const { data, error } = await supabase
          .from('distributors')
          .select('code, name');

        if (error) throw error;

        const map = {};
        data?.forEach(d => {
          map[d.code] = d.name;
        });

        setDistributors(data || []);
        setDistributorMap(map);
      } catch (error) {
        console.error('Error fetching distributors:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDistributors();
  }, []);

  const getDistributorName = (code) => {
    return distributorMap[code] || code;
  };

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
    handleBudgetFieldChange,
    loading: budgetLoading
  } = useBudgetList(formData?.regularpwpcode);

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
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTerms, setSearchTerms] = useState("");
  const [isCreditBudgetEditable, setIsCreditBudgetEditable] = useState(false);
  const [accountTypes, setAccountTypes] = useState([]);

  // Branch modal state — same gets as RegularVisaForm's grouped branch system
  const [accountsListCache, setAccountsListCache] = useState({});
  const [agentNamesMap, setAgentNamesMap] = useState({});
  const [motherAccountNamesMap, setMotherAccountNamesMap] = useState({});
  const [bpNamesMap, setBpNamesMap] = useState({});
  const [branchTypes, setBranchTypes] = useState([]);
  const [groupedBranches, setGroupedBranches] = useState([]);
  const [loadingGroupedBranches, setLoadingGroupedBranches] = useState(false);
  const [showModal_Branch, setShowModal_Branch] = useState(false);
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [activeBranchTabKey, setActiveBranchTabKey] = useState(null);
  const [branchPage, setBranchPage] = useState(1);
  const [branchesFetchedForDistributor, setBranchesFetchedForDistributor] = useState(null);
  const BRANCH_PAGE_SIZE = 15;

  // Penalty / Supplies options
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

  // Reusable multi-select dropdown (same behavior as the create form's version)
  const MultiSelectDropdown = ({ options, selected = [], onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (label) => {
      const updated = selected.includes(label)
        ? selected.filter((s) => s !== label)
        : [...selected, label];
      onChange(updated);
    };

    return (
      <div ref={ref} style={{ position: "relative", minWidth: "160px" }}>
        <div
          onClick={() => setOpen((o) => !o)}
          style={{
            cursor: "pointer",
            minHeight: "36px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            background: "#fff",
          }}
        >
          {selected.length > 0 ? (
            selected.map((label) => (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                {label}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(label);
                  }}
                  style={{ marginLeft: "4px", cursor: "pointer", fontWeight: "bold" }}
                >
                  ✖
                </span>
              </span>
            ))
          ) : (
            <span style={{ color: "#999", fontSize: "13px" }}>{placeholder}</span>
          )}
        </div>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 1000,
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "6px",
              width: "100%",
              maxHeight: "180px",
              overflowY: "auto",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
            }}
          >
            {options.length === 0 ? (
              <div style={{ padding: "8px", color: "#888" }}>No options</div>
            ) : (
              options.map((opt) => {
                const label = opt.label ?? opt;
                const key = opt.id ?? opt;
                const checked = selected.includes(label);
                return (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleOption(label)} />
                    {label}
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  // FIXED: Use useMemo to make calculations reactive to skuList and budgetList changes
  const budgetDifference = useMemo(() =>
    currentTotalBudget - originalTotalBudget,
    [currentTotalBudget, originalTotalBudget]
  );

  const adjustedRemainingBalanceForBudget = useMemo(() => {
    const result = Number(formData?.initial_remaining_balance || 0) - currentTotalBudget;
    console.log('📊 Budget Calculation:', {
      initial_remaining_balance: formData?.initial_remaining_balance,
      currentTotalBudget,
      result
    });
    return result;
  }, [formData?.initial_remaining_balance, currentTotalBudget]);

  const unifiedRemainingBalance = useMemo(() => {
    const initialBalance = Number(formData?.initial_remaining_balance || 0);
    const result = initialBalance - currentTotalBilling;
    console.log('📊 SKU Calculation:', {
      initial_remaining_balance: initialBalance,
      currentTotalBilling,
      result
    });
    return result;
  }, [formData?.initial_remaining_balance, currentTotalBilling]);

  const showBudgetTable = formData.accounts === true || formData.activity === "LISTING FEE";
  const isCoverPwp = !!formData.cover_code;
  const fieldsToRender = isCoverPwp
    ? coverPwpFieldsConfig
    : regularPwpFieldsConfig.filter(field => !['sku', 'accounts', 'amount_display'].includes(field.name));

  // Initialize form data
  useEffect(() => {
    if (isOpen && rowData) {
      const fetchRemainingBalance = async () => {
        let initialRemainingBalance = Number(rowData.remaining_balance) || 0;

        const coverPwpCode = rowData.coverPwpCode || rowData.cover_code;
        if (coverPwpCode) {
          try {
            const { data: amountBadgetData, error } = await supabase
              .from('amount_badget')
              .select('remainingbalance')
              .eq('pwp_code', coverPwpCode)
              .maybeSingle();

            if (!error && amountBadgetData) {
              initialRemainingBalance = Number(amountBadgetData.remainingbalance) || 0;
              console.log('✅ Fetched remaining balance from amount_badget:', initialRemainingBalance);
            } else {
              console.log('⚠️ No amount_badget found, using rowData remaining_balance');
            }
          } catch (err) {
            console.error('❌ Error fetching amount_badget:', err);
          }
        }

        const normalized = {
          ...rowData,
          distributor: rowData.distributor_id || rowData.distributor || "",
          distributor_code: rowData.distributor_code_id || rowData.distributor_code || "",
          categoryName: Array.isArray(rowData.categoryName)
            ? rowData.categoryName
            : typeof rowData.categoryName === 'string' && rowData.categoryName.startsWith("[")
              ? JSON.parse(rowData.categoryName)
              : rowData.categoryName || [],
          accountType: Array.isArray(rowData.accountType) ? rowData.accountType : (rowData.accountType ? [rowData.accountType] : []),
          branchType: Array.isArray(rowData.branchType) ? rowData.branchType : (rowData.branchType ? [rowData.branchType] : []),
          initial_remaining_balance: initialRemainingBalance,
          remaining_balance: initialRemainingBalance,
        };
        setFormData(normalized);
      };

      fetchRemainingBalance();
    }
  }, [isOpen, rowData]);

  const { distributorMap, getDistributorName } = useDistributorMap();

  // Sync sku_addional / isPenalties / suppliesME / branch flags once activity + settingsMap are known
  useEffect(() => {
    if (!formData.activity || !settingsMap[formData.activity]) return;
    const setting = settingsMap[formData.activity];
    setFormData((prev) => ({
      ...prev,
      sku_addional: setting.sku_addional === true,
      isPenalties: setting.isPenalties === true,
      suppliesME: setting.suppliesME === true,
      branch: setting.branch === true,
    }));
  }, [formData.activity, settingsMap]);

  // ============ GROUPED BRANCH (Mother -> Sub-account -> Branch) — same gets as RegularVisaForm ============

  const ensureAccountsListCached = async (distributorCode) => {
    if (!distributorCode) return [];
    if (accountsListCache[distributorCode]) return accountsListCache[distributorCode];

    const [userResult, motherResult, bpResult] = await Promise.all([
      supabase.from("Account_Users").select("UserID, name"),
      supabase.from("sub_mother_account").select("dscode, name"),
      supabase.from("Bp_Accounts").select("bp_code, bp_name"),
    ]);

    if (!userResult.error) {
      const userMap = {};
      userResult.data.forEach((u) => { userMap[u.UserID] = u.name; });
      setAgentNamesMap(userMap);
    }

    if (!motherResult.error) {
      const motherMap = {};
      motherResult.data.forEach((m) => {
        const cleanCode = m.dscode?.trim() || "";
        const displayName = m.name && m.name.trim() !== "" ? m.name.trim() : cleanCode;
        motherMap[cleanCode] = displayName;
        motherMap[m.dscode] = displayName;
      });
      setMotherAccountNamesMap(motherMap);
    }

    if (!bpResult.error) {
      const bpMap = {};
      bpResult.data.forEach((bp) => { if (bp.bp_code) bpMap[bp.bp_code.trim()] = bp.bp_name; });
      setBpNamesMap((prev) => ({ ...prev, ...bpMap }));
    }

    const batchSize = 1000;
    let allData = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("Accounts_List")
        .select("*")
        .eq("distributor_code", String(distributorCode))
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error("❌ Failed to fetch Accounts_List:", error);
        break;
      }

      const count = data?.length || 0;
      if (count > 0) {
        allData = [...allData, ...data];
        offset += batchSize;
        hasMore = count === batchSize;
      } else {
        hasMore = false;
      }
    }

    setAccountsListCache((prev) => ({ ...prev, [distributorCode]: allData }));
    return allData;
  };

  const fetchMotherAccountsListForEdit = async (distributorCode) => {
    if (!distributorCode) return [];

    const { data: distributor, error } = await supabase
      .from("distributors")
      .select("id, name, code, mother_accounts_code")
      .eq("code", distributorCode)
      .single();

    if (error || !distributor) return [];

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
    if (motherCodes.length === 0) return [];

    const { data: motherAccounts, error: motherErr } = await supabase
      .from("mother_account")
      .select("code, name")
      .in("code", motherCodes.map(Number));

    if (motherErr) return [];

    return motherCodes.map((code, index) => {
      const matched = motherAccounts?.find((acc) => String(acc.code) === String(code));
      return { id: index + 1, code, name: matched ? matched.name : code };
    });
  };

  const computeSubAccountsForMother = (mother, cachedData, distributorCode) => {
    if (!cachedData?.length) return [];
    const safeLower = (val) => (typeof val === "string" ? val.trim().toLowerCase() : String(val ?? "").toLowerCase());
    const selDist = safeLower(distributorCode);
    const selGroup = safeLower(mother.code);

    const filtered = cachedData.filter(
      (item) => safeLower(item.distributor_code) === selDist && safeLower(item.group_code) === selGroup
    );
    if (filtered.length === 0) return [];

    const unique = Array.from(
      new Map(
        filtered.map((item) => {
          const cleanCode = (item.mother_code || "").trim();
          return [cleanCode.toLowerCase(), { ...item, mother_code: cleanCode }];
        })
      ).values()
    );

    return unique.map((item) => {
      const cleanCode = item.mother_code;
      const displayName =
        motherAccountNamesMap[cleanCode] || motherAccountNamesMap[cleanCode.toLowerCase()] || cleanCode;
      return { id: item.id, name: displayName, code: cleanCode, group_code: item.group_code };
    });
  };

  const fetchBranchesForSubEdit = async (motherAccountCode, groupCode, cachedData) => {
    if (!cachedData?.length) return [];
    const safeLower = (val) => (typeof val === "string" ? val.trim().toLowerCase() : String(val ?? "").toLowerCase());
    const selGroup = safeLower(groupCode);

    const filtered = cachedData.filter((item) => {
      const motherMatch = (item.mother_code || "").trim() === motherAccountCode.trim();
      const groupMatch = safeLower(item.group_code) === selGroup;
      const hasBp = item.bp_code && item.bp_code.trim() !== "";
      return motherMatch && groupMatch && hasBp;
    });
    if (filtered.length === 0) return [];

    const allBpCodes = [...new Set(filtered.map((r) => (r.bp_code || "").trim()).filter(Boolean))];
    let allBpData = [];
    const batchSize = 1000;

    for (let i = 0; i < allBpCodes.length; i += batchSize) {
      const batch = allBpCodes.slice(i, i + batchSize);
      const { data: bpData, error } = await supabase
        .from("Bp_Accounts")
        .select("bp_code, bp_name")
        .in("bp_code", batch);
      if (error) continue;
      allBpData = [...allBpData, ...bpData];
    }

    const bpMap = {};
    allBpData.forEach((bp) => { if (bp.bp_code) bpMap[bp.bp_code.trim()] = bp.bp_name; });
    setBpNamesMap((prev) => ({ ...prev, ...bpMap }));

    const seen = new Set();
    const uniqueBranches = filtered
      .filter((row) => {
        const code = (row.bp_code || "").trim();
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .map((row) => {
        const code = (row.bp_code || "").trim();
        const branchName = bpMap[code];
        return {
          id: row.id,
          name: branchName || code,
          code,
          status: row.status,
          distributor_code: row.distributor_code,
          mother_code: row.mother_code,
          group_code: row.group_code,
        };
      });

    uniqueBranches.sort((a, b) => a.name.localeCompare(b.name));
    return uniqueBranches;
  };

  const fetchAllGroupedBranches = async () => {
    const distributorCode = formData.distributor;
    if (!distributorCode) return;
    setLoadingGroupedBranches(true);

    try {
      const cachedData = await ensureAccountsListCached(distributorCode);
      let motherAccounts = await fetchMotherAccountsListForEdit(distributorCode);
      setAccountTypes(motherAccounts);

      if (cachedData?.length) {
        const accessibleGroupCodes = new Set(
          cachedData.map((item) => item.group_code?.toString().trim()).filter(Boolean)
        );
        if (accessibleGroupCodes.size > 0) {
          motherAccounts = motherAccounts.filter((opt) => accessibleGroupCodes.has(opt.code?.toString().trim()));
        }
      }

      const groups = [];

      for (const mother of motherAccounts) {
        const subs = computeSubAccountsForMother(mother, cachedData, distributorCode);

        if (mother.name === "NON-CHAIN") {
          if (subs.length === 0) continue;
          groups.push({
            groupKey: `mother-${mother.id}`,
            groupLabel: mother.name,
            isNonChain: true,
            motherId: mother.id,
            motherCode: mother.code,
            motherName: mother.name,
            items: subs.map((s) => ({ id: s.id, name: s.name, code: s.code, groupCode: s.group_code })),
          });
          continue;
        }

        for (const sub of subs) {
          const branches = await fetchBranchesForSubEdit(sub.code, sub.group_code, cachedData);
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
              id: b.id, name: b.name, code: b.code, status: b.status, distributor_code: b.distributor_code,
            })),
          });
        }
      }

      setGroupedBranches(groups);

      const flatBranches = groups.filter((g) => !g.isNonChain).flatMap((g) => g.items);
      const uniqueFlatBranches = Array.from(new Map(flatBranches.map((b) => [b.code, b])).values());
      setBranchTypes(uniqueFlatBranches);
    } catch (err) {
      console.error("❌ Error building grouped branches:", err.message);
      Swal.fire("Error", "Failed to load branches.", "error");
    } finally {
      setLoadingGroupedBranches(false);
    }
  };

  // Auto-fetch once, as soon as we know the record's distributor
  useEffect(() => {
    if (isOpen && formData?.distributor && branchesFetchedForDistributor !== formData.distributor) {
      setBranchesFetchedForDistributor(formData.distributor);
      fetchAllGroupedBranches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, formData?.distributor]);

  // Convert legacy string-labels from DB (non-chain accountType names) back into ids once groups are loaded
  useEffect(() => {
    if (!groupedBranches.length) return;
    const nonChainGroup = groupedBranches.find((g) => g.isNonChain);
    if (!nonChainGroup) return;

    setFormData((prev) => {
      if (!Array.isArray(prev.accountType)) return prev;
      const needsConversion = prev.accountType.some((val) => typeof val === "string");
      if (!needsConversion) return prev;

      const convertedIds = prev.accountType.map((val) => {
        if (typeof val !== "string") return val;
        const match = nonChainGroup.items.find((i) => i.name === val);
        return match ? match.id : val;
      });
      return { ...prev, accountType: convertedIds };
    });
  }, [groupedBranches]);

  useEffect(() => {
    setBranchPage(1);
  }, [activeBranchTabKey, branchSearchTerm, showModal_Branch]);

  const formatGroupLabelForDisplay = (label) => {
    const match = label.match(/\(([^)]+)\)/);
    const inner = match ? match[1] : label;
    const dashIndex = inner.indexOf(" - ");
    if (dashIndex === -1) return { bold: inner, rest: "" };
    return { bold: inner.slice(0, dashIndex), rest: inner.slice(dashIndex) };
  };

  const getGroupInnerLabel = (group) => {
    const { bold, rest } = formatGroupLabelForDisplay(group.groupLabel);
    return `${bold}${rest}`;
  };

  const buildConvertedAccountType = (accountTypeArray) => {
    if (!Array.isArray(accountTypeArray)) return [];
    const labels = accountTypeArray
      .map((id) => {
        const chainGroup = groupedBranches.find((g) => !g.isNonChain && g.subAccountId === id);
        if (chainGroup) return getGroupInnerLabel(chainGroup);

        for (const g of groupedBranches) {
          if (g.isNonChain) {
            const item = g.items.find((i) => i.id === id);
            if (item) return item.name;
          }
        }
        // already a saved label string (couldn't be resolved back to an id) — keep as-is
        return typeof id === "string" ? id : null;
      })
      .filter(Boolean);
    return [...new Set(labels)];
  };

  const toggleGroupedBranchItem = (group, item) => {
    if (group.isNonChain) {
      setFormData((prev) => {
        const current = Array.isArray(prev.accountType) ? prev.accountType : [];
        const updated = current.includes(item.id)
          ? current.filter((x) => x !== item.id)
          : [...current, item.id];
        return { ...prev, accountType: updated };
      });
    } else {
      setFormData((prev) => {
        const currentAccountTypes = Array.isArray(prev.accountType) ? prev.accountType : [];
        const updatedAccountTypes = currentAccountTypes.includes(group.subAccountId)
          ? currentAccountTypes
          : [...currentAccountTypes, group.subAccountId];

        const currentBranchType = prev.branchType || [];
        const updatedBranchType = currentBranchType.includes(item.name)
          ? currentBranchType.filter((n) => n !== item.name)
          : [...currentBranchType, item.name];

        return { ...prev, accountType: updatedAccountTypes, branchType: updatedBranchType };
      });
    }
  };

  const isGroupedItemChecked = (group, item) => {
    if (group.isNonChain) return (formData.accountType || []).includes(item.id);
    return (formData.branchType || []).includes(item.name);
  };

  const getSelectedBranchChips = () => {
    const chips = [];

    (formData.branchType || []).forEach((name) => {
      chips.push({
        key: `branch-${name}`,
        label: name,
        onRemove: () =>
          setFormData((prev) => ({ ...prev, branchType: (prev.branchType || []).filter((n) => n !== name) })),
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
                accountType: (prev.accountType || []).filter((x) => x !== id),
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
          backgroundColor: "#3b82f6",
          color: "#fff",
          padding: "3px 8px",
          borderRadius: "5px",
          fontSize: "13px",
          marginRight: "5px",
          marginBottom: "4px",
        }}
      >
        {c.label}
        <span
          onClick={(e) => {
            e.stopPropagation();
            c.onRemove();
          }}
          style={{ marginLeft: "5px", cursor: "pointer", fontWeight: "bold" }}
        >
          ✖
        </span>
      </span>
    ));
  };

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
        Swal.fire({
          icon: 'warning',
          title: 'No Cover PWP Code',
          text: 'Cannot change credit budget without a Cover PWP Code.',
        });
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

      if (error) {
        console.error("❌ Database error:", error);
        Swal.fire({
          icon: 'error',
          title: 'Database Error',
          text: 'Failed to fetch remaining balance from amount_badget table.',
        });
        return;
      }

      if (!amountBadgetData) {
        console.warn("⚠️ No amount_badget record found for PWP Code:", pwpCode);
        Swal.fire({
          icon: 'warning',
          title: 'No Budget Record',
          text: 'No budget record found for this Cover PWP Code.',
        });
        return;
      }

      const originalRemainingBalance = parseFloat(amountBadgetData.remainingbalance || 0);
      console.log("💰 originalRemainingBalance from DB:", originalRemainingBalance);

      setBudgetList(prev => prev.map(item => ({
        ...item,
        budget: 0
      })));

      setFormData((prevData) => {
        console.log("🔄 Resetting to Original Balance from DB:", {
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

      Swal.fire({
        icon: 'success',
        title: 'Reset Successful',
        text: `Remaining balance reset to ₱${originalRemainingBalance.toFixed(2)}`,
        timer: 2000,
        showConfirmButton: false
      });

    } catch (err) {
      console.error("💥 Error in handleChangeCreditBudget:", err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An unexpected error occurred while resetting the budget.',
      });
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

  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerms.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchTerms.toLowerCase())
  );

  // ============ SUBMIT FUNCTIONS ============
  const submitRegularPWP = async () => {
    const creditBudgetToSave = isCreditBudgetEditable && formData.credit_budget
      ? parseFloat(formData.credit_budget)
      : currentTotalBudget;

    const newRemainingBalance = adjustedRemainingBalanceForBudget;

    const regularPwpData = {
      regularpwpcode: formData.regularpwpcode,
      pwptype: formData.pwptype,
      distributor: formData.distributor,
      accountType: buildConvertedAccountType(formData.accountType),
      branchType: formData.branchType || [],
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
      sku: item.sku || null,
      penalty: item.penalty || null,
      suppliesme: item.suppliesme || null,
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
            sku: account.sku,
            penalty: account.penalty,
            suppliesme: account.suppliesme,
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
        srp: Number(row.srp || 0),
        qty: Number(row.qty || 0),
        uom: row.uom || 'pc',
        discount: Number(row.discount || 0),
        billing_amount: computedBilling,
        total_amount: row.total_amount !== undefined && row.total_amount !== null
          ? Number(row.total_amount)
          : computedBilling,
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
        const { error: updateError } = await supabase
          .from('regular_sku')
          .update(payload)
          .eq('id', existingSku.id);

        if (updateError) {
          console.error(`Error updating SKU ${row.sku_code}:`, updateError.message);
          throw new Error(`Failed to update SKU ${row.sku_code}`);
        }
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

      if (pwpCodeToDelete) {
        await supabase
          .from('Approval_History')
          .delete()
          .eq('PwpCode', pwpCodeToDelete);
      }

      if (formData.cover_code) {
        await submitCoverPWP();
      } else {
        const creditBudgetToSave = isCreditBudgetEditable && formData.credit_budget
          ? parseFloat(formData.credit_budget)
          : currentTotalBudget;

        const newRemainingBalance = parseFloat(formData.initial_remaining_balance || 0) - creditBudgetToSave;

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

      await Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Successfully updated all data',
        timer: 2000,
        showConfirmButton: false
      });

      onClose();
      window.location.reload();

    } catch (err) {
      console.error('❌ Submit error:', err);

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

  // ============ RENDER COMPONENTS ============

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
            sku_addional: setting.sku_addional || false,
            isPenalties: setting.isPenalties || false,
            suppliesME: setting.suppliesME || false,
            branch: setting.branch || false,
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
          cursor: updating ? 'not-allowed' : 'pointer',
        }}
      >
        <option value="">Select Activity</option>
        {activities.map((opt, index) => (
          <option key={index} value={opt.code}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );

  const renderBranchField = (name, label) => {
    const branchEnabled = settingsMap[formData.activity]?.branch === true;
    if (!branchEnabled) return null;

    return (
      <div key={name} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
        <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>
          Branch <span style={{ color: "red" }}>*</span>
        </label>
        <div
          onClick={() => {
            setShowModal_Branch(true);
            fetchAllGroupedBranches();
          }}
          style={{
            cursor: "pointer",
            minHeight: "40px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "6px 8px",
            display: "flex",
            flexWrap: "wrap",
            gap: "5px",
            background: "#fff",
          }}
        >
          {getSelectedBranchChips().length > 0 ? (
            getSelectedBranchChips()
          ) : (
            <span style={{ color: "#888", fontSize: "13px" }}>Select Branch</span>
          )}
        </div>
      </div>
    );
  };

  const renderCategoryInput = (name, label) => (
    <div key={name} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
      <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          readOnly
          value={formData.categoryName}
          onClick={() => setShowCategoryModal(true)}
          placeholder="Select Categories"
          disabled
          style={{
            padding: "10px",
            paddingRight: "35px",
            borderRadius: "8px",
            border: "1px solid",
            cursor: "pointer",
            transition: "border-color 0.3s",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
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

  const renderRemainingBalanceInput = (name, label, disabled) => {
    let displayValue;

    if (skuList.length > 0) {
      displayValue = unifiedRemainingBalance;
    } else if (showBudgetTable) {
      displayValue = adjustedRemainingBalanceForBudget;
    } else {
      displayValue = formData.remaining_balance || 0;
    }

    return (
      <div key={name} style={{ display: "flex", flexDirection: "column" }}>
        <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
        <input
          type="number"
          name={name}
          value={displayValue.toFixed(2)}
          onChange={handleChange_rem}
          disabled={disabled || updating}
          step="0.01"
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: (disabled || updating) ? "#f9f9f9" : "#fff",
            fontWeight: "600",
            color: displayValue < 0 ? "red" : "green",
          }}
        />
      </div>
    );
  };

  const renderTextInput = (name, label, value, disabled) => {
    let displayValue = value;
    if (name === "distributor") {
      displayValue = getDistributorName(value);
    }

    return (
      <div key={name} style={{ display: "flex", flexDirection: "column" }}>
        <label style={{ marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>{label}</label>
        <input
          type="text"
          name={name}
          value={displayValue}
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
  };

  const renderField = ({ name, label, disabled, type }) => {
    const value = formData[name] ?? (type === "checkbox" ? false : "");

    if (name === "activityDurationFrom" || name === "activityDurationTo") {
      return renderDateInput(name, label, value, disabled);
    }

    if (name === "credit_budget") {
      return renderCreditBudgetInput(name, label, disabled);
    }

    if (name === "activity") {
      return renderActivitySelect(name, label, disabled);
    }

    if (name === "categoryName") {
      return renderCategoryInput(name, label);
    }

    if (name === "branchType") {
      return renderBranchField(name, label);
    }

    if (name === "accountType") {
      return null; // merged into the Branch field above
    }

    if (type === "checkbox") {
      return renderCheckbox(name, label, value, disabled);
    }

    if (name === "remaining_balance") {
      return renderRemainingBalanceInput(name, label, disabled);
    }

    return renderTextInput(name, label, value, disabled);
  };
 if (!isOpen || !formData) return null;

  return (
    <div style={{
      width: "100%",
      minHeight: "100vh",
      backgroundColor: "#f4f6f9",
      padding: "30px",
      boxSizing: "border-box",
    }}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        padding: "30px",
        width: "100%",
        maxWidth: "1300px",
        margin: "0 auto",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
              fontWeight: "600",
              border: "1px solid #ccc",
              background: "#f1f5f9",
              borderRadius: "8px",
              padding: "8px 14px",
              cursor: updating ? "not-allowed" : "pointer",
              color: "#333",
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>Edit Record</h2>
          <div style={{ width: "90px" }} />
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

          {/* Branch Modal — Mother -> Sub-account -> Branch, same gets as RegularVisaForm */}
          <Modal
            show={showModal_Branch}
            onHide={() => {
              setShowModal_Branch(false);
              setBranchSearchTerm("");
            }}
            centered
            size="xl"
          >
            <Modal.Header closeButton style={{ background: "rgb(70, 137, 166)", color: "white" }}>
              <Modal.Title style={{ width: "100%", textAlign: "center" }}>Select Branch</Modal.Title>
            </Modal.Header>

            <Modal.Body style={{ minHeight: "60vh", display: "flex", flexDirection: "column", padding: "1rem" }}>
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
                                  id={`edit-grouped-branch-${group.groupKey}-${item.id}`}
                                  style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                                />
                                <label
                                  htmlFor={`edit-grouped-branch-${group.groupKey}-${item.id}`}
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
                                    <strong>{bold}</strong>{rest}
                                  </span>
                                );
                              })()}
                            </div>
                          ))
                        )}
                      </div>

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
                onClick={() => setFormData((prev) => ({ ...prev, branchType: [], accountType: [] }))}
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
                      {formData.sku_addional && <th style={{ padding: "8px", border: "1px solid #ddd" }}>SKU</th>}
                      {formData.isPenalties && <th style={{ padding: "8px", border: "1px solid #ddd" }}>Penalties</th>}
                      {formData.suppliesME && <th style={{ padding: "8px", border: "1px solid #ddd" }}>Supplies/M.E</th>}
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetList.map(({ id, account_name, budget, sku, penalty, suppliesme }) => (
                      <tr key={id} style={{ borderBottom: "1px solid #ddd" }}>
                        <td style={{ padding: "8px", border: "1px solid #ddd", wordBreak: "break-word" }}>
                          {account_name}
                        </td>
                        {formData.sku_addional && (
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            <input
                              type="text"
                              value={sku || ""}
                              onChange={(e) => handleBudgetFieldChange(id, "sku", e.target.value)}
                              placeholder="Enter SKU"
                              style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "6px",
                                borderRadius: "4px",
                                border: "1px solid #ccc",
                              }}
                            />
                          </td>
                        )}
                        {formData.isPenalties && (
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            <MultiSelectDropdown
                              options={penaltyOptions}
                              selected={Array.isArray(penalty) ? penalty : penalty ? [penalty] : []}
                              placeholder="Select Penalty"
                              onChange={(updated) => {
                                handleBudgetFieldChange(id, "penalty", updated);
                                if (updated.length > 0) handleBudgetFieldChange(id, "suppliesme", []);
                              }}
                            />
                          </td>
                        )}
                        {formData.suppliesME && (
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            <MultiSelectDropdown
                              options={suppliesOptions}
                              selected={Array.isArray(suppliesme) ? suppliesme : suppliesme ? [suppliesme] : []}
                              placeholder="Select Item"
                              onChange={(updated) => {
                                handleBudgetFieldChange(id, "suppliesme", updated);
                                if (updated.length > 0) handleBudgetFieldChange(id, "penalty", []);
                              }}
                            />
                          </td>
                        )}
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

          {skuList.length > 0 && (() => {
            const groups = {};
            skuList.forEach((item) => {
              if (item.sku_code === "Total:") return;
              const acct = item.account_name || "Unassigned";
              if (!groups[acct]) groups[acct] = [];
              groups[acct].push(item);
            });

            const grandTotals = Object.values(groups).flat().reduce(
              (acc, r) => {
                acc.QTY += Number(r.qty || 0);
                acc.BILLING_AMOUNT += Number(r.srp || 0) * Number(r.qty || 0);
                acc.DISCOUNT += Number(r.discount || 0);
                acc.TOTAL_AMOUNT += Number(r.total_amount || 0);
                return acc;
              },
              { QTY: 0, BILLING_AMOUNT: 0, DISCOUNT: 0, TOTAL_AMOUNT: 0 }
            );

            return (
              <div style={{ marginTop: "30px", borderTop: "1px solid #ddd", paddingTop: "20px", maxHeight: "800px", overflowY: "auto" }}>
                {Object.entries(groups).map(([accountName, rows]) => {
                  const branchTotal = rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

                  return (
                    <div key={accountName} style={{ marginBottom: "24px" }}>
                      <h6 style={{ marginBottom: "8px" }}>
                        <span style={{ backgroundColor: "#3b82f6", color: "#fff", padding: "3px 8px", borderRadius: "5px", fontSize: "13px" }}>
                          {accountName}
                        </span>
                      </h6>

                      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#f9f9f9", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", borderRadius: "8px", overflow: "hidden" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#3b82f6", color: "white", fontWeight: "bold", textAlign: "center", fontSize: "14px" }}>
                            <th style={{ padding: "12px", border: "1px solid #ddd" }}>SKU</th>
                            <th style={{ display: "none" }}>SRP</th>
                            <th style={{ display: "none" }}>Qty</th>
                            <th style={{ display: "none" }}>UOM</th>
                            <th style={{ display: "none" }}>Billing Amount</th>
                            <th style={{ display: "none" }}>Discount ₱</th>
                            <th style={{ padding: "12px", border: "1px solid #ddd" }}>Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ id, sku_code, srp, qty, uom, discount, total_amount }) => (
                            <tr key={id} style={{ borderBottom: "1px solid #ddd", textAlign: "center", fontSize: "14px" }}>
                              <td style={{ minWidth: "200px", padding: "10px", border: "1px solid #ddd" }}>
                                <input
                                  type="text"
                                  value={categoryMap[sku_code] || sku_code || ""}
                                  disabled
                                  style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #ddd" }}
                                />
                              </td>
                              <td style={{ display: "none" }}>
                                <input type="number" value={srp || 0} step="0.01" disabled />
                              </td>
                              <td style={{ display: "none" }}>
                                <input
                                  type="number"
                                  value={qty || 0}
                                  onChange={(e) => handleSkuChange(id, "qty", e.target.value)}
                                />
                              </td>
                              <td style={{ display: "none" }}>
                                <select value={uom || "pc"} onChange={(e) => handleSkuChange(id, "uom", e.target.value)}>
                                  <option value="pc">PC</option>
                                  <option value="case">Case</option>
                                  <option value="ibx">IBX</option>
                                </select>
                              </td>
                              <td style={{ display: "none" }}>
                                {(Number(srp || 0) * Number(qty || 0)).toFixed(2)}
                              </td>
                              <td style={{ display: "none" }}>
                                <input
                                  type="number"
                                  value={discount ?? 0}
                                  step="0.01"
                                  onChange={(e) => handleSkuChange(id, "discount", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                                />
                              </td>
                              <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={total_amount ?? 0}
                                  onChange={(e) => handleSkuChange(id, "total_amount", parseFloat(e.target.value) || 0)}
                                  style={{ width: "100%", padding: "8px", borderRadius: "5px", border: "1px solid #ddd" }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ backgroundColor: "#eef4ff", fontWeight: "bold", textAlign: "center" }}>
                            <td style={{ padding: "10px", border: "1px solid #ddd" }}>Total</td>
                            <td style={{ display: "none" }}></td>
                            <td style={{ display: "none" }}></td>
                            <td style={{ display: "none" }}></td>
                            <td style={{ display: "none" }}></td>
                            <td style={{ display: "none" }}></td>
                            <td style={{ padding: "10px", border: "1px solid #ddd" }}>{branchTotal.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}

                <div className="mt-4">
                  <h4 className="text-center mb-4">📊 Grand Total Summary</h4>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
                    <thead style={{ backgroundColor: "#3b82f6", color: "white" }}>
                      <tr>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Total QTY</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Total Billing</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Total Discount</th>
                        <th style={{ padding: "10px", border: "1px solid #ddd" }}>Grand Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>{grandTotals.QTY}</td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>{grandTotals.BILLING_AMOUNT.toFixed(2)}</td>
                        <td style={{ padding: "10px", border: "1px solid #ddd" }}>{grandTotals.DISCOUNT.toFixed(2)}</td>
                        <td style={{ padding: "10px", border: "1px solid #ddd", fontWeight: "bold" }}>{grandTotals.TOTAL_AMOUNT.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f0f8ff", borderRadius: "8px", fontWeight: "bold", textAlign: "right" }}>
                  Remaining Balance: {unifiedRemainingBalance.toFixed(2)}
                </div>
              </div>
            );
          })()}

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
