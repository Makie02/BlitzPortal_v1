import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faTimesCircle, faExclamationTriangle, faUser } from "@fortawesome/free-solid-svg-icons";

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isCancelled, setIsCancelled] = useState(false);
  const [parentBalance, setParentBalance] = useState(null);
  const [totalCostSum, setTotalCostSum] = useState(null);
  const [creatorName, setCreatorName] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [loggedInUser, setLoggedInUser] = useState(() => {
    const userData = localStorage.getItem("loggedInUser");
    return userData ? JSON.parse(userData) : null;
  });

  useEffect(() => {
    async function fetchVisas() {
      if (!loggedInUser) return; // don't fetch if no user
      setLoading(true);
      setError(null);

      try {
        const { data: regular = [], error } = await supabase
          .from("regular_pwp")
          .select("*");

        if (error) throw error;

        const currentUserId = Number(loggedInUser?.UserID) || null;
        const currentUserName = (loggedInUser?.name || "").toLowerCase().trim();

        // filter visas created by this user
        const filteredByUser = regular.filter(v => {
          const createFormId = Number(v.createForm) || null;
          const createFormName = (v.createFormName || "").toLowerCase().trim();
          return createFormId === currentUserId || createFormName === currentUserName;
        });

        setVisas(
          filteredByUser.map(v => ({ ...v, type: "Regular Pwp", display: v.visaCode }))
        );
        setFilteredVisas(
          filteredByUser.map(v => ({ ...v, type: "Regular Pwp", display: v.visaCode }))
        );
      } catch (err) {
        console.error("Error fetching visas:", err);
        setError("Unexpected error while fetching visas.");
      }

      setLoading(false);
    }

    fetchVisas();
  }, [loggedInUser]);


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
          (v.regularpwpcode && v.regularpwpcode.toLowerCase().includes(lowerSearch)) ||
          (v.type && v.type.toLowerCase().includes(lowerSearch))
      )
    );
  }, [debouncedSearchTerm, visas]);




  useEffect(() => {
    if (!selectedVisa?.createForm) {
      setCreatorName(null);
      return;
    }

    const fetchCreatorName = async () => {
      const { data, error } = await supabase
        .from("Account_Users")
        .select("name")
        .eq("UserID", selectedVisa.createForm)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch creator name:", error.message);
        setCreatorName(null);
      } else {
        setCreatorName(data?.name || "Unknown");
      }
    };

    fetchCreatorName();
  }, [selectedVisa?.createForm]); // ✅ dependency fixed


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

    try {
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const approverId = currentUser?.UserID || "unknown";
      const now = new Date().toISOString();

      const pwpCodeToUse = selectedVisa.regularpwpcode || selectedVisa.cover_code;
      if (!pwpCodeToUse) {
        setError("No valid PwpCode to cancel.");
        setCancelling(false);
        return;
      }

      const { data: existingApproval, error: fetchApprovalError } = await supabase
        .from("Approval_History")
        .select("*")
        .eq("PwpCode", pwpCodeToUse)
        .limit(1)
        .maybeSingle();

      if (fetchApprovalError) {
        console.error("Error checking Approval_History:", fetchApprovalError.message);
        setError("Failed to check approval history: " + fetchApprovalError.message);
        setCancelling(false);
        return;
      }

      if (existingApproval) {
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
          setCancelling(false);
          return;
        }

        console.log("✅ Approval_History updated successfully.");
      } else {
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
          setCancelling(false);
          return;
        }

        console.log("✅ Approval_History inserted successfully.");
      }

      setSuccessMsg("Addendum cancellation recorded successfully.");
      setIsCancelled(true);

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
          action: `Cancelled addendum for ${selectedVisa.visaCode || selectedVisa.regularpwpcode}`,
        };

        await supabase.from("RecentActivity").insert(activityLog);
        console.log("📝 Activity logged successfully.");
      } catch (activityCatch) {
        console.warn("⚠️ Activity logging error:", activityCatch.message);
      }

    } catch (e) {
      console.error("General error in cancelAddendum:", e.message);
      setError("An error occurred: " + e.message);
    }

    setCancelling(false);
    console.log("Cancellation process complete.");
  };

  useEffect(() => {
    if (!selectedVisa) return;

    async function checkIfCancelled() {
      try {
        const pwpCodeToCheck = selectedVisa.regularpwpcode || selectedVisa.visaCode;
        const { data, error } = await supabase
          .from("Approval_History")
          .select("id")
          .eq("PwpCode", pwpCodeToCheck)
          .eq("Response", "Cancelled")
          .eq("Type", "Cancellation")
          .limit(1);

        if (error) {
          console.error("Error checking cancellation:", error.message);
          setIsCancelled(false);
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
        setIsCancelled(true);
      }
    };

    checkIfAlreadyCancelled();
  }, [selectedVisa]);

  const [distributorName, setDistributorName] = useState("");

  useEffect(() => {
    const fetchDistributorName = async () => {
      if (!selectedVisa) return; // ✅ don't run if null

      const code = selectedVisa.distributor_code || selectedVisa.distributor;
      if (!code) {
        setDistributorName("N/A");
        return;
      }

      const { data, error } = await supabase
        .from("distributors")
        .select("name")
        .eq("code", code)
        .single();

      if (error) {
        console.error("Error fetching distributor name:", error.message);
        setDistributorName(code || "N/A");
      } else {
        setDistributorName(data?.name || code || "N/A");
      }
    };

    fetchDistributorName();
  }, [selectedVisa]);

  const [activityName, setActivityName] = useState("");

  useEffect(() => {
    const fetchActivityName = async () => {
      if (!selectedVisa) return; // ✅ prevent null crash

      const code = selectedVisa.activity;
      if (!code) {
        setActivityName("N/A");
        return;
      }

      const { data, error } = await supabase
        .from("activity")
        .select("name")
        .eq("code", code)
        .single();

      if (error) {
        console.error("Error fetching activity name:", error.message);
        setActivityName(code || "N/A");
      } else {
        setActivityName(data?.name || code || "N/A");
      }
    };

    fetchActivityName();
  }, [selectedVisa]);

  return (
    <div style={{
      padding: isMobile ? "20px 10px" : "40px 20px"
    }}>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .scroll-container::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .scroll-container::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          .scroll-container::-webkit-scrollbar-thumb {
            background: #667eea;
            border-radius: 10px;
          }
          .scroll-container::-webkit-scrollbar-thumb:hover {
            background: #5568d3;
          }
        `}
      </style>

      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        backgroundColor: "#ffffff",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        padding: isMobile ? 20 : 40,
        animation: "fadeIn 0.5s ease-in"
      }}>
        <div style={{
          textAlign: "center",
          marginBottom: 40,
          borderBottom: "3px solid #667eea",
          paddingBottom: 20
        }}>
          <h1 style={{
            fontSize: isMobile ? 28 : 42,
            fontWeight: 800,
            WebkitBackgroundClip: "text",
            marginBottom: 10
          }}>
            Addendum Cancellation
          </h1>
          <p style={{
            color: "#6b7280",
            fontSize: isMobile ? 14 : 16
          }}>
            Search and cancel regular PWP addendums
          </p>
        </div>

        <div style={{ position: "relative", marginBottom: 30 }}>
          <FontAwesomeIcon
            icon={faSearch}
            style={{
              position: "absolute",
              left: 15,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
              fontSize: 18
            }}
          />
          <input
            type="search"
            placeholder="🔍 Search by PWP code or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "16px 16px 16px 50px",
              fontSize: 16,
              border: "2px solid #e5e7eb",
              borderRadius: 12,
              outline: "none",
              transition: "all 0.3s ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#667eea";
              e.target.style.boxShadow = "0 4px 16px rgba(102, 126, 234, 0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e5e7eb";
              e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
            }}
          />
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{
              display: "inline-block",
              width: 50,
              height: 50,
              border: "5px solid #f3f4f6",
              borderTop: "5px solid #667eea",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
            <p style={{ marginTop: 20, color: "#6b7280", fontSize: 16 }}>Loading addendums...</p>
          </div>
        )}

        {!loading && filteredVisas.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: 60,
            backgroundColor: "#f9fafb",
            borderRadius: 12,
            border: "2px dashed #d1d5db"
          }}>
            <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: 48, color: "#fbbf24", marginBottom: 20 }} />
            <p style={{ fontSize: 18, color: "#6b7280", fontWeight: 500 }}>No results found.</p>
            <p style={{ fontSize: 14, color: "#9ca3af", marginTop: 10 }}>Try adjusting your search query.</p>
          </div>
        ) : !loading && (
          <div className="scroll-container" style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
            maxHeight: 400,
            overflowY: "auto",
            padding: 10,
            backgroundColor: "#f9fafb",
            borderRadius: 12,
            border: "2px solid #e5e7eb"
          }}>
            {filteredVisas.map((visa) => {
              const isSelected = selectedVisa?.id === visa.id;
              const isVisaCancelled = visa.Response === "Cancelled" || visa.isCancelled;

              return (
                <div
                  key={visa.id}
                  onClick={() => {
                    setSelectedVisa(visa);
                    setSuccessMsg(null);
                    setError(null);
                    setShowDetails(true);
                  }}
                  style={{
                    backgroundColor: isVisaCancelled
                      ? "#fee2e2" // light red for cancelled
                      : isSelected
                        ? "#eef2ff"
                        : "#ffffff",
                    padding: 20,
                    borderRadius: 12,
                    border: isSelected
                      ? "3px solid #667eea"
                      : isVisaCancelled
                        ? "2px solid #ef4444"
                        : "2px solid #e5e7eb",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: isSelected
                      ? "0 8px 24px rgba(102, 126, 234, 0.3)"
                      : "0 2px 8px rgba(0,0,0,0.05)",
                    transform: isSelected ? "translateY(-4px)" : "translateY(0)"
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isVisaCancelled) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isVisaCancelled) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                    }
                  }}
                >
                  <div style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#1f2937",
                    marginBottom: 8
                  }}>
                    📋 {visa.regularpwpcode || visa.cover_code || "N/A"}
                  </div>
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    backgroundColor: isVisaCancelled ? "#fca5a5" : "#ddd6fe", // badge
                    color: isVisaCancelled ? "#7f1d1d" : "#003cffff",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {isVisaCancelled ? "Cancelled" : visa.type}
                  </div>
                </div>
              );
            })}


          </div>
        )}

        {selectedVisa && (
          <div
            style={{
              marginTop: 40,
              backgroundColor: "#f9fafb",
              padding: isMobile ? 20 : 30,
              borderRadius: 16,
              border: "2px solid #e5e7eb",
              boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
              opacity: showDetails ? 1 : 0,
              transform: showDetails ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.5s ease"
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 30,
              paddingBottom: 20,
              borderBottom: "2px solid #e5e7eb",
              gap: 15
            }}>
              <div>
                <h2 style={{
                  fontSize: isMobile ? 22 : 28,
                  fontWeight: 700,
                  color: "#1f2937",
                  marginBottom: 8
                }}>
                  {selectedVisa.type}
                </h2>
                <p style={{
                  fontSize: isMobile ? 16 : 20,
                  fontWeight: 600,
                  color: "#667eea"
                }}>
                  Code: {selectedVisa?.regularpwpcode || selectedVisa?.cover_code || "N/A"}
                </p>
              </div>
              {isCancelled && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  backgroundColor: "#fee2e2",
                  borderRadius: 20,
                  border: "2px solid #ef4444"
                }}>
                  <FontAwesomeIcon icon={faTimesCircle} style={{ color: "#ef4444" }} />
                  <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 14 }}>
                    Cancelled
                  </span>
                </div>
              )}
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: 20,
              marginBottom: 30
            }}>
              <div style={{
                padding: 16,
                backgroundColor: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e5e7eb"
              }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>🏢 COMPANY</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                  {creatorName === null ? (
                    <span style={{ color: "#9ca3af", animation: "pulse 1.5s infinite" }}>Loading...</span>
                  ) : loggedInUser?.UserID === selectedVisa.createForm ? (
                    // If same user, display uppercase
                    creatorName.toUpperCase()
                  ) : (
                    // Otherwise, normal casing
                    creatorName
                  )}
                </div>

              </div>

              <div style={{
                padding: 16,
                backgroundColor: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e5e7eb"
              }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>🤝 DISTRIBUTOR</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                  {distributorName || "N/A"}

                </div>
              </div>

              <div style={{
                padding: 16,
                backgroundColor: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e5e7eb"
              }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>📂 CATEGORY</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                  {selectedVisa.categoryName || "N/A"}
                </div>
              </div>

              <div style={{
                padding: 16,
                backgroundColor: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e5e7eb"
              }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>💼 ACCOUNT TYPE</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                  {selectedVisa.accountType || "N/A"}
                </div>
              </div>

              <div style={{
                padding: 16,
                backgroundColor: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e5e7eb"
              }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>⚡ ACTIVITY</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                  {activityName || "N/A"}
                </div>
              </div>

              <div style={{
                padding: 16,
                backgroundColor: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e5e7eb"
              }}>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>
                  <FontAwesomeIcon icon={faUser} style={{ marginRight: 6 }} />
                  CREATED BY
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                  {creatorName === null ? (
                    <span style={{ color: "#9ca3af", animation: "pulse 1.5s infinite" }}>Loading...</span>
                  ) : (
                    creatorName
                  )}
                </div>
              </div>
            </div>

            {selectedVisa.type === "Regular Pwp" && (
              <div style={{
                backgroundColor: "#ffffff",
                padding: 24,
                borderRadius: 12,
                border: "2px solid #667eea",
                boxShadow: "0 4px 16px rgba(102, 126, 234, 0.1)",
                marginBottom: 30
              }}>
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#667eea",
                  marginBottom: 20,
                  paddingBottom: 12,
                  borderBottom: "2px solid #eef2ff"
                }}>
                  💳 Regular PWP Details: {selectedVisa.coverPwpCode || "N/A"}
                </h3>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                  gap: 16
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>
                      IS PART OF COVER PWP?
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1f2937" }}>
                      {selectedVisa.isPartOfCoverPwp == null
                        ? "N/A"
                        : selectedVisa.isPartOfCoverPwp
                          ? "✅ Yes"
                          : "❌ No"}
                    </div>
                  </div>

                  {selectedVisa.isPartOfCoverPwp && (
                    <div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>
                        REMAINING BALANCE
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#059669" }}>
                        ₱ {selectedVisa.remaining_balance != null
                          ? Number(selectedVisa.remaining_balance).toLocaleString()
                          : "N/A"}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>
                      TOTAL COST
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>
                      ₱ {selectedVisa.credit_budget != null
                        ? Number(selectedVisa.credit_budget).toLocaleString()
                        : "N/A"}
                    </div>
                  </div>

                  {!isCancelled &&
                    selectedVisa.coverPwpCode &&
                    parentBalance !== null &&
                    totalCostSum !== null && (
                      <div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>
                          REMAINING AFTER REVERT
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#2563eb" }}>
                          ₱ {(Number(parentBalance) + Number(totalCostSum)).toLocaleString()}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}

            <button
              onClick={!isCancelled ? cancelAddendum : undefined}
              disabled={cancelling || isCancelled}
              style={{
                width: "100%",
                padding: "16px 32px",
                fontSize: 18,
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: isCancelled ? "#9ca3af" : "#ef4444",
                border: "none",
                borderRadius: 12,
                cursor: cancelling || isCancelled ? "not-allowed" : "pointer",
                boxShadow: isCancelled ? "none" : "0 8px 24px rgba(239, 68, 68, 0.4)",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12
              }}
              onMouseEnter={(e) => {
                if (!cancelling && !isCancelled) {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 12px 32px rgba(220, 38, 38, 0.5)";
                }
              }}
              onMouseLeave={(e) => {
                if (!cancelling && !isCancelled) {
                  e.currentTarget.style.backgroundColor = "#ef4444";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(239, 68, 68, 0.4)";
                }
              }}
            >
              {cancelling ? (
                <>
                  <div style={{
                    width: 20,
                    height: 20,
                    border: "3px solid #ffffff",
                    borderTop: "3px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                  Cancelling...
                </>
              ) : isCancelled ? (
                <>
                  <FontAwesomeIcon icon={faTimesCircle} />
                  Already Cancelled
                </>
              ) : (
                <>
                  🚫 Cancel Addendum
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 20,
            padding: "16px 20px",
            backgroundColor: "#fee2e2",
            border: "2px solid #ef4444",
            borderRadius: 12,
            color: "#dc2626",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "fadeIn 0.3s ease"
          }}>
            <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: 20 }} />
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            marginTop: 20,
            padding: "16px 20px",
            backgroundColor: "#d1fae5",
            border: "2px solid #10b981",
            borderRadius: 12,
            color: "#047857",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "fadeIn 0.3s ease"
          }}>
            <span style={{ fontSize: 20 }}>✅</span>
            {successMsg}
          </div>
        )}
      </div>
    </div>
  );
}
