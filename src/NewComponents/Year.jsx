import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from "sweetalert2";
import { supabase } from "../supabaseClient";

const Year = () => {
  const [years, setYears] = useState([]);
  const [newYear, setNewYear] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch all years from database
  const fetchYears = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("budget_years")
        .select("*")
        .order("year", { ascending: true });

      if (error) {
        console.error("❌ Supabase Error:", error);
        throw error;
      }

      setYears(data || []);
      console.log("✅ Fetched years:", data);
    } catch (err) {
      console.error("❌ Error fetching years:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to fetch years.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();

    // Real-time subscription
    const subscription = supabase
      .channel("budget_years_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_years",
        },
        (payload) => {
          console.log("📡 Budget years changed:", payload);
          fetchYears();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Add new year - FIXED VERSION
  const handleAddYear = async (e) => {
    e.preventDefault();

    const yearValue = parseInt(newYear);

    if (!yearValue || yearValue < 2020 || yearValue > 2100) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Year",
        text: "Please enter a valid year between 2020 and 2100.",
      });
      return;
    }

    // Check if year already exists
    const exists = years.find((y) => y.year === yearValue);
    if (exists) {
      Swal.fire({
        icon: "warning",
        title: "Year Already Exists",
        text: `Year ${yearValue} is already in the list.`,
      });
      return;
    }

    try {
      console.log("🚀 Attempting to insert year:", yearValue);
      
      // FIXED: Remove created_at, let database handle it
      const { data, error } = await supabase
        .from("budget_years")
        .insert([{
          year: yearValue,
          is_active: true
        }])
        .select(); // Add select to return inserted data

      if (error) {
        console.error("❌ Supabase Insert Error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        throw error;
      }

      console.log("✅ Insert Success! Data:", data);

      Swal.fire({
        icon: "success",
        title: "Success! 🎉",
        text: `Year ${yearValue} has been added!`,
        timer: 1500,
        showConfirmButton: false,
      });

      setNewYear("");
      fetchYears(); // Refresh the list
    } catch (err) {
      console.error("❌ FULL ERROR:", err);
      console.error("Error Message:", err.message);
      console.error("Error Code:", err.code);
      console.error("Error Details:", err.details);
      console.error("Error Hint:", err.hint);
      
      Swal.fire({
        icon: "error",
        title: "Failed to Add Year 😢",
        html: `
          <div style="text-align: left; font-family: monospace;">
            <p><strong>Error Message:</strong></p>
            <p style="color: red; font-size: 12px; background: #ffe6e6; padding: 10px; border-radius: 4px;">
              ${err.message || "Unknown error"}
            </p>
            ${err.code ? `<p><strong>Error Code:</strong> ${err.code}</p>` : ''}
            ${err.hint ? `<p><strong>Hint:</strong> ${err.hint}</p>` : ''}
            <hr>
            <p style="font-size: 11px;"><strong>🔍 Troubleshooting Checklist:</strong></p>
            <ul style="font-size: 11px; text-align: left;">
              <li>✅ Table exists: <code>budget_years</code></li>
              <li>✅ RLS (Row Level Security) policies configured</li>
              <li>✅ User is authenticated</li>
              <li>✅ Check browser console (F12) for full error</li>
            </ul>
            <hr>
            <p style="font-size: 10px; color: #666;">
              <strong>Quick Fix SQL (Run in Supabase SQL Editor):</strong><br>
              <code style="display: block; background: #f5f5f5; padding: 8px; margin-top: 5px;">
                ALTER TABLE budget_years ENABLE ROW LEVEL SECURITY;<br>
                CREATE POLICY "Enable all for authenticated users"<br>
                ON budget_years FOR ALL TO authenticated<br>
                USING (true) WITH CHECK (true);
              </code>
            </p>
          </div>
        `,
        width: 700,
        confirmButtonText: 'OK, I\'ll check'
      });
    }
  };

  // Toggle year active status - FIXED VERSION
  const handleToggleActive = async (id, currentStatus) => {
    try {
      console.log("🔄 Toggling year:", id, "Current status:", currentStatus);
      
      const { data, error } = await supabase
        .from("budget_years")
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString() // Manual update
        })
        .eq("id", id)
        .select();

      if (error) {
        console.error("❌ Update Error:", error);
        throw error;
      }

      console.log("✅ Update Success:", data);

      Swal.fire({
        icon: "success",
        title: "Updated! ✅",
        text: `Year status has been ${!currentStatus ? "activated" : "deactivated"}.`,
        timer: 1500,
        showConfirmButton: false,
      });
      
      fetchYears(); // Refresh
    } catch (err) {
      console.error("❌ Error updating year:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to update year status.",
      });
    }
  };

  // Delete year - FIXED VERSION
  const handleDeleteYear = async (id, year) => {
    const result = await Swal.fire({
      title: "Are you sure? 🤔",
      text: `Delete year ${year}? This action cannot be undone!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, keep it"
    });

    if (!result.isConfirmed) return;

    try {
      console.log("🗑️ Attempting to delete year:", year);
      
      // Check if year is being used in cover_pwp
      const { data: usageData, error: usageError } = await supabase
        .from("cover_pwp")
        .select("cover_code")
        .eq("budget_year", year);

      // Ignore if table doesn't exist
      if (usageError && usageError.code !== 'PGRST116') {
        console.error("❌ Usage check error:", usageError);
        throw usageError;
      }

      if (usageData && usageData.length > 0) {
        Swal.fire({
          icon: "error",
          title: "Cannot Delete ❌",
          text: `Year ${year} is being used by ${usageData.length} budget(s). Please remove those budgets first.`,
        });
        return;
      }

      const { error } = await supabase
        .from("budget_years")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("❌ Delete Error:", error);
        throw error;
      }

      console.log("✅ Delete Success!");

      Swal.fire({
        icon: "success",
        title: "Deleted! 🗑️",
        text: `Year ${year} has been deleted.`,
        timer: 1500,
        showConfirmButton: false,
      });
      
      fetchYears(); // Refresh
    } catch (err) {
      console.error("❌ Error deleting year:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to delete year.",
      });
    }
  };

  return (
    <div style={{ padding: "30px", minHeight: "90vh" }} className="container">
      <div className="row mb-4">
        <div className="col-12">
          <div
            className="card p-4 shadow-sm"
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px",
              color: "white",
            }}
          >
            <h3
              className="mb-0"
              style={{
                fontWeight: "700",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              📅 Budget Year Management
            </h3>
          </div>
        </div>
      </div>

      {/* Add New Year Form */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <h5 className="card-title mb-3">Add New Budget Year</h5>
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label">
                Year <span style={{ color: "red" }}>*</span>
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g., 2026"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddYear(e);
                  }
                }}
                min="2020"
                max="2100"
              />
            </div>
            <div className="col-md-4">
              <button 
                onClick={handleAddYear}
                className="btn btn-primary"
              >
                <i className="bi bi-plus-circle"></i> Add Year
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Years List */}
      <div className="card shadow-sm">
        <div className="card-body">
          <h5 className="card-title mb-3">Available Budget Years</h5>

          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted">Loading years...</p>
            </div>
          ) : years.length === 0 ? (
            <div className="alert alert-info">
              ℹ️ No budget years found. Add one above to get started.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover table-bordered">
                <thead className="table-primary">
                  <tr>
                    <th style={{ width: "15%" }}>Year</th>
                    <th style={{ width: "15%" }}>Status</th>
                    <th style={{ width: "25%" }}>Created Date</th>
                    <th style={{ width: "20%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((yearItem) => (
                    <tr key={yearItem.id}>
                      <td>
                        <strong style={{ fontSize: "18px" }}>
                          {yearItem.year}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            yearItem.is_active
                              ? "bg-success"
                              : "bg-secondary"
                          }`}
                          style={{ fontSize: "13px", padding: "6px 12px" }}
                        >
                          {yearItem.is_active ? "✅ Active" : "⭕ Inactive"}
                        </span>
                      </td>
                      <td>
                        {yearItem.created_at
                          ? new Date(yearItem.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${
                            yearItem.is_active
                              ? "btn-warning"
                              : "btn-success"
                          } me-2`}
                          onClick={() =>
                            handleToggleActive(yearItem.id, yearItem.is_active)
                          }
                          title={
                            yearItem.is_active
                              ? "Deactivate Year"
                              : "Activate Year"
                          }
                        >
                          <i
                            className={`bi ${
                              yearItem.is_active
                                ? "bi-toggle-on"
                                : "bi-toggle-off"
                            }`}
                          ></i>{" "}
                          {yearItem.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() =>
                            handleDeleteYear(yearItem.id, yearItem.year)
                          }
                          title="Delete Year"
                        >
                          <i className="bi bi-trash"></i> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="card mt-4 border-info">
        <div className="card-body">
          <h6 className="card-title">
            <i className="bi bi-info-circle text-info"></i> Information
          </h6>
          <ul className="mb-0">
            <li>Add years dynamically to enable budget creation for future periods</li>
            <li>Active years will appear in the budget creation dropdown</li>
            <li>Years with existing budgets cannot be deleted</li>
            <li>Deactivate years to hide them from selection without deleting</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Year;