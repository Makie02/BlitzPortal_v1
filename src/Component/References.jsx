import React, { useState, useEffect } from "react";
import "./References.css";
import { FaEdit, FaTrash } from "react-icons/fa";
import Swal from "sweetalert2";
import {
  FaUser, FaTasks, FaTags, FaCreditCard, FaBuilding,
  FaMoneyBillAlt, FaSitemap, FaHome, FaBriefcase,
  FaCheckCircle, FaChartPie, FaUsers, FaBook, FaBalanceScale,
  FaRulerCombined, FaUserShield, FaPassport, FaStar,FaUserTie
} from "react-icons/fa";

import { supabase } from "../supabaseClient";
const referenceItems = [
  "AccountType", "GroupAccount", "Customer", "CustomerGroup", "Distributor","Activity", "BrandDetail", "ChargeTo", "Company", "CostDetail",
  "Department", "HomeText", "Position", "ResultOfActivity", "SalesDivision",
  "SalesGroup", "UnitOfMeasurement", "UserRole",  "Promoted-SKU/s" // <-- Added here
];


const iconMap = {
  GroupAccount: <FaUser />,
  Activity: <FaTasks />,
  BrandDetail: <FaTags />,
  ChargeTo: <FaCreditCard />,
  Company: <FaBuilding />,
  CostDetail: <FaMoneyBillAlt />,
  Department: <FaSitemap />,
  HomeText: <FaHome />,
  Position: <FaBriefcase />,
  ResultOfActivity: <FaCheckCircle />,
  SalesDivision: <FaChartPie />,
  SalesGroup: <FaUsers />,
  AccountType: <FaBook />,
  UnitOfMeasurement: <FaRulerCombined />,
  UserRole: <FaUserShield />,
  VisaType: <FaPassport />,
  Brands: <FaPassport />,
  Customer: <FaUser />,
  CustomerGroup: <FaUsers />,
  "Promoted-SKU/s": <FaStar />,
  Distributor: <FaUserTie />, 

};

