import React, { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "../Component/BrandSelector.css";
import Swal from 'sweetalert2';

function Category_Listing() {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedCategoryCode, setSelectedCategoryCode] = useState(null);
    const [categoryListings, setCategoryListings] = useState([]);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formData, setFormData] = useState({ name: "", description: "", id: null });
    const [searchTerm, setSearchTerm] = useState("");

    // ✅ Fetch categories including 'code'
    useEffect(() => {
        const fetchCategories = async () => {
            const { data, error } = await supabase
                .from("category")
                .select("id, name, code")
                .order("name", { ascending: true });

            if (error) {
                console.error("Error fetching categories:", error);
                setCategories([]);
            } else {
                setCategories(data);
            }
        };

        fetchCategories();
    }, []);

    // ✅ Fetch listings by category_code
    const fetchListings = async (categoryCode) => {
        const { data, error } = await supabase
            .from("category_listing")
            .select("id, name, description")
            .eq("category_code", categoryCode);

        if (error) {
            console.error("Error fetching category listings:", error);
            setCategoryListings([]);
        } else {
            setCategoryListings(data.map(item => ({
                id: item.id.toString(),
                name: item.name,
                description: item.description || "",
            })));
        }
    };

    // ✅ Handle category selection
    const handleClick = async (category) => {
        setSelectedCategory(category.name);
        setSelectedCategoryCode(category.code);
        setShowFormModal(false);
        await fetchListings(category.code);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // ✅ Save listing using category_code
    const handleSave = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            return Swal.fire({
                icon: "warning",
                title: "Validation Error",
                text: "Name is required",
            });
        }

        if (!selectedCategoryCode) {
            return Swal.fire({
                icon: "warning",
                title: "No Category Selected",
                text: "Please select a category first.",
            });
        }

        try {
            if (formData.id) {
                // Update
                const { error } = await supabase
                    .from("category_listing")
                    .update({
                        name: formData.name,
                        description: formData.description || null,
                    })
                    .eq("id", formData.id);

                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from("category_listing")
                    .insert({
                        name: formData.name,
                        description: formData.description || null,
                        category_code: selectedCategoryCode,
                        parentname: selectedCategory,
                    });

                if (error) throw error;
            }

            Swal.fire({
                icon: "success",
                title: "Saved!",
                showConfirmButton: false,
                timer: 1500,
            });

            setShowFormModal(false);
            setFormData({ id: null, name: "", description: "" });
            await fetchListings(selectedCategoryCode);
        } catch (error) {
            console.error("Save failed:", error);
            Swal.fire({
                icon: "error",
                title: "Save Failed",
                text: error.message || "Unknown error",
            });
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: "Are you sure?",
            text: "You won't be able to undo this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete it!",
        });

        if (!result.isConfirmed) return;

        try {
            const { error } = await supabase
                .from("category_listing")
                .delete()
                .eq("id", id);

            if (error) throw error;

            setCategoryListings(prev => prev.filter(item => item.id !== id));

            Swal.fire({
                icon: "success",
                title: "Deleted!",
                text: "The listing has been deleted.",
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Delete failed:", error);
            Swal.fire({
                icon: "error",
                title: "Delete Failed",
                text: error.message || "An unexpected error occurred.",
            });
        }
    };

    const openFormModal = (existing = null) => {
        setFormData(existing || { name: "", description: "", id: null });
        setShowFormModal(true);
    };

    const closeModal = () => {
        setSelectedCategory(null);
        setSelectedCategoryCode(null);
        setShowFormModal(false);
        setCategoryListings([]);
    };

    const filteredListings = categoryListings.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="brand-selector-wrapper">
            <div className="brand-grid-container">
                <h1 className="brand-header">Category Listings</h1>
                <div className="brand-grid">
                    {categories.length === 0 ? (
                        <p>No categories found</p>
                    ) : (
                        categories.map(({ id, name, code }) => (
                            <button
                                key={id}
                                className={`brand-card ${selectedCategory === name ? "selected" : ""}`}
                                onClick={() => handleClick({ id, name, code })}
                            >
                                {name}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {selectedCategory ? (
                <div className="brand-modal rotate-in">
                    <button className="close-btn" onClick={closeModal}>&times;</button>
                    <h2>Listings under: {selectedCategory}</h2>

                    <button className="btn-add-new" onClick={() => openFormModal()}>
                        Add Listing
                    </button>

                    <input
                        type="text"
                        placeholder="Search listings..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                        style={{
                            padding: "10px",
                            marginBottom: "15px",
                            width: "100%",
                            borderRadius: "6px",
                            border: "1px solid #ccc",
                            fontSize: "16px"
                        }}
                    />

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
                                {filteredListings.length === 0 ? (
                                    <tr>
                                        <td colSpan={3}>No listings match your search.</td>
                                    </tr>
                                ) : (
                                    filteredListings.map((item) => (
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
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="activities-modal no-selection">
                    <h2>No category selected</h2>
                    <p>Please select a category to view listings.</p>
                </div>
            )}

            {showFormModal && (
                <div className="form-modal-overlay">
                    <div className="form-modal-content">
                        <h3>{formData.id ? "Edit Listing" : "Add Listing"}</h3>
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

export default Category_Listing;
