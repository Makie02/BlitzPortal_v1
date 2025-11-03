import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const RecordViewModal = ({ record, onClose, onRecordDeleted }) => {
  const [fullRecord, setFullRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const handleDownloadExcel = () => {
    if (!fullRecord) return;

    const workbook = XLSX.utils.book_new();

    // 1️⃣ Full Record Sheet (Horizontal)
    const recordFields = Object.keys(fullRecord).map(formatColumnName);
    const recordValues = Object.keys(fullRecord).map((key) =>
      formatCellValue(fullRecord[key], key)
    );

    const recordSheetData = [recordFields, recordValues]; // 2 rows: header + values
    const recordSheet = XLSX.utils.aoa_to_sheet(recordSheetData);
    XLSX.utils.book_append_sheet(workbook, recordSheet, "Record Details");

    // 2️⃣ Claims_Badorder Sheet (same as before)
    if (badorderData.length > 0) {
      const badorderSheetData = [
        ["Category", "Amount"],
        ...badorderData.map((row) => [row.category, Number(row.amount || 0)]),
        ["Total", badorderData.reduce((sum, r) => sum + Number(r.amount || 0), 0)],
      ];
      const badorderSheet = XLSX.utils.aoa_to_sheet(badorderSheetData);
      XLSX.utils.book_append_sheet(workbook, badorderSheet, "Claims_Badorder");
    }

    // 3️⃣ Claims_AccountBudgetTable Sheet (same as before)
    if (accountBudgetData.length > 0) {
      const accountSheetData = [
        ["Account Code", "Account Name", "Budget"],
        ...accountBudgetData.map((row) => [
          row.account_code,
          row.account_name,
          Number(row.budget || 0),
        ]),
        [
          "Total",
          "",
          accountBudgetData.reduce((sum, r) => sum + Number(r.budget || 0), 0),
        ],
      ];
      const accountSheet = XLSX.utils.aoa_to_sheet(accountSheetData);
      XLSX.utils.book_append_sheet(workbook, accountSheet, "Account_Budget");
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `Record_${fullRecord.id}.xlsx`);
  };


  // ✅ categorydetails map
  const [categoryMap, setCategoryMap] = useState({});
  // ✅ distributors map
  const [distributorMap, setDistributorMap] = useState({});
const [activityMap, setActivityMap] = useState({});
const [createFormMap, setCreateFormMap] = useState({});
  const [badorderData, setBadorderData] = useState([]);
  const [accountBudgetData, setAccountBudgetData] = useState([]);

useEffect(() => {
  if (record) {
    fetchFullRecord();
    fetchCategoryMap();
    fetchDistributorMap();
    fetchActivityMap();
    fetchCreateFormMap();
    fetchBadorderData();
    fetchAccountBudgetData();
  }
}, [record]);

  const fetchBadorderData = async () => {
    try {
      const { data, error } = await supabase
        .from("Claims_Badorder")
        .select("*")
        .eq("code_pwp", record.code_pwp || "");

      if (error) throw error;
      setBadorderData(data || []);
    } catch (err) {
      console.error("❌ Failed to fetch Claims_Badorder:", err.message);
    }
  };

  const fetchAccountBudgetData = async () => {
    try {
      const { data, error } = await supabase
        .from("Claims_AccountBudgetTable")
        .select("*")
        .eq("code_pwp", record.code_pwp || "");

      if (error) throw error;
      setAccountBudgetData(data || []);
    } catch (err) {
      console.error("❌ Failed to fetch Claims_AccountBudgetTable:", err.message);
    }
  };

  // ✅ Fetch categorydetails (with pagination up to 80k+)
  const fetchCategoryMap = async () => {
    try {
      let allData = [];
      let from = 0;
      const chunkSize = 5000;
      let moreData = true;

      while (moreData) {
        const { data, error } = await supabase
          .from("categorydetails")
          .select("code, name")
          .range(from, from + chunkSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
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

      setCategoryMap(map);
    } catch (err) {
      console.error("❌ Failed to fetch category details:", err.message);
    }
  };
const fetchActivityMap = async () => {
  try {
    const { data, error } = await supabase
      .from("activity") // ✅ your actual table name
      .select("code, name");

    if (error) throw error;

    const map = {};
    data.forEach((item) => {
      map[String(item.code).trim()] = item.name;
    });

    setActivityMap(map);
  } catch (err) {
    console.error("❌ Failed to fetch activity details:", err.message);
  }
};

const fetchCreateFormMap = async () => {
  try {
    const { data, error } = await supabase
      .from("Account_Users") // ✅ your actual table name
      .select("UserID, name");

    if (error) throw error;

    const map = {};
    data.forEach((item) => {
      map[String(item.UserID).trim()] = item.name;
    });

    setCreateFormMap(map);
  } catch (err) {
    console.error("❌ Failed to fetch createForm details:", err.message);
  }
};
  // ✅ Fetch distributors (with pagination)
  const fetchDistributorMap = async () => {
    try {
      let allData = [];
      let from = 0;
      const chunkSize = 5000;
      let moreData = true;

      while (moreData) {
        const { data, error } = await supabase
          .from("distributors")
          .select("id, code, name")
          .range(from, from + chunkSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += chunkSize;
        } else {
          moreData = false;
        }
      }

      const map = {};
      allData.forEach((item) => {
        map[String(item.id).trim()] = item.name;
        map[String(item.code).trim()] = item.name;
      });

      setDistributorMap(map);
    } catch (err) {
      console.error("❌ Failed to fetch distributors:", err.message);
    }
  };

  // ✅ Format cell values
  const formatCellValue = (value, colName) => {
    if (!value && value !== 0) return "-";

    // Convert account_types
    if (colName === "account_types") {
      let codes = [];

      if (Array.isArray(value)) {
        codes = value;
      } else if (typeof value === "string") {
        try {
          codes = JSON.parse(value);
        } catch {
          codes = value.split(",").map((c) => c.trim());
        }
      }
  

      const converted = codes.map((code) => {
        const strCode = String(code).trim();
        return categoryMap[strCode] || strCode;
      });

      return converted.length > 0 ? converted.join(", ") : "-";
    }
       if (colName === "activity") {
  const strCode = String(value).trim();
  return activityMap[strCode] || strCode;
}

// Convert createform code → createform name
if (colName === "createForm") {
  const strCode = String(value).trim();
  return createFormMap[strCode] || strCode;
}

    // Convert distributor/distributor_code
    if (colName === "distributor" || colName === "distributor_code") {
      const strCode = String(value).trim();
      return distributorMap[strCode] || strCode;
    }

    // Format date
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

  // ✅ Delete record
  const handleDeleteRecord = async (recordToDelete, tableName) => {
    try {
      setDeleting(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq("id", recordToDelete.id);

      if (deleteError) throw deleteError;

      window.location.reload();

      if (recordToDelete.id === record.id) {
        if (onRecordDeleted) onRecordDeleted(recordToDelete);
        onClose();
        return;
      }

      setDeleteConfirm(null);
    } catch (err) {
      setError(`Failed to delete record: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = (recordToDelete, tableName) => {
    setDeleteConfirm({ record: recordToDelete, tableName });
  };

  const cancelDelete = () => setDeleteConfirm(null);

  const formatColumnName = (colName) =>
    colName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace("Pwp", "PWP")
      .replace("Id", "ID");

  if (!record) return null;

  return (
    <div style={modalOverlay}>
      <div style={modalContainer}>
        {/* Header */}
        <div style={modalHeader}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: "25px", color: "#fff" }}>
              Record Details
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "14px" }}>
              ID: {record.id} -{" "}
              {record.source === "cover_pwp" ? "Cover PWP" : "Regular PWP"}
            </p>
          </div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        {/* Delete */}
        <div style={deleteBar}>
          {fullRecord && (
            <>
              <button
                onClick={handleDownloadExcel}
                style={{
                  backgroundColor: "#1976d2",
                  color: "#fff",
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "500",
                  marginRight: "12px",
                  transition: "all 0.2s ease-in-out",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1565c0"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#1976d2"}
              >
                📥 Download Excel
              </button>

              <button
                onClick={() => confirmDelete(fullRecord, record.source || "regular_pwp")}
                disabled={deleting}
                style={{
                  backgroundColor: deleting ? "#b0b0b0" : "#d32f2f",
                  color: "#fff",
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: "8px",
                  cursor: deleting ? "not-allowed" : "pointer",
                  fontWeight: "500",
                  transition: "all 0.2s ease-in-out",
                }}
                onMouseEnter={(e) => !deleting && (e.currentTarget.style.backgroundColor = "#c62828")}
                onMouseLeave={(e) => !deleting && (e.currentTarget.style.backgroundColor = "#d32f2f")}
              >
                {deleting ? "⏳ Deleting..." : "🗑️ Delete Record"}
              </button>
            </>
          )}

        </div>


        {/* Delete Confirm */}
        {deleteConfirm && (
          <div style={confirmOverlay}>
            <div style={confirmBox}>
              <h3 style={{ margin: "0 0 16px", color: "#d32f2f" }}>
                ⚠️ Confirm Delete
              </h3>
              <p style={{ margin: "0 0 24px", color: "#666" }}>
                Are you sure you want to delete this record?
                <br />
                <strong>ID: {deleteConfirm.record.id}</strong>
                <br />
                <em>This action cannot be undone.</em>
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button onClick={cancelDelete} disabled={deleting} style={cancelBtn}>
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteRecord(deleteConfirm.record, deleteConfirm.tableName)}
                  disabled={deleting}
                  style={deleteConfirmBtn}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Record Details */}
        <div style={detailsBox}>
          {loading ? (
            <p>Loading record details...</p>
          ) : error ? (
            <div style={{ textAlign: "center", color: "#d32f2f" }}>
              <p>{error}</p>
              <button onClick={fetchFullRecord} style={retryBtn}>Retry</button>
            </div>
          ) : (
            fullRecord && (
              <div style={gridBox}>
             {Object.entries(fullRecord)
  // filter out unwanted keys
  .filter(([key]) => 
    !["id", "category_codes", "notification"].includes(key.toLowerCase())
  )
  // filter out empty values
  .filter(([_, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && (value.trim() === "" || value.trim() === "[]")) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  })
  .map(([key, value]) => (
    <div key={key} style={gridItem}>
      <div style={colLabel}>{formatColumnName(key)}</div>
      <div style={colValue}>{formatCellValue(value, key)}</div>
    </div>
  ))}


              </div>
            )
          )}

          {/* ✅ Claims_Badorder Table */}
          {badorderData.length > 0 && (
            <div style={{ marginTop: "30px" }}>
              <h4 style={{ marginBottom: "10px", color: "#1565c0" }}>Claims Badorder</h4>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {badorderData.map((row) => (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.category}</td>
                        <td style={tdStyle}>{Number(row.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>

                  {/* ✅ Total Footer */}
                  <tfoot>
                    <tr>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: "bold",
                          textAlign: "right",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        Total:
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: "bold",
                          color: "#2e7d32",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        {badorderData
                          .reduce((sum, row) => sum + Number(row.amount || 0), 0)
                          .toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}


          {/* ✅ Claims_AccountBudgetTable */}
          {accountBudgetData.length > 0 && (
            <div style={{ marginTop: "30px" }}>
              <h4 style={{ marginBottom: "10px", color: "#1565c0" }}>
                Claims Account Budget Table
              </h4>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Account Code</th>
                      <th style={thStyle}>Account Name</th>
                      <th style={thStyle}>Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountBudgetData.map((row) => (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.account_code}</td>
                        <td style={tdStyle}>{row.account_name}</td>
                        <td style={tdStyle}>
                          {Number(row.budget).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* ✅ Table Footer for Total */}
                  <tfoot>
                    <tr>
                      <td colSpan="2" style={{ ...tdStyle, fontWeight: "bold", textAlign: "right" }}>
                        Total:
                      </td>
                      <td style={{ ...tdStyle, fontWeight: "bold", color: "#2e7d32" }}>
                        {accountBudgetData
                          .reduce((sum, row) => sum + Number(row.budget || 0), 0)
                          .toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}


        </div>

        {/* Footer */}
        <div style={footerBar}>
          <button onClick={onClose} style={closeFooterBtn}>Close</button>
        </div>
      </div>
    </div>
  );
};

// 💅 Inline styles
// 💅 Refined Styles (Modern Design)
const modalOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.55)",
  backdropFilter: "blur(4px)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const modalContainer = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  maxWidth: "880px",
  maxHeight: "90vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};

const modalHeader = {
  padding: "22px 30px",
  background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const closeBtn = {
  backgroundColor: "rgba(255,255,255,0.15)",
  color: "white",
  border: "none",
  borderRadius: "50%",
  width: "38px",
  height: "38px",
  fontSize: "22px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};
closeBtn[':hover'] = { backgroundColor: "rgba(255,255,255,0.3)" };

const deleteBar = {
  padding: "14px 28px",
  backgroundColor: "#f8f9fa",
  borderBottom: "1px solid #e5e5e5",
  display: "flex",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: "10px",
};

const baseButton = {
  padding: "10px 18px",
  border: "none",
  borderRadius: "8px",
  color: "white",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const deleteBtn = {
  ...baseButton,
  background: "linear-gradient(135deg, #d32f2f, #b71c1c)",
};
const downloadBtn = {
  ...baseButton,
  background: "linear-gradient(135deg, #1976d2, #0d47a1)",
};

const confirmOverlay = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "16px",
  zIndex: 10,
};

const confirmBox = {
  backgroundColor: "white",
  padding: "32px",
  borderRadius: "12px",
  boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
  maxWidth: "400px",
  textAlign: "center",
};

const cancelBtn = {
  ...baseButton,
  backgroundColor: "#757575",
};

const deleteConfirmBtn = {
  ...baseButton,
  background: "linear-gradient(135deg, #d32f2f, #b71c1c)",
};

const detailsBox = {
  flex: 1,
  overflowY: "auto",
  padding: "28px",
  backgroundColor: "#fafafa",
};

const retryBtn = {
  ...baseButton,
  background: "linear-gradient(135deg, #1976d2, #0d47a1)",
};

const gridBox = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const gridItem = {
  padding: "16px",
  backgroundColor: "white",
  borderRadius: "10px",
  border: "1px solid #e0e0e0",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
};
gridItem[':hover'] = {
  transform: "translateY(-2px)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
};

const colLabel = {
  fontSize: "12px",
  fontWeight: "700",
  color: "#616161",
  textTransform: "uppercase",
  marginBottom: "6px",
  letterSpacing: "0.5px",
};

const colValue = {
  fontSize: "14px",
  color: "#212121",
  wordBreak: "break-word",
  lineHeight: "1.4",
};

const footerBar = {
  padding: "16px 28px",
  backgroundColor: "#f1f1f1",
  borderTop: "1px solid #e0e0e0",
  display: "flex",
  justifyContent: "flex-end",
};

const closeFooterBtn = {
  ...baseButton,
  backgroundColor: "#757575",
};
const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  backgroundColor: "white",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
};

const thStyle = {
  padding: "10px 12px",
  backgroundColor: "#1976d2",
  color: "white",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: 600,
};

const tdStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid #e0e0e0",
  fontSize: "13px",
  color: "#333",
  verticalAlign: "top",
};


export default RecordViewModal;
