import React, { useState, useEffect } from "react";
import "./Activities.css";
import { FaEdit, FaClipboardList, FaChartBar, FaPercent } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import Swal from 'sweetalert2';

import { supabase } from "../supabaseClient";

const activityIcons = {
    "Sampling / Push Selling": <FaClipboardList />,
    "Tactical Display": <FaChartBar />,
    "Tactical Display (Sales)": <FaChartBar />,
    "Thematic & Catalog": <FaClipboardList />,
    "Trade Deal": <FaPercent />,
    "Trade Discount": <FaPercent />,
    "Volume Discount": <FaPercent />,
    "Marketing Support": <FaClipboardList />,
    "Move-Out": <FaChartBar />,
    "Opening Support": <FaClipboardList />,
    "Orientation": <FaClipboardList />,
    "POSM": <FaClipboardList />,
    "Product Highlight": <FaChartBar />,
    "Promo Discount": <FaPercent />,
    "Promo Rebates": <FaPercent />,
    "Rentals": <FaClipboardList />,
};

const useSupabase = true; // Set to false to use Firebase

const activityGroups = {
    Activities: [
        "Sampling / Push Selling",
        "Tactical Display",
        "Tactical Display (Sales)",
        "Thematic & Catalog",
        "Trade Deal",
        "Trade Discount",
        "Volume Discount",
        "Marketing Support",
        "Move-Out",
        "Opening Support",
        "Orientation",
        "POSM",
        "Product Highlight",
        "Promo Discount",
        "Promo Rebates",
        "Rentals",
    ],
};

function Activities() {
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [savedData, setSavedData] = useState([]);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: "", description: "" });
    const [isExpanded, setIsExpanded] = useState(false);

    // Fetch data depending on backend
 useEffect(() => {
    if (!selectedActivity) {
        setSavedData([]);
        return;
    }

    if (useSupabase) {
        // Supabase fetch
        async function fetchData() {
            const { data, error } = await supabase
                .from("maintenance_activities")
                .select("*")
                .eq("activity", selectedActivity)
                .order("id", { ascending: true });

            if (error) {
                console.error("Error fetching data:", error);
                setSavedData([]);
            } else {
                setSavedData(data);
            }
        }

        fetchData();
    } else {
        // No Firebase fallback, clear savedData or do nothing
        setSavedData([]);
    }
}, [selectedActivity]);


    const closeModal = () => {
        setSelectedActivity(null);
        setShowFormModal(false);
        setFormData({ id: null, name: "", description: "" });
    };

    const openFormModal = (item = null) => {
        if (item) setFormData(item);
        else setFormData({ id: null, name: "", description: "" });
        setShowFormModal(true);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };


