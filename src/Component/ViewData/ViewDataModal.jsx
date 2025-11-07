import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import Swal from 'sweetalert2';
import './ViewDataModal.css';

const ViewDataModal = ({ visaCode, onClose, userType }) => {
    const [data, setData] = useState(null);
    const [type, setType] = useState(null);
    const [accountTypeNames, setAccountTypeNames] = useState(null);
    const [distributorName, setDistributorName] = useState(null);
    const [userNames, setUserNames] = useState({});
    // New state for the extra tables
    const [accountsBudgetList, setAccountsBudgetList] = useState([]);
    const [skuListing, setSkuListing] = useState([]);
    const [isApproved, setIsApproved] = useState(false);


    const coverFieldNameMap = {
        cover_code: 'Cover Code',
        distributor_code: 'Distributor',
        amount_badget: 'Amount Badget',
        pwp_type: 'PWP Type',
        objective: 'Objective',
        promo_scheme: 'Promo Scheme',
        details: 'Details',
        remarks: 'Remarks',
        notification: 'Notification',
        created_at: 'Date Created',
        createForm: 'Created Form',
        ispartofcovervisa: 'Is Part of Cover Visa',
        coverVisaCode: 'Cover Visa Code',
        supporttype: 'Support Type',
        distributor: 'Distributor',
        categoryName: 'Category Name',
        sku: 'SKU',
        accounts: 'Accounts',
        amount_display: 'Amount Display',
    };

    const regularFieldNameMap = {
        regularpwpcode: 'Regular PWP Code',
        account_type: 'Account Type',
        activity: 'Activity',
        pwptype: 'PWP Type',
        activityDurationFrom: 'Activity From',
        activityDurationTo: 'Activity To',
        isPartOfCoverPwp: 'Is Part of Approved Budget?',
        coverPwpCode: 'Cover PWP Code',
        amountbadget: 'Amount Badget',
        objective: 'Objective',
        details: 'Details',
        remarks: 'Remarks',
        notification: 'Notification',
        created_at: 'Date Created',
        createForm: 'Agent Name',
        distributor: 'Distributor',
        promoScheme: 'Promo Scheme',
        categoryName: 'Category Name',
        sku: 'SKU',
        accounts: 'Accounts',
        amount_display: 'Amount Display',

    };

    const claimsFieldNameMap = {
        code_pwp: 'PWP Code',
        distributor: 'Distributor',
        activity: 'Activity',
        account_types: 'Account Types',
        category_codes: 'Category Codes',
        category_names: 'Category Names',
        amount_budget: 'Amount Budget',
        createForm: 'Created By',
        notification: 'Notification',
        created_at: 'Created At',
        branchType: 'Branch Type',
        sku: 'sku'
    };
    function base64ToUint8Array(base64) {
        try {
            // Remove data URI prefix if present
            let cleaned = base64.replace(/^data:.*;base64,/, '');

            // Remove any whitespace/newlines (important!)
            cleaned = cleaned.replace(/\s/g, '');

            // Decode Base64 to binary string
            const binaryString = atob(cleaned);

            // Convert to Uint8Array
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        } catch (err) {
            console.error('Base64 decoding error:', err);
            return null;
        }
    }

    // Download a Base64 attachment from Supabase
    const handleDownloadAttachment = (file) => {
        try {
            if (!file.file_data) {
                alert("No file data available!");
                return;
            }

            // Convert Base64 string to Blob
            const byteString = atob(file.file_data.replace(/^data:.*;base64,/, ''));
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }

            const blob = new Blob([ab], { type: file.mimetype || "application/octet-stream" });

            // Create a temporary link to download
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = file.filename || "download";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Release memory
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download failed:", err);
            alert("Failed to download file.");
        }
    };

    const formatFieldName = (key) => {
        // Decide which mapping to use based on the type
        const map =
            type === "Cover PWP"
                ? coverFieldNameMap
                : type === "Regular PWP"
                    ? regularFieldNameMap
                    : type === "Claims"
                        ? claimsFieldNameMap
                        : {};

        // Return the mapped name if it exists, else format it automatically
        return (
            map[key] ||
            key
                .replace(/_/g, " ") // replace underscores with spaces
                .replace(/([a-z])([A-Z])/g, "$1 $2") // add space between camelCase words
                .replace(/\b\w/g, (c) => c.toUpperCase()) // capitalize each word
        );
    };


    const numberFormatWithCommas = (num) => {
        if (typeof num !== 'number') {
            num = Number(num);
            if (isNaN(num)) return String(num);
        }
        return num.toLocaleString();
    };
 const formatValue = (value, key) => {
    if (!value && value !== false) return '-';

    const lowerKey = key.toLowerCase();
    if (lowerKey === 'createform' || lowerKey === 'created_form') {
        return getUserNameById(value);
    }
    
    // 🏷️ SKU and ACCOUNTS - show Yes if there's data in tables
    if (lowerKey === 'sku' && skuListing.length > 0) return 'Yes';
    if (lowerKey === 'accounts' && accountsBudgetList.length > 0) return 'Yes';
    
    // 🏷️ ACCOUNT TYPE LOGIC
    if (['account_type', 'accounttype'].includes(lowerKey)) {
            const codes = String(value)
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);

            const names = codes.map((code) => {
                const name = accountTypeNameCache[code];
                if (!name) {
                    // Trigger fetch if not in cache
                    // fetchAccountTypeName(code);
                    return code; // fallback while loading
                }
                return name;
            });

            return names.join(', ');
        }

        // 🏷️ DISTRIBUTOR LOGIC
        if (['distributor_code', 'distributor'].includes(lowerKey)) {
            const code = String(value).trim();
            const name = distributorNameCache[code];

            if (!name) {
                // Trigger fetch if not in cache
                fetchDistributorName(code);
                return code; // fallback while loading
            }

            return name;
        }
        if (lowerKey === 'activity') {
            const code = String(value).trim();
            const name = activityNameCache[code];
            if (!name) {
                fetchActivityName(code);
                return code;
            }
            return name;
        }
        // ✅ ARRAY
        if (Array.isArray(value)) return value.join(', ');

        // ✅ BOOLEAN
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';

        // ✅ AMOUNT
        if (['amount_badget', 'amountbadget', 'amount_display'].includes(lowerKey)) {
            const num = Number(value);
            return isNaN(num) ? value : num.toLocaleString();
        }

        // ✅ DATE
        if (lowerKey === 'created_at') {
            try {
                const date = new Date(value);
                const datePart = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }).replace(',', '');

                const timePart = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                });

                return `${datePart} ${timePart}`;
            } catch {
                return String(value);
            }
        }

        return String(value);
    };

    const fetchDistributorName = async (code) => {
        try {
            const { data, error } = await supabase
                .from('distributors')
                .select('code, name')
                .eq('code', code)
                .single();

            if (!error && data) {
                setDistributorNameCache((prev) => ({
                    ...prev,
                    [code]: data.name,
                }));
            }
        } catch (err) {
            console.error('Error fetching distributor name:', err.message);
        }
    };

    const [activityNameCache, setActivityNameCache] = useState({});


    const [accountTypeNameCache, setAccountTypeNameCache] = useState({});
    const [distributorNameCache, setDistributorNameCache] = useState({});

    const fetchActivityName = async (code) => {
        try {
            const { data, error } = await supabase
                .from('activity')
                .select('code, name')
                .eq('code', code)
                .single();

            if (!error && data) {
                setActivityNameCache(prev => ({
                    ...prev,
                    [code]: data.name,
                }));
            }
        } catch (err) {
            console.error('Error fetching activity name:', err.message);
        }
    };
