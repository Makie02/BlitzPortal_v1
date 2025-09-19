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

export default function AddendumCancellation({ cover_code }) {
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
          supabase.from("regular_pwp").select("*"),
          supabase.from("cover_pwp").select("*"),
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
    if (!selectedVisa?.visaCode || selectedVisa?.type !== "Regular Pwp") {
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
  if (!selectedVisa) {
    console.log("No selectedVisa found. Exiting cancelAddendum.");
    return;
  }

  console.log("Starting cancellation process for:", selectedVisa);

  // Step: Update remaining balance if applicable
  if (selectedVisa.coverPwpCode && selectedVisa.credit_budget != null) {
    try {
      const { data: budgetRows, error: fetchError } = await supabase
        .from("amount_badget")
        .select("id, remainingbalance")
        .eq("pwp_code", selectedVisa.coverPwpCode)
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching amount_badget:", fetchError.message);
      } else if (budgetRows) {
        const currentBalance = Number(budgetRows.remainingbalance || 0);
        const amountToAdd = Number(selectedVisa.credit_budget || 0);
        const newBalance = currentBalance + amountToAdd;

        const { error: updateBudgetError } = await supabase
          .from("amount_badget")
          .update({ remainingbalance: newBalance })
          .eq("id", budgetRows.id);

        if (updateBudgetError) {
          console.error("Error updating remaining balance:", updateBudgetError.message);
        } else {
          console.log(`✅ Updated Remaining Balance: PHP ${newBalance.toLocaleString()}`);
        }
      } else {
        console.warn("No matching pwp_code found in amount_badget for:", selectedVisa.coverPwpCode);
      }
    } catch (e) {
      console.error("Error handling amount_badget update:", e.message);
    }
  }

  setCancelling(true);
  setError(null);
  setSuccessMsg(null);
  setShowMsg(false);

  try {
    const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const approverId = currentUser?.UserID || "unknown";
    const now = new Date().toISOString();

    const pwpCodeToUse = selectedVisa.regularpwpcode || selectedVisa.cover_code;
    if (!pwpCodeToUse) {
      setError("No valid PwpCode to cancel.");
      setShowMsg(true);
      setCancelling(false);
      return;
    }

    // Step: Check if Approval_History already exists for this PwpCode
    const { data: existingApproval, error: fetchApprovalError } = await supabase
      .from("Approval_History")
      .select("*")
      .eq("PwpCode", pwpCodeToUse)
      .limit(1)
      .maybeSingle();

    if (fetchApprovalError) {
      console.error("Error checking Approval_History:", fetchApprovalError.message);
      setError("Failed to check approval history: " + fetchApprovalError.message);
      setShowMsg(true);
      setCancelling(false);
      return;
    }

    if (existingApproval) {
      // Record exists: UPDATE it
      const { error: updateError } = await supabase
        .from("Approval_History")
        .update({
          ApproverId: approverId,
          DateResponded: now,
          Response: "Cancelled",
          Type: "Cancellation",
          Notication: false,
        })
        .eq("PwpCode", pwpCodeToUse);

      if (updateError) {
        console.error("Error updating Approval_History:", updateError.message);
        setError("Failed to update cancellation: " + updateError.message);
        setShowMsg(true);
        setCancelling(false);
        return;
      }

      console.log("✅ Approval_History updated successfully.");
    } else {
      // No record: INSERT new cancellation record
      const { error: insertError } = await supabase
        .from("Approval_History")
        .insert([{
          PwpCode: pwpCodeToUse,
          ApproverId: approverId,
          DateResponded: now,
          Response: "Cancelled",
          Type: "Cancellation",
          Notication: false,
        }]);

      if (insertError) {
        console.error("Error inserting into Approval_History:", insertError.message);
        setError("Failed to insert cancellation: " + insertError.message);
        setShowMsg(true);
        setCancelling(false);
        return;
      }

      console.log("✅ Approval_History inserted successfully.");
    }

    setSuccessMsg("Addendum cancellation recorded successfully.");
    setShowMsg(true);
    setIsCancelled(true);

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
      console.log("📝 Activity logged successfully.");
    } catch (activityCatch) {
      console.warn("⚠️ Activity logging error:", activityCatch.message);
    }

  } catch (e) {
    console.error("General error in cancelAddendum:", e.message);
    setError("An error occurred: " + e.message);
    setShowMsg(true);
  }

  setCancelling(false);
  console.log("Cancellation process complete.");
};








  useEffect(() => {
    if (!selectedVisa) return;

    async function checkIfCancelled() {
      try {
        const { data, error } = await supabase
          .from("Approval_History")
          .select("id")
          .eq("PwpCode", selectedVisa.visaCode)
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

  useEffect(() => {
    const checkIfAlreadyCancelled = async () => {
      if (!selectedVisa) return;

      const pwpCodeToUse = selectedVisa.regularpwpcode || selectedVisa.cover_code;
      if (!pwpCodeToUse) return;

      const { data, error } = await supabase
        .from("Approval_History")
        .select("id")
        .eq("PwpCode", pwpCodeToUse)
        .eq("Type", "Cancellation")
        .limit(1);

      if (error) {
        console.error("Error checking for existing cancellation:", error.message);
      } else if (data && data.length > 0) {
        console.log("This addendum has already been cancelled.");
        setIsCancelled(true); // disables the button
      }
    };

    checkIfAlreadyCancelled();
  }, [selectedVisa]);




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
      try {
        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
        const userId = currentUser?.UserID || "unknown";

        // Delete from regular_pwp
        let { error: errPwp } = await supabase
          .from("regular_pwp")
          .delete()
          .eq("regularpwpcode", visa.visaCode);

        if (errPwp) throw new Error(`Failed to delete from regular_pwp: ${errPwp.message}`);

        // Delete from regular_accountlis_badget
        let { error: errAccountBadget } = await supabase
          .from("regular_accountlis_badget")
          .delete()
          .eq("regularcode", visa.visaCode);

        if (errAccountBadget) throw new Error(`Failed to delete from regular_accountlis_badget: ${errAccountBadget.message}`);

        // Delete from regular_attachments
        let { error: errAttachments } = await supabase
          .from("regular_attachments")
          .delete()
          .eq("regularpwpcode", visa.visaCode);

        if (errAttachments) throw new Error(`Failed to delete from regular_attachments: ${errAttachments.message}`);

        // Delete from Approval_History
        let { error: errApproval } = await supabase
          .from("Approval_History")
          .delete()
          .eq("PwpCode", visa.visaCode);

        if (errApproval) throw new Error(`Failed to delete from Approval_History: ${errApproval.message}`);

        // Delete from amount_badget
        let { error: errAmountBadget } = await supabase
          .from("amount_badget")
          .delete()
          .eq("pwp_code", visa.visaCode);

        if (errAmountBadget) throw new Error(`Failed to delete from amount_badget: ${errAmountBadget.message}`);

        // Optional: call your existing deleteVisa function if needed
        // await deleteVisa({ visaCode: visa.visaCode, userId, setVisaData: setVisas });

        Swal.fire("Deleted!", `Visa ${visa.visaCode} has been deleted.`, "success");
        // Optionally refresh your visas list here
      } catch (error) {
        Swal.fire("Error", error.message || "Failed to delete visa data.", "error");
      }
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      Swal.fire("Cancelled", "The visa was not deleted.", "info");
    }
  };




  // --- Styles ---



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
    <div style={{ maxWidth: 1500, margin: "30px auto", padding: 20 }}>
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
                <strong>{visa.regularpwpcode || visa.cover_code || "N/A"}</strong>
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
            Code: {selectedVisa?.regularpwpcode || selectedVisa?.cover_code || "N/A"}
          </p>



          {/* Then the rest in 3 columns grid */}
          {/* Left (info grid) + Right (PWP card) side-by-side layout */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "24px",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
          >
            {/* Left side: 3-column grid */}
            <div
              style={{
                flex: "1 1 60%",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "15px",
                minWidth: "300px",
              }}
            >
              <div>
                <strong style={strongLabelStyle}>Company:</strong>{" "}
                {selectedVisa.company || "MEGASOFT"}
              </div>
              <div>
                <strong style={strongLabelStyle}>Distributor:</strong>{" "}
                {selectedVisa.distributor_code || selectedVisa.distributor || "N/A"}
              </div>
              <div>
                <strong style={strongLabelStyle}>Category:</strong>{" "}
                {selectedVisa.categoryName || "N/A"}
              </div>

              <div>
                <strong style={strongLabelStyle}>Account Type:</strong>{" "}
                {selectedVisa.accountType || "N/A"}
              </div>
              <div>
                <strong style={strongLabelStyle}>Activity:</strong>{" "}
                {selectedVisa.activity || "N/A"}
              </div>
            </div>

            {/* Right side: Regular PWP card */}
            {selectedVisa.type === "Regular Pwp" && (
              <div
                style={{
                  flex: "1 1 35%",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  padding: "20px",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                  minWidth: "280px",
                }}
              >
                <h4
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    marginBottom: "15px",
                    color: "#1f2937",
                    borderBottom: "1px solid #f3f4f6",
                    paddingBottom: "10px",
                  }}
                >
                  Regular PWP Details :{selectedVisa.coverPwpCode || "N/A"}
                </h4>

                <div style={{ marginBottom: "12px" }}>
                  <strong style={strongLabelStyle}>IS PART OF COVER PWP?:</strong>{" "}
                  {selectedVisa.isPartOfCoverPwp == null
                    ? "N/A"
                    : selectedVisa.isPartOfCoverPwp
                      ? "Yes"
                      : "No"}
                </div>

                {selectedVisa.isPartOfCoverPwp && (
                  <div style={{ marginBottom: "12px" }}>
                    <strong style={strongLabelStyle}>Remaining Balance:</strong>{" "}
                    PHP   {selectedVisa.remaining_balance != null
                      ? `${Number(selectedVisa.remaining_balance).toLocaleString()} `
                      : "N/A"}
                  </div>
                )}

                <div style={{ marginBottom: "12px" }}>
                  <strong style={strongLabelStyle}>Total Cost:</strong>{" "}
                  PHP  {selectedVisa.credit_budget != null
                    ? `${Number(selectedVisa.credit_budget).toLocaleString()} `
                    : "N/A"}
                </div>

                {!isCancelled &&
                  selectedVisa.coverPwpCode &&
                  parentBalance !== null &&
                  totalCostSum !== null && (
                    <div style={{ marginBottom: "12px" }}>
                      <strong style={strongLabelStyle}>Remaining After Revert:</strong>{" "}
                      {`${(Number(parentBalance) + Number(totalCostSum)).toLocaleString()} PHP`}
                    </div>
                  )}
              </div>
            )}
          </div>


          {/* Cancel button spans all columns */}
    
            {/* Cancel Button */}
            <button
              onClick={!isCancelled ? cancelAddendum : undefined}
              disabled={cancelling || isCancelled}
              aria-disabled={cancelling || isCancelled}
              aria-live="polite"
              aria-busy={cancelling}
              style={{
                backgroundColor: isCancelled
                  ? "#9ca3af" // Tailwind's gray-400
                  : "#ef4444", // red-500
                color: "#fff",
                padding: "10px 16px",
                fontSize: "16px",
                fontWeight: 600,
                border: "none",
                borderRadius: "8px",
                cursor: cancelling || isCancelled ? "not-allowed" : "pointer",
                boxShadow: isCancelled
                  ? "0 2px 6px rgba(107, 114, 128, 0.4)" // subtle gray shadow
                  : "0 4px 12px rgba(239, 68, 68, 0.5)",
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
              {cancelling
                ? "Cancelling..."
                : isCancelled
                  ? "Already Cancelled"
                  : "Cancel Addendum"}
            </button>



            {/* Delete Button */}
            {/* Delete Button */}
            {/* <button
              onClick={isCancelled ? () => handleDeleteVisa(selectedVisa) : undefined}
              title="Delete Visa"
              disabled={!isCancelled || cancelling}
              aria-disabled={!isCancelled || cancelling}
              style={{
                border: "none",
                background: "none",
                cursor: !isCancelled || cancelling ? "not-allowed" : "pointer",
                padding: "10px 12px",
                color: !isCancelled || cancelling ? "#9ca3af" : "#d32f2f", // gray out if disabled
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                boxShadow: !isCancelled || cancelling
                  ? "none"
                  : "0 4px 6px rgba(0,0,0,0.2)",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                flex: "1 1 60px",
                pointerEvents: !isCancelled || cancelling ? "none" : "auto",
              }}
              onMouseEnter={(e) => {
                if (isCancelled && !cancelling) {
                  e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                  e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 47, 47, 0.5)";
                }
              }}
              onMouseLeave={(e) => {
                if (isCancelled && !cancelling) {
                  e.currentTarget.style.transform = "scale(1) rotateX(0) rotateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
                }
              }}
              onMouseDown={(e) => {
                if (isCancelled && !cancelling) {
                  e.currentTarget.style.transform = "scale(0.95) rotateX(5deg) rotateY(5deg)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
                }
              }}
              onMouseUp={(e) => {
                if (isCancelled && !cancelling) {
                  e.currentTarget.style.transform = "scale(1.1) rotateX(10deg) rotateY(10deg)";
                  e.currentTarget.style.boxShadow = "0 8px 15px rgba(211, 47, 47, 0.5)";
                }
              }}
            >
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: "24px" }} />
            </button> */}


          


        </section>
      )}

      {error && <div style={{ marginTop: 20, color: "red" }}>{error}</div>}
      {successMsg && <div style={{ marginTop: 20, color: "green" }}>{successMsg}</div>}
    </div>
  );
}
