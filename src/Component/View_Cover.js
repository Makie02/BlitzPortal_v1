// import React, { useEffect, useState } from "react";
// import { ref, get, update } from "firebase/database";
// import { rtdb } from "../Sidebar/firestore";
// import Swal from "sweetalert2";
// import { supabase } from "../supabaseClient"; // adjust path as needed

// function View({ selectedVisa, setCurrentView }) {
//   const [formData, setFormData] = useState({});
//   const [costDetailsRows, setCostDetailsRows] = useState([]);
//   const [costDetailsTotals, setCostDetailsTotals] = useState(null);
//   const [volumePlanRows, setVolumePlanRows] = useState([]);
//   const [volumePlanTotals, setVolumePlanTotals] = useState(null);
//   const [costKeyUsed, setCostKeyUsed] = useState(null);
//   const [volumeKeyUsed, setVolumeKeyUsed] = useState(null);
//   const [saving, setSaving] = useState(false);

//   const [saveMessage, setSaveMessage] = useState(null);


//   const visaCode = selectedVisa?.visaCode;

//   useEffect(() => {
//     if (!visaCode) return;

//     const fetchRelatedData = async () => {
//       try {
//         // Fetch all cost details for this visaCode from Cover_Visa_CostDetails
//         let { data: costData, error: costError } = await supabase
//           .from("Cover_Visa_CostDetails")
//           .select("*")
//           .eq("visaCode", visaCode);

//         if (costError) throw costError;

//         if (costData && costData.length > 0) {
//           setCostKeyUsed(`CostDetails_${visaCode}`);

//           // Set all rows
//           setCostDetailsRows(costData);

//           // Calculate totals manually
//           const totalQuantity = costData.reduce((sum, row) => sum + (row.quantity || 0), 0);
//           const totalCostSum = costData.reduce((sum, row) => sum + (row.totalCostSum || 0), 0);
//           const costToSales = costData.reduce((sum, row) => sum + (row.costToSales || 0), 0);

//           // You can also aggregate remarks if needed, here just combine unique remarks
//           const remarksSet = new Set(costData.map(row => row.costRemark).filter(Boolean));
//           const combinedRemarks = Array.from(remarksSet).join("; ");

//           setCostDetailsTotals({
//             totalQuantity,
//             totalCostSum,
//             costToSales,
//             remarks: combinedRemarks,
//           });
//         } else {
//           setCostKeyUsed(null);
//           setCostDetailsRows([]);
//           setCostDetailsTotals(null);
//         }

//         // Fetch all volume plan rows for this visaCode from Cover_Visa_VolumePlan
//         let { data: volumeData, error: volumeError } = await supabase
//           .from("Cover_Visa_VolumePlan")
//           .select("*")
//           .eq("visaCode", visaCode);

//         if (volumeError) throw volumeError;

//         if (volumeData && volumeData.length > 0) {
//           setVolumeKeyUsed(`VolumePlan_${visaCode}`);

//           setVolumePlanRows(volumeData);

//           // Calculate totals manually
//           const totalProjectedAvgSales = volumeData.reduce(
//             (sum, row) => sum + (row.totalProjectedAvgSales || 0),
//             0
//           );

//           // projectedAvgSalesAmount is text, so parseFloat safely
//           const totalProjectedAvgSalesAmount = volumeData.reduce(
//             (sum, row) => sum + (parseFloat(row.totalProjectedAvgSalesAmount) || 0),
//             0
//           );

//           setVolumePlanTotals({
//             totalProjectedAvgSales,
//             totalProjectedAvgSalesAmount,
//           });
//         } else {
//           setVolumeKeyUsed(null);
//           setVolumePlanRows([]);
//           setVolumePlanTotals(null);
//         }

//         // Set form data from selectedVisa prop
//         setFormData(selectedVisa || {});
//       } catch (error) {
//         console.error("Error fetching related tables:", error);
//         setCostDetailsRows([]);
//         setCostDetailsTotals(null);
//         setVolumePlanRows([]);
//         setVolumePlanTotals(null);
//         setFormData(selectedVisa || {});
//       }
//     };

//     fetchRelatedData();
//   }, [visaCode, selectedVisa]);


