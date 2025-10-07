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
import { ref, get, update } from "firebase/database";
import { rtdb } from "../Firebase"; // Make sure you have your Firebase setup correctly
import "./CalendarStyles.css"; // Optional custom styles
import { supabase } from "../supabaseClient"; // adjust path as needed

const locales = { "en-US": require("date-fns/locale/en-US") };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);

export default function VisaCalendar() {
  const [events, setEvents] = useState([]);
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  const visaPaths = ["Corporate_Visa", "Corver_Visa", "Regular_Visa"];

  const fetchAllVisaEvents = async () => {
    try {
      const visaTables = ["Corporate_Visa", "Cover_Visa", "Regular_Visa"];
      let allVisaItems = [];

      // Step 1: Fetch all visas from all tables
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

      // Step 2: Extract all visaCodes
      const visaCodes = allVisaItems.map((item) => item.visaCode);

      if (visaCodes.length === 0) {
        setEvents([]);
        return;
      }

      // Step 3: Fetch latest approval status for each visaCode from Approval_History
      // We fetch records for all visaCodes, ordered by BabyVisaId and DateResponded DESC
      // We'll keep only the latest per visaCode in a Map

      const { data: approvalData, error: approvalError } = await supabase
        .from("Approval_History")
        .select(`"BabyVisaId", "Response", "DateResponded"`)
        .in("BabyVisaId", visaCodes)
        .order("DateResponded", { ascending: false });

      if (approvalError) {
        console.error("Error fetching approval history:", approvalError);
        return;
      }

      // Create a Map of BabyVisaId => latest Response
      const latestApprovals = new Map();
      if (approvalData) {
        for (const approval of approvalData) {
          if (!latestApprovals.has(approval.BabyVisaId)) {
            latestApprovals.set(approval.BabyVisaId, approval.Response);
          }
        }
      }

      // Step 4: Build events array with merged status from Approval_History
      const newEvents = allVisaItems.map((item) => {
        let startDate = null;
        let endDate = null;

        if (item.sourcePath === "Regular_Visa") {
          startDate = item.activityDurationFrom ? new Date(item.activityDurationFrom) : null;
          endDate = item.activityDurationTo ? new Date(item.activityDurationTo) : null;
        } else {
          startDate = item.start ? new Date(item.start) : null;
          endDate = item.end ? new Date(item.end) : null;
        }

        // Use latest approval response if available; fallback to item.status / item.approved / "Pending"
        const approvalStatus = latestApprovals.get(item.visaCode) || item.status || item.approved || "Pending";

        return {
          id: item.id || item.visaCode,
          title: `Visa ${item.visaCode} ${approvalStatus}`.trim(),
          start: startDate,
          end: endDate,
          status: approvalStatus,
          sourcePath: item.sourcePath,
          visaCode: item.visaCode,
          DateCreated: item.DateCreated,
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
      // Update calendar UI immediately
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === id && ev.sourcePath === sourcePath ? { ...ev, start, end } : ev
        )
      );

      // Prepare update payload depending on source table
      let updatePayload = {};
      if (sourcePath === "Regular_Visa") {
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

      // Update Supabase record by id
      const { error } = await supabase
        .from(sourcePath)
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        console.error("Error updating event in Supabase:", error);
        // Optionally revert UI update or notify user
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
        return <FaTimesCircle style={{ marginRight: 5, color: "#dc3545" }} />;
      case "revision":
        return <FaExclamationTriangle style={{ marginRight: 5, color: "#fd7e14" }} />;
      default:
        return <FaHourglassHalf style={{ marginRight: 5, color: "#ffc107" }} />;
    }
  };

  const handleDropFromOutside = async ({ start, end }) => {
    try {
      const data = JSON.parse(window.draggedVisaData);
      const { sourcePath, id } = data;

      // Update Supabase
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

      // Update UI
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === id && ev.sourcePath === sourcePath ? { ...ev, start, end } : ev
        )
      );
    } catch (err) {
      console.error("Error dropping event:", err);
    }
  };



  return (
    <div style={{ display: "flex", height: "90vh", padding: '20px' }}>
      {/* Calendar Section */}
      <div style={{ flex: 3, position: "relative" }}>
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
          {showUnscheduled ? "Hide Unscheduled" : "Add Unscheduled"}
        </button>

        <DnDCalendar
          defaultView="month"
          views={["month", "week", "day", "agenda"]}
          localizer={localizer}
          events={events.filter((e) => e.start && e.end)}
          onEventDrop={moveEvent}
          onEventResize={moveEvent}
          onDropFromOutside={handleDropFromOutside}
          dragFromOutsideItem={() => window.draggedVisaData ? JSON.parse(window.draggedVisaData) : null}
          onDragStart={() => { }}
          resizable
          style={{ height: "100%" }}
          popup
          eventPropGetter={(event) => {
            let status = event.status?.toLowerCase?.();
            let backgroundColor = "#ffc107";

            if (status === "approved" || status === "true") backgroundColor = "green";
            else if (status === "false" || status === "declined") backgroundColor = "#dc3545";
            else if (status === "revision") backgroundColor = "#fd7e14";

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
                  } else if (type.startsWith("corver")) {
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

    </div >
  );
}
