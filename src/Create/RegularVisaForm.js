
import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';  // <---- import sweetalert2
import { supabase } from '../supabaseClient';
import { Modal, Button } from 'react-bootstrap';
import { FaExclamationTriangle } from 'react-icons/fa';
import { Table, Form, Card, Spinner } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import { FaFileExcel, FaCloudUploadAlt, FaDownload, FaSave, FaSearch } from 'react-icons/fa';

const RegularVisaForm = () => {

    const [userApprovers, setUserApprovers] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: userApproversData, error: userApproversError } = await supabase
                .from('User_Approvers')
                .select('*')
                .order('created_at', { ascending: false });

            // Fetch users for name lookup
            const { data: usersData, error: usersError } = await supabase
                .from('Account_Users')
                .select('UserID, name');

            // if (approvalsError) console.error('Error fetching approvals:', approvalsError);
            if (userApproversError) console.error('Error fetching user approvers:', userApproversError);
            if (usersError) console.error('Error fetching users:', usersError);

            // setSingleApprovals(approvalsData || []);
            setUserApprovers(userApproversData || []);
            setUsers(usersData || []);
            setLoading(false);
        };

        fetchData();
    }, []);

    const [accountSkuRows, setAccountSkuRows] = useState({}); // Object to store SKU rows per account
    const [selectedAccountForSku, setSelectedAccountForSku] = useState("ALL_ACCOUNTS");
    // Step 0: Form data
    const [formData, setFormData] = useState({
        regularpwpcode: "",
        accountType: [],
        activity: "",
        pwptype: "Regular",
        notification: false,
        objective: "",
        promoScheme: "",
        activityDurationFrom: new Date().toISOString().split('T')[0], // today
        activityDurationTo: new Date().toISOString().split('T')[0], // today
        rowsCategories: [
            { category: '', amount: '' },
            { category: '', amount: '' }
        ],



        isPartOfCoverPwp: false,
        coverPwpCode: "",
        distributor: "",
        amountbadget: "0",
        categoryCode: [],
        categoryName: [],
        sku: null,              // New Field
        accounts: null,         // New Field
        amount_display: null,   // New Field
    });


    const [allRegularPwpCodes, setAllRegularPwpCodes] = useState([]); // Stores all regular pwp codes
    const [loadingRegularPwpCodes, setLoadingRegularPwpCodes] = useState(true); // Loading state for fetching codes

    useEffect(() => {
        async function fetchRegularPwpCodes() {
            const { data, error } = await supabase
                .from('regular_pwp') // Assuming your table is called 'regular_pwp'
                .select('regularpwpcode'); // Selecting the column with regular pwp codes

            if (error) {
                console.error('Error fetching regular pwp codes:', error);
                setLoadingRegularPwpCodes(false); // Set loading to false on error
            } else {
                const codes = data
                    .map(row => row.regularpwpcode) // Extracting regularpwpcode
                    .filter(Boolean); // Removing any falsy values (null, undefined)

                setAllRegularPwpCodes(codes); // Set the codes in the state

                // Generate a new code if the coverCode is not set in formData
                if (!formData.regularpwpcode) {
                    const newCode = generateRegularCode(codes); // Generate the new cover code
                    setFormData(prev => ({ ...prev, regularpwpcode: newCode })); // Update formData with the new coverCode
                }

                setLoadingRegularPwpCodes(false); // Set loading to false after data fetch
            }
        }

        fetchRegularPwpCodes(); // Call the fetch function when the component mounts
    }, []); // Empty dependency array so it runs only once when the component mounts

    useEffect(() => {
        // This effect runs whenever `allRegularPwpCodes` changes
        if (!formData.regularpwpcode && allRegularPwpCodes.length > 0) {
            const newCode = generateRegularCode(allRegularPwpCodes); // Generate the new cover code
            setFormData(prev => ({ ...prev, regularpwpcode: newCode })); // Update formData with the new coverCode
        }
    }, [allRegularPwpCodes]); // Dependencies are the fetched codes

    // Generate a new code based on the existing ones
    const generateRegularCode = (existingCodes = []) => {
        const year = new Date().getFullYear(); // Get the current year
        const prefix = `R${year}-`; // Prefix with the year (e.g., R2025-)

        // Filter out existing codes that start with the prefix and extract numeric parts
        const codesForYear = existingCodes
            .filter(code => code?.startsWith(prefix)) // Only keep codes with the current year prefix
            .map(code => parseInt(code.replace(prefix, ''), 10)) // Remove the prefix and convert to integers
            .filter(num => !isNaN(num)); // Ensure we only keep valid numbers

        // Get the next code number by incrementing the maximum of existing ones
        const newNumber = (codesForYear.length ? Math.max(...codesForYear) : 0) + 1; // If codes exist, find the highest number and increment

        return `${prefix}${newNumber}`; // Return the new generated code
    };




    const [files, setFiles] = useState([]);
    const fileInputRef = useRef();

    const handleFiles = (selectedFiles) => {
        const newFiles = Array.from(selectedFiles).map(file => {
            // Create preview URL for images
            if (file.type.startsWith('image/')) {
                file.preview = URL.createObjectURL(file);
            }
            return file;
        });
        setFiles(prev => [...prev, ...newFiles]);
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

    const borderColor = formData.company ? 'green' : hovered ? '#ccc' : '';

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





    const [coverPwpWithStatus, setCoverPwpWithStatus] = React.useState([]);
    const [coverPwpSearch, setCoverPwpSearch] = React.useState('');
    const [selectedBalance, setSelectedBalance] = React.useState(null);

    React.useEffect(() => {
        async function fetchCoverPwpWithStatus() {
            try {
                // Step 1: Fetch amount_badget data
                const { data: amountData, error: amountError } = await supabase
                    .from('amount_badget')
                    .select('pwp_code, amountbadget, remainingbalance');
                if (amountError) throw amountError;

                // Step 2: Fetch approval history for those pwp_codes
                const pwpCodes = amountData.map(item => item.pwp_code);
                const { data: approvalData, error: approvalError } = await supabase
                    .from('Approval_History')
                    .select('PwpCode, Response, DateResponded')
                    .in('PwpCode', pwpCodes)
                    .order('DateResponded', { ascending: false });
                if (approvalError) throw approvalError;

                // Step 3: Fetch cover_pwp data to get createForm
                const { data: coverPwpData, error: coverPwpError } = await supabase
                    .from('cover_pwp')
                    .select('cover_code, createForm');
                if (coverPwpError) throw coverPwpError;

                // Step 4: Build maps for quick lookup
                const latestResponseMap = new Map();
                for (const record of approvalData) {
                    if (!latestResponseMap.has(record.PwpCode)) {
                        latestResponseMap.set(record.PwpCode, record.Response.toLowerCase());
                    }
                }

                const createFormMap = new Map();
                for (const record of coverPwpData) {
                    createFormMap.set(record.cover_code, record.createForm);
                }

                // Step 5: Merge everything together
                const mergedData = amountData.map(item => {
                    const latestResponse = latestResponseMap.get(item.pwp_code) || null;
                    return {
                        ...item,
                        Approved: latestResponse === 'approved',
                        createForm: createFormMap.get(item.pwp_code) || 'N/A', // fallback if no createForm found
                    };
                });

                // Optional: Log to console in requested format
                mergedData.forEach(item => {
                    console.log(`${item.pwp_code} - ${item.remainingbalance} - ${item.createForm}`);
                });

                setCoverPwpWithStatus(mergedData);
            } catch (error) {
                console.error('Error fetching cover PWP data with status:', error);
                setCoverPwpWithStatus([]);
            }
        }

        fetchCoverPwpWithStatus();
    }, []);





    const [showCoverModal, setShowCoverModal] = useState(false);



    const [showModal, setShowModal] = useState(false);

    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [listings, setListings] = useState([]);
    const [selectedListings, setSelectedListings] = useState([]);
    const [showListingModal, setShowListingModal] = useState(false);
    const [selectedSkus, setSelectedSkus] = useState([]);

    const [loadingListings, setLoadingListings] = useState(false);
    const handleCheckboxToggle = (skuCode, isChecked) => {
        // Only allow toggling if category-based SKU selection is allowed
        const setting = settingsMap[formData.activity];
        if (!setting?.sku) return;

        setSelectedSkus(prev => {
            if (isChecked) {
                if (!prev.includes(skuCode)) {
                    return [...prev, skuCode];
                }
                return prev;
            } else {
                return prev.filter(code => code !== skuCode);
            }
        });

        setFormData(prev => ({
            ...prev,

        }));

        console.log(`✅ Updated selected SKUs:`, isChecked ? 'Added' : 'Removed', skuCode);
    };



    useEffect(() => {
        // Sync rows to selectedSkus
        const newRows = selectedSkus.map(sku => {
            const existingRow = rows.find(row => row.SKU === sku);
            return existingRow || { SKU: sku, SRP: '', QTY: '', UOM: '', DISCOUNT: '', BILLING_AMOUNT: '' };
        });
        setRows(newRows);
    }, [selectedSkus]);

    const handleAccountSkuChange = (selectedCode) => {
        setSelectedAccountForSku(selectedCode);

        if (selectedCode && selectedCode !== 'ALL_ACCOUNTS') {
            setAccountSkuRows(prev => {
                const existingRows = prev[selectedCode] || [];

                // Only create a default row if this account truly has none
                if (existingRows.length === 0) {
                    return {
                        ...prev,
                        [selectedCode]: [{
                            accountCode: selectedCode,  // 👈 keep code reference
                            SKUITEM: '',
                            SRP: '',
                            QTY: '',
                            UOM: '',
                            BILLING_AMOUNT: '',
                            DISCOUNT: '',
                            TOTAL_AMOUNT: '',
                        }]
                    };
                }

                return prev; // Keep existing rows
            });
        }
    };



    const handleChangeSkuForAccount = (accountCode, index, field, value) => {
        setAccountSkuRows(prevAccountRows => {
            const updatedAccountRows = { ...prevAccountRows };
            const accountRows = [...(updatedAccountRows[accountCode] || [])];
            const currentRow = { ...accountRows[index] };

            if (field === 'SKUITEM') {
                currentRow.SKUITEM = value;
            } else {
                currentRow.SKUITEM = currentRow.SKUITEM || '';
                currentRow[field] = value;
            }

            // NEW CALCULATION LOGIC
            if (['SRP', 'QTY'].includes(field)) {
                const srp = parseFloat(field === 'SRP' ? value : currentRow.SRP) || 0;
                const qty = parseInt(field === 'QTY' ? value : currentRow.QTY, 10) || 0;

                // Calculate billing amount first (SRP × QTY)
                currentRow.BILLING_AMOUNT = srp * qty;

                // Then calculate total amount (billing amount - discount)
                const discount = parseFloat(currentRow.DISCOUNT) || 0;
                currentRow.TOTAL_AMOUNT = currentRow.BILLING_AMOUNT - discount;

            } else if (field === 'DISCOUNT') {
                const discount = parseFloat(value) || 0;
                currentRow.DISCOUNT = discount;

                // Recalculate total amount when discount changes
                const billingAmount = parseFloat(currentRow.BILLING_AMOUNT) || 0;
                currentRow.TOTAL_AMOUNT = billingAmount - discount;
            }

            accountRows[index] = currentRow;
            updatedAccountRows[accountCode] = accountRows;

            return updatedAccountRows;
        });
    };
    const addSkuRowForAccount = (accountCode) => {
        setAccountSkuRows(prev => ({
            ...prev,
            [accountCode]: [
                ...(prev[accountCode] || []),
                {
                    SKUITEM: '',
                    SRP: '',
                    QTY: '',
                    UOM: 'Case',
                    DISCOUNT: '',
                    BILLING_AMOUNT: ''
                }
            ]
        }));
    };
    const removeSkuRowForAccount = (accountCode, index) => {
        setAccountSkuRows(prev => ({
            ...prev,
            [accountCode]: prev[accountCode].filter((_, i) => i !== index)
        }));
    };
    const calculateAccountSkuTotals = (accountCode) => {
        const accountRows = accountSkuRows[accountCode] || [];
        return accountRows.reduce(
            (acc, row) => {
                acc.SRP += parseFloat(row.SRP) || 0;
                acc.QTY += parseInt(row.QTY) || 0;
                acc.BILLING_AMOUNT += parseFloat(row.BILLING_AMOUNT) || 0;
                acc.DISCOUNT += parseFloat(row.DISCOUNT) || 0;
                acc.TOTAL_AMOUNT += parseFloat(row.TOTAL_AMOUNT) || 0;

                if (row.UOM && UOM_OPTIONS.includes(row.UOM)) {
                    acc.UOMCount[row.UOM] = (acc.UOMCount[row.UOM] || 0) + 1;
                }
                return acc;
            },
            { SRP: 0, QTY: 0, BILLING_AMOUNT: 0, DISCOUNT: 0, TOTAL_AMOUNT: 0, UOMCount: {} }
        );
    };

    const calculateGrandTotals = () => {
        const allAccountCodes = formData.accountType || [];
        return allAccountCodes.reduce((grandTotal, accountCode) => {
            const accountTotals = calculateAccountSkuTotals(accountCode);
            grandTotal.SRP += accountTotals.SRP;
            grandTotal.QTY += accountTotals.QTY;
            grandTotal.DISCOUNT += accountTotals.DISCOUNT;
            grandTotal.BILLING_AMOUNT += accountTotals.BILLING_AMOUNT;

            // Merge UOM counts
            Object.keys(accountTotals.UOMCount).forEach(uom => {
                grandTotal.UOMCount[uom] = (grandTotal.UOMCount[uom] || 0) + accountTotals.UOMCount[uom];
            });

            return grandTotal;
        }, { SRP: 0, QTY: 0, DISCOUNT: 0, BILLING_AMOUNT: 0, UOMCount: {} });
    };
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
            .from('category')
            .select('*')
            .order('code', { ascending: true });
        if (error) {
            console.error('Error fetching categories:', error.message);
            setCategories([]);
        } else {
            setCategories(data);
        }
        setLoading(false);
    }

    // Filter by name or code
    const filteredList = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Click input to open modal
    const handleInputClick = () => {
        if (formData.distributor) {
            setShowModal(true);
            setSearchTerm('');
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

    const [distributors, setDistributors] = useState([]);

    useEffect(() => {
        async function fetchDistributors() {
            const { data, error } = await supabase
                .from('distributors')
                .select('id, name, code');
            if (error) {
                console.error('Error fetching distributors:', error);
            } else {
                setDistributors(data);
            }
        }

        fetchDistributors();
    }, []);
    const selectedDistributor = distributors.find(d => d.code === formData.distributor);
    const selectedName = selectedDistributor ? selectedDistributor.name : '';





    // Toggle selection of accountType


    const [accountSearchTerm, setAccountSearchTerm] = useState("");
    const [showModal_Account, setShowModal_Account] = useState(false);


    // Get selected account names for display
    const getAccountNames = () => {
        if (!formData.accountType.length) return "";

        const selectedNames = accountTypes
            .filter((opt) => formData.accountType.includes(opt.code))
            .map((opt) => opt.name);

        return selectedNames.join(", ");
    };

    // Toggle checkbox selection of account types
    const toggleAccountType = (code) => {
        setFormData((prev) => {
            const accountType = prev.accountType.includes(code)
                ? prev.accountType.filter((c) => c !== code) // remove
                : [...prev.accountType, code]; // add
            return { ...prev, accountType };
        });
    };

    // Handle changes on form inputs, including distributor change
    // Fixed version of handleFormChange function
    // Fixed version of handleFormChange function


    const shouldShowCategory = () => {
        // If distributor is BAD ORDER → hide
        if (formData.distributorName?.trim().toUpperCase() === "BAD ORDER") {
            return false;
        }

        // If activity is BAD ORDER (code 10007 or name contains BAD ORDER) → hide
        const selectedActivity = activities.find((act) => act.code === formData.activity);

        if (selectedActivity &&
            (selectedActivity.name?.toUpperCase() === "BAD ORDER")) {
            return false;
        }

        return true; // ✅ Otherwise → show
    };
    const handleFormChange = async (e) => {
        const { name, value } = e.target;
        console.log(`📝 Form change detected - Field: "${name}", Value: "${value}"`);

        // If "distributor" changes, clear rowsAccounts early
        if (name === "distributor" || name === "accountType") {
            setRowsAccounts([]);
            console.log("🧹 Cleared rowsAccounts due to distributor/accountType change");
        }

        // Main state update block
        setFormData((prev) => {
            const newForm = { ...prev, [name]: value };

            if (name === "activity") {
                const selectedActivity = activities.find((a) => a.code === value);
                newForm.activityName = selectedActivity?.name || "";
                console.log("🎯 Selected activity:", selectedActivity ? `${selectedActivity.code} - ${selectedActivity.name}` : "Not found");
                console.log("📛 Selected Activity Name:", newForm.activityName);

                if (settingsMap[value]) {
                    newForm.sku = settingsMap[value].sku;
                    newForm.accounts = settingsMap[value].accounts;
                    newForm.amount_display = settingsMap[value].amount_display;

                    console.log("🔍 Applied settingsMap values:", {
                        sku: newForm.sku,
                        accounts: newForm.accounts,
                        amount_display: newForm.amount_display,
                    });
                }
            }

            console.log("📋 Updated formData:", newForm);
            return newForm;
        });

        // 🔄 If distributor changes, fetch related data
        if (name === "distributor") {
            try {
                const selectedDistributor = distributors.find((d) => d.code === Number(value));

                if (!selectedDistributor) {
                    console.warn("⚠️ Distributor not found for code:", value);
                    setAccountTypes([]);
                    return;
                }

                console.log("📦 Selected distributor:", selectedDistributor);

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

                console.log(`🔍 Starting to fetch all categories for distributor ID: ${selectedDistributor.id}`);

                while (hasMore) {
                    console.log(`📥 Fetching batch ${Math.floor(offset / batchSize) + 1}... (offset: ${offset})`);

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

                    console.log(`✅ Batch ${Math.floor(offset / batchSize) + 1} fetched: ${data?.length || 0} records`);

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

                console.log("✅ All formatted accountTypes set:", formatted.length, "records");
                console.log("🧹 Reset formData.accountType after distributor change");

            } catch (error) {
                console.error("❌ Failed to fetch category details:", error.message);
                setAccountTypes([]);
            }
        }
    };





    const [rawAmount, setRawAmount] = React.useState(formData.amountbadget || '');

    const formatNumberWithCommas = (num) => {
        if (!num) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const handleAmountChange = (e) => {
        let value = e.target.value;

        // Remove all commas
        value = value.replace(/,/g, '');

        // Allow only digits (empty string allowed for deletion)
        if (/^\d*$/.test(value)) {
            // Format with commas
            const formattedValue = formatNumberWithCommas(value);
            setRawAmount(formattedValue);
            handleFormChange({ target: { name: 'amountbadget', value } }); // Save unformatted value in formData
        }
    };


    // 1st page for SKU

    const UOM_OPTIONS = ['Case', 'PC', 'IBX'];

    const [rows, setRows] = useState([]);


    // Export full table to Excel
    const triggerFileInput = () => {
        if (window.excelInput) window.excelInput.click();
    };

    // Common handler for file import
    const handleFileImport = (file) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const imported = XLSX.utils.sheet_to_json(worksheet);

            // ❌ Reject if more than 2 rows
            if (imported.length > 2) {
                Swal.fire({
                    icon: 'error',
                    title: 'Import Limit Exceeded',
                    text: 'You can only import up to 2 rows.',
                });
                return;
            }

            // ✅ Proceed with processing
            const importedRows = imported.map((row, idx) => {
                const SRP = parseFloat(row.SRP) || 0;
                const QTY = parseInt(row.QTY) || 0;
                const DISCOUNT = parseFloat(row.DISCOUNT) || 0;

                return {
                    id: Date.now() + idx,
                    SKU: row.SKUITEM || '',
                    SRP,
                    QTY,
                    UOM: row.UOM || '',
                    DISCOUNT,
                    BILLING_AMOUNT: (SRP * QTY) - DISCOUNT,
                };
            });

            const totals = importedRows.reduce(
                (acc, row) => {
                    acc.SRP += row.SRP;
                    acc.QTY += row.QTY;
                    acc.DISCOUNT += row.DISCOUNT;
                    acc.BILLING_AMOUNT += row.BILLING_AMOUNT;

                    if (row.UOM && UOM_OPTIONS.includes(row.UOM)) {
                        acc.UOMCount[row.UOM] = (acc.UOMCount[row.UOM] || 0) + 1;
                    }

                    return acc;
                },
                { SRP: 0, QTY: 0, DISCOUNT: 0, BILLING_AMOUNT: 0, UOMCount: {} }
            );

            setRows(importedRows);
            setTotals(totals);
        };

        reader.readAsArrayBuffer(file);
    };

    // Calculate totals live

    const [totals, setTotals] = useState({
        SRP: 0,
        QTY: 0,
        DISCOUNT: 0,
        BILLING_AMOUNT: 0,
        UOMCount: {}
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


    // Export to Excel
    const handleExport = () => {
        if (rows.length === 0) {
            alert("ADD 0 = 00  IN BUDGET.");
            return;
        }

        const exportData = rows.map(row => ({
            SKU: row.SKUITEM,
            SRP: row.SRP,
            QTY: row.QTY,
            UOM: row.UOM,
            DISCOUNT: row.DISCOUNT,
            BILLING_AMOUNT: row.BILLING_AMOUNT

        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "SKU_Data");

        XLSX.writeFile(workbook, "SKU_List.xlsx");
    };

    const [rowsAccounts, setRowsAccounts] = useState([]); // Account rows from database or imported data
    const [loadingAccounts, setLoadingAccounts] = useState(false); // Loading state
    const fileInputRefs = useRef(null); // Reference to file input for triggering the file picker

    // Fetch data from Supabase
    const fetchRowsAccounts = async () => {
        setLoadingAccounts(true);

        const { data, error } = await supabase
            .from('regular_accountlis_badget') // ✅ Correct table name
            .select('*')
            .order('id', { ascending: true }); // Optional, but fine

        if (error) {
            console.error('Error fetching data:', error);
            // Optional: show alert
        } else {
            setRowsAccounts(data); // ✅ Assuming `setRowsAccounts` updates state
        }

        setLoadingAccounts(false);
    };

    useEffect(() => {
        fetchRowsAccounts();
    }, []);



    const [importError, setImportError] = React.useState('');

    const handleImportCSV = (file) => {
        if (!file) return;

        setImportError(''); // Clear previous errors

        const reader = new FileReader();

        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            const requiredColumns = ['ACCOUNT_CODE', 'ACCOUNT_NAME', 'BUDGET'];

            // Find header row index with all required columns
            const headerRowIndex = data.findIndex(row =>
                requiredColumns.every(col => row.includes(col))
            );

            if (headerRowIndex === -1) {
                const errMsg = 'Ops! The imported file must have all required columns (ACCOUNT_CODE, ACCOUNT_NAME, BUDGET) in the same row.';
                Swal.fire({
                    icon: 'error',
                    title: 'Import Error',
                    text: errMsg,
                });
                setImportError(errMsg);
                return;
            }

            const headerRow = data[headerRowIndex];
            const importedRows = data.slice(headerRowIndex + 1);

            // Extract imported account codes from CSV
            const importedAccountCodes = importedRows.map(row => row[headerRow.indexOf('ACCOUNT_CODE')] || '').filter(code => code !== '');

            // Get the UI account codes filtered by formData.accountType (accounts visible in your UI table)
            const uiAccountCodes = accountTypes
                .filter(account => formData.accountType.includes(account.code))
                .map(account => account.code);

            // Compare length first
            if (importedAccountCodes.length !== uiAccountCodes.length) {
                const errMsg = `Ops! Imported data row count (${importedAccountCodes.length}) does not match the UI table row count (${uiAccountCodes.length}).`;
                Swal.fire({
                    icon: 'error',
                    title: 'Import Error',
                    text: errMsg,
                });
                setImportError(errMsg);
                return;
            }

            // Check if all imported codes exist in UI account codes
            const invalidCodes = importedAccountCodes.filter(code => !uiAccountCodes.includes(code));

            if (invalidCodes.length > 0) {
                const errMsg = `Ops! Imported file contains account codes not in the UI table: ${invalidCodes.join(', ')}`;
                Swal.fire({
                    icon: 'error',
                    title: 'Import Error',
                    text: errMsg,
                });
                setImportError(errMsg);
                return;
            }

            // Passed validations, now map to newAccounts
            const newAccounts = importedRows.map((row, index) => {
                return {
                    id: `new-${index + 1}`,
                    account_code: row[headerRow.indexOf('ACCOUNT_CODE')] || '',
                    account_name: row[headerRow.indexOf('ACCOUNT_NAME')] || '',
                    budget: row[headerRow.indexOf('BUDGET')] !== '' && row[headerRow.indexOf('BUDGET')] !== null
                        ? parseFloat(row[headerRow.indexOf('BUDGET')]) || 0
                        : 0,
                };
            });

            // Update your rowsAccounts with newAccounts accordingly
            setRowsAccounts(prevRows => {
                const updatedRows = [...prevRows];
                newAccounts.forEach(newAccount => {
                    const existingIndex = updatedRows.findIndex(r => r.account_code === newAccount.account_code);
                    if (existingIndex !== -1) {
                        updatedRows[existingIndex] = newAccount;
                    } else {
                        updatedRows.push(newAccount);
                    }
                });
                return updatedRows;
            });

            setImportError(''); // Clear error on success
        };

        reader.readAsBinaryString(file);
    };




    const handleExportCSV = () => {
        // Check if there's any data to export (i.e., if the table rows have data)
        const selectedAccounts = accountTypes.filter(account => formData.accountType.includes(account.code));
        // Check if there are any selected accounts to export
        if (selectedAccounts.length === 0) {
            alert("No accounts selected to export.");
            return;
        }

        // Transform data before export
        const exportData = selectedAccounts.map(account => {
            // Find existing budget data for this account
            const existingRow = rowsAccounts.find(r => r.account_code === account.code);
            const budgetValue = existingRow?.budget !== undefined ? existingRow.budget : 0;

            return {
                ACCOUNT_CODE: account.code || '',
                ACCOUNT_NAME: account.name || '',
                BUDGET: budgetValue.toString() || "0"

            };
        });

        console.log("Rows to export:", exportData);  // For debugging purposes

        // Create a worksheet from the mapped export data
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        // Create a new workbook and append the worksheet to it
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Account_Budget_Data");

        // Trigger the file download
        XLSX.writeFile(workbook, "RegularAccountBudget.xlsx");
    };


    // Handle file change from input
    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            handleImportCSV(e.target.files[0]);
        }
    };

    // Trigger file input
    const triggerFileInputs = () => {
        fileInputRefs.current.click();
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
        const confirmed = window.confirm('Are you sure you want to delete this row?');
        if (!confirmed) return;

        const { error } = await supabase
            .from('Regular_AccountLis_badget')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting row:', error);
            alert('Failed to delete row');
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
                newCodes = newCodes.filter(code => code !== cat.code);
                newNames = newNames.filter(name => name !== cat.name);
            }

            // Update rows based on codes
            setRows((prevRows) => {
                return newCodes.map(code => {
                    const existingRow = prevRows.find(row => row.SKUITEM === code);
                    return {
                        SKUITEM: code,
                        SRP: existingRow?.SRP || '',
                        QTY: existingRow?.QTY || '',
                        UOM: existingRow?.UOM || '',
                        DISCOUNT: existingRow?.DISCOUNT || '',
                        BILLING_AMOUNT: existingRow?.BILLING_AMOUNT || '',
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
                categoryCode: newCodes,    // This will be saved to DB
                categoryName: newNames,    // Only for display
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
            categoryCode: newCodes,  // Save codes to DB later
            categoryName: newNames,  // Display names only
        }));
    };


    const totalAllocatedBudget = rowsAccounts.reduce(
        (sum, row) => sum + (parseFloat(row.budget) || 0),
        0
    );


    const [remainingBalance, setRemainingBalance] = useState(null);
    const storedUser = localStorage.getItem('loggedInUser');
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const createdBy = parsedUser?.name || 'Unknown';

    useEffect(() => {
        const fetchRemainingBalance = async () => {
            if (formData.coverPwpCode && createdBy) {
                const { data, error } = await supabase
                    .from('amount_badget')
                    .select('remainingbalance')
                    .eq('pwp_code', formData.coverPwpCode)
                    .eq('createduser', createdBy)
                    .eq('Approved', true)
                    .order('createdate', { ascending: false })
                    .limit(1);

                if (error) {
                    console.error('Error fetching remaining balance:', error);
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

    const loggedInUsername = parsedUser?.name || 'Unknown';
    console.log('[DEBUG] Logged in user:', loggedInUsername);


    useEffect(() => {
        const fetchUserDistributors = async () => {
            const { data, error } = await supabase
                .from('user_distributors')
                .select('distributor_name')
                .eq('username', loggedInUsername);

            if (error) {
                console.error('[ERROR] Fetching user_distributors:', error);
            } else {
                const names = data.map((d) => d.distributor_name);
                console.log('[DEBUG] Distributors assigned to user:', names);
                setUserDistributors(names);
            }
        };

        fetchUserDistributors();
    }, [loggedInUsername]);

    useEffect(() => {
        const fetchDistributors = async () => {
            const { data, error } = await supabase
                .from('distributors')
                .select('*')
                .order('name', { ascending: true });

            if (error) {
                console.error('[ERROR] Fetching distributors:', error);
            } else {
                console.log('[DEBUG] All distributors from DB:', data);
                setDistributors(data);

                const allowed = data.filter((dist) =>
                    userDistributors.includes(dist.name)
                );
                console.log('[DEBUG] Filtered distributors for dropdown:', allowed);
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
                    .from('Single_Approval')
                    .select('*');

                if (error) throw error;
                setApprovalList(data);
            } catch (err) {
                console.error("❌ Error fetching approval list:", err.message);
                setApprovalList([]);
            }
        };

        fetchApprovalData();
    }, []);

    const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
    const role = currentUser?.role || "";



    const [categoryListing, setCategoryListing] = useState([]);
    const [activeCategoryCode, setActiveCategoryCode] = useState(null);


    useEffect(() => {
        const fetchCategoryListing = async () => {
            const { data, error } = await supabase
                .from('category_listing')
                .select('*')
                .order('category_code', { ascending: true });

            if (error) {
                console.error('Error fetching category listing:', error.message);
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
        setSearchTerm('');
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
            rowsCategories: [...prev.rowsCategories, { category: '', amount: '' }]
        }));
    };

    const handleCategoryRowChange = (index, field, value) => {
        const updatedRows = [...formData.rowsCategories];
        updatedRows[index][field] = value;
        setFormData((prev) => ({
            ...prev,
            rowsCategories: updatedRows
        }));
    };

    const handleDeleteCategoryRow = (index) => {
        const updatedRows = formData.rowsCategories.filter((_, i) => i !== index);
        setFormData((prev) => ({
            ...prev,
            rowsCategories: updatedRows
        }));
    };
    const calculateTotalAmount = () => {
        return formData.rowsCategories.reduce((total, row) => {
            const amount = parseFloat(row.amount);
            return total + (isNaN(amount) ? 0 : amount);
        }, 0);
    };
    const [selectedCategoryRowIndex, setSelectedCategoryRowIndex] = useState(null);
    const [BadOrderSearch, setBadOrderSearch] = useState('');
    const [badOrderCategoryList, setBadOrderCategoryList] = useState([]);
    const [categoryMode, setCategoryMode] = useState(null); // 'category' | 'subcategory' | null


    const handleSelectCategory = (cat) => {
        if (selectedCategoryRowIndex !== null) {
            const updatedRows = [...formData.rowsCategories];
            updatedRows[selectedCategoryRowIndex].category = `${cat.code} - ${cat.name}`;
            setFormData(prev => ({ ...prev, rowsCategories: updatedRows }));
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
                setCategoryMode('category');

                const { data, error } = await supabase
                    .from("category_listing")
                    .select("id, name, sku_code, category_code, description")
                    .order("name", { ascending: true });


                if (error) throw error;




                setBadOrderCategoryList(data || []);
            } else if (mapping.subcategory) {
                setCategoryMode('subcategory');

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
            console.error("❌ Error fetching categories/subcategories:", error.message);
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





    // 🔹 Utility function for safe number conversion
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
            const allRows = Object.keys(accountSkuRows).flatMap(accountCode =>
                (accountSkuRows[accountCode] || []).map(row => {
                    const account = accountTypes.find(acc => acc.code === accountCode);
                    return {
                        account_name: account?.name || accountCode,
                        sku_code: row.SKUITEM ?? null,
                        srp: toNumber(row.SRP),
                        qty: toNumber(row.QTY),
                        uom: row.UOM?.trim() ? row.UOM : "pc",
                        billing_amount: toNumber(row.BILLING_AMOUNT),
                        discount: toNumber(row.DISCOUNT),
                        total_amount: 0,         // placeholder
                        remaining_balance: 0,    // placeholder
                        regular_code: formData.regularpwpcode || generateRegularCode(allRegularPwpCodes),
                        created_at: new Date().toISOString()
                    };
                })
            );

            if (!allRows.length) {
                setMessage("⚠️ No SKUs to submit.");
                setLoading(false);
                return;
            }

            // Compute totals
            const totalBilling = allRows.reduce((sum, r) => sum + r.billing_amount, 0);
            const totalDiscount = allRows.reduce((sum, r) => sum + r.discount, 0);
            const grandTotal = totalBilling - totalDiscount;

            const selected = parseFloat(selectedBalance || 0);
            const creditBudget = parseFloat(formData?.amountbadget || 0);
            const remainingSkuBudget = selected - grandTotal - creditBudget;

            // Attach totals
            const rowsWithTotals = allRows.map(r => ({
                ...r,
                total_amount: grandTotal,
                remaining_balance: remainingSkuBudget
            }));

            const regularpwpcode = formData.regularpwpcode || generateRegularCode(allRegularPwpCodes);

            // ✅ Step 1: Insert SKUs into regular_sku
            const { error: insertError } = await supabase
                .from("regular_sku")
                .insert(rowsWithTotals);

            if (insertError) throw insertError;

            console.log("✅ Inserted SKUs:", rowsWithTotals);

            // ✅ Step 2: Upsert into regular_pwp
            // ✅ Step 2: Upsert into regular_pwp
            await upsertRegularPwp(
                supabase,
                regularpwpcode,
                remainingSkuBudget,
                grandTotal // <-- use grandTotal instead of creditBudget
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
        const rowsToInsert = formData.rowsCategories.map(row => ({
            code_pwp: formData.regularpwpcode,
            category: row.category,
            amount: parseFloat(row.amount) || 0,
            remarks: formData.remarks || '',
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
                title: 'Submitting...',
                html: 'Please wait while we save your data.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
                timer: 3000,
                timerProgressBar: true,
            });

            // Step 1: Save SKUs


            // Step 2: Save Form Data + Attachments
            console.log(`[${new Date().toLocaleString()}] 📝 Submitting form data...`);
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
            console.log(`[${new Date().toLocaleString()}] 💾 Saving budget data to Supabase...`);

            const filteredRows = rowsAccounts.filter(row =>
                formData.accountType.includes(row.account_code)
            );

            const totalBudget = filteredRows
                .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0)
                .toFixed(2);

            const budgetRowsToInsert = filteredRows.map(row => ({
                regularcode: formData.regularpwpcode,
                account_code: row.account_code,
                account_name: row.account_name, // ✅ Saving name properly
                budget: row.budget || 0,
                created_at: row.created_at || new Date().toISOString(),
                createform: 'ADMINISTRATOR',
                total_budget: totalBudget,
            }));

            if (budgetRowsToInsert.length > 0) {
                const { data, error } = await supabase
                    .from('regular_accountlis_badget')
                    .insert(budgetRowsToInsert);

                if (error) throw error;

                console.log(`[${new Date().toLocaleString()}] ✅ Budget data saved:`, data);
            } else {
                console.log(`[${new Date().toLocaleString()}] ℹ️ No budget rows to insert.`);
            }

            // Success Modal
            await Swal.fire({
                title: 'Success!',
                text: 'Your data has been successfully submitted and saved.',
                icon: 'success',
                confirmButtonText: 'Ok',
            });

            window.location.reload();
        } catch (error) {
            console.error(`[${new Date().toLocaleString()}] ❌ Submit All Error:`, error);
            Swal.fire({
                title: 'Error!',
                text: `There was an issue submitting your data: ${error.message}`,
                icon: 'error',
                confirmButtonText: 'Try Again',
            });
        }
    };




    const handleSubmitFormAndAttachments = async () => {
        try {
            const storedUser = localStorage.getItem("loggedInUser");
            const parsedUser = storedUser ? JSON.parse(storedUser) : null;
            const createdBy = parsedUser?.name || "Unknown";

            if (!formData.regularpwpcode || formData.regularpwpcode.trim() === "") {
                throw new Error("regularpwpcode is required.");
            }

            // Validate distributor
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

            // Prepare budget values
            const amountBudget = parseFloat(formData.amountbadget || 0);
            const billingAmountSKU = rows.reduce((acc, row) => {
                const val = parseFloat(row.BILLING_AMOUNT);
                return acc + (isNaN(val) ? 0 : val);
            }, 0);
            const totalAllocatedFromAccounts = rowsAccounts.reduce(
                (sum, row) => sum + (parseFloat(row.budget) || 0),
                0
            );

            // ✅ Use only one source for creditBudget
            let creditBudget = 0;
            if (amountBudget > 0) creditBudget = amountBudget;
            else if (billingAmountSKU > 0) creditBudget = billingAmountSKU;
            else if (totalAllocatedFromAccounts > 0) creditBudget = totalAllocatedFromAccounts;

            // Calculate remaining balance
            const remainingBalance =
                selectedBalance !== null ? selectedBalance - creditBudget : null;

            // ✅ Explicit submissionData (no activityName here)
            const submissionData = {
                regularpwpcode: formData.regularpwpcode,
                accountType: formData.accountType,
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
                categoryCode: formData.categoryCode,
                categoryName: formData.categoryName,
                sku: formData.sku,
                accounts: formData.accounts,
                amount_display: formData.amount_display,
                remarks: formData.remarks,
                created_at: new Date().toISOString(),
                createForm: createdBy,
                credit_budget: creditBudget,
                remaining_balance: remainingBalance,
            };

            // Insert form into Supabase
            const { data: formInsertData, error: formInsertError } = await supabase
                .from("regular_pwp")
                .insert([submissionData])
                .select();

            if (formInsertError) {
                throw new Error(`Form Insert failed: ${formInsertError.message}`);
            }

            // Insert attachments (if any)
            await Promise.all(
                files.map(async (file) => {
                    const { name, type, size } = file;

                    const attachmentPayload = {
                        regularpwpcode: formData.regularpwpcode,
                        filename: name,
                        mimetype: type,
                        size: size,
                    };

                    const { error: attachmentError } = await supabase
                        .from("regular_attachments")
                        .insert([attachmentPayload])
                        .select();

                    if (attachmentError) {
                        throw new Error(
                            `Attachment insert failed for ${name}: ${attachmentError.message}`
                        );
                    }
                })
            );

            // ✅ Reset everything after success
            setFiles([]);
            setRows([]);
            setRowsAccounts([]);
            setFormData({
                regularpwpcode: "",
                accountType: [],
                categoryCode: [],
                categoryName: [],
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
                categoryCode: "",
                sku: null,
                accounts: null,
                amount_display: null,
            });

            console.log("✅ Form submitted successfully");
        } catch (error) {
            console.error("Submission Error:", error.message);
            alert(error.message);
        }
    };








    const saveRecentActivity = async ({ UserId }) => {
        try {
            // 1. Get public IP
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const { ip } = await ipRes.json();

            // 2. Get geolocation info
            const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
            const geo = await geoRes.json();

            // 3. Build activity entry
            const activity = {
                Device: navigator.userAgent || 'Unknown Device',
                Location: `${geo.city || 'Unknown'}, ${geo.region || 'Unknown'}, ${geo.country_name || 'Unknown'}`,
                IP: ip,
                Time: new Date().toISOString(),
                Action: 'Create Form Regular PWP',
            };

            // 4. Save to Supabase only
            const { error } = await supabase
                .from('RecentActivity')
                .insert([{
                    userId: UserId,
                    device: activity.Device,
                    location: activity.Location,
                    ip: activity.IP,
                    time: activity.Time,
                    action: activity.Action
                }]);

            if (error) {
                console.error('❌ Supabase insert error:', error.message);
            } else {
                console.log('✅ Activity saved to Supabase');
            }

        } catch (err) {
            console.error('❌ Failed to log activity:', err.message || err);
        }
    };

    const [message, setMessage] = useState("");

    const renderStepContent = () => {
        switch (step) {
            case 0:
                return (
                    // ...inside the Step 0 case in renderStepContent function:

                    <div >
                        <form onSubmit={submit_all}>

                            <div style={{ padding: '30px', overflowX: 'auto' }} className="containers">
                                <div className="row align-items-center mb-4">

                                    <div className="col-12 col-md-6">
                                        <div
                                            className="card p-4 animate-fade-slide-up shadow-sm"
                                            style={{
                                                background: 'linear-gradient(135deg,rgb(11, 48, 168), #d9edf7)', // gentle blue gradient
                                                borderRadius: '12px',
                                                border: '1px solid #99cfff',
                                                color: '#ffff',
                                                boxShadow: '0 4px 8px rgba(26, 62, 114, 0.15)',
                                            }}
                                        >
                                            <h3
                                                className="mb-0"
                                                style={{
                                                    fontWeight: '700',
                                                    letterSpacing: '2px',
                                                    textTransform: 'uppercase',
                                                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                                    textShadow: '1px 1px 2px rgba(26, 62, 114, 0.3)',
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
                                                letterSpacing: '1px',
                                                fontSize: '24px',
                                                textAlign: 'right',
                                                color: 'red', // This ensures the whole <h2> is red
                                            }}
                                        >
                                            <span className={formData.regularpwpcode ? 'text-danger' : 'text-muted'}>
                                                {loadingRegularPwpCodes
                                                    ? 'Generating...'
                                                    : formData.regularpwpcode || generateRegularCode(allRegularPwpCodes)}
                                            </span>
                                        </h2>


                                    </div>
                                </div>
                            </div>
                            <div className="row g-3">


                                {/* Distributor */}
                                <div className="col-md-4" style={{ position: 'relative' }}>
                                    <label>Distributor<span style={{ color: 'red' }}>*</span></label>

                                    <select
                                        name="distributor"
                                        className="form-control"
                                        value={formData.distributor}
                                        onChange={handleFormChange}
                                        style={{
                                            paddingRight: '30px',
                                            borderColor: formData.distributor ? 'green' : '',
                                            transition: 'border-color 0.3s',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (formData.distributor) e.currentTarget.style.borderColor = 'green';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (formData.distributor) e.currentTarget.style.borderColor = 'green';
                                            else e.currentTarget.style.borderColor = '';
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
                                            position: 'absolute',
                                            right: '20px',
                                            top: '70%',
                                            transform: 'translateY(-50%)',
                                            pointerEvents: 'none',
                                            color: '#555',
                                            fontSize: '14px',
                                            userSelect: 'none',
                                        }}
                                    >
                                        ▼
                                    </span>
                                    {formData.distributor && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                right: '40px',
                                                top: '50%',
                                                transform: 'translateY(-20%)',
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
                                </div>
                                {/* // ============================
                                // Activity + Amount Budget
                                // ============================ */}

                                {/* Activity */}
                                <div className="col-md-4" style={{ position: 'relative' }}>
                                    <label>Activity <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        name="activity"
                                        className="form-control"
                                        value={formData.activity}
                                        onChange={handleFormChange}
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
                                            top: '70%',
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
                                    {formData.activity && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                right: '40px',
                                                top: '55%',
                                                transform: 'translateY(-20%)',
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
                                </div>


                                {shouldShowCategory() && (

                                    <div className="col-md-4" style={{ position: 'relative' }}>
                                        <label>
                                            Category <span style={{ color: 'red' }}>*</span>
                                        </label>

                                        <input
                                            type="text"
                                            readOnly
                                            className="form-control"
                                            value={formData.categoryName?.join(', ') || ''}
                                            onClick={handleInputClick}
                                            placeholder="Select Categories"
                                            style={{
                                                borderColor: formData.categoryName?.length > 0 ? 'green' : '',
                                                transition: 'border-color 0.3s',
                                                paddingRight: '35px',
                                                cursor: 'pointer',
                                            }}
                                        />


                                        {/* Magnifying Glass Icon */}
                                        <span
                                            style={{
                                                position: 'absolute',
                                                right: '10px',
                                                top: '70%',
                                                transform: 'translateY(-50%)',
                                                pointerEvents: 'none',
                                                color: '#555',
                                                fontSize: '18px',
                                                userSelect: 'none',
                                            }}
                                        >
                                            🔍
                                        </span>

                                        {/* Checkmark if selected */}
                                        {formData.categoryName?.length > 0 && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    right: '35px',
                                                    top: '50%',
                                                    transform: 'translateY(-20%)',
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

                                        {/* Modal */}
                                        <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>


                                            <Modal.Header
                                                closeButton
                                                style={{ background: "rgb(70, 137, 166)", color: "white" }}
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
                                                    <ul className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
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
                                                                                onChange={(e) => handleCategoryChange(cat, e.target.checked)}
                                                                                style={{
                                                                                    width: "20px",   // default is ~16px, increase this
                                                                                    height: "20px",
                                                                                    transform: "scale(1.3)", // alternative way to make it bigger
                                                                                    cursor: "pointer",

                                                                                }}

                                                                            />
                                                                            <label className="form-check-label" htmlFor={`cat-check-${cat.id}`}>
                                                                                <strong>{cat.code}</strong> - {cat.name}
                                                                            </label>
                                                                        </div>
                                                                    </li>
                                                                );
                                                            })
                                                        ) : (
                                                            <li className="list-group-item text-muted">No categories found</li>
                                                        )}
                                                    </ul>
                                                )}
                                            </Modal.Body>
                                            <Modal.Footer>
                                                <button className="btn btn-secondary" onClick={handleCloseModal}>
                                                    Close
                                                </button>
                                            </Modal.Footer>
                                        </Modal>
                                    </div>
                                )}


                       
                                {/* Account Type */}

                                <div className="col-md-4" style={{ position: "relative" }}>
                                    <label>
                                        Account <span style={{ color: "red" }}>*</span>
                                    </label>

                                    <div
                                        className="form-control"
                                        onClick={() => setShowModal_Account(true)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        {formData.accountType.length ? getAccountNames() : "Select Account Type"}

                                        <span
                                            style={{
                                                position: "absolute",
                                                right: "40px",
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

                                        <span
                                            style={{
                                                position: "absolute",
                                                right: "10px",
                                                top: "70%",
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


                                    {/* Modal with checkboxes */}
                                    <Modal
                                        show={showModal_Account}
                                        onHide={() => setShowModal_Account(false)}
                                        centered
                                        size="lg"  // <-- Add this
                                    >
                                        <Modal.Header
                                            closeButton
                                            style={{ background: "rgb(70, 137, 166)", color: "white" }}
                                        >
                                            <Modal.Title style={{ width: "100%", textAlign: "center" }}>
                                                Select Account Type
                                            </Modal.Title>
                                        </Modal.Header>

                                        <Modal.Body
                                            style={{
                                                maxHeight: "400px",
                                                display: "flex",
                                                flexDirection: "column",
                                                padding: "1rem",
                                            }}
                                        >   <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                                                Debug: accountTypes.length = {accountTypes.length}
                                                {accountTypes.length > 0 && (
                                                    <div>Sample: {accountTypes[0]?.code} - {accountTypes[0]?.name}</div>
                                                )}
                                            </div>
                                            {/* Search Bar - fixed height, no scroll */}
                                            <input
                                                type="text"
                                                className="form-control mb-3"
                                                placeholder="Search account types..."
                                                value={accountSearchTerm}
                                                onChange={(e) => setAccountSearchTerm(e.target.value)}
                                                style={{
                                                    borderColor: "#007bff",
                                                    flexShrink: 0,
                                                }}
                                            />

                                            {/* Scrollable list container */}
                                            <div
                                                style={{
                                                    overflowY: "auto",
                                                    flexGrow: 1,
                                                }}
                                            >
                                                {accountTypes
                                                    .filter((opt) =>
                                                        opt.name.toLowerCase().includes(accountSearchTerm.toLowerCase())
                                                    )
                                                    .map((opt) => (
                                                        <div
                                                            key={opt.code}
                                                            style={{ display: "flex", alignItems: "center", padding: "6px 0", marginLeft: '10px' }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.accountType.includes(opt.code)}
                                                                onChange={() => toggleAccountType(opt.code)}
                                                                id={`accountType-${opt.code}`}
                                                                style={{
                                                                    width: "20px",   // default is ~16px, increase this
                                                                    height: "20px",
                                                                    transform: "scale(1.3)", // alternative way to make it bigger
                                                                    cursor: "pointer",
                                                                }}
                                                            />

                                                            <label
                                                                htmlFor={`accountType-${opt.code}`}
                                                                style={{ marginLeft: "8px", cursor: "pointer" }}
                                                            >
                                                                {opt.name}
                                                            </label>
                                                        </div>
                                                    ))}
                                            </div>
                                        </Modal.Body>


                                        <Modal.Footer>
                                            <Button variant="light" onClick={() => setShowModal_Account(false)}>
                                                Close
                                            </Button>
                                        </Modal.Footer>
                                    </Modal>

                                    {/* Submit Button */}
                                </div>
                                {/* Marketing Type */}
                                <div className="col-md-4" style={{ position: 'relative' }}>
                                    <label>Marketing Type</label>
                                    <select
                                        name="visaType"
                                        className="form-control"
                                        value={formData.visaType}
                                        disabled
                                        style={{
                                            paddingRight: '30px',
                                            borderColor: borderColor,
                                            transition: 'border-color 0.3s',
                                        }}
                                    >
                                        <option value="REGULAR">REGULAR</option>
                                    </select>

                                    {formData.visaType && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                right: '20px',
                                                top: '50%',
                                                transform: 'translateY(-20%)',
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
                                </div>

                                {/* Amount Budget (conditionally shown or empty placeholder) */}
                                {formData.activity && settingsMap[formData.activity]?.amount_display ? (

                                    <div className="col-md-4" style={{ position: 'relative' }}>
                                        <label className="form-label">
                                            Amount Budget <span style={{ color: 'red' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="amountbadget"
                                            className="form-control"
                                            value={rawAmount}
                                            onChange={handleAmountChange}
                                            style={{ paddingRight: '30px', position: 'relative', top: '-8px', marginTop: 0 }}
                                        />
                                        {formData.amountbadget !== '' && (
                                            <span style={{
                                                position: 'absolute',
                                                right: '20px',
                                                top: '50%',
                                                transform: 'translateY(-20%)',
                                                color: 'green',
                                                fontWeight: 'bold',
                                                fontSize: '25px',
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            }}>
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
                                    <div className="col-md-6" style={{ position: 'relative' }}>
                                        <label>Objective</label>
                                        <textarea
                                            name="objective"
                                            className="form-control"
                                            value={formData.objective}
                                            onChange={handleFormChange}
                                            style={{
                                                paddingRight: '30px',
                                                borderColor: formData.objective ? 'green' : '',
                                                transition: 'border-color 0.3s',
                                                resize: 'vertical',
                                            }}
                                        />
                                        {formData.objective && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    right: '20px',
                                                    top: '50%',
                                                    transform: 'translateY(-20%)',
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
                                    </div>

                                    {/* Promo Scheme - Right Side */}
                                    <div className="col-md-6" style={{ position: 'relative' }}>
                                        <label>Promo Scheme</label>
                                        <textarea
                                            name="promoScheme"
                                            className="form-control"
                                            value={formData.promoScheme}
                                            onChange={handleFormChange}
                                            style={{
                                                paddingRight: '30px',
                                                borderColor: formData.promoScheme ? 'green' : '',
                                                transition: 'border-color 0.3s',
                                                resize: 'vertical',
                                            }}
                                        />
                                        {formData.promoScheme && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    right: '20px',
                                                    top: '50%',
                                                    transform: 'translateY(-20%)',
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
                                        <div className="col-md-3" style={{ position: 'relative' }}>
                                            <label htmlFor="activityDurationFrom" className="form-label">Activity Duration From</label>
                                            <input
                                                type="date"
                                                id="activityDurationFrom"
                                                name="activityDurationFrom"
                                                className="form-control"
                                                value={formData.activityDurationFrom}
                                                onChange={handleFormChange}
                                                style={{ paddingRight: '35px' }}
                                            />
                                            {formData.activityDurationFrom && (
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        right: '20px',
                                                        top: '55%',
                                                        transform: 'translateY(-20%)',
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
                                        </div>

                                        {/* Activity Duration To */}
                                        <div className="col-md-3" style={{ position: 'relative' }}>
                                            <label htmlFor="activityDurationTo" className="form-label">Activity Duration To</label>
                                            <input
                                                type="date"
                                                id="activityDurationTo"
                                                name="activityDurationTo"
                                                className="form-control"
                                                value={formData.activityDurationTo}
                                                onChange={handleFormChange}
                                                style={{ paddingRight: '35px' }}
                                            />
                                            {formData.activityDurationTo && (
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        right: '20px',
                                                        top: '55%',
                                                        transform: 'translateY(-20%)',
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
                                <div className="card-header">IS PART OF BUDGET?</div>

                                <div className="toggle-group mb-3" role="group" aria-label="Cover PWP Toggle">
                                    <input
                                        type="radio"
                                        id="coverYes"
                                        name="isPartOfCoverPwp"
                                        className="toggle-checkbox"
                                        checked={formData.isPartOfCoverPwp === true}
                                        onChange={() => {
                                            setFormData(prev => ({ ...prev, isPartOfCoverPwp: true, coverPwpCode: '' }));
                                            setShowCoverModal(false);
                                        }}
                                    />
                                    <label htmlFor="coverYes" className="toggle-label">YES</label>

                                    <input
                                        type="radio"
                                        id="coverNo"
                                        name="isPartOfCoverPwp"
                                        className="toggle-checkbox"
                                        checked={formData.isPartOfCoverPwp === false}
                                        onChange={() => {
                                            setFormData(prev => ({ ...prev, isPartOfCoverPwp: false, coverPwpCode: '' }));
                                            setShowCoverModal(false);
                                        }}
                                    />
                                    <label htmlFor="coverNo" className="toggle-label">NO</label>
                                </div>
                                {formData.isPartOfCoverPwp && (
                                    <div className="d-flex justify-content-between align-items-start" style={{ gap: '1rem', marginTop: '30px' }}>
                                        {/* Left: Cover PWP Code Input */}
                                        <div className="flex-grow-1" style={{ maxWidth: '22rem' }}>
                                            <label className="form-label text-uppercase">Cover PWP Code</label>
                                            <input
                                                type="text"
                                                readOnly
                                                className="form-control"
                                                value={formData.coverPwpCode || ''}
                                                placeholder="Select Cover PWP Code"
                                                onClick={() => setShowCoverModal(true)}
                                                style={{
                                                    cursor: 'pointer',
                                                    paddingRight: '40px',
                                                    borderColor: formData.coverPwpCode ? 'green' : '',
                                                    transition: 'border-color 0.3s',
                                                }}
                                            />
                                            {formData.coverPwpCode && (
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        right: '40px',
                                                        top: '38px',
                                                        color: 'green',
                                                        fontWeight: 'bold',
                                                        fontSize: '25px',
                                                        pointerEvents: 'none',
                                                    }}
                                                >
                                                    ✓
                                                </span>
                                            )}
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    right: '15px',
                                                    top: '40px',
                                                    color: '#555',
                                                    fontSize: '16px',
                                                    pointerEvents: 'none',
                                                }}
                                            >
                                                🔍
                                            </span>
                                        </div>

                                        {/* Right: Remaining Budget Card */}
                                        {formData.coverPwpCode && selectedBalance !== null && (
                                            <div
                                                className="card shadow-sm mb-3"
                                                style={{
                                                    width: '52rem',
                                                    borderRadius: '12px',
                                                    border: '1px solid #e0e0e0',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#f8f9fa',
                                                }}
                                            >
                                                {/* Header */}
                                                <div
                                                    className="card-header text-white fw-bold text-center"
                                                    style={{
                                                        background: 'linear-gradient(90deg, #28a745, #218838)',
                                                        fontSize: '1.3rem',
                                                        letterSpacing: '1px',
                                                    }}
                                                >
                                                    🎯 Remaining Budget
                                                </div>

                                                {/* Body */}
                                                <div className="card-body text-center">
                                                    <p
                                                        className="card-text mb-2"
                                                        style={{
                                                            fontSize: '2.5rem',
                                                            fontWeight: 'bold',
                                                            color:
                                                                selectedBalance - totals.BILLING_AMOUNT - parseFloat(formData.amountbadget || 0) < 0
                                                                    ? '#dc3545'
                                                                    : '#198754',
                                                            marginBottom: '0.5rem',
                                                        }}
                                                    >
                                                        ₱{(
                                                            selectedBalance -
                                                            totals.BILLING_AMOUNT -
                                                            parseFloat(formData.amountbadget || 0)
                                                        ).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>

                                                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '1rem' }}>
                                                        <div>
                                                            <small className="text-muted d-block fw-bold">Original</small>
                                                            <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>
                                                                ₱{selectedBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <small className="text-muted d-block fw-bold">Allocated (Form)</small>
                                                            <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>
                                                                ₱{parseFloat(formData.amountbadget || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Footer / optional */}
                                                <div
                                                    className="card-footer text-center text-muted"
                                                    style={{ fontSize: '0.9rem', backgroundColor: '#e9ecef' }}
                                                >
                                                    Keep track of your remaining budget to avoid overspending
                                                </div>
                                            </div>

                                        )}
                                    </div>
                                )}



                                {/* Modal */}
                                <Modal show={showCoverModal} onHide={() => setShowCoverModal(false)} centered>
                                    <Modal.Header
                                        closeButton
                                        style={{ background: 'linear-gradient(to right, #0d6efd, #6610f2)', color: 'white' }}
                                    >
                                        <Modal.Title style={{ color: 'white' }} className="w-100 text-center">
                                            🎫 Select COVER PWP Code
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
                                            {coverPwpWithStatus
                                                .filter(cp => cp.pwp_code && typeof cp.pwp_code === 'string' && cp.pwp_code.toLowerCase().includes(coverPwpSearch.toLowerCase()))
                                                .filter(cp => {
                                                    // Show if admin
                                                    if (role === 'admin') return true;

                                                    // Otherwise only show if createForm matches current user name
                                                    return cp.createForm?.toLowerCase().trim() === currentUserName;
                                                })
                                                .map((cp, idx) => {
                                                    const isPending = !cp.Approved;
                                                    return (
                                                        <li
                                                            key={idx}
                                                            onClick={() => {
                                                                if (isPending) return;
                                                                setFormData(prev => ({ ...prev, coverPwpCode: cp.pwp_code }));
                                                                setSelectedBalance(cp.remainingbalance);
                                                                setShowCoverModal(false);
                                                            }}
                                                            className={`list-group-item d-flex justify-content-between align-items-center ${isPending ? 'disabled' : 'list-group-item-action'}`}
                                                            title={isPending ? 'Pending: Not Approved' : ''}
                                                            style={{
                                                                backgroundColor: isPending ? 'yellow' : 'inherit',
                                                                color: isPending ? '#555' : 'inherit',
                                                                cursor: isPending ? 'not-allowed' : 'pointer',
                                                                fontFamily: 'monospace',
                                                                opacity: isPending ? 0.8 : 1,
                                                                pointerEvents: isPending ? 'none' : 'auto',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                            }}
                                                            tabIndex={isPending ? -1 : 0}
                                                        >
                                                            <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {cp.pwp_code?.toUpperCase()}
                                                            </div>
                                                            <div style={{ marginLeft: '10px', minWidth: '100px', textAlign: 'right', fontWeight: 'bold' }}>
                                                                {cp.remainingbalance !== null
                                                                    ? cp.remainingbalance.toLocaleString('en-US', {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2,
                                                                    })
                                                                    : "-"}
                                                            </div>

                                                        </li>
                                                    );
                                                })}

                                            {coverPwpWithStatus.filter(cp => cp.pwp_code && cp.pwp_code.toLowerCase().includes(coverPwpSearch.toLowerCase())).length === 0 && (
                                                <li className="list-group-item text-muted">No codes found</li>
                                            )}
                                        </ul>
                                    </Modal.Body>



                                    <Modal.Footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                            <div
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '2px solid yellow',
                                                    borderRadius: '6px',
                                                    padding: '8px',
                                                    marginRight: '8px',
                                                    width: '40px',
                                                    height: '40px',
                                                    boxSizing: 'border-box',
                                                    backgroundColor: '#222'
                                                }}
                                            >
                                                <FaExclamationTriangle style={{ color: 'yellow', fontSize: '24px' }} />
                                            </div>
                                            <span style={{ fontWeight: 'bold' }}>Yellow = Pending</span>
                                        </div>

                                        <Button variant="secondary" onClick={() => setShowCoverModal(false)}>
                                            Close
                                        </Button>
                                    </Modal.Footer>
                                </Modal>

                            </div>






                            <div style={{ textAlign: 'right' }}>

                                <button
                                    type="button"
                                    className="btn btn-primary mt-3"
                                    onClick={() => {
                                        const setting = settingsMap[formData.activity];

                                        console.log('▶️ Next pressed. formData.activity:', formData.activity, 'setting:', setting);

                                        if (formData.activityName === "BAD ORDER") {
                                            // Special logic for BAD ORDER
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
                                    style={{ width: '85px' }}
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
                            {formData.isPartOfCoverPwp && formData.coverPwpCode && selectedBalance !== null && (
                                <div className="d-flex justify-content-between align-items-start" style={{ gap: '1rem' }}>
                                    {/* Drag & Drop for Import */}
                                    <div
                                        className="border rounded p-3 mb-3"
                                        style={{
                                            borderStyle: 'dashed',
                                            backgroundColor: '#f9f9f9',
                                            position: 'relative',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            flex: '1',
                                            maxWidth: '80%',
                                            minWidth: '300px',
                                            height: '165px'
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const file = e.dataTransfer.files[0];
                                            handleFileImport(file);
                                        }}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <div style={{
                                            marginTop: '50px',
                                            color: '#888',
                                            fontSize: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '15px',
                                            fontWeight: '500',
                                        }}>
                                            <FaCloudUploadAlt size={20} />
                                            <span>Or drag and drop your Excel file here</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={(e) => handleFileImport(e.target.files[0])}
                                            ref={(ref) => (window.excelInput = ref)}
                                            style={{ display: 'none' }}
                                        />
                                    </div>

                                    {/* Remaining Budget Card */}
                                    <div className="card border-success mb-3 shadow" style={{ width: '22rem' }}>
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
                                                                fontSize: '2rem',
                                                                fontWeight: 'bold',
                                                                color: remainingSkuBudget < 0 ? '#dc3545' : '#198754',
                                                            }}
                                                        >
                                                            ₱{remainingSkuBudget.toLocaleString('en-PH', {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            })}
                                                        </p>
                                                        <small className="text-muted">
                                                            Total Budget: ₱{selected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                            − SKU Net: ₱{netTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                        </small>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
                                <h4 className="mb-0">💼 Account-based SKU Listing</h4>
                                <div className="d-flex gap-2 align-items-center">
                                    <Button variant="success" onClick={triggerFileInput} className="d-flex align-items-center">
                                        <FaFileExcel className="me-2" /> Import Excel
                                    </Button>
                                    <Button style={{ backgroundColor: 'gray' }} variant="primary" onClick={handleExport} className="d-flex align-items-center">
                                        <FaDownload className="me-2" /> Export Excel
                                    </Button>
                                </div>
                            </Card.Header>

                            <Card.Body>
                                {/* Account Selection Dropdown */}
                                <div className="mb-3">
                                    <label className="form-label">Select Account for SKU Entry:</label>
                                    <select
                                        className="form-control"
                                        value={selectedAccountForSku}
                                        onChange={(e) => handleAccountSkuChange(e.target.value)}
                                        style={{ maxWidth: '400px' }}
                                    >
                                        <option value="">Select an account...</option>
                                        <option
                                            value="ALL_ACCOUNTS"
                                            style={{ fontWeight: 'bold', backgroundColor: '#e7f3ff' }}
                                        >
                                            🔍 View All Accounts
                                        </option>
                                        {accountTypes
                                            .filter(account => formData.accountType.includes(account.code))
                                            .map(account => (
                                                <option key={account.code} value={account.code}>
                                                    {account.code} - {account.name}
                                                </option>
                                            ))
                                        }
                                    </select>

                                </div>


                                {/* SKU Table for Selected Account */}
                                {/* SKU Table for Selected Account or All Accounts */}
                                {selectedAccountForSku === 'ALL_ACCOUNTS' ? (
                                    // Show all accounts view
                                    <div>
                                        <h5 className="mb-4">All Accounts SKU Listing Overview</h5>

                                        {accountTypes
                                            .filter(account => formData.accountType.includes(account.code))
                                            .map(account => {
                                                const accountRows = accountSkuRows[account.name] || [];
                                                const accountTotals = calculateAccountSkuTotals(account.code);

                                                return (
                                                    <div key={account.code} className="mb-4">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <h6 className="mb-0">
                                                                <span className="badge bg-info me-2">{account.code}</span>
                                                                {account.name}
                                                            </h6>
                                                            <div className="d-flex gap-2">
                                                                <Button
                                                                    variant="outline-primary"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedAccountForSku(account.code);
                                                                        addSkuRowForAccount(account.code);  // Add a new empty row automatically
                                                                    }}
                                                                >
                                                                    Edit This Account
                                                                </Button>


                                                                <Button
                                                                    variant="success"
                                                                    size="sm"
                                                                    onClick={() => addSkuRowForAccount(account.code)}
                                                                >
                                                                    Add SKU
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {accountRows.length > 0 ? (
                                                            <div style={{ overflowX: 'auto' }} className="mb-3">
                                                                <Table bordered hover size="sm" className="align-middle text-center">
                                                                    <thead className="table-light">
                                                                        <tr>
                                                                            <th>SKU</th>
                                                                            <th>SRP</th>
                                                                            <th>QTY</th>
                                                                            <th>UOM</th>
                                                                            <th>Billing Amount</th>
                                                                            <th>Discount</th>
                                                                            <th>Total Amount</th>
                                                                            <th>Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {accountRows
                                                                            .filter(row => row.accountCode === selectedAccountForSku)  // filter rows by selected account
                                                                            .map((row, idx) => (
                                                                                <tr key={`${row.accountCode}-${idx}`}>
                                                                                    <td style={{ minWidth: '200px' }}>
                                                                                        <small>
                                                                                            {categoryListing.find(sku => sku.category_code === row.SKUITEM)
                                                                                                ? `${row.SKUITEM} - ${categoryListing.find(sku => sku.category_code === row.SKUITEM)?.name}`
                                                                                                : row.SKUITEM || 'Not selected'
                                                                                            }
                                                                                        </small>
                                                                                    </td>
                                                                                    <td>{row.SRP || '-'}</td>
                                                                                    <td>{row.QTY || '-'}</td>
                                                                                    <td>{row.UOM || '-'}</td>
                                                                                    <td>{row.BILLING_AMOUNT || '-'}</td>
                                                                                    <td>{row.DISCOUNT || '-'}</td>
                                                                                    <td><strong>{row.TOTAL_AMOUNT || '-'}</strong></td>
                                                                                    <td>
                                                                                        <Button
                                                                                            variant="outline-danger"
                                                                                            size="sm"
                                                                                            onClick={() => removeSkuRowForAccount(row.accountCode, idx)}
                                                                                        >
                                                                                            ×
                                                                                        </Button>
                                                                                    </td>
                                                                                </tr>
                                                                            ))
                                                                        }
                                                                    </tbody>

                                                                    <tfoot className="table-info">
                                                                        <tr>
                                                                            <td><strong>Account Total</strong></td>
                                                                            <td><strong>{accountTotals.SRP.toFixed(2)}</strong></td>
                                                                            <td><strong>{accountTotals.QTY}</strong></td>
                                                                            <td>
                                                                                {UOM_OPTIONS.map(opt => (
                                                                                    <div key={opt} style={{ fontSize: '0.7rem' }}>
                                                                                        {opt}: {accountTotals.UOMCount[opt] || 0}
                                                                                    </div>
                                                                                ))}
                                                                            </td>
                                                                            <td><strong>{accountTotals.BILLING_AMOUNT.toFixed(2)}</strong></td>
                                                                            <td><strong>{accountTotals.DISCOUNT.toFixed(2)}</strong></td>
                                                                            <td><strong className="text-success">{accountTotals.TOTAL_AMOUNT.toFixed(2)}</strong></td>
                                                                            <td>-</td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </Table>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center p-3 bg-light rounded">
                                                                <small className="text-muted"> SKU entries for this account</small>
                                                            </div>
                                                        )}
                                                        <hr />
                                                    </div>
                                                );
                                            })
                                        }
                                        {/* Grand Total Section */}
                                        {(() => {
                                            const grandTotals = calculateGrandTotals();
                                            return (
                                                <div className="mt-4 p-4 bg-white rounded shadow-lg border">
                                                    <h4 className="text-center mb-4">📊 Grand Total Summary</h4>

                                                    <div className="row text-center">
                                                        {/* Total QTY */}
                                                        <div className="col-md-2 mb-3">
                                                            <div className="p-3 border rounded bg-light">
                                                                <strong>Total QTY</strong>
                                                                <p className="text-primary h4 mt-2">{grandTotals.QTY}</p>
                                                            </div>
                                                        </div>

                                                        {/* UOM Count */}
                                                        <div className="col-md-3 mb-3">
                                                            <div className="p-3 border rounded bg-light">
                                                                <strong>UOM Breakdown</strong>
                                                                <div
                                                                    className="mt-2 text-muted d-flex flex-wrap justify-content-center gap-3"
                                                                    style={{ fontSize: "0.9rem" }}
                                                                >
                                                                    {UOM_OPTIONS.map(opt => (
                                                                        <div key={opt}>
                                                                            {opt}: <span className="fw-bold">{grandTotals.UOMCount[opt] || 0}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>


                                                        </div>

                                                        {/* Total Billing Amount */}
                                                        <div className="col-md-2 mb-3">
                                                            <div className="p-3 border rounded bg-light">
                                                                <strong>Total Billing</strong>
                                                                <p className="text-success h4 mt-2">
                                                                    ₱{grandTotals.BILLING_AMOUNT.toFixed(2)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Total Discount */}
                                                        <div className="col-md-2 mb-3">
                                                            <div className="p-3 border rounded bg-light">
                                                                <strong>Total Discount</strong>
                                                                <p className="text-warning h5 mt-2">
                                                                    ₱{grandTotals.DISCOUNT.toFixed(2)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Grand Total */}
                                                        <div className="col-md-3 mb-3">
                                                            <div className="p-3 border rounded bg-light">
                                                                <strong>Grand Total</strong>
                                                                <p className="text-danger h3 mt-2">
                                                                    ₱{(grandTotals.BILLING_AMOUNT - grandTotals.DISCOUNT).toFixed(2)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Remaining Budget */}
                                                    <div className="card mt-4 border-0 shadow-sm">
                                                        <div className="card-body text-center">
                                                            {(() => {
                                                                const grandTotals = calculateGrandTotals();
                                                                const selected = parseFloat(selectedBalance || 0);
                                                                const creditBudget = parseFloat(formData?.amountbadget || 0);
                                                                const netTotal = grandTotals.BILLING_AMOUNT - grandTotals.DISCOUNT;
                                                                const remainingSkuBudget = selected - netTotal - creditBudget;

                                                                return (
                                                                    <div>
                                                                        <h5 className="mb-2">💰 Remaining SKU Budget</h5>
                                                                        <p
                                                                            className="fw-bold"
                                                                            style={{
                                                                                fontSize: "2rem",
                                                                                color: remainingSkuBudget < 0 ? "#dc3545" : "#198754",
                                                                            }}
                                                                        >
                                                                            ₱{remainingSkuBudget.toLocaleString("en-PH", {
                                                                                minimumFractionDigits: 2,
                                                                                maximumFractionDigits: 2,
                                                                            })}
                                                                        </p>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>

                                            );
                                        })()}
                                    </div>
                                ) : selectedAccountForSku && selectedAccountForSku !== '' ? (
                                    // Show single account edit view (your existing code)
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h5>SKU Listing for: {
                                                accountTypes.find(acc => acc.code === selectedAccountForSku)?.name || selectedAccountForSku
                                            }</h5>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => addSkuRowForAccount(selectedAccountForSku)}
                                            >
                                                Add SKU Row
                                            </Button>
                                        </div>

                                        <div style={{ overflowX: 'auto' }}>
                                            <Table bordered hover responsive className="align-middle text-center">
                                                <thead className="bg-primary text-white">
                                                    <tr>
                                                        <th>SKU</th>
                                                        <th>SRP</th>
                                                        <th>QTY</th>
                                                        <th>UOM</th>
                                                        <th>BILLING AMOUNT</th>
                                                        <th>DISCOUNT</th>
                                                        <th>TOTAL AMOUNT</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(accountSkuRows[selectedAccountForSku] || []).map((row, idx) => (
                                                        <tr key={`${selectedAccountForSku}-${idx}`}>
                                                            <td style={{ display: 'flex', alignItems: 'center' }}>
                                                                <Form.Control
                                                                    value={
                                                                        categoryListing.find(sku => sku.sku_code === row.SKUITEM)
                                                                            ? `${row.SKUITEM} - ${categoryListing.find(sku => sku.sku_code === row.SKUITEM)?.name}`
                                                                            : row.SKUITEM || ''
                                                                    }
                                                                    onChange={e =>
                                                                        handleChangeSkuForAccount(
                                                                            selectedAccountForSku,
                                                                            idx,
                                                                            'SKUITEM',
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    readOnly
                                                                />

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedRowIndex(idx);
                                                                        setShowSkuModal(true);
                                                                    }}
                                                                    style={{
                                                                        border: "none",
                                                                        background: "none",
                                                                        cursor: "pointer",
                                                                        padding: "8px",
                                                                        marginLeft: "8px",
                                                                    }}
                                                                >
                                                                    <FaSearch style={{ color: "blue", fontSize: "20px" }} />
                                                                </button>
                                                            </td>
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={row.SRP || ''}
                                                                    onChange={e => handleChangeSkuForAccount(selectedAccountForSku, idx, 'SRP', e.target.value)}
                                                                />
                                                            </td>
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    value={row.QTY || ''}
                                                                    onChange={e => handleChangeSkuForAccount(selectedAccountForSku, idx, 'QTY', e.target.value)}
                                                                />
                                                            </td>
                                                            <td>
                                                                <Form.Select
                                                                    value={row.UOM || ''}
                                                                    onChange={e => handleChangeSkuForAccount(selectedAccountForSku, idx, 'UOM', e.target.value)}
                                                                >
                                                                    {UOM_OPTIONS.map(opt => (
                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </Form.Select>
                                                            </td>
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={row.BILLING_AMOUNT || ''}
                                                                    readOnly
                                                                    style={{ backgroundColor: '#e9ecef' }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={row.DISCOUNT || ''}
                                                                    onChange={e => handleChangeSkuForAccount(selectedAccountForSku, idx, 'DISCOUNT', e.target.value)}
                                                                />
                                                            </td>
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={row.TOTAL_AMOUNT || ''}
                                                                    readOnly
                                                                    style={{ backgroundColor: '#d4edda', fontWeight: 'bold' }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <Button
                                                                    variant="danger"
                                                                    size="sm"
                                                                    onClick={() => removeSkuRowForAccount(selectedAccountForSku, idx)}
                                                                >
                                                                    Remove
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>

                                                {/* Account Totals Footer */}
                                                {selectedAccountForSku && accountSkuRows[selectedAccountForSku]?.length > 0 && (
                                                    <tfoot>
                                                        <tr className="table-info">
                                                            <th>Account Total</th>
                                                            <th>{calculateAccountSkuTotals(selectedAccountForSku).SRP.toFixed(2)}</th>
                                                            <th>{calculateAccountSkuTotals(selectedAccountForSku).QTY}</th>
                                                            <th>
                                                                {UOM_OPTIONS.map(opt => (
                                                                    <div key={opt} style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>
                                                                        {opt}: {calculateAccountSkuTotals(selectedAccountForSku).UOMCount[opt] || 0}
                                                                    </div>
                                                                ))}
                                                            </th>
                                                            <th>{calculateAccountSkuTotals(selectedAccountForSku).BILLING_AMOUNT.toFixed(2)}</th>
                                                            <th>{calculateAccountSkuTotals(selectedAccountForSku).DISCOUNT.toFixed(2)}</th>
                                                            <th>{calculateAccountSkuTotals(selectedAccountForSku).TOTAL_AMOUNT.toFixed(2)}</th>
                                                            <th>-</th>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </Table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 bg-light rounded">
                                        <p className="text-muted mb-0">Please select an account to manage SKU listings</p>
                                    </div>
                                )}
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
                                            Select SKU {activeCategoryCode ? `(Category: ${activeCategoryCode})` : ''}
                                        </Modal.Title>
                                    </Modal.Header>

                                    <Modal.Body
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            height: '70vh', // Responsive height
                                            padding: '1rem',
                                        }}
                                    >
                                        {/* Search Input */}
                                        <input
                                            type="text"
                                            className="form-control mb-3"
                                            placeholder="Search SKUs..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ borderColor: '#007bff', flexShrink: 0 }}
                                        />

                                        {/* Selected Categories */}
                                        <div style={{ overflowY: 'auto', flexGrow: 1 }}>
                                            <strong>Selected Categories:</strong>

                                            <div
                                                style={{
                                                    marginTop: '0.5rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px',
                                                }}
                                            >
                                                {(formData.categoryName && formData.categoryName.length > 0) ? (
                                                    formData.categoryName.map((name, index) => {
                                                        const code = formData.categoryCode[index];
                                                        const isActive = activeCategoryCode === code;

                                                        return (
                                                            <div key={index}>
                                                                {/* Category Item */}
                                                                <div
                                                                    onClick={() => handleCategoryClick(code)}
                                                                    style={{
                                                                        padding: '8px 12px',
                                                                        border: isActive ? '2px solid black' : '1px solid #ccc',
                                                                        borderRadius: '6px',
                                                                        backgroundColor: isActive ? '#e6e6e6' : '#f9f9f9',
                                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                                        fontWeight: '500',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                    }}
                                                                >
                                                                    <span>{code} - {name}</span>
                                                                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#666' }}>{'>'}</span>
                                                                </div>

                                                                {/* SKU List (only active) */}
                                                                {isActive && (
                                                                    <div
                                                                        style={{
                                                                            marginTop: '0.5rem',
                                                                            padding: '0.5rem',
                                                                            backgroundColor: '#fff',
                                                                            border: '1px solid #ddd',
                                                                            borderRadius: '4px',
                                                                            maxHeight: '200px',
                                                                            overflowY: 'auto',
                                                                        }}
                                                                    >
                                                                        {(categoryListing || [])
                                                                            .filter((sku) => {
                                                                                const matchesCategory = sku.category_code?.toLowerCase() === code.toLowerCase();
                                                                                const matchesSearch = (
                                                                                    sku.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                                    (sku.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                                    sku.category_code?.toString().toLowerCase().includes(searchTerm.toLowerCase())
                                                                                );
                                                                                return matchesCategory && matchesSearch;
                                                                            })
                                                                            .map((sku) => (
                                                                                <div
                                                                                    key={sku.category_code}
                                                                                    style={{
                                                                                        padding: '8px',
                                                                                        cursor: 'pointer',
                                                                                        borderBottom: '1px solid #eee',
                                                                                    }}
                                                                                    onClick={() => {
                                                                                        if (selectedAccountForSku && selectedRowIndex !== null) {
                                                                                            handleChangeSkuForAccount(selectedAccountForSku, selectedRowIndex, 'SKUITEM', sku.sku_code);
                                                                                        }
                                                                                        setShowSkuModal(false);
                                                                                    }}
                                                                                >
                                                                                    <div><strong>{sku.sku_code}</strong> - {sku.name}</div>
                                                                                    <small style={{ color: '#666' }}>{sku.description || 'No description'}</small>
                                                                                </div>
                                                                            ))}

                                                                        {/* No SKUs */}
                                                                        {categoryListing.filter(sku =>
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
                                        <Button variant="secondary" onClick={() => setShowSkuModal(false)}>
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
                            <button className="btn btn-outline-secondary" onClick={handlePrevious}>
                                ← Previous
                            </button>



                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setStep(3)}
                                style={{ width: '85px' }}
                            >
                                Next
                            </button>
                        </div>
                    </div >
                );

            case 2:
                // Cost Details table
                return (
                    <div className="d-flex flex-column">
                        {formData.isPartOfCoverPwp && formData.coverPwpCode && selectedBalance !== null && (() => {
                            const totalAllocatedFromAccounts = rowsAccounts
                                .filter(row => formData.accountType.includes(row.account_code))
                                .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);

                            // Make sure allocatedBudget is 0 or correct number here
                            const allocatedBudget = 0;

                            const remainingBudget = selectedBalance - totalAllocatedFromAccounts - allocatedBudget;

                            return (
                                <div className="d-flex justify-content-between align-items-start gap-4">
                                    {/* Left: Drag & Drop */}
                                    <div
                                        className="border rounded p-4 mb-3 flex-grow-1"
                                        style={{
                                            borderStyle: 'dashed',
                                            backgroundColor: '#f9f9f9',
                                            position: 'relative',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            maxWidth: '80%',
                                            height: '162px'
                                        }}
                                        onDrop={handleFileDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                        onClick={triggerFileInputs}
                                        title="Click or drag and drop Excel file to import"
                                    >
                                        <div style={{
                                            marginTop: '1rem',
                                            color: '#888',
                                            fontSize: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            fontWeight: '500',
                                        }}>
                                            <FaCloudUploadAlt size={20} />
                                            <span>Or drag and drop your Excel file here</span>
                                        </div>

                                        <Form.Control
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleFileChange}
                                            ref={fileInputRefs}
                                            style={{ display: 'none' }}
                                        />
                                    </div>

                                    {/* Right: Remaining Budget Card */}
                                    <div className="card border-success mb-3 shadow" style={{ width: '22rem' }}>
                                        <div className="card-header bg-success text-white fw-bold text-center">
                                            🎯 Remaining Budget
                                        </div>
                                        <div className="card-body text-center">
                                            <p
                                                className="card-text"
                                                style={{
                                                    fontSize: '2rem',
                                                    fontWeight: 'bold',
                                                    color: remainingBudget < 0 ? '#dc3545' : '#198754',
                                                }}
                                            >
                                                ₱{remainingBudget.toLocaleString('en-PH', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </p>

                                            <small className="text-muted d-block">
                                                Original: ₱{selectedBalance.toLocaleString('en-PH', {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </small>

                                            <small className="text-muted d-block">
                                                Total from Accounts Table: ₱{totalAllocatedFromAccounts.toLocaleString('en-PH', {
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
                                <h4 className="mb-0">💰 Regular Account Budget List</h4>
                                <div className="d-flex gap-2 align-items-center">
                                    <Button variant="success" onClick={triggerFileInputs} className="d-flex align-items-center">
                                        <FaFileExcel className="me-2" /> Import Excel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        style={{ backgroundColor: 'gray' }}
                                        onClick={handleExportCSV}
                                        className="d-flex align-items-center"
                                    >
                                        <FaDownload className="me-2" /> Export Excel
                                    </Button>
                                </div>
                            </Card.Header>

                            <Card.Body>
                                {loadingAccounts ? (
                                    <div className="d-flex justify-content-center align-items-center" style={{ height: '150px' }}>
                                        <Spinner animation="border" variant="primary" />
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <Table bordered hover responsive className="align-middle text-center">
                                            <thead className="bg-primary text-white">
                                                <tr>
                                                    <th>Account Code</th>
                                                    <th>Account Name</th>
                                                    <th>Budget</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {accountTypes
                                                    .filter(account => formData.accountType.includes(account.code))
                                                    .map((account) => {
                                                        const existingRow = rowsAccounts.find(r => r.account_code === account.code) || {};
                                                        const budgetValue = existingRow.budget !== undefined ? existingRow.budget : "";

                                                        return (
                                                            <tr key={account.id}>
                                                                <td><Form.Control value={account.code} disabled /></td>
                                                                <td><Form.Control value={account.name} disabled /></td>
                                                                <td>
                                                                    <Form.Control
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={budgetValue === "" ? "" : budgetValue}
                                                                        onChange={e => {
                                                                            let newBudget = parseFloat(e.target.value);
                                                                            if (isNaN(newBudget)) newBudget = 0;

                                                                            const updatedRow = {
                                                                                id: existingRow.id || account.id,
                                                                                account_code: account.code,
                                                                                account_name: account.name,
                                                                                budget: newBudget,
                                                                                created_at: existingRow.created_at || new Date().toISOString(),
                                                                            };

                                                                            setRowsAccounts(prevRows => {
                                                                                const existingIndex = prevRows.findIndex(r => r.account_code === account.code);
                                                                                let updated;

                                                                                // If exists, update only if the value changed
                                                                                if (existingIndex !== -1) {
                                                                                    const existingBudget = parseFloat(prevRows[existingIndex].budget) || 0;
                                                                                    if (existingBudget !== newBudget) {
                                                                                        updated = [...prevRows];
                                                                                        updated[existingIndex] = { ...updated[existingIndex], budget: newBudget };

                                                                                        // Log only if changed
                                                                                        const now = new Date().toLocaleString();
                                                                                        console.log(`[${now}] 🔄 Budget updated for "${account.account_name}" (${account.code}): ₱${existingBudget} ➡️ ₱${newBudget}`);

                                                                                        // Log total budget after update
                                                                                        const totalBudget = updated
                                                                                            .filter(row => formData.accountType.includes(row.account_code))
                                                                                            .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0)
                                                                                            .toFixed(2);

                                                                                        console.log(`[${now}] 📊 Total Budget: ₱${totalBudget}`);
                                                                                    } else {
                                                                                        // Skip logging if same value entered again
                                                                                        updated = [...prevRows];
                                                                                    }
                                                                                } else {
                                                                                    // New row case
                                                                                    updated = [...prevRows, updatedRow];

                                                                                    const now = new Date().toLocaleString();
                                                                                    console.log(`[${now}] ➕ New account budget added: "${account.account_name}" (${account.code}) - ₱${newBudget}`);

                                                                                    // Log total budget after update
                                                                                    const totalBudget = updated
                                                                                        .filter(row => formData.accountType.includes(row.account_code))
                                                                                        .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0)
                                                                                        .toFixed(2);

                                                                                    console.log(`[${now}] 📊 Total Budget: ₱${totalBudget}`);
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
                                                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'right' }}>Total</td>
                                                    <td style={{ fontWeight: 'bold' }}>
                                                        {rowsAccounts
                                                            .filter(row => formData.accountType.includes(row.account_code))
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
                                <div>
                                    <Button variant="outline-secondary" onClick={handlePrevious} className="me-2">
                                        ← Previous
                                    </Button>

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
                                {formData.isPartOfCoverPwp && formData.coverPwpCode && remainingBalance !== null && (
                                    <div className="row mt-4 gx-4 gy-4">
                                        {/* Left: Regular PWPs Card */}
                                        <div className="col-12 col-md-7">
                                            <div
                                                className="card p-4 animate-fade-slide-up shadow-sm h-100"
                                                style={{
                                                    background: 'linear-gradient(135deg,rgb(11, 48, 168), #d9edf7)',
                                                    borderRadius: '12px',
                                                    border: '1px solid #99cfff',
                                                    color: '#ffff',
                                                    boxShadow: '0 4px 8px rgba(26, 62, 114, 0.15)',
                                                }}
                                            >
                                                <h3
                                                    className="mb-0"
                                                    style={{
                                                        fontWeight: '700',
                                                        letterSpacing: '2px',
                                                        textTransform: 'uppercase',
                                                        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                                        textShadow: '1px 1px 2px rgba(26, 62, 114, 0.3)',
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
                                                            fontSize: '2rem',
                                                            fontWeight: 'bold',
                                                            color: remainingBalance < 0 ? '#dc3545' : '#198754',
                                                        }}
                                                    >
                                                        ₱{Number(remainingBalance).toLocaleString('en-PH', {
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

                                                <th>Date Created</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {approvalList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" className="text-center">No approval data found.</td>
                                                </tr>
                                            ) : (
                                                approvalList.map(({ id, username, allowed_to_approve, created_at }) => (
                                                    <tr key={id}>
                                                        <td>{username}</td>
                                                        <td>
                                                            {allowed_to_approve ? (
                                                                <span className="badge bg-success">Allowed</span>
                                                            ) : (
                                                                <span className="badge bg-warning text-dark">Not Allowed</span>
                                                            )}
                                                        </td>
                                                        <td>{created_at ? new Date(created_at).toLocaleDateString() : '-'}</td>
                                                    </tr>
                                                ))
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
                                        cursor: 'pointer',
                                        minHeight: '150px',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '10px',
                                        alignItems: 'center',
                                        justifyContent: files.length === 0 ? 'center' : 'flex-start',
                                        backgroundColor: '#f8f9fa',
                                        position: 'relative',
                                        transition: 'background-color 0.3s',
                                    }}
                                >
                                    {files.length === 0 && <p className="text-muted">Drag & Drop files here or click to upload</p>}

                                    {files.map((file, index) => (
                                        <div
                                            key={index}
                                            className="position-relative"
                                            style={{
                                                width: '100px',
                                                height: '100px',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                overflow: 'hidden',
                                                textAlign: 'center',
                                                padding: '5px',
                                                backgroundColor: 'white',
                                                boxShadow: '0 0 4px rgba(0,0,0,0.1)',
                                            }}
                                        >
                                            {file.type.startsWith('image/') ? (
                                                <img
                                                    src={file.preview}
                                                    alt={file.name}
                                                    style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
                                                />
                                            ) : (
                                                <div style={{ fontSize: '12px', wordWrap: 'break-word', marginTop: '30px' }}>
                                                    <i className="bi bi-file-earmark" style={{ fontSize: '28px', color: '#0d6efd' }}></i>
                                                    <div>{file.name.length > 15 ? file.name.slice(0, 15) + '...' : file.name}</div>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFile(index);
                                                }}
                                                className="btn btn-sm btn-danger position-absolute top-0 end-0"
                                                style={{ borderRadius: '0 0 0 6px' }}
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
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            </div >

                            <div className="mt-4 d-flex justify-content-between">
                                <button className="btn btn-outline-secondary" onClick={handlePrevious}>
                                    ← Previous
                                </button>

                                <Button
                                    variant="success"
                                    onClick={submit_all}
                                    className="d-flex align-items-center"
                                    style={{ marginTop: '1rem' }}
                                >
                                    <FaSave className="me-2" /> Submit All
                                </Button>
                            </div>
                        </form>
                    </div >

                );




            case 4:
                return (
                    formData.activityName === "BAD ORDER" && (
                        <div>
                            {formData.coverPwpCode && selectedBalance !== null && (
                                <div
                                    className="card mb-3 shadow-sm"
                                    style={{
                                        width: '32rem',
                                        borderRadius: '12px',
                                        border: '1px solid #198754',
                                        overflow: 'hidden',
                                        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                    }}
                                >
                                    <div
                                        className="card-header text-white fw-bold text-center"
                                        style={{
                                            background: 'linear-gradient(90deg, #198754 0%, #2ecc71 100%)',
                                            fontSize: '1.25rem',
                                            letterSpacing: '1px',
                                            padding: '1rem',
                                            borderBottom: '2px solid #145c32',
                                            userSelect: 'none',
                                        }}
                                    >
                                        🎯 Remaining Budget
                                    </div>

                                    <div className="card-body text-center px-4 py-3">
                                        <p
                                            className="card-text mb-2"
                                            style={{
                                                fontSize: '2.5rem',
                                                fontWeight: '900',
                                                color:
                                                    selectedBalance - totals.BILLING_AMOUNT - parseFloat(formData.amountbadget || 0) < 0
                                                        ? '#dc3545'
                                                        : '#198754',
                                                transition: 'color 0.3s ease',
                                            }}
                                        >
                                            ₱
                                            {(
                                                selectedBalance -
                                                totals.BILLING_AMOUNT -
                                                parseFloat(formData.amountbadget || 0)
                                            ).toLocaleString('en-PH', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </p>

                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'center',
                                                gap: '2rem',
                                                fontSize: '0.9rem',
                                                color: '#6c757d',
                                                userSelect: 'none',
                                            }}
                                        >
                                            <div>
                                                <small>Original</small>
                                                <br />
                                                <strong>₱{selectedBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                            </div>

                                            <div>
                                                <small>Allocated (Form)</small>
                                                <br />
                                                <strong>₱{parseFloat(formData.amountbadget || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
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
                                                <th style={{ width: '40%' }}>Category</th>
                                                <th style={{ width: '40%' }}>Amount</th>
                                                <th style={{ width: '20%' }}>Actions</th>
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
                                                                    value={row.category || ''}
                                                                    onChange={(e) => handleCategoryRowChange(index, 'category', e.target.value)}
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
                                                                onChange={(e) => handleCategoryRowChange(index, 'amount', e.target.value)}
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
                                        <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                                            <Modal.Header closeButton style={{ background: "#4689a6", color: "white" }}>
                                                <Modal.Title className="w-100 text-center">📂 Select {categoryMode === 'subcategory' ? 'Subcategory' : 'Category'}</Modal.Title>
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
                                                            onChange={(e) => setBadOrderSearch(e.target.value)}
                                                        />

                                                        {loading ? (
                                                            <p>Loading {categoryMode}s...</p>
                                                        ) : (
                                                            <ul className="list-group" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                                {filtered.length > 0 ? (
                                                                    filtered.map((cat) => (
                                                                        <li
                                                                            key={cat.id}
                                                                            className="list-group-item list-group-item-action"
                                                                            style={{ cursor: 'pointer' }}
                                                                            onClick={() => handleSelectCategory(cat)}
                                                                        >
                                                                            <strong>{cat.code}</strong> - {cat.name}
                                                                            <div className="text-muted small">{cat.description || 'No description'}</div>
                                                                        </li>
                                                                    ))
                                                                ) : (
                                                                    <li className="list-group-item text-muted">No results found</li>
                                                                )}
                                                            </ul>
                                                        )}
                                                    </>
                                                )}
                                            </Modal.Body>

                                            <Modal.Footer>
                                                <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
                                            </Modal.Footer>
                                        </Modal>


                                        <tfoot>
                                            <tr>
                                                <td className="text-end fw-bold">Total:</td>
                                                <td colSpan="2" className="fw-bold">
                                                    ₱{calculateTotalAmount().toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>

                                            {formData.coverPwpCode && selectedBalance !== null && (() => {
                                                const amountBadgetValue = selectedBalance; // Use selectedBalance as total budget
                                                const safeAmountBadget = isNaN(amountBadgetValue) ? 0 : amountBadgetValue;
                                                const totalAmount = calculateTotalAmount();
                                                const remainingBudget = selectedBalance - totals.BILLING_AMOUNT - (parseFloat(formData.amountbadget) || 0);
                                                const amountBadgetMinusTotal = safeAmountBadget - totalAmount;

                                                return (
                                                    <>
                                                        <tr>
                                                            <td className="text-end fw-bold">Remaining Budget:</td>
                                                            <td colSpan="2"
                                                                style={{
                                                                    fontWeight: '900',
                                                                    color: remainingBudget < 0 ? '#dc3545' : '#198754',
                                                                    fontSize: '1.25rem',
                                                                    userSelect: 'none',
                                                                }}
                                                            >
                                                                ₱{remainingBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>

                                                        <tr>
                                                            <td className="text-end fw-bold">Amountbadget - Total Amount:</td>
                                                            <td colSpan="2"
                                                                style={{
                                                                    fontWeight: '900',
                                                                    color: amountBadgetMinusTotal < 0 ? '#dc3545' : '#198754',
                                                                    fontSize: '1.25rem',
                                                                    userSelect: 'none',
                                                                }}
                                                            >
                                                                ₱{amountBadgetMinusTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
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
                                <button className="btn btn-outline-secondary" onClick={handlePrevious}>
                                    ← Previous
                                </button>
                                <div className="d-flex justify-content-end mt-3">
                                    <Button
                                        variant="success"
                                        onClick={submit_all}
                                        className="d-flex align-items-center"
                                        style={{ marginTop: '1rem' }}
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

    return <div style={{ padding: '30px', overflowX: 'auto' }} className="containes">{renderStepContent()}</div>;
};

export default RegularVisaForm;