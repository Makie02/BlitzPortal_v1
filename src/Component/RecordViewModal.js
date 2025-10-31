import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const RecordViewModal = ({ record, onClose }) => {
  const [fullRecord, setFullRecord] = useState(null);
  const [accountList, setAccountList] = useState([]);
  const [skuList, setSkuList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryMap, setCategoryMap] = useState({});
  const [distributorMap, setDistributorMap] = useState({});
  const [activityMap, setActivityMap] = useState({});
  const [remainingBudget, setRemainingBudget] = useState(null);
  const [activeTab, setActiveTab] = useState("single");

  // ===================== Excel Export =====================
const exportSingleRecordToExcel = () => {
  if (!fullRecord) return;

  const wb = XLSX.utils.book_new();

  // ------------------ Main Record ------------------
  const recordData = Object.fromEntries(
    Object.entries(fullRecord).map(([key, value]) => [
      formatColumnName(key),
      formatCellValue(value, key),
    ])
  );
  const wsRecord = XLSX.utils.json_to_sheet([recordData]);
  XLSX.utils.book_append_sheet(wb, wsRecord, "RecordDetails");

  // ------------------ Accounts ------------------
  if (accountList.length > 0) {
    const accData = accountList.map((a) => ({
      "Account Name": a.account_name,
      "Budget": a.budget,
    }));

    // Add total row
    const totalBudget = accountList.reduce((sum, a) => sum + Number(a.budget || 0), 0);
    accData.push({
      "Account Name": "Total",
      "Budget": totalBudget,
    });

    const wsAcc = XLSX.utils.json_to_sheet(accData);
    XLSX.utils.book_append_sheet(wb, wsAcc, "Accounts");
  }

  // ------------------ SKUs ------------------
  if (skuList.length > 0) {
    const skuData = skuList.map((s) => ({
      "Account Name": s.account_name,
      "SKU Code": s.sku_code || "-",
      "SRP": s.srp,
      "Qty": s.qty,
      "UOM": s.uom,
      "Billing Amount": s.billing_amount,
      "Discount": s.discount,
      "Total Amount": s.total_amount,
    }));

    // Add total row
    const totalBilling = skuList.reduce((sum, s) => sum + Number(s.billing_amount || 0), 0);
    const totalDiscount = skuList.reduce((sum, s) => sum + Number(s.discount || 0), 0);
    const totalAmount = skuList.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    skuData.push({
      "Account Name": "Total",
      "SKU Code": "",
      "SRP": "",
      "Qty": "",
      "UOM": "",
      "Billing Amount": totalBilling,
      "Discount": totalDiscount,
      "Total Amount": totalAmount,
    });

    const wsSKU = XLSX.utils.json_to_sheet(skuData);
    XLSX.utils.book_append_sheet(wb, wsSKU, "SKUs");
  }

  // ------------------ Save ------------------
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, "RecordDetails.xlsx");
};

  // ===================== Data Fetching =====================
  useEffect(() => {
    if (!record) return;

    const fetchMapsAndData = async () => {
      setLoading(true);
      try {
        const tableName = record.source || "regular_pwp";
        const { data: recordData, error: recError } = await supabase
          .from(tableName)
          .select("*")
          .eq("id", record.id)
          .single();
        if (recError) throw recError;

        setFullRecord(recordData);

        // Fetch accounts and SKUs and **wait for them**
        const accounts = await fetchAccountList(recordData);
        const skus = await fetchSKUList(recordData);
        setAccountList(accounts);
        setSkuList(skus);

        // Maps
        fetchCategoryMap();
        fetchDistributorMap();
        fetchActivityMap();

        // Remaining budget
        fetchRemainingBudget();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMapsAndData();
  }, [record]);


  const fetchCategoryMap = async () => {
    const { data, error } = await supabase.from("categorydetails").select("code, name");
    if (!error && data) {
      const map = {};
      data.forEach((item) => (map[item.code] = item.name));
      setCategoryMap(map);
    }
  };

  const fetchDistributorMap = async () => {
    const { data, error } = await supabase.from("distributors").select("code, name");
    if (!error && data) {
      const map = {};
      data.forEach((item) => (map[item.code] = item.name));
      setDistributorMap(map);
    }
  };

  const fetchActivityMap = async () => {
    const { data, error } = await supabase.from("activity").select("code, name");
    if (!error && data) {
      const map = {};
      data.forEach((item) => (map[item.code] = item.name));
      setActivityMap(map);
    }
  };

  const fetchAccountList = async (source) => {
    if (!source) return [];
    const regularCode = source.regularpwpcode || source.code;
    const { data, error } = await supabase
      .from("regular_accountlis_badget")
      .select("regularcode, account_name, budget, total_budget")
      .eq("regularcode", regularCode);
    if (!error && data) return data;
    return [];
  };

  const fetchSKUList = async (source) => {
    if (!source) return [];
    const regularCode = source.regularpwpcode || source.code;
    const { data, error } = await supabase
      .from("regular_sku")
      .select("regular_code, account_name, sku_code, srp, qty, uom, billing_amount, discount, total_amount")
      .eq("regular_code", regularCode);
    if (!error && data) return data;
    return [];
  };


  const fetchRemainingBudget = async () => {
    try {
      const pwpCode = record.source === "cover_pwp" ? record.cover_code : record.regularpwpcode;
      if (!pwpCode) return;
      const { data, error } = await supabase
        .from("amount_badget")
        .select("remainingbalance")
        .eq("pwp_code", pwpCode)
        .order("id", { ascending: false })
        .limit(1)
        .single();
      if (!error && data) setRemainingBudget(data.remainingbalance);
    } catch (err) {
      console.error(err);
      setRemainingBudget(null);
    }
  };

  // ===================== Helpers =====================
  const formatColumnName = (col) =>
    col
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace("Pwp", "PWP")
      .replace("Id", "ID");

  const formatCellValue = (value, col) => {
    if (value === null || value === undefined) return "-";
    if (col === "account_type" || col === "accountType") return convertCodesToNames(value);
    if (col === "distributor" || col === "distributor_code") return distributorMap[value] || value;
    if (col === "activity" || col === "activity_code") return activityMap[value] || value;
    if (col === "created_at") return new Date(value).toLocaleString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const convertCodesToNames = (value) => {
    if (!value) return "-";
    const codes = Array.isArray(value) ? value : String(value).split(",");
    const names = codes.map((c) => categoryMap[c.trim()] || c.trim());
    return names.join(", ");
  };

  const formatCurrency = (value) =>
    value !== null && value !== undefined
      ? `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      : "-";

  if (!record) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.75)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "24px", background: "#3b82f6", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{activeTab === "single" ? "📋 Record Details" : "💰 Budget History"}</h2>
          <button onClick={onClose} style={{ fontSize: "24px", background: "transparent", color: "white", border: "none", cursor: "pointer" }}>
            ✕
          </button>
        </div>

        {/* Export */}
        {activeTab === "single" && fullRecord && (
          <div style={{ padding: "16px", borderBottom: "1px solid #e5e7eb" }}>
            <button
              onClick={exportSingleRecordToExcel}
              style={{ padding: "10px 20px", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
            >
              📊 Export to Excel
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
          {loading ? (
            <p>Loading...</p>
          ) : error ? (
            <p style={{ color: "red" }}>{error}</p>
          ) : (
            <>
              {/* Record Info */}
              {/* Record Info */}
              <div
                style={{
                  display: "grid",
                  gap: "16px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                }}
              >
                {fullRecord &&
                  Object.entries(fullRecord)
                    .filter(
                      ([k, v]) =>
                        v !== null &&
                        v !== undefined &&
                        k !== "amountbadget" && // hide this key 
                        k !== "categoryCode" &&
                        k !== "sensitive_field" // you can add more keys here
                    )
                    .map(([key, value]) => (
                      <div
                        key={key}
                        style={{
                          padding: "12px",
                          background: "white",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            color: "#6b7280",
                          }}
                        >
                          {formatColumnName(key)}
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: "500" }}>
                          {formatCellValue(value, key)}
                        </div>
                      </div>
                    ))}
              </div>


              {/* Account Table */}
              {accountList
                .filter((a) => a.regularcode === (fullRecord?.regularpwpcode || fullRecord?.code))
                .length > 0 && (() => {
                  const filteredAccounts = accountList.filter(
                    (a) => a.regularcode === (fullRecord?.regularpwpcode || fullRecord?.code)
                  );
                  const totalBudget = filteredAccounts.reduce((sum, acc) => sum + Number(acc.budget || 0), 0);

                  return (
                    <div style={{ marginTop: "24px" }}>
                      <h3>💼 Accounts</h3>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ background: "#3b82f6", color: "white" }}>
                          <tr>
                            <th style={{ padding: "8px" }}>Account Name</th>
                            <th style={{ padding: "8px" }}>Budget</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAccounts.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: "8px" }}>{item.account_name}</td>
                              <td style={{ padding: "8px" }}>{formatCurrency(item.budget)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: "bold", background: "#f3f4f6" }}>
                            <td style={{ padding: "8px", textAlign: "right" }}>Total:</td>
                            <td style={{ padding: "8px" }}>{formatCurrency(totalBudget)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}


            </>
          )}
          {/* SKU Table */}
          {/* SKU Table */}
        {skuList
  .filter((s) => s.regular_code === (fullRecord?.regularpwpcode || fullRecord?.code))
  .length > 0 && (() => {
    const filteredSKUs = skuList.filter(
      (s) => s.regular_code === (fullRecord?.regularpwpcode || fullRecord?.code)
    );

    const totalBilling = filteredSKUs.reduce((sum, s) => sum + Number(s.billing_amount || 0), 0);
    const totalDiscount = filteredSKUs.reduce((sum, s) => sum + Number(s.discount || 0), 0);
    const totalAmount = filteredSKUs.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    return (
      <div style={{ marginTop: "24px" }}>
        <h3>🛒 SKUs</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#3b82f6", color: "white" }}>
            <tr>
              <th style={{ padding: "8px" }}>Account Name</th>
              <th style={{ padding: "8px" }}>SKU Code</th>
              <th style={{ padding: "8px" }}>SRP</th>
              <th style={{ padding: "8px" }}>Qty</th>
              <th style={{ padding: "8px" }}>UOM</th>
              <th style={{ padding: "8px" }}>Billing Amount</th>
              <th style={{ padding: "8px" }}>Discount</th>
              <th style={{ padding: "8px" }}>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredSKUs.map((item, idx) => (
              <tr key={idx}>
                <td style={{ padding: "8px" }}>{item.account_name}</td>
                <td style={{ padding: "8px" }}>{item.sku_code || "-"}</td>
                <td style={{ padding: "8px" }}>{formatCurrency(item.srp)}</td>
                <td style={{ padding: "8px" }}>{item.qty}</td>
                <td style={{ padding: "8px" }}>{item.uom}</td>
                <td style={{ padding: "8px" }}>{formatCurrency(item.billing_amount)}</td>
                <td style={{ padding: "8px" }}>{formatCurrency(item.discount)}</td>
                <td style={{ padding: "8px" }}>{formatCurrency(item.total_amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: "bold", background: "#f3f4f6" }}>
              <td colSpan={5} style={{ padding: "8px", textAlign: "right" }}>Total:</td>
              <td style={{ padding: "8px" }}>{formatCurrency(totalBilling)}</td>
              <td style={{ padding: "8px" }}>{formatCurrency(totalDiscount)}</td>
              <td style={{ padding: "8px" }}>{formatCurrency(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  })()}



        </div>
      </div>
    </div>
  );
};

export default RecordViewModal;