const getUserNameById = (userId) => {
    return userNames[userId] || userNames[String(userId)] || userNames[Number(userId)] || `User ${userId}`;
};
    // Fetch associated table data
    const fetchAccountsBudget = async (code) => {
        // Use code = regularpwpcode or whatever field in `data`
        const { data: accData, error } = await supabase
            .from('regular_accountlis_badget')
            .select('*')
            .eq('regularcode', code);

        if (error) {
            console.error('Error fetching accounts budget:', error);
            return [];
        }
        return accData;
    };

    const fetchSkuListing = async (code) => {
        const { data: skuData, error } = await supabase
            .from('regular_sku_listing')
            .select('*')
            .eq('regular_code', code);

        if (error) {
            console.error('Error fetching sku listing:', error);
            return [];
        }
        return skuData;
    };

    const [attachments, setAttachments] = useState([]);
    const [coverAttachments, setCoverAttachments] = useState([]);

    const [badOrderList, setBadOrderList] = useState([]);
    useEffect(() => {
    const fetchUserNames = async () => {
        const { data, error } = await supabase
            .from("Account_Users")
            .select("UserID, name");

        if (error) {
            console.error("Error fetching user names:", error);
            return;
        }

        // Create a lookup object: { UserID: name }
        const nameMap = {};
        data.forEach(user => {
            nameMap[user.UserID] = user.name;
        });

        setUserNames(nameMap);
    };

    fetchUserNames();
}, []);
// ✅ Check if PWP is already approved
useEffect(() => {
    const checkApprovalStatus = async () => {
        try {
            if (!visaCode) return;

            const { data, error } = await supabase
                .from("Approval_History")
                .select("Response")
                .eq("PwpCode", visaCode)
                .eq("Response", "Approved")
                .single();

            if (data && !error) {
                setIsApproved(true);
            }
        } catch (err) {
            // No approval record found, keep buttons enabled
            console.log("No approval found yet");
        }
    };

    checkApprovalStatus();
}, [visaCode]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                let result = null;

                if (visaCode.startsWith('CL')) {
                    setType('Claims PWP');

                    const { data, error } = await supabase
                        .from('Claims_pwp')
                        .select('*')
                        .eq('code_pwp', visaCode)
                        .single();
                    if (error) throw error;
                    result = data;

                    // Fetch Claims_Badorder
                    const { data: badOrderData, error: badOrderError } = await supabase
                        .from('Claims_Badorder')
                        .select('*')
                        .eq('code_pwp', visaCode)
                        .order('id', { ascending: true });

                    if (badOrderError) throw badOrderError;
                    setBadOrderList(badOrderData || []);

                } else if (visaCode.startsWith('C')) {
                    setType('Cover PWP');

                    const { data, error } = await supabase
                        .from('cover_pwp')
                        .select('*')
                        .eq('cover_code', visaCode)
                        .single();
                    if (error) throw error;
                    result = data;

                    // ✅ Fetch Cover Attachments
                    const { data: coverFiles, error: coverFilesError } = await supabase
                        .from('cover_attachments')
                        .select('*')
                        .eq('cover_code', visaCode)
                        .order('uploaded_at', { ascending: true });

                    if (coverFilesError) throw coverFilesError;
                    setCoverAttachments(coverFiles || []);
                }
                else if (visaCode.startsWith('R')) {
                    setType('Regular PWP');

                    const { data, error } = await supabase
                        .from('regular_pwp')
                        .select('*')
                        .eq('regularpwpcode', visaCode)
                        .single();
                    if (error) throw error;
                    result = data;

                    const { data: attachmentsData, error: attachmentsError } = await supabase
                        .from('regular_attachments')
                        .select('*')
                        .eq('regularpwpcode', visaCode)
                        .order('uploaded_at', { ascending: true });


                    if (attachmentsError) throw attachmentsError;
                    setAttachments(attachmentsData || []);



                    // Fetch associated SKU Listing from regular_sku
                    const { data: skuData, error: skuError } = await supabase
                        .from('regular_sku')
                        .select('*')
                        .eq('regular_code', visaCode)
                        .order('id', { ascending: true });

                    if (skuError) throw skuError;
                    setSkuListing(skuData || []);

                    // Fetch associated Account Budget from regular_accountlis_badget
                    const { data: accountsData, error: accountsError } = await supabase
                        .from('regular_accountlis_badget')
                        .select('*')
                        .eq('regularcode', visaCode)
                        .order('id', { ascending: true });

                    if (accountsError) throw accountsError;
                    setAccountsBudgetList(accountsData || []);

                    // ------------------------
                    // Fetch associated Regular Badorder
                    const { data: regularBadorderData, error: regularBadorderError } = await supabase
                        .from('regular_badorder')
                        .select('*')
                        .eq('code_pwp', visaCode)
                        .order('id', { ascending: true });

                    if (regularBadorderError) throw regularBadorderError;
                    setBadOrderList(regularBadorderData || []); // update BadOrderList with regular_badorder
                }

                setData(result);

            } catch (error) {
                console.error('Error fetching data:', error.message);
                setAccountTypeNames(null);
                setDistributorName(null);
                setBadOrderList([]); // clear bad order table on error
                setSkuListing([]);
                setAccountsBudgetList([]); // clear account table on error
            }
        };

        if (visaCode) fetchData();
    }, [visaCode]);


