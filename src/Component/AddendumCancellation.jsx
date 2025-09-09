import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import View from "./View_Cover";
import View_Regular from "./View_Regular";
import ViewCorporate from "./View_Corporate";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Swal from 'sweetalert2';
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import View_Regular_upload from "./View_Regular_upload";
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function AddendumCancellation() {
  const [visas, setVisas] = useState([]);
  const [filteredVisas, setFilteredVisas] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedVisa, setSelectedVisa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showMsg, setShowMsg] = useState(false);
  const [currentView, setCurrentView] = useState("list");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function fetchVisas() {
      setLoading(true);
      setError(null);
      try {
        const [{ data: regular }, { data: cover }, { data: corporate }, { data: regularUpload }] = await Promise.all([
          supabase.from("Regular_Visa").select("*"),
          supabase.from("Cover_Visa").select("*"),
          supabase.from("Corporate_Visa").select("*"),
          supabase.from("RegularUpload").select("*")

        ]);

        const combined = [
          ...(regular || []).map(v => ({ ...v, type: "Regular Pwp", display: v.visaCode })),
          ...(cover || []).map(v => ({ ...v, type: "Cover Pwp", display: v.visaCode })),
          ...(corporate || []).map(v => ({ ...v, type: "Corporate Pwp", display: v.visaCode })),
          ...(regularUpload || []).map(v => ({
            ...v,
            type: "Regular Upload",
            display: v.visaCode || v.id?.toString() || "N/A"
          })),
        ];

        setVisas(combined);
        setFilteredVisas(combined);
      } catch {
        setError("Unexpected error while fetching visas.");
      }
      setLoading(false);
    }

    fetchVisas();
  }, []);

  useEffect(() => {
    if (!debouncedSearchTerm) {
      setFilteredVisas(visas);
      return;
    }
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    setFilteredVisas(
      visas.filter(
        (v) =>
          (v.visaCode && v.visaCode.toLowerCase().includes(lowerSearch)) ||
          (v.type && v.type.toLowerCase().includes(lowerSearch))
      )
    );
  }, [debouncedSearchTerm, visas]);
  const [isCancelled, setIsCancelled] = useState(false);
  const [parentBalance, setParentBalance] = useState(null);

  useEffect(() => {
    if (!selectedVisa?.coverVisaCode) {
      setParentBalance(null);
      return;
    }

    const fetchParentBalance = async () => {
      const { data, error } = await supabase
        .from("amount_badget")
        .select("remainingbalance")
        .eq("visacode", selectedVisa.coverVisaCode)
        .order("createdate", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Failed to fetch parent balance:", error.message);
        setParentBalance(null);
      } else {
        setParentBalance(data?.[0]?.remainingbalance ?? null);
      }
    };

    fetchParentBalance();
  }, [selectedVisa?.coverVisaCode]);

  const [totalCostSum, setTotalCostSum] = useState(null);

  useEffect(() => {
    if (!selectedVisa?.visaCode || selectedVisa?.type !== "Regular Pwp ") {
      setTotalCostSum(null);
      return;
    }

    const fetchTotalCostSum = async () => {
      const { data, error } = await supabase
        .from("Regular_Visa_CostDetails")
        .select("totalCostSum")
        .eq("visaCode", selectedVisa.visaCode)
        .limit(1);

      if (error) {
        console.error("Failed to fetch totalCostSum:", error.message);
        setTotalCostSum(null);
      } else {
        setTotalCostSum(data?.[0]?.totalCostSum ?? null);
      }
    };

    fetchTotalCostSum();
  }, [selectedVisa?.visaCode, selectedVisa?.type]);


  const cancelAddendum = async () => {
    if (!selectedVisa) return;
    setCancelling(true);
    setError(null);
    setSuccessMsg(null);
    setShowMsg(false);

    try {
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const approverId = currentUser?.UserID || "unknown";
      const now = new Date().toISOString();

      // If Regular Pwp has coverVisaCode, update parent balance
      if (selectedVisa.type === "Regular Pwp " && selectedVisa.coverVisaCode && totalCostSum !== null) {
        const { data: parentData, error: parentError } = await supabase
          .from("amount_badget")
          .select("id, remainingbalance")
          .eq("visacode", selectedVisa.coverVisaCode)
          .order("createdate", { ascending: false })
          .limit(1);

        if (parentError) {
          throw new Error("Failed to fetch parent cover visa balance.");
        }

        const parentEntry = parentData?.[0];
        if (parentEntry) {
          const updatedBalance = Number(parentEntry.remainingbalance || 0) + Number(totalCostSum);

          const { error: updateError } = await supabase
            .from("amount_badget")
            .update({
              remainingbalance: updatedBalance,
            })
            .eq("id", parentEntry.id);

          if (updateError) {
            throw new Error("Failed to update remaining balance of cover visa.");
          }
        }
      }

      // Insert into Approval_History
      const { error: insertError } = await supabase.from("Approval_History").insert([
        {
          BabyVisaId: selectedVisa.visaCode || "",
          ApproverId: approverId,
          DateResponded: now,
          Response: "Cancelled",
          Type: "Cancellation",
          Notication: false,
        },
      ]);

      if (insertError) {
        setError("Failed to record cancellation: " + insertError.message);
        setShowMsg(true);
        setCancelling(false);
        return;
      }

      setSuccessMsg("Addendum cancellation recorded successfully.");
      setShowMsg(true);

      // Log to RecentActivity
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const { ip } = await ipRes.json();

        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const geo = await geoRes.json();

        const activityLog = {
          userId: approverId,
          device: navigator.userAgent || "Unknown Device",
          location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
          ip,
          time: now,
          action: `Cancelled addendum for ${selectedVisa.visaCode}`,
        };

        await supabase.from("RecentActivity").insert(activityLog);
      } catch (activityCatch) {
        console.warn("RecentActivity logging error:", activityCatch.message);
      }
    } catch (e) {
      setError("An error occurred: " + e.message);
      setShowMsg(true);
    }

    setCancelling(false);
  };



  
  useEffect(() => {
    if (!selectedVisa) return;

    async function checkIfCancelled() {
      try {
        const { data, error } = await supabase
          .from("Approval_History")
          .select("id")
          .eq("BabyVisaId", selectedVisa.visaCode)
          .eq("Response", "Cancelled")
          .eq("Type", "Cancellation")
          .limit(1);

        if (error) {
          console.error("Error checking cancellation:", error.message);
          setIsCancelled(false); // fallback
        } else {
          setIsCancelled(data && data.length > 0);
        }
      } catch (e) {
        console.error("Exception checking cancellation:", e.message);
        setIsCancelled(false);
      }
    }

    checkIfCancelled();
  }, [selectedVisa]);