function References() {
  const [selectedRef, setSelectedRef] = useState(null);
  const [savedData, setSavedData] = useState({});
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: "", description: "" });
  const [accountParentId, setAccountParentId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const supabaseRefsSet = new Set(referenceItems);
  const sanitize = s => s.trim().toLowerCase().replace(/\s+/g, "_");

  const [loading, setLoading] = useState(false);
  const handleClick = async (refName, id = null, name = null) => {
    setSelectedRef(refName);
    setShowFormModal(false);
    setFormData({ id: null, name: "", description: "" });
    setAccountParentId(null);
    setSelectedAccountName("");
    setLoading(true);

    try {
      let data = [];

      if (refName === "GroupAccount") {
        if (id && name) {
          // Drill down: show child GroupAccounts by parent_id = name
          const { data: groupData, error } = await supabase
            .from("References")
            .select("*")
            .eq("reference_type", "GroupAccount")
            .eq("parent_id", name);

          if (error) throw error;

          data = groupData.map(item => ({
            id: `sb_${item.id}`,
            name: item.name,
            description: item.description,
            parent_id: item.parent_id || ""
          }));

          setAccountParentId(id);
          setSelectedAccountName(name);
        } else {
          // Top-level GroupAccount click: show AccountType entries
          const { data: accountTypes, error } = await supabase
            .from("References")
            .select("*")
            .eq("parentName", "AccountType");

          if (error) throw error;

          data = accountTypes.map(item => ({
            id: `sb_${item.id}`,
            name: item.name,
            description: item.description,
            parent_id: item.parent_id || ""
          }));

          setAccountParentId(null);
          setSelectedAccountName("");
        }
      } else if (refName === "CustomerGroup") {
        if (id && name) {
          // Drill down: show child CustomerGroups by parent_id = name
          const { data: groupData, error } = await supabase
            .from("References")
            .select("*")
            .eq("reference_type", "CustomerGroup")
            .eq("parent_id", name);

          if (error) throw error;

          data = groupData.map(item => ({
            id: `sb_${item.id}`,
            name: item.name,
            description: item.description,
            parent_id: item.parent_id || ""
          }));

          setAccountParentId(id);
          setSelectedAccountName(name);
        } else {
          // Top-level CustomerGroup click: show Customer entries
          const { data: customers, error } = await supabase
            .from("References")
            .select("*")
            .eq("parentName", "Customer");

          if (error) throw error;

          data = customers.map(item => ({
            id: `sb_${item.id}`,
            name: item.name,
            description: item.description,
            parent_id: item.parent_id || ""
          }));

          setAccountParentId(null);
          setSelectedAccountName("");
        }
      } else {
        // Other references
        const { data: refData, error } = await supabase
          .from("References")
          .select("*")
          .eq("parentName", refName);

        if (error) throw error;

        data = refData.map(item => ({
          id: `sb_${item.id}`,
          name: item.name,
          description: item.description,
          parent_id: item.parent_id || ""
        }));

        setAccountParentId(null);
        setSelectedAccountName("");
      }

      setSavedData(prev => ({ ...prev, [refName]: data }));
    } catch (e) {
      console.error(e);
      setSavedData(prev => ({ ...prev, [refName]: [] }));
    } finally {
      setLoading(false);
    }
  };


  const loadGroupChildren = async (parentId, parentName, groupType) => {
    setAccountParentId(parentId);
    setSelectedAccountName(parentName);
    setFormData({ id: null, name: "", description: "" });
    setLoading(true);

    try {
      const { data: sbData, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", groupType)
        .eq("parent_id", parentName);

      if (error) throw error;

      const formattedData = sbData.map(item => ({
        id: `sb_${item.id}`,
        name: item.name,
        description: item.description,
        parent_id: item.parent_id || ""
      }));

      setSavedData(prev => ({
        ...prev,
        [groupType]: formattedData
      }));
    } catch (e) {
      console.error(`Error loading nested ${groupType}:`, e);
      setSavedData(prev => ({ ...prev, [groupType]: [] }));
    } finally {
      setLoading(false);
    }
  };


  const loadAccountTypeData = async (parentId, parentName) => {
    setAccountParentId(parentId);
    setSelectedAccountName(parentName);
    setFormData({ id: null, name: "", description: "" });
    setLoading(true);

    try {
      console.log("Fetching GroupAccount children of parentName:", parentName);

      const { data: sbData, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "GroupAccount")
        .eq("parent_id", parentName);  // Filter by parent's name, not id

      if (error) throw error;

      console.log("Loaded child items:", sbData);

      const formattedData = sbData.map(item => ({
        id: `sb_${item.id}`,
        name: item.name,
        description: item.description,
        parent_id: item.parent_id || ""
      }));

      setSavedData(prev => ({
        ...prev,
        GroupAccount: formattedData
      }));
    } catch (e) {
      console.error("Error loading nested GroupAccounts:", e);
      setSavedData(prev => ({ ...prev, GroupAccount: [] }));
    } finally {
      setLoading(false);
    }
  };



  const openFormModal = item => {
    setFormData(item ? item : { id: null, name: "", description: "" });
    setShowFormModal(true);
  };
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
  e.preventDefault();

  if (!formData.name.trim()) {
    Swal.fire("Missing Field", "Name is required", "warning");
    return;
  }

  if (!selectedRef) {
    Swal.fire("Missing Field", "Select a reference", "warning");
    return;
  }

  setLoading(true);

  try {
    const payload = {
      reference_type: selectedRef,
      name: formData.name.trim(),
      description: formData.description.trim(),
      parentName: selectedRef,
      parent_id: ["GroupAccount", "CustomerGroup"].includes(selectedRef) ? selectedAccountName : null,
    };

    if (formData.id?.startsWith("sb_")) {
      // UPDATE
      const { error } = await supabase
        .from("References")
        .update(payload)
        .eq("id", formData.id.replace("sb_", ""));
      if (error) throw error;
    } else {
      // INSERT — strip any possible id
      const { id, ...insertPayload } = payload;
      const { error } = await supabase
        .from("References")
        .insert(insertPayload);
      if (error) throw error;
    }

    Swal.fire("Success", "Reference saved successfully.", "success");
    setShowFormModal(false);
    setFormData({ id: null, name: "", description: "" });

    if (selectedRef === "GroupAccount" && accountParentId) {
      await loadAccountTypeData(accountParentId, selectedAccountName);
    } else {
      await handleClick(selectedRef);
    }
  } catch (err) {
    console.error("Error saving to Supabase:", err);
    Swal.fire("Error", err.message || "Failed to save reference", "error");
  } finally {
    setLoading(false);
  }
};



  const handleDelete = async (id) => {
    setLoading(true);
    try {
      if (id.startsWith("sb_")) {
        const { error } = await supabase
          .from("References")
          .delete()
          .eq("id", id.replace("sb_", ""));

        if (error) throw error;

        Swal.fire("Deleted", "Reference deleted successfully.", "success");
      } else {
        Swal.fire("Error", "Invalid Supabase ID format.", "error");
        return;
      }

      // Refresh data after deletion
      if (selectedRef === "GroupAccount" && accountParentId) {
        await loadAccountTypeData(accountParentId, selectedAccountName);
      } else {
        await handleClick(selectedRef);
      }
    } catch (e) {
      console.error("Delete failed:", e);
      Swal.fire("Error", e.message || "Delete failed", "error");
    } finally {
      setLoading(false);
    }
  };




  const closeModal = () => {
    setSelectedRef(null);
    setShowFormModal(false);
    setFormData({ id: null, name: "", description: "" });
    setAccountParentId(null);
  };
  const [selectedAccountName, setSelectedAccountName] = useState("");

  const currentData = savedData[selectedRef] || [];

  return (
    <div className="reference-selector-wrapper">
      <div className="reference-grid-container">
        <h1 className="reference-header">References</h1>
        <div className="reference-grid">
          {referenceItems.map((ref, idx) => {
            // Rename for display only
            let displayName = ref;
            if (ref === "AccountType") displayName = "Account";
            else if (ref === "GroupAccount") displayName = "AccountGroup";

            return (
              <button
                key={idx}
                className="reference-card"
                onClick={() => handleClick(ref)}
              >
                {iconMap[ref] && <span className="icon" style={{ marginRight: "8px" }}>{iconMap[ref]}</span>}
                <span>{ref.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
              </button>

            );
          })}

        </div>
      </div>

      {selectedRef ? (
        <div className="reference-modal rotate-in">
          <button className="close-btn" onClick={closeModal} aria-label="Close modal">
            &times;
          </button>
          <h2>
            {selectedRef === "AccountType" ? "Account" : selectedRef === "GroupAccount" ? "AccountGroup" : selectedRef}
            {selectedRef === "GroupAccount" && accountParentId && selectedAccountName && (
              <span style={{ fontWeight: "normal", fontSize: "0.9em", color: "#666", marginLeft: "8px" }}>
                — {selectedAccountName}
              </span>
            )}
          </h2>


          {(selectedRef === "GroupAccount" || selectedRef === "CustomerGroup") && !accountParentId ? (
            <div>
              <h3>Select {selectedRef === "GroupAccount" ? "an Account" : "a Customer"}</h3>
              <ul className="reference-list" style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px",
                padding: 0,
                listStyle: "none",
                margin: "16px 0"
              }}>
                {currentData.map(({ id, name }) => (
                  <li key={id}>
                    <button
                      style={styles.accountItemButton}
                      onClick={() => loadGroupChildren(id.replace("sb_", ""), name, selectedRef)}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = "scale(1.02)";
                        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {(selectedRef === "GroupAccount" || selectedRef === "CustomerGroup") && accountParentId && (
                <button
                  style={styles.back}
                  onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                  onClick={async () => {
                    setAccountParentId(null);
                    setSelectedAccountName("");
                    setLoading(true);
                    await handleClick(selectedRef);
                    setLoading(false);
                  }}
                >
                  ← Back to {selectedRef === "GroupAccount" ? "Account List" : "Customer List"}
                </button>
              )}



              <button
                style={styles.addNew}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onClick={() => openFormModal()}
              >
                Add New
              </button>


              {(savedData[selectedRef] || []).length > 0 ? (
                <table className="reference-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedData[selectedRef].map(({ id, name, description }) => (
                      <tr key={id}>
                        <td>{name}</td>
                        <td>{description}</td>
                        <td>
                          <button
                            style={styles.edit}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                            onClick={() => openFormModal({ id, name, description })}
                          >
                            <FaEdit />
                          </button>

                          <button
                            style={styles.delete}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                            onClick={() => handleDelete(id)}
                          >
                            <FaTrash />
                          </button>

                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No data found.</p>
              )}
            </>
          )}

          {showFormModal && (
            <div className="form-modal-overlay">
              <div className="form-modal-content">
                <h3>{formData.id ? "Edit Entry" : "Add New Entry"}</h3>
                <form onSubmit={handleSave}>
                  <div className="form-group">
                    <label>
                      Name <br />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter Name"
                        required
                      />
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      Description <br />
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Enter Description"
                      />
                    </label>
                  </div>
                  <div className="form-buttons">
                    <button type="submit" className="btn-save">Save</button>
                    <button type="button" className="btn-cancel" onClick={() => setShowFormModal(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="reference-modal no-selection">
          <h2>No reference selected</h2>
          <p>Please select an item from the list.</p>
        </div>
      )}
    </div>
  );
}
const baseButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 16px",
  margin: "8px",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "transform 0.3s ease, box-shadow 0.3s ease",
};

const styles = {
  addNew: {
    ...baseButtonStyle,
    backgroundColor: "#4caf50",
    color: "white",
    boxShadow: "0 4px 6px rgba(0, 128, 0, 0.2)",
  },
  back: {
    ...baseButtonStyle,
    backgroundColor: "#2196f3",
    color: "white",
    boxShadow: "0 4px 6px rgba(33, 150, 243, 0.2)",
  },
  edit: {
    ...baseButtonStyle,
    backgroundColor: "#ff9800",
    color: "white",
    boxShadow: "0 4px 6px rgba(255, 152, 0, 0.2)",
  },
  delete: {
    ...baseButtonStyle,
    backgroundColor: "#f44336",
    color: "white",
    boxShadow: "0 4px 6px rgba(244, 67, 54, 0.2)",
  },
  accountItemButton: {
    ...baseButtonStyle,
    backgroundColor: "#eeeeee",
    color: "#333",
    width: "100%",
    justifyContent: "flex-start",
    textAlign: "left",
    padding: "10px 16px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    margin: "6px 0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  }
};

export default References;