const handleApprove = async () => {
    if (!visaCode) return;

    const result = await Swal.fire({
        title: "Approve this PWP?",
        text: `Are you sure you want to approve ${visaCode}?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#10b981",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, Approve",
        cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const dateTime = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const userId = currentUser?.UserID || "unknown";

    let remainingBalance = null;
    let creditBudget = null;
    let coverPwpCode = null;

    try {
        let updatePayload = {
            Approved: true,
            createdate: dateTime,
        };

        // ✅ REGULAR PWP
        if (visaCode.startsWith("R")) {
            const { data: pwpData, error: pwpError } = await supabase
                .from("regular_pwp")
                .select("remaining_balance, coverPwpCode, credit_budget, isPartOfCoverPwp")
                .eq("regularpwpcode", visaCode)
                .single();

            if (pwpError || !pwpData) {
                Swal.fire("Error", "Failed to fetch Regular PWP data.", "error");
                return;
            }

            // ✅ Only validate budget if it's part of a cover PWP
            if (pwpData.isPartOfCoverPwp === 'Yes' || pwpData.isPartOfCoverPwp === true) {
                remainingBalance = parseFloat(pwpData.remaining_balance);
                creditBudget = parseFloat(pwpData.credit_budget);
                coverPwpCode = pwpData.coverPwpCode;

                if (!isNaN(creditBudget) && !isNaN(remainingBalance) && coverPwpCode) {
                    // ✅ Fetch amount_badget for the cover PWP
                    const { data: budgetData, error: budgetError } = await supabase
                        .from("amount_badget")
                        .select("amountbadget, remainingbalance")
                        .eq("pwp_code", coverPwpCode)
                        .single();

                    if (budgetError || !budgetData) {
                        Swal.fire("Error", "Failed to fetch budget record.", "error");
                        return;
                    }

                    const currentRemaining = parseFloat(budgetData.remainingbalance);

                    // ✅ Check if kulang ang remaining balance
                    if (currentRemaining < creditBudget) {
                        await Swal.fire({
                            icon: "error",
                            title: "Denied!",
                            html: `
                                <b>${visaCode}</b> cannot be approved.<br/>
                                Remaining Balance: <b>${currentRemaining.toLocaleString()}</b><br/>
                                Required Budget: <b>${creditBudget.toLocaleString()}</b>
                            `,
                            confirmButtonColor: "#ef4444",
                            confirmButtonText: "OK",
                        });
                        // ❌ Stop here — no database updates
                        return;
                    }

                    // ✅ Update cover PWP remaining balance
                    const newRemaining = currentRemaining - creditBudget;

                    const { error: updateError } = await supabase
                        .from("amount_badget")
                        .update({
                            remainingbalance: newRemaining,
                            ...updatePayload,
                        })
                        .eq("pwp_code", coverPwpCode);

                    if (updateError) {
                        Swal.fire("Error", "Failed to update cover PWP balance.", "error");
                        return;
                    }
                }
            }
            // ✅ If not part of cover PWP, proceed without budget validation
        } else {
            // ✅ For Cover or Claims PWP
            const { error: updateError } = await supabase
                .from("amount_badget")
                .update(updatePayload)
                .eq("pwp_code", visaCode);

            if (updateError) {
                Swal.fire("Error", "Failed to update amount_badget.", "error");
                return;
            }
        }

        // ✅ Log Approval History
        const { error: historyError } = await supabase.from("Approval_History").insert({
            PwpCode: visaCode,
            ApproverId: userId,
            DateResponded: dateTime,
            Response: "Approved",
            Type: userType || "admin",
            Notication: false,
            CreatedForm: data?.createForm || data?.CreatedForm || "unknown",
        });

        if (historyError) {
            Swal.fire("Error", "Failed to log approval. Please try again.", "error");
            return;
        }

        // ✅ Log approved_history_budget
        const { error: historyBudgetError } = await supabase
            .from("approved_history_budget")
            .insert({
                pwp_code: visaCode,
                approver_id: userId,
                date_responded: dateTime,
                response: "Approved",
                type: userType || "admin",
                created_form: data?.createForm || data?.CreatedForm || "unknown",
                remaining_balance: remainingBalance,
                credit_budget: creditBudget,
                cover_pwp_code: coverPwpCode,
                updated_amount_badget: coverPwpCode ? true : false,
            });

        if (historyBudgetError) {
            Swal.fire("Error", "Failed to log approval + budget.", "error");
            return;
        }

        // ✅ Log activity
        try {
            const ipRes = await fetch("https://api.ipify.org?format=json");
            const { ip } = await ipRes.json();
            const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
            const geo = await geoRes.json();

            await supabase.from("RecentActivity").insert({
                userId,
                device: navigator.userAgent || "Unknown Device",
                location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
                ip,
                time: dateTime,
                action: `Approved ${visaCode}`,
            });
        } catch (logErr) {
            console.warn("Activity logging failed:", logErr.message);
        }

        // ✅ Success Message
        Swal.fire({
            icon: "success",
            title: "Approved!",
            text: `${visaCode} has been approved successfully.`,
            confirmButtonText: "OK",
        }).then(() => {
            onClose();
            window.location.reload();
        });

    } catch (error) {
        console.error("Approval error:", error);
        Swal.fire("Error", "Failed to approve. Please try again.", "error");
    }
};

    const handleDisapprove = async () => {
        if (!visaCode) return;

        const result = await Swal.fire({
            title: 'Disapprove this PWP?',
            text: `Are you sure you want to disapprove ${visaCode}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, Disapprove',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;

        const dateTime = new Date().toISOString();
        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
        const userId = currentUser?.UserID || "unknown";

        try {
            const { error } = await supabase
                .from("Approval_History")
                .insert({
                    PwpCode: visaCode,
                    ApproverId: userId,
                    DateResponded: dateTime,
                    Response: "Disapproved",
                    Type: userType || null,
                    Notication: false,
                    CreatedForm: data?.createForm || data?.CreatedForm || "unknown",
                });

            if (error) throw error;

            Swal.fire({
                icon: "success",
                title: "Disapproved",
                confirmButtonText: "OK",
            }).then(() => {
                onClose();
                window.location.reload();
            });
        } catch (error) {
            console.error("Disapproval error:", error);
            Swal.fire("Error", "Failed to disapprove. Please try again.", "error");
        }
    };


    const [categoryMap, setCategoryMap] = useState({});


    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const { data, error } = await supabase
                    .from('category_listing')
                    .select('sku_code, name');

                if (error) throw error;

                // Map sku_code to name
                const map = {};
                data.forEach(item => {
                    map[item.sku_code] = item.name;
                });

                setCategoryMap(map);
            } catch (err) {
                console.error('Error fetching categories:', err.message);
            }
        };

        fetchCategories();
    }, []);

    const [coverRemaining, setCoverRemaining] = useState(0);
    const [distributorRemaining, setDistributorRemaining] = useState(0);


    // ✅ Fetch cover PWP remaining balance
    useEffect(() => {
        const fetchCoverRemaining = async () => {
            try {
                // check kung may coverPwpCode sa data
                if (!data?.coverPwpCode) return;

                const { data: budgetData, error } = await supabase
                    .from("amount_badget")
                    .select("remainingbalance")
                    .eq("pwp_code", data.coverPwpCode)
                    .single();

                if (error) {
                    console.error("Error fetching cover remaining balance:", error.message);
                    return;
                }

                setCoverRemaining(parseFloat(budgetData?.remainingbalance || 0));
            } catch (err) {
                console.error("Unexpected error:", err);
            }
        };

        fetchCoverRemaining();
    }, [data?.coverPwpCode]);

