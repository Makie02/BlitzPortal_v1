import React, { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import "./BrandSelector.css";
import { rtdb } from "../Firebase";
import { ref, set, onValue, remove, update, get } from "firebase/database";
import { supabase } from "../supabaseClient";

function BrandSelector() {
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [brandDetails, setBrandDetails] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", id: null });
  const [isExpanded, setIsExpanded] = useState(false);
  const [brandNames, setBrandNames] = useState([]);

  // Load brand names from Firebase
 useEffect(() => {
  let isMounted = true;

  const fetchBrandNames = async () => {
    const { data, error } = await supabase
      .from("References")
      .select("name")
      .eq("reference_type", "Distributor");

    if (error) {
      console.error("Error fetching Distributor:", error);
      setBrandNames([]);
    } else if (isMounted) {
      const names = data.map((item) => item.name || item); // if `item` is just a string
      setBrandNames(names);
    }
  };

  fetchBrandNames();

  return () => {
    isMounted = false;
  };
}, []);


  // When a brand is clicked, load details from Supabase
const handleClick = async (brand) => {
  setSelectedBrand(brand);
  setShowFormModal(false);

  const { data, error } = await supabase
    .from("Branddetails")
    .select("id, name, description")
    .eq("principal_name", brand);

  if (error) {
    console.error("Error fetching brand details from Supabase:", error);
    setBrandDetails([]);
  } else {
    const formatted = data.map((item) => ({
      id: item.id.toString(),
      name: item.name,
      description: item.description || "",
    }));
    setBrandDetails(formatted);
  }
};


  const closeModal = () => {
    setSelectedBrand(null);
    setShowFormModal(false);
  };

  const openFormModal = (existing = null) => {
    if (existing) {
      setFormData({ ...existing });
    } else {
      setFormData({ name: selectedBrand || "", description: "", id: null });
    }
    setShowFormModal(true);
  };
  async function fetchBrandDetailsFromSupabase(principalName) {
    try {
      const { data, error } = await supabase
        .from("Branddetails")    // Make sure table name matches your DB exactly (case-sensitive)
        .select("*")
        .eq("principal_name", principalName);

      if (error) throw error;

      // Return array of brand detail objects
      return data.map(item => ({
        id: item.id.toString(),
        name: item.name,
        description: item.description,
      }));
    } catch (error) {
      console.error("Failed to fetch brand info from Supabase:", error);
      return [];  // Return empty array on failure
    }
  }
  async function updateBrandDetailInSupabase(id, updatedData) {
    try {
      const { data, error } = await supabase
        .from("Branddetails") // make sure table name matches exactly
        .update(updatedData)   // updatedData is an object like { name: "...", description: "..." }
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return data; // updated record
    } catch (error) {
      console.error("Failed to update brand info in Supabase:", error);
      throw error;
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

const handleSave = async (e) => {
  e.preventDefault();

  if (!formData.name.trim()) {
    alert("Name is required");
    return;
  }

  try {
    if (formData.id) {
      // ✅ UPDATE brand in Branddetails table
      const { error } = await supabase
        .from("Branddetails")
        .update({
          name: formData.name,
          description: formData.description,
        })
        .eq("id", formData.id);

      if (error) throw error;
    } else {
      // ✅ INSERT brand in Branddetails table
      const { error } = await supabase
        .from("Branddetails")
        .insert({
          name: formData.name,
          description: formData.description,
          principal_name: selectedBrand,
          parentname: selectedBrand, // optional if needed
        });

      if (error) throw error;
    }

    setShowFormModal(false);
    setFormData({ id: null, name: "", description: "" });
    handleClick(selectedBrand); // Refresh
  } catch (error) {
    console.error("Failed to save brand to Supabase:", error);
    alert("Save failed.");
  }
};




const handleDelete = async (id) => {
  if (!window.confirm("Are you sure you want to delete this brand?")) return;

  try {
    const { error } = await supabase
      .from("User_Brands")
      .delete()
      .eq("id", id);

    if (error) throw error;

    setBrandDetails((prev) => prev.filter((item) => item.id !== id));
  } catch (error) {
    console.error("Failed to delete brand from Supabase:", error);
    alert("Delete failed.");
  }
};


return (
  <div className="brand-selector-wrapper">
    <div className="brand-grid-container">
      <h1 className="brand-header">Brands</h1>
      <div className="brand-grid">
        {brandNames.map((brand) => (
          <button
            key={brand}
            className={`brand-card ${selectedBrand === brand ? "selected" : ""}`}
            onClick={() => handleClick(brand)}
          >
            {brand}
          </button>
        ))}
      </div>
    </div>

    {selectedBrand ? (
      <div className="brand-modal rotate-in" style={{ padding: "20px", width: "100%" }}>
        <button className="close-btn" onClick={closeModal}>
          &times;
        </button>
        <h2>{selectedBrand}</h2>

        <button className="btn-add-new" onClick={() => openFormModal()}>
          Add Info
        </button>

        <div className="brand-table-wrapper">
          <table>
            <thead>
              <tr>
                <th >Name</th>
                <th>Description</th>
                <th >Actions</th>
              </tr>
            </thead>
            <tbody>
              {brandDetails.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.description}</td>
                  <td>

                    <button
                      onClick={() => openFormModal(item)}
                      aria-label={`Edit ${item.name}`}
                      title="Edit"
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        padding: "8px",
                        color: "#d32f2f",
                        transition: "transform 0.3s ease, box-shadow 0.3s ease",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
                        borderRadius: "8px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: "8px",
                        outline: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                        e.currentTarget.style.boxShadow = "0 8px 15px rgba(0, 252, 34, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1) rotateX(0) rotateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = "scale(0.95) rotateX(5deg) rotateY(5deg)";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                        e.currentTarget.style.boxShadow = "0 8px 15px rgba(0, 255, 128, 0.5)";
                      }}
                    >
                      <FaEdit style={{ color: 'orange', fontSize: '20px' }} />
                    </button>


                    <button
                      onClick={() => handleDelete(item.id)}
                      aria-label={`Delete ${item.name}`}
                      title="Delete"
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        padding: "8px",
                        color: "#d32f2f",
                        transition: "transform 0.3s ease, box-shadow 0.3s ease",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
                        borderRadius: "8px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: "8px",
                        outline: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                        e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 47, 47, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1) rotateX(0) rotateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = "scale(0.95) rotateX(5deg) rotateY(5deg)";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                        e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 47, 47, 0.5)";
                      }}
                    >
                      <FaTrash style={{ fontSize: '20px' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      <div className="activities-modal no-selection">
        <h2>No brand selected</h2>
        <p>Please select a brand from the list.</p>
      </div>
    )}

    {showFormModal && (
      <div className="form-modal-overlay">
        <div className="form-modal-content">
          <h3>{formData.id ? "Edit Brand Info" : "Add Brand Info"}</h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
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
);
}

export default BrandSelector;
