import React, { useState, useEffect, useMemo } from "react";
import { ref, get, remove } from "firebase/database";
import { rtdb } from "../Firebase";
import "./ManageVisa.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faTrash } from "@fortawesome/free-solid-svg-icons";
import View from "./View_Cover";
import View_Regular from "./View_Regular";
import ViewCorporate from "./View_Corporate";
import { supabase } from "../supabaseClient";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../Firebase";
import Swal from "sweetalert2";

const statusOptions = ["All", "Drafts", "Regular", "Cover", "Corporate"];

const statusToCollection = {
  Regular: "Regular_Visa",
  Cover: "Cover_Visa",
  Corporate: "Corporate_Visa",
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function isToday(dateStr) {
  if (!dateStr) return false;
  // Parse the date string using Date constructor — it can handle "MM/DD/YYYY, hh:mm AM/PM" format
  const date = new Date(dateStr);
  if (isNaN(date)) return false; // Invalid date guard

  const now = new Date();

  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function ManageMarketing() {
  // Use both getter and setter for selectedStatus
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [visaData, setVisaData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterToday, setFilterToday] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);


  useEffect(() => {
    const fetchVisaData = async () => {
      if (selectedStatus === "Drafts") {
        setVisaData([]);
        return;
      }

      try {
        let visas = [];

        if (selectedStatus === "All") {
          // Fetch all visas from all tables
          const promises = Object.values(statusToCollection).map(async (table) => {
            const { data, error } = await supabase.from(table).select("*");
            if (error) {
              console.error(`Error fetching from ${table}:`, error.message);
              return [];
            }
            return data || [];
          });

          const results = await Promise.all(promises);
          visas = results.flat();
        } else {
          // Fetch visas from selected table
          const table = statusToCollection[selectedStatus];
          if (!table) {
            setVisaData([]);
            return;
          }
          const { data, error } = await supabase.from(table).select("*");
          if (error) {
            console.error(`Error fetching from ${table}:`, error.message);
            setVisaData([]);
            return;
          }
          visas = data || [];
        }

        // 🔽 Load attachments for visas (assuming you have this function)
        await loadAttachmentsForVisas(visas);

      } catch (err) {
        console.error("Error fetching visa data:", err);
        setVisaData([]);
      }
    };

    fetchVisaData();
  }, [selectedStatus]);


  const filteredData = useMemo(() => {
    return visaData
      .filter((item) => {
        if (!filterToday) return true;
        return isToday(item.DateCreated || item.dateCreated);
      })
      .filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
          item.visaCode?.toLowerCase().includes(term) ||
          item.visaTitle?.toLowerCase().includes(term) ||
          item.visaType?.toLowerCase().includes(term)
        );
      });
  }, [searchTerm, filterToday, visaData]);


  const rowsPerPage = 10;
  const viewAll = selectedStatus === "All";

  const totalPages = viewAll ? Math.ceil(filteredData.length / rowsPerPage) : 1;

  const displayedData = viewAll
    ? filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
    : filteredData;



  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

const statusToCollection = {
  Regular: "Regular_Visa",
  Corporate: "Corporate_Visa",
  Cover: "Cover_Visa",
};

