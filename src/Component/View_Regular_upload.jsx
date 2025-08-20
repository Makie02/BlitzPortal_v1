import React, { useEffect, useState } from "react";
import { ref, get, update } from "firebase/database";
import { rtdb } from "../Firebase";
import Swal from "sweetalert2";
import { supabase } from "../supabaseClient";

function View_Regular_upload({ selectedVisa, setCurrentView }) {
  const [formData, setFormData] = useState({});
  const [costDetailsRows, setCostDetailsRows] = useState([]);
  const [costDetailsTotals, setCostDetailsTotals] = useState(null);
  const [volumePlanRows, setVolumePlanRows] = useState([]);
  const [volumePlanTotals, setVolumePlanTotals] = useState(null);
  const [costKeyUsed, setCostKeyUsed] = useState(null);
  const [volumeKeyUsed, setVolumeKeyUsed] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const visaCode = selectedVisa?.visaCode;
const visaType = "RegularUpload";

  // Capitalize first letter utility
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const fetchRelatedData = async () => {
    try {
      const baseTable = "RegularUpload";
      const table = "RegularUpload";
      const costTable = "Regular_Visa_CostDetails"; // fixed
      const volumeTable = "Regular_Visa_VolumePlan"; // fixed

      // Fetch main visa record
      const { data: visaData, error: visaError } = await supabase
        .from(baseTable)
        .select("*")
        .eq("visaCode", visaCode)
        .single();

      if (visaError || !visaData) {
        console.error("Visa not found or error fetching main data:", visaError);
        setFormData({});
        setCostDetailsRows([]);
        setCostDetailsTotals(null);
        setVolumePlanRows([]);
        setVolumePlanTotals(null);
        return;
      }

      setFormData(visaData);

      // Fetch CostDetails from fixed table
      const { data: costData, error: costError } = await supabase
        .from(costTable)
        .select("*")
        .eq("visaCode", visaCode)
        .single();

      if (costError || !costData) {
        console.warn("No cost details found:", costError);
        setCostKeyUsed(null);
        setCostDetailsRows([]);
        setCostDetailsTotals(null);
      } else {
        setCostKeyUsed(costData.id);
        setCostDetailsRows(Array.isArray(costData.rows) ? costData.rows : []);
        setCostDetailsTotals({
          totalQuantity: costData.totalQuantity,
          totalCostSum: costData.totalCostSum,
          costToSales: costData.costToSales,
          remarks: costData.remarks,
        });
      }

      // Fetch VolumePlan from fixed table
      const { data: volumeData, error: volumeError } = await supabase
        .from(volumeTable)
        .select("*")
        .eq("visaCode", visaCode)
        .single();

      if (volumeError || !volumeData) {
        console.warn("No volume plan found:", volumeError);
        setVolumeKeyUsed(null);
        setVolumePlanRows([]);
        setVolumePlanTotals(null);
      } else {
        setVolumeKeyUsed(volumeData.id);
        setVolumePlanRows(Array.isArray(volumeData.rows) ? volumeData.rows : []);
        setVolumePlanTotals({
          totalListPrice: volumeData.totalListPrice,
          totalNonPromoAvgSales: volumeData.totalNonPromoAvgSales,
          totalNonPromoAvgSalesAmount: volumeData.totalNonPromoAvgSalesAmount,
          totalProjectedAvgSales: volumeData.totalProjectedAvgSales,
          totalProjectedAvgSalesAmount: volumeData.totalProjectedAvgSalesAmount,
          avgIncreasePercent: volumeData.avgIncreasePercent,
        });
      }
    } catch (error) {
      console.error("Unexpected error fetching related data:", error);
      setFormData({});
      setCostDetailsRows([]);
      setCostDetailsTotals(null);
      setVolumePlanRows([]);
      setVolumePlanTotals(null);
    }
  };

  useEffect(() => {
    fetchRelatedData();
  }, [visaCode, visaType]);





  const [approvalHistory, setApprovalHistory] = useState([]);
  const [loadingApprovalHistory, setLoadingApprovalHistory] = useState(false);

  // Helper function to color code approval responses
  const getResponseColor = (response) => {
    if (!response) return "white";
    switch (response.toLowerCase()) {
      case "approved":
        return "#d4edda"; // light green
      case "declined":
        return "#f8d7da"; // light red
      case "pending":
        return "#fff3cd"; // light yellow
      default:
        return "white";
    }
  };

  // Fetch approval history
  const fetchApprovalHistory = async () => {
    if (!visaCode) return;
    setLoadingApprovalHistory(true);
    try {
      const { data, error } = await supabase
        .from("Approval_History")
        .select("*")
        .eq("BabyVisaId", visaCode)
        .order("DateResponded", { ascending: false });

      if (error) {
        console.error("Error fetching approval history:", error);
        setApprovalHistory([]);
      } else {
        setApprovalHistory(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching approval history:", err);
      setApprovalHistory([]);
    } finally {
      setLoadingApprovalHistory(false);
    }
  };

  useEffect(() => {
    fetchApprovalHistory();
  }, [visaCode]);
  // Handle input change in form fields for editable general info
  const handleInputChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Filter keys excluding CostDetails_ and VolumePlan_
  // Also exclude the specific structure { yes: { "V2025-102": "V2025-102" } }
  const filteredKeys = Object.entries(formData || {}).filter(([key, value]) => {
    if (key.startsWith("CostDetails_") || key.startsWith("VolumePlan_")) return false;

    // Exclude exactly { yes: { "V2025-102": "V2025-102" } }
    if (
      typeof value === "object" &&
      value !== null &&
      Object.keys(value).length === 1 &&
      value.yes &&
      typeof value.yes === "object" &&
      Object.entries(value.yes).length === 1
    ) {
      const [[codeKey, codeVal]] = Object.entries(value.yes);
      if (codeKey === "V2025-102" && codeVal === "V2025-102") {
        return false;
      }
    }
    return true;
  });

  // Save updated formData back to Firebase
  const handleSave = async () => {
    if (!visaCode) return;
    setSaving(true);
    setSaveError(null);

    try {
      const table = `${visaType}_Visa`; // Use dynamic table name

      // Construct update object from filtered keys
      const updateObj = {};
      filteredKeys.forEach(([key]) => {
        updateObj[key] = formData[key];
      });

      const { error } = await supabase
        .from(table)
        .update(updateObj)
        .eq("visaCode", visaCode); // Match on visaCode

      if (error) {
        throw error;
      }

      await Swal.fire({
        icon: "success",
        title: "Saved!",
        text: "Changes saved successfully!",
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });

      // --- Log RecentActivity ---
      try {
        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
        const userId = currentUser?.UserID || "unknown";

        // Fetch IP and geo info
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipRes.json();

        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const geo = await geoRes.json();

        const activityLog = {
          userId: userId,
          device: navigator.userAgent || 'Unknown Device',
          location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
          ip,
          time: new Date().toISOString(),
          action: `Updated visa (${visaCode}) in table ${table}`,
        };

        const { error: activityError } = await supabase
          .from('RecentActivity')
          .insert(activityLog);

        if (activityError) {
          console.warn('Failed to log visa update activity:', activityError.message);
        }
      } catch (logError) {
        console.warn('Error logging visa update activity:', logError.message);
      }
    } catch (error) {
      console.error("Save error:", error);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to save changes. Please try again.",
      });

      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };



  // Input component: either textarea or input depending on multiline or length
  const renderInputField = (key, value, isDisabled = false) => {
    // 🔒 Hide specific fields
    if (["Notification", "CreatedForm"].includes(key)) {
      return null;
    }

    // 📅 Format "createdat" field
    if (key.toLowerCase() === "createdat" && value) {
      try {
        const formattedDate = new Date(value).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        return (
          <input
            type="text"
            disabled
            value={formattedDate}
            style={{
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#f0f0f0",
              color: "#333",
              fontSize: "0.9rem",
            }}
          />
        );
      } catch {
        // fallback if date is invalid
        value = String(value);
      }
    }

    // 📦 Custom display for coverVisaCode
    if (key === "coverVisaCode" && typeof value === "object" && value !== null) {
      const hasYes = value.yes && typeof value.yes === "object";
      const hasNo = value.no && typeof value.no === "object";

      if (hasYes) {
        const yesEntries = Object.entries(value.yes);
        return (
          <div
            style={{
              padding: "8px",
              fontFamily: "monospace",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: "#f9f9f9",
              whiteSpace: "pre-wrap",
            }}
          >
            {yesEntries.map(([k, v]) => `${k}: ${v}`).join("\n")}
          </div>
        );
      }

      if (hasNo) {
        return (
          <div
            style={{
              padding: "8px",
              fontFamily: "monospace",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: "#f9f9f9",
            }}
          >
            NO
          </div>
        );
      }
    }

    // 🧠 Format other fields
    if (typeof value === "object" && value !== null) {
      try {
        value = JSON.stringify(value, null, 2);
      } catch {
        value = "";
      }
    } else if (typeof value !== "string") {
      value = String(value);
    }

    const isMultiline = value.includes("\n") || value.length > 40;

    return isMultiline ? (
      <textarea
        disabled={isDisabled}
        value={value}
        onChange={(e) => handleInputChange(key, e.target.value)}
        rows={4}
        style={{
          resize: "vertical",
          padding: "8px",
          fontFamily: "monospace",
          borderRadius: "4px",
          border: "1px solid #ccc",
          backgroundColor: "#fff",
          color: "#000",
          fontSize: "0.9rem",
        }}
      />
    ) : (
      <input
        type="text"
        disabled={isDisabled}
        value={value}
        onChange={(e) => handleInputChange(key, e.target.value)}
        style={{
          padding: "8px",
          borderRadius: "4px",
          border: "1px solid #ccc",
          backgroundColor: "#fff",
          color: "#000",
          fontSize: "0.9rem",
        }}
      />
    );
  };



  // For CostDetails and VolumePlan, keep them read-only (or extend later if needed)
  // Show tables and totals as before, but no editing for now.

  const costDetailsColumns = [
    { key: "costDetails", label: "Cost Details" },

    { key: "quantity", label: "Quantity" },
    { key: "unitCost", label: "Unit Cost" },
    { key: "discount", label: "Discount" },

    { key: "chargeTo", label: "Charge To" },

  ];

  const volumePlanColumns = [
    { key: "promotedSKU", label: "Promoted, SKU/s	" },
    { key: "listPrice", label: "list Price" },
    { key: "UM", label: "UM" },

    { key: "nonPromoAvgSalesAmount", label: "Non-Promo Average Sales Amount		" },
    { key: "projectedAvgSales", label: "Projected Avg Sales" },
    { key: "projectedAvgSalesAmount", label: "Projected Avg Sales Amount" },
    { key: "increasePercent", label: "Increase " },

  ];

  const tableWrapperStyle = {
    overflowX: "auto",
    marginBottom: "20px",
    width: "100%",
    maxWidth: "100vw",
  };

  const renderFixedTable = (columns, rows) => (
    <div
      style={{
        overflowX: "auto",
        marginBottom: "30px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        border: "1px solid #e0e0e0",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: "600px",
          borderCollapse: "collapse",
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          backgroundColor: "#fff",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#1976d2", color: "white" }}>
            {columns.map(({ key, label }) => (
              <th
                key={key}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #ccc",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "16px",
                  textAlign: "center",
                  fontStyle: "italic",
                  color: "#999",
                }}
              >
                No data found.
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={idx}
                style={{
                  backgroundColor: idx % 2 === 0 ? "#f9f9f9" : "#ffffff",
                }}
              >
                {columns.map(({ key }) => {
                  const value = row[key];
                  const isNumeric = !isNaN(value) && value !== null && value !== '';

                  return (
                    <td
                      key={key}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #eee",
                        whiteSpace: "nowrap",
                        color: "#333",
                      }}
                    >
                      {value !== undefined && value !== null
                        ? isNumeric
                          ? Number(value).toLocaleString()
                          : value
                        : "-"}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );



  function formatDateForKey(key, value) {
    if (key === 'DateCreated' || key === 'leadTimeTo' || key === 'leadTimeFrom' || key === 'activityDurationFrom' || key === 'activityDurationTo') {
      const date = new Date(value);
      if (isNaN(date)) return value;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return value;
  }
  const renderTotals = (totals) => {
    if (!totals) return null;

    return (
      <div
        style={{
          marginBottom: "30px",
          width: "100%",
          display: "flex",
          justifyContent: "flex-end",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "inline-block",
            minWidth: "300px",
            maxWidth: "100%",
            overflowX: "auto",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            backgroundColor: "#fff",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "Arial, sans-serif",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr>
                <th
                  colSpan="2"
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    backgroundColor: "#f5f5f5",
                    borderBottom: "1px solid #ddd",
                    fontSize: "16px",
                    color: "black",
                  }}
                >
                  Totals
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(totals).map(([key, value]) => (
                <tr key={key}>
                  <td
                    style={{
                      padding: "10px 16px",
                      fontWeight: "bold",
                      borderBottom: "1px solid #eee",
                      whiteSpace: "nowrap",
                      backgroundColor: "#fff",
                    }}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </td>
                  <td
                    style={{
                      padding: "10px 16px",
                      borderBottom: "1px solid #eee",
                      backgroundColor: "#fff",
                      whiteSpace: "nowrap",
                      textAlign: "right",
                      color: "#333",
                    }}
                  >
                    {typeof value === "number"
                      ? value.toLocaleString()
                      : typeof value === "object"
                        ? JSON.stringify(value)
                        : value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };



  const [isDisabled, setIsDisabled] = useState(false);

  async function checkApprovalStatus(visaCode) {
    try {
      const { data, error } = await supabase
        .from("Approval_History")
        .select("Response")
        .eq("BabyVisaId", visaCode);

      if (error) {
        console.error("Error fetching approval status:", error);
        setIsDisabled(false);
        return;
      }

      if (!data || data.length === 0) {
        // No approval records found
        setIsDisabled(false);
        return;
      }

      const disabled = data.some((entry) => {
        const response = entry.Response?.toLowerCase();
        return (
          response === "approved" ||
          response === "declined" ||
          response === "cancelled"
        );
      });

      setIsDisabled(disabled);
    } catch (error) {
      console.error("Unexpected error checking approval status:", error);
      setIsDisabled(false);
    }
  }


  useEffect(() => {
    if (selectedVisa?.visaCode) {
      checkApprovalStatus(selectedVisa.visaCode);
    }
  }, [selectedVisa]);

  return (
    <div style={{ padding: "20px", maxWidth: "1500px", margin: "auto" }}>
      <h2>Regular Pwp Details: {visaCode || "-"}</h2>

      <button
        onClick={() => setCurrentView("list")}
        style={{
          marginBottom: "20px",
          padding: "8px 16px",
          backgroundColor: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        ← Back to List
      </button>

      {/* Editable General Info Form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: 30,
        }}
      >
        {filteredKeys
          .filter(([key]) => key !== "CreatedForm" && key !== "Notification")
          .map(([key]) => (
            <div
              key={key}
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: 16,
              }}
            >
              <label
                htmlFor={key}
                style={{
                  fontWeight: "bold",
                  marginBottom: 6,
                  color: "#333",
                }}
              >
                {capitalize(key)}
              </label>
              {renderInputField(key, formData[key] || "", isDisabled)}
            </div>
          ))}


      </div>

      <button
        onClick={handleSave}
        disabled={saving || isDisabled}
        style={{
          marginBottom: "30px",
          padding: "10px 20px",
          backgroundColor: saving || isDisabled ? "#aaa" : "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: saving || isDisabled ? "not-allowed" : "pointer",
          fontWeight: "bold",
          fontSize: "1rem",
        }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      {saveError && (
        <p style={{ color: "red", marginBottom: 20 }}>{saveError}</p>
      )}

      {/* Cost Details Section */}


      <h3>Volume Plan</h3>
      {volumePlanRows.length > 0 ? (
        <>
          {renderFixedTable(volumePlanColumns, volumePlanRows)}
          {renderTotals(volumePlanTotals)}
        </>
      ) : (
        <p style={{ color: "gray" }}>No volume plan available.</p>
      )}
      <h3>Cost Details</h3>
      {costDetailsRows.length > 0 ? (
        <>
          {renderFixedTable(costDetailsColumns, costDetailsRows)}
          {renderTotals(costDetailsTotals)}
        </>
      ) : (
        <p style={{ color: "gray" }}>No cost details available.</p>
      )}
      {visaCode && (
        <div style={{ marginBottom: "30px", overflowX: "auto" }}>
          <h3 style={{ margin: "16px 0", color: "#333" }}>
            Approval History for <span style={{ color: "#1976d2" }}>{visaCode}</span>
          </h3>

          {loadingApprovalHistory ? (
            <p style={{ padding: "12px", fontStyle: "italic", color: "#666" }}>Loading approval history...</p>
          ) : approvalHistory.length === 0 ? (
            <p style={{ padding: "12px", fontStyle: "italic", color: "#999" }}>
              No approval history found.
            </p>
          ) : (
            <table
              style={{
                minWidth: "1000px",
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                border: "1px solid #dee2e6",
                borderRadius: "6px",
                overflow: "hidden",
                boxShadow: "0 0 10px rgba(0,0,0,0.05)",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#1976d2", color: "white" }}>
                  <th style={headerCellStyle}>Approver ID</th>
                  <th style={headerCellStyle}>Date Responded</th>
                  <th style={headerCellStyle}>Response</th>
                  <th style={headerCellStyle}>Type</th>
                </tr>
              </thead>
              <tbody>
                {approvalHistory.map((entry, idx) => {
                  const response = (entry.Response || "").toLowerCase();
                  const baseColor = idx % 2 === 0 ? "#ffffff" : "#f6f8fa";
                  let bgColor = baseColor;

                  if (response === "approved") bgColor = "#e6f4ea";      // light green
                  else if (response === "declined") bgColor = "#fdecea"; // light red
                  else if (["pending", "revision"].includes(response)) bgColor = "#fff9e6"; // light yellow

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        backgroundColor: bgColor,
                        transition: "background 0.3s",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e9f2ff")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgColor)}
                    >
                      <td style={cellStyle}>{entry.ApproverId}</td>
                      <td style={cellStyle}>
                        {entry.DateResponded ? new Date(entry.DateResponded).toLocaleString() : "-"}
                      </td>
                      <td style={cellStyle}>{entry.Response || "-"}</td>
                      <td style={cellStyle}>{entry.Type || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      )}
    </div>
  );
}
const headerCellStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid #ccc",
  textAlign: "left",
  whiteSpace: "nowrap",
  fontWeight: "600",
  fontSize: "14px",
};

const cellStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid #dee2e6",
  whiteSpace: "nowrap",
  fontSize: "14px",
};

export default View_Regular_upload;
