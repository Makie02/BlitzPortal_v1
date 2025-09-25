
import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';  // <---- import sweetalert2
import { supabase } from '../supabaseClient';
import { Modal, Button } from 'react-bootstrap'; // Ensure react-bootstrap is installed
import { FaExclamationTriangle } from 'react-icons/fa'; // Make sure react-icons is installed
import { Table, Form, Container, Card, Spinner } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import { FaFileExcel, FaCloudUploadAlt, FaDownload, FaSave, FaSearch } from 'react-icons/fa';
import { CSVLink } from 'react-csv';

const Claims_pwp = () => {

    const [singleApprovals, setSingleApprovals] = useState([]);
    const [userApprovers, setUserApprovers] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // Fetch singleapprovals
            // const { data: approvalsData, error: approvalsError } = await supabase
            //     .from('singleapprovals')
            //     .select('*')
            //     .order('created_at', { ascending: false });

            // Fetch user approvers
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

    // Helper: get name from user_id
    const getUserName = (user_id) => {
        const user = users.find((u) => u.UserID === user_id);
        return user ? user.name || 'No Name' : 'Unknown User';
    };

    // Combine and normalize data into one array for the table
    const combinedData = [
        ...singleApprovals.map((a) => ({
            id: a.id,
            approver: getUserName(a.user_id),
            position: a.position,
            status: a.allowed_to_approve ? 'Approved' : 'Pending',
            type: '',
            created_at: a.created_at,
            isSingleApproval: true,
        })),
        ...userApprovers.map((u) => ({
            id: u.id,
            approver: u.Approver_Name || 'No Name',
            position: '',
            status: '',
            type: u.Type || '',
            created_at: u.created_at,
            isSingleApproval: false,
        })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // newest first




    const today = new Date().toISOString().split('T')[0];

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
                .from('Claims_pwp') // Assuming your table is called 'regular_pwp'
                .select('code_pwp'); // Selecting the column with regular pwp codes

            if (error) {
                console.error('Error fetching regular pwp codes:', error);
                setLoadingRegularPwpCodes(false); // Set loading to false on error
            } else {
                const codes = data
                    .map(row => row.code_pwp) // Extracting regularpwpcode
                    .filter(Boolean); // Removing any falsy values (null, undefined)

                setAllRegularPwpCodes(codes); // Set the codes in the state

                // Generate a new code if the coverCode is not set in formData
                if (!formData.code_pwp) {
                    const newCode = generateRegularCode(codes); // Generate the new cover code
                    setFormData(prev => ({ ...prev, code_pwp: newCode })); // Update formData with the new coverCode
                }

                setLoadingRegularPwpCodes(false); // Set loading to false after data fetch
            }
        }

        fetchRegularPwpCodes(); // Call the fetch function when the component mounts
    }, []); // Empty dependency array so it runs only once when the component mounts

    useEffect(() => {
        // This effect runs whenever `allRegularPwpCodes` changes
        if (!formData.code_pwp && allRegularPwpCodes.length > 0) {
            const newCode = generateRegularCode(allRegularPwpCodes); // Generate the new cover code
            setFormData(prev => ({ ...prev, code_pwp: newCode })); // Update formData with the new coverCode
        }
    }, [allRegularPwpCodes]); // Dependencies are the fetched codes

    // Generate a new code based on the existing ones
    const generateRegularCode = (existingCodes = []) => {
        const year = new Date().getFullYear(); // Get the current year
        const prefix = `CL${year}-`; // Prefix with the year (e.g., R2025-)

        // Filter out existing codes that start with the prefix and extract numeric parts
        const codesForYear = existingCodes
            .filter(code => code?.startsWith(prefix)) // Only keep codes with the current year prefix
            .map(code => parseInt(code.replace(prefix, ''), 10)) // Remove the prefix and convert to integers
            .filter(num => !isNaN(num)); // Ensure we only keep valid numbers

        // Get the next code number by incrementing the maximum of existing ones
        const newNumber = (codesForYear.length ? Math.max(...codesForYear) : 0) + 1; // If codes exist, find the highest number and increment

        return `${prefix}${newNumber}`; // Return the new generated code
    };




    // Handle input change for form fields

    // Handle toggle change for Is Part of Cover Visa
    const [coverVisas, setCoverVisas] = useState([]);












    // Auto-select first Cover Visa when toggled ON
    // useEffect(() => {
    //     if (formData.isPartOfCoverPwp && coverVisas.length > 0) {
    //         setFormData((prev) => ({
    //             ...prev,
    //             coverVisaCode: coverVisas[0].coverVisaCode || coverVisas[0].code || '',
    //         }));
    //     } else {
    //         setFormData((prev) => ({
    //             ...prev,
    //             coverVisaCode: '',
    //         }));
    //     }
    // }, [formData.isPartOfCoverPwp, coverVisas]);


    const formatCurrency = (num) =>
        `PHP ${Number(num || 0).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        })}`;


    // Handle promo table row change







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



















    const [submitAction, setSubmitAction] = useState(null);


    const [options, setOptions] = useState([]);

    const [showCoverVisaCode, setShowCoverVisaCode] = useState(false);

    const [hovered, setHovered] = useState(false);

    const borderColor = formData.company ? 'green' : hovered ? '#ccc' : '';
    const [groupAccount, setGroupAccount] = useState([]);
    const [accountTypes, setAccountTypes] = useState([]);
    const [visaTypes, setVisaTypes] = useState([]);
    const [activity, setActvity] = useState([]);
    const [principal, setPrincipal] = useState([]);













    // Load group account list when accountType is selected












    const [promotedSKUs, setPromotedSKUs] = useState([]);
    const [showSkuModal, setShowSkuModal] = useState(false);
    const [tableData, setTableData] = useState([
        { promotedSKU: '' }, // Example row
        // You can dynamically populate this depending on your case
    ]);
    const [skuSearch, setSkuSearch] = useState('');

    const [currentRowIndex, setCurrentRowIndex] = useState(null);



    const handleCloseSkuModal = () => {
        setShowSkuModal(false);
        setSkuSearch('');
    };



    const [brands, setBrands] = React.useState({});
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

    const [Costdetails, setCostdetails] = useState([]);


    // When principal changes, filter brands
    const [amountBadget, setAmountBadget] = useState(null);
    const [coverPwps, setCoverPwps] = useState([]); // This replaces coverVisas

    // useEffect(() => {
    //     const fetchAmount = async () => {
    //         if (!formData.coverVisaCode) {
    //             setAmountBadget(null);
    //             return;
    //         }

    //         const { data, error } = await supabase
    //             .from('amount_badget')
    //             .select('remainingbalance')
    //             .eq('pwp_code', formData.coverVisaCode)
    //             .single();

    //         if (error) {
    //             console.error('Supabase error:', error.message);
    //             setAmountBadget(null);
    //         } else {
    //             console.log('Fetched remainingbalance:', data?.remainingbalance);
    //             setAmountBadget(data?.remainingbalance ?? null);
    //         }
    //     };

    //     fetchAmount();
    // }, [formData.coverVisaCode]);




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
    const [coverVisaSearch, setCoverVisaSearch] = useState('');



    const [showModal, setShowModal] = useState(false);
    const [showListingsModal, setShowListingsModal] = useState(false);

    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [listings, setListings] = useState([]);
    const [selectedListings, setSelectedListings] = useState([]);
    const [showListingModal, setShowListingModal] = useState(false);
    const [selectedSkus, setSelectedSkus] = useState([]);

    const [loadingListings, setLoadingListings] = useState(false);




    useEffect(() => {
        // Sync rows to selectedSkus
        const newRows = selectedSkus.map(sku => {
            const existingRow = rows.find(row => row.SKU === sku);
            return existingRow || { SKU: sku, SRP: '', QTY: '', UOM: '', DISCOUNT: '', BILLING_AMOUNT: '' };
        });
        setRows(newRows);
    }, [selectedSkus]);
    const handleChangesku = (index, field, value) => {
        setRows(prevRows => {
            const updated = [...prevRows];
            const currentRow = { ...updated[index] };

            // If updating SKUITEM, set it from value directly (allow manual input)
            if (field === 'SKUITEM') {
                currentRow.SKUITEM = value;
            } else {
                // Otherwise, keep SKUITEM as it was or from selectedSkus if available
                currentRow.SKUITEM = selectedSkus[index] ?? currentRow.SKUITEM ?? '';
                currentRow[field] = value;
            }

            if (['SRP', 'QTY', 'DISCOUNT'].includes(field)) {
                const srp = parseFloat(field === 'SRP' ? value : currentRow.SRP) || 0;
                const qty = parseInt(field === 'QTY' ? value : currentRow.QTY, 10) || 0;
                const discount = parseFloat(field === 'DISCOUNT' ? value : currentRow.DISCOUNT) || 0;

                currentRow.BILLING_AMOUNT = (srp * qty) - discount;
            }

            updated[index] = currentRow;
            return updated;
        });
    };


    const handleCloseModal = () => {
        setShowModal(false);
    };








    // const handleCategorySelect = async (cat) => {
    //     setFormData(prev => ({
    //         ...prev,
    //         categoryName: cat.name,
    //         categoryCode: cat.code
    //     }));
    //     setSelectedCategory(cat);
    //     setShowModal(false);

    //     // Fetch listings related to selected category
    //     const { data, error } = await supabase
    //         .from("category_listing")
    //         .select("id, name, sku_code, description")
    //         .eq("category_code", cat.code);

    //     if (error) {
    //         console.error("Error fetching listings:", error.message);
    //         setListings([]);
    //     } else {
    //         setListings(data);
    //         setShowListingsModal(true);
    //     }
    // };


    const openListingModal = async (category) => {
        setSelectedCategory(category);
        setLoadingListings(true);
        setShowListingModal(true); // show modal before fetching so loading indicator shows

        try {
            const { data, error } = await supabase
                .from("category_listing")
                .select("*")
                .eq("category_code", category.code);

            if (error) {
                console.error("Error fetching listings:", error.message);
                setListings([]);
            } else {
                setListings(data);
            }
        } catch (err) {
            console.error("Unexpected error fetching listings:", err);
            setListings([]);
        } finally {
            setLoadingListings(false);
        }
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

    // Handle checkbox toggle
    const toggleListingSelection = (listingId) => {
        setSelectedListings(prev =>
            prev.includes(listingId)
                ? prev.filter(id => id !== listingId)
                : [...prev, listingId]
        );
    };

    // When category is selected → also fetch its listings



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



    // useEffect(() => {
    //     async function loadAccounts() {
    //         const { data, error } = await supabase
    //             .from('accounts')
    //             .select('id, code, name')
    //             .order('code', { ascending: true });
    //         if (!error) setAccountTypes(data);
    //     }
    //     loadAccounts();
    // }, []);

    // compute selected





    // Toggle selection of accountType


    const [accountSearchTerm, setAccountSearchTerm] = useState("");
    const [showModal_Account, setShowModal_Account] = useState(false);

    // Fetch all accounts initially (optional)
    // useEffect(() => {
    //     const fetchAccounts = async () => {
    //         const { data, error } = await supabase
    //             .from("accounts")
    //             .select("*")
    //             .order("code", { ascending: true });
    //         if (error) {
    //             console.error("Error fetching account types:", error.message);
    //         } else {
    //             setAccountTypes(data);
    //         }
    //     };
    //     fetchAccounts();
    // }, []);

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

    // const handleFormChange = async (e) => {
    //     const { name, value } = e.target;
    //     console.log(`📝 Form change detected - Field: "${name}", Value: "${value}"`);

    //     // Handle distributor change FIRST (because it's async)
    //     if (name === "distributor") {
    //         try {
    //             const selectedDistributor = distributors.find((d) => d.code === value);

    //             if (!selectedDistributor) {
    //                 console.warn("⚠️ Distributor not found for code:", value);
    //                 return;
    //             }

    //             console.log("📦 Selected distributor:", selectedDistributor);

    //             const { data, error } = await supabase
    //                 .from("categorydetails")
    //                 .select("code, name, description")
    //                 .eq("principal_id", selectedDistributor.id);

    //             if (error) throw error;

    //             console.log("📥 Raw data from Supabase:", data);

    //             const formatted = data.map((item) => ({
    //                 code: item.code,
    //                 name: item.name,
    //                 description: item.description,
    //             }));

    //             setAccountTypes(formatted);
    //             console.log("✅ Formatted accountTypes:", formatted);

    //             setAccountSearchTerm("");
    //             setFormData((prev) => ({
    //                 ...prev,
    //                 distributor: value,
    //                 accountType: [],
    //             }));

    //             setRowsAccounts([]); // Clear rows
    //             return; // exit here — we're done
    //         } catch (error) {
    //             console.error("❌ Failed to fetch category details:", error.message);
    //             setAccountTypes([]);
    //             return;
    //         }
    //     }

    //     // Normal updates for form
    //     setFormData((prev) => {
    //         const updatedForm = {
    //             ...prev,
    //             [name]: value,
    //         };

    //         // ✅ When activity changes, also set activity name
    //         if (name === "activity") {
    //             const selectedActivity = activities.find((a) => a.code === value);
    //             updatedForm.activityName = selectedActivity?.name || "";
    //             console.log("🎯 Selected Activity Object:", selectedActivity);
    //             console.log("📛 Selected Activity Name:", updatedForm.activityName);
    //         }

    //         // ✅ Apply settings map if applicable
    //         if (settingsMap[value]) {
    //             updatedForm.sku = settingsMap[value].sku;
    //             updatedForm.accounts = settingsMap[value].accounts;
    //             updatedForm.amount_display = settingsMap[value].amount_display;

    //             console.log("🔍 Applied settingsMap values:", {
    //                 sku: updatedForm.sku,
    //                 accounts: updatedForm.accounts,
    //                 amount_display: updatedForm.amount_display,
    //             });
    //         }

    //         // ✅ Clear rowsAccounts if these fields change
    //         if (name === "accountType") {
    //             setRowsAccounts([]);
    //             console.log("🧹 Cleared rowsAccounts due to accountType change");
    //         }

    //         return updatedForm;
    //     });
    // };

    const handleFormChange = async (e) => {
        const { name, value } = e.target;
        console.log(`📝 Form change detected - Field: "${name}", Value: "${value}"`);

        // Update formData
        setFormData((prev) => {
            const updatedForm = {
                ...prev,
                [name]: value,
            };

            // If activity is changed, get activity name
            if (name === "activity") {
                const selectedActivity = activities.find((a) => a.code === value);
                updatedForm.activityName = selectedActivity?.name || "";
                console.log("🎯 Selected Activity Object:", selectedActivity);
                console.log("📛 Selected Activity Name:", updatedForm.activityName);
            }

            // Apply settings map if exists
            if (settingsMap[value]) {
                updatedForm.sku = settingsMap[value].sku;
                updatedForm.accounts = settingsMap[value].accounts;
                updatedForm.amount_display = settingsMap[value].amount_display;

                console.log("🔍 Applied settingsMap values:", {
                    sku: updatedForm.sku,
                    accounts: updatedForm.accounts,
                    amount_display: updatedForm.amount_display,
                });
            }

            // Clear rowsAccounts when distributor or accountType changes
            if (name === "distributor" || name === "accountType") {
                setRowsAccounts([]);
                console.log("🧹 Cleared rowsAccounts due to distributor/accountType change");
            }

            return updatedForm;
        });

        // If distributor is changed, fetch account types
        if (name === "distributor") {
            try {
                const selectedDistributor = distributors.find((d) => d.code === Number(value));

                if (!selectedDistributor) {
                    console.warn("⚠️ Distributor not found for code:", value);
                    setAccountTypes([]);
                    return;
                }

                console.log("📦 Selected distributor:", selectedDistributor);

                // BATCH FETCH categories from Supabase
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

                console.log("📥 Final raw data from Supabase:", allData);
                console.log("✅ Total categories fetched:", allData.length);

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
                console.log("✅ All formatted accountTypes set:", formatted.length, "records");

                // Optionally, reset form.accountType
                setFormData((prev) => ({
                    ...prev,
                    accountType: "",
                }));

                console.log("🧹 Reset formData.accountType after distributor change");
            } catch (error) {
                console.error("❌ Failed to fetch category details:", error.message);
                setAccountTypes([]);
            }
        }
    };




    // compute selected names
    // const selectedNames = accountTypes
    //     .filter(opt => formData.accountType && formData.accountType.includes(opt.id))
    //     .map(opt => opt.name)
    //     .join(', ');





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
    const [tempIdCounter, setTempIdCounter] = useState(0);

    // Fetch rows from Supabase


    // Count how many rows per UOM

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
    // Handle input changes per row
    const handleChange = (index, field, value) => {
        setRows(prev => {
            const updated = [...prev];
            const row = { ...updated[index], [field]: value };

            // Only recalculate billing amount if relevant fields change
            if (['SRP', 'QTY', 'DISCOUNT'].includes(field)) {
                const srp = parseFloat(field === 'SRP' ? value : row.SRP) || 0;
                const qty = parseInt(field === 'QTY' ? value : row.QTY) || 0;
                const discount = parseFloat(field === 'DISCOUNT' ? value : row.DISCOUNT) || 0;

                row.BILLING_AMOUNT = (srp * qty) - discount;
            }

            updated[index] = row;
            return updated;
        });
    };



    // Save existing row to Supabase
    // const saveRow = async (id) => {
    //     const row = rows.find(r => r.id === id);
    //     if (!row || typeof row.id !== 'number') return; // only save rows with real numeric IDs
    //     const { error } = await supabase
    //         .from('Regular_SKU')
    //         .update({
    //             PWP_CODE: row.PWP_CODE,
    //             SKU: row.SKU,
    //             SRP: parseFloat(row.SRP) || 0,
    //             QTY: parseInt(row.QTY) || 0,
    //             UOM: row.UOM,
    //             DISCOUNT: parseFloat(row.DISCOUNT) || 0,
    //             BILLING_AMOUNT: parseFloat(row.BILLING_AMOUNT) || 0,
    //         })
    //         .eq('id', id);
    //     if (error) {
    //         console.error('Error updating row:', error);
    //         alert('Failed to save row');
    //     } else {
    //         fetchRows();
    //     }
    // };

    // Delete row from Supabase
    // const deleteRow = async (id) => {
    //     if (typeof id !== 'number') {
    //         // Just remove new unsaved row from state
    //         setRows(prev => prev.filter(row => row.id !== id));
    //         return;
    //     }

    //     const confirmed = window.confirm('Are you sure you want to delete this row?');
    //     if (!confirmed) return;

    //     const { error } = await supabase
    //         .from('Regular_SKU')
    //         .delete()
    //         .eq('id', id);
    //     if (error) {
    //         console.error('Error deleting row:', error);
    //         alert('Failed to delete');
    //     } else {
    //         fetchRows();
    //     }
    // };

    // Add a new row with unique temp ID and balanced UOM default
    // const addRow = () => {
    //     const uomCounts = countUOMs(rows);
    //     const minCount = Math.min(...UOM_OPTIONS.map(uom => uomCounts[uom] || 0));
    //     const leastUsedUOMs = UOM_OPTIONS.filter(uom => (uomCounts[uom] || 0) === minCount);
    //     const defaultUOM = leastUsedUOMs.length > 0 ? leastUsedUOMs[0] : 'Case';

    //     const newId = `new-${tempIdCounter}`;
    //     setTempIdCounter(tempIdCounter + 1);

    //     const newRow = {
    //         id: newId,
    //         PWP_CODE: '',
    //         SKU: '',
    //         SRP: 0,
    //         QTY: 0,
    //         UOM: defaultUOM,
    //         DISCOUNT: 0,
    //         BILLING_AMOUNT: 0,
    //     };
    //     setRows(prev => [newRow, ...prev]);
    // };

    // Save a new row to Supabase



    const [rowsAccounts, setRowsAccounts] = useState([]); // Account rows from database or imported data
    const [loadingAccounts, setLoadingAccounts] = useState(false); // Loading state
    const [fileImportAccounts, setFileImportAccounts] = useState(null); // File import reference
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




    // Calculate total budget
    // const calculateTotalBudget = () => {
    //     return rowsAccounts.reduce((sum, account) => sum + (parseFloat(account.BUDGET) || 0), 0).toFixed(2);
    // };

    // // Handle change for account data
    // const handleChangeAccounts = (id, field, value) => {
    //     setRowsAccounts(prev =>
    //         prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
    //     );
    // };

    // Submit all rows (insert/update)








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


    // Only update rows when categories change, NOT when accounts change
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

            return {
                ...prevData,
                categoryCode: newCodes,    // This will be saved to DB
                categoryName: newNames,   // Only for display
            };
        });
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

    // categoryListing is your list of SKUs fetched from the database
    const [categoryListing, setCategoryListing] = useState([]);



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


    const handleSubmitForm = async () => {
        // Validate only distributor and activity
        if (!formData.distributor || !formData.activity) {
            alert("Please fill in Distributor and Activity.");
            return;
        }

        const safeSelectedBalance = isNaN(selectedBalance) ? 0 : selectedBalance;

        // Declare values to be used in payload
        let amountBudget = 0;
        let remainingBudget = 0;

        // 🔍 CASE: BAD ORDER
        if (formData.activityName === "BAD ORDER") {
            const totalAmount = formData.rowsCategories?.reduce((sum, row) => {
                return sum + (parseFloat(row.amount) || 0);
            }, 0) || 0;

            amountBudget = totalAmount;
            remainingBudget = safeSelectedBalance - totalAmount;
        }
        // ✅ CASE: OTHER ACTIVITIES
        else {
            const totalBudget = rowsAccounts
                .filter(row => formData.accountType.includes(row.account_code))
                .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);

            amountBudget = totalBudget;
            remainingBudget = safeSelectedBalance - totalBudget;
        }

        // 🔨 Get logged-in user name for createForm
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
        const createForm = currentUser?.name?.trim() || "Unknown";

        // 🔨 Payload build
        const payload = {
            code_pwp: formData.code_pwp || generateRegularCode(allRegularPwpCodes),
            distributor: formData.distributor,
            activity: formData.activity,
            account_types: formData.accountType,
            category_codes: formData.categoryCode || [],
            category_names: formData.categoryName || [],
            amount_budget: amountBudget,
            remaining_budget: remainingBudget,
            createForm: createForm,        // <-- added
            notification: formData.notification || false, // <-- added

            created_at: new Date().toISOString(),
        };

        try {
            const { data, error } = await supabase
                .from("Claims_pwp")
                .insert([payload]);

            if (error) {
                console.error("❌ Submission error:", error.message);
                alert("Failed to submit claim.");
                return false;
            }

            // Reset form
            setFormData({
                distributor: "",
                activity: "",
                accountType: [],
                categoryCode: [],
                categoryName: [],
                amountbadget: "",
                code_pwp: "",
            });

            return true;
        } catch (err) {
            console.error("❌ Unexpected error:", err);
            alert("Something went wrong.");
            return false;
        }
    };



    const postAccountBudgetData = async () => {
        if (!formData.coverPwpCode && !formData.code_pwp) {
            alert("PWP Code is missing.");
            return false;
        }

        const codePwp = formData.code_pwp || generateRegularCode(allRegularPwpCodes);

        // Calculate total budget from account rows
        const totalBudget = rowsAccounts
            .filter(row => formData.accountType.includes(row.account_code))
            .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);

        // ✅ Calculate remaining budget from selectedBalance
        const safeSelectedBalance = isNaN(selectedBalance) ? 0 : selectedBalance;
        const remaining = safeSelectedBalance - totalBudget;

        console.log(`📊 Total Budget from accounts: ₱${totalBudget.toFixed(2)}`);
        console.log(`💰 Remaining Budget (Selected Balance - Total Budget): ₱${remaining.toFixed(2)}`);

        const rowsToInsert = rowsAccounts.map(row => ({
            code_pwp: codePwp,
            account_code: row.account_code,
            account_name: row.account_name,
            budget: parseFloat(row.budget) || 0,
            created_at: row.created_at || new Date().toISOString(),
            total: totalBudget,
            remaining_budget: remaining // ✅ Add remaining budget here
        }));

        try {
            const { data, error } = await supabase
                .from('Claims_AccountBudgetTable')
                .insert(rowsToInsert);

            if (error) {
                throw error;
            }

            console.log('✅ Insert success:', data);
            return true;
        } catch (error) {
            console.error('❌ Insert error:', error.message);
            alert(`Error inserting data: ${error.message}`);
            return false;
        }
    };


    const postBadOrderCategories = async () => {
        if (!formData.code_pwp) {
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
            code_pwp: formData.code_pwp,
            category: row.category,
            amount: parseFloat(row.amount) || 0,
            remarks: formData.remarks || '',
            created_at: new Date().toISOString(),
            total: totalAmount,
            remaining_budget: amountBadgetMinusTotal,  // <- Use this value
        }));

        try {
            const { data, error } = await supabase
                .from("Claims_Badorder")
                .insert(rowsToInsert);

            if (error) {
                throw error;
            }

            console.log("✅ Bad order categories submitted successfully:", data);
            return true;
        } catch (error) {
            console.error("❌ Error submitting bad order categories:", error.message);
            alert(`Error submitting bad order categories: ${error.message}`);
            return false;
        }
    };



    const submitAllData = async () => {
        const claimSuccess = await handleSubmitForm();
        if (!claimSuccess) return;

        const budgetSuccess = await postAccountBudgetData();
        if (!budgetSuccess) return;

        // 🔍 Only submit Bad Order data if activity is "BAD ORDER"
        if (formData.activityName === "BAD ORDER") {
            const badorderSuccess = await postBadOrderCategories();
            if (!badorderSuccess) return;
        }

        // ✅ Show SweetAlert and reload on OK
        Swal.fire({
            icon: 'success',
            title: 'All data submitted successfully!',
            confirmButtonText: 'OK',
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.reload(); // 🔄 Reload the page
            }
        });
    };


    const totalAllocatedFromAccounts = rowsAccounts
        .filter(row => formData.accountType.includes(row.account_code))
        .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);
    const difference = selectedBalance - totalAllocatedFromAccounts;

    // 🔍 Filter by code or name

    const renderStepContent = () => {
        switch (step) {
            case 0:
                return (
                    // ...inside the Step 0 case in renderStepContent function:

                    <div >
                        <form >

                            <div style={{ padding: '30px', overflowX: 'auto' }} className="containers">
                                <div className="row align-items-center mb-4">

                                    <div className="col-12 col-md-6">
                                        <div
                                            className="card p-4 animate-fade-slide-up shadow-sm"
                                            style={{
                                                background: 'linear-gradient(135deg,rgba(0, 124, 173, 0.74), #d9edf7)', // gentle blue gradient
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
                                                Claims PWP
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
                                    <label>
                                        Activity <span style={{ color: 'red' }}>*</span>{' '}
                                        <small className="text-muted">(Support type)</small>
                                    </label>
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


                                {formData.activityName !== "BAD ORDER" && (

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
                                        Account <span style={{ color: 'red' }}>*</span>{' '}
                                        <small className="text-muted">(Store)</small>
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
                                        >
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
                                                            style={{ display: "flex", alignItems: "center", padding: "6px 0" }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.accountType.includes(opt.code)}
                                                                onChange={() => toggleAccountType(opt.code)}
                                                                id={`accountType-${opt.code}`}
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







                            </div>

                            <div className="text-end mt-4">
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        if (formData.activityName === "BAD ORDER") {
                                            setStep(1);
                                        } else {
                                            setStep(2);
                                        }
                                    }}
                                    style={{ width: '85px' }}
                                >
                                    Next →
                                </Button>

                            </div>
                        </form >
                    </div >

                );



            case 1:
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
                                    <button
                                        type="button"
                                        className="btn btn-success"
                                        onClick={submitAllData}
                                    >
                                        <FaSave className="me-2" /> Submit
                                    </button>
                                </div>

                            </div>
                        </div>
                    )
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
                                <h4 className="mb-0"> Account Budget List</h4>
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

                                                                                if (existingIndex !== -1) {
                                                                                    const existingBudget = parseFloat(prevRows[existingIndex].budget) || 0;
                                                                                    if (existingBudget !== newBudget) {
                                                                                        updated = [...prevRows];
                                                                                        updated[existingIndex] = { ...updated[existingIndex], budget: newBudget };

                                                                                        const now = new Date().toLocaleString();
                                                                                        console.log(`[${now}] 🔄 Budget updated for "${account.account_name}" (${account.code}): ₱${existingBudget} ➡️ ₱${newBudget}`);

                                                                                        const totalBudget = updated
                                                                                            .filter(row => formData.accountType.includes(row.account_code))
                                                                                            .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0)
                                                                                            .toFixed(2);

                                                                                        console.log(`[${now}] 📊 Total Budget: ₱${totalBudget}`);
                                                                                    } else {
                                                                                        updated = [...prevRows];
                                                                                    }
                                                                                } else {
                                                                                    updated = [...prevRows, updatedRow];

                                                                                    const now = new Date().toLocaleString();
                                                                                    console.log(`[${now}] ➕ New account budget added: "${account.account_name}" (${account.code}) - ₱${newBudget}`);

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
                                            </tbody>

                                            <tfoot>
                                                <tr>
                                                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'right' }}>Total from Accounts</td>
                                                    <td style={{ fontWeight: 'bold', textAlign: 'right' }}>
                                                        ₱{totalAllocatedFromAccounts.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>

                                                {formData.isPartOfCoverPwp && formData.coverPwpCode && selectedBalance !== null && (
                                                    <tr>
                                                        <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'right' }}>Balance - Total Allocated</td>
                                                        <td style={{
                                                            fontWeight: 'bold',
                                                            textAlign: 'right',
                                                            color: difference < 0 ? '#dc3545' : '#198754'
                                                        }}>
                                                            ₱{difference.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tfoot>
                                        </Table>
                                    </div>
                                )}
                            </Card.Body>


                        </Card>
                        <div className="d-flex justify-content-between align-items-center mt-4">
                            {/* Left: Previous Button */}
                            <Button variant="outline-secondary" onClick={handlePrevious}>
                                ← Previous
                            </Button>

                            {/* Right: Submit Button */}
                            <Button
                                variant="success"
                                onClick={submitAllData}
                                className="d-flex align-items-center"
                            >
                                <FaSave className="me-2" /> Submit
                            </Button>
                        </div>

                    </div>



                );

            // case 3:
            //     // File upload step
            //     return (
            //         <div className="card shadow-sm p-4">


            //             <form onSubmit={submit_all}>
            //                 <div className="col-12">
            //                     {formData.isPartOfCoverPwp && formData.coverPwpCode && remainingBalance !== null && (
            //                         <div className="row mt-4 gx-4 gy-4">
            //                             {/* Left: Regular PWPs Card */}
            //                             <div className="col-12 col-md-7">
            //                                 <div
            //                                     className="card p-4 animate-fade-slide-up shadow-sm h-100"
            //                                     style={{
            //                                         background: 'linear-gradient(135deg,rgb(11, 48, 168), #d9edf7)',
            //                                         borderRadius: '12px',
            //                                         border: '1px solid #99cfff',
            //                                         color: '#ffff',
            //                                         boxShadow: '0 4px 8px rgba(26, 62, 114, 0.15)',
            //                                     }}
            //                                 >
            //                                     <h3
            //                                         className="mb-0"
            //                                         style={{
            //                                             fontWeight: '700',
            //                                             letterSpacing: '2px',
            //                                             textTransform: 'uppercase',
            //                                             fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            //                                             textShadow: '1px 1px 2px rgba(26, 62, 114, 0.3)',
            //                                         }}
            //                                     >
            //                                         Regular PWPs
            //                                     </h3>
            //                                 </div>
            //                             </div>

            //                             {/* Right: Remaining Budget Card */}
            //                             <div className="col-12 col-md-5">
            //                                 <div className="card border-success shadow h-100">
            //                                     <div className="card-header bg-success text-white fw-bold text-center">
            //                                         Total Budget
            //                                     </div>
            //                                     <div className="card-body text-center d-flex align-items-center justify-content-center">
            //                                         <p
            //                                             className="card-text mb-0"
            //                                             style={{
            //                                                 fontSize: '2rem',
            //                                                 fontWeight: 'bold',
            //                                                 color: remainingBalance < 0 ? '#dc3545' : '#198754',
            //                                             }}
            //                                         >
            //                                             ₱{Number(remainingBalance).toLocaleString('en-PH', {
            //                                                 minimumFractionDigits: 2,
            //                                                 maximumFractionDigits: 2,
            //                                             })}
            //                                         </p>
            //                                     </div>
            //                                 </div>
            //                             </div>
            //                         </div>
            //                     )}
            //                 </div>
            //                 <h4 className="mb-3">Your Approval </h4>

            //                 <div className="table-responsive">
            //                     {loading ? (
            //                         <p>Loading approvals...</p>
            //                     ) : (
            //                         <table className="table table-bordered table-striped table-hover">
            //                             <thead className="table-success">
            //                                 <tr>
            //                                     <th>Approver</th>
            //                                     <th>Position</th>

            //                                     <th>Date Created</th>
            //                                 </tr>
            //                             </thead>
            //                             <tbody>
            //                                 {approvalList.length === 0 ? (
            //                                     <tr>
            //                                         <td colSpan="3" className="text-center">No approval data found.</td>
            //                                     </tr>
            //                                 ) : (
            //                                     approvalList.map(({ id, username, allowed_to_approve, created_at }) => (
            //                                         <tr key={id}>
            //                                             <td>{username}</td>
            //                                             <td>
            //                                                 {allowed_to_approve ? (
            //                                                     <span className="badge bg-success">Allowed</span>
            //                                                 ) : (
            //                                                     <span className="badge bg-warning text-dark">Not Allowed</span>
            //                                                 )}
            //                                             </td>
            //                                             <td>{created_at ? new Date(created_at).toLocaleDateString() : '-'}</td>
            //                                         </tr>
            //                                     ))
            //                                 )}
            //                             </tbody>

            //                         </table>
            //                     )}


            //                     <h4 className="mt-4">Attachments</h4>

            //                     <div
            //                         onDrop={handleDrop}
            //                         onDragOver={handleDragOver}
            //                         onClick={() => fileInputRef.current.click()}
            //                         className="border border-primary rounded p-4 mb-3"
            //                         style={{
            //                             cursor: 'pointer',
            //                             minHeight: '150px',
            //                             display: 'flex',
            //                             flexWrap: 'wrap',
            //                             gap: '10px',
            //                             alignItems: 'center',
            //                             justifyContent: files.length === 0 ? 'center' : 'flex-start',
            //                             backgroundColor: '#f8f9fa',
            //                             position: 'relative',
            //                             transition: 'background-color 0.3s',
            //                         }}
            //                     >
            //                         {files.length === 0 && <p className="text-muted">Drag & Drop files here or click to upload</p>}

            //                         {files.map((file, index) => (
            //                             <div
            //                                 key={index}
            //                                 className="position-relative"
            //                                 style={{
            //                                     width: '100px',
            //                                     height: '100px',
            //                                     border: '1px solid #ddd',
            //                                     borderRadius: '6px',
            //                                     overflow: 'hidden',
            //                                     textAlign: 'center',
            //                                     padding: '5px',
            //                                     backgroundColor: 'white',
            //                                     boxShadow: '0 0 4px rgba(0,0,0,0.1)',
            //                                 }}
            //                             >
            //                                 {file.type.startsWith('image/') ? (
            //                                     <img
            //                                         src={file.preview}
            //                                         alt={file.name}
            //                                         style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
            //                                     />
            //                                 ) : (
            //                                     <div style={{ fontSize: '12px', wordWrap: 'break-word', marginTop: '30px' }}>
            //                                         <i className="bi bi-file-earmark" style={{ fontSize: '28px', color: '#0d6efd' }}></i>
            //                                         <div>{file.name.length > 15 ? file.name.slice(0, 15) + '...' : file.name}</div>
            //                                     </div>
            //                                 )}
            //                                 <button
            //                                     type="button"
            //                                     onClick={(e) => {
            //                                         e.stopPropagation();
            //                                         removeFile(index);
            //                                     }}
            //                                     className="btn btn-sm btn-danger position-absolute top-0 end-0"
            //                                     style={{ borderRadius: '0 0 0 6px' }}
            //                                     title="Remove file"
            //                                 >
            //                                     &times;
            //                                 </button>
            //                             </div>
            //                         ))}

            //                         <input
            //                             type="file"
            //                             multiple
            //                             ref={fileInputRef}
            //                             onChange={handleFileInputChange}
            //                             style={{ display: 'none' }}
            //                         />
            //                     </div>
            //                 </div >

            //                 <div className="mt-4 d-flex justify-content-between">
            //                     <button className="btn btn-outline-secondary" onClick={handlePrevious}>
            //                         ← Previous
            //                     </button>

            //                     <Button
            //                         variant="success"
            //                         onClick={submit_all}
            //                         className="d-flex align-items-center"
            //                         style={{ marginTop: '1rem' }}
            //                     >
            //                         <FaSave className="me-2" /> Submit All
            //                     </Button>
            //                 </div>
            //             </form>
            //         </div >

            //     );

            default:
                return null;
        }
    };






    return <div style={{ padding: '30px', overflowX: 'auto' }} className="containes">{renderStepContent()}</div>;
};
const dropdownIconStyle = {
    position: 'absolute',
    right: '20px',
    top: '70%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: '#555',
    fontSize: '14px',
    userSelect: 'none',
};

const checkIconStyle = {
    position: 'absolute',
    right: '40px',
    top: '50%',
    transform: 'translateY(-20%)',
    color: 'green',
    fontWeight: 'bold',
    fontSize: '25px',
    pointerEvents: 'none',
    userSelect: 'none',
};

export default Claims_pwp;
