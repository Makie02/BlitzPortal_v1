import React, { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";

import { ref, get } from "firebase/database";

import { supabase } from "../supabaseClient"; // import your supabase client

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
const ppeTrend = [
  { month: "Jan", Cancelled: 1 },
  { month: "Feb", Cancelled: 2 },
  { month: "Mar", Cancelled: 3 },
  { month: "Apr", Cancelled: 5 },
  { month: "May", Cancelled: 6 },
  { month: "Jun", Cancelled: 8 },
];

const cardStyle = {
  flex: "1 1 200px",
  background: "#fff",
  borderRadius: "12px",
  padding: "2rem 1.5rem",
  margin: "1rem",
  boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
  textAlign: "center",
  transition: "transform 0.3s ease",
  cursor: "default",
};

const labelStyle = {
  fontSize: "1.1rem",
  fontWeight: "600",
  marginBottom: "0.5rem",
  color: "#374151",
};

const valueStyle = (color) => ({
  fontSize: "2.8rem",
  fontWeight: "700",
  color,
});

const chartsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: "2rem",
  marginTop: "3rem",
};

const chartContainerStyle = {
  position: "absolute",
  bottom: "0.6rem",
  left: 0,
  width: "100%",
  height: "70px",
  zIndex: 1,
  opacity: 0.3,
  borderRadius: "0 0 12px 12px",
};

export default function Dashboard() {
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


  const [totalRemaining, setTotalRemaining] = useState(null);
  const [distributorBalances, setDistributorBalances] = useState([]);
  const [loading, setLoading] = useState(false);

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


  const [showDistModal, setShowDistModal] = useState(false);

  // Fetch remaining balances - Total and by Distributor
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
    setTotalRemaining(total);

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
    if (totalRemaining == null) return;

    let start = 0;
    const duration = 1000; // 1 second
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

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
      <div style={{ maxWidth: "1500px", width: "100%", overflowX: "auto" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "800",
            marginBottom: "1.5rem",
            color: "#111827",
            textAlign: "center",
            letterSpacing: "1.5px",
          }}
        >
          Total Marketing per Status
        </h1>

        {/* ========== Remaining Balance Section ========== */}
        <div
          style={{
            padding: "30px",
            background: "linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%)",
            borderRadius: "20px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            maxWidth: "1400px",
            margin: "0 auto 40px auto",
            position: "relative",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "25px",
            }}
          >
            <h2
              style={{
                fontSize: "1.6rem",
                fontWeight: "700",
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
                width="28"
                height="28"
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
              gap: "20px",
            }}
          >
            {/* Left: Total Remaining Balance */}
            <div
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                borderRadius: "16px",
                padding: "30px",
                color: "white",
                boxShadow: "0 6px 18px rgba(16,185,129,0.4)",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "1rem", opacity: 0.9, marginBottom: "10px" }}>
                Total Remaining Balance
              </div>
              <div
                style={{
                  fontSize: "2.8rem",
                  fontWeight: "800",
                  marginBottom: "8px",
                  transition: "0.3s ease-in-out",
                }}
              >
                ₱
                {animatedTotal.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div style={{ fontSize: "0.95rem", opacity: 0.85 }}>
                Budget left for this period
              </div>
            </div>

            {/* Right: Distributor Balances */}
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                overflowY: "auto",
                maxHeight: "280px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 15px 0",
                  fontSize: "1.2rem",
                  color: "#065f46",
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: "5px",
                }}
              >
                Distributor Balances
              </h3>

              {distributorBalances.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#6b7280",
                    marginTop: "20px",
                  }}
                >
                  No distributor data available.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  {distributorBalances.map((dist) => (
                    <div
                      key={dist.code}
                      style={{
                        background:
                          "linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%)",
                        borderRadius: "10px",
                        padding: "12px",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.05)",
                        transition: "transform 0.2s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "scale(1.02)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.transform = "scale(1)")
                      }
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#065f46",
                          marginBottom: "4px",
                          fontSize: "0.95rem",
                        }}
                      >
                        {dist.name}
                      </div>
                      <div
                        style={{
                          color: "#10b981",
                          fontWeight: 700,
                          fontSize: "1.1rem",
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

        {/* ========== Status Cards Section ========== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
            margin: "40px 0",
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
                  borderRadius: "12px",
                  padding: "16px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: "#374151",
                    marginBottom: "8px",
                    fontSize: "1.1rem",
                  }}
                >
                  {label}
                </div>
                <div style={{ color, fontWeight: 800, fontSize: "1.6rem" }}>
                  {value.toLocaleString()}
                </div>

                <div style={{ width: "100%", height: "80px", marginTop: "10px" }}>
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
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={[{ name: label, value }]}>
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        {/* ========== Charts Section ========== */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
            gap: "24px",
            marginBottom: "50px",
          }}
        >
          {/* Bar Chart */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "#374151" }}>
              Market Status Bar Chart
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value">
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "#374151" }}>
              Market Status Pie Chart
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" outerRadius={100} label>
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Approved / Disapproved Line Chart */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "#374151" }}>
              Monthly Approved
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Approved" stroke="#10b981" />
                <Line type="monotone" dataKey="Disapproved" stroke="#ef4444" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cancelled Line Chart */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "#374151" }}>
              Cancelled Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ppeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="Cancelled" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>


  );
}
