import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { CSVLink } from "react-csv";

const PAGE_SIZE = 10;

const UploadExportRegularPWP = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [filterToday, setFilterToday] = useState(false);
    const [filterApproved, setFilterApproved] = useState(false);
    const [distributorMap, setDistributorMap] = useState({});
    const [approvalMap, setApprovalMap] = useState({});
    const [activityMap, setActivityMap] = useState({});
    const [userMap, setUserMap] = useState({});

    const handlePageSizeChange = (e) => {
        setPageSize(Number(e.target.value));
        setPage(1);
    };

    const handleFirst = () => setPage(1);
    const handleLast = () => setPage(totalPages);

    const fetchRecords = async () => {
        setLoading(true);

        let query = supabase
            .from("regular_pwp")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });

        if (search) {
            query = query.ilike("activity", `%${search}%`);
        }

        if (filterToday) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            query = query.gte("created_at", today.toISOString()).lt("created_at", tomorrow.toISOString());
        }

        const { data, count, error } = await query;

        if (error) console.error(error);
        else {
            let filteredData = data;

            if (filterApproved) {
                filteredData = data.filter(r => approvalMap[r.regularpwpcode]);
            }

            const start = (page - 1) * pageSize;
            const end = start + pageSize;
            setRecords(filteredData.slice(start, end));
            setTotalPages(Math.ceil(filteredData.length / pageSize) || 1);
        }

        setLoading(false);
    };

    const fetchDistributors = async () => {
        const { data, error } = await supabase
            .from("distributors")
            .select("code,name");

        if (error) console.error(error);
        else {
            const map = {};
            data.forEach(d => {
                map[d.code] = d.name;
            });
            setDistributorMap(map);
        }
    };

    const fetchApprovals = async () => {
        const { data, error } = await supabase
            .from("Approval_History")
            .select("PwpCode, DateResponded");

        if (error) console.error(error);
        else {
            const map = {};
            data.forEach(a => {
                if (!map[a.PwpCode] || new Date(a.DateResponded) > new Date(map[a.PwpCode])) {
                    map[a.PwpCode] = a.DateResponded;
                }
            });
            setApprovalMap(map);
        }
    };

    const fetchActivities = async () => {
        const { data, error } = await supabase
            .from("activity")
            .select("code, name, glcode");

        if (error) console.error(error);
        else {
            const map = {};
            data.forEach(a => {
                map[a.code] = {
                    name: a.name,
                    glcode: a.glcode
                };
            });
            setActivityMap(map);
        }
    };


    const fetchUsers = async () => {
        const { data, error } = await supabase
            .from("Account_Users")
            .select("UserID, name");

        if (error) console.error(error);
        else {
            const map = {};
            data.forEach(u => {
                map[u.UserID] = u.name || '';
            });
            setUserMap(map);
        }
    };

    useEffect(() => {
        fetchDistributors();
        fetchApprovals();
        fetchActivities();
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchRecords();
    }, [page, search, filterToday, filterApproved, approvalMap, pageSize]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handlePrev = () => {
        if (page > 1) setPage(page - 1);
    };

    const handleNext = () => {
        if (page < totalPages) setPage(page + 1);
    };

    return (
        <div style={{
            width: "100%",
            padding: "30px",
            boxSizing: "border-box",
            backgroundColor: "#f0f2f5",
            minHeight: "100vh"
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: "white",
                padding: "25px",
                borderRadius: "12px",
                marginBottom: "25px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
            }}>
                <h2 style={{
                    margin: "0 0 20px 0",
                    color: "#1a202c",
                    fontSize: "28px",
                    fontWeight: "700"
                }}>
                    Regular PWP Records
                </h2>

                {/* Search and Filters */}
                <div style={{
                    display: "flex",
                    gap: "15px",
                    marginBottom: "20px",
                    flexWrap: "wrap",
                    alignItems: "center"
                }}>
                    <div style={{ position: "relative", flexGrow: 1, minWidth: "250px" }}>
                        <span style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#718096",
                            fontSize: "18px"
                        }}>
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Search by Activity..."
                            value={search}
                            onChange={handleSearch}
                            style={{
                                padding: "12px 12px 12px 45px",
                                borderRadius: "8px",
                                border: "2px solid #e2e8f0",
                                width: "100%",
                                fontSize: "14px",
                                transition: "all 0.3s",
                                outline: "none"
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#3182ce"}
                            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                        />
                    </div>

                    {/* Filter Buttons */}
                    <button
                        onClick={() => {
                            setFilterToday(!filterToday);
                            setPage(1);
                        }}
                        style={{
                            padding: "12px 20px",
                            borderRadius: "8px",
                            border: "2px solid",
                            borderColor: filterToday ? "#3182ce" : "#e2e8f0",
                            backgroundColor: filterToday ? "#ebf8ff" : "white",
                            color: filterToday ? "#2c5282" : "#4a5568",
                            cursor: "pointer",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.3s",
                            fontSize: "14px"
                        }}
                    >
                        📅 Today
                    </button>

                    <button
                        onClick={() => {
                            setFilterApproved(!filterApproved);
                            setPage(1);
                        }}
                        style={{
                            padding: "12px 20px",
                            borderRadius: "8px",
                            border: "2px solid",
                            borderColor: filterApproved ? "#38a169" : "#e2e8f0",
                            backgroundColor: filterApproved ? "#f0fff4" : "white",
                            color: filterApproved ? "#22543d" : "#4a5568",
                            cursor: "pointer",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.3s",
                            fontSize: "14px"
                        }}
                    >
                        ✓ Approved
                    </button>

                    <CSVLink
                        data={records.map(r => ({
                            "Purchase Order": r.regularpwpcode,
                            "Vendor": r.distributor,
                            "Vendor Name": distributorMap[r.distributor] || r.distributor,
                            "Suppliers Ref. No.": r.regularpwpcode,
                            "Posting Date": approvalMap[r.regularpwpcode]
                                ? new Date(approvalMap[r.regularpwpcode]).toLocaleDateString()
                                : "N/A",
                            "PO Date": r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
                            "(01)Description": activityMap[r.activity]?.name || r.activity, // ✅ FIXED: show Activity Name
                            "(02)Account Code": activityMap[r.activity]?.glcode || "", // ✅ FIXED: show GL Code
                            "(06)Price VAT-EXt": r.credit_budget,
                            "Customer List": r.branchType,
                            "Start Date": r.activityDurationFrom
                                ? new Date(r.activityDurationFrom).toLocaleDateString()
                                : "",
                            "End Date": r.activityDurationTo
                                ? new Date(r.activityDurationTo).toLocaleDateString()
                                : "",
                            "Remarks (UDF)": `${r.objective || ""}${r.objective && r.promoScheme ? " | " : ""}${r.promoScheme || ""}`,
                            "Buyer": userMap[r.createForm] || r.createForm,
                            "Prepared By": userMap[r.createForm] || r.createForm,
                        }))}
                        filename={"regular_pwp_sap_template.csv"}
                        style={{
                            padding: "12px 24px",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            backgroundColor: "#3182ce",
                            color: "white",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            textDecoration: "none",
                            transition: "all 0.3s",
                            fontSize: "14px"
                        }}
                    >
                        📥 Export CSV
                    </CSVLink>

                </div>

                {/* Active Filters Display */}
                {(filterToday || filterApproved) && (
                    <div style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        fontSize: "13px",
                        color: "#4a5568"
                    }}>
                        <span style={{ fontSize: "16px" }}>🔽</span>
                        <span style={{ fontWeight: "600" }}>Active Filters:</span>
                        {filterToday && (
                            <span style={{
                                padding: "4px 12px",
                                backgroundColor: "#ebf8ff",
                                color: "#2c5282",
                                borderRadius: "6px",
                                fontWeight: "500"
                            }}>
                                Today
                            </span>
                        )}
                        {filterApproved && (
                            <span style={{
                                padding: "4px 12px",
                                backgroundColor: "#f0fff4",
                                color: "#22543d",
                                borderRadius: "6px",
                                fontWeight: "500"
                            }}>
                                Approved
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Table */}
            <div style={{
                width: "100%",
                overflowX: "auto",
                borderRadius: "12px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                backgroundColor: "#fff"
            }}>
                <table style={{
                    width: "100%",
                    minWidth: "1500px",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}>
                    <thead>
                        <tr>
                            {[
                                "Regular PWP",
                                "Vendor Code",
                                "Distributor",
                                "PWP Code",
                                "Date Approved",
                                "Creation Date",
                                "Activity",
                                "Activity Code",
                                "PWP Amount",
                                "Branch",
                                "Activity Duration From",
                                "Activity Duration To",
                                "Objective",
                                "Promo Scheme",
                                "Buyer",
                                "Prepared By",
                            ].map((col) => (
                                <th
                                    key={col}
                                    style={{
                                        backgroundColor: "#0d6efd",
                                        color: "white",
                                        padding: "16px 12px",
                                        textAlign: "left",
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 10,
                                        whiteSpace: "nowrap",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                        borderBottom: "3px solid #3182ce"
                                    }}
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={16} style={{
                                    textAlign: "center",
                                    padding: "40px",
                                    color: "#718096",
                                    fontSize: "15px"
                                }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : records.length === 0 ? (
                            <tr>
                                <td colSpan={16} style={{
                                    textAlign: "center",
                                    padding: "40px",
                                    color: "#718096",
                                    fontSize: "15px"
                                }}>
                                    No records found
                                </td>
                            </tr>
                        ) : (
                            records.map((r, idx) => (
                                <tr
                                    key={r.id}
                                    style={{
                                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f7fafc",
                                        transition: "all 0.2s"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#edf2f7"}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#f7fafc"}
                                >
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.regularpwpcode}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.distributor}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {distributorMap[r.distributor] || r.distributor}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.regularpwpcode}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {approvalMap[r.regularpwpcode] ? (
                                            <span style={{
                                                padding: "4px 10px",
                                                backgroundColor: "#c6f6d5",
                                                color: "#22543d",
                                                borderRadius: "6px",
                                                fontSize: "13px",
                                                fontWeight: "500"
                                            }}>
                                                {new Date(approvalMap[r.regularpwpcode]).toLocaleDateString()}
                                            </span>
                                        ) : (
                                            <span style={{
                                                padding: "4px 10px",
                                                backgroundColor: "#fed7d7",
                                                color: "#742a2a",
                                                borderRadius: "6px",
                                                fontSize: "13px",
                                                fontWeight: "500"
                                            }}>
                                                N/A
                                            </span>
                                        )}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {activityMap[r.activity]?.name || r.activity}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {activityMap[r.activity]?.glcode || r.activity}
                                    </td>

                                    <td
                                        style={{
                                            padding: "14px 12px",
                                            whiteSpace: "nowrap",
                                            fontSize: "14px",
                                            color: "#2d3748",
                                            fontWeight: "600",
                                            borderBottom: "1px solid #e2e8f0",
                                        }}
                                    >
                                        ₱
                                        {r.credit_budget
                                            ? parseFloat(r.credit_budget).toLocaleString("en-PH", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })
                                            : "0.00"}
                                    </td>

                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.branchType}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.activityDurationFrom ? new Date(r.activityDurationFrom).toLocaleDateString() : ""}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.activityDurationTo ? new Date(r.activityDurationTo).toLocaleDateString() : ""}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0",
                                        maxWidth: "200px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis"
                                    }}>
                                        {r.objective}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {r.promoScheme}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {userMap[r.createForm] || r.createForm}
                                    </td>
                                    <td style={{
                                        padding: "14px 12px",
                                        whiteSpace: "nowrap",
                                        fontSize: "14px",
                                        color: "#2d3748",
                                        borderBottom: "1px solid #e2e8f0"
                                    }}>
                                        {userMap[r.createForm] || r.createForm}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "25px",
                flexWrap: "wrap",
                gap: "15px",
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
            }}>
                <span style={{
                    fontWeight: "600",
                    color: "#2d3748",
                    fontSize: "14px"
                }}>
                    Page {page} of {totalPages}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label style={{
                        marginRight: "5px",
                        fontWeight: "600",
                        color: "#4a5568",
                        fontSize: "14px"
                    }}>
                        Rows per page:
                    </label>
                    <select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "2px solid #e2e8f0",
                            fontSize: "14px",
                            fontWeight: "500",
                            cursor: "pointer",
                            outline: "none"
                        }}
                    >
                        {[5, 10, 20, 50, 100].map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={handleFirst}
                        disabled={page === 1}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: page === 1 ? "not-allowed" : "pointer",
                            backgroundColor: page === 1 ? "#cbd5e0" : "#3182ce",
                            color: "#fff",
                            fontSize: "14px",
                            transition: "all 0.3s"
                        }}
                    >
                        First
                    </button>
                    <button
                        onClick={handlePrev}
                        disabled={page === 1}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: page === 1 ? "not-allowed" : "pointer",
                            backgroundColor: page === 1 ? "#cbd5e0" : "#3182ce",
                            color: "#fff",
                            fontSize: "14px",
                            transition: "all 0.3s"
                        }}
                    >
                        Prev
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={page === totalPages}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: page === totalPages ? "not-allowed" : "pointer",
                            backgroundColor: page === totalPages ? "#cbd5e0" : "#3182ce",
                            color: "#fff",
                            fontSize: "14px",
                            transition: "all 0.3s"
                        }}
                    >
                        Next
                    </button>
                    <button
                        onClick={handleLast}
                        disabled={page === totalPages}
                        style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            fontWeight: "600",
                            cursor: page === totalPages ? "not-allowed" : "pointer",
                            backgroundColor: page === totalPages ? "#cbd5e0" : "#3182ce",
                            color: "#fff",
                            fontSize: "14px",
                            transition: "all 0.3s"
                        }}
                    >
                        Last
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadExportRegularPWP;
