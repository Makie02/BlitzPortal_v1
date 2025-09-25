import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const RecordViewModal = ({ record, onClose, onRecordDeleted }) => {
  const [fullRecord, setFullRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ✅ categorydetails map
  const [categoryMap, setCategoryMap] = useState({});
  // ✅ distributors map
  const [distributorMap, setDistributorMap] = useState({});

  useEffect(() => {
    if (record) {
      fetchFullRecord();
      fetchCategoryMap();
      fetchDistributorMap();
    }
  }, [record]);

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
            <button
              onClick={() => confirmDelete(fullRecord, record.source || "regular_pwp")}
              disabled={deleting}
              style={deleteBtn}
            >
              {deleting ? "⏳ Deleting..." : "🗑️ Delete Record"}
            </button>
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
                {Object.entries(fullRecord).map(([key, value]) => (
                  <div key={key} style={gridItem}>
                    <div style={colLabel}>{formatColumnName(key)}</div>
                    <div style={colValue}>{formatCellValue(value, key)}</div>
                  </div>
                ))}
              </div>
            )
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
const modalOverlay = { position:"fixed",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" };
const modalContainer = { backgroundColor:"white",borderRadius:"12px",maxWidth:"800px",maxHeight:"90vh",width:"100%",display:"flex",flexDirection:"column",boxShadow:"0 10px 40px rgba(0,0,0,0.3)" };
const modalHeader = { padding:"24px 30px",backgroundColor:"#1976d2",color:"white",borderRadius:"12px 12px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center" };
const closeBtn = { backgroundColor:"rgba(255,255,255,0.2)",color:"white",border:"none",borderRadius:"50%",width:"40px",height:"40px",cursor:"pointer",fontSize:"18px",display:"flex",alignItems:"center",justifyContent:"center" };
const deleteBar = { padding:"16px 30px",backgroundColor:"#f5f5f5",borderBottom:"1px solid #e0e0e0",display:"flex",justifyContent:"flex-end" };
const deleteBtn = { padding:"8px 16px",backgroundColor:"#d32f2f",color:"white",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"14px",fontWeight:"500" };
const confirmOverlay = { position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"12px",zIndex:10 };
const confirmBox = { backgroundColor:"white",padding:"30px",borderRadius:"12px",maxWidth:"400px",textAlign:"center" };
const cancelBtn = { padding:"10px 20px",backgroundColor:"#6c757d",color:"white",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"14px" };
const deleteConfirmBtn = { padding:"10px 20px",backgroundColor:"#d32f2f",color:"white",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"14px" };
const detailsBox = { flex:1,overflow:"auto",padding:"30px" };
const retryBtn = { padding:"8px 16px",backgroundColor:"#1976d2",color:"white",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"14px" };
const gridBox = { display:"grid",gap:"20px",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))" };
const gridItem = { padding:"16px",backgroundColor:"#f8f9fa",borderRadius:"8px",border:"1px solid #e0e0e0" };
const colLabel = { fontSize:"12px",fontWeight:"600",color:"#666",textTransform:"uppercase",marginBottom:"8px" };
const colValue = { fontSize:"14px",color:"#333",wordBreak:"break-word",whiteSpace:"normal" };
const footerBar = { padding:"20px 30px",backgroundColor:"#f5f5f5",borderTop:"1px solid #e0e0e0",borderRadius:"0 0 12px 12px",display:"flex",justifyContent:"flex-end" };
const closeFooterBtn = { padding:"10px 20px",backgroundColor:"#6c757d",color:"white",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"14px",fontWeight:"500" };

export default RecordViewModal;
