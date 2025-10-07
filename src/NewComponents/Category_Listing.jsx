import React, { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";

function Category_Listing() {
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedCategoryCode, setSelectedCategoryCode] = useState(null);
    const [categoryListings, setCategoryListings] = useState([]);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formData, setFormData] = useState({
        sku_code: null,
        name: "",
        description: "",
        pack: "",
        casePrice: "",
    });
    const [searchTerm, setSearchTerm] = useState("");

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            const { data, error } = await supabase
                .from("category")
                .select("*")
                .order("name", { ascending: true });
            if (error) console.error(error);
            else setCategories(data);
        };
        fetchCategories();
    }, []);

    // Fetch listings for selected category
    const fetchListings = async (categoryCode) => {
        const { data, error } = await supabase
            .from("category_listing")
            .select("*")
            .eq("category_code", categoryCode)
            .order("name", { ascending: true });
        if (error) console.error(error);
        else
            setCategoryListings(
                data.map((item) => ({
                    ...item,
                    casePrice: item.case,
                }))
            );
    };

    const handleCategoryClick = (category) => {
        setSelectedCategory(category.name);
        setSelectedCategoryCode(category.code);
        setShowFormModal(false);
        fetchListings(category.code);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return Swal.fire("Warning", "Name is required", "warning");
        if (!selectedCategoryCode) return Swal.fire("Warning", "Select a category first", "warning");

        try {
            if (formData.sku_code) {
                const { error } = await supabase
                    .from("category_listing")
                    .update({
                        name: formData.name,
                        description: formData.description || null,
                        pack: formData.pack || null,
                        case: formData.casePrice || null,
                    })
                    .eq("sku_code", formData.sku_code);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("category_listing")
                    .insert([
                        {
                            name: formData.name,
                            description: formData.description || null,
                            category_code: selectedCategoryCode,
                            parentname: selectedCategory,
                            pack: formData.pack || null,
                            case: formData.casePrice || null,
                        },
                    ]);
                if (error) throw error;
            }
            Swal.fire("Success", "Saved successfully!", "success");
            setFormData({ sku_code: null, name: "", description: "", pack: "", casePrice: "" });
            setShowFormModal(false);
            fetchListings(selectedCategoryCode);
        } catch (error) {
            console.error(error);
            Swal.fire("Error", error.message, "error");
        }
    };

    const handleDelete = async (sku_code) => {
        const result = await Swal.fire({
            title: "Are you sure?",
            text: "You can't undo this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete!",
        });
        if (!result.isConfirmed) return;

        try {
            const { error } = await supabase.from("category_listing").delete().eq("sku_code", sku_code);
            if (error) throw error;
            setCategoryListings((prev) => prev.filter((item) => item.sku_code !== sku_code));
            Swal.fire("Deleted!", "Listing deleted.", "success");
        } catch (error) {
            console.error(error);
            Swal.fire("Error", error.message, "error");
        }
    };

    const openFormModal = (item = null) => {
        if (item) {
            setFormData({
                sku_code: item.sku_code,
                name: item.name,
                description: item.description || "",
                pack: item.pack || "",
                casePrice: item.casePrice || "",
            });
        } else {
            setFormData({ sku_code: null, name: "", description: "", pack: "", casePrice: "" });
        }
        setShowFormModal(true);
    };

    const handleBack = () => {
        setSelectedCategory(null);
        setSelectedCategoryCode(null);
        setCategoryListings([]);
        setSearchTerm("");
    };

    const filteredListings = categoryListings.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ padding: 20, fontFamily: "Arial" }}>
            {!selectedCategory && (
                <>
                    <h1 style={{ textAlign: "center", marginBottom: 30, color: "#0087c5" }}>Categories</h1>
                    <div style={cardContainer}>
                        {categories.map((category) => (
                            <div
                                key={category.id}
                                style={cardStyle}
                                onClick={() => handleCategoryClick(category)}
                            >
                                <div style={cardHeader}>
                                    <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>{category.name}</h3>
                                </div>
                                <div style={cardBody}>
                                    <p style={{ margin: 0 }}>Code: <strong>{category.code}</strong></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {selectedCategory && (
                <div style={tabPanel}>
                    <button style={btnBack} onClick={handleBack}>
                        ← Back to Categories
                    </button>
                    <h2>Listings under {selectedCategory}</h2>
                    <button style={btnAdd} onClick={() => openFormModal()}>
                        + Add Listing
                    </button>

                    <input
                        type="text"
                        placeholder="Search listings..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={searchInputStyle}
                    />

                    <div style={{ ...responsiveTableWrapper, maxHeight: "480px", overflowY: "auto" }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Name</th>
                                    <th style={thStyle}>Description</th>
                                    <th style={thStyle}>Pack</th>
                                    <th style={thStyle}>Case</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredListings.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: "center", padding: 10 }}>
                                            No listings found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredListings.map((item) => (
                                        <tr key={item.sku_code} style={trResponsive}>
                                            <td style={tdStyle}>{item.name}</td>
                                            <td style={tdStyle}>{item.description}</td>
                                            <td style={tdStyle}>{item.pack}</td>
                                            <td style={tdStyle}>{item.casePrice}</td>
                                            <td style={tdStyle}>
                                                <button onClick={() => openFormModal(item)} style={editButtonStyle}>
                                                    <FaEdit style={{ color: "orange", fontSize: "20px" }} />
                                                </button>
                                                <button onClick={() => handleDelete(item.sku_code)} style={deleteButtonStyle}>
                                                    <FaTrash style={{ fontSize: "20px" }} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            )}

            {/* Form Modal */}
            {showFormModal && (
                <div style={modalOverlay}>
                    <div style={modalContent}>
                        <h3>{formData.sku_code ? "Edit Listing" : "Add Listing"}</h3>
                        <button style={closeBtn} onClick={() => setShowFormModal(false)}>
                            &times;
                        </button>
                        <form onSubmit={handleSave} style={{ marginTop: 20 }}>

                            <div style={{ marginBottom: 12 }}>
                                <label style={labelStyle} htmlFor="name">Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Enter Name"
                                    style={inputStyle}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: 12 }}>
                                <label style={labelStyle} htmlFor="description">Description</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Enter Description"
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ marginBottom: 12 }}>
                                <label style={labelStyle} htmlFor="pack">Pack Price</label>
                                <input
                                    type="number"
                                    id="pack"
                                    name="pack"
                                    value={formData.pack}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    style={inputStyle}
                                    step="0.01"
                                />
                            </div>

                            <div style={{ marginBottom: 12 }}>
                                <label style={labelStyle} htmlFor="casePrice">Case Price</label>
                                <input
                                    type="number"
                                    id="casePrice"
                                    name="casePrice"
                                    value={formData.casePrice}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    style={inputStyle}
                                    step="0.01"
                                />
                            </div>

                            <button type="submit" style={btnSave}>Save</button>
                        </form>
                    </div>
                </div>
            )}



        </div>
    );
}

