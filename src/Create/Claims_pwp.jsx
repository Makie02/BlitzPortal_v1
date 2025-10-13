
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
import { FiChevronRight } from "react-icons/fi"; // or FaArrowRight

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
        branchType: [], // add this

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


    const [hovered, setHovered] = useState(false);

    const borderColor = formData.company ? 'green' : hovered ? '#ccc' : '';
    const [accountTypes, setAccountTypes] = useState([]);





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





    const [accountSearchTerm, setAccountSearchTerm] = useState("");
    const [showModal_Account, setShowModal_Account] = useState(false);

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
                // Log full distributor info
                if (selectedDistributor) {
                    console.log(`📦 Selected Distributor:
Code: ${selectedDistributor.code}
Distributor: ${selectedDistributor.name}
Description: ${selectedDistributor.description?.trim() || "N/A"}`);
                } else {
                    console.log("⚠️ No distributor selected or found.");
                }

                // Log mother accounts info (even if null)
                console.log(
                    `🧾 Mother Accounts Name: ${selectedDistributor.mother_accounts_name ?? "null"
                    }`
                );
                console.log(
                    `🧾 Mother Accounts Code: ${selectedDistributor.mother_accounts_code ?? "null"
                    }`
                );
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


    const [UserID, setUserId] = React.useState(null); // ✅ Add this state
    const [name, setname] = React.useState("User");   // For logging/display if needed

    useEffect(() => {
        const storedUser = localStorage.getItem("loggedInUser");

        if (storedUser) {
            try {
                const userObj = JSON.parse(storedUser);

                // ✅ Extract UserID and name
                const uid = userObj.UserID || "Unknown ID";
                const userName = userObj.name || "User";

                // ✅ Set name and UserID to state
                setname(userName);
                setUserId(uid);

                // ✅ Log both to console
                console.log("[DEBUG] Logged in user info:");
                console.log("UserID:", uid);
                console.log("User Name:", userName);
            } catch (err) {
                console.error("[ERROR] Failed to parse loggedInUser from localStorage:", err);
                setname("User");
            }
        } else {
            console.warn("[DEBUG] No loggedInUser found in localStorage.");
        }
    }, []);


    const handleSubmitForm = async () => {
        // Validate only distributor, activity, and branch
        if (!formData.distributor || !formData.activity) {
            alert("Please fill in Distributor and Activity.");
            return;
        }

        if (!formData.branchType || formData.branchType.length === 0) {
            alert("Please select at least one Branch.");
            return;
        }

        const safeSelectedBalance = isNaN(selectedBalance) ? 0 : selectedBalance;

        // Normalize accountType to array
        const selectedAccountTypes = Array.isArray(formData.accountType)
            ? formData.accountType
            : formData.accountType
                ? [formData.accountType]
                : [];

        // ✅ Convert accountType IDs → Names
        const selectedAccountNames = selectedAccountTypes
            .map((id) => {
                const sub = Object.values(subAccounts).flat().find((s) => s.id === id);
                return sub ? sub.name : id; // fallback if not found
            })
            .filter(Boolean);

        // ✅ Use branch names directly (already names, not IDs)
        const selectedBranchNames = Array.isArray(formData.branchType)
            ? formData.branchType
            : formData.branchType
                ? [formData.branchType]
                : [];

        // Compute budget
        let amountBudget = 0;
        let remainingBudget = 0;

        if (formData.activityName === "BAD ORDER") {
            const totalAmount =
                formData.rowsCategories?.reduce((sum, row) => {
                    return sum + (parseFloat(row.amount) || 0);
                }, 0) || 0;

            amountBudget = totalAmount;
            remainingBudget = safeSelectedBalance - totalAmount;
        } else {
            const totalBudget = rowsAccounts
                .filter((row) => selectedAccountTypes.includes(row.account_code))
                .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);

            amountBudget = totalBudget;
            remainingBudget = safeSelectedBalance - totalBudget;
        }

        const createForm = UserID || "Unknown";

        // ✅ Build payload
        const payload = {
            code_pwp: formData.code_pwp || generateRegularCode(allRegularPwpCodes),
            distributor: formData.distributor,
            activity: formData.activity,

            // Save account + branch names
            account_types: selectedAccountNames,
            branchType: selectedBranchNames,

            category_codes: formData.categoryCode || [],
            category_names: formData.categoryName || [],
            amount_budget: amountBudget,
            remaining_budget: remainingBudget,
            createForm,
            pwp_type: "CLAIMS",
            notification: formData.notification || false,
            created_at: new Date().toISOString(),
        };

        try {
            const { data, error } = await supabase.from("Claims_pwp").insert([payload]);

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
                branchType: [],
                categoryCode: [],
                categoryName: [],
                amountbadget: "",
                code_pwp: "",
            });

            alert("✅ Claim submitted successfully!");
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

        // Normalize accountType to array
        const selectedAccountTypes = Array.isArray(formData.accountType)
            ? formData.accountType
            : formData.accountType
                ? [formData.accountType]
                : [];

        // Calculate total budget from account rows
        const totalBudget = rowsAccounts
            .filter(row => selectedAccountTypes.includes(row.account_code))
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


    // Ensure accountType is an array
    const selectedAccountTypes = Array.isArray(formData.accountType)
        ? formData.accountType
        : formData.accountType
            ? [formData.accountType]
            : [];

    // Ensure branchType is an array
    const selectedBranchTypes = Array.isArray(formData.branchType)
        ? formData.branchType
        : formData.branchType
            ? [formData.branchType]
            : [];

    // Total from sub-accounts
    const totalSubAccounts = rowsAccounts
        .filter(row => selectedAccountTypes.includes(row.account_code))
        .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);

    // Total from branches
    const totalBranches = rowsAccounts
        .filter(row => selectedBranchTypes.includes(row.account_name))
        .reduce((sum, row) => sum + (parseFloat(row.budget) || 0), 0);

    // Combined total
    const totalAllocatedFromAccounts = totalSubAccounts + totalBranches;

    // Remaining balance
    const difference = selectedBalance - totalAllocatedFromAccounts;


    // 🔍 Filter by code or name


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
        setSelectedMother(mother);

        if (!subAccounts[mother.id]) {
            const { data, error } = await supabase
                .from("user_mother_account_tags")
                .select("id, mother_account_name, mother_account_code, UserName") // include UserName
                .eq("mother_account_id", mother.id) // filter by mother id
                .order("mother_account_name");

            if (error) return console.error(error);

            const loggedInUsername = parsedUser?.name || "Unknown";
            console.log("[DEBUG] Logged in user:", loggedInUsername);

            // Filter by logged in username
            const filteredData = data.filter((item) => item.UserName === loggedInUsername);

            // map data so we can use `name` in JSX
            const formattedData = filteredData.map((item) => ({
                id: item.id,
                name: item.mother_account_name,
                code: item.mother_account_code,
            }));

            setSubAccounts((prev) => ({ ...prev, [mother.id]: formattedData }));
        }
    };


    const fetchBranches = async (motherAccountCode) => {
        try {
            const batchSize = 1000;
            let allData = [];
            let hasMore = true;
            let offset = 0;

            while (hasMore) {
                console.log(`📥 Fetching branches batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`);

                const { data, error } = await supabase
                    .from("sub_3_mother_account")
                    .select("*") // fetch full row data
                    .eq("sub_mother_dscode", motherAccountCode) // filter by mother_account_code
                    .not("branch", "is", null) // exclude nulls
                    .range(offset, offset + batchSize - 1);

                console.log(
                    `✅ Fetched branches batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`
                );

                if (error) {
                    console.error(error);
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

            // Extract unique branches with full details
            const uniqueBranches = [];
            const seen = new Set();

            allData.forEach((row) => {
                const branchName = row.branch?.trim();
                if (branchName && !seen.has(branchName)) {
                    seen.add(branchName);
                    uniqueBranches.push({
                        id: row.id,
                        name: branchName,
                        description: row.description || "",
                        status: row.status,
                        distributor_code: row.distributor_code,
                        distributor_name: row.distributor_name,
                        created_at: row.created_at,
                    });
                }
            });

            setBranchTypes(uniqueBranches);

            // Display everything in console clearly
            console.group(`🏢 Branches fetched for Mother Account Code: ${motherAccountCode}`);
            console.log(`🎉 Finished fetching all branches: ${allData.length} total records`);
            console.log(`✨ Unique branches: ${uniqueBranches.length}`);
            console.table(uniqueBranches);
            console.log("📋 Full Row Data:", allData);
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
                return found ? found.name : code;
            })
            .map((name) => (
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
                        marginRight: "5px",
                    }}
                >
                    {name}
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            setFormData({
                                ...formData,
                                branchType: formData.branchType.filter(
                                    (c) => branchTypes.find((b) => b.code === c)?.name !== name
                                ),
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
        selectedDistributor?.distributors
            ?.split(",")
            .map((code) => code.trim())
            .filter((code) => code !== "") || [];

    console.log("🧾 Raw mother_accounts_code:", selectedDistributor?.mother_accounts_code);


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
                                        {activities
                                            .filter(opt => opt.name === 'BAD ORDER' || opt.name === 'CREDITABLE WITHHOLDING TAX')
                                            .map((opt, index) => (
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
                                                                            >
                                                                                <strong>{cat.code}</strong> - {cat.name}
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
                                {/* Account Type */}
                                <div className="col-md-4" style={{ position: "relative" }}>
                                    <label>
                                        Mother Account <span style={{ color: "red" }}>*</span>
                                    </label>

                                    {/* Visible Input */}
                                    <div
                                        className="form-control"
                                        onClick={() => setShowModal_Account(true)}
                                        style={{
                                            cursor: "pointer",
                                            display: "flex",
                                            flexWrap: "wrap",
                                            alignItems: "center",
                                            gap: "5px",
                                            minHeight: "40px",
                                        }}
                                    >
                                        {/* Display selected accounts as tags */}
                                        {selectedMother?.name === "NON-CHAIN"
                                            ? Array.isArray(formData.accountType) &&
                                            formData.accountType.map((id) => {
                                                const sub = Object.values(subAccounts).flat().find((s) => s.id === id);
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

                                    {/* Modal */}
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
                                                                    <span style={{ color: "#888", fontSize: "12px" }}>
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

                                {/* Branch Input (Always visible) */}
                                <div className="col-md-4" style={{ position: "relative" }}>
                                    <label>
                                        Branch <span style={{ color: "red" }}>*</span>
                                    </label>

                                    {/* Branch Selector Box */}
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
                                        {formData.branchType.length > 0 ? (
                                            formData.branchType.map((name) => (
                                                <span
                                                    key={name}
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        backgroundColor: "#0050a5",
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
                                                                branchType: formData.branchType.filter((b) => b !== name),
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
                                            <span style={{ color: "#888" }}>Select Branches</span>
                                        )}
                                    </div>
                                </div>

                                {/* ✅ Branch Selection Modal */}
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
                                        {/* Search Bar */}
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
                                                // ✅ Filter and sort branches alphabetically
                                                const filteredBranches = branchTypes
                                                    .filter((b) =>
                                                        b.name.toLowerCase().includes(branchSearchTerm.toLowerCase())
                                                    )
                                                    .sort((a, b) =>
                                                        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                                                    );

                                                // ✅ If none, show empty state
                                                if (filteredBranches.length === 0) {
                                                    return (
                                                        <div style={{ textAlign: "center", color: "#999", marginTop: "20px" }}>
                                                            No branches found for the selected Sub Account.
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        {/* ✅ Display total filtered count */}
                                                        <p style={{ fontWeight: "bold", marginBottom: "10px" }}>
                                                            Showing {filteredBranches.length} branch
                                                            {filteredBranches.length !== 1 ? "es" : ""}
                                                        </p>

                                                        {/* ✅ Render filtered & sorted list */}
                                                        {filteredBranches.map((b) => (
                                                            <div
                                                                key={b.id}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    padding: "6px 0",
                                                                    marginLeft: "10px",
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.branchType.includes(b.name)}
                                                                    onChange={() => toggleBranchType(b.name)}
                                                                    id={`branch-${b.id}`}
                                                                    style={{
                                                                        width: "20px",
                                                                        height: "20px",
                                                                        transform: "scale(1.3)",
                                                                        cursor: "pointer",
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={`branch-${b.id}`}
                                                                    style={{ marginLeft: "8px", cursor: "pointer" }}
                                                                >
                                                                    {b.name}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </Modal.Body>

                                    <Modal.Footer style={{ display: "flex", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {/* ✅ Select All only from filtered list */}
                                            <Button
                                                variant="success"
                                                onClick={() => {
                                                    const filteredBranches = branchTypes
                                                        .filter((b) =>
                                                            b.name.toLowerCase().includes(branchSearchTerm.toLowerCase())
                                                        )
                                                        .sort((a, b) =>
                                                            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                                                        );

                                                    const names = filteredBranches.map((b) => b.name);
                                                    setFormData((prev) => ({ ...prev, branchType: names }));
                                                }}
                                            >
                                                Select All
                                            </Button>

                                            <Button
                                                variant="warning"
                                                onClick={() =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        branchType: [],
                                                    }))
                                                }
                                            >
                                                Clear All
                                            </Button>
                                        </div>

                                        <Button variant="light" onClick={() => setShowModal_Branch(false)}>
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
                                                    <th>Sub-Account Name</th>
                                                    <th>Budget</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {/* Display selected branch types */}
                                                {formData.branchType && formData.branchType.length > 0 && formData.branchType.map((branchName, index) => {
                                                    // Find if there’s an existing row for this branch in rowsAccounts
                                                    const existingRow = rowsAccounts.find(r => r.account_name === branchName) || {};
                                                    const budgetValue = existingRow.budget !== undefined ? existingRow.budget : "";

                                                    return (
                                                        <tr key={`branch-${index}`}>
                                                            <td>
                                                                <Form.Control value={branchName} disabled />
                                                            </td>
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={budgetValue === "" ? "" : budgetValue}
                                                                    onChange={e => {
                                                                        let newBudget = parseFloat(e.target.value);
                                                                        if (isNaN(newBudget)) newBudget = 0;

                                                                        const updatedRow = {
                                                                            id: existingRow.id || branchName,
                                                                            account_code: existingRow.account_code || branchName,
                                                                            account_name: branchName,
                                                                            budget: newBudget,
                                                                            created_at: existingRow.created_at || new Date().toISOString(),
                                                                        };

                                                                        setRowsAccounts(prevRows => {
                                                                            const existingIndex = prevRows.findIndex(r => r.account_name === branchName);
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
                                            </tbody>


                                            <tfoot>
                                                <tr>
                                                    <td style={{ fontWeight: 'bold', textAlign: 'right' }}>Total from Sub-Accounts</td>
                                                    <td style={{ fontWeight: 'bold', textAlign: 'right' }}>
                                                        ₱{totalAllocatedFromAccounts.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
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



            default:
                return null;
        }
    };




    return <div style={{ padding: '30px', overflowX: 'auto' }} className="containes">{renderStepContent()}</div>;
};


export default Claims_pwp;
