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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: coverData, error: coverError } = await supabase
                    .from("cover_pwp")
                    .select("cover_code, distributor_code, amount_badget, created_at, createForm")
                    .order("id", { ascending: true });

                if (coverError) throw coverError;

                const { data: approvedData, error: approvedError } = await supabase
                    .from("approved_history_budget")
                    .select("cover_pwp_code, credit_budget, remaining_balance")
                    .order("id", { ascending: true });

                if (approvedError) throw approvedError;

                const { data: distributorsData, error: distributorsError } = await supabase
                    .from("distributors")
                    .select("code, name");

                if (distributorsError) throw distributorsError;

                const distributorMap = {};
                distributorsData.forEach((dist) => {
                    distributorMap[dist.code] = dist.name;
                });

                const approvedMap = {};
                approvedData.forEach((appr) => {
                    const key = appr.cover_pwp_code;
                    if (!key) return;
                    if (!approvedMap[key]) {
                        approvedMap[key] = { credit_budget: 0, remaining_balance: 0 };
                    }
                    approvedMap[key].credit_budget += Number(appr.credit_budget || 0);
                    approvedMap[key].remaining_balance += Number(appr.remaining_balance || 0);
                });

                const combined = coverData.map((cov) => {
                    const key = cov.cover_code;
                    const aprov = approvedMap[key] || { credit_budget: 0, remaining_balance: 0 };
                    const distributorName = distributorMap[cov.distributor_code] || `Code: ${cov.distributor_code}`;

                    return {
                        cover_code: cov.cover_code,
                        distributor_name: distributorName,
                        budget2025: cov.amount_badget || 0,
                        totalApprovedPWP: aprov.credit_budget,
                        remainingBudget: aprov.remaining_balance,
                        created_at: cov.created_at,
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

    // Filter rows based on search query (case-insensitive)


    // Export to Excel handler
    const exportToExcel = () => {
        // Prepare worksheet data
        const worksheetData = filteredRows.map((row) => ({
            "Cover PWP Code": row.cover_code,
            Distributor: row.distributor_name,
            "Budget for 2025": row.budget2025,
            "Total Approved PWP": row.totalApprovedPWP,
            "Remaining Budget": row.remainingBudget,
            "Created Form": row.createForm,
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






    const [rows, setRows] = useState([]);
    // ... other states

    // Get user info
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const currentUserId = currentUser?.name?.toLowerCase().trim() || "";
    const role = currentUser?.role?.toLowerCase() || "";

    // Filter rows based on user role & createForm
    const userFilteredRows = rows.filter((entry) => {
        if (role === "admin") return true;
        return (entry.createForm || "").toLowerCase().trim() === currentUserId;
    });

    // Filter userFilteredRows further based on search query
    const filteredRows = userFilteredRows.filter(
        (row) =>
            row.cover_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            row.distributor_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Calculate sum of remainingBudget for userFilteredRows

    // Styles (unchanged except for search and button container)
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

    const exportButtonStyle = {
        padding: "8px 16px",
        fontSize: "14px",
        borderRadius: "6px",
        border: "none",
        backgroundColor: "#2563eb",
        color: "#fff",
        cursor: "pointer",
        transition: "background-color 0.3s",
    };

    const exportButtonHover = (e) => {
        e.currentTarget.style.backgroundColor = "#1e40af";
    };

    const exportButtonLeave = (e) => {
        e.currentTarget.style.backgroundColor = "#2563eb";
    };

    // (The rest of your styles unchanged, you can keep the existing ones)

    // ...your existing styles like tableContainerStyle, tableStyle, etc.



    const [totalBudget, setTotalBudget] = React.useState(null);



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

            setMonthlyTrend(monthlyTrendArray);       // For Approved + Disapproved
            setPpeTrend(monthlyTrendArray);           // For Cancelled only (can filter later if needed)
        }

        fetchMonthlyTrends();
    }, []);

    const [totalRemaining, setTotalRemaining] = React.useState(null);

    const fetchRemainingBalance = React.useCallback(async () => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (!storedUser || !storedUser.name) return;

        const { data, error } = await supabase
            .from('amount_badget')
            .select('remainingbalance, amountbadget')
            .eq('createduser', storedUser.name)
            .or('Approved.is.null,Approved.eq.true');

        if (error) {
            console.error('Error fetching balances:', error);
            return;
        }

        const totalRemaining = data.reduce((acc, item) => acc + parseFloat(item.remainingbalance), 0);
        const totalBudget = data.reduce((acc, item) => acc + parseFloat(item.amountbadget), 0);

        setTotalRemaining(totalRemaining);
        setTotalBudget(totalBudget);
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
    const [monthlyTrend, setMonthlyTrend] = useState([]);  // Line data for Approved + Disapproved
    const [ppeTrend, setPpeTrend] = useState([]);      // Line data for Cancelled

    const [distributorCount, setDistributorCount] = useState(null);
    const storedUser = JSON.parse(localStorage.getItem('user'));
    const userName = storedUser?.name?.toLowerCase().trim();  // Normalize for safety
    const currentUserName = currentUser?.name?.toLowerCase().trim() || "";

    console.log("User name:", currentUser?.name || "");
    console.log("Role:", role);

    useEffect(() => {
        if (!currentUserId) return;

        const fetchDistributors = async () => {
            try {
                const { data, error } = await supabase
                    .from('user_distributors')
                    .select('id')
                    .eq('username', currentUser?.name); // must match DB exactly

                if (error) throw error;

                setDistributorCount(data.length);
            } catch (error) {
                console.error("Error fetching distributors:", error.message);
                setDistributorCount(0);
            }
        };

        fetchDistributors();
    }, [currentUserId]);
    return (
        <div style={containerStyle}>
            <div style={titleStyle}>
                <h1 style={{ margin: 0 }}>
                    <span style={{ marginLeft: "10px" }}>Total Marketing Per Status</span>
                </h1>
            </div>
            {/* Distributor Count Card */}
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
                        width:'220px'
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
                        Remaining Balance
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

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", fontSize: "16px", color: "#555" }}>
                    Loading records...
                </div>
            ) : (
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
                                <th style={{ padding: "12px 16px", textAlign: "right", borderBottom: "1px solid #ccc" }}>Total Approved PWP</th>
                                <th style={{ padding: "12px 16px", textAlign: "right", borderBottom: "1px solid #ccc" }}>Remaining Budget</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid #ccc" }}>Created Form</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length > 0 ? (
                                filteredRows.map((row, idx) => (
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
                                                {Number(row.totalApprovedPWP).toLocaleString(undefined, {
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
                                            <td style={{ padding: "12px 16px", borderTop: "1px solid #eee", verticalAlign: "middle" }}>{row.createForm}</td>
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
                                                                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #bbb", backgroundColor: "#dbeafe" }}>Type</th>
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
                                                                        <td style={{ padding: "8px 10px", borderTop: "1px solid #ddd" }}>{detail.type}</td>
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
            )}
        </div>
    );
}