// ✅ Fetch distributor's remaining budget for standalone Regular PWP
useEffect(() => {
    const fetchDistributorRemaining = async () => {
        try {
            // Only for Regular PWP that is NOT part of Cover PWP
            if (type !== 'Regular PWP') return;
            if (data?.isPartOfCoverPwp === 'Yes' || data?.isPartOfCoverPwp === true) return;
            if (!data?.distributor) return;

            const { data: budgetData, error } = await supabase
                .from("amount_badget")
                .select("remainingbalance")
                .eq("distributor", data.distributor)
                .order("createdate", { ascending: false })
                .limit(1)
                .single();

            if (error) {
                console.error("Error fetching distributor remaining balance:", error.message);
                return;
            }

            setDistributorRemaining(parseFloat(budgetData?.remainingbalance || 0));
        } catch (err) {
            console.error("Unexpected error:", err);
        }
    };

    fetchDistributorRemaining();
}, [type, data?.distributor, data?.isPartOfCoverPwp]);
    if (!data) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>
                        View {type} - {visaCode}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#007bff',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 22px',
                            fontSize: '16px',
                            fontWeight: '600',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 3px 6px rgba(0, 123, 255, 0.4)',
                            transition: 'background-color 0.3s ease, box-shadow 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#0056b3';
                            e.currentTarget.style.boxShadow = '0 5px 12px rgba(0, 86, 179, 0.6)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#007bff';
                            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 123, 255, 0.4)';
                        }}
                        onMouseDown={(e) => {
                            e.currentTarget.style.backgroundColor = '#004494';
                            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 68, 148, 0.8)';
                        }}
                        onMouseUp={(e) => {
                            e.currentTarget.style.backgroundColor = '#0056b3';
                            e.currentTarget.style.boxShadow = '0 5px 12px rgba(0, 86, 179, 0.6)';
                        }}
                    >
                        X
                    </button>
                </div>

                <div className="modal-content-scrollable">
 <div className="modal-form-content">
  {/* ✅ Custom Field Order for Regular PWP */}
  {type === 'Regular PWP' ? (
    [
      'distributor',
      'activity',
      'accountType',
      'branchType',
      'objective',
      'promoScheme',
      'activityDurationFrom',
      'activityDurationTo',
      'isPartOfCoverPwp',
      'accounts',
      'created_at',
      'createForm',
    ]
      .filter((key) => {
        const value = data[key];

        // ✅ Hide null/undefined/empty values
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (value === '-') return false;
        if (Array.isArray(value) && value.length === 0) return false;

        const formatted = formatValue(value, key);
        if (formatted === '[ ]' || formatted === '[]' || formatted.trim() === '') return false;

        // ✅ Special conditions
        if (key.toLowerCase() === 'accounts' && accountsBudgetList.length > 0) return false;
        if (key.toLowerCase() === 'sku' && skuListing.length > 0) return false;

        return true;
      })
      .map((key) => {
        const value = data[key];
        return (
          <div className="form-group" key={key}>
            <label>{formatFieldName(key)}</label>
            <div className="readonly-box">{formatValue(value, key)}</div>
          </div>
        );
      })
  ) : (
    // ✅ ELSE condition: For other form types
    Object.entries(data)
      .filter(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (value === '-') return false;
        if (Array.isArray(value) && value.length === 0) return false;

        const formatted = formatValue(value, key);
        if (formatted === '[ ]' || formatted === '[]' || formatted.trim() === '') return false;

        // ✅ Common hidden fields
        if (['notification', 'amount_badget'].includes(key)) return false;

        return true;
      })
      .map(([key, value]) => (
        <div className="form-group" key={key}>
          <label>{formatFieldName(key)}</label>
          <div className="readonly-box">{formatValue(value, key)}</div>
        </div>
      ))
  )}
