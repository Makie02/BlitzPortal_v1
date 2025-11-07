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
  const [remainingBudget, setRemainingBudget] = useState(null);
  const [regularSkuData, setRegularSkuData] = useState([]);
  const [regularAccountBudgetData, setRegularAccountBudgetData] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});
  const [distributorMap, setDistributorMap] = useState({});
  const [activityMap, setActivityMap] = useState({});
  const [filteredBudgetHistory, setFilteredBudgetHistory] = useState([]);

  const exportBudgetHistoryToExcel = () => {
    if (filteredBudgetHistory.length === 0) return;

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

const exportSingleRecordToExcel = () => {
  if (!fullRecord) return;

  // 🧩 Step 1: Prepare one-row data
  const formattedRecord = {};
  Object.entries(fullRecord).forEach(([key, value]) => {
    formattedRecord[formatColumnName(key)] = formatCellValue(value, key);
  });

  // 🧩 Step 2: Create worksheet from array of one object
  const worksheet = XLSX.utils.json_to_sheet([formattedRecord]);

  // 🧩 Step 3: Build and save workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "RecordDetails");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, "RecordDetails.xlsx");
};


  const fetchCategoryMap = async () => {
    try {
      let allData = [];
      let from = 0;
      const chunkSize = 1000;
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

  const convertCodesToNames = (value) => {
    let codes = [];

    if (Array.isArray(value)) {
      codes = value;
    } else if (typeof value === "string") {
      try {
        codes = JSON.parse(value);
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

  useEffect(() => {
    if (record) {
      fetchFullRecord();
      fetchCategoryMap();
      fetchActivityMap();
      fetchRemainingBudget();
      fetchRegularSkuData();
      fetchRegularAccountBudgetData();
    }
  }, [record]);

  useEffect(() => {
    const fetchDistributorMap = async () => {
      const { data, error } = await supabase
        .from("distributors")
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

  const fetchRegularSkuData = async () => {
    try {
      const regularCode = record?.regularpwpcode;
      if (!regularCode) return;

      const { data, error } = await supabase
        .from("regular_sku")
        .select("*")
        .eq("regular_code", regularCode)
        .order("id", { ascending: false });

      if (error) throw error;

      setRegularSkuData(data || []);
    } catch (err) {
      console.error("❌ Failed to fetch regular_sku:", err.message);
      setRegularSkuData([]);
    }
  };

  const fetchRegularAccountBudgetData = async () => {
    try {
      const regularCode = record?.regularpwpcode;
      if (!regularCode) return;

      const { data, error } = await supabase
        .from("regular_accountlis_badget")
        .select("*")
        .eq("regularcode", regularCode)
        .order("id", { ascending: false });

      if (error) throw error;

      setRegularAccountBudgetData(data || []);
    } catch (err) {
      console.error("❌ Failed to fetch regular_accountlis_badget:", err.message);
      setRegularAccountBudgetData([]);
    }
  };

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

  const formatCellValue = (value, colName) => {
    if (!value && value !== 0) return "-";

    console.log("🔍 formatCellValue:", colName, value);

    if (
      colName === "account_type" ||
      colName === "account_types" ||
      colName === "accountType"
    ) {
      return convertCodesToNames(value);
    }

    if (colName === "distributor" || colName === "distributor_code") {
      const strCode = String(value).trim();
      const name = distributorMap[strCode];
      console.log("👉 Converting distributor:", strCode, "=>", name || "NOT FOUND");
      return name || strCode;
    }

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
              Record Details
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
                  Remaining Budget: {remainingBudget.toLocaleString(undefined, { style: 'currency', currency: 'PHP' })}
                </div>
              )}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "linear-gradient(90deg, #004aad, #007bff)",
                  color: "white",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "600",
                  letterSpacing: "0.5px",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                }}
              >
                <span
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  {record?.source === "cover_pwp" ? "Cover PWP Record" : "Regular PWP Record"}
                </span>
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: "700",
                    backgroundColor: "#ffffff",
                    color: "#004aad",
                    padding: "4px 12px",
                    borderRadius: "6px",
                  }}
                >
                  {record?.source === "cover_pwp"
                    ? record?.cover_code || "-"
                    : record?.regularpwpcode || "-"}
                </span>
              </div>

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

        {/* Export Button */}
        {fullRecord && (
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
          ) : fullRecord ? (
            <div>
              {/* Single Record Details */}
              <div
                style={{
                  display: "grid",
                  gap: "20px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  marginBottom: "30px",
                }}
              >
                {Object.entries(fullRecord)
                  .filter(([key, value]) => {
                    // Hide specific columns
                    const hiddenFields = ["id", "regularpwpcode", "pwptype", "remaining_balance", "credit_budget", 'amountbadget'];
                    if (hiddenFields.includes(key.toLowerCase())) return false;

                    if (value === null || value === undefined || value === false) return false;

                    if (typeof value === "string") {
                      const val = value.trim().toUpperCase();
                      if (["", "-", "EMPTY", "FALSE", "[]", "{}"].includes(val)) return false;
                    }

                    if (Array.isArray(value) && value.length === 0) return false;
                    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
                      return false;

                    return true;
                  })
                  .map(([key, value]) => {
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
              {/* Footer Section */}
              {/* Footer Section */}
              <div
                style={{
                  padding: "16px 30px",
                  backgroundColor: "#f1f5f9",
                  borderTop: "1px solid #ddd",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "40px",
                  alignItems: "center",
                }}
              >
                {/* Remaining Balance */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#555" }}>
                    Remaining Balance
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#0d6efd" }}>
                    ₱{" "}
                    {fullRecord?.remaining_balance
                      ? Number(fullRecord.remaining_balance).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })
                      : "0.00"}
                  </div>
                </div>

                {/* Credit Budget */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#555" }}>
                    Credit Budget
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#16a34a" }}>
                    ₱{" "}
                    {fullRecord?.credit_budget
                      ? Number(fullRecord.credit_budget).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })
                      : "0.00"}
                  </div>
                </div>
              </div>


              {/* SKU Table - Only show if data exists */}
              {regularSkuData.length > 0 && (
                <div style={{ marginBottom: "30px" }}>
                  <h3 style={{
                    marginBottom: "16px",
                    color: "#0080ffff",
                    fontSize: "20px",
                    fontWeight: "600",
                    borderBottom: "2px solid #0080ffff",
                    paddingBottom: "8px"
                  }}>
                    📦 SKU Data
                  </h3>
                  <div style={{ overflowX: "auto", maxHeight: "500px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          backgroundColor: "#f5f5f5",
                          zIndex: 1,
                        }}
                      >
                        <tr>
                          {[
                            "id",
                            "regular_code",
                            "account_name",
                            "sku_code",
                            "srp",
                            "qty",
                            "uom",
                            "billing_amount",
                            "discount",
                            "total_amount",
                          ].map((col) => (
                            <th
                              key={col}
                              style={{
                                padding: "12px 16px",
                                textAlign: col === "total_amount" ? "right" : "left",
                                borderBottom: "2px solid #ddd",
                                fontSize: "12px",
                                fontWeight: "600",
                                backgroundColor: "#f5f5f5",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatColumnName(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {regularSkuData.map((row, index) => (
                          <tr
                            key={row.id || index}
                            style={{
                              backgroundColor: index % 2 === 0 ? "white" : "#fafafa",
                            }}
                          >
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.id}
                            </td>
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.regular_code}
                            </td>
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.account_name}
                            </td>
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.sku_code || "-"}
                            </td>
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.srp
                                ? `₱${Number(row.srp).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                                : "-"}
                            </td>
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.qty || 0}
                            </td>
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.uom}
                            </td>
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.billing_amount
                                ? `₱${Number(row.billing_amount).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                                : "-"}
                            </td>
                            <td style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontSize: "12px" }}>
                              {row.discount
                                ? `₱${Number(row.discount).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                                : "-"}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid #eee",
                                fontSize: "12px",
                                textAlign: "right",
                              }}
                            >
                              {row.total_amount
                                ? `₱${Number(row.total_amount).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* ✅ TOTAL FOOTER ROW */}
                      <tfoot>
                        <tr style={{ backgroundColor: "#e3f2fd", fontWeight: "600" }}>
                          <td
                            colSpan="9"
                            style={{
                              padding: "12px 16px",
                              borderTop: "2px solid #0080ff",
                              fontSize: "14px",
                              textAlign: "right",
                            }}
                          >
                            Total Amount:
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              borderTop: "2px solid #0080ff",
                              fontSize: "14px",
                              textAlign: "right",
                              color: "#0080ff",
                            }}
                          >
                            {regularSkuData.length > 0
                              ? `₱${regularSkuData
                                .reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0)
                                .toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : "-"}
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                  </div>
                </div>
              )}

              {/* Account Budget Table - Only show if data exists */}
              {regularAccountBudgetData.length > 0 && (
                <div style={{ marginBottom: "30px" }}>
                  <h3 style={{
                    marginBottom: "16px",
                    color: "#0080ffff",
                    fontSize: "20px",
                    fontWeight: "600",
                    borderBottom: "2px solid #0080ffff",
                    paddingBottom: "8px"
                  }}>
                    💰 Account Budget
                  </h3>
                  <div style={{ overflowX: "auto", maxHeight: "500px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          backgroundColor: "#f5f5f5",
                          zIndex: 1,
                        }}
                      >
                        <tr>
                          {["account_name", "budget"].map((col) => (
                            <th
                              key={col}
                              style={{
                                padding: "12px 16px",
                                textAlign: col === "budget" ? "right" : "left",
                                borderBottom: "2px solid #ddd",
                                fontSize: "12px",
                                fontWeight: "600",
                                backgroundColor: "#f5f5f5",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatColumnName(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {regularAccountBudgetData.map((row, index) => (
                          <tr
                            key={row.id || index}
                            style={{
                              backgroundColor: index % 2 === 0 ? "white" : "#fafafa",
                            }}
                          >
                            <td
                              style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid #eee",
                                fontSize: "12px",
                                textAlign: "left",
                              }}
                            >
                              {row.account_name}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid #eee",
                                fontSize: "12px",
                                textAlign: "right",
                              }}
                            >
                              {row.budget
                                ? `₱${Number(row.budget).toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr style={{ backgroundColor: "#e3f2fd", fontWeight: "600" }}>
                          <td
                            style={{
                              padding: "12px 16px",
                              borderTop: "2px solid #0080ff",
                              fontSize: "14px",
                              textAlign: "right",
                            }}
                          >
                            Total Budget:
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              borderTop: "2px solid #0080ff",
                              fontSize: "14px",
                              textAlign: "right",
                              color: "#0080ff",
                            }}
                          >
                            {regularAccountBudgetData.length > 0
                              ? `₱${regularAccountBudgetData
                                .reduce((sum, row) => sum + (Number(row.budget) || 0), 0)
                                .toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : "-"}
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RecordViewModal;