const deleteVisaFromSupabase = async (visaCode, setVisaData) => {
  if (!visaCode) return;

  let table = null;

  if (visaCode.startsWith("R")) {
    table = statusToCollection.Regular;

    // Delete related Regular Visa data
    try {
      const { error: attachmentsError } = await supabase
        .from("Regular_Visa_Attachments")
        .delete()
        .eq("visaCode", visaCode);

      if (attachmentsError) {
        console.warn("Failed to delete from Regular_Visa_Attachments:", attachmentsError.message);
      }

      const { error: costDetailsError } = await supabase
        .from("Regular_Visa_CostDetails")
        .delete()
        .eq("visaCode", visaCode);

      if (costDetailsError) {
        console.warn("Failed to delete from Regular_Visa_CostDetails:", costDetailsError.message);
      }

      const { error: volumePlanError } = await supabase
        .from("Regular_Visa_VolumePlan")
        .delete()
        .eq("visaCode", visaCode);

      if (volumePlanError) {
        console.warn("Failed to delete from Regular_Visa_VolumePlan:", volumePlanError.message);
      }
    } catch (relatedDeleteError) {
      console.warn("Error deleting related regular visa data:", relatedDeleteError.message);
    }
  } else if (visaCode.startsWith("C")) {
    table = statusToCollection.Corporate;

    // Delete related Corporate Visa Details and Attachments
    try {
      const { error: detailsError } = await supabase
        .from("Corporate_Visa_Details")
        .delete()
        .eq("visaCode", visaCode);

      if (detailsError) {
        console.warn("Failed to delete from Corporate_Visa_Details:", detailsError.message);
      }

      const { error: attachmentsError } = await supabase
        .from("Corporate_Visa_Attachments")
        .delete()
        .eq("visaCode", visaCode);

      if (attachmentsError) {
        console.warn("Failed to delete from Corporate_Visa_Attachments:", attachmentsError.message);
      }
    } catch (relatedDeleteError) {
      console.warn("Error deleting related corporate visa data:", relatedDeleteError.message);
    }
  } else if (visaCode.startsWith("V")) {
    table = statusToCollection.Cover;

    // Delete related Cover Visa data
    try {
      const { error: attachmentsError } = await supabase
        .from("Cover_Visa_Attachments")
        .delete()
        .eq("visaCode", visaCode);

      if (attachmentsError) {
        console.warn("Failed to delete from Cover_Visa_Attachments:", attachmentsError.message);
      }

      const { error: costDetailsError } = await supabase
        .from("Cover_Visa_CostDetails")
        .delete()
        .eq("visaCode", visaCode);

      if (costDetailsError) {
        console.warn("Failed to delete from Cover_Visa_CostDetails:", costDetailsError.message);
      }

      const { error: volumePlanError } = await supabase
        .from("Cover_Visa_VolumePlan")
        .delete()
        .eq("visaCode", visaCode);

      if (volumePlanError) {
        console.warn("Failed to delete from Cover_Visa_VolumePlan:", volumePlanError.message);
      }
    } catch (relatedDeleteError) {
      console.warn("Error deleting related cover visa data:", relatedDeleteError.message);
    }
  } else {
    await Swal.fire("Error", "Unrecognized visa code format.", "error");
    return;
  }

  try {
    // Delete main visa record
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("visaCode", visaCode);

    if (error) {
      console.error("Supabase delete error:", error);
      await Swal.fire("Error", "Failed to delete visa from Supabase.", "error");
      return;
    }

    // ===== Handle amount_badget history and deletion =====
    // 1. Fetch amount_badget records for visaCode
    const { data: amountBadgetRecords, error: fetchError } = await supabase
      .from("amount_badget")
      .select("*")
      .eq("visacode", visaCode);

    if (fetchError) {
      console.error("Failed to fetch amount_badget records:", fetchError);
    } else if (amountBadgetRecords && amountBadgetRecords.length > 0) {
      for (const record of amountBadgetRecords) {
        const historyEntry = {
          original_id: record.id,
          visacode: record.visacode,
          amountbadget: record.amountbadget,
          createduser: record.createduser,
          createdate: record.createdate,
          remainingbalance: record.remainingbalance,
          RegularID: null, // Adjust if you have related RegularID
          action_type: "DELETE",
          action_user: JSON.parse(localStorage.getItem("loggedInUser"))?.UserID || "unknown",
          action_date: new Date().toISOString(),
          TotalCost: null, // Add if applicable
        };

        const { error: historyError } = await supabase
          .from("amount_badget_history")
          .insert(historyEntry);

        if (historyError) {
          console.warn("Failed to insert into amount_badget_history:", historyError.message);
        }
      }

      // 2. Delete from amount_badget after history insert
      const { error: deleteBadgetError } = await supabase
        .from("amount_badget")
        .delete()
        .eq("visacode", visaCode);

      if (deleteBadgetError) {
        console.error("Failed to delete from amount_badget:", deleteBadgetError);
      } else {
        console.log(`✅ Deleted amount_badget records for visaCode: ${visaCode}`);
      }
    }

    await Swal.fire("Deleted", `Visa ${visaCode} deleted successfully.`, "success");

    if (typeof setVisaData === "function") {
      setVisaData((prev) => prev.filter((item) => item.visaCode !== visaCode));
    }

    // Log RecentActivity
    try {
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || "unknown";

      const ipRes = await fetch("https://api.ipify.org?format=json");
      const { ip } = await ipRes.json();

      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geo = await geoRes.json();

      const activityLog = {
        userId: userId,
        device: navigator.userAgent || "Unknown Device",
        location: `${geo.city || "Unknown"}, ${geo.region || "Unknown"}, ${geo.country_name || "Unknown"}`,
        ip,
        time: new Date().toISOString(),
        action: `Deleted visa with code: ${visaCode}`,
      };

      const { error: activityError } = await supabase
        .from("RecentActivity")
        .insert(activityLog);

      if (activityError) {
        console.warn("Failed to log visa deletion activity:", activityError.message);
      }
    } catch (logError) {
      console.warn("Error logging visa deletion activity:", logError.message);
    }
  } catch (err) {
    console.error("Unexpected Supabase error:", err);
    await Swal.fire("Error", "Unexpected error deleting from Supabase.", "error");
  }
};



  const handleDeleteVisa = async (visa) => {
    if (!visa || !visa.visaCode) return;

    const result = await Swal.fire({
      title: `Delete ${visa.visaCode}?`,
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      await deleteVisaFromSupabase(visa.visaCode);
    }
  };

  // const getVisaAttachmentsFromFirestore = async (visaCode, collection) => {
  //   try {
  //     const visaDocRef = doc(db, collection, visaCode);
  //     const docSnap = await getDoc(visaDocRef);

  //     if (docSnap.exists()) {
  //       const data = docSnap.data();
  //       return data.attachments || [];
  //     }
  //     return [];
  //   } catch (error) {
  //     console.error("Error fetching attachments:", error);
  //     return [];
  //   }
  // };
  const loadAttachmentsForVisas = async (visas) => {
    const prefixToTable = {
      R: "Regular_Visa_Attachments",
      V: "Cover_Visa_Attachments",
      C: "Corporate_Visa_Attachments",
    };

    const updated = await Promise.all(
      visas.map(async (visa) => {
        const prefix = visa.visaCode?.substring(0, 1);
        const table = prefixToTable[prefix];

        if (!table || !visa.visaCode) return visa;

        const { data: attachments, error } = await supabase
          .from(table)
          .select("id, name, type, size, content, uploadedAt")
          .eq("visaCode", visa.visaCode);

        if (error) {
          console.error(`Error fetching attachments from ${table} for visaCode ${visa.visaCode}:`, error.message);
          return visa;
        }

        return {
          ...visa,
          attachments: attachments || [],
        };
      })
    );

    setVisaData(updated);
  };


  const getContentURL = (file) => {
    if (!file?.content || !file?.type) {
      console.warn("Missing content or type", file);
      return null;
    }

    // If already data URI, return as-is
    if (file.content.startsWith("data:")) return file.content;

    // Basic validation
    const cleanedContent = file.content.trim();
    if (cleanedContent.length < 50) {
      console.warn("Content too short to preview", file);
      return null;
    }

    return `data:${file.type};base64,${cleanedContent}`;
  };

  const [approvalHistory, setApprovalHistory] = useState([]);

  useEffect(() => {
    const fetchApprovalHistory = async () => {
      const { data, error } = await supabase
        .from("Approval_History")
        .select("*");

      if (error) {
        console.error("Error fetching approval history:", error);
        setApprovalHistory([]);
      } else {
        setApprovalHistory(data);
      }
    };

    fetchApprovalHistory();
  }, []);
  const [currentView, setCurrentView] = useState("list");
  const [selectedVisa, setSelectedVisa] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalFile, setModalFile] = useState(null);

  const handleViewDetails = (visa) => {
    if (visa?.visaCode?.startsWith("V2025")) {
      setSelectedVisa(visa);
      setCurrentView("details");
    } else if (visa?.visaCode?.startsWith("R2025")) {
      setSelectedVisa(visa);
      setCurrentView("regularDetails");
    } else if (visa?.visaCode?.startsWith("C2025")) {
      setSelectedVisa(visa);
      setCurrentView("corporateDetails");
    } else {
      alert("Visa ID must start with V2025, R2025, or C2025");
    }
  };

  // Conditional rendering
  if (currentView === "details" && selectedVisa?.visaCode?.startsWith("V2025")) {
    return <View selectedVisa={selectedVisa} setCurrentView={setCurrentView} />;
  }

  if (currentView === "regularDetails" && selectedVisa?.visaCode?.startsWith("R2025")) {
    return <View_Regular selectedVisa={selectedVisa} setCurrentView={setCurrentView} />;
  }

  if (currentView === "corporateDetails" && selectedVisa?.visaCode?.startsWith("C2025")) {
    return <ViewCorporate selectedVisa={selectedVisa} setCurrentView={setCurrentView} />;
  }


  // Render detail views conditionally
  if (currentView === "details" && selectedVisa?.visaCode?.startsWith("V2025")) {
    return <View selectedVisa={selectedVisa} setCurrentView={setCurrentView} />;
  }

  if (currentView === "regularDetails" && selectedVisa?.visaCode?.startsWith("R2025")) {
    return <View_Regular selectedVisa={selectedVisa} setCurrentView={setCurrentView} />;
  }

  if (currentView === "corporateDetails" && selectedVisa?.visaCode?.startsWith("C2025")) {
    return <ViewCorporate selectedVisa={selectedVisa} setCurrentView={setCurrentView} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "90vh", padding: "15px" }}>

      <div
        className="filters"
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "15px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <input
          type="search"
          placeholder="Search  Code, Title, Type..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
        />

        <label>
          <input
            type="checkbox"
            checked={filterToday}
            onChange={() => {
              setFilterToday(!filterToday);
              setCurrentPage(1);
            }}
          />
          Today
        </label>
      </div>

      <div
        style={{
          flex: 1,
          overflowX: "auto", // allow horizontal scroll on small screens
          border: "1px solid #ccc",
          borderRadius: "4px",
          backgroundColor: "#fff",
          fontSize: "0.85rem", // smaller text globally in table container
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "700px",
          }}
        >
          <thead
            style={{
              backgroundColor: "#f4f4f4",
              position: "sticky",
              top: 0,
              zIndex: 1,
            }}
          >
            <tr>
              <th style={{ padding: "8px" }}>Code</th>
              <th style={{ padding: "8px" }}>Type</th>
              <th style={{ padding: "8px" }}>Company</th>
              <th style={{ padding: "8px" }}>Distributor</th>
              <th style={{ padding: "8px" }}>Brand</th>
              <th style={{ padding: "8px" }}>Date Created</th>
              <th style={{ padding: "8px" }}>Attachment</th>
              <th style={{ padding: "8px" }}>Status</th>
              <th style={{ padding: "8px" }}> </th>
            </tr>
          </thead>
          <tbody>
            {displayedData.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: "center", padding: "15px" }}>
                  No data found.
                </td>
              </tr>
            ) : (
              [...displayedData]
                .sort((a, b) => {
                  const dateA = new Date(a.DateCreated || a.created_at);
                  const dateB = new Date(b.DateCreated || b.created_at);
                  return dateB - dateA;
                })
                .map((item, index) => (
                  <tr key={`${item.visaCode || "code"}-${index}`}>
                    <td style={{ padding: "6px" }}>{item.visaCode || "-"}</td>
                    <td style={{ padding: "6px" }}>{item.visaType || "-"}</td>
                    <td style={{ padding: "6px" }}>{item.company || "-"}</td>
                    <td style={{ padding: "6px" }}>{item.principal || "-"}</td>
                    <td style={{ padding: "6px" }}>{item.brand || "-"}</td>
                    <td style={{ padding: "6px" }}>{formatDate(item.DateCreated || item.created_at)}</td>
                    <td style={{ padding: "6px" }}>
                      {item.attachments?.length > 0 ? (
                        item.attachments.map((file, i) => (
                          <div key={file.id || i} style={{ marginBottom: "6px" }}>
                            <button
                              style={{
                                background: "none",
                                border: "none",
                                color: "#1976d2",
                                cursor: "pointer",
                                textDecoration: "underline",
                                padding: 0,
                                fontSize: "0.85rem",
                              }}
                              onClick={() => {
                                setModalFile(file);
                                setModalVisible(true);
                              }}
                            >
                              {file.name || `Attachment ${i + 1}`}
                            </button>
                          </div>
                        ))
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ padding: "6px" }}>
                      {(() => {
                        const latestApproval = approvalHistory
                          .filter((h) => h.BabyVisaId === item.visaCode)
                          .sort((a, b) => new Date(b.DateResponded) - new Date(a.DateResponded))[0];

                        if (!latestApproval) return "-";

                        const date = new Date(latestApproval.DateResponded);
                        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
                        const formattedTime = date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        });

                        let color = "black";
                        switch (latestApproval.Response.toLowerCase()) {
                          case "approved":
                            color = "green";
                            break;
                          case "declined":
                            color = "red";
                            break;
                          case "sent back for revision":
                            color = "orange";
                            break;
                          default:
                            color = "black";
                        }

                        return (
                          <span style={{ color }}>
                            {`${latestApproval.Response} (${formattedDate} ${formattedTime})`}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "6px", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => handleViewDetails(item)}
                        title="View Details"
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          padding: "6px 8px",
                          color: "#1976d2",
                          transition: "transform 0.3s ease, box-shadow 0.3s ease",
                          boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          outline: "none",
                          fontSize: "1rem",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                          e.currentTarget.style.boxShadow = "0 8px 15px rgba(25, 118, 210, 0.5)";
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
                          e.currentTarget.style.boxShadow = "0 8px 15px rgba(25, 118, 210, 0.5)";
                        }}
                      >
                        <FontAwesomeIcon icon={faSearch} size="lg" />
                      </button>
                      <button
                        onClick={() => handleDeleteVisa(item)}
                        title="Delete Visa"
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          padding: "6px 8px",
                          color: "#d32f2f",
                          transition: "transform 0.3s ease, box-shadow 0.3s ease",
                          boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginLeft: "8px",
                          outline: "none",
                          fontSize: "1rem",
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
                        <FontAwesomeIcon icon={faTrash} size="lg" />
                      </button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>


        {/* Modal preview */}
        {modalVisible && modalFile && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 999,
            }}
            onClick={() => {
              setModalVisible(false);
              setModalFile(null);
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                padding: "20px",
                borderRadius: "10px",
                maxWidth: "100%",
                maxHeight: "90%",
                overflow: "auto",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{modalFile.name || "Attachment Preview"}</h3>

              <div style={{ marginTop: "10px", textAlign: "center" }}>
                {modalFile.type?.startsWith("image/") ? (
                  <img
                    src={getContentURL(modalFile)}
                    alt={modalFile.name}
                    style={{ maxWidth: "100%", maxHeight: "600px", borderRadius: "6px" }}
                  />
                ) : modalFile.type?.includes("pdf") ? (
                  <img
                    src="https://img.icons8.com/color/96/pdf.png"
                    alt="PDF Icon"
                    style={{ height: "100px" }}
                  />
                ) : modalFile.name?.endsWith(".xlsx") || modalFile.name?.endsWith(".xls") ? (
                  <img
                    src="https://img.icons8.com/color/96/microsoft-excel-2019--v1.png"
                    alt="Excel Icon"
                    style={{ height: "100px" }}
                  />
                ) : (
                  <div>No preview available</div>
                )}
              </div>

              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = getContentURL(modalFile);
                  link.download = modalFile.name || "attachment";
                  link.click();
                }}
                style={{
                  marginTop: "10px",
                  backgroundColor: "#1976d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                Download
              </button>

              <button
                onClick={() => setModalVisible(false)}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  padding: "5px 10px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>


      {viewAll && totalPages > 1 && (
        <footer
          style={{
            padding: "0.5rem 1rem",
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            alignItems: "center",
            marginTop: "10px",
            borderTop: "1px solid #ccc",
          }}
        >
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: "6px 12px",
              marginRight: "10px",
              backgroundColor: currentPage === 1 ? "#ccc" : "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
            }}
          >
            Prev
          </button>
          <span style={{ marginRight: "10px" }}>
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            style={{
              padding: "6px 12px",
              backgroundColor:
                currentPage === totalPages || totalPages === 0 ? "#ccc" : "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor:
                currentPage === totalPages || totalPages === 0 ? "not-allowed" : "pointer",
            }}
          >
            Next
          </button>
        </footer>
      )}

    </div>
  );
}

export default ManageMarketing;
