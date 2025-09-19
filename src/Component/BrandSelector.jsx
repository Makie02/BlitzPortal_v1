import React, { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import "./BrandSelector.css"; // Keep your styles

function CategorySelector() {
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [selectedDistributorId, setSelectedDistributorId] = useState(null);
  const [categoryDetails, setCategoryDetails] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", id: null });
  const [distributorNames, setDistributorNames] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Load distributor names and IDs from Supabase
  useEffect(() => {
    let isMounted = true;

    const fetchDistributorNames = async () => {
      const { data, error } = await supabase
        .from("distributors")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching distributors:", error);
        if (isMounted) setDistributorNames([]);
      } else if (isMounted) {
        setDistributorNames(data);
      }
    };

    fetchDistributorNames();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter distributors based on search term
  const filteredDistributors = distributorNames.filter(({ name }) =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // When clicking a distributor, set name + id and fetch categories by id
  const handleClick = async (distributor) => {
    setSelectedDistributor(distributor.name);
    setSelectedDistributorId(distributor.id);
    setShowFormModal(false);

    const { data, error } = await supabase
      .from("categorydetails")
      .select("id, name, description")
      .eq("principal_id", distributor.id);

    if (error) {
      console.error("Error fetching category details:", error);
      setCategoryDetails([]);
    } else {
      const formatted = data.map((item) => ({
        id: item.id.toString(),
        name: item.name,
        description: item.description || "",
      }));
      setCategoryDetails(formatted);
    }
  };

  // Fetch categories (helper for after save)
  const fetchCategoryDetailsFromSupabase = async (distributorId) => {
    try {
      const { data, error } = await supabase
        .from("categorydetails")
        .select("id, name, description")
        .eq("principal_id", distributorId);

      if (error) throw error;

      return data.map((item) => ({
        id: item.id.toString(),
        name: item.name,
        description: item.description,
      }));
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      return [];
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Save category (add or update)
const handleSave = async (e) => {
  e.preventDefault();

  if (!formData.name.trim()) {
    Swal.fire({
      icon: "warning",
      title: "Validation Error",
      text: "Name is required",
    });
    return;
  }

  if (!selectedDistributorId) {
    Swal.fire({
      icon: "warning",
      title: "No Distributor Selected",
      text: "Please select a distributor first.",
    });
    return;
  }

  try {
    if (formData.id) {
      // === UPDATE ===
      const { error } = await supabase
        .from("categorydetails")
        .update({
          name: formData.name,
          description: formData.description || null,
        })
        .eq("id", formData.id);

      if (error) throw error;
    } else {
      // === INSERT ===
      // 🔢 Generate smart sequential code
      const { data: existingCodes, error: fetchError } = await supabase
        .from("categorydetails")
        .select("code")
        .like("code", "A%")
        .order("code", { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      let nextCode = "A00001";
      if (existingCodes.length > 0) {
        const lastCode = existingCodes[0].code; // e.g., A00057
        const numericPart = parseInt(lastCode.slice(1)) + 1; // 58
        nextCode = `A${numericPart.toString().padStart(5, "0")}`; // A00058
      }

      const { error } = await supabase
        .from("categorydetails")
        .insert({
          code: nextCode,
          name: formData.name,
          description: formData.description || null,
          principal_id: selectedDistributorId,
          parentname: selectedDistributor,
        });

      if (error) throw error;
    }

    // Refresh UI
    setShowFormModal(false);
    setFormData({ id: null, name: "", description: "" });

    const newDetails = await fetchCategoryDetailsFromSupabase(selectedDistributorId);
    setCategoryDetails(newDetails);

    Swal.fire({
      icon: "success",
      title: "Success",
      text: "Category saved successfully!",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Save failed:", error);
    Swal.fire({
      icon: "error",
      title: "Save Failed",
      text: error.message || "Unknown error",
    });
  }
};


  // Delete category with Swal confirmation
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Do you really want to delete this category?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from("categorydetails")
          .delete()
          .eq("id", id);

        if (error) throw error;

        setCategoryDetails((prev) => prev.filter((item) => item.id !== id));

        Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Category has been deleted.",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error("Delete failed:", error);
        Swal.fire({
          icon: "error",
          title: "Delete Failed",
          text: error.message || "Unknown error",
        });
      }
    }
  };

  // Open modal with existing data or empty for add
  const openFormModal = (existing = null) => {
    if (existing) {
      setFormData({ ...existing });
    } else {
      setFormData({ name: "", description: "", id: null });
    }
    setShowFormModal(true);
  };

  // Close modal and clear selection
  const closeModal = () => {
    setSelectedDistributor(null);
    setSelectedDistributorId(null);
    setShowFormModal(false);
    setCategoryDetails([]);
  };

  return (
    <div className="brand-selector-wrapper">
      <div className="brand-grid-container">
        <h1 className="brand-header">Accounts</h1>

        {/* Search bar */}
        <input
          type="text"
          placeholder="Search distributors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "15px",
            fontSize: "16px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
          aria-label="Search distributors"
        />

        <div className="brand-grid">
          {filteredDistributors.length === 0 ? (
            <p>No distributors found</p>
          ) : (
            filteredDistributors.map(({ id, name }) => (
              <button
                key={id}
                className={`brand-card ${selectedDistributor === name ? "selected" : ""}`}
                onClick={() => handleClick({ id, name })}
              >
                {name}
              </button>
            ))
          )}
        </div>
      </div>

      {selectedDistributor ? (
        <div className="brand-modal rotate-in">
          <button className="close-btn" onClick={closeModal}>
            &times;
          </button>
          <h2>Accounts: {selectedDistributor}</h2>

          <button className="btn-add-new" onClick={() => openFormModal()}>
            Add Category
          </button>

          <div className="brand-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categoryDetails.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No categories found</td>
                  </tr>
                ) : (
                  categoryDetails.map((item) => (
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
                          <FaEdit style={{ color: "orange", fontSize: "20px" }} />
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
                            e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 47, 47, 0.7)";
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
                            e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 0, 0, 0.7)";
                          }}
                        >
                          <FaTrash style={{ color: "red", fontSize: "20px" }} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {showFormModal && (
            <div className="DistriModal-overlay">
              <form className="DistriModal-content" onSubmit={handleSave}>
                <h3>{formData.id ? "Edit Category" : "Add Category"}</h3>

                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />

                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                />

                <div className="form-buttons">
                  <button type="submit" className="btn-save">
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowFormModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      ) : (
        <p>Please select a distributor to view categories.</p>
      )}
    </div>
  );
}

export default CategorySelector;