//   const handleFieldChange = (key, newValue) => {
//     setFormData((prev) => ({
//       ...prev,
//       [key]: newValue,
//     }));
//   };
//   const [approvalHistory, setApprovalHistory] = useState([]);
//   const [loadingApprovalHistory, setLoadingApprovalHistory] = useState(false);

//   useEffect(() => {
//     if (!visaCode) {
//       setApprovalHistory([]);
//       return;
//     }

//     async function fetchApprovalHistory() {
//       setLoadingApprovalHistory(true);
//       try {
//         const { data, error } = await supabase
//           .from("Approval_History")
//           .select("*")
//           .eq("BabyVisaId", visaCode)
//           .order("DateResponded", { ascending: false });

//         if (error) throw error;

//         setApprovalHistory(data || []);
//       } catch (error) {
//         console.error("Error loading approval history:", error);
//         setApprovalHistory([]);
//       } finally {
//         setLoadingApprovalHistory(false);
//       }
//     }

//     fetchApprovalHistory();
//   }, [visaCode]);


//   const getResponseColor = (response) => {
//     if (!response) return "white";

//     const normalized = response.toLowerCase();
//     if (normalized === "approved") return "#d4edda"; // green-ish background
//     if (normalized === "declined") return "#f8d7da"; // red-ish background
//     if (normalized === "revision" || normalized === "pending") return "#fff3cd"; // yellow-ish background

//     return "white";
//   };
//   const saveFormData = async () => {
//     if (!visaCode) return;

//     setSaving(true);

//     try {
//       // Filter out 'attachments' key before saving
//       const dataToSave = { ...formData };
//       delete dataToSave.attachments;

//       const { data, error } = await supabase
//         .from("Cover_Visa")
//         .update(dataToSave)
//         .eq("visaCode", visaCode)
//         .select();

//       if (error) throw error;

//       Swal.fire({
//         icon: "success",
//         title: "Saved!",
//         text: "Data saved successfully.",
//         timer: 2000,
//         showConfirmButton: false,
//         timerProgressBar: true,
//       });

//       // --- Log to RecentActivity ---
//       try {
//         const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
//         const userId = currentUser?.UserID || "unknown";

//         // Get IP and geo info
//         const ipRes = await fetch("https://api.ipify.org?format=json");
//         const { ip } = await ipRes.json();

//         const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
//         const geo = await geoRes.json();

//         const activityLog = {
//           userId,
//           device: navigator.userAgent || "Unknown Device",
//           location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
//           ip,
//           time: new Date().toISOString(),
//           action: `Updated Cover_Visa (${visaCode})`,
//         };

//         const { error: activityError } = await supabase
//           .from("RecentActivity")
//           .insert(activityLog);

//         if (activityError) {
//           console.warn("Failed to log activity:", activityError.message);
//         }
//       } catch (logError) {
//         console.warn("Error logging to RecentActivity:", logError.message);
//       }

//     } catch (error) {
//       console.error("Error saving data:", error);
//       Swal.fire({
//         icon: "error",
//         title: "Oops...",
//         text: "Error saving data. Please try again.",
//       });
//     } finally {
//       setSaving(false);
//     }
//   };




//   const costDetailsColumns = [
//     { key: "costDetails", label: "Cost Details" },


//     { key: "costRemark", label: "Cost Remark" },

//     { key: "quantity", label: "Quantity" },
//     { key: "unitCost", label: "Unit Cost" },
//     { key: "discount", label: "Discount" },
//     { key: "chargeTo", label: "Charge To" },
//   ];

//   const volumePlanColumns = [
//     { key: "itemCode", label: "Item Code" },
//     { key: "projectedAvgSales", label: "Projected Avg Sales" },
//     { key: "UM", label: "UM" },


