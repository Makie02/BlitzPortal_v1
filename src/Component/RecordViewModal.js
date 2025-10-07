import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const RecordViewModal = ({ record, onClose }) => {
  const [fullRecord, setFullRecord] = useState(null);
  const [budgetHistory, setBudgetHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("single");


  const exportBudgetHistoryToExcel = () => {
    if (filteredBudgetHistory.length === 0) return;

    // Map the data to a cleaner format
    const dataToExport = filteredBudgetHistory.map((row) => ({
      ID: row.id,
      PWP_Code: row.pwp_code,
      Cover_PWP_Code: row.cover_pwp_code,
      Approver_ID: row.approver_id,
      Date_Responded: row.date_responded,
      Response: row.response,
      Remaining_Balance: row.remaining_balance,
      Credit_Budget: row.credit_budget,
      Type: row.type,
      Created_Form: row.created_form,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BudgetHistory");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "BudgetHistory.xlsx");
  };


  // Add this function inside your component, similar to exportBudgetHistoryToExcel
  const exportSingleRecordToExcel = () => {
    if (!fullRecord) return;

    // Map the record to a cleaner format (you can adjust column names if needed)
    const dataToExport = Object.entries(fullRecord).map(([key, value]) => ({
      Column: formatColumnName(key),
      Value: formatCellValue(value, key),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "RecordDetails");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "RecordDetails.xlsx");
  };

  // Category & Distributor Maps
  const [categoryMap, setCategoryMap] = useState({});
  const [distributorMap, setDistributorMap] = useState({});

  // Fetch categorydetails (code → name)
  const fetchCategoryMap = async () => {
    try {
      let allData = [];
      let from = 0;
      const chunkSize = 1000; // fetch in chunks
      let moreData = true;

      while (moreData) {
        const { data, error } = await supabase
          .from("categorydetails")
          .select("code, name")
          .range(from, from + chunkSize - 1);

        if (error) throw error;

        if (data.length > 0) {
          allData = [...allData, ...data];
          from += chunkSize;
        } else {
          moreData = false;
        }
      }

      console.log(`✅ categorydetails raw data: ${allData.length} rows loaded`);

      const map = {};
      allData.forEach((item) => {
        map[String(item.code).trim()] = item.name;
      });

      setCategoryMap(map);
    } catch (err) {
      console.error("❌ Failed to fetch category details:", err.message);
    }
  };

  // ✅ Helper for account type conversion
  const convertCodesToNames = (value) => {
    let codes = [];

    if (Array.isArray(value)) {
      codes = value;
    } else if (typeof value === "string") {
      try {
        codes = JSON.parse(value); // JSON array
      } catch {
        codes = value.split(",").map((c) => c.trim());
      }
    } else if (value) {
      codes = [value];
    }

    const converted = codes.map((code) => {
      const strCode = String(code).trim();
      const name = categoryMap[strCode];
      console.log("👉 Converting account_type:", strCode, "=>", name || "NOT FOUND");
      return name || strCode;
    });

    return converted.length > 0 ? converted.join(", ") : "-";
  };
  const [activityMap, setActivityMap] = useState({});

  useEffect(() => {
    if (record) {
      fetchFullRecord();
      fetchCategoryMap();
      fetchActivityMap();
      fetchRemainingBudget(); // ✅ added
    }
  }, [record]);

  // Fetch distributors (code → name)
  useEffect(() => {
    const fetchDistributorMap = async () => {
      const { data, error } = await supabase
        .from("distributors") // ⚠️ change table name if different
        .select("code, name");

      if (error) {
        console.error("❌ Error fetching distributors:", error);
        return;
      }

      const map = {};
      data.forEach((item) => {
        map[String(item.code)] = item.name;
      });
      setDistributorMap(map);
    };

    fetchDistributorMap();
  }, []);



  const fetchActivityMap = async () => {
    try {
      let allData = [];
      let from = 0;
      const chunkSize = 1000;
      let moreData = true;

      while (moreData) {
        const { data, error } = await supabase
          .from("activity")
          .select("code, name")
          .range(from, from + chunkSize - 1);

        if (error) throw error;

        if (data.length > 0) {
          allData = [...allData, ...data];
          from += chunkSize;
        } else {
          moreData = false;
        }
      }

      console.log(`✅ activity raw data: ${allData.length} rows loaded`);

      const map = {};
      allData.forEach((item) => {
        map[String(item.code).trim()] = item.name;
      });

      setActivityMap(map);
    } catch (err) {
      console.error("❌ Failed to fetch activity:", err.message);
    }
  };

  // Fetch full record
  useEffect(() => {
    if (record && activeTab === "single") fetchFullRecord();
    if (activeTab === "budget") fetchBudgetHistory();
  }, [record, activeTab]);

  const fetchFullRecord = async () => {
    try {
      setLoading(true);
      setError(null);
      const tableName = record.source || "regular_pwp";
      const { data, error: fetchError } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", record.id)
        .single();
      if (fetchError) throw fetchError;
      setFullRecord(data);
    } catch (err) {
      setError(`Failed to fetch record details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("approved_history_budget")
        .select("*")
        .order("id", { ascending: false });
      if (fetchError) throw fetchError;
      setBudgetHistory(data || []);
    } catch (err) {
      setError(`Failed to fetch budget history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const [filteredBudgetHistory, setFilteredBudgetHistory] = useState([]);

  useEffect(() => {
    if (!record) return;

    if (activeTab === "budget") {
      if (budgetHistory.length === 0) {
        fetchBudgetHistory();
      }

      const filtered = budgetHistory.filter(
        (b) =>
          b["Cover PWP Code"] === record.cover_code ||
          b["PWP Code"] === record.regularpwpcode
      );
      setFilteredBudgetHistory(filtered);
    }
  }, [activeTab, record, budgetHistory]);

  const formatColumnName = (colName) => {
    return colName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace("Pwp", "PWP")
      .replace("Id", "ID");
  };

  // ✅ Format cell values with logs
  const formatCellValue = (value, colName) => {
    if (!value && value !== 0) return "-";

    console.log("🔍 formatCellValue:", colName, value);

    // ✅ Handle account types
    if (
      colName === "account_type" ||
      colName === "account_types" ||
      colName === "accountType"
    ) {
      return convertCodesToNames(value);
    }

    // ✅ Convert distributor
    if (colName === "distributor" || colName === "distributor_code") {
      const strCode = String(value).trim();
      const name = distributorMap[strCode];
      console.log("👉 Converting distributor:", strCode, "=>", name || "NOT FOUND");
      return name || strCode;
    }

    // ✅ Convert activity (code → name)
    if (colName === "activity" || colName === "activity_code") {
      const strCode = String(value).trim();
      const name = activityMap[strCode];
      console.log("👉 Converting activity:", strCode, "=>", name || "NOT FOUND");
      return name || strCode;
    }

    if (colName === "created_at" && value) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }

    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  };


  const [remainingBudget, setRemainingBudget] = useState(null);

  const fetchRemainingBudget = async () => {
    try {
      const pwpCode = record?.source === "cover_pwp" ? record?.cover_code : record?.regularpwpcode;
      if (!pwpCode) return;

      const { data, error } = await supabase
        .from("amount_badget")
        .select("remainingbalance")
        .eq("pwp_code", pwpCode)
        .order("id", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      setRemainingBudget(data?.remainingbalance ?? null);
    } catch (err) {
      console.error("❌ Failed to fetch remaining budget:", err.message);
      setRemainingBudget(null);
    }
  };



  if (!record) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 30px",
            backgroundColor: "#0080ffff",
            color: "white",
            borderRadius: "12px 12px 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: "30px", color: "#ffff" }}>
              {activeTab === "single" ? "Record Details" : "Budget History"}
            </h2>
            <div style={{ marginBottom: "8px" }}>
              {remainingBudget !== null && (
                <div style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1e58a3",
                  backgroundColor: "#e3f2fd",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  display: "inline-block",
                  marginBottom: "4px",
                }}>
                  Remaining Budget: {remainingBudget.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                </div>
              )}
              <h3 style={{ margin: 0, color: "#ffffffff", fontSize: "18px" }}>
                {record?.source === "cover_pwp"
                  ? `Cover PWP Record: ${record?.cover_code || "-"}`
                  : `Regular PWP Record: ${record?.regularpwpcode || "-"}`}
              </h3>
            </div>

          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              cursor: "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0", backgroundColor: "#f5f5f5" }}>
          {["single", "budget"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "12px",
                cursor: "pointer",
                border: "none",
                borderBottom: activeTab === tab ? "3px solid #1e58a3ff" : "3px solid transparent",
                backgroundColor: activeTab === tab ? "#007bacff" : "#f5f5f5",
                color: activeTab === tab ? "white" : "#1976d2",
                fontWeight: "500",
                position: "relative",
              }}
            >
              {tab === "single" ? "📋 Single Record" : "💰 Budget History"}
            </button>
          ))}
        </div>
        {/* Export Button (only show in single tab) */}
        {activeTab === "single" && fullRecord && (
          <div style={{ padding: "16px", textAlign: "right" }}>
            <button
              onClick={exportSingleRecordToExcel}
              style={{
                padding: "10px 20px",
                backgroundColor: "#0aac12ff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Export Single Record to Excel
            </button>
          </div>
        )}

        {/* Export Button (only show in budget tab) */}
        {activeTab === "budget" && filteredBudgetHistory.length > 0 && (
          <div style={{ padding: "16px", textAlign: "right" }}>
            <button
              onClick={exportBudgetHistoryToExcel}
              style={{
                padding: "10px 20px",
                backgroundColor: "#0aac12ff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Export to Excel
            </button>
          </div>
        )}


        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "4px solid #e3f2fd",
                  borderTop: "4px solid #1976d2",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 20px",
                }}
              ></div>
              <p>Loading...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", color: "#d32f2f" }}>
              <p>{error}</p>
            </div>
          ) : activeTab === "single" && fullRecord ? (
            <div
              style={{
                display: "grid",
                gap: "20px",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              }}
            >
              {Object.entries(fullRecord).map(([key, value]) => {
                const displayValue =
                  (key === "accountType" || key === "account_type") &&
                    Object.keys(categoryMap).length > 0
                    ? convertCodesToNames(value)
                    : formatCellValue(value, key);

                return (
                  <div
                    key={key}
                    style={{
                      padding: "16px",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#666",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "8px",
                      }}
                    >
                      {formatColumnName(key)}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#333",
                        lineHeight: "1.4",
                        wordBreak: "break-word",
                        whiteSpace: typeof value === "object" ? "pre-wrap" : "normal",
                        fontFamily: typeof value === "object" ? "monospace" : "inherit",
                      }}
                    >
                      {displayValue}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === "budget" ? (
            <div>
              {activeTab === "budget" ? (
                <div>
                  {filteredBudgetHistory.length > 0 ? (
                    <div>
                      {/* Only display header if cover_pwp_code or pwp_code matches */}
                      {filteredBudgetHistory.some(
                        (b) =>
                          b["cover_pwp_code"] === record.cover_code ||
                          b["pwp_code"] === record.regularpwpcode
                      ) && (
                          <h3 style={{ margin: 0, color: "#000000ff", fontSize: "18px" }}>
                            {record.source === "cover_pwp"
                              ? `Cover PWP Record: ${record.cover_code || "-"}`
                              : `Regular PWP Record: ${record.regularpwpcode || "-"}`}
                          </h3>
                        )}

                      {/* Display table only if there is at least one matching row */}
                      {filteredBudgetHistory.some(
                        (b) =>
                          b["cover_pwp_code"] === record.cover_code ||
                          b["pwp_code"] === record.regularpwpcode
                      ) ? (
                        <div style={{ overflowX: "auto", maxHeight: "400px" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead style={{ position: "sticky", top: 0, backgroundColor: "#f5f5f5" }}>
                              <tr>
                                {[
                                  "id",
                                  "pwp_code",
                                  "cover_pwp_code",
                                  "approver_id",
                                  "date_responded",
                                  "response",
                                  "remaining_balance",
                                  "credit_budget",
                                  "type",
                                  "created_form",
                                ].map((col) => (
                                  <th
                                    key={col}
                                    style={{
                                      padding: "12px 16px",
                                      textAlign: "left",
                                      borderBottom: "2px solid #ddd",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      backgroundColor: "#f5f5f5",
                                    }}
                                  >
                                    {formatColumnName(col)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredBudgetHistory
                                .filter(
                                  (b) =>
                                    b["cover_pwp_code"] === record.cover_code ||
                                    b["pwp_code"] === record.regularpwpcode
                                )
                                .map((row, index) => (
                                  <tr
                                    key={row.id || index}
                                    style={{ backgroundColor: index % 2 === 0 ? "white" : "#fafafa" }}
                                  >
                                    {[
                                      "id",
                                      "pwp_code",
                                      "cover_pwp_code",
                                      "approver_id",
                                      "date_responded",
                                      "response",
                                      "remaining_balance",
                                      "credit_budget",
                                      "type",
                                      "created_form",
                                    ].map((col) => (
                                      <td
                                        key={col}
                                        style={{
                                          padding: "12px 16px",
                                          borderBottom: "1px solid #eee",
                                          fontSize: "12px",
                                          maxWidth: "200px",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {formatCellValue(row[col], col)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                          No budget history found for this record
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
                      No budget history found for this record
                    </div>
                  )}
                </div>
              ) : null}

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RecordViewModal;
