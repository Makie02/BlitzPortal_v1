import React, { useEffect, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { FaCheckCircle, FaHourglassHalf, FaTimesCircle, FaExclamationTriangle } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./CalendarStyles.css";

const locales = { "en-US": require("date-fns/locale/en-US") };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);

export default function VisaCalendar() {
  const [events, setEvents] = useState([]);
  const [showOnlyApproved, setShowOnlyApproved] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showProcessData, setShowProcessData] = useState(false);
  const [processHistory, setProcessHistory] = useState([]);

  // Fetch current logged-in user
  const fetchCurrentUser = async () => {
    try {
      // Get user from localStorage instead of Supabase Auth
      const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
      
      console.log("🔍 Logged in user from localStorage:", loggedInUser);
      
      if (!loggedInUser) {
        console.log("⚠️ No user in localStorage!");
        alert("Please log in first.");
        return;
      }
      
      // Get the UserID from localStorage
      const userId = loggedInUser.UserID || loggedInUser.userId || loggedInUser.id;
      const userName = loggedInUser.name;
      
      console.log("✅ Current User - ID:", userId, "Name:", userName);
      
      setCurrentUser({
        UserID: userId,
        name: userName,
        role: loggedInUser.role
      });
      
    } catch (error) {
      console.error("❌ Error fetching current user:", error);
    }
  };

  const fetchAllVisaEvents = async () => {
    try {
      if (!currentUser) {
        console.log("⏸️ Waiting for user login...");
        return;
      }

      console.log(`🔄 Fetching PWPs for UserID: ${currentUser.UserID} (${currentUser.name})`);

      const visaTables = ["cover_pwp", "regular_pwp", "Claims_pwp"];
      let allVisaItems = [];

      await Promise.all(
        visaTables.map(async (table) => {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .eq("createForm", currentUser.UserID);

          if (error) {
            console.error(`❌ Error fetching from ${table}:`, error);
            return;
          }
          
          if (data && data.length) {
            allVisaItems = allVisaItems.concat(
              data.map((item) => ({
                ...item,
                sourcePath: table,
              }))
            );
          }
        })
      );

      if (allVisaItems.length === 0) {
        console.log("⚠️ No PWPs found for this user!");
        setEvents([]);
        return;
      }

      const approvalCodes = Array.from(
        new Set(
          allVisaItems.flatMap(item => [item.cover_code, item.regularpwpcode, item.code_pwp]).filter(Boolean)
        )
      );

      if (approvalCodes.length === 0) {
        setEvents([]);
        return;
      }

      const { data: approvalData, error: approvalError } = await supabase
        .from("Approval_History")
        .select(`"PwpCode", "Response", "DateResponded"`)
        .in("PwpCode", approvalCodes)
        .order("DateResponded", { ascending: false });

      if (approvalError) {
        console.error("Error fetching approval history:", approvalError);
        return;
      }

      const latestApprovals = new Map();
      const historyMap = new Map();
      
      if (approvalData) {
        for (const approval of approvalData) {
          if (!latestApprovals.has(approval.PwpCode)) {
            latestApprovals.set(approval.PwpCode, approval.Response);
          }
          
          if (!historyMap.has(approval.PwpCode)) {
            historyMap.set(approval.PwpCode, []);
          }
          historyMap.get(approval.PwpCode).push({
            response: approval.Response,
            date: approval.DateResponded
          });
        }
      }

      const newEvents = allVisaItems.map((item) => {
        // Always use creation date as the primary date
        const creationDate = item.created_at || item.DateCreated;
        let startDate = creationDate ? new Date(creationDate) : new Date();
        // Set start time to beginning of day
        startDate.setHours(0, 0, 0, 0);
        // End date is same day (not +1 day) to keep it on single date
        let endDate = new Date(startDate);

        const approvalKey = item.cover_code || item.regularpwpcode || item.code_pwp;
        const approvalResponse = approvalKey ? latestApprovals.get(approvalKey) : null;

        let approvalStatus;
        if (approvalResponse) {
          if (approvalResponse.toLowerCase() === "approved" || approvalResponse.toLowerCase() === "approve") {
            approvalStatus = "approved";
          } else {
            approvalStatus = approvalResponse.toLowerCase();
          }
        } else {
          approvalStatus = (item.status || item.approved || "pending").toLowerCase();
        }

        return {
          id: approvalKey || item.visaCode || item.id || "unknown_id",
          title: `${approvalKey || item.visaCode || item.code_pwp} (${approvalStatus})`,
          start: startDate,
          end: endDate,
          status: approvalStatus,
          sourcePath: item.sourcePath,
          visaCode: item.visaCode,
          DateCreated: item.DateCreated,
          regularpwpcode: item.regularpwpcode,
          cover_code: item.cover_code,
          distributor_code: item.distributor_code,
          amount_badget: item.amount_badget,
          created_at: item.created_at,
          createForm: item.createForm,
          isPartOfCoverPwp: item.isPartOfCoverPwp,
          coverPwpCode: item.coverPwpCode,
          remaining_balance: item.remaining_balance,
          credit_budget: item.credit_budget,
          code_pwp: item.code_pwp,
          distributor: item.distributor,
          activity: item.activity,
          account_types: item.account_types,
          category_codes: item.category_codes,
          category_names: item.category_names,
          amount_budget: item.amount_budget,
          remaining_budget: item.remaining_budget,
          notification: item.notification,
          pwp_type: item.pwp_type,
          branchType: item.branchType,
          approvalHistory: historyMap.get(approvalKey) || []
        };
      });

      setEvents(newEvents);
      
      // Build process history data
      const processData = [];
      allVisaItems.forEach(item => {
        const code = item.cover_code || item.regularpwpcode || item.code_pwp;
        const createdDate = item.created_at || item.DateCreated;
        const history = historyMap.get(code) || [];
        
        processData.push({
          code: code,
          type: item.sourcePath,
          createdDate: createdDate ? new Date(createdDate).toLocaleDateString() : 'N/A',
          status: 'Pending',
          statusDate: createdDate ? new Date(createdDate).toLocaleDateString() : 'N/A'
        });
        
        history.forEach(h => {
          processData.push({
            code: code,
            type: item.sourcePath,
            createdDate: createdDate ? new Date(createdDate).toLocaleDateString() : 'N/A',
            status: h.response,
            statusDate: h.date ? new Date(h.date).toLocaleDateString() : 'N/A'
          });
        });
      });
      
      setProcessHistory(processData);

    } catch (error) {
      console.error("❌ Error fetching visa events:", error);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchAllVisaEvents();
    }
  }, [currentUser]);

  const moveEvent = async ({ event, start, end }) => {
    const { sourcePath, id } = event;

    try {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === id && ev.sourcePath === sourcePath ? { ...ev, start, end } : ev
        )
      );

      let updatePayload = {};
      if (sourcePath === "regular_pwp") {
        updatePayload = {
          activityDurationFrom: start.toISOString(),
          activityDurationTo: end.toISOString(),
        };
      } else if (sourcePath === "Claims_pwp") {
        console.log("Claims_pwp doesn't support date scheduling");
        return;
      } else {
        updatePayload = {
          start: start.toISOString(),
          end: end.toISOString(),
        };
      }

      const { error } = await supabase
        .from(sourcePath)
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        console.error("Error updating event in Supabase:", error);
      }
    } catch (error) {
      console.error("Error moving event:", error);
    }
  };

  const getIconByStatus = (status) => {
    status = typeof status === "boolean" ? (status ? "approved" : "false") : (status || "").toLowerCase();

    switch (status) {
      case "approved":
      case "true":
        return <FaCheckCircle style={{ marginRight: 5, color: "#28a745" }} />;
      case "false":
      case "declined":
        return <FaTimesCircle style={{ marginRight: 5, color: "#f3f3f3ff" }} />;
      case "revision":
      case "sent back for revision":
        return <FaExclamationTriangle style={{ marginRight: 5, color: "#ff0000ff" }} />;
      case "cancel":
      case "cancelled":
        return <FaTimesCircle style={{ marginRight: 5, color: "#ffffffff" }} />;
      default:
        return <FaHourglassHalf style={{ marginRight: 5, color: "#7700ffff" }} />;
    }
  };

  const handleDropFromOutside = async ({ start, end }) => {
    try {
      const data = JSON.parse(window.draggedVisaData);
      const { sourcePath, id } = data;

      if (sourcePath === "Claims_pwp") {
        console.log("Claims_pwp doesn't support date scheduling");
        return;
      }

      const { error } = await supabase
        .from(sourcePath)
        .update({
          start: start.toISOString(),
          end: end.toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("Error dropping event in Supabase:", error);
        return;
      }

      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === id && ev.sourcePath === sourcePath ? { ...ev, start, end } : ev
        )
      );
    } catch (err) {
      console.error("Error dropping event:", err);
    }
  };

  const onSelectEvent = (event) => {
    console.log("Event clicked:", event);
    const codeKey = event.cover_code || event.regularpwpcode || event.code_pwp || event.visaCode || null;

    const fullEvent = events.find(
      (ev) => ev.cover_code === codeKey || ev.regularpwpcode === codeKey || ev.code_pwp === codeKey || ev.visaCode === codeKey
    ) || event;

    setSelectedEvent(fullEvent);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedEvent(null);
  };

  const renderModalContent = () => {
    if (!selectedEvent) return null;

    const e = selectedEvent;

    const containerStyle = {
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      color: "#333",
      lineHeight: 1.5,
    };

    const headerStyle = {
      marginBottom: "16px",
      fontSize: "1.5rem",
      borderBottom: "2px solid #007bff",
      paddingBottom: "6px",
      color: "#007bff",
    };

    const labelStyle = {
      fontWeight: "600",
      marginRight: "8px",
      color: "#555",
    };

    const valueStyle = {
      color: "#222",
    };

    const itemStyle = {
      marginBottom: "12px",
      display: "flex",
      flexWrap: "wrap",
    };

    if (e.sourcePath === "cover_pwp") {
      return (
        <div style={containerStyle}>
          <h3 style={headerStyle}>Cover PWP Details</h3>
          <div style={itemStyle}>
            <span style={labelStyle}>Cover Code:</span>
            <span style={valueStyle}>{e.cover_code || e.visaCode || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Distributor Code:</span>
            <span style={valueStyle}>{e.distributor_code || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Amount Budget:</span>
            <span style={valueStyle}>{e.amount_badget || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Created At:</span>
            <span style={valueStyle}>
              {e.created_at
                ? new Date(e.created_at).toLocaleString()
                : e.DateCreated
                ? new Date(e.DateCreated).toLocaleString()
                : "N/A"}
            </span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Create Form:</span>
            <span style={valueStyle}>{e.createForm || "N/A"}</span>
          </div>
          {e.approvalHistory && e.approvalHistory.length > 0 && (
            <div style={itemStyle}>
              <span style={labelStyle}>Approval History:</span>
              <div style={valueStyle}>
                {e.approvalHistory.map((h, idx) => (
                  <div key={idx} style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                    {h.response} - {h.date ? new Date(h.date).toLocaleString() : 'N/A'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } else if (e.sourcePath === "regular_pwp") {
      return (
        <div style={containerStyle}>
          <h3 style={headerStyle}>Regular PWP Details</h3>
          <div style={itemStyle}>
            <span style={labelStyle}>Regular PWP Code:</span>
            <span style={valueStyle}>{e.regularpwpcode || e.visaCode || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Is Part Of Cover PWP:</span>
            <span style={valueStyle}>{e.isPartOfCoverPwp ? "Yes" : "No"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Cover PWP Code:</span>
            <span style={valueStyle}>{e.coverPwpCode || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Remaining Balance:</span>
            <span style={valueStyle}>{e.remaining_balance || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Credit Budget:</span>
            <span style={valueStyle}>{e.credit_budget || "N/A"}</span>
          </div>
          {e.approvalHistory && e.approvalHistory.length > 0 && (
            <div style={itemStyle}>
              <span style={labelStyle}>Approval History:</span>
              <div style={valueStyle}>
                {e.approvalHistory.map((h, idx) => (
                  <div key={idx} style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                    {h.response} - {h.date ? new Date(h.date).toLocaleString() : 'N/A'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } else if (e.sourcePath === "Claims_pwp") {
      return (
        <div style={containerStyle}>
          <h3 style={headerStyle}>Claims PWP Details</h3>
          <div style={itemStyle}>
            <span style={labelStyle}>PWP Code:</span>
            <span style={valueStyle}>{e.code_pwp || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Distributor:</span>
            <span style={valueStyle}>{e.distributor || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Activity:</span>
            <span style={valueStyle}>{e.activity || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Account Types:</span>
            <span style={valueStyle}>{e.account_types || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Category Codes:</span>
            <span style={valueStyle}>
              {e.category_codes ? e.category_codes.join(", ") : "N/A"}
            </span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Category Names:</span>
            <span style={valueStyle}>
              {e.category_names ? e.category_names.join(", ") : "N/A"}
            </span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Amount Budget:</span>
            <span style={valueStyle}>{e.amount_budget || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Remaining Budget:</span>
            <span style={valueStyle}>{e.remaining_budget || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>PWP Type:</span>
            <span style={valueStyle}>{e.pwp_type || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Branch Type:</span>
            <span style={valueStyle}>{e.branchType || "N/A"}</span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Created At:</span>
            <span style={valueStyle}>
              {e.created_at ? new Date(e.created_at).toLocaleString() : "N/A"}
            </span>
          </div>
          <div style={itemStyle}>
            <span style={labelStyle}>Notification:</span>
            <span style={valueStyle}>{e.notification ? "Yes" : "No"}</span>
          </div>
          {e.approvalHistory && e.approvalHistory.length > 0 && (
            <div style={itemStyle}>
              <span style={labelStyle}>Approval History:</span>
              <div style={valueStyle}>
                {e.approvalHistory.map((h, idx) => (
                  <div key={idx} style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                    {h.response} - {h.date ? new Date(h.date).toLocaleString() : 'N/A'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={containerStyle}>
        <p>No additional details available.</p>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "90vh", padding: '20px' }}>
      {currentUser && (
        <div style={{
          position: "absolute",
          top: 10,
          left: 20,
          padding: "8px 12px",
          borderRadius: 4,
          fontSize: "14px",
          zIndex: 1003,
        }}>
        </div>
      )}
      
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{
          position: "absolute",
          top: 0,
          right: 350,
          zIndex: 1002,
          display: "flex",
          gap: "10px"
        }}>
          <button
            onClick={() => setShowOnlyApproved((prev) => !prev)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            {showOnlyApproved ? "Show All" : "Show Approved"}
          </button>

          <button
            onClick={() => setShowProcessData((prev) => !prev)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            {showProcessData ? "Hide Process" : "Show Process"}
          </button>
        </div>

        <DnDCalendar
          defaultView="month"
          views={["month", "week", "day", "agenda"]}
          localizer={localizer}
          events={events.filter((e) =>
            (!showOnlyApproved || (e.status?.toLowerCase() === "approved" || e.status === true))
          )}
          onSelectEvent={onSelectEvent}
          resizable={false}
          draggableAccessor={() => false}
          style={{ height: "100%" }}
          popup
          formats={{
            eventTimeRangeFormat: () => null,
          }}
          eventPropGetter={(event) => {
            let status = event.status?.toLowerCase();
            let backgroundColor = "#ffc107";

            if (status === "approved" || status === "true") backgroundColor = "green";
            else if (status === "false" || status === "declined") backgroundColor = "#dc3545";
            else if (status === "revision" || status === "sent back for revision") backgroundColor = "#6c757d";
            else if (status === "cancel" || status === "cancelled") backgroundColor = "#ff0000";

            return {
              style: {
                backgroundColor,
                color: "#fff",
                borderRadius: "5px",
                padding: "2px 6px",
                fontSize: "0.75rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
                display: "block",
              },
            };
          }}
          components={{
            event: ({ event }) => (
              <span style={{ 
                display: "flex", 
                alignItems: "center", 
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis"
              }}>
                <span style={{ flexShrink: 0 }}>{getIconByStatus(event.status)}</span>
                <span style={{ 
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {event.title}
                </span>
              </span>
            ),
          }}
        />
      </div>

      {modalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              borderRadius: 8,
              padding: 24,
              width: 400,
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 5px 15px rgba(0,0,0,.3)",
            }}
          >
            <button
              onClick={closeModal}
              style={{
                float: "right",
                border: "none",
                background: "none",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              &times;
            </button>
            {renderModalContent()}
          </div>
        </div>
      )}

      {showProcessData && (
        <div
          style={{
            position: "fixed",
            top: 80,
            right: 20,
            width: 400,
            maxHeight: "80vh",
            backgroundColor: "white",
            borderRadius: 8,
            padding: 16,
            boxShadow: "0 5px 15px rgba(0,0,0,.3)",
            zIndex: 1500,
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Process Data</h3>
            <button
              onClick={() => setShowProcessData(false)}
              style={{
                border: "none",
                background: "none",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              &times;
            </button>
          </div>
          
          {processHistory.length === 0 ? (
            <p style={{ color: "#777" }}>No process data available.</p>
          ) : (
            <div style={{ fontSize: "0.9rem" }}>
              {processHistory.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    backgroundColor: "#f9f9f9",
                    borderRadius: 6,
                    borderLeft: `4px solid ${
                      item.status.toLowerCase() === "approved" ? "#28a745" :
                      item.status.toLowerCase() === "pending" ? "#ffc107" :
                      item.status.toLowerCase().includes("revision") ? "#6c757d" :
                      "#dc3545"
                    }`,
                  }}
                >
                  <div style={{ fontWeight: "600", marginBottom: 4 }}>
                    {item.code}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    Type: {item.type.replace("_", " ")}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    Created: {item.createdDate}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    Status: <strong>{item.status}</strong> ({item.statusDate})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
