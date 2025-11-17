
    import React, { useEffect, useState } from "react";
    import { supabase } from "../supabaseClient";
    import * as XLSX from "xlsx";
    import { saveAs } from "file-saver";
    import { FaFileExcel } from "react-icons/fa";  // Excel icon

    export default function CoverPWPBudgetTable() {
        const [loading, setLoading] = useState(true);
        const [expandedRow, setExpandedRow] = useState(null);
        const [approvedDetails, setApprovedDetails] = useState({});
        const [loadingDetails, setLoadingDetails] = useState(false);
        const [searchQuery, setSearchQuery] = useState("");
        const [rows, setRows] = useState([]);
        const [monthlyTrend, setMonthlyTrend] = useState([]);
        const [ppeTrend, setPpeTrend] = useState([]);
        const [totalBudget, setTotalBudget] = React.useState(null);
        const [totalRemaining, setTotalRemaining] = React.useState(null);
        const [distributorCount, setDistributorCount] = useState(null);
        const [currentPage, setCurrentPage] = useState(1);
        const [itemsPerPage, setItemsPerPage] = useState(10);

        // Get user info
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
        const currentUserId = currentUser?.UserID ? String(currentUser.UserID) : null;
        const role = currentUser?.role?.toLowerCase() || "";
        const storedUser = JSON.parse(localStorage.getItem('user'));
        const userName = storedUser?.name?.toLowerCase().trim();
        const currentUserName = currentUser?.name?.toLowerCase().trim() || "";

        console.log("User name:", currentUser?.name || "");
        console.log("Role:", role);

        useEffect(() => {
            const fetchData = async () => {
                try {
                    // Fetch Cover PWP
                    const { data: coverData, error: coverError } = await supabase
                        .from("cover_pwp")
                        .select("cover_code, distributor_code, amount_badget, created_at, createForm")
                        .order("id", { ascending: true });

                    if (coverError) throw coverError;

                    // Fetch Account_Users to map UserID to name
                    const { data: usersData, error: usersError } = await supabase
                        .from("Account_Users")
                        .select("UserID, name");

                    if (usersError) throw usersError;

                    // Fetch Distributors
                    const { data: distributorsData, error: distributorsError } = await supabase
                        .from("distributors")
                        .select("code, name");

                    if (distributorsError) throw distributorsError;

                    // Fetch amount_badget table for remainingbalance
                    const { data: amountBadgetData, error: amountBadgetError } = await supabase
                        .from("amount_badget")
                        .select("pwp_code, remainingbalance");

                    if (amountBadgetError) throw amountBadgetError;

                    // Create map of UserID to name
                    const userMap = {};
                    usersData.forEach((user) => {
                        userMap[user.UserID] = user.name;
                    });

                    // Create map of distributor codes to names
                    const distributorMap = {};
                    distributorsData.forEach((dist) => {
                        distributorMap[dist.code] = dist.name;
                    });

                    // Create map for remainingbalance from amount_badget table
                    const remainingBalanceMap = {};
                    amountBadgetData.forEach((entry) => {
                        remainingBalanceMap[entry.pwp_code] = Number(entry.remainingbalance || 0);
                    });

                    // Merge everything
                    const combined = coverData.map((cov) => {
                        const key = cov.cover_code;
                        const distributorName = distributorMap[cov.distributor_code] || `Code: ${cov.distributor_code}`;
                        const remainingBalance = remainingBalanceMap[key] ?? 0;
                        const createdByName = userMap[cov.createForm] || cov.createForm || "Unknown";

                        return {
                            cover_code: key,
                            distributor_name: distributorName,
                            budget2025: cov.amount_badget || 0,
                            remainingBudget: remainingBalance,
                            created_at: cov.created_at,
                            createdByName: createdByName,
                            createForm: cov.createForm,
                        };
                    });

                    setRows(combined);
                } catch (err) {
                    console.error("Error fetching combined data:", err.message);
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        }, []);

        const fetchApprovedDetails = async (coverCode) => {
            setLoadingDetails(true);
            try {
                const { data, error } = await supabase
                    .from("approved_history_budget")
                    .select(
                        "id, pwp_code, cover_pwp_code, approver_id, date_responded, response, type, created_form, remaining_balance, credit_budget, updated_amount_badget"
                    )
                    .eq("cover_pwp_code", coverCode)
                    .order("id", { ascending: true });

                if (error) throw error;

                setApprovedDetails((prev) => ({ ...prev, [coverCode]: data }));
            } catch (error) {
                console.error("Error fetching approved details:", error.message);
                setApprovedDetails((prev) => ({ ...prev, [coverCode]: [] }));
            } finally {
                setLoadingDetails(false);
            }
        };

        const handleRowClick = (coverCode) => {
            if (expandedRow === coverCode) {
                setExpandedRow(null);
            } else {
                setExpandedRow(coverCode);
                if (!approvedDetails[coverCode]) {
                    fetchApprovedDetails(coverCode);
                }
            }
        };

        const userFilteredRows = rows.filter((entry) => {
            if (role === "admin") return true;
            const entryCreator = entry.createForm ? String(entry.createForm) : null;
            return entryCreator === currentUserId;
        });



        // Export to Excel handler
        const exportToExcel = () => {
            // Prepare worksheet data
            const worksheetData = filteredRows.map((row) => ({
                "Cover PWP Code": row.cover_code,
                Distributor: row.distributor_name,
                "Budget for 2025": row.budget2025,
                "Remaining Budget": row.remainingBudget,
                "Created At": row.created_at ? new Date(row.created_at).toLocaleString() : "-",
                "Created By": row.createdByName,
            }));

            const worksheet = XLSX.utils.json_to_sheet(worksheetData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Budget Data");

            // Generate buffer
            const excelBuffer = XLSX.write(workbook, {
                bookType: "xlsx",
                type: "array",
            });

            // Save file
            const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
            saveAs(blob, "budget_data.xlsx");
        };

        // Reset to page 1 when search query changes
        useEffect(() => {
            setCurrentPage(1);
        }, [searchQuery]);

        const handlePageChange = (pageNumber) => {
            setCurrentPage(pageNumber);
            setExpandedRow(null); // Close expanded rows when changing pages
        };

        const handleItemsPerPageChange = (e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
        };

        useEffect(() => {
            async function fetchMonthlyTrends() {
                const { data: records, error } = await supabase
                    .from("Approval_History")
                    .select("Response, DateResponded");

                if (error) {
                    console.error("Error fetching trends:", error);
                    return;
                }

                const monthlyMap = {};

                records.forEach(({ Response, DateResponded }) => {
                    const status = Response === "Declined" ? "Disapproved" : Response;
                    const month = new Date(DateResponded).toISOString().slice(0, 7); // "YYYY-MM"

                    if (!monthlyMap[month]) {
                        monthlyMap[month] = { month };
                    }

                    if (["Approved", "Disapproved", "Cancelled"].includes(status)) {
                        monthlyMap[month][status] = (monthlyMap[month][status] || 0) + 1;
                    }
                });

                const monthlyTrendArray = Object.values(monthlyMap).sort((a, b) =>
                    a.month.localeCompare(b.month)
                );

                setMonthlyTrend(monthlyTrendArray);
                setPpeTrend(monthlyTrendArray);
            }

            fetchMonthlyTrends();
        }, []);

        const fetchRemainingBalance = React.useCallback(async () => {
            const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
            const userId = String(currentUser?.UserID || '');
            const role = currentUser?.UserType?.toLowerCase() || '';

            if (!userId) {
                console.warn("No user ID found");
                return;
            }

            try {
                // ✅ Step 1: Get Cover PWP codes created by this user
                let coverQuery = supabase
                    .from('cover_pwp')
                    .select('cover_code, amount_badget');

                // Filter by user if not admin
                if (role !== 'admin') {
                    coverQuery = coverQuery.eq('createForm', userId);
                }

                const { data: coverData, error: coverError } = await coverQuery;

                if (coverError) {
                    console.error('Error fetching cover PWP:', coverError);
                    return;
                }

                // ✅ Step 2: Get Cover PWP codes
                const coverCodes = coverData.map(c => c.cover_code);

                if (coverCodes.length === 0) {
                    setTotalRemaining(0);
                    setTotalBudget(0);
                    return;
                }

                // ✅ Step 3: Get remaining balances from amount_badget table
                const { data: budgetData, error: budgetError } = await supabase
                    .from('amount_badget')
                    .select('pwp_code, remainingbalance, amountbadget')
                    .in('pwp_code', coverCodes);

                if (budgetError) {
                    console.error('Error fetching balances:', budgetError);
                    return;
                }

                // ✅ Step 4: Calculate totals
                const totalRemaining = budgetData.reduce((acc, item) => {
                    return acc + parseFloat(item.remainingbalance || 0);
                }, 0);

                const totalBudget = budgetData.reduce((acc, item) => {
                    return acc + parseFloat(item.amountbadget || 0);
                }, 0);

                setTotalRemaining(totalRemaining);
                setTotalBudget(totalBudget);

                console.log('✅ Total Budget:', totalBudget);
                console.log('✅ Total Remaining:', totalRemaining);

            } catch (error) {
                console.error('Error in fetchRemainingBalance:', error);
            }
        }, []);
        const [activeDistributor, setActiveDistributor] = useState('all');

        // Add this after userFilteredRows definition
        // ✅ Move this block UP, before pagination logic
        const uniqueDistributors = ['all', ...new Set(
            userFilteredRows
                .map(row => row.distributor_name)
                .filter(name => name && !name.startsWith('Code:'))
        )].sort((a, b) => {
            if (a === 'all') return -1;
            if (b === 'all') return 1;
            return a.localeCompare(b);
        });

        const distributorFilteredRows = activeDistributor === 'all'
            ? userFilteredRows
            : userFilteredRows.filter(row => row.distributor_name === activeDistributor);

        const filteredRows = distributorFilteredRows.filter(
            (row) =>
                row.cover_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.distributor_name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // ✅ Then pagination logic comes here
        const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedRows = filteredRows.slice(startIndex, endIndex);

        React.useEffect(() => {
            const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
            if (!currentUser?.UserID) return;

            fetchRemainingBalance();

            const subscription = supabase
                .channel('public:amount_badget')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'amount_badget',
                    },
                    (payload) => {
                        console.log('📢 Database change detected:', payload);
                        fetchRemainingBalance();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(subscription);
            };
        }, [fetchRemainingBalance]);

        useEffect(() => {
            if (!currentUserId) return;

            const fetchDistributors = async () => {
                try {
                    const { data, error } = await supabase
                        .from('user_distributors')
                        .select('id')
                        .eq('username', currentUser?.name);

                    if (error) throw error;

                    setDistributorCount(data.length);
                } catch (error) {
                    console.error("Error fetching distributors:", error.message);
                    setDistributorCount(0);
                }
            };

            fetchDistributors();
        }, [currentUserId]);

        // Styles
        const containerStyle = {
            padding: "40px 20px",
            maxWidth: "1600px",
            margin: "0 auto",
            fontFamily: "Arial, sans-serif",
            color: "#333",
        };

        const titleStyle = {
            fontSize: "28px",
            fontWeight: "bold",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
        };

        const searchExportContainer = {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
            gap: "10px",
            flexWrap: "wrap",
        };

        const searchInputStyle = {
            padding: "8px 12px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            flexGrow: 1,
            maxWidth: "300px",
        };

        return (
            <div style={containerStyle}>
                <div style={titleStyle}>
                    <h1 style={{ margin: 0 }}>
                        <span style={{ marginLeft: "10px" }}>Total Marketing Per Status</span>
                    </h1>
                </div>

                {/* Cards Container */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: '24px',
                    marginTop: '30px',
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                }}>

                    {/* Assigned Distributors Card */}
                    <div style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '260px',
                        boxShadow: '0 6px 12px rgba(0,0,0,0.08)',
                        backgroundColor: '#fff',
                        textAlign: 'center',
                        transition: 'transform 0.2s ease',
                        cursor: 'default',
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{
                            fontSize: '18px',
                            color: '#555',
                            marginBottom: '14px',
                            fontWeight: '700',
                            letterSpacing: '0.04em',
                            width: '220px'
                        }}>
                            Assigned Distributors
                        </div>
                        <div style={{
                            fontSize: '32px',
                            fontWeight: '800',
                            color: '#f4a261',
                            letterSpacing: '0.02em',
                        }}>
                            {distributorCount !== null ? distributorCount : "Loading..."}
                        </div>
                    </div>

                    {/* Total Budget Card */}
                    <div style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '260px',
                        boxShadow: '0 6px 12px rgba(0,0,0,0.08)',
                        backgroundColor: '#fff',
                        textAlign: 'center',
                        transition: 'transform 0.2s ease',
                        cursor: 'default',
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{
                            fontSize: '18px',
                            color: '#555',
                            marginBottom: '14px',
                            fontWeight: '700',
                            letterSpacing: '0.04em',
                        }}>
                            Total Budget
                        </div>
                        <div style={{
                            fontSize: '32px',
                            fontWeight: '800',
                            color: '#0077b6',
                            letterSpacing: '0.02em',
                        }}>
                            {totalBudget !== null ? `₱${totalBudget.toLocaleString()}` : "Loading..."}
                        </div>
                    </div>

                    {/* Remaining Balance Card */}
                    <div style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                        padding: '24px',
                        width: '260px',
                        boxShadow: '0 6px 12px rgba(0,0,0,0.08)',
                        backgroundColor: '#fff',
                        textAlign: 'center',
                        transition: 'transform 0.2s ease',
                        cursor: 'default',
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{
                            fontSize: '18px',
                            color: '#555',
                            marginBottom: '14px',
                            fontWeight: '700',
                            letterSpacing: '0.04em',
                        }}>
                            Remaining Balanced
                        </div>
                        <div style={{
                            fontSize: '32px',
                            fontWeight: '800',
                            color: '#2a9d8f',
                            letterSpacing: '0.02em',
                        }}>
                            {totalRemaining !== null ? `₱${totalRemaining.toLocaleString()}` : "Loading..."}
                        </div>
                    </div>
                </div>

                <div style={searchExportContainer}>
                    <input
                        type="text"
                        placeholder="Search by Cover PWP Code or Distributor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                    />
                    <button
                        onClick={exportToExcel}
                        title="Export to Excel"
                        style={{
                            backgroundColor: "#1f7a1f",
                            border: "none",
                            padding: "10px 16px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: "#fff",
                            fontWeight: "bold",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                            transition: "background-color 0.3s, transform 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#166d16";
                            e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#1f7a1f";
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                    >
                        <FaFileExcel size={20} />
                        Export to Excel
                    </button>
                </div>
                {/* ✅ DISTRIBUTOR TABS - ADD THIS BEFORE TABLE */}
                <div style={{
                    display: 'flex',
                    gap: 12,
                    padding: '20px 20px 0',
                    overflowX: 'auto',
                    backgroundColor: '#fff',
                    borderRadius: '10px 10px 0 0',
                    borderBottom: '2px solid #e5e7eb',
                    marginTop: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    {uniqueDistributors.map(dist => (
                        <button
                            key={dist}
                            onClick={() => {
                                setActiveDistributor(dist);
                                setCurrentPage(1);
                                setExpandedRow(null);
                            }}
                            style={{
                                padding: '12px 24px',
                                border: 'none',
                                borderBottom: activeDistributor === dist ? '3px solid #2563eb' : '3px solid transparent',
                                background: activeDistributor === dist ? '#eff6ff' : 'transparent',
                                color: activeDistributor === dist ? '#2563eb' : '#6b7280',
                                fontWeight: activeDistributor === dist ? 700 : 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                borderRadius: '8px 8px 0 0'
                            }}
                            onMouseEnter={(e) => {
                                if (activeDistributor !== dist) {
                                    e.currentTarget.style.background = '#f3f4f6';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeDistributor !== dist) {
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            {dist === 'all' ? '🌐 All Distributors' : `📦 ${dist}`}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", fontSize: "16px", color: "#555" }}>
                        Loading records...
                    </div>
                ) : (
                    <>
                        <div style={{
                            overflowX: "auto",
                            backgroundColor: "#fff",
                            borderRadius: "10px",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                            border: "1px solid #ddd",
                        }}>
                            <table style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: "14px",
                            }}>
                                <thead style={{
                                    backgroundColor: "#2563eb",
                                    color: "#fff",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}>
                                    <tr>
                                        <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #ccc" }}>Cover PWP Code</th>
                                        <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #ccc" }}>Distributor</th>
                                        <th style={{ padding: "12px 16px", textAlign: "right", borderBottom: "1px solid #ccc" }}>Budget for 2025</th>
                                        <th style={{ padding: "12px 16px", textAlign: "right", borderBottom: "1px solid #ccc" }}>Remaining Budget</th>
                                        <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #ccc" }}>Created At</th>
                                        <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #ccc" }}>Created By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRows.length > 0 ? (
                                        paginatedRows.map((row, idx) => (
                                            <React.Fragment key={row.cover_code}>
                                                <tr
                                                    style={{
                                                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                                                        transition: "background-color 0.3s",
                                                        cursor: "pointer",
                                                    }}
                                                    onClick={() => handleRowClick(row.cover_code)}
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.backgroundColor = "#eff6ff")
                                                    }
                                                    onMouseLeave={(e) =>
                                                    (e.currentTarget.style.backgroundColor =
                                                        idx % 2 === 0 ? "#ffffff" : "#f9fafb")
                                                    }
                                                >
                                                    <td style={{ padding: "12px 16px", borderTop: "1px solid #eee", verticalAlign: "middle" }}>{row.cover_code}</td>
                                                    <td style={{ padding: "12px 16px", borderTop: "1px solid #eee", verticalAlign: "middle" }}>{row.distributor_name}</td>
                                                    <td style={{ padding: "12px 16px", borderTop: "1px solid #eee", verticalAlign: "middle", textAlign: "right" }}>
                                                        ₱
                                                        {Number(row.budget2025).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}
                                                    </td>
                                                    <td style={{ padding: "12px 16px", borderTop: "1px solid #eee", verticalAlign: "middle", textAlign: "right" }}>
                                                        ₱
                                                        {Number(row.remainingBudget).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}
                                                    </td>
                                                    <td style={{ padding: "12px 16px", borderTop: "1px solid #eee", verticalAlign: "middle" }}>
                                                        {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                                                    </td>
                                                    <td style={{ padding: "12px 16px", borderTop: "1px solid #eee", verticalAlign: "middle" }}>{row.createdByName}</td>
                                                </tr>

                                                {expandedRow === row.cover_code && (
                                                    <tr style={{ backgroundColor: "#f0f4ff" }}>
                                                        <td colSpan="6" style={{ padding: "16px" }}>
                                                            {loadingDetails && !approvedDetails[row.cover_code] ? (
                                                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100px", fontSize: "16px", color: "#555" }}>
                                                                    Loading details...
                                                                </div>
                                                            ) : approvedDetails[row.cover_code] && approvedDetails[row.cover_code].length > 0 ? (
                                                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                                                    <thead>
                                                                        <tr>
                                                                            <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #bbb", backgroundColor: "#dbeafe" }}>ID</th>
                                                                            <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #bbb", backgroundColor: "#dbeafe" }}>PWP Code</th>
                                                                            <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #bbb", backgroundColor: "#dbeafe" }}>Response</th>
                                                                            <th style={{ padding: "8px 10px", borderBottom: "1px solid #bbb", backgroundColor: "#dbeafe" }}>Remaining Balance</th>
                                                                            <th style={{ padding: "8px 10px", borderBottom: "1px solid #bbb", backgroundColor: "#dbeafe" }}>Credit Budget</th>
                                                                            <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #bbb", backgroundColor: "#dbeafe" }}>Date Responded</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {approvedDetails[row.cover_code].map((detail) => (
                                                                            <tr key={detail.id}>
                                                                                <td style={{ padding: "8px 10px", borderTop: "1px solid #ddd" }}>{detail.id}</td>
                                                                                <td style={{ padding: "8px 10px", borderTop: "1px solid #ddd" }}>{detail.pwp_code}</td>
                                                                                <td style={{ padding: "8px 10px", borderTop: "1px solid #ddd" }}>{detail.response}</td>
                                                                                <td style={{ padding: "8px 10px", borderTop: "1px solid #ddd" }}>
                                                                                    ₱
                                                                                    {detail.remaining_balance !== null
                                                                                        ? Number(detail.remaining_balance).toLocaleString(undefined, {
                                                                                            minimumFractionDigits: 2,
                                                                                            maximumFractionDigits: 2,
                                                                                        })
                                                                                        : "-"}
                                                                                </td>
                                                                                <td style={{ padding: "8px 10px", borderTop: "1px solid #ddd" }}>
                                                                                    ₱
                                                                                    {detail.credit_budget !== null
                                                                                        ? Number(detail.credit_budget).toLocaleString(undefined, {
                                                                                            minimumFractionDigits: 2,
                                                                                            maximumFractionDigits: 2,
                                                                                        })
                                                                                        : "-"}
                                                                                </td>
                                                                                <td style={{ padding: "8px 10px", borderTop: "1px solid #ddd" }}>
                                                                                    {detail.date_responded
                                                                                        ? new Date(detail.date_responded).toLocaleString()
                                                                                        : "-"}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div style={{ textAlign: "center", padding: "20px", color: "#999", fontWeight: "500" }}>
                                                                    No data.
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: "center", padding: "20px", color: "#999", fontWeight: "500" }}>
                                                No records found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {filteredRows.length > 0 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '15px 20px',
                                backgroundColor: '#f9fafb',
                                borderTop: '1px solid #ddd',
                                flexWrap: 'wrap',
                                gap: '10px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '14px', color: '#555' }}>Rows per page:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={handleItemsPerPageChange}
                                        style={{
                                            padding: '6px 10px',
                                            fontSize: '14px',
                                            borderRadius: '6px',
                                            border: '1px solid #ccc',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <span style={{ fontSize: '14px', color: '#555', marginLeft: '15px' }}>
                                        Showing {startIndex + 1} to {Math.min(endIndex, filteredRows.length)} of {filteredRows.length} entries
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button
                                        onClick={() => handlePageChange(1)}
                                        disabled={currentPage === 1}
                                        style={{
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            borderRadius: '6px',
                                            border: '1px solid #ccc',
                                            backgroundColor: currentPage === 1 ? '#f0f0f0' : '#fff',
                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                            color: currentPage === 1 ? '#999' : '#333'
                                        }}
                                    >
                                        First
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        style={{
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            borderRadius: '6px',
                                            border: '1px solid #ccc',
                                            backgroundColor: currentPage === 1 ? '#f0f0f0' : '#fff',
                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                            color: currentPage === 1 ? '#999' : '#333'
                                        }}
                                    >
                                        Previous
                                    </button>

                                    {[...Array(totalPages)].map((_, index) => {
                                        const pageNumber = index + 1;
                                        if (
                                            pageNumber === 1 ||
                                            pageNumber === totalPages ||
                                            (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                        ) {
                                            return (
                                                <button
                                                    key={pageNumber}
                                                    onClick={() => handlePageChange(pageNumber)}
                                                    style={{
                                                        padding: '8px 12px',
                                                        fontSize: '14px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #ccc',
                                                        backgroundColor: currentPage === pageNumber ? '#2563eb' : '#fff',
                                                        color: currentPage === pageNumber ? '#fff' : '#333',
                                                        cursor: 'pointer',
                                                        fontWeight: currentPage === pageNumber ? 'bold' : 'normal'
                                                    }}
                                                >
                                                    {pageNumber}
                                                </button>
                                            );
                                        } else if (
                                            pageNumber === currentPage - 2 ||
                                            pageNumber === currentPage + 2
                                        ) {
                                            return <span key={pageNumber} style={{ padding: '8px 4px' }}>...</span>;
                                        }
                                        return null;
                                    })}

                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        style={{
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            borderRadius: '6px',
                                            border: '1px solid #ccc',
                                            backgroundColor: currentPage === totalPages ? '#f0f0f0' : '#fff',
                                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                            color: currentPage === totalPages ? '#999' : '#333'
                                        }}
                                    >
                                        Next
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(totalPages)}
                                        disabled={currentPage === totalPages}
                                        style={{
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            borderRadius: '6px',
                                            border: '1px solid #ccc',
                                            backgroundColor: currentPage === totalPages ? '#f0f0f0' : '#fff',
                                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                            color: currentPage === totalPages ? '#999' : '#333'
                                        }}
                                    >
                                        Last
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }
