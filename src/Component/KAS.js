import React, { useEffect, useState } from "react";
import { Card, Row, Col, Dropdown, ButtonGroup, Spinner } from "react-bootstrap";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { supabase } from "../supabaseClient";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // ✅ tamang import

const KasBudgetCard = () => {
    const [loading, setLoading] = useState(false);
    const [budgetData, setBudgetData] = useState([]);
    const [distributors, setDistributors] = useState([]);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [
                    { data: budget, error: budgetError },
                    { data: dist, error: distError },
                ] = await Promise.all([
                    supabase
                        .from("amount_badget")
                        .select("id, pwp_code, distributor, amountbadget, remainingbalance, createduser, createdate"),
                    supabase.from("distributors").select("code, name"),
                ]);

                if (budgetError) throw budgetError;
                if (distError) throw distError;

                const distMap = {};
                (dist || []).forEach((d) => {
                    distMap[d.code] = d.name;
                });

                const mappedBudget = (budget || []).map((b) => ({
                    ...b,
                    distributor_name: distMap[b.distributor] || b.distributor || "Unknown",
                }));

                setBudgetData(mappedBudget);
                setDistributors(dist || []);
            } catch (err) {
                console.error("Error fetching data:", err.message || err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const filteredData = budgetData.filter(
        (b) =>
            b.distributor_name.toLowerCase().startsWith("kas") &&
            new Date(b.createdate).getFullYear() === year
    );

    const totalBudget = filteredData.reduce((sum, b) => sum + Number(b.amountbadget || 0), 0);
    const totalRemaining = filteredData.reduce((sum, b) => sum + Number(b.remainingbalance || 0), 0);
    const progressPercent = totalBudget > 0 ? Math.round((totalRemaining / totalBudget) * 100) : 0;

    const exportExcel = () => {
        try {
            const excelData = filteredData.map((item, index) => ({
                'No.': index + 1,
                'PWP Code': item.pwp_code || 'N/A',
                'Distributor': item.distributor_name,
                'Budget Amount': Number(item.amountbadget || 0).toFixed(2),
                'Remaining Balance': Number(item.remainingbalance || 0).toFixed(2),
                'Used Amount': (Number(item.amountbadget || 0) - Number(item.remainingbalance || 0)).toFixed(2),
                'Created By': item.createduser || 'N/A',
                'Created Date': item.createdate ? new Date(item.createdate).toLocaleDateString() : 'N/A',
            }));

            excelData.push({
                'No.': '',
                'PWP Code': '',
                'Distributor': 'TOTAL',
                'Budget Amount': totalBudget.toFixed(2),
                'Remaining Balance': totalRemaining.toFixed(2),
                'Used Amount': (totalBudget - totalRemaining).toFixed(2),
                'Created By': '',
                'Created Date': '',
            });

            const ws = XLSX.utils.json_to_sheet(excelData);
            ws['!cols'] = [
                { wch: 5 },
                { wch: 15 },
                { wch: 20 },
                { wch: 15 },
                { wch: 18 },
                { wch: 15 },
                { wch: 15 },
                { wch: 15 },
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `KAS Budget ${year}`);
            const timestamp = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `KAS_Budget_${year}_${timestamp}.xlsx`);
            console.log('Excel exported successfully');
        } catch (error) {
            console.error('Error exporting Excel:', error);
            alert('Failed to export Excel file. Error: ' + error.message);
        }
    };

    

    return (
        <div style={{ padding: "20px" }}>
            {loading ? (
                <div className="text-center"><Spinner animation="border" /></div>
            ) : (
                <Card className="border-0" style={{ borderRadius: "20px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                    <Card.Header style={{ background: "linear-gradient(135deg, #274efcff 0%, #609cf5ff 100%)", color: "white", fontWeight: 600, padding: "1.5rem", fontSize: "1.15rem", borderBottom: "none" }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <span><i className="bi bi-wallet2 me-2"></i>KAS Budget for {year}</span>

                            <Dropdown as={ButtonGroup}>
                                <Dropdown.Toggle variant="light" size="sm" style={{ borderRadius: "10px", fontWeight: 600, padding: "0.5rem 1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} />
                                <Dropdown.Menu style={{ borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", border: "none" }}>
                                    <Dropdown.Item onClick={exportExcel}><i className="bi bi-file-excel me-2" style={{ color: "#28a745" }}></i>Export Excel</Dropdown.Item>
                                    {/* <Dropdown.Item onClick={exportPDF}><i className="bi bi-file-pdf me-2" style={{ color: "#dc3545" }}></i>Export PDF</Dropdown.Item> */}
                                    <Dropdown.Divider />
                                    <Dropdown.Header style={{ fontWeight: 600 }}>Select Year</Dropdown.Header>
                                    {[...new Set(budgetData.map((b) => new Date(b.createdate).getFullYear()))].sort((a, b) => b - a).map(y => (
                                        <Dropdown.Item key={y} onClick={() => setYear(y)} active={y === year} style={{ fontWeight: y === year ? 600 : 400 }}>{y}</Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </Card.Header>

                    <Card.Body style={{ padding: "2.5rem" }}>
                        <div className="d-flex justify-content-center mb-4">
                            <div style={{ width: 200, height: 200 }}>
                                <CircularProgressbar value={progressPercent} text={`${progressPercent}%`} styles={buildStyles({
                                    pathColor: progressPercent > 75 ? "#28a745" : progressPercent > 50 ? "#ffc107" : "#dc3545",
                                    trailColor: "#e9ecef",
                                    textColor: "#495057",
                                    textSize: "20px",
                                })} />
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
            )}
        </div>
    );
};

export default KasBudgetCard;
