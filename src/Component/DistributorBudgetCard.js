import React, { useEffect, useState } from "react";
import { Card, Row, Col, Dropdown, ButtonGroup, Spinner } from "react-bootstrap";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { supabase } from "../supabaseClient";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const DistributorBudgetCard = () => {
  const [loading, setLoading] = useState(false);
  const [budgetData, setBudgetData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());

  const excludedKASCodes = ["kas1", "kas2", "kas3", "kas4", "kas5", "kas6"];
  const excludedKASNames = ["kas 1", "kas 2", "kas 3", "kas 4", "kas 5", "kas 6"];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: budget, error: budgetError } = await supabase
          .from("amount_badget")
          .select("id, distributor, amountbadget, remainingbalance, createdate");
        if (budgetError) throw budgetError;

        const { data: distData, error: distError } = await supabase
          .from("distributors")
          .select("code, name");
        if (distError) throw distError;

        const distMap = {};
        (distData || []).forEach(d => {
          distMap[d.code?.trim().toLowerCase()] = d.name;
        });

        const filtered = (budget || [])
          .filter(
            b =>
              !excludedKASCodes.includes(b.distributor?.trim().toLowerCase()) &&
              new Date(b.createdate).getFullYear() === year
          )
          .map(b => ({
            DistributorCode: b.distributor,
            DistributorName: distMap[b.distributor?.trim().toLowerCase()] || "Unknown",
            Amount: Number(b.amountbadget || 0),
            Remaining: Number(b.remainingbalance || 0),
            CreatedDate: b.createdate
          }));

        setBudgetData(filtered);

      } catch (err) {
        console.error("Error fetching data:", err.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  const budgetWithoutKAS = budgetData.filter(b => {
    const name = (b.DistributorName || "").trim().toLowerCase();
    return !excludedKASNames.includes(name);
  });

  const totalBudget = budgetWithoutKAS.reduce((sum, b) => sum + b.Amount, 0);
  const totalRemaining = budgetWithoutKAS.reduce((sum, b) => sum + b.Remaining, 0);
  const progressPercent =
    totalBudget > 0 ? Math.round((totalRemaining / totalBudget) * 100) : 0;

  // Helper function to format currency
  const formatCurrency = (num) => {
    return `₱ ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  // Export Excel
  const exportExcel = () => {
    const excelData = budgetWithoutKAS.map((b, i) => ({
      "No.": i + 1,
      "Distributor": b.DistributorName,
      "Budget Amount": b.Amount.toFixed(2),
      "Remaining Balance": b.Remaining.toFixed(2),
      "Used Amount": (b.Amount - b.Remaining).toFixed(2),
      "Created Date": b.CreatedDate ? new Date(b.CreatedDate).toLocaleDateString() : "N/A",
    }));

    // Add total row
    excelData.push({
      "No.": "",
      "Distributor": "TOTAL",
      "Budget Amount": totalBudget.toFixed(2),
      "Remaining Balance": totalRemaining.toFixed(2),
      "Used Amount": (totalBudget - totalRemaining).toFixed(2),
      "Created Date": ""
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Distributors ${year}`);
    const filename = `Distributor_Budget_${year}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    alert("Excel exported successfully!");
  };



  return (
    <div style={{ padding: "20px" }}>
      {loading ? (
        <div className="text-center"><Spinner animation="border" /></div>
      ) : (
        <Card className="border-0" style={{ borderRadius: "20px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
          <Card.Header
            style={{
              background: "linear-gradient(135deg, #274efcff 0%, #609cf5ff 100%)",
              color: "white",
              fontWeight: 600,
              padding: "1.5rem",
              fontSize: "1.15rem",
              borderBottom: "none"
            }}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>
                <i className="bi bi-wallet2 me-2"></i>
                Distributors  - {year}
              </span>
              <Dropdown as={ButtonGroup}>
                <Dropdown.Toggle
                  variant="light"
                  size="sm"
                  style={{ borderRadius: "10px", fontWeight: 600, padding: "0.5rem 1rem" }}
                />
                <Dropdown.Menu style={{ borderRadius: "12px", border: "none" }}>
                  <Dropdown.Item onClick={exportExcel}>Export Excel</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Header>Select Year</Dropdown.Header>
                  {[...new Set(budgetData.map((b) => new Date(b.CreatedDate).getFullYear()))]
                    .sort((a, b) => b - a)
                    .map((y) => (
                      <Dropdown.Item key={y} onClick={() => setYear(y)} active={y === year}>{y}</Dropdown.Item>
                    ))}
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </Card.Header>

          <Card.Body style={{ padding: "2.5rem" }}>
            <div className="d-flex justify-content-center mb-4" style={{ width: 200, height: 200, margin: "0 auto" }}>
              <CircularProgressbar
                value={progressPercent}
                text={`${progressPercent}%`}
                styles={buildStyles({
                  pathColor: progressPercent > 75 ? "#28a745" : progressPercent > 50 ? "#ffc107" : "#dc3545",
                  trailColor: "#e9ecef",
                  textColor: "#495057",
                  textSize: "20px",
                  pathTransitionDuration: 0.8
                })}
              />
            </div>
            <Row className="g-3">
              <Col xs={6}>
                <div style={{ background: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)", borderRadius: "16px", padding: "1.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", textTransform: "uppercase" }}>Total Budget</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{formatCurrency(totalBudget)}</div>
                </div>
              </Col>
              <Col xs={6}>
                <div style={{ background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", borderRadius: "16px", padding: "1.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", textTransform: "uppercase" }}>Remaining</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{formatCurrency(totalRemaining)}</div>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default DistributorBudgetCard;
