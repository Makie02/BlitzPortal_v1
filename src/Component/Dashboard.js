import React, { useEffect, useState } from "react";
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


{initialStatuses.map(({ label, color, fontSize }) => (
  <div key={label} style={{ color, fontSize, fontWeight: 600 }}>
    {label}
  </div>
))}
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
    const { data: records, error } = await supabase.from(tableName).select("Notification");

    if (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
      return [];
    }
    return records || [];
  }
  useEffect(() => {
    async function fetchVisaAndApprovalData() {
      try {
        // Fetch visa records (same as before)
        const corporateVisa = await fetchVisaData("Corporate_Visa");
        const coverVisa = await fetchVisaData("Cover_Visa");
        const regularVisa = await fetchVisaData("Regular_Visa");

        const allVisaRecords = [...corporateVisa, ...coverVisa, ...regularVisa];
        const totalVisaCount = allVisaRecords.length;

        // Fetch approval history with Response including Cancelled
        const { data: approvalRecords, error } = await supabase
          .from("Approval_History")
          .select("Response");

        if (error) {
          console.error("Error fetching Approval_History:", error);
          return;
        }

        let approvedCount = 0;
        let disapprovedCount = 0;
        let cancelledCount = 0;

        approvalRecords.forEach((record) => {
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


  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
      <div style={{ maxWidth: "1500px", width: "100%", overflowX: "auto" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "800",
            marginBottom: "0.5rem",
            color: "#111827",
            textAlign: "center",
            letterSpacing: "1.5px",
          }}
        >
          Total Marketing per Status
        </h1>

        {/* Remaining Balances Badge */}

        <style>
          {`
    /* Responsive flex container */
    .dashboard-container {
      display: flex;
      justify-content: center;
      flex-wrap: wrap; /* allow wrapping on small screens */
      gap: 1rem;
      margin: 2rem 0;
      padding: 0 1rem;
    }

    /* Card base styles */
    .card {
      flex: 1 1 280px; /* grow, shrink, base width */
      max-width: 320px;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07);
      padding: 1.25rem 1.75rem 1.75rem 1.75rem;
      position: relative;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      cursor: default;
    }

    .card:hover {
      transform: scale(1.05);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    /* Reload button container */
    .reload-button-container {
      position: absolute;
      top: 1rem;
      right: 1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: transparent;
      transition: background-color 0.25s ease, transform 0.2s ease;
      cursor: pointer;
      z-index: 20;
    }
    .reload-button-container:hover {
      background-color: #d1fae5; /* subtle green bg on hover */
      transform: scale(1.1);
    }

    /* Tooltip styling */
    .tooltip-text {
      visibility: hidden;
      width: 180px;
      background-color: rgba(31, 41, 55, 0.9);
      color: #fff;
      text-align: center;
      border-radius: 6px;
      padding: 6px 0;
      position: absolute;
      z-index: 25;
      bottom: 140%;
      right: 50%;
      margin-right: -75px;
      opacity: 0;
      transition: opacity 0.3s ease;
      font-size: 0.75rem;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    /* Show tooltip on hover of the button container */
    .reload-button-container:hover > .tooltip-text {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }

    /* Responsive charts height */
    .chart-container {
      width: 100%;
      height: 80px;
      margin-top: 0.5rem;
    }

    /* Text styles */
    .remaining-label {
      font-size: 1rem;
      color: #374151;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }

    .remaining-value {
      font-size: 1.8rem;
      color: #10b981;
      font-weight: 700;
    }

    .remaining-subtext {
      margin-top: 1rem;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .status-label {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 0.25rem;
      color: #374151;
    }

    /* Responsive tweaks */
    @media (max-width: 480px) {
      .remaining-value {
        font-size: 1.4rem;
      }
      .chart-container {
        height: 60px;
      }
    }
  `}
        </style>

        <div className="dashboard-container">
          {/* Remaining Balances card */}
          <div className="card" style={{ paddingTop: "2.5rem" }}>
            {/* Reload button */}
            <div className="reload-button-container" onClick={fetchRemainingBalance} role="button" tabIndex={0} aria-label="Reload remaining balance" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fetchRemainingBalance(); }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                width="24"
                height="24"
              >
                {/* Circular arrow icon */}
                <path d="M4 4v5h.582a7 7 0 1 1-1.16 7.89" />
                <polyline points="4 9 9 9 7 7" />
              </svg>
              <span className="tooltip-text">Reload remaining balance</span>
            </div>

            <div className="remaining-label">Remaining Balances</div>
            <div className="remaining-value">
              {totalRemaining !== null ? `₱${totalRemaining.toLocaleString()}` : "Loading..."}
            </div>
            <div className="remaining-subtext">Budget left for this period</div>
          </div>

          {/* Status Cards from Data */}
          {data.map(({ label, value, color }) => {
            const isLineChart =
              label === "Approved" || label === "Disapproved" || label === "Cancelled";

            let lineData;
            if (label === "Approved" || label === "Disapproved") lineData = monthlyTrend;
            else if (label === "Cancelled") lineData = ppeTrend;

            return (
              <div
                key={label}
                className="card"
                aria-label={`${label} count is ${value}`}
                role="region"
              >
                <div className="status-label">{label}</div>
                <div style={{ color, fontWeight: 700, fontSize: "1.5rem" }}>
                  {value.toLocaleString()}
                </div>

                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    {isLineChart ? (
                      <LineChart
                        data={lineData}
                        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                      >
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
                      <BarChart
                        data={[{ name: label, value }]}
                        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                      >
                        <XAxis dataKey="name" hide />
                        <YAxis
                          hide
                          domain={[0, Math.max(...data.map((d) => d.value)) * 1.1]}
                        />
                        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>


        {/* Main Charts */}
        <div style={chartsGrid}>
          {/* Bar Chart */}
          <div style={cardStyle}>
            <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "#374151" }}>
              Market Status Bar Chart
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
          <div style={cardStyle}>
            <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "#374151" }}>
              Market Status Pie Chart
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart: Approved / Disapproved */}
          <div style={cardStyle}>
            <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "#374151" }}>
              Monthly Approved
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
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

          {/* Line Chart: Cancelled */}
          <div style={cardStyle}>
            <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "#374151" }}>
              Cancelled Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ppeTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
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
    </div >

  );
}