//     { key: "projectedAvgSalesAmount", label: "Projected Avg Sales Amount" },
//   ];
//   function formatDateForKey(key, value) {
//     if (key === 'DateCreated' || key === 'fromDate' || key === 'toDate') {
//       const date = new Date(value);
//       if (isNaN(date)) return value;
//       return date.toLocaleDateString('en-US', {
//         year: 'numeric',
//         month: 'long',
//         day: 'numeric',
//       });
//     }
//     return value;
//   }
// const renderFixedTable = (columns, rows) => {
//   // Helper function to format numbers with commas
//   const formatNumber = (num) => {
//     if (typeof num === "number") {
//       return num.toLocaleString();
//     }
//     // If it's a string that can be parsed to number
//     const parsed = Number(num);
//     return isNaN(parsed) ? num : parsed.toLocaleString();
//   };

//   return (
//     <div style={{ overflowX: "auto", width: "100%" }}>
//       <table
//         style={{
//           width: "100%",
//           minWidth: "600px",
//           borderCollapse: "separate",
//           borderSpacing: "0 8px", // add vertical spacing between rows
//           border: "1px solid #dee2e6",
//           borderRadius: "6px",
//           overflow: "hidden",
//           boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
//           fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
//         }}
//       >
//         <thead>
//           <tr style={{ backgroundColor: "#1976d2", color: "white" }}>
//             {columns.map(({ key, label }) => (
//               <th
//                 key={key}
//                 style={{
//                   padding: "12px 24px 12px 16px", // add more right padding for spacing
//                   borderBottom: "1px solid #ccc",
//                   textAlign: "left",
//                   fontWeight: "600",
//                   fontSize: "14px",
//                   whiteSpace: "nowrap",
//                 }}
//               >
//                 {label}
//               </th>
//             ))}
//           </tr>
//         </thead>
//         <tbody>
//           {rows.length === 0 ? (
//             <tr>
//               <td
//                 colSpan={columns.length}
//                 style={{
//                   padding: "20px",
//                   textAlign: "center",
//                   fontStyle: "italic",
//                   backgroundColor: "#f8f9fa",
//                   color: "#6c757d",
//                 }}
//               >
//                 No data found.
//               </td>
//             </tr>
//           ) : (
//             rows.map((row, idx) => (
//               <tr
//                 key={idx}
//                 style={{
//                   backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f6f8fa",
//                   transition: "background-color 0.3s",
//                   borderRadius: "4px", // add some rounding for row blocks
//                 }}
//                 onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e6f0ff")}
//                 onMouseLeave={(e) =>
//                   (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#f6f8fa")
//                 }
//               >
//                 {columns.map(({ key }) => (
//                   <td
//                     key={key}
//                     style={{
//                       padding: "12px 24px 12px 16px",
//                       borderBottom: "1px solid #ddd",
//                       fontSize: "14px",
//                       whiteSpace: "nowrap",
//                       color: "#333",
//                     }}
//                   >
//                     {key === "Amount Budget"
//                       ? row[key] !== undefined && row[key] !== null
//                         ? formatNumber(row[key])
//                         : "-"
//                       : row[key] !== undefined && row[key] !== null
//                       ? row[key]
//                       : "-"}
//                   </td>
//                 ))}
//               </tr>
//             ))
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// };



//   const formatDateValue = (key, value) => {
//     if (
//       (key.toLowerCase() === "created_at" || key.toLowerCase() === "createdat") &&
//       value
//     ) {
//       const date = new Date(value);
//       if (!isNaN(date)) {
//         return date.toLocaleDateString(undefined, {
//           year: "numeric",
//           month: "long",
//           day: "numeric",
//         });
//       }
//     }
//     return value;
//   };

//   const formatLabel = (str) => {
//     if (!str) return "";

//     // If you want to explicitly fix 'Amountbadget':
//     if (str.toLowerCase() === "amountbadget") return "Amount Budget";
//     if (str.toLowerCase() === "created_at") return "Create Date";

//     return str
//       .replace(/([a-z])([A-Z])/g, "$1 $2")       // camelCase → camel Case
//       .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2") // ABBWord → ABB Word
//       .replace(/^./, (char) => char.toUpperCase())
//       .replace(/Visa/gi, "PWP");
//   };


//   const renderTotals = (totals) => {
//     if (!totals) return null;

