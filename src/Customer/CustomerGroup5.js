import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";

// ====== STYLES (keep same design) ======
const containerStyle = { padding: '20px', maxWidth: 1500, margin: '0 auto', backgroundColor: '#fdfdfdff', borderRadius: '12px' };
const addButtonStyle = { marginBottom: '20px', padding: '10px 16px', backgroundColor: '#6387ebff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const tableWrapperStyle = { overflowX: 'auto' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: '600px' };
const thStyle = { padding: '12px', textAlign: 'left', backgroundColor: '#0062ffff', color: 'white' };
const tdStyle = { padding: '12px' };
const actionBtnStyle = { marginRight: '8px', padding: '6px 12px', cursor: 'pointer', border: 'none', borderRadius: '4px', color: 'white', backgroundColor: '#007bff' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '10px' };
const modalContentStyle = { backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' };
const inputStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px', fontSize: '14px', boxSizing: 'border-box' };
const searchWrapperStyle = { marginBottom: '12px', maxWidth: '300px' };
const searchInputStyle = { width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' };
const footerStyle = { marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' };
const paginationStyle = { display: 'flex', gap: '6px', flexWrap: 'wrap' };
const pageButtonStyle = { padding: '6px 12px', borderRadius: '4px', border: '1px solid #007bff', backgroundColor: 'white', color: '#007bff', cursor: 'pointer', minWidth: '32px', textAlign: 'center', fontWeight: '600', userSelect: 'none' };
const activePageButtonStyle = { ...pageButtonStyle, backgroundColor: '#007bff', color: 'white', cursor: 'default' };
const selectStyle = { padding: '6px 10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' };
// =======================================

// Auto-generate CODE with prefix KAS5000+
const generateNextCode = (records) => {
  if (!records || records.length === 0) return "5000";

  const nums = records.map(r => {
    const match = r.code?.match(/^KAS(\d+)$/);
    return match ? parseInt(match[1], 10) : parseInt(r.code, 10) || 5000;
  });

  const maxNum = Math.max(...nums);
  return String(maxNum + 1);
};

const CustomerGroup5 = () => {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ code: "", name: "", status: true });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    const { data, error } = await supabase.from("customer_group5").select("*").order("id", { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setRecords(data);
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      Swal.fire("Validation Error", "Name is required", "error");
      return;
    }
    if (editingId) {
      const { error } = await supabase.from("customer_group5").update(form).eq("id", editingId);
      if (error) {
        Swal.fire("Error", error.message, "error");
      } else {
        Swal.fire("Updated!", "Record updated successfully.", "success");
        fetchRecords();
        setShowModal(false);
      }
    } else {
      const newCode = generateNextCode(records);
      const { error } = await supabase.from("customer_group5").insert([{ ...form, code: newCode }]);
      if (error) {
        Swal.fire("Error", error.message, "error");
      } else {
        Swal.fire("Added!", "Record added successfully.", "success");
        fetchRecords();
        setShowModal(false);
      }
    }
  };

  const handleEdit = (record) => {
    setForm(record);
    setEditingId(record.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This record will be deleted",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });
    if (confirm.isConfirmed) {
      const { error } = await supabase.from("customer_group5").delete().eq("id", id);
      if (error) {
        Swal.fire("Error", error.message, "error");
      } else {
        Swal.fire("Deleted!", "Record deleted successfully.", "success");
        fetchRecords();
      }
    }
  };

  const filteredRecords = records.filter(
    r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedRecords = filteredRecords.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);

  return (
    <div style={containerStyle}>
      <h2>Customer Group 5</h2>
      <div style={searchWrapperStyle}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInputStyle}
        />
      </div>
      <button
        style={addButtonStyle}
        onClick={() => {
          setForm({ code: generateNextCode(records), name: "", status: true });
          setEditingId(null);
          setShowModal(true);
        }}
      >
        + Add New
      </button>
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>CODE</th>
              <th style={thStyle}>NAME</th>
              <th style={thStyle}>STATUS</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.map((r) => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.id}</td>
                <td style={tdStyle}>{r.code}</td>
                <td style={tdStyle}>{r.name}</td>
                <td style={tdStyle}>{r.status ? "True" : "False"}</td>
                <td style={tdStyle}>
                  <button style={actionBtnStyle} onClick={() => handleEdit(r)}>Edit</button>
                  <button
                    style={{ ...actionBtnStyle, backgroundColor: "red" }}
                    onClick={() => handleDelete(r.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {paginatedRecords.length === 0 && (
              <tr>
                <td style={tdStyle} colSpan="5">No records found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={footerStyle}>
        <div>
          Rows per page:{" "}
          <select value={rowsPerPage} onChange={(e) => setRowsPerPage(parseInt(e.target.value))} style={selectStyle}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>
        <div style={paginationStyle}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              style={num === page ? activePageButtonStyle : pageButtonStyle}
              onClick={() => setPage(num)}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {showModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>{editingId ? "Edit Record" : "Add New Record"}</h3>
            <label>Code</label>
            <input type="text" value={form.code} readOnly style={inputStyle} />
            <label>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
            />
            <label>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value === "true" })}
              style={inputStyle}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
            <div style={{ marginTop: "12px", textAlign: "right" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ ...actionBtnStyle, backgroundColor: "#6c757d" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{ ...actionBtnStyle, backgroundColor: "#28a745" }}
              >
                {editingId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerGroup5;
