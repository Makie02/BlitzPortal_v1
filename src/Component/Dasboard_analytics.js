import React, { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

const Analytics = ({ progress }) => {
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

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center flex-column" style={{ minHeight: "70vh" }}>
      <Spinner animation="border" style={{ width: "3rem", height: "3rem", color: "#667eea" }} />
      <p className="mt-3" style={{ fontSize: "1.1rem", color: "#667eea", fontWeight: 500 }}>Loading analytics...</p>
    </div>
  );

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


      {/* Top Cards Row */}
      <Row className="mb-4 g-4">
        <Col lg={6}>
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
        </Col>

        <Col lg={6}>
          <Card className="border-0" style={{ borderRadius: "20px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", height: "100%", overflow: "hidden" }}>
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
                {/* Left: Title */}
                <span>
                  <i className="bi bi-wallet2 me-2"></i>Budget for {year}
                </span>

                {/* Right: Dropdown */}
                <Dropdown as={ButtonGroup}>
                  <Dropdown.Toggle
                    variant="light"
                    size="sm"
                    style={{
                      borderRadius: "10px",
                      fontWeight: 600,
                      padding: "0.5rem 1rem",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  />
                  <Dropdown.Menu
                    style={{
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      border: "none",
                    }}
                  >
                    <Dropdown.Item onClick={exportExcel}>
                      <i className="bi bi-file-excel me-2" style={{ color: "#28a745" }}></i>
                      Export Excel
                    </Dropdown.Item>
                    <Dropdown.Item onClick={exportPDF}>
                      <i className="bi bi-file-pdf me-2" style={{ color: "#dc3545" }}></i>
                      Export PDF
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Header style={{ fontWeight: 600 }}>Select Year</Dropdown.Header>
                    {[...new Set(budgetData.map((b) => new Date(b.createdate).getFullYear()))]
                      .sort((a, b) => b - a)
                      .map((y) => (
                        <Dropdown.Item
                          key={y}
                          onClick={() => setYear(y)}
                          active={y === year}
                          style={{ fontWeight: y === year ? 600 : 400 }}
                        >
                          {y}
                        </Dropdown.Item>
                      ))}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Card.Header>

            <Card.Body style={{ padding: "2.5rem" }}>
              <div className="d-flex justify-content-center mb-4">
                <div style={{ width: 200, height: 200 }}>
                  <CircularProgressbar value={progressPercent} text={`${progressPercent}%`} styles={buildStyles({ pathColor: progressPercent > 75 ? "#28a745" : progressPercent > 50 ? "#ffc107" : "#dc3545", trailColor: "#e9ecef", textColor: "#495057", textSize: "20px", pathTransitionDuration: 0.8 })} />
                </div>
              </div>
              <Row className="g-3">
                <Col xs={6}>
                  <div style={{ background: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 4px 16px rgba(150, 230, 161, 0.3)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.8rem", color: "#2d5016", fontWeight: 600, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Budget</div>
                    <div style={{ color: "#1e3a0f", fontSize: "1.5rem", fontWeight: 700 }}>₱ {totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </Col>
                <Col xs={6}>
                  <div style={{ background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 4px 16px rgba(250, 112, 154, 0.3)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.8rem", color: "#7d1935", fontWeight: 600, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>Remaining</div>
                    <div style={{ color: "#5a0f25", fontSize: "1.5rem", fontWeight: 700 }}>₱ {totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

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
          <h5 className="mb-0 fw-bold text-white">
            <i className="bi bi-graph-up me-2"></i>Budget Overview
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

export default Analytics;