//     return (
//       <div
//         style={{
//           display: "flex",
//           justifyContent: "flex-end",
//           marginTop: "30px",
//           overflowX: "auto",
//           padding: "10px 0",
//         }}
//       >
//         <div
//           style={{
//             minWidth: "300px",
//             backgroundColor: "#fdfdfd",
//             border: "1px solid #dee2e6",
//             borderRadius: "8px",
//             boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
//             padding: "20px",
//           }}
//         >
//           <h5
//             style={{
//               marginBottom: "16px",
//               fontSize: "18px",
//               color: "#333",
//               borderBottom: "1px solid #e0e0e0",
//               paddingBottom: "6px",
//             }}
//           >
//             Totals
//           </h5>
//           <table
//             style={{
//               width: "100%",
//               borderCollapse: "separate",
//               borderSpacing: "0 10px", // Adds spacing between rows
//               fontSize: "14px",
//             }}
//           >
//             <tbody>
//               {Object.entries(totals).map(([key, value]) => (
//                 <tr
//                   key={key}
//                   style={{
//                     backgroundColor: "#fff",
//                     borderRadius: "4px",
//                     boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
//                   }}
//                 >
//                   <td
//                     style={{
//                       fontWeight: "600",
//                       padding: "10px 12px",
//                       color: "#444",
//                       whiteSpace: "nowrap",
//                       backgroundColor: "#f9f9f9",
//                       borderTopLeftRadius: "4px",
//                       borderBottomLeftRadius: "4px",
//                     }}
//                   >
//                     {formatLabel(key)}
//                   </td>
//                   <td
//                     style={{
//                       textAlign: "right",
//                       padding: "10px 12px",
//                       whiteSpace: "nowrap",
//                       color: "#555",
//                       backgroundColor: "#f9f9f9",
//                       borderTopRightRadius: "4px",
//                       borderBottomRightRadius: "4px",
//                     }}
//                   >
//                     {typeof value === "object" ? JSON.stringify(value) : value}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     );
//   };





//   // Local data fallback for CostDetails and VolumePlan from selectedVisa props
//   const localCostDetails = Object.entries(selectedVisa || {}).find(([key]) =>
//     key.startsWith("CostDetails_")
//   );
//   const localVolumePlan = Object.entries(selectedVisa || {}).find(([key]) =>
//     key.startsWith("VolumePlan_")
//   );

//   let localCostRows = [];
//   let localCostTotals = null;
//   if (localCostDetails) {
//     try {
//       const parsed =
//         typeof localCostDetails[1] === "string"
//           ? JSON.parse(localCostDetails[1])
//           : localCostDetails[1];
//       localCostRows = Array.isArray(parsed.rows) ? parsed.rows : [];
//       localCostTotals = parsed.totals || null;
//     } catch { }
//   }

//   let localVolumeRows = [];
//   let localVolumeTotals = null;
//   if (localVolumePlan) {
//     try {
//       const parsed =
//         typeof localVolumePlan[1] === "string"
//           ? JSON.parse(localVolumePlan[1])
//           : localVolumePlan[1];
//       localVolumeRows = Array.isArray(parsed.rows) ? parsed.rows : [];
//       localVolumeTotals = parsed.totals || null;
//     } catch { }
//   }
//   const [isDisabled, setIsDisabled] = useState(false);

//   async function checkApprovalStatus(visaCode) {
//     try {
//       const { data, error } = await supabase
//         .from("Approval_History")
//         .select("Response")
//         .eq("BabyVisaId", visaCode);

//       if (error) {
//         console.error("Error fetching approval status:", error);
//         setIsDisabled(false);
//         return;
//       }

//       if (!data || data.length === 0) {
//         // No approval records found
//         setIsDisabled(false);
//         return;
//       }

//       const disabled = data.some((entry) => {
//         const response = entry.Response?.toLowerCase();
//         return (
//           response === "approved" ||
//           response === "declined" ||
//           response === "cancelled"
//         );
//       });

//       setIsDisabled(disabled);
//     } catch (error) {
//       console.error("Unexpected error checking approval status:", error);
//       setIsDisabled(false);
//     }
//   }


//   useEffect(() => {
//     if (selectedVisa?.visaCode) {
//       checkApprovalStatus(selectedVisa.visaCode);
//     }
//   }, [selectedVisa]);