async function deleteVisa({ visaCode, userId, setVisaData }) {
  if (!visaCode) return;

  const statusToCollection = {
    Regular: "Regular_Visa",
    Corporate: "Corporate_Visa",
    Cover: "Cover_Visa",
    RegularUpload: "RegularUpload",
  };

  let table = null;

  if (visaCode.startsWith("R")) {
    table = statusToCollection.Regular;
  } else if (visaCode.startsWith("C")) {
    table = statusToCollection.Corporate;
  } else if (visaCode.startsWith("V")) {
    table = statusToCollection.Cover;
  } else if (visaCode.startsWith("U")) {
    table = statusToCollection.RegularUpload;
  } else {
    await Swal.fire("Error", "Unrecognized visa code format.", "error");
    return;
  }

  try {
    // Delete from main visa table
    const { error } = await supabase.from(table).delete().eq("visaCode", visaCode);
    if (error) {
      console.error("Supabase delete error:", error);
      await Swal.fire("Error", "Failed to delete visa from Supabase.", "error");
      return;
    }

    // Delete from related tables depending on type
    const deleteRelatedTables = async (volumePlanTable, costDetailsTable, attachmentsTable = null) => {
      const { error: volumePlanError } = await supabase
        .from(volumePlanTable)
        .delete()
        .eq("visaCode", visaCode);

      if (volumePlanError) {
        console.error(`Failed to delete ${volumePlanTable}:`, volumePlanError);
        await Swal.fire("Error", "Failed to delete volume plan data.", "error");
        return false;
      }

      const { error: costDetailsError } = await supabase
        .from(costDetailsTable)
        .delete()
        .eq("visaCode", visaCode);

      if (costDetailsError) {
        console.error(`Failed to delete ${costDetailsTable}:`, costDetailsError);
        await Swal.fire("Error", "Failed to delete cost details data.", "error");
        return false;
      }

      if (attachmentsTable) {
        const { error: attachmentsError } = await supabase
          .from(attachmentsTable)
          .delete()
          .eq("visaCode", visaCode);

        if (attachmentsError) {
          console.error(`Failed to delete ${attachmentsTable}:`, attachmentsError);
          await Swal.fire("Error", "Failed to delete attachments.", "error");
          return false;
        }
      }

      return true;
    };

    // Route deletions
    if (table === "Regular_Visa" || table === "RegularUpload") {
      await deleteRelatedTables("Regular_Visa_VolumePlan", "Regular_Visa_CostDetails","Regular_Visa_Attachments");
    } else if (table === "Cover_Visa") {
      await deleteRelatedTables("Cover_Visa_VolumePlan", "Cover_Visa_CostDetails", "Cover_Visa_Attachments");
    }

    // Handle amount_badget
    const { data: amountBadgetRecords, error: fetchError } = await supabase
      .from("amount_badget")
      .select("*")
      .eq("visacode", visaCode);

    if (fetchError) {
      console.error("Failed to fetch amount_badget records:", fetchError);
    } else if (amountBadgetRecords?.length > 0) {
      for (const record of amountBadgetRecords) {
        const historyEntry = {
          original_id: record.id,
          visacode: record.visacode,
          amountbadget: record.amountbadget,
          createduser: record.createduser,
          createdate: record.createdate,
          remainingbalance: record.remainingbalance,
          RegularID: null,
          action_type: "DELETE",
          action_user: userId || "unknown",
          action_date: new Date().toISOString(),
          TotalCost: null,
        };

        const { error: historyError } = await supabase
          .from("amount_badget_history")
          .insert(historyEntry);

        if (historyError) {
          console.warn("Failed to insert into amount_badget_history:", historyError.message);
        }
      }

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

    // Log recent activity
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const { ip } = await ipRes.json();

      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geo = await geoRes.json();

      const activityLog = {
        userId: userId || "unknown",
        device: navigator.userAgent || "Unknown Device",
        location: `${geo.city || "Unknown"}, ${geo.region || "Unknown"}, ${geo.country_name || "Unknown"}`,
        ip,
        time: new Date().toISOString(),
        action: `Deleted visa with code: ${visaCode}`,
      };

      const { error: activityError } = await supabase.from("RecentActivity").insert(activityLog);

      if (activityError) {
        console.warn("Failed to log deletion activity:", activityError.message);
      }
    } catch (logErr) {
      console.warn("Logging failed:", logErr.message);
    }
  } catch (err) {
    console.error("Unexpected Supabase error:", err);
    await Swal.fire("Error", "Unexpected error deleting from Supabase.", "error");
  }
}






  const handleDeleteVisa = async (visa) => {
    if (!visa?.visaCode) return;

    const result = await Swal.fire({
      title: `Delete ${visa.visaCode}?`,
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, cancel",
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || "unknown";

      await deleteVisa({
        visaCode: visa.visaCode,
        userId,
        setVisaData: setVisas,
      });

      Swal.fire("Deleted!", `Visa ${visa.visaCode} has been deleted.`, "success");
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      Swal.fire("Cancelled", "The visa was not deleted.", "info");
    }
  };


  const handleViewDetails = (visa) => {
    if (visa.type === "Regular Upload") {
      setSelectedVisa(visa);
      setCurrentView("regularUploadDetails"); // new view state for RegularUpload
    } else if (visa?.visaCode?.startsWith("V2025")) {
      setSelectedVisa(visa);
      setCurrentView("details");
    } else if (visa?.visaCode?.startsWith("R2025")) {
      setSelectedVisa(visa);
      setCurrentView("regularDetails");
    } else if (visa?.visaCode?.startsWith("C2025")) {
      setSelectedVisa(visa);
      setCurrentView("corporateDetails");
    } else {
      alert("Visa ID must start with V2025, R2025, C2025, or be a Regular Upload");
    }
  };


  // Conditional rendering
  if (currentView === "details" && selectedVisa?.visaCode?.startsWith("V2025")) {
    return <View selectedVisa={selectedVisa} setCurrentView={setCurrentView} />;
  }
  if (currentView === "regularUploadDetails") {
    return <View_Regular_upload selectedVisa={selectedVisa} setCurrentView={setCurrentView} />;
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

  // --- Styles ---

  const getButtonStyle = () => {
    if (cancelling || isCancelled) {
      return {
        marginTop: 20,
        padding: "12px 30px",
        backgroundColor: "#a1a1aa", // gray
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 16,
        cursor: "not-allowed",
        boxShadow: "none",
        userSelect: "none",
      };
    }

    return {
      marginTop: 20,
      padding: "12px 30px",
      backgroundColor: "#ef4444", // red
      color: "#fff",
      border: "none",
      borderRadius: 8,
      fontWeight: 600,
      fontSize: 16,
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.5)",
      transition: "background-color 0.3s ease, box-shadow 0.3s ease",
      userSelect: "none",
    };
  };




  const visaGridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "15px",
    maxHeight: 250,
    overflowY: "auto",
    border: "1.5px solid #ccc",
    borderRadius: 8,
    padding: 10,
  };

  const visaCardStyle = {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
    cursor: "pointer",
    userSelect: "none",
    transition: "box-shadow 0.2s ease",
  };

  const visaCardSelectedStyle = {
    ...visaCardStyle,
    boxShadow: "0 0 10px 3px #4f46e5",
    backgroundColor: "#e0e7ff",
  };

  const detailSectionStyle = {
    marginTop: 25,
    backgroundColor: "#f9fafb",
    padding: isMobile ? 15 : 20,
    borderRadius: 10,
    boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.05)",
    opacity: showDetails ? 1 : 0,
    transform: showDetails ? "translateY(0)" : "translateY(10px)",
    transition: "opacity 0.4s ease, transform 0.4s ease",
  };

  const strongLabelStyle = {
    color: "#4f46e5",
  };
  const buttonStyle = {
    marginTop: 20,
    padding: "12px 30px",
    backgroundColor:
      // If visa is cancelled OR Notification === false → grey
      (isCancelled || (selectedVisa && selectedVisa.Notification === false))
        ? "#a1a1aa"  // grey
        : "#ef4444",  // red
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 16,
    cursor:
      cancelling || isCancelled || (selectedVisa && selectedVisa.Notification === false)
        ? "not-allowed"
        : "pointer",
    boxShadow:
      cancelling || isCancelled || (selectedVisa && selectedVisa.Notification === false)
        ? "none"
        : "0 4px 12px rgba(239, 68, 68, 0.5)",
    transition: "background-color 0.3s ease, box-shadow 0.3s ease",
    userSelect: "none",
  };


  const buttonHoverStyle = {
    backgroundColor: "#dc2626",
    boxShadow: "0 6px 20px rgba(220, 38, 38, 0.6)",
  };

  return (
    <div style={{ maxWidth: 1200, margin: "30px auto", padding: 20 }}>
      <h2 style={{ textAlign: "center" }}>Addendum Cancellation</h2>

      <input
        type="search"
        placeholder="Search  code or type..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 20,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      {filteredVisas.length === 0 ? (
        <p>No results found.</p>
      ) : (
        <div role="listbox" style={visaGridStyle}>
          {filteredVisas.map((visa) => {
            const isSelected = selectedVisa?.id === visa.id;
            return (
              <div
                key={visa.id}
                style={isSelected ? visaCardSelectedStyle : visaCardStyle}
                onClick={() => {
                  setSelectedVisa(visa);
                  setSuccessMsg(null);
                  setError(null);
                  setShowDetails(true);
                  setShowMsg(false);
                }}
              >
                <strong>{visa.visaCode || "N/A"}</strong>
                <br />
                <small>{visa.type}</small>
              </div>
            );
          })}
        </div>
      )}

      {selectedVisa && (
        <section
          style={{
            ...detailSectionStyle,
            marginTop: 20,
            opacity: showDetails ? 1 : 0,
            transform: showDetails ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
        >
          {/* Title and Visa Code on top */}
          <h3 style={{ marginBottom: 10 }}>{selectedVisa.type}</h3>
          <p style={{ fontWeight: "700", fontSize: 18, marginBottom: 20 }}>
            Code: {selectedVisa.visaCode || "N/A"}
          </p>

          {/* Then the rest in 3 columns grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "15px",
            }}
          >
            <div>
              <strong style={strongLabelStyle}>Company:</strong>{" "}
              {selectedVisa.company || "MEGASOFT"}
            </div>
            <div>
              <strong style={strongLabelStyle}>Principal:</strong>{" "}
              {selectedVisa.principal || "N/A"}
            </div>
            <div>
              <strong style={strongLabelStyle}>Brand:</strong> {selectedVisa.brand || "N/A"}
            </div>
            <div>
              <strong style={strongLabelStyle}>Sales Division:</strong>{" "}
              {selectedVisa.salesDivision || "N/A"}
            </div>
            <div>
              <strong style={strongLabelStyle}>Account Type:</strong>{" "}
              {selectedVisa.accountType || "N/A"}
            </div>
            <div>
              <strong style={strongLabelStyle}>Account:</strong> {selectedVisa.account || "N/A"}
            </div>
            {selectedVisa.type === "Regular Pwp " && (
              <>
                <div>
                  <strong style={strongLabelStyle}>IS PART OF COVER PWP?:</strong>{" "}
                  {selectedVisa.coverVisaCode || "N/A"}
                </div>

                {selectedVisa.coverVisaCode && (
                  <div>
                    <strong style={strongLabelStyle}>Remaining Balance:</strong>{" "}
                    {parentBalance !== null
                      ? `${Number(parentBalance).toLocaleString()} PHP`
                      : "N/A"}
                  </div>
                )}

                <div>
                  <strong style={strongLabelStyle}>Total Cost:</strong>{" "}
                  {totalCostSum !== null
                    ? `${Number(totalCostSum).toLocaleString()} PHP`
                    : "N/A"}
                </div>

                {!isCancelled &&
                  selectedVisa.coverVisaCode &&
                  parentBalance !== null &&
                  totalCostSum !== null && (
                    <div>
                      <strong style={strongLabelStyle}>Remaining After Revert:</strong>{" "}
                      {`${(Number(parentBalance) + Number(totalCostSum)).toLocaleString()} PHP`}
                    </div>
                  )}

              </>
            )}




          </div>

          {/* Cancel button spans all columns */}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              flexWrap: "wrap", // 👈 allows wrapping on small screens
              justifyContent: "center",
              gap: "1rem",
            }}
          >
            {/* Cancel Button */}
            <button
              onClick={cancelAddendum}
              disabled={cancelling || isCancelled}
              aria-disabled={cancelling || isCancelled}
              aria-live="polite"
              aria-busy={cancelling}
              style={{
                backgroundColor: "#ef4444",
                color: "#fff",
                padding: "10px 16px",
                fontSize: "16px",
                fontWeight: 600,
                border: "none",
                borderRadius: "8px",
                cursor: cancelling || isCancelled ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(239, 68, 68, 0.5)",
                flex: "1 1 200px",
                transition: "background-color 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                if (!cancelling && !isCancelled) {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                  e.currentTarget.style.boxShadow = "0 6px 14px rgba(220, 38, 38, 0.6)";
                }
              }}
              onMouseLeave={(e) => {
                if (!cancelling && !isCancelled) {
                  e.currentTarget.style.backgroundColor = "#ef4444";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.5)";
                }
              }}
            >
              {cancelling ? "Cancelling..." : isCancelled ? "Already Cancelled" : "Cancel Addendum"}
            </button>

            {/* View Button */}
            <button
              onClick={() => handleViewDetails(selectedVisa)}
              title="View Details"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 16px",
                backgroundColor: "#4f46e5",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "16px",
                cursor: "pointer",
                transition: "background-color 0.3s ease, transform 0.2s ease",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
                flex: "1 1 200px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#4338ca";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#4f46e5";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.96)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <FontAwesomeIcon icon={faSearch} />
              <span>View</span>
            </button>

            {/* Delete Button */}
            <button
              onClick={() => handleDeleteVisa(selectedVisa)}
              title="Delete Visa"
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: "10px 12px",
                color: "#d32f2f",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                flex: "1 1 60px", // narrower than others, but flexible
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
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: "24px" }} />
            </button>
          </div>


        </section>
      )}

      {error && <div style={{ marginTop: 20, color: "red" }}>{error}</div>}
      {successMsg && <div style={{ marginTop: 20, color: "green" }}>{successMsg}</div>}
    </div>
  );
}
