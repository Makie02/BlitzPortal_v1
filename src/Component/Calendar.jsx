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
import { supabase } from "../supabaseClient"; // adjust path as needed
import "./CalendarStyles.css"; // Optional custom styles

const locales = { "en-US": require("date-fns/locale/en-US") };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);

export default function VisaCalendar() {
  const [events, setEvents] = useState([]);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [showOnlyApproved, setShowOnlyApproved] = useState(false);

  const fetchAllVisaEvents = async () => {
    try {
      const visaTables = ["cover_pwp", "regular_pwp"];
      let allVisaItems = [];

      await Promise.all(
        visaTables.map(async (table) => {
          const { data, error } = await supabase.from(table).select("*");

          if (error) {
            console.error(`Error fetching from ${table}:`, error);
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

      // Collect all possible codes for approval lookup from allVisaItems
      // Since Approval_History.PwpCode matches cover_code or regularpwpcode,
      // gather those codes to fetch approval responses
      const approvalCodes = Array.from(
        new Set(
          allVisaItems.flatMap(item => [item.cover_code, item.regularpwpcode]).filter(Boolean)
        )
      );

      if (approvalCodes.length === 0) {
        setEvents([]);
        return;
      }

      // Fetch approval history for these codes
      const { data: approvalData, error: approvalError } = await supabase
        .from("Approval_History")
        .select(`"PwpCode", "Response", "DateResponded"`)
        .in("PwpCode", approvalCodes)
        .order("DateResponded", { ascending: false });

      if (approvalError) {
        console.error("Error fetching approval history:", approvalError);
        return;
      }

      // Map latest approval response by PwpCode
      const latestApprovals = new Map();
      if (approvalData) {
        for (const approval of approvalData) {
          if (!latestApprovals.has(approval.PwpCode)) {
            latestApprovals.set(approval.PwpCode, approval.Response);
          }
        }
      }

      // Map events with approval statuses and proper keys
      const newEvents = allVisaItems.map((item) => {
        let startDate = null;
        let endDate = null;

        if (item.sourcePath === "regular_pwp") {
          startDate = item.activityDurationFrom ? new Date(item.activityDurationFrom) : null;
          endDate = item.activityDurationTo ? new Date(item.activityDurationTo) : null;
        } else {
          startDate = item.start ? new Date(item.start) : null;
          endDate = item.end ? new Date(item.end) : null;
        }

        // Use cover_code or regularpwpcode as the key for approval lookup
        const approvalKey = item.cover_code || item.regularpwpcode;
        const approvalResponse = approvalKey ? latestApprovals.get(approvalKey) : null;

        // Log the approvalResponse with the proper code key
        const codeForLog = approvalKey || "unknown_code";
        console.log(`Approval response for ${codeForLog}:`, approvalResponse);

        let approvalStatus;
        if (approvalResponse) {
          if (approvalResponse.toLowerCase() === "approved" || approvalResponse.toLowerCase() === "approve") {
            console.log("fuckk"); // Display if approved or approve
            approvalStatus = "approved"; // lowercase for color logic
          } else {
            approvalStatus = approvalResponse.toLowerCase();
          }
        } else {
          approvalStatus = (item.status || item.approved || "pending").toLowerCase();
        }

        return {
          id: approvalKey || item.visaCode || "unknown_id",
          title: `${approvalKey || item.visaCode} (${approvalStatus})`,
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
        };
      });

      setEvents(newEvents);
    } catch (error) {
      console.error("Error fetching visa events from Supabase:", error);
    }
  };


  useEffect(() => {
    fetchAllVisaEvents();
  }, []);

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

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
const onSelectEvent = (event) => {
  console.log("Event clicked:", event);  // <-- add this
  const codeKey = event.cover_code || event.regularpwpcode || event.visaCode || null;

  const fullEvent = events.find(
    (ev) => ev.cover_code === codeKey || ev.regularpwpcode === codeKey || ev.visaCode === codeKey
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
      <div style={{ flex: 3, position: "relative" }}>
        {/* Toggle button for showing only approved */}
        <button
          onClick={() => setShowOnlyApproved((prev) => !prev)}
          style={{
            position: "absolute",
            top: 0,
            right: 500,
            zIndex: 1002,
            padding: "8px 12px",
            backgroundColor: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            marginRight: 10,
          }}
        >
          {showOnlyApproved ? "Show All " : "Show Approved"}
        </button>

        {/* Existing showUnscheduled toggle */}
        <button
          onClick={() => setShowUnscheduled((prev) => !prev)}
          style={{
            position: "absolute",
            top: 0,
            right: 350,
            zIndex: 1001,
            padding: "8px 12px",
            backgroundColor: "#4267B2",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {showUnscheduled ? "Hide Unscheduled" : " Unscheduled"}
        </button>

        <DnDCalendar
          defaultView="month"
          views={["month", "week", "day", "agenda"]}
          localizer={localizer}
          events={events.filter((e) =>
            e.start &&
            e.end &&
            (!showOnlyApproved || (e.status?.toLowerCase() === "approved" || e.status === true))
          )}
          onEventDrop={moveEvent}
          onEventResize={moveEvent}
          onSelectEvent={onSelectEvent}
          onDropFromOutside={handleDropFromOutside}
          dragFromOutsideItem={() => (window.draggedVisaData ? JSON.parse(window.draggedVisaData) : null)}
          resizable
          style={{ height: "100%" }}
          popup
          eventPropGetter={(event) => {
            let status = event.status?.toLowerCase();
            let backgroundColor = "#ffc107"; // default yellow (Pending)

            if (status === "approved" || status === "true") backgroundColor = "green";
            else if (status === "false" || status === "declined") backgroundColor = "#dc3545";
            else if (status === "revision" || status === "sent back for revision") backgroundColor = "#6c757d"; // gray
            else if (status === "cancel" || status === "cancelled") backgroundColor = "#ff0000"; // bright red

            return {
              style: {
                backgroundColor,
                color: "#fff",
                borderRadius: "5px",
                padding: "2px 6px",
                fontSize: "0.85rem",
              },
            };
          }}


          components={{
            event: ({ event }) => (
              <span>
                {getIconByStatus(event.status)}
                {event.title}
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
      {/* Unscheduled List */}
      {showUnscheduled && (
        <div
          style={{
            flex: 1,
            backgroundColor: "#f9f9f9",
            borderLeft: "1px solid #ddd",
            padding: "16px",
            overflowY: "auto",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Unscheduled </h4>

          {events.filter((ev) => !ev.start || !ev.end).length === 0 ? (
            <p style={{ color: "#777" }}>No unscheduled visas found.</p>
          ) : (
            events
              .filter((ev) => !ev.start || !ev.end)
              .map((ev) => {
                let bgColor = "#fff";
                let icon = "❓";

                if (ev.sourcePath) {
                  const type = ev.sourcePath.toLowerCase();

                  if (type.startsWith("corporate")) {
                    bgColor = "#f8d7da"; // light red
                    icon = "🏢"; // building icon for Corporate
                  } else if (type.startsWith("cover")) {
                    bgColor = "#d1ecf1"; // light blue
                    icon = "📄"; // document icon for Cover
                  } else if (type.startsWith("regular")) {
                    bgColor = "#1877f2"; // Facebook blue
                    icon = "✅"; // checkmark for Regular
                  }
                }

                return (
                  <div
                    key={ev.id}
                    draggable
                    onDragStart={() => {
                      window.draggedVisaData = JSON.stringify(ev);
                    }}
                    style={{
                      backgroundColor: bgColor,
                      color: bgColor === "#1877f2" ? "white" : "black",
                      marginBottom: 8,
                      padding: 12,
                      border: "1px solid #ccc",
                      borderRadius: 6,
                      cursor: "grab",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <div>
                      <strong>{ev.visaCode}</strong>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: bgColor === "#1877f2" ? "#ddd" : "#555",
                        }}
                      >
                        {ev.status}
                      </p>
                    </div>
                  </div>
                );
              })
          )}

       
        </div>
      )}
    </div>
  );
}