//   return (
//     <div
//       style={{
//         padding: "20px",
//         maxWidth: "1500px",
//         margin: "auto",
//         boxSizing: "border-box",
//       }}
//     >
//       <h2>Cover PWP</h2>

//       <button
//         onClick={() => setCurrentView("list")}
//         style={{
//           marginBottom: "20px",
//           padding: "8px 16px",
//           backgroundColor: "#1976d2",
//           color: "#fff",
//           border: "none",
//           borderRadius: "4px",
//           cursor: "pointer",
//         }}
//       >
//         ← Back to List
//       </button>

//       {/* Editable form section */}
//  <div
//   style={{
//     display: "grid",
//     gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
//     gap: "20px",
//     marginBottom: 30,
//   }}
// >
//   {Object.entries(formData || {})
//     .filter(
//       ([key]) =>
//         !key.startsWith("CostDetails_") &&
//         !key.startsWith("VolumePlan_") &&
//         key !== "CreatedForm" &&
//         key !== "attachments" &&
//         !key.toLowerCase().includes("notification")
//     )
//     .map(([key, value]) => {
//       // Helper: Format numbers with commas
//       const formatNumber = (num) => {
//         if (typeof num === "number") return num.toLocaleString();
//         const parsed = Number(num);
//         return isNaN(parsed) ? num : parsed.toLocaleString();
//       };

//       // Determine what to display
//       let displayValue = "";
//       if (typeof value === "object" && value !== null) {
//         displayValue = JSON.stringify(value, null, 2);
//       } else {
//         const rawValue = value === null || value === undefined ? "" : String(value);
//         displayValue = formatDateValue(key, rawValue);
//       }

//       // Format numbers with commas only if the value is numeric
//       const isNumericField = !isNaN(Number(displayValue)) && displayValue.trim() !== "";

//       // For display, format with commas if numeric and key includes 'Amount' or 'Budget'
//       let formattedDisplayValue = displayValue;
//       if (isNumericField && (key.toLowerCase().includes("amount") || key.toLowerCase().includes("budget"))) {
//         formattedDisplayValue = formatNumber(displayValue);
//       }

//       const isMultiline = formattedDisplayValue.includes("\n") || formattedDisplayValue.length > 40;

//       return (
//         <div
//           key={key}
//           style={{
//             display: "flex",
//             flexDirection: "column",
//             marginBottom: "16px",
//           }}
//         >
//           <label
//             htmlFor={key}
//             style={{
//               fontWeight: "bold",
//               marginBottom: 6,
//               color: "#333",
//             }}
//           >
//             {formatLabel(key)}
//           </label>
//           {isMultiline ? (
//             <textarea
//               id={key}
//               disabled={isDisabled}
//               value={formatDateForKey(key, formattedDisplayValue)}
//               onChange={(e) => {
//                 // Strip commas on input change so you store the raw number/string
//                 const rawInput = e.target.value.replace(/,/g, "");
//                 handleFieldChange(key, rawInput);
//               }}
//               rows={4}
//               style={{
//                 resize: "vertical",
//                 padding: "8px",
//                 fontFamily: "monospace",
//                 borderRadius: "4px",
//                 border: "1px solid #ccc",
//                 backgroundColor: "#fff",
//                 color: "#000",
//                 fontSize: "0.9rem",
//               }}
//             />
//           ) : (
//             <input
//               type="text"
//               id={key}
//               disabled={isDisabled}
//               value={formatDateForKey(key, formattedDisplayValue)}
//               onChange={(e) => {
//                 const rawInput = e.target.value.replace(/,/g, "");
//                 handleFieldChange(key, rawInput);
//               }}
//               style={{
//                 padding: "8px",
//                 fontFamily: "monospace",
//                 borderRadius: "4px",
//                 border: "1px solid #ccc",
//                 backgroundColor: "#fff",
//                 color: "#000",
//                 fontSize: "0.9rem",
//               }}
//             />
//           )}
//         </div>
//       );
//     })}
// </div>




