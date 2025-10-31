import React, { useEffect, useState, useMemo ,useCallback} from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,Bar,BarChart
} from "recharts";
import {
  Card,
  Spinner,
  Table,
  Row,
  Col,
  Form,
  Button,
  InputGroup,
  Dropdown,
  ButtonGroup,
  Badge,
} from "react-bootstrap";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import KasBudgetCard from "./KAS";
import DistributorBudgetCard from "./DistributorBudgetCard";

const initialStatuses = [
  { label: "For Approval", color: "#f59e0b", fontSize: "1rem" },
  { label: "Approved", color: "#10b981", fontSize: "1.2rem" },
  { label: "Disapproved", color: "#ef4444", fontSize: "1.2rem" }, // Keep label as "Disapproved"
  { label: "Cancelled", color: "#3b82f6", fontSize: "1rem" },
];


{
  initialStatuses.map(({ label, color, fontSize }) => (
    <div key={label} style={{ color, fontSize, fontWeight: 600 }}>
      {label}
    </div>
  ))
}
const DashboardForSuperAdmin = ({ progress }) => {
  const [budgetData, setBudgetData] = useState([]);
  const [regularData, setRegularData] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchBudget, setSearchBudget] = useState("");
  const [searchRegular, setSearchRegular] = useState("");
  const [pageBudget, setPageBudget] = useState(1);
  const [pageRegular, setPageRegular] = useState(1);
  const pageSize = 10;
  const [budgetDateFrom, setBudgetDateFrom] = useState("");
  const [budgetDateTo, setBudgetDateTo] = useState("");
  const [regularDateFrom, setRegularDateFrom] = useState("");
  const [regularDateTo, setRegularDateTo] = useState("");
  const [distributorBalances, setDistributorBalances] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          { data: budget, error: budgetError },
          { data: regular, error: regularError },
          { data: dist, error: distError },
          { data: users, error: usersError },
          { data: activities, error: activityError },
        ] = await Promise.all([
          supabase.from("amount_badget").select("id, pwp_code, distributor, amountbadget, remainingbalance, createduser, createdate"),
          supabase.from("regular_pwp").select("id, regularpwpcode, activity, distributor, remaining_balance, credit_budget, created_at"),
          supabase.from("distributors").select("code, name"),
          supabase.from("Account_Users").select('"UserID", name, profilePicture'),
          supabase.from("activity").select("code, name"),
        ]);

        if (budgetError) throw budgetError;
        if (regularError) throw regularError;
        if (distError) throw distError;
        if (usersError) throw usersError;
        if (activityError) throw activityError;

        const distMap = {};
        (dist || []).forEach((d) => { distMap[d.code] = d.name; });
        const userMap = {};
        (users || []).forEach((u) => { userMap[u.UserID] = { name: u.name, profilePicture: u.profilePicture || "" }; });
        const activityMap = {};
        (activities || []).forEach((a) => { activityMap[a.code] = a.name; });

        const mappedBudget = (budget || []).map((b) => {
          const user = userMap[b.createduser] || { name: b.createduser || "Unknown", profilePicture: "" };
          return { ...b, distributor_name: distMap[b.distributor] || b.distributor || "Unknown", createduser_name: user.name, profilePicture: user.profilePicture };
        });

        const mappedRegular = (regular || []).map((r) => {
          const user = userMap[r.createduser] || { name: r.createduser || "Unknown" };
          return { ...r, distributor_name: distMap[r.distributor] || r.distributor || "Unknown", createduser_name: user.name, activity_name: activityMap[r.activity] || r.activity || "Unknown" };
        });

        setBudgetData(mappedBudget);
        setRegularData(mappedRegular);
        setDistributors(dist || []);
      } catch (err) {
        console.error("Error fetching data:", err.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  
  const formatCurrency = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [filterDistributorBudget, setFilterDistributorBudget] = useState("");
  const [filterDistributorRegular, setFilterDistributorRegular] = useState("");
  const [filterActivityRegular, setFilterActivityRegular] = useState("");

  const filteredBudget = useMemo(() => {
    const q = searchBudget.toLowerCase();
    return budgetData.filter((row) => {
      const inSearch = !q || String(row.id).includes(q) || (row.pwp_code && row.pwp_code.toLowerCase().includes(q)) || (row.distributor_name && row.distributor_name.toLowerCase().includes(q)) || (row.createduser && row.createduser.toLowerCase().includes(q));
      const inDate = (!budgetDateFrom || new Date(row.createdate) >= new Date(budgetDateFrom)) && (!budgetDateTo || new Date(row.createdate) <= new Date(budgetDateTo));
      const inDistributor = !filterDistributorBudget || row.distributor_name === filterDistributorBudget;
      return inSearch && inDate && inDistributor;

    });
  }, [budgetData, searchBudget, budgetDateFrom, budgetDateTo, filterDistributorBudget]);

  const filteredRegular = useMemo(() => {
    const q = searchRegular.toLowerCase();
    return regularData.filter((row) => {
      const inSearch =
        !q ||
        String(row.id).includes(q) ||
        (row.regularpwpcode && row.regularpwpcode.toLowerCase().includes(q)) ||
        (row.activity && row.activity.toLowerCase().includes(q));
      const inDate =
        (!regularDateFrom || new Date(row.created_at) >= new Date(regularDateFrom)) &&
        (!regularDateTo || new Date(row.created_at) <= new Date(regularDateTo));
      const inActivity = !filterActivityRegular || row.activity === filterActivityRegular; // <-- updated line
      return inSearch && inDate && inActivity;
    });
  }, [regularData, searchRegular, regularDateFrom, regularDateTo, filterActivityRegular]);



  const budgetStart = (pageBudget - 1) * pageSize;
  const regularStart = (pageRegular - 1) * pageSize;
  const paginatedBudget = filteredBudget.slice(budgetStart, budgetStart + pageSize);
  const paginatedRegular = filteredRegular.slice(regularStart, regularStart + pageSize);

  const exportToPDF = (rows, title = "Export") => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    let columns = [], data = [];
    if (rows.length && rows[0].pwp_code !== undefined) {
      columns = ["ID", "PWP Code", "Distributor", "Amount Budget", "Remaining", "Agent", "Create Date"];
      data = rows.map((r) => [r.id, r.pwp_code, r.distributor_name, formatCurrency(r.amountbadget), formatCurrency(r.remainingbalance), r.createduser_name, r.createdate ? new Date(r.createdate).toLocaleString() : ""]);
    } else {
      columns = ["ID", "Regular PWP Code", "Activity", "Distributor", "Remaining", "Credit Budget", "Created At"];
      data = rows.map((r) => [r.id, r.regularpwpcode, r.activity_name, r.distributor_name, formatCurrency(r.remaining_balance), formatCurrency(r.credit_budget), r.created_at ? new Date(r.created_at).toLocaleString() : ""]);
    }
    autoTable(doc, { head: [columns], body: data, startY: 22, styles: { fontSize: 8 }, headStyles: { fillColor: [102, 126, 234] }, theme: "striped" });
    doc.save(`${title}_${Date.now()}.pdf`);
  };

  const exportToExcel = (rows, sheetName, filename) => {
    const wb = XLSX.utils.book_new();
    const sheetData = rows.map((r) => r.pwp_code ? { ID: r.id, "PWP Code": r.pwp_code, Distributor: r.distributor_name, Amount: formatCurrency(r.amountbadget), Remaining: formatCurrency(r.remainingbalance), Agent: r.createduser_name, "Create Date": r.createdate ? new Date(r.createdate).toLocaleString() : "" } : { ID: r.id, "Regular PWP Code": r.regularpwpcode, Activity: r.activity_name, Distributor: r.distributor_name, Remaining: formatCurrency(r.remaining_balance), "Credit Budget": formatCurrency(r.credit_budget), "Created At": r.created_at ? new Date(r.created_at).toLocaleString() : "" });
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), filename);
  };

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearData = budgetData.filter((b) => new Date(b.createdate).getFullYear() === year);
  const totalBudget = yearData.reduce((sum, b) => sum + Number(b.amountbadget || 0), 0);
  const totalRemaining = yearData.reduce((sum, b) => sum + Number(b.remainingbalance || 0), 0);
  const progressPercent = totalBudget ? Math.round((totalRemaining / totalBudget) * 100) : 0;

  const exportExcel = () => {
    const wsData = [{ Year: year, "Total Budget": totalBudget, "Total Remaining": totalRemaining }];
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Budget-${year}`);
    XLSX.writeFile(wb, `Budget-${year}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Budget Summary - ${year}`, 14, 20);
    const tableColumn = ["Year", "Total Budget", "Total Remaining"];
    const tableRows = [[year, totalBudget.toLocaleString(), totalRemaining.toLocaleString()]];
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 30 });
    doc.save(`Budget-${year}.pdf`);
  };

  const [totalRemainings, setTotalRemainings] = useState(null);

  const fetchRemainingBalance = useCallback(async () => {
      setLoading(true);
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (!storedUser || (!storedUser.UserID && !storedUser.id)) {
        setLoading(false);
        return;
      }
  
      const userId = storedUser.UserID ?? storedUser.id;
  
      const { data: budgetData, error: budgetError } = await supabase
        .from("amount_badget")
        .select("remainingbalance, distributor")
        .eq("createduser", userId)
        .or("Approved.is.null,Approved.eq.true");
  
      if (budgetError) {
        console.error("Error fetching remaining balance:", budgetError);
        setLoading(false);
        return;
      }
  
      const total = budgetData.reduce(
        (acc, item) => acc + parseFloat(item.remainingbalance || 0),
        0
      );
      setTotalRemainings(total);
  
      const distributorCodes = [
        ...new Set(
          budgetData.map((item) => item.distributor).filter((code) => code != null)
        ),
      ];
  
      if (distributorCodes.length > 0) {
        const { data: distributorData, error: distError } = await supabase
          .from("distributors")
          .select("code, name")
          .in("code", distributorCodes);
  
        if (distError) {
          console.error("Error fetching distributors:", distError);
        }
  
        const codeToNameMap = {};
        if (distributorData) {
          distributorData.forEach((dist) => {
            codeToNameMap[dist.code] = dist.name;
          });
        }
  
        const distBalances = {};
        budgetData.forEach((item) => {
          if (item.distributor) {
            if (!distBalances[item.distributor]) {
              distBalances[item.distributor] = 0;
            }
            distBalances[item.distributor] += parseFloat(
              item.remainingbalance || 0
            );
          }
        });
  
        const distArray = Object.entries(distBalances).map(([code, balance]) => ({
          code,
          name: codeToNameMap[code] || code,
          balance,
        }));
  
        setDistributorBalances(distArray);
      } else {
        setDistributorBalances([]);
      }
  
      setLoading(false);
    }, []);
  
    // Initial fetch
    useEffect(() => {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (!storedUser || (!storedUser.UserID && !storedUser.id)) return;
      fetchRemainingBalance();
    }, [fetchRemainingBalance]);
  
  
    const [animatedTotal, setAnimatedTotal] = useState(0);
  
    // Animate total remaining balance
    useEffect(() => {
      if (totalRemainings == null) return;
  
      let start = 0;
      const duration = 1000; // 1 second
      const increment = totalRemainings / (duration / 16);
      const interval = setInterval(() => {
        start += increment;
        if (start >= totalRemainings) {
          start = totalRemainings;
          clearInterval(interval);
        }
        setAnimatedTotal(start);
      }, 16);
  
      return () => clearInterval(interval);
    }, [totalRemainings]);



  // Initial fetch
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser || (!storedUser.UserID && !storedUser.id)) return;
    fetchRemainingBalance();
  }, [fetchRemainingBalance]);





  const [data, setData] = useState(
      initialStatuses.map(({ label, color }) => ({ label, value: 0, color }))
    );
  
    async function fetchVisaData(tableName) {
      const { data: records, error } = await supabase.from(tableName).select("notification");
  
      if (error) {
        console.error(`Error fetching data from ${tableName}:`, error);
        return [];
      }
      return records || [];
    }
    useEffect(() => {
      async function fetchVisaAndApprovalData() {
        try {
          const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
          const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
          const role = currentUser?.role || "";
  
          // Fetch visa records
          const coverVisa = await fetchVisaData("cover_pwp");
          const regularVisa = await fetchVisaData("regular_pwp");
  
          // Combine visa records and filter by CreatedForm if not admin
          let allVisaRecords = [...coverVisa, ...regularVisa];
          if (role !== 'admin') {
            allVisaRecords = allVisaRecords.filter(record =>
              record.CreatedForm?.toLowerCase().trim() === currentUserName
            );
          }
          const totalVisaCount = allVisaRecords.length;
  
          // Fetch approval history with Response and CreatedForm
          const { data: approvalRecords, error } = await supabase
            .from("Approval_History")
            .select("Response, CreatedForm");
  
          if (error) {
            console.error("Error fetching Approval_History:", error);
            return;
          }
  
          // Filter approval records by CreatedForm if not admin
          const filteredApprovalRecords = role === 'admin'
            ? approvalRecords
            : approvalRecords.filter(record => record.CreatedForm?.toLowerCase().trim() === currentUserName);
  
          // Count status occurrences
          let approvedCount = 0;
          let disapprovedCount = 0;
          let cancelledCount = 0;
  
          filteredApprovalRecords.forEach(record => {
            const response = record.Response;
            if (response === "Approved") {
              approvedCount++;
            } else if (response === "Declined" || response === "Disapproved") {
              disapprovedCount++;
            } else if (response === "Cancelled") {
              cancelledCount++;
            }
          });
  
          const forApprovalCount = totalVisaCount - approvedCount - disapprovedCount - cancelledCount;
  
          const statusCounts = {
            "For Approval": forApprovalCount > 0 ? forApprovalCount : 0,
            Approved: approvedCount,
            Disapproved: disapprovedCount,
            Cancelled: cancelledCount,
          };
  
          const updatedData = initialStatuses.map(({ label, color }) => ({
            label,
            value: statusCounts[label] || 0,
            color,
          }));
  
          setData(updatedData);
        } catch (error) {
          console.error("Error fetching visa and approval data:", error);
        }
      }
  
      fetchVisaAndApprovalData();
    }, []);
  
    const [monthlyTrend, setMonthlyTrend] = useState([]);  // Line data for Approved + Disapproved
    const [ppeTrend, setPpeTrend] = useState([]);      // Line data for Cancelled
  
    useEffect(() => {
      async function fetchApprovalHistory() {
        const { data: records, error } = await supabase
          .from("Approval_History")
          .select("Response");
  
        if (error) {
          console.error("Error fetching approval history:", error);
          return;
        }
  
        if (records) {
          const statusCounts = {};
  
          records.forEach((record) => {
            let status = record.Response || "For Approval";
  
            // Normalize values
            if (status === "Declined") status = "Disapproved";
  
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });
  
          const updatedData = initialStatuses.map(({ label, color }) => ({
            label,
            value: statusCounts[label] || 0,
            color,
          }));
  
          setData(updatedData);
        }
      }
  
      fetchApprovalHistory();
    }, []);
  
  
    
  
    // Fetch monthly trends (existing code)
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
          const month = new Date(DateResponded).toISOString().slice(0, 7);
  
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
  return (
    <div className="container-fluid py-4" style={{ maxWidth: "1800px", }}>
      {/* Hero Header */}
      <div className="mb-4 p-4">
        <h2 className="fw-bold mb-2" style={{ fontSize: "2rem", color: "#007bff" }}>
          📊 Budget & Analytics Dashboard
        </h2>
        <p className="mb-0" style={{ color: "#000", opacity: 0.9, fontSize: "1.05rem" }}>
          Comprehensive overview of budget allocation and team collaboration
        </p>
      </div>

    <div
          style={{
            padding: "40px",
            background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
            borderRadius: "24px",
            boxShadow: "0 12px 36px rgba(0,0,0,0.08)",
            maxWidth: "1500px",
            margin: "0 auto 50px auto",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "30px",
            }}
          >
            <h2
              style={{
                fontSize: "1.8rem",
                fontWeight: "800",
                color: "#065f46",
                margin: 0,
              }}
            >
              Remaining Balance Overview
            </h2>

            <button
              onClick={fetchRemainingBalance}
              disabled={loading}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transform: loading ? "rotate(360deg)" : "none",
                transition: "transform 0.6s ease",
              }}
              title="Reload Remaining Balance"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                width="32"
                height="32"
              >
                <path d="M4 4v5h.582a7 7 0 1 1-1.16 7.89" />
                <polyline points="4 9 9 9 7 7" />
              </svg>
            </button>
          </div>

          {/* Two-column layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "30px",
            }}
          >
            {/* Total Remaining Balance */}
            <div
              style={{
                background: "linear-gradient(135deg, #16a34a 0%, #4ade80 100%)",
                borderRadius: "20px",
                padding: "40px",
                color: "white",
                boxShadow: "0 10px 28px rgba(16,185,129,0.3)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                transition: "transform 0.3s ease",
              }}
            >
              <div style={{ fontSize: "1.1rem", opacity: 0.9, marginBottom: "12px" }}>
                Total Remaining Balance
              </div>
              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: "900",
                  marginBottom: "10px",
                  transition: "0.3s ease-in-out",
                }}
              >
                ₱
                {animatedTotal.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div style={{ fontSize: "1rem", opacity: 0.85 }}>
                Budget left for this period
              </div>
            </div>

            {/* Distributor Balances */}
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "20px",
                padding: "25px",
                boxShadow: "0 10px 28px rgba(0,0,0,0.08)",
                overflowY: "auto",
                maxHeight: "320px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "1.3rem",
                  color: "#065f46",
                  borderBottom: "2px solid #e5e7eb",
                  paddingBottom: "8px",
                  fontWeight: "700",
                }}
              >
                Distributor Balances
              </h3>

              {distributorBalances.length === 0 ? (
                <p style={{ textAlign: "center", color: "#6b7280", marginTop: "25px" }}>
                  No distributor data available.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  {distributorBalances.map((dist) => (
                    <div
                      key={dist.code}
                      style={{
                        background:
                          "linear-gradient(135deg, #f0fdfa 0%, #dcfce7 100%)",
                        borderRadius: "12px",
                        padding: "15px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.03)";
                        e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,0.12)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)";
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#065f46",
                          marginBottom: "6px",
                          fontSize: "1rem",
                        }}
                      >
                        {dist.name}
                      </div>
                      <div
                        style={{
                          color: "#10b981",
                          fontWeight: 700,
                          fontSize: "1.2rem",
                        }}
                      >
                        ₱
                        {dist.balance.toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Top Cards Row */}
      <Row className="mb-3 g-2">
        <Col lg={6}>
     <KasBudgetCard />
        </Col>

        <Col lg={6}>
    <DistributorBudgetCard />
        </Col>
      </Row>

   <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "24px",
            margin: "50px 0",
          }}
        >
          {data.map(({ label, value, color }) => {
            const isLineChart =
              label === "Approved" || label === "Disapproved" || label === "Cancelled";

            let lineData;
            if (label === "Approved" || label === "Disapproved") lineData = monthlyTrend;
            else if (label === "Cancelled") lineData = ppeTrend;

            return (
              <div
                key={label}
                style={{
                  background: "#fff",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
                  textAlign: "center",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.08)";
                }}
              >
                <div style={{ fontWeight: 700, color: "#374151", marginBottom: "10px", fontSize: "1.2rem" }}>
                  {label}
                </div>
                <div style={{ color, fontWeight: 800, fontSize: "2rem", marginBottom: "12px" }}>
                  {value.toLocaleString()}
                </div>

                <div style={{ width: "100%", height: "100px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {isLineChart ? (
                      <LineChart data={lineData}>
                        <XAxis dataKey="month" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey={label}
                          stroke={color}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={[{ name: label, value }]}>
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      <Card className="border-0" style={{ borderRadius: "20px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", height: "100%", overflow: "hidden" }}>
        <Card.Header style={{ background: "linear-gradient(135deg, #274efcff 0%, #609cf5ff 100%)", color: "white", fontWeight: 600, padding: "1.5rem", fontSize: "1.15rem", borderBottom: "none" }}>
          <i className="bi bi-people-fill me-2"></i>Latest Team Collaboration
        </Card.Header>
        <Card.Body style={{ padding: "0" }}>
          <div style={{ overflowX: "auto" }}>
            <Table hover className="mb-0" style={{ minWidth: "600px" }}>
              <thead style={{ background: "#f8f9fa", borderBottom: "2px solid #e9ecef" }}>
                <tr>
                  <th style={{ padding: "1rem", fontWeight: 600, color: "#495057", fontSize: "0.9rem" }}>Profile</th>
                  <th style={{ padding: "1rem", fontWeight: 600, color: "#495057", fontSize: "0.9rem" }}>Code</th>
                  <th style={{ padding: "1rem", fontWeight: 600, color: "#495057", fontSize: "0.9rem" }}>Budget</th>
                  <th style={{ padding: "1rem", fontWeight: 600, color: "#495057", fontSize: "0.9rem" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {budgetData.length ? budgetData.sort((a, b) => new Date(b.createdate) - new Date(a.createdate)).slice(0, 5).map((r) => (
                  <tr key={r.id} style={{ transition: "all 0.2s", cursor: "pointer" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")} onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                    <td style={{ padding: "1rem", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <img src={r.profilePicture || "/default-profile.png"} alt={r.createduser_name} style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "3px solid #e9ecef", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
                        <span style={{ fontWeight: 500, color: "#2c3e50" }}>{r.createduser_name || "Unknown"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "1rem", verticalAlign: "middle" }}>
                      <Badge bg="primary" style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>{r.pwp_code}</Badge>
                    </td>
                    <td style={{ padding: "1rem", verticalAlign: "middle", color: "#28a745", fontWeight: 700, fontSize: "1.05rem" }}>₱ {formatCurrency(r.amountbadget)}</td>
                    <td style={{ padding: "1rem", verticalAlign: "middle", color: "#6c757d", fontSize: "0.9rem" }}>
                      {new Date(r.createdate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" style={{ textAlign: "center", padding: "3rem", color: "#adb5bd" }}>
                    <i className="bi bi-inbox" style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}></i>No results found
                  </td></tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>


      <Card className="border-0 mb-4" style={{ borderRadius: "20px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", overflow: "hidden" }}>
     <Card.Header
  style={{
    background: "linear-gradient(135deg, #274efcff 0%, #609cf5ff 100%)",
    color: "white",
    fontWeight: 600,
    padding: "1.5rem",
    fontSize: "1.15rem",
    borderBottom: "none",
  }}
>
  <div className="d-flex justify-content-between align-items-center">
    <div>
      <h5 className="mb-0 fw-bold text-white">
        <i className="bi bi-graph-up me-2"></i>Budget Overview
      </h5>
      {/* Total Remaining Amount */}
      <div style={{ fontSize: "1rem", marginTop: "0.3rem", fontWeight: 500 }}>
        Total Remaining:{" "}
        <span style={{ fontWeight: 700 }}>
          ₱ {filteredBudget.reduce((sum, b) => sum + Number(b.remainingbalance || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>

    {/* Export / Filters */}
    <Dropdown as={ButtonGroup}>
      <Dropdown.Toggle
        variant="light"
        size="sm"
        style={{ borderRadius: "10px", fontWeight: 600, padding: "0.5rem 1rem" }}
      />
      <Dropdown.Menu style={{ borderRadius: "12px", border: "none" }}>
        <Dropdown.Item onClick={() => exportToExcel(filteredBudget, "Budget", "budget.xlsx")}>📗 Excel</Dropdown.Item>
        <Dropdown.Item onClick={() => exportToPDF(filteredBudget, "Budget")}>📘 PDF</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  </div>
</Card.Header>


        <Card.Body style={{ padding: "2rem", background: "#fafbfc" }}>
          {/* Chart */}
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              marginBottom: "2rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={filteredBudget.map((b) => ({
                  distributor: b.distributor_name || "Unknown",
                  budget: Number(b.amountbadget || 0),
                  remaining: Number(b.remainingbalance || 0),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                <XAxis dataKey="distributor" stroke="#6c757d" style={{ fontSize: "0.85rem" }} />
                <YAxis stroke="#6c757d" style={{ fontSize: "0.85rem" }} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="budget"
                  stroke="#667eea"
                  strokeWidth={3}
                  dot={{ fill: "#667eea", r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke="#28a745"
                  strokeWidth={3}
                  dot={{ fill: "#28a745", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Filters & Search above Table */}
          <Row className="align-items-center g-3 mb-3">
            <Col md={4}>
              <div style={{ position: "relative", height: "40px" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "1rem",
                    color: "#6c757d",
                  }}
                >
                  🔍
                </span>
                <Form.Control
                  type="text"
                  placeholder="Search budget..."
                  value={searchBudget}
                  onChange={(e) => {
                    setSearchBudget(e.target.value);
                    setPageBudget(1);
                  }}
                  style={{
                    paddingLeft: "36px", // space for the icon
                    borderRadius: "12px",
                    border: "1px solid #ddd",
                    height: "100%",
                  }}
                />
              </div>
            </Col>


            <Col md={5}>
              <div className="d-flex gap-2">
                <Form.Control
                  type="date"
                  value={budgetDateFrom}
                  onChange={(e) => setBudgetDateFrom(e.target.value)}
                  style={{ borderRadius: "12px", border: "1px solid #ddd", height: "40px" }}
                />
                <span className="d-flex align-items-center fw-bold">to</span>
                <Form.Control
                  type="date"
                  value={budgetDateTo}
                  onChange={(e) => setBudgetDateTo(e.target.value)}
                  style={{ borderRadius: "12px", border: "1px solid #ddd", height: "40px" }}
                />
              </div>
            </Col>

            <Col md={3} className="d-flex justify-content-end">
              <Dropdown style={{ height: "40px" }}>
                <Dropdown.Toggle
                  variant="light"
                  style={{
                    borderRadius: "12px",
                    fontWeight: 600,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    height: "100%",
                  }}
                >
                  📂 Export
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ borderRadius: "10px", minWidth: "120px" }}>
                  <Dropdown.Item onClick={() => exportToExcel(filteredBudget, "Budget", "budget.xlsx")}>
                    📗 Excel
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => exportToPDF(filteredBudget, "Budget")}>📘 PDF</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Col>
            <Col md={3}>
              <Dropdown>
                <Dropdown.Toggle
                  variant="light"
                  style={{
                    borderRadius: "12px",
                    fontWeight: 600,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    height: "40px",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  {filterDistributorBudget || "Filter Distributor"}
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ borderRadius: "10px", minWidth: "160px" }}>
                  <Dropdown.Item onClick={() => setFilterDistributorBudget("")}>
                    All Distributors
                  </Dropdown.Item>
                  {distributors.map((d) => (
                    <Dropdown.Item
                      key={d.code}
                      onClick={() => setFilterDistributorBudget(d.name)}
                    >
                      {d.name}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Col>
          </Row>

          {/* Table */}
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <Table hover className="mb-0">
              <thead style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white" }}>
                <tr>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Agent</th>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>PWP Code</th>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Distributor</th>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBudget.length
                  ? paginatedBudget.map((r) => (
                    <tr
                      key={r.id}
                      style={{ transition: "all 0.2s", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                    >
                      <td style={{ padding: "1rem", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <img
                            src={r.profilePicture || "/default-profile.png"}
                            alt={r.createduser_name}
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "2px solid #e9ecef",
                            }}
                          />
                          <span style={{ fontWeight: 500 }}>{r.createduser_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "1rem", verticalAlign: "middle" }}>
                        <Badge
                          bg="primary"
                          style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", padding: "0.4rem 0.8rem" }}
                        >
                          {r.pwp_code}
                        </Badge>
                      </td>
                      <td style={{ padding: "1rem", verticalAlign: "middle", fontWeight: 500 }}>{r.distributor_name}</td>
                      <td style={{ padding: "1rem", verticalAlign: "middle", color: "#28a745", fontWeight: 700 }}>
                        ₱ {formatCurrency(r.amountbadget)}
                      </td>
                      <td style={{ padding: "1rem", verticalAlign: "middle", color: "#dc3545", fontWeight: 700 }}>
                        ₱ {formatCurrency(r.remainingbalance)}
                      </td>
                    </tr>
                  ))
                  : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "#adb5bd" }}>
                        No results found
                      </td>
                    </tr>
                  )}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3 px-2">
            <small style={{ color: "#6c757d", fontWeight: 500 }}>
              Page {pageBudget} of {Math.ceil(filteredBudget.length / pageSize) || 1}
            </small>
            <div>
              <Button
                variant="outline-primary"
                size="sm"
                disabled={pageBudget === 1}
                onClick={() => setPageBudget(pageBudget - 1)}
                className="me-2"
                style={{ borderRadius: "10px", fontWeight: 600 }}
              >
                ← Prev
              </Button>
              <Button
                variant="outline-primary"
                size="sm"
                disabled={pageBudget * pageSize >= filteredBudget.length}
                onClick={() => setPageBudget(pageBudget + 1)}
                style={{ borderRadius: "10px", fontWeight: 600 }}
              >
                Next →
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>


      {/* REGULAR SECTION */}
      <Card
        className="border-0"
        style={{
          borderRadius: "20px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Header with only title */}
        <Card.Header
          style={{
            background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
            color: "white",
            fontWeight: "600",
            padding: "1.5rem",
            border: "none",
          }}
        >
          <h5 className="mb-0 fw-bold">
            <i className="bi bi-calendar-check me-2"></i>Regular PWP Overview
          </h5>
        </Card.Header>

        <Card.Body style={{ padding: "2rem", background: "#fafbfc" }}>
          {/* Chart */}
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              marginBottom: "2rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={filteredRegular.map((r) => ({
                  distributor: r.distributor_name || "Unknown",
                  budget: Number(r.credit_budget || 0),
                  remaining: Number(r.remaining_balance || 0),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                <XAxis
                  dataKey="distributor"
                  stroke="#6c757d"
                  style={{ fontSize: "0.85rem" }}
                />
                <YAxis stroke="#6c757d" style={{ fontSize: "0.85rem" }} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="budget"
                  stroke="#17a2b8"
                  strokeWidth={3}
                  dot={{ fill: "#17a2b8", r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke="#ffc107"
                  strokeWidth={3}
                  dot={{ fill: "#ffc107", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Filters & Search above Table */}
          <Row className="align-items-center g-3 mb-3">
            <Col md={4}>
              <div style={{ position: "relative", height: "40px" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "1rem",
                    color: "#6c757d",
                  }}
                >
                  🔍
                </span>
                <Form.Control
                  type="text"
                  placeholder="Search regular..."
                  value={searchRegular}
                  onChange={(e) => {
                    setSearchRegular(e.target.value);
                    setPageRegular(1);
                  }}
                  style={{
                    paddingLeft: "36px",
                    borderRadius: "12px",
                    border: "1px solid #ddd",
                    height: "100%",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
            </Col>

            <Col md={5}>
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  type="date"
                  value={regularDateFrom}
                  onChange={(e) => setRegularDateFrom(e.target.value)}
                  style={{
                    borderRadius: "12px",
                    border: "1px solid #ddd",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                />
                <span style={{ color: "#6c757d", fontWeight: 600 }}>to</span>
                <Form.Control
                  type="date"
                  value={regularDateTo}
                  onChange={(e) => setRegularDateTo(e.target.value)}
                  style={{
                    borderRadius: "12px",
                    border: "1px solid #ddd",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
            </Col>

            <Col md={3} className="text-end">



              <Dropdown>
                <Dropdown.Toggle
                  variant="light"
                  style={{
                    borderRadius: "12px",
                    fontWeight: 600,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    height: "40px",
                  }}
                >
                  📂 Export
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ borderRadius: "10px", minWidth: "140px" }}>
                  <Dropdown.Item
                    onClick={() =>
                      exportToExcel(filteredRegular, "Regular", "regular.xlsx")
                    }
                  >
                    📗 Excel
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => exportToPDF(filteredRegular, "Regular")}>
                    📘 PDF
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Col>


          </Row>

          {/* Table */}
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <Table hover className="mb-0">
              <thead
                style={{
                  background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                  color: "white",
                }}
              >
                <tr>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Regular PWP Code</th>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Activity</th>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Distributor</th>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Remaining</th>
                  <th style={{ padding: "1rem", fontWeight: 600 }}>Credit Budget</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRegular.length
                  ? paginatedRegular.map((r) => (
                    <tr
                      key={r.id}
                      style={{ transition: "all 0.2s", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                    >
                      <td style={{ padding: "1rem", verticalAlign: "middle" }}>
                        <Badge
                          bg="success"
                          style={{
                            background: "linear-gradient(135deg, #28a745, #20c997)",
                            padding: "0.4rem 0.8rem",
                          }}
                        >
                          {r.regularpwpcode}
                        </Badge>
                      </td>
                      <td style={{ padding: "1rem", verticalAlign: "middle", fontWeight: 500 }}>
                        {r.activity_name}
                      </td>
                      <td style={{ padding: "1rem", verticalAlign: "middle", fontWeight: 500 }}>
                        {r.distributor_name}
                      </td>
                      <td style={{ padding: "1rem", verticalAlign: "middle", color: "#dc3545", fontWeight: 700 }}>
                        ₱ {formatCurrency(r.remaining_balance)}
                      </td>
                      <td style={{ padding: "1rem", verticalAlign: "middle", color: "#28a745", fontWeight: 700 }}>
                        ₱ {formatCurrency(r.credit_budget)}
                      </td>
                    </tr>
                  ))
                  : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "#adb5bd" }}>
                        No results found
                      </td>
                    </tr>
                  )}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3 px-2">
            <small style={{ color: "#6c757d", fontWeight: 500 }}>
              Page {pageRegular} of {Math.ceil(filteredRegular.length / pageSize) || 1}
            </small>
            <div>
              <Button
                variant="outline-success"
                size="sm"
                disabled={pageRegular === 1}
                onClick={() => setPageRegular(pageRegular - 1)}
                className="me-2"
                style={{ borderRadius: "10px", fontWeight: 600 }}
              >
                ← Prev
              </Button>
              <Button
                variant="outline-success"
                size="sm"
                disabled={pageRegular * pageSize >= filteredRegular.length}
                onClick={() => setPageRegular(pageRegular + 1)}
                style={{ borderRadius: "10px", fontWeight: 600 }}
              >
                Next →
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

    </div>
  );
};

export default DashboardForSuperAdmin;
