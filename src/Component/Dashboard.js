import React, { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { supabase } from "../supabaseClient";

const initialStatuses = [
  { label: "For Approval", color: "#f59e0b", fontSize: "1rem" },
  { label: "Approved", color: "#10b981", fontSize: "1.2rem" },
  { label: "Disapproved", color: "#ef4444", fontSize: "1.2rem" },
  { label: "Cancelled", color: "#3b82f6", fontSize: "1rem" },
];

export default function Dashboard() {
  const [data, setData] = useState(
    initialStatuses.map(({ label, color }) => ({ label, value: 0, color }))
  );
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [ppeTrend, setPpeTrend] = useState([]);
  const [totalRemaining, setTotalRemaining] = useState(null);
  const [distributorBalances, setDistributorBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [animatedTotal, setAnimatedTotal] = useState(0);

  // Main data fetching effect
  useEffect(() => {
    async function fetchVisaAndApprovalData() {
      try {
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser') || '{}');
        const currentUserId = currentUser?.UserID ? String(currentUser.UserID) : null;
        const role = currentUser?.role || "";

        console.log("[Dashboard] Current User:", currentUser?.name, "UserID:", currentUserId, "Role:", role);

        // Fetch approval history with Response and CreatedForm
        const { data: approvalRecords, error } = await supabase
          .from("Approval_History")
          .select("Response, CreatedForm, DateResponded");

        if (error) {
          console.error("Error fetching Approval_History:", error);
          return;
        }

        console.log("[Dashboard] Total approval records fetched:", approvalRecords?.length);

        // Filter approval records by CreatedForm (UserID) if not admin
        const filteredApprovalRecords = role === 'admin'
          ? approvalRecords
          : approvalRecords.filter(record => {
            const recordCreatorId = record.CreatedForm ? String(record.CreatedForm) : null;
            return recordCreatorId === currentUserId;
          });

        console.log("[Dashboard] Filtered approval records:", filteredApprovalRecords.length);

        // Count status occurrences
        let approvedCount = 0;
        let disapprovedCount = 0;
        let cancelledCount = 0;
        let forApprovalCount = 0;

        filteredApprovalRecords.forEach(record => {
          const response = record.Response;
          
          // Check if response is null, undefined, empty, or "Pending" - these are "For Approval"
          if (!response || response === "" || response === "Pending" || response === "For Approval") {
            forApprovalCount++;
          } else if (response === "Approved") {
            approvedCount++;
          } else if (response === "Declined" || response === "Disapproved") {
            disapprovedCount++;
          } else if (response === "Cancelled") {
            cancelledCount++;
          } else {
            // Any other unknown status goes to "For Approval"
            forApprovalCount++;
          }
        });

        console.log("[Dashboard] Counts - For Approval:", forApprovalCount, "Approved:", approvedCount, "Disapproved:", disapprovedCount, "Cancelled:", cancelledCount);

        const statusCounts = {
          "For Approval": forApprovalCount,
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

        // Process monthly trends
        const monthlyMap = {};

        filteredApprovalRecords.forEach(({ Response, DateResponded }) => {
          if (!DateResponded) return;
          
          let status = Response;
          
          // Normalize status
          if (!status || status === "" || status === "Pending") {
            status = "For Approval";
          } else if (status === "Declined") {
            status = "Disapproved";
          }
          
          const month = new Date(DateResponded).toISOString().slice(0, 7);

          if (!monthlyMap[month]) {
            monthlyMap[month] = { month };
          }

          if (["Approved", "Disapproved", "Cancelled", "For Approval"].includes(status)) {
            monthlyMap[month][status] = (monthlyMap[month][status] || 0) + 1;
          }
        });

        const monthlyTrendArray = Object.values(monthlyMap).sort((a, b) =>
          a.month.localeCompare(b.month)
        );

        setMonthlyTrend(monthlyTrendArray);
        setPpeTrend(monthlyTrendArray);

      } catch (error) {
        console.error("Error fetching visa and approval data:", error);
      }
    }

    fetchVisaAndApprovalData();
  }, []);

  // Fetch remaining balances
  const fetchRemainingBalance = useCallback(async () => {
    setLoading(true);
    const storedUser = JSON.parse(localStorage.getItem("user") || '{}');
    if (!storedUser || (!storedUser.UserID && !storedUser.id)) {
      setLoading(false);
      return;
    }

    const userId = storedUser.UserID ?? storedUser.id;

    const { data: budgetData, error: budgetError } = await supabase
      .from("amount_badget")
      .select("remainingbalance, distributor, pwp_code")
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
    setTotalRemaining(total);

    const pwpCodes = [
      ...new Set(
        budgetData.map((item) => item.pwp_code).filter((code) => code != null)
      ),
    ];

    let coverData = [];
    if (pwpCodes.length > 0) {
      const { data: coverRecords, error: coverError } = await supabase
        .from("cover_pwp")
        .select("cover_code, budget_year")
        .in("cover_code", pwpCodes);

      if (!coverError) {
        coverData = coverRecords || [];
      }
    }

    const pwpToYearMap = {};
    coverData.forEach((cover) => {
      pwpToYearMap[cover.cover_code] = cover.budget_year;
    });

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

      const codeToNameMap = {};
      if (distributorData) {
        distributorData.forEach((dist) => {
          codeToNameMap[dist.code] = dist.name;
        });
      }

      const distYearBalances = {};
      budgetData.forEach((item) => {
        if (item.distributor && item.pwp_code) {
          const year = pwpToYearMap[item.pwp_code] || 2025;
          const key = `${item.distributor}_${year}`;

          if (!distYearBalances[key]) {
            distYearBalances[key] = {
              code: item.distributor,
              year: year,
              balance: 0
            };
          }
          distYearBalances[key].balance += parseFloat(
            item.remainingbalance || 0
          );
        }
      });

      const distArray = Object.values(distYearBalances).map((item) => ({
        code: item.code,
        name: codeToNameMap[item.code] || item.code,
        year: item.year,
        balance: item.balance,
      }));

      distArray.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.name.localeCompare(b.name);
      });

      setDistributorBalances(distArray);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || '{}');
    if (!storedUser || (!storedUser.UserID && !storedUser.id)) return;
    fetchRemainingBalance();
  }, [fetchRemainingBalance]);

  // Animate total
  useEffect(() => {
    if (totalRemaining == null) return;

    let start = 0;
    const duration = 1000;
    const increment = totalRemaining / (duration / 16);
    const interval = setInterval(() => {
      start += increment;
      if (start >= totalRemaining) {
        start = totalRemaining;
        clearInterval(interval);
      }
      setAnimatedTotal(start);
    }, 16);

    return () => clearInterval(interval);
  }, [totalRemaining]);

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>
            {label || 'Count'}
          </p>
          <p style={{ margin: '4px 0 0 0', color: payload[0].color, fontWeight: 700 }}>
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: "1800px", width: "100%", overflowX: "auto" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: "900",
            marginBottom: "2rem",
            color: "#111827",
            textAlign: "center",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          Total Marketing per Status
        </h1>

        {/* Remaining Balance Section */}
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "30px",
            }}
          >
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
                  {distributorBalances.map((dist, index) => (
                    <div
                      key={`${dist.code}-${dist.year}-${index}`}
                      style={{
                        background: "linear-gradient(135deg, #f0fdfa 0%, #dcfce7 100%)",
                        borderRadius: "12px",
                        padding: "15px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        R{dist.year}
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                          color: "#065f46",
                          marginBottom: "4px",
                          fontSize: "1rem",
                          paddingRight: "70px",
                        }}
                      >
                        {dist.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "#6b7280",
                          marginBottom: "8px",
                        }}
                      >
                        Budget Year {dist.year}
                      </div>
                      <div
                        style={{
                          color: "#10b981",
                          fontWeight: 700,
                          fontSize: "1.2rem",
                        }}
                      >
                        ₱{dist.balance.toLocaleString("en-PH", {
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

        {/* Status Cards Section */}
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
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey={label}
                          stroke={color}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: color }}
                          activeDot={{ r: 5, fill: color }}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={[{ name: label, value }]}>
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Section */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
            gap: "28px",
            marginBottom: "60px",
          }}
        >
          <div style={{
            background: "#fff", borderRadius: "20px", padding: "25px", boxShadow: "0 8px 28px rgba(0,0,0,0.08)"
          }}>
            <h3 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#374151" }}>
              Market Status Bar Chart
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value">
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            background: "#fff", borderRadius: "20px", padding: "25px", boxShadow: "0 8px 28px rgba(0,0,0,0.08)"
          }}>
            <h3 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#374151" }}>
              Market Status Pie Chart
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" outerRadius={110} label>
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            background: "#fff", borderRadius: "20px", padding: "25px", boxShadow: "0 8px 28px rgba(0,0,0,0.08)"
          }}>
            <h3 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#374151" }}>
              Monthly Trends
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="Approved" stroke="#10b981" strokeWidth={2.5} />
                <Line type="monotone" dataKey="Disapproved" stroke="#ef4444" strokeWidth={2.5} />
                <Line type="monotone" dataKey="Cancelled" stroke="#3b82f6" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
