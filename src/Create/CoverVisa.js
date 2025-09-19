import React, { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';  // <---- import sweetalert2
import { supabase } from '../supabaseClient';
import { Modal, Button } from 'react-bootstrap'; // Ensure react-bootstrap is installed


const CoverVisa = () => {
    const [formData, setFormData] = useState({
        visaCode: '',
        coverCode: '',
        distributor: '',
        principal: '',
        accountType: '',

        amountbadget: '',
        PWPType: 'COVER',

        objective: '',
        promoScheme: '',
        details: '',
        remarks: '',
        Notification: false
    });


    const [currentStep, setCurrentStep] = useState(1);

    // Auto-generate Visa Code on mount














    const handleFormChange = async (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));


        if (name === "distributor") {
            try {
                const selectedDistributor = distributors.find((d) => d.code === value);

                if (!selectedDistributor) {
                    console.warn("Distributor not found.");
                    return;
                }

                const { data, error } = await supabase
                    .from("categorydetails")
                    .select("id, code, name, description")
                    .eq("principal_id", selectedDistributor.id);

                if (error) throw error;

                const formatted = data.map((item) => ({
                    id: item.id,
                    code: item.code,
                    name: item.name,
                    description: item.description,
                }));

                setAccountTypes(formatted);
                setAccountSearchTerm("");
                // Reset selected accounts when distributor changes
                setFormData((prev) => ({ ...prev, accountType: [] }));

                console.log("✅ Fetched categories for distributor:", formatted);
            } catch (error) {
                console.error("❌ Failed to fetch category details:", error.message);
                setAccountTypes([]);
            }
        }
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
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



    const handleNext = (e) => {
        e.preventDefault();
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
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

    //albert
    const [approvedExpenses, setApprovedExpenses] = useState(0);
    const [remainingBudget, setRemainingBudget] = useState(0);

    //albert
    // Add this useEffect to calculate remaining budget whenever amount budget or approved expenses change
    useEffect(() => {
        const amountBudget = parseFloat(formData.amountbadget) || 0;
        const remaining = amountBudget - approvedExpenses;
        setRemainingBudget(remaining);
    }, [formData.amountbadget, approvedExpenses]);















    const formatCurrency = (value) => {
        if (value === '') return '';
        const number = parseFloat(value);
        if (isNaN(number)) return value;
        return number.toLocaleString('en-US', {
            maximumFractionDigits: 0, // No decimal places
        });
    };



    //albert 
    useEffect(() => {
        const fetchApprovedExpenses = async () => {
            if (!formData.visaCode) return;

            try {
                // Fetch approved regular PWP budget expenses
                const { data, error } = await supabase
                    .from('approved_pwp_expenses') // Replace with your actual table name
                    .select('amount')
                    .eq('visa_code', formData.visaCode)
                    .eq('status', 'approved');

                if (error) {
                    console.error('Error fetching approved expenses:', error);
                    return;
                }

                // Calculate total approved expenses
                const totalExpenses = data.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
                setApprovedExpenses(totalExpenses);

            } catch (err) {
                console.error('Error calculating approved expenses:', err);
            }
        };

        fetchApprovedExpenses();
    }, [formData.visaCode]);
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
    const [totalRemaining, setTotalRemaining] = React.useState(null);

    const fetchRemainingBalance = React.useCallback(async () => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (!storedUser || !storedUser.name) return;

        const { data, error } = await supabase
            .from('amount_badget')
            .select('remainingbalance')
            .eq('createduser', storedUser.name)
            .or('Approved.is.null,Approved.eq.true'); // ✅ Only include Approved = true or null

        if (error) {
            console.error('Error fetching remaining balance:', error);
            return;
        }

        const total = data.reduce((acc, item) => acc + parseFloat(item.remainingbalance), 0);
        setTotalRemaining(total);
    }, []);
    React.useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (!storedUser || !storedUser.name) return;

        fetchRemainingBalance();

        const subscription = supabase
            .channel('public:amount_badget')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'amount_badget',
                    filter: `createduser=eq.${storedUser.name}`
                },
                (payload) => {
                    fetchRemainingBalance(); // ✅ will re-filter automatically
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [fetchRemainingBalance]);

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

    const [accountSearchTerm, setAccountSearchTerm] = useState('');

    // Toggle selection of accountType
    const [showModal_Account, setShowModal_Account] = useState(false);

    // fetch account types
    useEffect(() => {
        const fetchAccounts = async () => {
            const { data, error } = await supabase
                .from('accounts')
                .select('*')
                .order('code', { ascending: true });
            if (error) {
                console.error('Error fetching account types:', error.message);
            } else {
                setAccountTypes(data);
            }
        };
        fetchAccounts();
    }, []);
    const getAccountNames = () => {
        if (!formData.accountType.length) return "";

        const selectedNames = accountTypes
            .filter((opt) => formData.accountType.includes(opt.code))
            .map((opt) => opt.name);

        return selectedNames.join(", ");
    };
    // toggle checkbox
    const toggleAccountType = (code) => {
        setFormData((prev) => {
            const current = prev.accountType || [];
            if (current.includes(code)) {
                return {
                    ...prev,
                    accountType: current.filter((c) => c !== code),
                };
            } else {
                return {
                    ...prev,
                    accountType: [...current, code],
                };
            }
        });
    };


    // compute selected names
    const selectedNames = accountTypes
        .filter(opt => formData.accountType && formData.accountType.includes(opt.id))
        .map(opt => opt.name)
        .join(', ');


    const [allCoverCodes, setAllCoverCodes] = useState([]);
    const [loadingCoverCode, setLoadingCoverCode] = useState(true);

    useEffect(() => {
        async function fetchCoverCodes() {
            const { data, error } = await supabase
                .from('cover_pwp')
                .select('cover_code');

            if (error) {
                console.error('Error fetching cover codes:', error);
                setLoadingCoverCode(false);
            } else {
                const codes = data
                    .map(row => row.cover_code)
                    .filter(Boolean);

                setAllCoverCodes(codes);

                // Generate cover code if not already set
                if (!formData.coverCode) {
                    const newCode = generateCoverCode(codes);
                    setFormData(prev => ({ ...prev, coverCode: newCode }));
                }

                setLoadingCoverCode(false);
            }
        }

        fetchCoverCodes();
    }, []);


    useEffect(() => {
        if (!formData.coverCode && allCoverCodes.length > 0) {
            const newCode = generateCoverCode(allCoverCodes);
            setFormData(prev => ({ ...prev, coverCode: newCode }));
        }
    }, [allCoverCodes]);

    const generateCoverCode = (existingCodes = []) => {
        const year = new Date().getFullYear();
        const prefix = `C${year}-`;

        const codesForYear = existingCodes
            .filter(code => code?.startsWith(prefix))
            .map(code => parseInt(code.replace(prefix, ''), 10))
            .filter(num => !isNaN(num));

        const newNumber = (codesForYear.length ? Math.max(...codesForYear) : 0) + 1;

        return `${prefix}${newNumber}`;
    };



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






    const handleSubmits = async (e) => {
        e.preventDefault();

        if (!formData.coverCode || !formData.distributor || !formData.amountbadget) {
            await Swal.fire({
                icon: 'warning',
                title: 'Missing fields',
                text: 'Please fill in all required fields.',
                confirmButtonText: 'OK',
            });
            return;
        }

        try {
            // ✅ Get the logged-in user from localStorage
            const storedUser = localStorage.getItem('loggedInUser');
            const parsedUser = storedUser ? JSON.parse(storedUser) : null;
            const createdBy = parsedUser?.name || 'Unknown'; // You could use parsedUser.UserID too

            // ✅ Convert selected accountType IDs into codes
            const accountCodes = formData.accountType; // array of codes
            const dataToInsert = {
                cover_code: formData.coverCode,
                distributor_code: formData.distributor,
                account_type: accountCodes.join(','), // <-- join codes with comma
                amount_badget: parseFloat(formData.amountbadget),
                pwp_type: formData.coverType || "COVER_PWP",
                objective: formData.objective,
                promo_scheme: formData.promoScheme,
                details: formData.details,
                remarks: formData.remarks,
                notification: false,
                createForm: createdBy,
            };


            const { data: mainData, error: mainError } = await supabase
                .from('cover_pwp')
                .insert([dataToInsert]);

            if (mainError) {
                console.error('Error saving main form data:', mainError);
                await Swal.fire({
                    icon: 'error',
                    title: 'Submission Error',
                    text: 'Error saving form data.',
                    confirmButtonText: 'OK',
                });
                return;
            }
            console.log('Main form insert data result:', mainData);
            // ✅ Insert to amount_badget table
            const { data: budgetInsert, error: budgetError } = await supabase
                .from('amount_badget')
                .insert([{
                    pwp_code: formData.coverCode,
                    amountbadget: parseFloat(formData.amountbadget),
                    createduser: createdBy,
                    remainingbalance: parseFloat(formData.amountbadget), // initially same as amount
                    Approved: false, // or null if not yet reviewed
                }]);

            if (budgetError) {
                console.error('Error inserting amount_badget:', budgetError);
                await Swal.fire({
                    icon: 'error',
                    title: 'Budget Entry Error',
                    text: 'Failed to insert into amount_badget table.',
                    confirmButtonText: 'OK',
                });
                return;
            }

            console.log('Amount budget inserted:', budgetInsert);

            // ✅ Handle file attachments
            if (files.length > 0) {
                const attachmentInserts = files.map(file => ({
                    cover_code: formData.coverCode,
                    file_name: file.name,
                    file_type: file.type || null,
                    file_size: file.size || null,
                    // uploaded_at defaults to CURRENT_TIMESTAMP
                }));

                const { data: attData, error: attachmentError } = await supabase
                    .from('cover_attachments')
                    .insert(attachmentInserts);

                if (attachmentError) {
                    console.error('Error saving attachment records:', attachmentError);
                    await Swal.fire({
                        icon: 'error',
                        title: 'Attachment Error',
                        text: 'Failed to save file attachments metadata.',
                        confirmButtonText: 'OK',
                    });
                    return;
                }
                console.log('Attachment metadata inserted:', attData);
            }

            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Form and attachments submitted successfully!',
                confirmButtonText: 'Great',
            });
            window.location.reload(); // 👈 this reloads the page

            setCurrentStep(2);
        } catch (err) {
            console.error('Unexpected error during submit:', err);
            await Swal.fire({
                icon: 'error',
                title: 'Unexpected Error',
                text: 'Something went wrong. See console for details.',
                confirmButtonText: 'OK',
            });
        }
    };




    const storedUser = localStorage.getItem("loggedInUser");
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const loggedInUsername = parsedUser?.name || "Unknown";

    const [userDistributors, setUserDistributors] = useState([]);
    const [filteredDistributors, setFilteredDistributors] = useState([]);

    ;

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

        if (loggedInUsername !== "Unknown") {
            fetchUserDistributors();
        }
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

                // Filter distributors based on user allowed list
                const allowed = data.filter((dist) =>
                    userDistributors.includes(dist.name)
                );
                console.log("[DEBUG] Filtered distributors for dropdown:", allowed);
                setFilteredDistributors(allowed);
            }
        };

        if (userDistributors.length > 0) {
            fetchDistributors();
        } else {
            // If no distributors assigned, clear filtered list
            setFilteredDistributors([]);
        }
    }, [userDistributors]);




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
                {/* Remaining Budget */}
                <div
                    className="col-md-4 d-flex justify-content-end align-items-center"
                    style={{ position: 'absolute', top: '40px', right: '20px' }} // ⬅ added margin-top effect
                >
                    <span
                        style={{
                            fontSize: '18px',   // ⬅ mas malaki label
                            fontWeight: '600',
                            marginRight: '12px',
                            color: '#444'
                        }}
                    >
                        Remaining Budget:
                    </span>
                    <span
                        style={{
                            fontSize: '24px',   // ⬅ mas malaki value
                            fontWeight: 'bold',
                            color: '#000',
                            background: '#ffffff',
                            padding: '8px 20px', // ⬅ mas spacious
                            borderRadius: '10px',
                            boxShadow: '0 3px 8px rgba(0,0,0,0.2)'
                        }}
                    >
                        {totalRemaining !== null ? `₱${totalRemaining.toLocaleString()}` : "Loading..."}
                    </span>
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
                            textAlign: 'right',
                        }}
                    >
                        <h2 className="fw-bold mb-0" style={{ letterSpacing: '1px', fontSize: '24px', textAlign: 'right' }}>
                            <span className={formData.coverCode ? 'text-danger' : 'text-muted'}>
                                {loadingCoverCode ? 'Generating...' : formData.coverCode || generateCoverCode(allCoverCodes)}
                            </span>
                        </h2>


                    </h2>
                    <div className="row g-3">
                        <div className="col-md-3" style={{ position: 'relative', width: '550px' }}>
                            <label className="form-label">
                                Distributor <span style={{ color: 'red' }}>*</span>
                            </label>

                            <select
                                name="distributor"
                                className="form-control"
                                value={formData.distributor}
                                onChange={handleFormChange}
                                style={{
                                    paddingRight: "30px",
                                    borderColor: formData.distributor ? "green" : "",
                                    transition: "border-color 0.3s",
                                }}
                                onMouseEnter={(e) => {
                                    if (formData.distributor) e.currentTarget.style.borderColor = "green";
                                }}
                                onMouseLeave={(e) => {
                                    if (formData.distributor) e.currentTarget.style.borderColor = "green";
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

                        {/* Account Type */}
                        <div className="col-md-4" style={{ position: "relative" }}>
                            <label>
                                Account <span style={{ color: "red" }}>*</span>
                            </label>

                            <div
                                className="form-control"
                                onClick={() => {
                                    if (formData.distributor) {
                                        setShowModal_Account(true);
                                    }
                                }}
                                style={{
                                    cursor: formData.distributor ? "pointer" : "not-allowed",
                                    marginTop: '10px',
                                    color: formData.distributor ? "inherit" : "#aaa",
                                    backgroundColor: formData.distributor ? "inherit" : "#f5f5f5",
                                    userSelect: formData.distributor ? "auto" : "none",
                                    background:'#ffff'
                                }}
                                aria-disabled={!formData.distributor}
                            >
                                {formData.accountType.length ? getAccountNames() : "Select Account Type"}

                                <span
                                    style={{
                                        position: "absolute",
                                        right: "40px",
                                        top: "75%",
                                        transform: "translateY(-50%)",
                                        pointerEvents: "none",
                                        color: formData.distributor ? "#555" : "#ccc",
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
                                        top: "75%",
                                        transform: "translateY(-50%)",
                                        pointerEvents: "none",
                                        color: formData.distributor ? "#555" : "#ccc",
                                        fontSize: "18px",
                                        userSelect: "none",
                                    }}
                                >
                                    🔍
                                </span>
                            </div>

                            {/* Modal with checkboxes */}
                            <Modal
                                show={showModal_Account && formData.distributor}  // Only show if distributor selected
                                onHide={() => setShowModal_Account(false)}
                                centered
                                size="lg"
                            >



                                {/* Modal with checkboxes */}
                         
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

                        <div className="col-md-3" style={{ position: 'relative' }}>
                            <label className="form-label" style={{ color: '#888' }}>
                                Marketing Type
                            </label>
                            <select
                                name="coverType"
                                className="form-control"
                                value={formData.coverType}
                                onChange={handleFormChange}
                                style={{ paddingRight: '30px', textTransform: 'uppercase', backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                                disabled
                            >
                                <option value="COVER_PWP">COVER_PWP</option>
                            </select>

                            {formData.coverType !== '' && (
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

                        <div className="col-md-3" style={{ position: 'relative' }}>
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
                        <button type="button" className="btn btn-primary" onClick={handleNext}>
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
                        <div className="mt-4 d-flex justify-content-between">
                            <button className="btn btn-outline-secondary" onClick={prevStep}>← Previous</button>

                            <button className="btn btn-success" onClick={handleSubmits}>
                                Submit To Approvers
                            </button>                    </div>
                    </div>


                </>
            )}

            {currentStep === 3 && (
                <>



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
