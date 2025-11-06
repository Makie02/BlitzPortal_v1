import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// ✅ Styles (same design)
const containerStyle = { padding: "20px", maxWidth: 1500, margin: "0 auto", backgroundColor: "#fdfdfdff", borderRadius: "12px" };
const addButtonStyle = { marginBottom: "20px", padding: "10px 16px", backgroundColor: "#6387ebff", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" };
const tableWrapperStyle = { overflowX: "auto" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "600px" };
const thStyle = { padding: "12px", textAlign: "left", backgroundColor: "#0062ffff", color: "white" };
const tdStyle = { padding: "12px" };
const actionBtnStyle = { marginRight: "8px", padding: "6px 12px", cursor: "pointer", border: "none", borderRadius: "4px", color: "white", backgroundColor: "#007bff" };
const modalOverlayStyle = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "10px" };
const modalContentStyle = { backgroundColor: "white", padding: "24px", borderRadius: "8px", width: "100%", maxWidth: "400px", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" };
const inputStyle = { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", marginTop: "4px", fontSize: "14px", boxSizing: "border-box" };

export default function MotherAccount2() {
  const [records, setRecords] = useState([]);
  const [formData, setFormData] = useState({ id: null, code: "", name: "", status: true });
  const [showModal, setShowModal] = useState(false);

  // ✅ Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    const { data, error } = await supabase.from("MotherAccount2").select("*").order("id", { ascending: true });
    if (error) {
      console.error("Fetch error:", error.message);
    } else {
      setRecords(data);
    }
  };

  const generateNextCode = () => {
    if (records.length === 0) return "7001";
    const nums = records.map((r) => {
      const n = parseInt(r.code, 10);
      return isNaN(n) ? 6000 : n;
    });
    const maxNum = Math.max(...nums);
    return String(maxNum + 1);
  };

  const handleAdd = () => {
    setFormData({ id: null, code: generateNextCode(), name: "", status: true });
    setShowModal(true);
  };

  const handleEdit = (rec) => {
    setFormData({ id: rec.id, code: rec.code, name: rec.name, status: rec.status });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("MotherAccount2").delete().eq("id", id);
    if (error) console.error("Delete error:", error.message);
    fetchRecords();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.id) {
      await supabase.from("MotherAccount2").update({ name: formData.name, status: formData.status }).eq("id", formData.id);
    } else {
      await supabase.from("MotherAccount2").insert([{ code: formData.code, name: formData.name, status: formData.status }]);
    }
    setShowModal(false);
    fetchRecords();
  };

  const handleExportCSV = () => {
    const csvHeaders = ["ID", "CODE", "NAME", "STATUS", "CREATED DATE"];
    const csvRows = records.map((rec) => [rec.id, rec.code, rec.name, rec.status, rec.created_at]);
    const csvContent = [csvHeaders, ...csvRows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Group_accounts.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
      lines.shift();
      const newRecords = lines.map((line) => {
        const [id, code, name, status, created_at] = line.split(",").map((s) => s.replace(/"/g, "").trim());
        return { code, name, status: status.toLowerCase() === "true" };
      });
      const existingCodes = records.map((rec) => rec.code);
      const uniqueRecords = newRecords.filter((rec) => !existingCodes.includes(rec.code));
      if (uniqueRecords.length === 0) {
        alert("No new records to import. All codes already exist.");
        return;
      }
      const { error } = await supabase.from("mother_account").insert(uniqueRecords);
      if (error) {
        console.error("Import error:", error.message);
        alert("Import failed: " + error.message);
      } else {
        fetchRecords();
        alert("CSV imported successfully! Records added: " + uniqueRecords.length);
      }
    };
    reader.readAsText(file);
  };

  // ✅ Filtered and Paginated Records
  const filteredRecords = records.filter(
    (rec) =>
      rec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.code.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const currentRecords = filteredRecords.slice(startIndex, startIndex + recordsPerPage);

  return (
    <div style={containerStyle}>
      <h2>Mother Account 2</h2>
      <button style={addButtonStyle} onClick={handleAdd}>
        + Add Mother Account 2
      </button>

      {/* 🔍 Search Bar */}
      <input
        type="text"
        placeholder="Search by code or name..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setCurrentPage(1);
        }}
        style={{
          ...inputStyle,
          maxWidth: "300px",
          marginBottom: "15px",
          marginLeft: '80px'
        }}
      />


      <div style={{ marginBottom: "20px" }}>
        <button style={{ ...addButtonStyle, marginRight: "10px" }} onClick={handleExportCSV}>
          ⬇ Export CSV
        </button>

        <label style={{ ...addButtonStyle, backgroundColor: "#4caf50", display: "inline-block", cursor: "pointer" }}>
          ⬆ Import CSV
          <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: "none" }} />
        </label>
      </div>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>GROUP CODE</th>
              <th style={thStyle}> GROUP NAME</th>
              <th style={thStyle}>STATUS</th>
              <th style={thStyle}>CREATED DATE</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentRecords.map((rec) => (
              <tr key={rec.id}>
                <td style={tdStyle}>{rec.id}</td>
                <td style={tdStyle}>{rec.code}</td>
                <td style={tdStyle}>{rec.name}</td>
                <td style={tdStyle}>{rec.status ? "True" : "False"}</td>
                <td style={tdStyle}>{rec.created_at ? new Date(rec.created_at).toLocaleString() : ""}</td>
                <td style={tdStyle}>
                  <button style={actionBtnStyle} onClick={() => handleEdit(rec)}>Edit</button>
                  <button style={{ ...actionBtnStyle, backgroundColor: "red" }} onClick={() => handleDelete(rec.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 📄 Pagination Controls */}
      <div style={{ marginTop: "15px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          style={{ ...addButtonStyle, backgroundColor: "#007bff" }}
        >
          ◀ Prev
        </button>
        <span>Page {currentPage} of {totalPages || 1}</span>
        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          style={{ ...addButtonStyle, backgroundColor: "#007bff" }}
        >
          Next ▶
        </button>
      </div>

      {showModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{formData.id ? "Edit Group Account" : "Add Group Account"}</h3>
            <form onSubmit={handleSubmit}>
              <label>Code</label>
              <input style={inputStyle} type="text" value={formData.code} readOnly />
              <label>Name</label>
              <input
                style={inputStyle}
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <label>Status</label>
              <select
                style={inputStyle}
                value={formData.status ? "true" : "false"}
                onChange={(e) => setFormData({ ...formData, status: e.target.value === "true" })}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
              <button type="submit" style={{ ...actionBtnStyle, marginTop: "10px" }}>
                {formData.id ? "Update" : "Save"}
              </button>
              <button type="button" style={{ ...actionBtnStyle, backgroundColor: "gray", marginTop: "10px" }} onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
