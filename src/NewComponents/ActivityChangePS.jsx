import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import { Table, Button, Modal, Form } from "react-bootstrap";
import { FaPlus, FaEdit, FaTrash, FaBoxOpen, FaExclamationTriangle } from "react-icons/fa";

const ActivityChangePS = () => {
  const [activeTab, setActiveTab] = useState("supplies");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [labelInput, setLabelInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("activity_change_ps")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("❌ Error fetching items:", error);
      Swal.fire("Error", "Failed to load items.", "error");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = items
    .filter((item) => item.option_type === activeTab)
    .filter((item) => item.label.toLowerCase().includes(searchTerm.toLowerCase()));

  const openAddModal = () => {
    setEditingItem(null);
    setLabelInput("");
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setLabelInput(item.label);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!labelInput.trim()) {
      Swal.fire("Missing Input", "Please enter a label.", "warning");
      return;
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from("activity_change_ps")
          .update({ label: labelInput.trim() })
          .eq("id", editingItem.id);

        if (error) throw error;

        Swal.fire({ icon: "success", title: "Updated!", timer: 1200, showConfirmButton: false });
      } else {
        const { error } = await supabase.from("activity_change_ps").insert([
          { option_type: activeTab, label: labelInput.trim(), status: true },
        ]);

        if (error) throw error;

        Swal.fire({ icon: "success", title: "Added!", timer: 1200, showConfirmButton: false });
      }

      setShowModal(false);
      fetchItems();
    } catch (err) {
      console.error("❌ Save error:", err.message);
      Swal.fire("Error", err.message, "error");
    }
  };

  const toggleStatus = async (item) => {
    const { error } = await supabase
      .from("activity_change_ps")
      .update({ status: !item.status })
      .eq("id", item.id);

    if (error) {
      console.error("❌ Toggle status error:", error.message);
      Swal.fire("Error", error.message, "error");
    } else {
      fetchItems();
    }
  };

  const handleDelete = async (item) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Delete this item?",
      text: item.label,
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc3545",
    });

    if (!confirm.isConfirmed) return;

    const { error } = await supabase.from("activity_change_ps").delete().eq("id", item.id);

    if (error) {
      console.error("❌ Delete error:", error.message);
      Swal.fire("Error", error.message, "error");
    } else {
      Swal.fire({ icon: "success", title: "Deleted!", timer: 1000, showConfirmButton: false });
      fetchItems();
    }
  };

  const suppliesCount = items.filter((i) => i.option_type === "supplies").length;
  const penaltyCount = items.filter((i) => i.option_type === "penalty").length;

  return (
    <div style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1d5ea8 0%, #0d6efd 100%)",
          borderRadius: "14px",
          padding: "24px 28px",
          marginBottom: "24px",
          color: "white",
          boxShadow: "0 6px 16px rgba(13, 110, 253, 0.25)",
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 700, letterSpacing: "0.5px" }}>
          ⚙️ Activity Change — Penalties / Supplies
        </h3>
        <p style={{ margin: "6px 0 0", opacity: 0.85, fontSize: "14px" }}>
          Manage dropdown options used in the Regular Branch Budget List.
        </p>
      </div>

      {/* Pill Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <PillTab
          active={activeTab === "supplies"}
          onClick={() => { setActiveTab("supplies"); setSearchTerm(""); }}
          icon={<FaBoxOpen />}
          label="Supplies / M.E"
          count={suppliesCount}
          color="#0d6efd"
        />
        <PillTab
          active={activeTab === "penalty"}
          onClick={() => { setActiveTab("penalty"); setSearchTerm(""); }}
          icon={<FaExclamationTriangle />}
          label="Penalties"
          count={penaltyCount}
          color="#dc3545"
        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder={`Search ${activeTab === "supplies" ? "supplies" : "penalty"} items...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid #dcdcdc",
            fontSize: "14px",
            outline: "none",
          }}
        />
        <Button
          onClick={openAddModal}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderRadius: "10px",
            padding: "10px 18px",
            fontWeight: 600,
            border: "none",
            background: activeTab === "supplies" ? "#0d6efd" : "#dc3545",
          }}
        >
          <FaPlus size={13} /> Add {activeTab === "supplies" ? "Supplies" : "Penalty"} Item
        </Button>
      </div>

      {/* Card List */}
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>
            No {activeTab === "supplies" ? "supplies" : "penalty"} items found.
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: idx !== filteredItems.length - 1 ? "1px solid #f0f0f0" : "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fafbfc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <span
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: activeTab === "supplies" ? "#e7f1ff" : "#fdeaea",
                    color: activeTab === "supplies" ? "#0d6efd" : "#dc3545",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ fontSize: "15px", fontWeight: 500, color: "#222" }}>
                  {item.label}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={() => toggleStatus(item)}
                  style={{
                    border: "none",
                    borderRadius: "20px",
                    padding: "5px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "white",
                    background: item.status ? "#28a745" : "#adb5bd",
                    transition: "background 0.2s",
                  }}
                >
                  {item.status ? "Active" : "Inactive"}
                </button>

                <button
                  onClick={() => openEditModal(item)}
                  title="Edit"
                  style={{
                    border: "none",
                    background: "#f1f3f5",
                    borderRadius: "8px",
                    width: "34px",
                    height: "34px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#495057",
                  }}
                >
                  <FaEdit size={14} />
                </button>

                <button
                  onClick={() => handleDelete(item)}
                  title="Delete"
                  style={{
                    border: "none",
                    background: "#fdeaea",
                    borderRadius: "8px",
                    width: "34px",
                    height: "34px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#dc3545",
                  }}
                >
                  <FaTrash size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header
          closeButton
          style={{
            background: activeTab === "supplies" ? "#0d6efd" : "#dc3545",
            color: "white",
            border: "none",
          }}
        >
          <Modal.Title style={{ fontSize: "17px", fontWeight: 600 }}>
            {editingItem ? "Edit" : "Add"} {activeTab === "supplies" ? "Supplies / M.E" : "Penalty"} Item
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "24px" }}>
          <Form.Group>
            <Form.Label style={{ fontWeight: 600, fontSize: "13px", color: "#555" }}>
              Label
            </Form.Label>
            <Form.Control
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Enter label..."
              autoFocus
              style={{ padding: "10px 12px", borderRadius: "8px" }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ border: "none", padding: "0 24px 20px" }}>
          <Button variant="light" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            style={{
              background: activeTab === "supplies" ? "#0d6efd" : "#dc3545",
              border: "none",
            }}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// ✅ Pill-style tab button
const PillTab = ({ active, onClick, icon, label, count, color }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "10px 20px",
      borderRadius: "999px",
      border: active ? "none" : "1px solid #ddd",
      background: active ? color : "white",
      color: active ? "white" : "#555",
      fontWeight: 600,
      fontSize: "14px",
      cursor: "pointer",
      boxShadow: active ? `0 4px 10px ${color}55` : "none",
      transition: "all 0.2s ease",
    }}
  >
    {icon}
    {label}
    <span
      style={{
        background: active ? "rgba(255,255,255,0.25)" : "#f1f1f1",
        color: active ? "white" : "#777",
        borderRadius: "10px",
        padding: "1px 8px",
        fontSize: "12px",
      }}
    >
      {count}
    </span>
  </button>
);

export default ActivityChangePS;
