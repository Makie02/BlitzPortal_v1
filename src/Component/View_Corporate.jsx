import React, { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import Swal from "sweetalert2";
import { rtdb } from "../Firebase";
import { supabase } from "../supabaseClient";
function ViewCorporate({ selectedVisa, setCurrentView }) {
    const [detailsRows, setDetailsRows] = useState([]);
    const [detailsTotals, setDetailsTotals] = useState(null);
    const [detailsKeyUsed, setDetailsKeyUsed] = useState(null);
    const [formData, setFormData] = useState({});



    const [approvalHistory, setApprovalHistory] = useState([]);
    const [showApprovalHistory, setShowApprovalHistory] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // existing code ...

    const fetchApprovalHistory = async () => {
        if (!visaCode) return;

        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from("Approval_History")
                .select("*")
                .eq("BabyVisaId", visaCode)
                .order('DateResponded', { ascending: false });

            if (error) {
                console.error("Error fetching approval history:", error);
                setApprovalHistory([]);
            } else {
                setApprovalHistory(data);
            }
        } catch (err) {
            console.error("Unexpected error fetching approval history:", err);
            setApprovalHistory([]);
        }
        setLoadingHistory(false);
    };

    const toggleApprovalHistory = () => {
        if (!showApprovalHistory) {
            fetchApprovalHistory();
        }
        setShowApprovalHistory(prev => !prev);
    };
    const visaCode = selectedVisa?.visaCode;
    const visaType = selectedVisa?.visaType || "Corporate";

    useEffect(() => {
        if (selectedVisa) setFormData({ ...selectedVisa });
    }, [selectedVisa]);
    useEffect(() => {
        if (!visaCode) return;

        const fetchCorporateDetails = async () => {
            try {
                // Fetch all rows from Corporate_Visa_Details for this visaCode
                const { data, error } = await supabase
                    .from("Corporate_Visa_Details")
                    .select("*")
                    .eq("visaCode", visaCode);

                if (error) throw error;

                if (!data || data.length === 0) {
                    setDetailsRows([]);
                    setDetailsTotals(null);
                    setDetailsKeyUsed(null);
                    return;
                }

                // Set data as rows
                setDetailsRows(data);

                // Optionally, set a key or just null (not really needed here)
                setDetailsKeyUsed("Corporate_Visa_Details");

                setDetailsTotals(null); // Add totals logic here if needed
            } catch (error) {
                console.error("Error fetching Corporate visa details:", error);
                setDetailsRows([]);
                setDetailsTotals(null);
                setDetailsKeyUsed(null);
            }
        };

        fetchCorporateDetails();
    }, [visaCode]);



    const handleInputChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            [key]: value
        }));
    };

 const handleSave = async () => {
  if (!formData.visaCode) {
    Swal.fire("Error", "Visa Code is missing.", "error");
    return;
  }

  // Filter out unwanted keys like 'attachments' and 'notification'
  const filteredData = Object.fromEntries(
    Object.entries(formData).filter(
      ([key]) =>
        !key.toLowerCase().includes("attachments") &&
        !key.toLowerCase().includes("notification")
    )
  );

  try {
    const { data, error } = await supabase
      .from("Corporate_Visa")
      .update(filteredData)
      .eq("visaCode", formData.visaCode);

    if (error) throw error;

    Swal.fire("Saved!", "Data successfully updated to Supabase.", "success");

    // --- Log to RecentActivity ---
    try {
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || "unknown";

      const ipRes = await fetch("https://api.ipify.org?format=json");
      const { ip } = await ipRes.json();

      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geo = await geoRes.json();

      const activityLog = {
        userId,
        device: navigator.userAgent || "Unknown Device",
        location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
        ip,
        time: new Date().toISOString(),
        action: `Updated Corporate_Visa (${formData.visaCode})`,
      };

      const { error: activityError } = await supabase
        .from("RecentActivity")
        .insert(activityLog);

      if (activityError) {
        console.warn("Failed to log activity:", activityError.message);
      }
    } catch (logError) {
      console.warn("Error logging activity:", logError.message);
    }

  } catch (error) {
    console.error("Save error:", error);
    Swal.fire("Error", "Failed to save data to Supabase.", "error");
  }
};



    const columns = [
        { key: "brand", label: "Brand" },
        { key: "checked", label: "Checked" },
        { key: "cts", label: "CTS" },
        { key: "diff", label: "Diff" },
        { key: "fixedSupport", label: "Fixed Support" },
        { key: "percentCont", label: "Percent Contribution" },
        { key: "sales2024", label: "Sales 2024" },
        { key: "salesVisa", label: "Sales Visa" },
        { key: "supportDiff", label: "Support Diff" },
        { key: "target2025", label: "Target 2025" },
        { key: "totalFixedSupportVAT", label: "Total Fixed Support VAT" },
        { key: "totalSupport", label: "Total Support" },
        { key: "variableSupport", label: "Variable Support" },
        { key: "yagoSupport", label: "YAGO Support" },
    ];

