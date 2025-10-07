import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';  // <---- import sweetalert2
import { supabase } from '../supabaseClient';
import { Modal, Button } from 'react-bootstrap'; // Ensure react-bootstrap is installed

const getEmptyVolumePlanRow = () => ({
    itemCode: '',
    projectedAvgSales: '',
    UM: '',
    projectedAvgSalesAmount: '',
});

const getEmptyCostDetailsRow = () => ({
    costDetails: '',
    costRemark: '',
    quantity: '',
    unitCost: '',
    discount: '',
    totalCost: 0,
    chargeTo: '',
});

const CoverVisa = () => {
    const [formData, setFormData] = useState({
        visaCode: '',

        principal: '',
        brand: '',
        accountType: '',
        account: '',
        amountbadget: '',
        visaType: 'COVER',

        objective: '',
        promoScheme: '',
        details: '',
        remarks: '',
        Notification: false
    });

    const [volumePlanRows, setVolumePlanRows] = useState([getEmptyVolumePlanRow()]);

    const [currentStep, setCurrentStep] = useState(1);

    // Auto-generate Visa Code on mount
    useEffect(() => {
        const generateVisaCodeIfNeeded = async () => {
            const year = new Date().getFullYear();
            const prefix = `V${year}-`;
            const startNumber = 101;

            try {
                // Fetch all visaCodes from Supabase
                const { data, error } = await supabase
                    .from('Cover_Visa')
                    .select('visaCode');

                if (error) throw error;

                const existingNumbers = new Set();
                let codeExists = false;

                data.forEach(row => {
                    const code = row.visaCode;

                    if (typeof code === 'string' && code.startsWith(prefix)) {
                        if (code === formData.visaCode) {
                            codeExists = true; // The current visaCode is already in Supabase
                        }
                        const numPart = code.substring(prefix.length);
                        const num = parseInt(numPart, 10);
                        if (!isNaN(num)) {
                            existingNumbers.add(num);
                        }
                    }
                });

                if (codeExists && formData.visaCode) {
                    // Keep existing valid visaCode
                    setFormData(prev => ({ ...prev, visaCode: formData.visaCode }));
                } else {
                    // Generate next available visaCode
                    let nextNumber = startNumber;
                    while (existingNumbers.has(nextNumber)) {
                        nextNumber++;
                    }
                    const visaCode = `${prefix}${nextNumber}`;
                    setFormData(prev => ({ ...prev, visaCode }));
                }

            } catch (err) {
                console.error('Error checking/generating visa code:', err.message || err);
            }
        };

        generateVisaCodeIfNeeded();
    }, [formData.visaCode]);



    // Handle form input change
    const handleSubmitToSupabase = async () => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (!storedUser) {
            Swal.fire({
                icon: 'error',
                title: 'User not found',
                text: 'Please log in again.',
            });
            return;
        }

        // Validate required fields
        const requiredFields = ['visaCode', 'principal', 'brand', 'accountType', 'account'];
        const missingFields = requiredFields.filter(field => !formData[field] || formData[field].toString().trim() === '');

        if (missingFields.length > 0) {
            Swal.fire({
                icon: 'error',
                title: 'Missing Required Fields',
                text: `Please fill in: ${missingFields.join(', ')}`,
            });
            return;
        }

        // Insert into Cover_Visa
        const { data: coverVisaData, error: coverVisaError } = await supabase
            .from('Cover_Visa')
            .insert([{
                visaCode: formData.visaCode,
                principal: formData.principal,
                brand: formData.brand,
                accountType: formData.accountType,
                account: formData.account,
                amountbadget: formData.amountbadget,
                visaType: formData.visaType,
                objective: formData.objective,
                promoScheme: formData.promoScheme,
                details: formData.details,
                remarks: formData.remarks,
                Notification: formData.Notification,
                CreatedForm: storedUser.name
            }]);

        if (coverVisaError) {
            console.error("❌ Failed to insert into Cover_Visa:", coverVisaError);
            return;
        }

        // Insert into amount_badget
        const { error: amountBadgetError } = await supabase
            .from('amount_badget')
            .insert([{
                visacode: formData.visaCode,
                amountbadget: parseFloat(formData.amountbadget),
                createduser: storedUser.name,
                remainingbalance: parseFloat(formData.amountbadget),
                Approved: false,
            }]);

        if (amountBadgetError) {
            console.error("❌ Failed to insert into amount_badget:", amountBadgetError);
        } else {
            console.log("✅ Data successfully posted to amount_badget!");
        }
    };





    const submitVisaDetailsToSupabase = async () => {
        try {
            // Check if visaCode exists
            if (!formData.visaCode) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Visa Code',
                    text: 'Visa Code is required before submitting!',
                });
                return;
            }

            // Volume Plan rows
            const volumePlanPayload = volumePlanRows.map(row => ({
                visaCode: formData.visaCode,
                itemCode: row.itemCode || '',
                projectedAvgSales: parseFloat(row.projectedAvgSales) || 0,
                UM: row.UM || '',
                projectedAvgSalesAmount: parseFloat(row.projectedAvgSalesAmount) || 0,
                totalProjectedAvgSales: totalProjectedAvgSales || 0,
                totalProjectedAvgSalesAmount: parseFloat(totalProjectedAvgSalesAmount.toFixed(2)) || 0,
            }));

            // Cost Details rows
            const costDetailsPayload = costDetailsRows.map(row => ({
                visaCode: formData.visaCode,
                costDetails: row.costDetails || '',
                costRemark: row.costRemark || '',
                quantity: parseFloat(row.quantity) || 0,
                unitCost: parseFloat(row.unitCost) || 0,
                discount: parseFloat(row.discount) || 0,
                chargeTo: row.chargeTo || '',
                totalCostSum: parseFloat(totalCostSum.toFixed(2)),
                costToSales: parseFloat(costToSales.toFixed(2)),
            }));

            console.log('📤 Inserting Volume Plan to Supabase:', volumePlanPayload);
            const { error: volumeError } = await supabase
                .from('Cover_Visa_VolumePlan')
                .insert(volumePlanPayload);

            if (volumeError) {
                console.error('❌ VolumePlan Insert Failed:', volumeError);
                throw volumeError;
            }

            console.log('📤 Inserting Cost Details to Supabase:', costDetailsPayload);
            const { error: costError } = await supabase
                .from('Cover_Visa_CostDetails')
                .insert(costDetailsPayload);

            if (costError) {
                console.error('❌ CostDetails Insert Failed:', costError);
                throw costError;
            }

            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Both Volume Plan and Cost Details were submitted to Supabase successfully.',
            });

        } catch (err) {
            console.error('❌ submitVisaDetailsToSupabase error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: 'Could not submit to Supabase. Check console for details.',
            });
        }
    };





    function handleFormChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'account') {
            console.log('Account selected:', value);
        }
    }
    // Volume Plan table handlers
    const handleVolumePlanChange = (index, e) => {
        const { name, value } = e.target;
        const rows = [...volumePlanRows];
        rows[index][name] = value;
        setVolumePlanRows(rows);
    };

    const addVolumePlanRow = () => {
        setVolumePlanRows(prev => [...prev, getEmptyVolumePlanRow()]);
    };

    const deleteVolumePlanRow = (index) => {
        setVolumePlanRows(prev => prev.filter((_, i) => i !== index));
    };

    // Cost Details table handlers






    // Totals for Volume Plan table
    const totalProjectedAvgSales = volumePlanRows.reduce(
        (acc, row) => acc + (parseFloat(row.projectedAvgSales) || 0),
        0
    );

    const totalProjectedAvgSalesAmount = volumePlanRows.reduce(
        (acc, row) => acc + (parseFloat(row.projectedAvgSalesAmount) || 0),
        0
    );

    // Navigation handlers
    const nextStep = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };



    const [costDetailsRows, setCostDetailsRows] = useState([
        {
            costDetails: '',
            costRemark: '',
            quantity: 0,
            unitCost: 0,
            discount: 0,
            chargeTo: '-',
        },
    ]);

    const handleCostDetailsChange = (index, e) => {
        const { name, value } = e.target;
        const rows = [...costDetailsRows];
        rows[index][name] = ['quantity', 'unitCost', 'discount'].includes(name)
            ? parseFloat(value)
            : value;
        setCostDetailsRows(rows);
    };

    const calculateRowTotalCost = (row) => {
        const quantity = parseFloat(row.quantity) || 0;
        const unitCost = parseFloat(row.unitCost) || 0;
        const discount = parseFloat(row.discount) || 0; // ← Default to 0 if no discount

        const subtotal = quantity * unitCost;
        const discountAmount = subtotal * (discount / 100);
        return subtotal - discountAmount;
    };


    const deleteCostDetailsRow = (index) => {
        const rows = [...costDetailsRows];
        rows.splice(index, 1);
        setCostDetailsRows(rows);
    };

    const addCostDetailsRow = () => {
        setCostDetailsRows([
            ...costDetailsRows,
            {
                costDetails: '',
                costRemark: '',
                quantity: 0,
                unitCost: 0,
                discount: 0,
                chargeTo: '-',
            },
        ]);
    };

    const totalCostSum = costDetailsRows.reduce(
        (acc, row) => acc + calculateRowTotalCost(row),
        0
    );

    const costToSales = totalCostSum;

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
                Action: 'Create Form Cover PWP',
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






    const [submitAction, setSubmitAction] = useState(null);

    const handleSubmits = async (e) => {
        e.preventDefault();

        if (submitAction === 'submit') {
        } else {
            handleNext(); // Your own step management function
        }

        setSubmitAction(null); // reset state after action
    };


    const handleNext = (e) => {
        e.preventDefault();
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };




    const handleSubmitToApprovers = async () => {
        if (!formData.visaCode) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Visa Code',
                text: 'Visa Code is required before submitting!',
            });
            return;
        }

        try {
            console.log("📂 Preparing files for optional upload...");
            let encodedFiles = [];

            if (files.length > 0) {
                const filePromises = files.map((file) => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            resolve({
                                visaCode: formData.visaCode,
                                name: file.name,
                                type: file.type,
                                size: file.size,
                                content: reader.result, // 🔥 base64 content
                                uploadedAt: new Date().toISOString(),
                            });
                        };
                        reader.onerror = (error) => reject(error);
                        reader.readAsDataURL(file); // ⬅️ base64 encode
                    });
                });

                encodedFiles = await Promise.all(filePromises);
                console.log("✅ Files encoded:", encodedFiles);

                // 🧾 Save to Supabase Table only
                const { data: supaData, error: supaError } = await supabase
                    .from('Cover_Visa_Attachments')
                    .insert(encodedFiles);

                if (supaError) {
                    console.error("❌ Supabase metadata insert error:", supaError);
                } else {
                    console.log("✅ Metadata inserted into Supabase DB:", supaData);
                }
            } else {
                console.log("ℹ️ No files uploaded. Skipping Supabase attachment update.");
            }

            // 🧾 Submit all other data
            await handleSubmitToSupabase();
            await submitVisaDetailsToSupabase();

            // Get UserId from localStorage or however you track it
            const storedUser = JSON.parse(localStorage.getItem('user'));
            if (storedUser && storedUser.id) {
                await saveRecentActivity({ UserId: storedUser.id });
            } else {
                console.warn('⚠️ User ID not found, skipping activity logging.');
            }

            Swal.fire({
                icon: 'success',
                title: 'Submitted!',
                text: files.length > 0
                    ? 'Form and attachments uploaded successfully.'
                    : 'Form submitted without attachments.',
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.reload();
                }
            });

            setFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error) {
            console.error("❌ Upload Error:", error);
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: 'There was a problem during submission. Check the console for details.',
            });
        }
    };





    const [options, setOptions] = useState([]);
    const [company, setCompany] = useState([]);
    const [salesDivisions, setSalesDivisions] = useState([]);
    const [accountTypes, setAccountTypes] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [visaTypes, setVisaTypes] = useState([]);
    const [chargeTo, setChargeTo] = useState([]);
    const [principal, setPrincipal] = useState([]);

    const [groupAccount, setGroupAccount] = useState([]);



    useEffect(() => {
        let isMounted = true;

        const fetchCompanies = async () => {
            const { data, error } = await supabase
                .from("References")           // your table name
                .select("*")
                .eq("reference_type", "Company");

            if (error) {
                console.error("Error fetching Company:", error);
            } else if (isMounted) {
                setCompany(data); // set state with the array of results
            }
        };

        fetchCompanies();

        return () => {
            isMounted = false; // cleanup to avoid setting state if unmounted
        };
    }, []);


    useEffect(() => {
        let isMounted = true;

        const fetchSalesDivisions = async () => {
            const { data, error } = await supabase
                .from("References")
                .select("*")
                .eq("reference_type", "SalesDivision");

            if (error) {
                console.error("Error fetching SalesDivisions:", error);
                if (isMounted) setSalesDivisions([]);
            } else if (isMounted) {
                setSalesDivisions(data || []);
            }
        };

        fetchSalesDivisions();

        return () => {
            isMounted = false;
        };
    }, []);




    // Load all account types on mount
    useEffect(() => {
        if (!formData.accountType) {
            setGroupAccount([]); // clear when no accountType selected
            return;
        }

        let isMounted = true;

        const fetchGroupAccountsByParentName = async () => {
            // Get the AccountType's name by id
            const { data: accountTypeData, error: accountTypeError } = await supabase
                .from("References")
                .select("name")
                .eq("id", formData.accountType)
                .single();

            if (accountTypeError) {
                console.error("Error fetching AccountType name:", accountTypeError);
                if (isMounted) setGroupAccount([]);
                return;
            }

            if (!accountTypeData) {
                if (isMounted) setGroupAccount([]);
                return;
            }

            const parentName = accountTypeData.name;

            // Fetch GroupAccounts where parent_id = AccountType name
            const { data: groupAccounts, error: groupAccountError } = await supabase
                .from("References")
                .select("*")
                .eq("reference_type", "GroupAccount")
                .eq("parent_id", parentName);

            if (groupAccountError) {
                console.error("Error fetching GroupAccounts:", groupAccountError);
                if (isMounted) setGroupAccount([]);
                return;
            }

            if (isMounted) setGroupAccount(groupAccounts || []);
        };

        fetchGroupAccountsByParentName();

        return () => {
            isMounted = false;
        };
    }, [formData.accountType]);


    const [Costdetails, setCostdetails] = useState([]);

    useEffect(() => {
        let isMounted = true;

        const fetchAccountTypes = async () => {
            const { data, error } = await supabase
                .from("References")
                .select("*")
                .eq("reference_type", "CostDetail");

            if (error) {
                console.error("Error fetching AccountTypes:", error);
            } else if (isMounted) {
                setCostdetails(data);
            }
        };

        fetchAccountTypes();

        return () => {
            isMounted = false;
        };
    }, []);



    // Load group account list when accountType is selected
    useEffect(() => {
        let isMounted = true;

        const fetchAccountTypes = async () => {
            const { data, error } = await supabase
                .from("References")
                .select("*")
                .eq("reference_type", "AccountType");

            if (error) {
                console.error("Error fetching AccountTypes:", error);
            } else if (isMounted) {
                setAccountTypes(data);
            }
        };

        fetchAccountTypes();

        return () => {
            isMounted = false;
        };
    }, []);


    // Load group account list when accountType is selected






    useEffect(() => {
        let isMounted = true;

        const fetcChargeTo = async () => {
            const { data, error } = await supabase
                .from("References")
                .select("*")
                .eq("reference_type", "ChargeTo");

            if (error) {
                console.error("Error fetching AccountTypes:", error);
            } else if (isMounted) {
                setChargeTo(data);
            }
        };

        fetcChargeTo();

        return () => {
            isMounted = false;
        };
    }, []);




    const formatCurrency = (value) => {
        if (value === '') return '';
        const number = parseFloat(value);
        if (isNaN(number)) return value;
        return number.toLocaleString('en-US', {
            maximumFractionDigits: 0, // No decimal places
        });
    };




    useEffect(() => {
        let isMounted = true;

        const fetchPrincipals = async () => {
            const { data, error } = await supabase
                .from("References")
                .select("*")
                .eq("reference_type", "Principals");

            if (error) {
                console.error("Error fetching Activity data:", error);
            } else if (isMounted) {
                setPrincipal(data); // or setActivity if that’s the correct spelling
            }
        };

        fetchPrincipals();

        return () => {
            isMounted = false;
        };
    }, []);


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





    // When principal changes, filter brands

    const [singleApprovals, setSingleApprovals] = useState([]);
    const [userApprovers, setUserApprovers] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // Fetch singleapprovals
            const { data: approvalsData, error: approvalsError } = await supabase
                .from('singleapprovals')
                .select('*')
                .order('created_at', { ascending: false });

            // Fetch user approvers
            const { data: userApproversData, error: userApproversError } = await supabase
                .from('User_Approvers')
                .select('*')
                .order('created_at', { ascending: false });

            // Fetch users for name lookup
            const { data: usersData, error: usersError } = await supabase
                .from('Account_Users')
                .select('UserID, name');

            if (approvalsError) console.error('Error fetching approvals:', approvalsError);
            if (userApproversError) console.error('Error fetching user approvers:', userApproversError);
            if (usersError) console.error('Error fetching users:', usersError);

            setSingleApprovals(approvalsData || []);
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



    // runs whenever coverVisas changes
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const handleBrandSelect = (brand) => {
        setFormData(prev => ({ ...prev, brand }));
        setShowModal(false);
    };

    const handleInputClick = () => {
        if (formData.principal) {
            setShowModal(true);
        }
    };

    const filteredList = filteredBrands.filter(brand =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const [showAccountSearchModal, setShowAccountSearchModal] = useState(false);
    const [accountSearchTerm, setAccountSearchTerm] = useState('');
    const [showSupportTypeModal, setShowSupportTypeModal] = useState(false);
    const [supportSearch, setSupportSearch] = useState('');
    const [showCoverModal, setShowCoverModal] = useState(false);
    const [coverVisaSearch, setCoverVisaSearch] = useState('');
    return (
        <div style={{ padding: '30px', height: "90vh", }} className="containers">
            <div className="row align-items-center mb-4">
                <div className="col-12 col-md-6">
                    <div
                        className="card p-4 animate-fade-slide-up shadow-sm"
                        style={{
                            background: 'linear-gradient(135deg, #a8d0ff, #d9edf7)', // gentle blue gradient
                            borderRadius: '12px',
                            border: '1px solid #99cfff',
                            color: '#1a3e72',
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
                            Cover PWP
                        </h3>
                    </div>
                </div>

                <div className="col-12 col-md-6 text-md-end pt-3 pt-md-0">

                </div>
            </div>

            {currentStep === 1 && (
                <form style={{ marginTop: '50px' }} onSubmit={handleSubmits}>
                    <h2
                        className="fw-bold mb-0"
                        style={{
                            letterSpacing: '1px',
                            fontSize: '24px',
                            marginBottom: '50px',
                            textAlign: 'right',  // <-- added this line
                        }}
                    >
                        {' '}
                        <span className={formData.visaCode ? 'text-danger' : 'text-muted'}>
                            {formData.visaCode || 'N/A'}
                        </span>
                    </h2>
                    <div className="row g-3">

                        {/* <div className="col-md-4" style={{ position: 'relative' }}>
                            <label className="form-label">Company</label>
                            <select
                                name="company"
                                className="form-control"
                                value={formData.company}
                                onChange={handleFormChange}
                                required
                            >
                                <option value="">Select Company</option>
                                {company.map((opt, index) => (
                                    <option key={index} value={opt.name || opt}>
                                        {opt.name || opt}
                                    </option>
                                ))}
                            </select>
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

                            {formData.company !== '' && (
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
                        </div> */}
                        <div className="col-md-4" style={{ position: 'relative' }}>
                            <label className="form-label">
                                Distributor <span style={{ color: 'red' }}>*</span>
                            </label>
                            <select
                                name="principal"
                                className="form-control"
                                value={formData.principal}
                                onChange={handleFormChange}
                                style={{ paddingRight: '30px' }}
                            >
                                <option value="">Select Distributor</option>
                                {principal.map((opt, index) => (
                                    <option key={index} value={opt.name}>
                                        {opt.name}
                                    </option>
                                ))}
                            </select>
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
                            {formData.principal !== '' && (
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

                        {/* Brand */}
                        <div className="col-md-4" style={{ position: 'relative' }}>
                            <label style={{ marginBottom: '10px' }} >Brand <span style={{ color: 'red' }}>*</span> </label>

                            <input
                                type="text"
                                readOnly
                                className="form-control"
                                value={formData.brand || ''}
                                onClick={handleInputClick}
                                placeholder="Select Brand"
                                style={{
                                    cursor: formData.principal ? 'pointer' : 'not-allowed',
                                    borderColor: formData.brand ? 'green' : '',
                                    transition: 'border-color 0.3s',
                                    paddingRight: '35px'
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
                            {formData.brand && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        right: '35px',
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

                            {/* Modal */}
                            <Modal show={showModal} onHide={() => setShowModal(false)} centered>


                                <Modal.Header
                                    closeButton
                                    style={{
                                        background: "rgb(70, 137, 166)",
                                        color: "white",
                                    }}
                                >
                                    <Modal.Title style={{ color: 'white' }} className="w-100 text-center">
                                        🧾 Select a Brand
                                    </Modal.Title>
                                </Modal.Header>
                                <Modal.Body>
                                    <input
                                        type="text"
                                        className="form-control mb-3"
                                        placeholder="Search brand..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />

                                    <ul className="list-group" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {filteredList.length > 0 ? (
                                            filteredList.map((brand, idx) => (
                                                <li
                                                    key={idx}
                                                    className="list-group-item list-group-item-action"
                                                    onClick={() => handleBrandSelect(brand.name)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {brand.name}
                                                </li>
                                            ))
                                        ) : (
                                            <li className="list-group-item text-muted">No brands found</li>
                                        )}
                                    </ul>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button variant="secondary" onClick={() => setShowModal(false)}>
                                        Close
                                    </Button>
                                </Modal.Footer>
                            </Modal>
                        </div>


                        {/* <div className="col-md-4" style={{ position: 'relative' }}>
                            <label className="form-label">Sales Division</label>
                            <select
                                name="salesDivision"
                                className="form-control"
                                value={formData.salesDivision}
                                onChange={handleFormChange}
                                style={{ paddingRight: '30px' }}
                            >
                                <option value="">Select Sales Division</option>
                                {salesDivisions.map((opt, index) => (
                                    <option key={index} value={opt.name || opt}>
                                        {opt.name || opt}
                                    </option>
                                ))}
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

                            </select>
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
                            {formData.salesDivision !== '' && (
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
                        </div> */}

                        {/* Account Type */}
                        <div className="col-md-4" style={{ position: 'relative' }}>
                            <label className="form-label">
                                Account Group <span style={{ color: 'red' }}>*</span>
                            </label>
                            <select
                                name="accountType"
                                className="form-control"
                                value={formData.accountType}
                                onChange={handleFormChange}
                                style={{
                                    paddingRight: '30px',
                                    transition: 'border-color 0.3s',
                                }}
                            >
                                <option value="">Select Account Type</option>
                                {accountTypes.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                            <span style={{ ...dropdownIconStyle }}>▼</span>
                            {formData.accountType && <span style={{ ...checkIconStyle }}>✓</span>}
                        </div>

                        {/* Account */}
                        <div className="col-md-4" style={{ position: 'relative' }}>
                            <label className="form-label">Account <span style={{ color: 'red' }}>*</span> </label>

                            <input
                                type="text"
                                className="form-control"
                                readOnly
                                value={formData.account || ''}
                                onClick={() => {
                                    if (formData.accountType) setShowAccountSearchModal(true);
                                }}
                                placeholder="Search Group Account..."
                                style={{
                                    paddingRight: '80px',
                                    cursor: formData.accountType ? 'pointer' : 'not-allowed',
                                    borderColor: formData.account ? 'green' : '',
                                    transition: 'border-color 0.3s',
                                }}
                                disabled={!formData.accountType}
                            />

                            {/* Magnifying Glass */}
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

                            {/* Checkmark */}
                            {formData.account && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        right: '35px',
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

                            {/* Modal for Account Selection */}
                            <Modal
                                show={showAccountSearchModal}
                                onHide={() => setShowAccountSearchModal(false)}
                                centered
                            >
                                <Modal.Header
                                    closeButton
                                    style={{
                                        background: "rgb(70, 137, 166)",
                                        color: "white",
                                    }}
                                >
                                    <Modal.Title style={{ color: 'white' }} className="w-100 text-center">
                                        🧾 Search  Account
                                    </Modal.Title>
                                </Modal.Header>
                                <Modal.Body>
                                    <input
                                        type="text"
                                        className="form-control mb-3"
                                        placeholder="Search account..."
                                        value={accountSearchTerm}
                                        onChange={(e) => setAccountSearchTerm(e.target.value)}
                                    />

                                    <ul className="list-group" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {groupAccount
                                            .filter((opt) =>
                                                opt.name.toLowerCase().includes(accountSearchTerm.toLowerCase())
                                            )
                                            .map((opt, idx) => (
                                                <li
                                                    key={idx}
                                                    className="list-group-item list-group-item-action"
                                                    onClick={() => {
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            account: opt.name,
                                                            accountName: opt.name,
                                                        }));
                                                        setShowAccountSearchModal(false);
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {opt.name}
                                                </li>
                                            ))}
                                        {groupAccount.filter((opt) =>
                                            opt.name.toLowerCase().includes(accountSearchTerm.toLowerCase())
                                        ).length === 0 && (
                                                <li className="list-group-item text-muted">No accounts found</li>
                                            )}
                                    </ul>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button variant="secondary" onClick={() => setShowAccountSearchModal(false)}>
                                        Close
                                    </Button>
                                </Modal.Footer>
                            </Modal>
                        </div>

                        <div className="col-md-4" style={{ position: 'relative' }}>
                            <label className="form-label">
                                Amount Budget <span style={{ color: 'red' }}>*</span>
                            </label>
                            <input
                                type="text"
                                name="amountbadget"
                                className="form-control"
                                value={formatCurrency(formData.amountbadget)}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/,/g, '');
                                    if (/^[0-9]*\.?[0-9]*$/.test(rawValue)) {
                                        handleFormChange({ target: { name: 'amountbadget', value: rawValue } });
                                    }
                                }}
                                style={{ paddingRight: '30px' }}
                            />
                            {formData.amountbadget !== '' && (
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

                        <div className="col-md-4" style={{ position: 'relative' }}>
                            <label className="form-label" style={{ color: '#888' }}>
                                Marketing Type
                            </label>
                            <select
                                name="visaType"
                                className="form-control"
                                value={formData.visaType}
                                onChange={handleFormChange}
                                style={{ paddingRight: '30px', textTransform: 'uppercase', backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                                disabled
                            >
                                <option value="COVER">COVER</option>
                            </select>

                            {formData.visaType !== '' && (
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




                        {/* <div className="col-md-4" style={{ position: 'relative' }}>
                            <label className="form-label">Marketing Title</label>
                            <input
                                type="text"
                                name="visaTitle"
                                className="form-control"
                                value={formData.visaTitle}
                                onChange={handleFormChange}
                                style={{ paddingRight: '30px' }}
                            />
                            {formData.visaTitle !== '' && (
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
                        </div> */}

                        <div className="col-12" style={{ position: 'relative' }}>
                            <label className="form-label">Objective</label>
                            <textarea
                                name="objective"
                                className="form-control"
                                value={formData.objective}
                                onChange={handleFormChange}
                                style={{ paddingRight: '30px' }}
                            />
                            {formData.objective !== '' && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        right: '20px',
                                        top: '20px',
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

                        <div className="col-12" style={{ position: 'relative' }}>
                            <label className="form-label">Promo Scheme</label>
                            <textarea
                                name="promoScheme"
                                className="form-control"
                                value={formData.promoScheme}
                                onChange={handleFormChange}
                                style={{ paddingRight: '30px' }}
                            />
                            {formData.promoScheme !== '' && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        right: '20px',
                                        top: '20px',
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

                        <div className="col-12" style={{ position: 'relative' }}>
                            <label className="form-label">Details</label>
                            <textarea
                                name="details"
                                className="form-control"
                                value={formData.details}
                                onChange={handleFormChange}
                                style={{ paddingRight: '30px' }}
                            />
                            {formData.details !== '' && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        right: '20px',
                                        top: '20px',
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

                    <div className="mt-4 d-flex justify-content-end gap-3">
                        <button className="btn btn-primary" onClick={handleNext}>
                            Next →
                        </button>


                    </div>
                </form>

            )}

            {currentStep === 2 && (
                <><div className="mb-3" style={{ textAlign: 'right' }}>
                    <h5>
                        Total of Balances Budget: <span style={{ color: 'green' }}>PHP {formatCurrency(formData.amountbadget)}</span>
                    </h5>
                </div>

                    <h5>Volume Plan</h5>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table table-bordered">
                            <thead>
                                <tr style={{ backgroundColor: 'black', color: 'white' }}>
                                    <th>Item Code</th>
                                    <th>Projected Average Sales</th>
                                    <th>UM</th>
                                    <th>Projected Average Sales Amount</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {volumePlanRows.map((row, i) => (
                                    <tr key={i}>
                                        <td><input type="text" name="itemCode" className="form-control" value={row.itemCode} onChange={e => handleVolumePlanChange(i, e)} /></td>
                                        <td><input type="number" name="projectedAvgSales" className="form-control" value={row.projectedAvgSales} onChange={e => handleVolumePlanChange(i, e)} /></td>
                                        <td style={{ position: "relative" }}>
                                            <select
                                                name="UM"
                                                className="form-control"
                                                value={row.UM}
                                                onChange={e => handleVolumePlanChange(i, e)}
                                                style={{
                                                    appearance: "none",
                                                    WebkitAppearance: "none",
                                                    MozAppearance: "none",
                                                    paddingRight: "30px"
                                                }}
                                            >
                                                <option value="">-</option>
                                                <option value="Cases">Cases</option>
                                                <option value="IBX">IBX</option>
                                                <option value="PC">PC</option>
                                            </select>

                                            {/* Arrow icon */}
                                            <span
                                                style={{
                                                    position: "absolute",
                                                    right: "20px",
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    pointerEvents: "none",
                                                    color: "#555",
                                                    fontSize: "14px"
                                                }}
                                            >
                                                ▼
                                            </span>
                                        </td>

                                        <td><input type="number" name="projectedAvgSalesAmount" className="form-control" value={row.projectedAvgSalesAmount} onChange={e => handleVolumePlanChange(i, e)} /></td>
                                        <td className="text-center">
                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteVolumePlanRow(i)}> <i className="fas fa-trash-alt"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th>Total</th>
                                    <th>{totalProjectedAvgSales}</th>
                                    <th></th>
                                    <th>{totalProjectedAvgSalesAmount.toFixed(2)}</th>
                                    <th></th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <button className="btn btn-success mb-3" onClick={addVolumePlanRow}>+ Add Row</button>


                    <h5>Cost Details</h5>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Cost Details</th>
                                    <th>Cost Remark</th>
                                    <th>Quantity</th>
                                    <th>Unit Cost</th>
                                    <th>Discount %</th>
                                    <th>Total Cost</th>
                                    <th>ChargeTo</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {costDetailsRows.map((row, i) => (
                                    <tr key={i}>
                                        <td style={{ position: "relative" }}>
                                            <select
                                                name="costDetails"
                                                className="form-control"
                                                value={row.costDetails || ''}
                                                onChange={(e) => handleCostDetailsChange(i, e)}
                                                style={{
                                                    appearance: "none",
                                                    WebkitAppearance: "none",
                                                    MozAppearance: "none",
                                                    paddingRight: "30px"
                                                }}
                                            >
                                                <option value="">-- Select Cost Detail --</option>
                                                {Costdetails.map((item, index) => (
                                                    <option key={index} value={item.name}>
                                                        {item.name}
                                                    </option>
                                                ))}
                                            </select>

                                            {/* Custom arrow */}
                                            <span
                                                style={{
                                                    position: "absolute",
                                                    right: "20px",
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    pointerEvents: "none",
                                                    color: "#555",
                                                    fontSize: "14px",
                                                    userSelect: "none"
                                                }}
                                            >
                                                ▼
                                            </span>
                                        </td>



                                        <td>
                                            <input
                                                type="text"
                                                name="costRemark"
                                                className="form-control"
                                                value={row.costRemark}
                                                onChange={(e) => handleCostDetailsChange(i, e)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                name="quantity"
                                                className="form-control"
                                                value={row.quantity}
                                                onChange={(e) => handleCostDetailsChange(i, e)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                name="unitCost"
                                                className="form-control"
                                                value={row.unitCost}
                                                onChange={(e) => handleCostDetailsChange(i, e)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                name="discount"
                                                className="form-control"
                                                value={row.discount}
                                                onChange={(e) => handleCostDetailsChange(i, e)}
                                            />
                                        </td>
                                        <td>PHP {calculateRowTotalCost(row).toFixed(2)}</td>
                                        <td style={{ position: 'relative' }}>
                                            <select
                                                name="visaType"
                                                className="form-control"
                                                value={formData.chargeTo}
                                                onChange={handleFormChange}
                                                style={{
                                                    paddingRight: '30px',
                                                    appearance: 'none',
                                                    WebkitAppearance: 'none',
                                                    MozAppearance: 'none',
                                                }}
                                            >
                                                <option value="">Select Visa Type</option>
                                                {chargeTo.map((opt, index) => (
                                                    <option key={index} value={opt.name || opt}>
                                                        {opt.name || opt}
                                                    </option>
                                                ))}
                                            </select>

                                            {/* Custom arrow */}
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    right: '20px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    pointerEvents: 'none',
                                                    color: '#555',
                                                    fontSize: '14px',
                                                    userSelect: 'none',
                                                }}
                                            >
                                                ▼
                                            </span>
                                        </td>

                                        <td className="text-center">
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm"
                                                onClick={() => deleteCostDetailsRow(i)}
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                        Total
                                    </td>
                                    <td style={{ fontWeight: 'bold' }}>
                                        PHP {totalCostSum.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td colSpan={2} style={{ fontWeight: 'bold' }}>
                                        PHP {costToSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>

                            </tfoot>
                        </table>

                    </div>
                    <button className="btn btn-success mb-3" onClick={addCostDetailsRow}>+ Add Row</button>

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
                    <div className="d-flex justify-content-between">
                        <button className="btn btn-outline-secondary" onClick={prevStep}>← Previous</button>
                        <button className="btn btn-primary" onClick={nextStep}>Next →</button>
                    </div>
                </>
            )}

            {currentStep === 3 && (
                <>
                    <div className="card shadow-sm p-4">
                        <h4 className="mb-3">Approval List</h4>

                        <div className="table-responsive">
                            {loading ? (
                                <p>Loading approvals...</p>
                            ) : (
                                <table className="table table-bordered table-striped table-hover">
                                    <thead className="table-success">
                                        <tr>
                                            <th>Approver</th>
                                            <th>Position</th>
                                            <th>Status</th>
                                            <th>Type</th>
                                            <th>Date Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {combinedData.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="text-center">
                                                    No data found.
                                                </td>
                                            </tr>
                                        ) : (
                                            combinedData.map(({ id, approver, position, status, type, created_at }) => (
                                                <tr key={id}>
                                                    <td>{approver}</td>
                                                    <td>{position || '-'}</td>
                                                    <td>
                                                        {status ? (
                                                            <span
                                                                className={`badge ${status === 'Approved' ? 'bg-success' : 'bg-warning text-dark'
                                                                    }`}
                                                            >
                                                                {status}
                                                            </span>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </td>
                                                    <td>{type || '-'}</td>
                                                    <td>{created_at ? new Date(created_at).toLocaleDateString() : '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
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


                        <div className="mt-4 d-flex justify-content-between">
                            <button className="btn btn-outline-secondary" onClick={prevStep}>← Previous</button>

                            <button className="btn btn-success" onClick={handleSubmitToApprovers}>
                                Submit To Approvers
                            </button>                    </div>
                    </div>


                </>
            )}


        </div >
    );
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

export default CoverVisa;