const handleSave = async (e) => {
  e.preventDefault();

  if (!formData.name.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Name Required',
      text: 'Please enter a name before saving.',
    });
    return;
  }

  if (!selectedActivity) {
    Swal.fire({
      icon: 'warning',
      title: 'Activity Required',
      text: 'Please select an activity before saving.',
    });
    return;
  }

  try {
    if (useSupabase) {
      if (formData.id) {
        const { error } = await supabase
          .from("maintenance_activities")
          .update({
            name: formData.name,
            description: formData.description,
            activity: selectedActivity,
          })
          .eq("id", formData.id);

        if (error) throw error;

        await Swal.fire({
          icon: 'success',
          title: 'Updated',
          text: 'Entry updated successfully!',
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const { error } = await supabase.from("maintenance_activities").insert([
          {
            activity: selectedActivity,
            name: formData.name,
            description: formData.description,
          },
        ]);
        if (error) throw error;

        await Swal.fire({
          icon: 'success',
          title: 'Added',
          text: 'Entry added successfully!',
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Supabase Required',
        text: 'Supabase is required for saving data.',
      });
    }
  } catch (error) {
    console.error("Failed to save data:", error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'An error occurred while saving. Please try again.',
    });
  } finally {
    setShowFormModal(false);
  }
};




    // Delete function supporting both Supabase and Firebase
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
        if (useSupabase) {
            const { error } = await supabase
                .from("maintenance_activities")
                .delete()
                .eq("id", id);

            if (error) throw error;
            alert("Entry deleted (Supabase).");

            // Refresh data manually after delete
            const { data, error: fetchError } = await supabase
                .from("maintenance_activities")
                .select("*")
                .eq("activity", selectedActivity)
                .order("id", { ascending: true });

            if (fetchError) {
                console.error("Error fetching data:", fetchError);
                setSavedData([]);
            } else {
                setSavedData(data);
            }
        } else {
            alert("Supabase is required for deleting entries.");
        }
    } catch (error) {
        console.error("Failed to delete:", error);
        alert("Failed to delete entry.");
    }
};

    const currentActivityData = savedData || [];

    return (
        <div style={{ overflowX: "auto" }} className="activities-selector-wrapper">
            <div className="activities-grid-container">
                <h1 className="activities-header">Activities</h1>

                {Object.entries(activityGroups).map(([groupName, activities]) => (
                    <div key={groupName} className="activities-group">
                        <h2 className="group-title">{groupName}</h2>
                        <div className="activities-grid">
                            {activities.map((activity, idx) => (
                                <button
                                    key={idx}
                                    className={`activity-card ${selectedActivity === activity ? "selected" : ""
                                        }`}
                                    onClick={() => setSelectedActivity(activity)}
                                >
                                    <span className="activity-icon">
                                        {activityIcons[activity] || <FaClipboardList />}
                                    </span>
                                    <span>{activity}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {selectedActivity ? (
                <div
                    className="activities-modal rotate-in"
                    style={{
                        padding: "20px",
                        overflowX: "auto",
                        width: isExpanded ? "100vw" : "100vw",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        transition: "width 0.3s ease",
                    }}
                >
                    <button className="close-btn" onClick={closeModal}>
                        &times;
                    </button>
                    <h2>{selectedActivity}</h2>

                    <button className="btn-add-new" onClick={() => openFormModal()}>
                        Add New
                    </button>

                    {currentActivityData.length > 0 ? (
                        <div
                            style={{
                                maxHeight: "600px",
                                overflowY: "auto",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                            }}
                        >
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr>
                                        <th
                                            style={{
                                                position: "sticky",
                                                top: 0,
                                                backgroundColor: "#2575fc",
                                                color: "white",
                                                padding: "10px",
                                                textAlign: "left",
                                                zIndex: 2,
                                                boxShadow: "0 2px 2px -1px rgba(0,0,0,0.4)",
                                            }}
                                        >
                                            Name
                                        </th>
                                        <th
                                            style={{
                                                position: "sticky",
                                                top: 0,
                                                backgroundColor: "#2575fc",
                                                color: "white",
                                                padding: "10px",
                                                textAlign: "left",
                                                zIndex: 2,
                                                boxShadow: "0 2px 2px -1px rgba(0,0,0,0.4)",
                                            }}
                                        >
                                            Description
                                        </th>
                                        <th
                                            style={{
                                                position: "sticky",
                                                top: 0,
                                                backgroundColor: "#2575fc",
                                                color: "white",
                                                padding: "10px",
                                                textAlign: "left",
                                                zIndex: 2,
                                                boxShadow: "0 2px 2px -1px rgba(0,0,0,0.4)",
                                            }}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentActivityData.map((item) => (
                                        <tr key={item.id} style={{ borderTop: "1px solid #ddd" }}>
                                            <td style={{ padding: "10px" }}>{item.name}</td>
                                            <td style={{ padding: "10px" }}>{item.description}</td>
                                            <td style={{ padding: "10px" }}>
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
                                                        e.currentTarget.style.transform =
                                                            "scale(1.1) rotateX(10deg) rotateY(10deg)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 8px 15px rgba(0, 252, 34, 0.5)";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "scale(1) rotateX(0) rotateY(0)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 4px 6px rgba(0,0,0,0.2)";
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "scale(0.95) rotateX(5deg) rotateY(5deg)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 2px 4px rgba(0,0,0,0.3)";
                                                    }}
                                                    onMouseUp={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "scale(1.1) rotateX(10deg) rotateY(10deg)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 8px 15px rgba(0, 255, 128, 0.5)";
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
                                                        e.currentTarget.style.transform =
                                                            "scale(1.1) rotateX(10deg) rotateY(10deg)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 8px 15px rgba(211, 47, 47, 0.5)";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "scale(1) rotateX(0) rotateY(0)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 4px 6px rgba(0,0,0,0.2)";
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "scale(0.95) rotateX(5deg) rotateY(5deg)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 2px 4px rgba(0,0,0,0.3)";
                                                    }}
                                                    onMouseUp={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "scale(1.1) rotateX(10deg) rotateY(10deg)";
                                                        e.currentTarget.style.boxShadow =
                                                            "0 8px 15px rgba(211, 47, 47, 0.5)";
                                                    }}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} size="lg" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p>No data found.</p>
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
                        </div>
                    )}
                </div>
            ) : (
                <div
                    className="activities-modal no-selection"
                    style={{
                        padding: "20px",
                        overflowX: "auto",
                        width: isExpanded ? "100vw" : "100vw",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        transition: "width 0.3s ease",
                    }}
                >
                    <h2>No activity selected</h2>
                    <p>Please select an activity from the list.</p>
                </div>
            )}
        </div>
    );
}

export default Activities;