const renderTable = (columns, rows) => (
  <div style={{ overflowX: "auto", width: "100%" }}>
    <table
      style={{
        minWidth: "1000px",
        borderCollapse: "separate",
        borderSpacing: 0,
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        overflow: "hidden",
        width: "100%",
        boxShadow: "0 0 10px rgba(0,0,0,0.05)",
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
                fontWeight: "600",
                fontSize: "14px",
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
                backgroundColor: "#f8f9fa",
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
                backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f6f8fa",
                transition: "background 0.3s",
                cursor: "default",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e9f2ff")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#f6f8fa")
              }
            >
              {columns.map(({ key }) => {
                let value = row[key];
                if (key === "brand" && typeof value === "string") {
                  try {
                    const parsed = JSON.parse(value);
                    value = parsed.name || parsed.description || value;
                  } catch {
                    // fallback to raw string
                  }
                }
                if (key === "checked") {
                  value = value ? "✔️" : "✘";
                }
                return (
                  <td
                    key={key}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #dee2e6",
                      whiteSpace: "nowrap",
                      fontSize: "14px",
                    }}
                  >
                    {value ?? "-"}
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


    const renderTotals = (totals) => {
        if (!totals) return null;
        return (
            <div style={{ marginBottom: "30px", width: "100%", display: "flex", justifyContent: "flex-end", overflowX: "auto" }}>
                <div style={{ minWidth: "320px", maxWidth: "100%" }}>
                    <h4 style={{ marginTop: 0 }}>Totals</h4>
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                        <tbody>
                            {Object.entries(totals).map(([key, value]) => (
                                <tr key={key}>
                                    <td style={{ padding: "8px", fontWeight: "bold", backgroundColor: "#f4f4f4", border: "1px solid #ccc" }}>
                                        {key}
                                    </td>
                                    <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                                        {typeof value === "object" ? JSON.stringify(value) : value}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    let localRows = [];
    let localTotals = null;
    let localKey = null;

    if (selectedVisa) {
        localKey = Object.keys(selectedVisa).find(
            k => k.startsWith("Corporate_Visa_Details_") && k.includes(visaCode)
        );
        if (localKey) {
            try {
                const parsed = typeof selectedVisa[localKey] === "string"
                    ? JSON.parse(selectedVisa[localKey])
                    : selectedVisa[localKey];
                localRows = Array.isArray(parsed.rows) ? parsed.rows : [];
                localTotals = parsed.totals || null;
            } catch { }
        }
    }
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
            <h2>Corporate Visa Details: {visaCode || "-"}</h2>

            <button
                onClick={() => setCurrentView("list")}
                style={{ marginBottom: "20px", padding: "8px 16px", backgroundColor: "#1976d2", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
                ← Back to List
            </button>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "20px",
                    marginBottom: 30,
                }}
            >
                {Object.entries(formData || {})
                    .filter(
                        ([key]) =>
                            // Exclude Corporate_Visa_Details_ keys for this visaCode
                            !(key.startsWith("Corporate_Visa_Details_") && key.includes(visaCode)) &&
                            // Exclude keys containing Attachments or Notification anywhere in the key
                            !key.toLowerCase().includes("attachments") &&
                            !key.toLowerCase().includes("notification")
                    )
                    .map(([key, value]) => {
                        const displayValue =
                            typeof value === "object" && value !== null
                                ? JSON.stringify(value, null, 2)
                                : value ?? "";

                        const isMultiline =
                            typeof displayValue === "string" &&
                            (displayValue.includes("\n") || displayValue.length > 40);

                        const capitalizeFirstLetter = (str) =>
                            str.charAt(0).toUpperCase() + str.slice(1);

                        return (
                            <div key={key} style={{ display: "flex", flexDirection: "column" }}>
                                <label
                                    htmlFor={key}
                                    style={{ fontWeight: "bold", marginBottom: 6 }}
                                >
                                    {capitalizeFirstLetter(key)}
                                </label>
                                {isMultiline ? (
                                    <textarea
                                        id={key}
                                        value={displayValue}
                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                        rows={4}
                                        disabled={isDisabled}
                                        style={{
                                            resize: "vertical",
                                            padding: "8px",
                                            fontFamily: "monospace",
                                            borderRadius: "4px",
                                            border: "1px solid #ccc",
                                            backgroundColor: "#fff",
                                            fontSize: "0.9rem",
                                        }}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        id={key}
                                        value={displayValue}
                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                        disabled={isDisabled}
                                        style={{
                                            padding: "8px",
                                            borderRadius: "4px",
                                            border: "1px solid #ccc",
                                            backgroundColor: "#fff",
                                            fontSize: "0.9rem",
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
            </div>

            <button
                onClick={handleSave}
                disabled={isDisabled}
                style={{
                    marginBottom: "30px",
                    padding: "10px 20px",
                    backgroundColor: isDisabled ? "#ccc" : "#388e3c",
                    color: isDisabled ? "#666" : "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                }}
            >
                💾 Save
            </button>


          

            {renderTable(columns, detailsRows.length ? detailsRows : localRows)}
            {renderTotals(detailsTotals || localTotals)}
            <div style={{ padding: "20px", maxWidth: "1500px", margin: "auto" }}>
                {/* existing code */}

                <button
                    onClick={toggleApprovalHistory}
                    style={{
                        marginBottom: "20px",
                        padding: "10px 20px",
                        backgroundColor: "#1976d2",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    {showApprovalHistory ? "Hide" : "Show"} Approval History
                </button>

                {showApprovalHistory && (
                 <div style={{ marginBottom: "30px", width: "100%", overflowX: "auto" }}>
  <h3 style={{ margin: "16px 0", color: "#333" }}>
    Approval History for <span style={{ color: "#1976d2" }}>{visaCode}</span>
  </h3>

  {loadingHistory ? (
    <p style={{ padding: "12px", fontStyle: "italic", color: "#666" }}>Loading...</p>
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

          if (response === "approved") bgColor = "#e6f4ea"; // light green
          else if (response === "declined") bgColor = "#fdecea"; // light red
          else if (response === "pending" || response === "revision") bgColor = "#fff9e6"; // light yellow

          return (
            <tr
              key={entry.id}
              style={{
                backgroundColor: bgColor,
                transition: "background 0.3s",
                cursor: "default",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e9f2ff")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = bgColor)
              }
            >
              <td style={cellStyle}>{entry.ApproverId}</td>
              <td style={cellStyle}>
                {entry.DateResponded
                  ? new Date(entry.DateResponded).toLocaleString()
                  : "-"}
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

                {/* existing code */}
            </div>
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

export default ViewCorporate;
