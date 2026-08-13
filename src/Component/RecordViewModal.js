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
  const [remarksNote, setRemarksNote] = useState(null);

  // ============================================================
  // 🎨 DESIGN TOKENS
  // ============================================================
  const colors = {
    bg: "#f8fafc",
    surface: "#ffffff",
    border: "#e5e9f0",
    borderSoft: "#eef1f5",
    textPrimary: "#0f172a",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    primary: "#4f46e5",
    primaryDark: "#4338ca",
    primarySoft: "#eef2ff",
    success: "#16a34a",
    successSoft: "#ecfdf5",
    danger: "#dc2626",
    accentGradient: "linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #3b82f6 100%)",
  };

  const fontStack =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  // ✅ NEW: normalize array / JSON-array-string / plain string values coming
  // from columns like sku, penalty, suppliesme. Returns `null` kapag walang
  // talagang laman ("[]", "{}", "", empty array, etc.) para magamit natin
  // 'to both sa "may laman ba 'to para ipakita ang column" check, AT sa
  // pag-display ng cell (comma-separated, walang brackets/quotes).
  const formatListCell = (val) => {
    if (val === null || val === undefined) return null;

    let arr = null;

    if (Array.isArray(val)) {
      arr = val;
    } else if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "" || trimmed === "[]" || trimmed === "{}") return null;

      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) arr = parsed;
        } catch {
          // hindi valid JSON, ituturing na lang na plain string sa baba
        }
      }

      if (arr === null) {
        return trimmed === "" ? null : trimmed;
      }
    } else {
      return String(val);
    }

    const cleaned = arr.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(", ") : null;
  };

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

    const formattedRecord = {};
    Object.entries(fullRecord).forEach(([key, value]) => {
      formattedRecord[formatColumnName(key)] = formatCellValue(value, key);
    });

    formattedRecord["Remarks Notes"] = remarksNote || "-";

    const worksheet = XLSX.utils.json_to_sheet([formattedRecord]);
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
          .from("category_listing")
          .select("sku_code, name")
          .range(from, from + chunkSize - 1);

        if (error) throw error;

        if (data.length > 0) {
          allData = [...allData, ...data];
          from += chunkSize;
        } else {
          moreData = false;
        }
      }

      const map = {};
      allData.forEach((item) => {
        map[String(item.sku_code).trim()] = item.name;
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

      const map = {};
      allData.forEach((item) => {
        map[String(item.code).trim()] = item.name;
      });

      setActivityMap(map);
    } catch (err) {
      console.error("❌ Failed to fetch activity:", err.message);
    }
  };

  const fetchRemarksNote = async () => {
    try {
      const pwpCode = record?.source === "cover_pwp" ? record?.cover_code : record?.regularpwpcode;
      if (!pwpCode) {
        setRemarksNote(null);
        return;
      }

      const { data, error } = await supabase
        .from("Approval_History")
        .select("RemarksNote")
        .eq("PwpCode", pwpCode)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setRemarksNote(data?.RemarksNote || null);
    } catch (err) {
      console.error("❌ Failed to fetch remarks note:", err.message);
      setRemarksNote(null);
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
      fetchRemarksNote();
    }
  }, [record]);

  useEffect(() => {
    const fetchDistributorMap = async () => {
      const { data, error } = await supabase.from("distributors").select("code, name");

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

      console.log("[DEBUG regular_sku row]", data?.[0]);
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
        (b) => b["Cover PWP Code"] === record.cover_code || b["PWP Code"] === record.regularpwpcode
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

  // NEW
  const formatCellValue = (value, colName) => {
    if (!value && value !== 0) return "-";

    // ✅ Booleans -> Yes/No, hindi "true"/"false"
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (colName === "account_type" || colName === "account_types" || colName === "accountType") {
      return convertCodesToNames(value);
    }

    if (colName === "distributor" || colName === "distributor_code") {
      const strCode = String(value).trim();
      const name = distributorMap[strCode];
      return name || strCode;
    }

    if (colName === "activity" || colName === "activity_code") {
      const strCode = String(value).trim();
      const name = activityMap[strCode];
      return name || strCode;
    }

    if (colName === "created_at" && value) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }

    // ✅ Array -> clean comma-separated (no brackets/quotes)
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(", ") : "-";
    }

    // ✅ String na naka-JSON array pero hindi na-detect (e.g. "[\"a\",\"b\"]")
    if (typeof value === "string" && value.trim().startsWith("[") && value.trim().endsWith("]")) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.join(", ");
      } catch {
        // fallthrough, treat as plain string
      }
    }

    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  };

  if (!record) return null;

  const pwpCodeDisplay =
    record?.source === "cover_pwp" ? record?.cover_code || "-" : record?.regularpwpcode || "-";

  // ============================================================
  // 🧩 Reusable sub-components (inline for single-file drop-in)
  // ============================================================
  const InfoCard = ({ label, children, wide }) => (
    <div
      style={{
        padding: "16px 18px",
        backgroundColor: colors.surface,
        borderRadius: "12px",
        border: `1px solid ${colors.border}`,
        transition: "box-shadow 0.15s ease, transform 0.15s ease",
        gridColumn: wide ? "span 2" : "span 1", // ✅ mag-expand kung mahaba laman
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 14px rgba(15, 23, 42, 0.06)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "14.5px",
          color: colors.textPrimary,
          lineHeight: 1.5,
          wordBreak: "break-word",
          fontWeight: 500,
        }}
      >
        {children}
      </div>
    </div>
  );

  const SectionTitle = ({ icon, children }) => (
    <h3
      style={{
        margin: "0 0 16px",
        color: colors.textPrimary,
        fontSize: "17px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "30px",
          height: "30px",
          borderRadius: "8px",
          backgroundColor: colors.primarySoft,
          fontSize: "15px",
        }}
      >
        {icon}
      </span>
      {children}
    </h3>
  );

  const thStyle = {
    padding: "12px 16px",
    textAlign: "left",
    borderBottom: `1px solid ${colors.border}`,
    fontSize: "11px",
    fontWeight: 700,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    backgroundColor: "#f9fafc",
    whiteSpace: "nowrap",
  };

  const tdStyle = {
    padding: "12px 16px",
    borderBottom: `1px solid ${colors.borderSoft}`,
    fontSize: "13px",
    color: colors.textPrimary,
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(2px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: fontStack,
      }}
    >
      <div
        style={{
          backgroundColor: colors.bg,
          borderRadius: "18px",
          maxWidth: "1100px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 70px rgba(15, 23, 42, 0.35)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "26px 32px",
            background: colors.accentGradient,
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            position: "relative",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: 0.75,
                marginBottom: "6px",
              }}
            >
              Record Details
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span
                style={{
                  backgroundColor: "rgba(255,255,255,0.16)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "6px 14px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {record?.source === "cover_pwp" ? "Cover PWP" : "Regular PWP"}
              </span>

              <span
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  backgroundColor: "white",
                  color: colors.primaryDark,
                  padding: "6px 16px",
                  borderRadius: "10px",
                  letterSpacing: "0.02em",
                }}
              >
                {pwpCodeDisplay}
              </span>

              {remainingBudget !== null && (
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    backgroundColor: "rgba(255,255,255,0.16)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    padding: "6px 14px",
                    borderRadius: "999px",
                  }}
                >
                  Remaining:{" "}
                  {remainingBudget.toLocaleString(undefined, {
                    style: "currency",
                    currency: "PHP",
                  })}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.3)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)")}
          >
            ×
          </button>
        </div>

        {/* Export Button */}
        {fullRecord && (
          <div
            style={{
              padding: "14px 32px",
              backgroundColor: colors.surface,
              borderBottom: `1px solid ${colors.border}`,
              textAlign: "right",
            }}
          >
            <button
              onClick={exportSingleRecordToExcel}
              style={{
                padding: "9px 18px",
                backgroundColor: colors.success,
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)",
                transition: "transform 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              ⬇ Export Single Record to Excel
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  border: `3px solid ${colors.primarySoft}`,
                  borderTop: `3px solid ${colors.primary}`,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 16px",
                }}
              ></div>
              <p style={{ color: colors.textSecondary, fontSize: "14px" }}>Loading...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : error ? (
            <div
              style={{
                textAlign: "center",
                color: colors.danger,
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
            </div>
          ) : fullRecord ? (
            <div>
              {/* Field Cards */}
              <div
                style={{
                  display: "grid",
                  gap: "14px",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gridAutoFlow: "dense", // ✅ para tumapat ang maiiksing cards sa gaps
                  marginBottom: "24px",
                }}
              >
                {Object.entries(fullRecord)
                  .filter(([key, value]) => {
                    const hiddenFields = [
                      "id",
                      "regularpwpcode",
                      "pwptype",
                      "remaining_balance",
                      "credit_budget",
                      "amountbadget",
                    ];
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
                      (key === "accountType" || key === "account_type") && Object.keys(categoryMap).length > 0
                        ? convertCodesToNames(value)
                        : formatCellValue(value, key);


                    const isLong = typeof displayValue === "string" && displayValue.length > 60;

                    return (
                      <InfoCard key={key} label={formatColumnName(key)} wide={isLong}>
                        <span
                          style={{
                            whiteSpace: "normal", // ✅ hindi na kailangan ng pre-wrap kasi malinis na ang laman
                            fontWeight: 500,
                          }}
                        >
                          {displayValue}
                        </span>
                      </InfoCard>
                    );
                  })}
              </div>

              {/* Footer Summary Section */}
              <div
                style={{
                  padding: "18px 22px",
                  backgroundColor: colors.surface,
                  borderRadius: "14px",
                  border: `1px solid ${colors.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "20px",
                  alignItems: "stretch",
                  flexWrap: "wrap",
                  marginBottom: "28px",
                }}
              >
                {/* Remarks / Notes */}
                <div
                  style={{
                    flex: 1,
                    minWidth: "260px",
                    padding: "14px 16px",
                    backgroundColor: colors.bg,
                    borderRadius: "10px",
                    border: `1px solid ${colors.borderSoft}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: colors.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                    }}
                  >
                    Remarks / Notes
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: colors.textPrimary,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {remarksNote || (
                      <span style={{ color: colors.textMuted, fontStyle: "italic" }}>
                        No remarks/notes available.
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "14px", alignItems: "stretch" }}>
                  {/* Remaining Balance */}
                  <div
                    style={{
                      padding: "14px 20px",
                      backgroundColor: colors.primarySoft,
                      borderRadius: "10px",
                      textAlign: "right",
                      minWidth: "160px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: colors.primaryDark, opacity: 0.8 }}>
                      Remaining Balance
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: colors.primaryDark, marginTop: "4px" }}>
                      ₱{" "}
                      {fullRecord?.remaining_balance
                        ? Number(fullRecord.remaining_balance).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })
                        : "0.00"}
                    </div>
                  </div>

                  {/* Credit Budget */}
                  <div
                    style={{
                      padding: "14px 20px",
                      backgroundColor: colors.successSoft,
                      borderRadius: "10px",
                      textAlign: "right",
                      minWidth: "160px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: colors.success, opacity: 0.85 }}>
                      Credit Budget
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: colors.success, marginTop: "4px" }}>
                      ₱{" "}
                      {fullRecord?.credit_budget
                        ? Number(fullRecord.credit_budget).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })
                        : "0.00"}
                    </div>
                  </div>
                </div>
              </div>

              {/* SKU Table */}
              {regularSkuData.length > 0 && (
                <div style={{ marginBottom: "28px" }}>
                  <SectionTitle icon="📦">SKU Data</SectionTitle>
                  <div
                    style={{
                      overflowX: "auto",
                      maxHeight: "480px",
                      borderRadius: "12px",
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          {["id", "account_name", "sku_code", "total_amount"].map((col) => (
                            <th
                              key={col}
                              style={{
                                ...thStyle,
                                textAlign: col === "total_amount" ? "right" : "left",
                              }}
                            >
                              {col === "sku_code" ? "SKU" : formatColumnName(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {regularSkuData.map((row, index) => (
                          <tr key={row.id || index} style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.bg }}>
                            <td style={tdStyle}>{row.id}</td>
                            <td style={tdStyle}>{row.account_name}</td>
                            <td style={tdStyle}>{categoryMap[String(row.sku_code).trim()] || row.sku_code || "-"}</td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
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
                      <tfoot>

                        <tr style={{ backgroundColor: colors.primarySoft }}>
                          <td
                            colSpan="3"
                            style={{
                              padding: "14px 16px",
                              borderTop: `2px solid ${colors.primary}`,
                              fontSize: "13px",
                              fontWeight: 700,
                              textAlign: "right",
                              color: colors.textPrimary,
                            }}
                          >
                            Total Amount:
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              borderTop: `2px solid ${colors.primary}`,
                              fontSize: "14px",
                              fontWeight: 800,
                              textAlign: "right",
                              color: colors.primaryDark,
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

              {/* Account Budget Table */}
              {regularAccountBudgetData.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  <SectionTitle icon="💰">Account Budget</SectionTitle>
                  <div
                    style={{
                      overflowX: "auto",
                      maxHeight: "480px",
                      borderRadius: "12px",
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                    }}
                  >
                    {(() => {
                      // ✅ dynamic columns — only show SKU/Penalty/Supplies if
                      // at least one row has a REAL value (hindi lang "[]"/"{}"/
                      // empty array). Gamit ang formatListCell para tama ang
                      // pagkilala kung ano ba talaga ang "may laman".
                      const hasSku = regularAccountBudgetData.some((r) => formatListCell(r.sku) !== null);
                      const hasPenalty = regularAccountBudgetData.some((r) => formatListCell(r.penalty) !== null);
                      const hasSupplies = regularAccountBudgetData.some((r) => formatListCell(r.suppliesme) !== null);

                      const columns = [
                        "account_name",
                        ...(hasSku ? ["sku"] : []),
                        ...(hasPenalty ? ["penalty"] : []),
                        ...(hasSupplies ? ["suppliesme"] : []),
                        "budget",
                      ];

                      return (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                            <tr>
                              {columns.map((col) => (
                                <th
                                  key={col}
                                  style={{
                                    ...thStyle,
                                    textAlign: col === "budget" ? "right" : "left",
                                  }}
                                >
                                  {col === "suppliesme" ? "Supplies/M.E" : formatColumnName(col)}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          <tbody>
                            {regularAccountBudgetData.map((row, index) => (
                              <tr key={row.id || index} style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.bg }}>
                                {columns.map((col) => {
                                  if (col === "budget") {
                                    return (
                                      <td key={col} style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                                        {row.budget
                                          ? `₱${Number(row.budget).toLocaleString("en-PH", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}`
                                          : "-"}
                                      </td>
                                    );
                                  }
                                  if (col === "sku" || col === "penalty" || col === "suppliesme") {
                                    return (
                                      <td key={col} style={tdStyle}>
                                        {formatListCell(row[col]) ?? "-"}
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={col} style={tdStyle}>
                                      {row[col] && String(row[col]).trim() !== "" ? row[col] : "-"}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>

                          <tfoot>
                            <tr style={{ backgroundColor: colors.primarySoft }}>
                              <td
                                colSpan={columns.length - 1}
                                style={{
                                  padding: "14px 16px",
                                  borderTop: `2px solid ${colors.primary}`,
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  textAlign: "right",
                                  color: colors.textPrimary,
                                }}
                              >
                                Total Budget:
                              </td>
                              <td
                                style={{
                                  padding: "14px 16px",
                                  borderTop: `2px solid ${colors.primary}`,
                                  fontSize: "14px",
                                  fontWeight: 800,
                                  textAlign: "right",
                                  color: colors.primaryDark,
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
                      );
                    })()}
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