export default Category_Listing;

// --- Styles --- (same as MotherAccountPage)
// Container
// Container
const cardContainer = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)", // exactly 3 columns
    gap: "20px",
    justifyContent: "center",
};

// Card
const cardStyle = {
    width: "80%", // take full width of grid cell
    borderRadius: 12,
    background: "#f9f9f9",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
    overflow: "hidden",
};


const cardHeader = { background: "linear-gradient(135deg, #0087c5, #00b0ff)", padding: 15, textAlign: "center" };
const cardBody = { padding: 15, textAlign: "center" };
const tabPanel = { marginTop: 20, padding: 15, border: "1px solid #ccc", borderRadius: 8, background: "#fff", overflowX: "auto" };
const btnBack = { padding: "6px 12px", background: "#555", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", marginBottom: 10 };
const btnAdd = { padding: "6px 12px", background: "#0087c5", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", marginBottom: 10 };
const searchInputStyle = { width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ccc" };
const responsiveTableWrapper = { width: "100%", overflowX: "auto" };
const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: 500 };
const thStyle = { padding: 10, textAlign: "left", background: "#0087c5", color: "#fff", fontSize: 14 };
const tdStyle = { padding: 10, borderBottom: "1px solid #ddd", fontSize: 13 };
const trResponsive = { background: "#fafafa" };
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" };
const modalContent = { background: "#fff", padding: 20, borderRadius: 8, width: 400, position: "relative" };
const closeBtn = { position: "absolute", top: 10, right: 10, fontSize: 20, background: "transparent", border: "none", cursor: "pointer" };
const inputStyle = { width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc", marginBottom: 10 };
const btnSave = { padding: "6px 12px", background: "#28a745", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" };

// --- Add label style ---
const labelStyle = { display: "block", marginBottom: 4, fontWeight: 500, color: "#333" };
const buttonBaseStyle = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "6px 10px",
    marginLeft: 8,
    borderRadius: 6,
};

const editButtonStyle = {
    ...buttonBaseStyle,
    color: "orange",
};

const deleteButtonStyle = {
    ...buttonBaseStyle,
    color: "#d32f2f",
};