//       {/* Save button and message */}
//       <div style={{ marginBottom: 40 }}>
//         <button
//           onClick={saveFormData}
//           disabled={isDisabled}
//           style={{
//             padding: "10px 20px",
//             fontSize: "1rem",
//             cursor: isDisabled ? "not-allowed" : "pointer",
//             backgroundColor: isDisabled ? "#999" : "#1976d2",
//             color: "white",
//             border: "none",
//             borderRadius: "5px",
//           }}
//         >
//           {saving ? "Saving..." : "Save Changes"}
//         </button>

//         {saveMessage && (
//           <p style={{ marginTop: 10, color: saveMessage.includes("Error") ? "red" : "green" }}>
//             {saveMessage}
//           </p>
//         )}
//       </div>
//       <h3>Volume Plan</h3>
//       {renderFixedTable(volumePlanColumns, volumePlanRows.length ? volumePlanRows : localVolumeRows)}
//       {renderTotals(volumePlanTotals || localVolumeTotals)}
//       {/* Read-only tables */}
//       <h3>Cost Details</h3>
//       {renderFixedTable(costDetailsColumns, costDetailsRows.length ? costDetailsRows : localCostRows)}
//       {renderTotals(costDetailsTotals || localCostTotals)}

//       {visaCode && (
//         <div style={{ marginBottom: "30px", width: "100%", overflowX: "auto" }}>
//           <h3 style={{ margin: "16px 0", color: "#333" }}>
//             Approval History for <span style={{ color: "#1976d2" }}>{visaCode}</span>
//           </h3>

//           {loadingApprovalHistory ? (
//             <p style={{ padding: "12px", fontStyle: "italic", color: "#666" }}>Loading approval history...</p>
//           ) : approvalHistory.length === 0 ? (
//             <p style={{ padding: "12px", fontStyle: "italic", color: "#999" }}>
//               No approval history found.
//             </p>
//           ) : (
//             <table
//               style={{
//                 minWidth: "1000px",
//                 width: "100%",
//                 borderCollapse: "separate",
//                 borderSpacing: 0,
//                 border: "1px solid #dee2e6",
//                 borderRadius: "6px",
//                 overflow: "hidden",
//                 boxShadow: "0 0 10px rgba(0,0,0,0.05)",
//               }}
//             >
//               <thead>
//                 <tr style={{ backgroundColor: "#1976d2", color: "white" }}>
//                   <th style={headerCellStyle}>Approver ID</th>
//                   <th style={headerCellStyle}>Date Responded</th>
//                   <th style={headerCellStyle}>Response</th>
//                   <th style={headerCellStyle}>Type</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {approvalHistory.map((entry, idx) => {
//                   const response = (entry.Response || "").toLowerCase();
//                   const baseColor = idx % 2 === 0 ? "#ffffff" : "#f6f8fa";
//                   let bgColor = baseColor;

//                   if (response === "approved") bgColor = "#e6f4ea"; // light green
//                   else if (response === "declined") bgColor = "#fdecea"; // light red
//                   else if (response === "pending" || response === "revision") bgColor = "#fff9e6"; // light yellow

//                   return (
//                     <tr
//                       key={entry.id}
//                       style={{
//                         backgroundColor: bgColor,
//                         transition: "background 0.3s",
//                         cursor: "default",
//                       }}
//                       onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e9f2ff")}
//                       onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = bgColor)}
//                     >
//                       <td style={cellStyle}>{entry.ApproverId}</td>
//                       <td style={cellStyle}>
//                         {entry.DateResponded ? new Date(entry.DateResponded).toLocaleString() : "-"}
//                       </td>
//                       <td style={cellStyle}>{entry.Response || "-"}</td>
//                       <td style={cellStyle}>{entry.Type || "-"}</td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           )}
//         </div>

//       )}

//     </div>
//   );
// }
// const headerCellStyle = {
//   padding: "12px 16px",
//   borderBottom: "1px solid #ccc",
//   textAlign: "left",
//   whiteSpace: "nowrap",
//   fontWeight: "600",
//   fontSize: "14px",
// };

// const cellStyle = {
//   padding: "12px 16px",
//   borderBottom: "1px solid #dee2e6",
//   whiteSpace: "nowrap",
//   fontSize: "14px",
// };

// export default View;