</div>



{/* 🎯 FOOTER SECTION */}
{type !== 'Claims PWP' && (
    <div className="modal-footer">
        {type === 'Cover PWP' ? (
            <div className="footer-card red">
                <span className="footer-label">💸 Budget</span>
                <span className="footer-value">
                    ₱ {Number(data.amount_badget || 0).toLocaleString()}
                </span>
            </div>
        ) : data.isPartOfCoverPwp === 'Yes' || data.isPartOfCoverPwp === true ? (
            <>
                <div className="footer-card green">
                    <span className="footer-label">💼 Remaining Budget</span>
                    <span className="footer-value">
                        ₱ {Number(coverRemaining || 0).toLocaleString()}
                    </span>
                </div>
                <div className="footer-card red">
                    <span className="footer-label">💸 Used Budget</span>
                    <span className="footer-value">
                        ₱ {Number(data.credit_budget || 0).toLocaleString()}
                    </span>
                </div>
            </>
       ) : (
    <>
        <div className="footer-card green">
            <span className="footer-label">💼 Remaining Budget</span>
            <span className="footer-value">
                ₱ {Number(distributorRemaining || 0).toLocaleString()}
            </span>
        </div>
        <div className="footer-card blue">
            <span className="footer-label">💰 Amount (not part of budget)</span>
            <span className="footer-value">
                ₱ {Number(
                    skuListing.length > 0
                        ? skuListing
                            .filter(row => row.sku_code !== 'Total:' && row.sku_code !== 'Total')
                            .reduce((acc, row) => acc + (parseFloat(row.total_amount) || 0), 0)
                        : accountsBudgetList.length > 0
                            ? accountsBudgetList.reduce((acc, row) => acc + parseFloat(row.budget || 0), 0)
                            : data.amountbadget || 0
                ).toLocaleString()}
            </span>
        </div>
    </>
)}
    </div>
)}

                    {type === 'Regular PWP' && (
                        <div
                            className="modal-footer"
                            style={{
                                background: '#f8f9fa',
                                borderTop: '1px solid #dee2e6',
                                padding: '16px 20px',
                                borderRadius: '0 0 8px 8px',
                            }}
                        >
                            <div className="attachments-section" style={{ width: '100%' }}>
                                <h6
                                    style={{
                                        marginBottom: '10px',
                                        fontWeight: '600',
                                        fontSize: '15px',
                                        color: '#333',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    📎 Attachments
                                </h6>

                                {attachments.length > 0 ? (
                                    <ul
                                        className="attachment-list"
                                        style={{
                                            listStyle: 'none',
                                            padding: 0,
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '10px',
                                        }}
                                    >
                                        {attachments.map((file) => (
                                            <li key={file.id}>
                                                <button
                                                    onClick={() => handleDownloadAttachment(file)}
                                                    style={{
                                                        backgroundColor: '#e9ecef',
                                                        border: '1px solid #ced4da',
                                                        borderRadius: '25px',
                                                        padding: '8px 14px',
                                                        fontSize: '14px',
                                                        color: '#495057',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                    }}
                                                    onMouseOver={(e) =>
                                                        (e.currentTarget.style.backgroundColor = '#dee2e6')
                                                    }
                                                    onMouseOut={(e) =>
                                                        (e.currentTarget.style.backgroundColor = '#e9ecef')
                                                    }
                                                >
                                                    <i className="fa fa-download" style={{ color: '#0d6efd' }}></i>
                                                    <span>
                                                        {file.filename}{' '}
                                                        <span style={{ color: '#6c757d' }}>
                                                            ({(file.size / 1024).toFixed(2)} KB)
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span style={{ color: '#6c757d', fontSize: '14px' }}>
                                        No attachments available.
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                    {type === 'Cover PWP' && (
                        <div
                            className="modal-footer"
                            style={{
                                background: '#f8f9fa',
                                borderTop: '1px solid #dee2e6',
                                padding: '16px 20px',
                                borderRadius: '0 0 8px 8px',
                            }}
                        >
                            <div className="attachments-section" style={{ width: '100%' }}>
                                <h6
                                    style={{
                                        marginBottom: '10px',
                                        fontWeight: '600',
                                        fontSize: '15px',
                                        color: '#333',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    📎 Attachments
                                </h6>

                                {coverAttachments.length > 0 ? (
                                    <ul
                                        className="attachment-list"
                                        style={{
                                            listStyle: 'none',
                                            padding: 0,
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '10px',
                                        }}
                                    >
                                        {coverAttachments.map((file) => (
                                            <li key={file.id}>
                                                <button
                                                    onClick={() => handleDownloadAttachment({
                                                        filename: file.file_name,
                                                        file_data: file.file_data,
                                                        mimetype: file.file_type,
                                                        size: file.file_size,
                                                    })}
                                                    style={{
                                                        backgroundColor: '#e9ecef',
                                                        border: '1px solid #ced4da',
                                                        borderRadius: '25px',
                                                        padding: '8px 14px',
                                                        fontSize: '14px',
                                                        color: '#495057',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                    }}
                                                    onMouseOver={(e) =>
                                                        (e.currentTarget.style.backgroundColor = '#dee2e6')
                                                    }
                                                    onMouseOut={(e) =>
                                                        (e.currentTarget.style.backgroundColor = '#e9ecef')
                                                    }
                                                >
                                                    <i className="fa fa-download" style={{ color: '#0d6efd' }}></i>
                                                    <span>
                                                        {file.file_name}{' '}
                                                        <span style={{ color: '#6c757d' }}>
                                                            ({(file.file_size / 1024).toFixed(2)} KB)
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span style={{ color: '#6c757d', fontSize: '14px' }}>
                                        No attachments available.
                                    </span>
                                )}
                            </div>
                        </div>
                    )}







                </div>
                {skuListing.length === 0 && accountsBudgetList.length > 0 && (
                    <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <h4 style={{ color: '#2575fc', marginBottom: '0.5rem' }}>Accounts Budget</h4>

                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '14px',
                                minWidth: '500px', // ensure horizontal scroll on small screens
                                boxShadow: '0 0 5px rgba(0, 0, 0, 0.1)',
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: '#2575fc', color: '#ffffff', textAlign: 'left' }}>
                                    <th style={{ padding: '10px' }}>Account Name</th>
                                    <th style={{ padding: '10px' }}>Budget</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accountsBudgetList.map((row) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={{ padding: '8px' }}>{row.account_name}</td>
                                        <td style={{ padding: '8px' }}>{Number(row.budget).toLocaleString()}</td>
                                    </tr>
                                ))}

                                {/* Total Row */}
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f1f5fb' }}>
                                    <td style={{ padding: '10px' }}>Total</td>
                                    <td style={{ padding: '10px' }}>
                                        {accountsBudgetList
                                            .reduce((acc, row) => acc + parseFloat(row.budget || 0), 0)
                                            .toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {type === 'Regular PWP' && skuListing.length > 0 && (
                    <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <h4 style={{ color: '#2575fc', marginBottom: '0.5rem' }}>SKU Listing</h4>

                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '14px',
                                minWidth: '600px',
                                boxShadow: '0 0 5px rgba(0, 0, 0, 0.1)',
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: '#2575fc', color: '#ffffff', textAlign: 'left' }}>
                                    <th style={{ padding: '10px' }}>Accounts</th>

                                    <th style={{ padding: '10px' }}>SKU</th>
                                    <th style={{ padding: '10px' }}>SRP</th>
                                    <th style={{ padding: '10px' }}>Qty</th>
                                    <th style={{ padding: '10px' }}>UOM</th>
                                    <th style={{ padding: '10px' }}>Total Amount</th>

                                    <th style={{ padding: '10px' }}>Discount</th>
                                    <th style={{ padding: '10px' }}>Total Billing Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {skuListing
                                    .filter(row => row.sku_code !== 'Total:' && row.sku_code !== 'Total')
                                    .map((row) => (
                                        <tr key={row.id} style={{ borderBottom: '1px solid #ddd' }}>
                                            <td style={{ padding: '8px' }}>{row.account_name ?? '-'}</td>

                                            <td style={{ padding: '8px' }}>
                                                {categoryMap[row.sku_code] || row.sku_code || '-'}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {row.srp != null ? Number(row.srp).toLocaleString() : '-'}
                                            </td>
                                            <td style={{ padding: '8px' }}>{row.qty ?? '-'}</td>
                                            <td style={{ padding: '8px' }}>{row.uom || '-'}</td>
                                            <td style={{ padding: '8px' }}>{row.billing_amount || '-'}</td>

                                            <td style={{ padding: '8px' }}>
                                                {row.discount != null ? `${row.discount}` : '-'}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {row.total_amount != null
                                                    ? Number(row.total_amount).toLocaleString()
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                {/* Total Row */}
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f1f5fb' }}>
                                    <td style={{ padding: '10px' }} colSpan="5">Total</td>
                                    <td ></td>
                                    <td ></td>


                                    <td style={{ padding: '10px' }}>
                                        {skuListing
                                            .filter(row => row.sku_code !== 'Total:' && row.sku_code !== 'Total')
                                            .reduce((acc, row) => acc + (parseFloat(row.total_amount) || 0), 0)
                                            .toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}


                {type === 'Claims PWP' && badOrderList.length > 0 && (
                    <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <h4 style={{ color: '#2575fc', marginBottom: '0.5rem' }}>Bad Order</h4>
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '14px',
                                minWidth: '500px',
                                boxShadow: '0 0 5px rgba(0, 0, 0, 0.1)',
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: '#2575fc', color: '#fff', textAlign: 'left' }}>
                                    <th style={{ padding: '10px' }}>Category</th>
                                    <th style={{ padding: '10px' }}>Amount</th>
                                    <th style={{ padding: '10px' }}>Created At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {badOrderList.map((row) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={{ padding: '8px' }}>{row.category}</td>
                                        <td style={{ padding: '8px' }}>{Number(row.amount).toLocaleString()}</td>
                                        <td style={{ padding: '8px' }}>
                                            {row.created_at ? new Date(row.created_at).toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f1f5fb' }}>
                                    <td style={{ padding: '10px' }}>Total</td>
                                    <td style={{ padding: '10px' }}>
                                        {badOrderList
                                            .reduce((sum, row) => sum + parseFloat(row.amount || 0), 0)
                                            .toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px' }}></td>

                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}


                {type === 'Regular PWP' && badOrderList.length > 0 && (
                    <div
                        style={{
                            marginTop: '30px',
                            padding: '20px',
                            borderRadius: '12px',
                            backgroundColor: '#e6f0ff', // soft blue background
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                            overflowX: 'auto',
                        }}
                    >
                        <h4 style={{ marginBottom: '20px', fontWeight: 'bold', color: '#0d6efd', textAlign: 'left' }}>
                            Regular Bad Order List
                        </h4>

                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'separate',
                                borderSpacing: '0',
                                minWidth: '700px',
                                fontFamily: 'Arial, sans-serif',
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: '#0d6efd', color: 'white', fontWeight: 'bold', textAlign: 'center' }}>
                                    <th style={{ padding: '12px', borderTopLeftRadius: '10px' }}>Category</th>
                                    <th style={{ padding: '12px' }}>Amount</th>
                                    <th style={{ padding: '12px' }}>Created At</th>
                                    <th style={{ padding: '12px' }}>Total</th>
                                    <th style={{ padding: '12px', borderTopRightRadius: '10px' }}>Remaining Budget</th>
                                </tr>
                            </thead>

                            <tbody>
                                {badOrderList.map(({ id, category, amount, remarks, created_at, total, remaining_budget }, idx) => (
                                    <tr
                                        key={id}
                                        style={{
                                            textAlign: 'center',
                                            fontSize: '14px',
                                            backgroundColor: idx % 2 === 0 ? 'white' : '#f0f8ff',
                                            transition: 'background-color 0.3s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#cce0ff')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#f0f8ff')}
                                    >
                                        <td style={{ padding: '10px' }}>{category}</td>
                                        <td style={{ padding: '10px' }}>₱{amount.toFixed(2)}</td>
                                        <td style={{ padding: '10px' }}>{new Date(created_at).toLocaleString('en-PH')}</td>
                                        <td style={{ padding: '10px' }}>₱{total.toFixed(2)}</td>
                                        <td style={{ padding: '10px' }}>₱{remaining_budget.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>


                        </table>
                    </div>
                )}



                <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
    onClick={handleApprove}
    disabled={isApproved}
    style={{
        backgroundColor: isApproved ? '#9ca3af' : '#10b981',
        color: '#fff',
        border: 'none',
        padding: '10px 24px',
        fontSize: '16px',
        fontWeight: '600',
        borderRadius: '6px',
        cursor: isApproved ? 'not-allowed' : 'pointer',
        boxShadow: '0 3px 6px rgba(16, 185, 129, 0.4)',
        transition: 'background-color 0.3s ease, box-shadow 0.2s ease',
        opacity: isApproved ? 0.6 : 1,
    }}
    onMouseEnter={(e) => {
        if (!isApproved) {
            e.currentTarget.style.backgroundColor = '#059669';
            e.currentTarget.style.boxShadow = '0 5px 12px rgba(5, 150, 105, 0.6)';
        }
    }}
    onMouseLeave={(e) => {
        if (!isApproved) {
            e.currentTarget.style.backgroundColor = '#10b981';
            e.currentTarget.style.boxShadow = '0 3px 6px rgba(16, 185, 129, 0.4)';
        }
    }}
>
    ✓ Approve
</button>

<button
    onClick={handleDisapprove}
    disabled={isApproved}
    style={{
        backgroundColor: isApproved ? '#9ca3af' : '#ef4444',
        color: '#fff',
        border: 'none',
        padding: '10px 24px',
        fontSize: '16px',
        fontWeight: '600',
        borderRadius: '6px',
        cursor: isApproved ? 'not-allowed' : 'pointer',
        boxShadow: '0 3px 6px rgba(239, 68, 68, 0.4)',
        transition: 'background-color 0.3s ease, box-shadow 0.2s ease',
        opacity: isApproved ? 0.6 : 1,
    }}
    onMouseEnter={(e) => {
        if (!isApproved) {
            e.currentTarget.style.backgroundColor = '#dc2626';
            e.currentTarget.style.boxShadow = '0 5px 12px rgba(220, 38, 38, 0.6)';
        }
    }}
    onMouseLeave={(e) => {
        if (!isApproved) {
            e.currentTarget.style.backgroundColor = '#ef4444';
            e.currentTarget.style.boxShadow = '0 3px 6px rgba(239, 68, 68, 0.4)';
        }
    }}
>
    ✕ Disapprove
</button>
  
                </div>
            </div >
        </div >
    );
};

export default ViewDataModal;
