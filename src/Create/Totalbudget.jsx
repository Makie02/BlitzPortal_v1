import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from "sweetalert2";
import { supabase } from "../supabaseClient";

const Total = () => {
  const [formData, setFormData] = useState({
    visaCode: "",
    coverCode: "",
    distributor: "",
    principal: "",
    amountbadget: "",
    PWPType: "COVER",
    Notification: false,
  });
  const [userPermissions, setUserPermissions] = useState({
    create_budget: false,
    view_budget: false,
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [displayedRemainingBudget, setDisplayedRemainingBudget] = useState(null);
  const [budgetYears, setBudgetYears] = useState([]);
  const [loadingBudgetYear, setLoadingBudgetYear] = useState(false);
  const [selectedDistributorName, setSelectedDistributorName] = useState("");

  const fetchBudgetYear = async (distributorCode) => {
    try {
      setLoadingBudgetYear(true);
      console.log("📅 Fetching ALL budget years for distributor:", distributorCode);

      const { data: coverData, error: coverError } = await supabase
        .from("cover_pwp")
        .select("budget_year, cover_code, amount_badget, created_at")
        .eq("distributor_code", distributorCode.toString())
        .order("budget_year", { ascending: false });

      if (coverError) {
        console.error("❌ Error fetching budget years:", coverError);
        throw coverError;
      }

      if (coverData && coverData.length > 0) {
        const yearMap = {};
        let grandTotal = 0;

        coverData.forEach(item => {
          const year = item.budget_year || new Date().getFullYear();
          const amount = parseFloat(item.amount_badget || 0);

          if (!yearMap[year]) {
            yearMap[year] = {
              year: year,
              totalBudget: 0,
              count: 0
            };
          }
          yearMap[year].totalBudget += amount;
          yearMap[year].count += 1;
          grandTotal += amount;
        });

        const years = Object.values(yearMap);
        console.log("✅ Found budget years:", years);
        console.log("💰 Grand Total from all years:", grandTotal);
        setBudgetYears(years);

        // Update the displayed remaining budget with grand total
        setDisplayedRemainingBudget(grandTotal);
        setRemainingBudget(grandTotal);
      } else {
        console.log("⚠️ No cover_pwp data found for this distributor");
        setBudgetYears([]);
        setDisplayedRemainingBudget(null);
      }
    } catch (err) {
      console.error("❌ Error fetching budget years:", err);
      setBudgetYears([]);
      setDisplayedRemainingBudget(null);
    } finally {
      setLoadingBudgetYear(false);
    }
  };

  const handleFormChange = async (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedFormData = { ...prev, [name]: value };
      return updatedFormData;
    });

    if (name === "distributor") {
      console.log("🔍 Distributor field changed, fetching budget info...");
      console.log("Selected distributor code:", value);

      try {
        const selectedDistributor = distributors.find((d) => {
          return d.code == value || d.code === value;
        });

        if (!selectedDistributor) {
          console.warn("⚠️ Distributor not found for code:", value);
          console.log("Available distributors:", distributors);
          setSelectedDistributorName("");
          setBudgetYears([]);
          return;
        }

        console.log("📦 Selected distributor:", selectedDistributor);
        setSelectedDistributorName(selectedDistributor.name);

        await fetchBudgetYear(value);

        const { data: budgetData, error: budgetError } = await supabase
          .from("amount_badget")
          .select("amountbadget, remainingbalance, createduser, distributor")
          .eq("distributor", value.toString())
          .order("id", { ascending: false })
          .limit(1);

        console.log("💾 Budget query result:", budgetData);

        if (budgetError) {
          console.error("❌ Error fetching budget:", budgetError);
          return;
        }

        if (budgetData && budgetData.length > 0) {
          const budget = budgetData[0];
          console.log("💰 Budget data found:", budget);

          const budgetAmount = budget.amountbadget || "";
          const remainingBalance = parseFloat(budget.remainingbalance) || 0;

          setFormData((prev) => ({
            ...prev,
            amountbadget: budgetAmount,
          }));

          setRemainingBudget(remainingBalance);
          setDisplayedRemainingBudget(remainingBalance);

          await Swal.fire({
            icon: "success",
            title: "Budget Loaded! 🎉",
            html: `
              <div style="text-align: left; padding: 10px;">
                <p><strong>📦 Distributor:</strong> ${selectedDistributor.name}</p>
                <p><strong>📅 Budget Years:</strong> ${budgetYears.map(y => y.year).join(', ') || 'N/A'}</p>
                <p><strong>💰 Amount Budget:</strong> ₱${parseFloat(budgetAmount || 0).toLocaleString()}</p>
                <p><strong>💵 Remaining Balance:</strong> ₱${remainingBalance.toLocaleString()}</p>
              </div>
            `,
            timer: 3000,
            showConfirmButton: false,
          });
        } else {
          console.log("ℹ️ No budget data found for this distributor");
          setFormData((prev) => ({
            ...prev,
            amountbadget: "",
          }));
          setRemainingBudget(0);
          setDisplayedRemainingBudget(null);

          await Swal.fire({
            icon: "info",
            title: "No Budget Found",
            text: `No budget data found for ${selectedDistributor.name}. Please enter manually.`,
            timer: 2000,
            showConfirmButton: false,
          });
        }

      } catch (error) {
        console.error("❌ Failed to fetch budget details:", error.message);
      }
    }
  };

  const [accountTypes, setAccountTypes] = useState([]);
  const [approvedExpenses, setApprovedExpenses] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);

  useEffect(() => {
    const amountBudget = parseFloat(formData.amountbadget) || 0;
    const remaining = amountBudget - approvedExpenses;
    setRemainingBudget(remaining);
  }, [formData.amountbadget, approvedExpenses]);

  const formatCurrency = (value) => {
    if (value === "") return "";
    const number = parseFloat(value);
    if (isNaN(number)) return value;
    return number.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  };

  useEffect(() => {
    const checkUserPermissions = async () => {
      const storedUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const username = storedUser?.name;

      if (!username) return;

      const { data, error } = await supabase
        .from("TotalBudget")
        .select("create_budget, view_budget")
        .eq("username", username)
        .single();

      if (!error && data) {
        setUserPermissions({
          create_budget: data.create_budget || false,
          view_budget: data.view_budget || false,
        });
      }
    };

    checkUserPermissions();
  }, []);

  useEffect(() => {
    const fetchApprovedExpenses = async () => {
      if (!formData.visaCode) return;

      try {
        const { data, error } = await supabase
          .from("approved_pwp_expenses")
          .select("amount")
          .eq("visa_code", formData.visaCode)
          .eq("status", "approved");

        if (error) {
          console.error("Error fetching approved expenses:", error);
          return;
        }

        const totalExpenses = data.reduce(
          (sum, expense) => sum + (parseFloat(expense.amount) || 0),
          0
        );
        setApprovedExpenses(totalExpenses);
      } catch (err) {
        console.error("Error calculating approved expenses:", err);
      }
    };

    fetchApprovedExpenses();
  }, [formData.visaCode]);

  const [singleApprovals, setSingleApprovals] = useState([]);
  const [userApprovers, setUserApprovers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: approvalsData, error: approvalsError } = await supabase
        .from("singleapprovals")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: userApproversData, error: userApproversError } =
        await supabase
          .from("User_Approvers")
          .select("*")
          .order("created_at", { ascending: false });

      const { data: usersData, error: usersError } = await supabase
        .from("Account_Users")
        .select("UserID, name");

      if (approvalsError)
        console.error("Error fetching approvals:", approvalsError);
      if (userApproversError)
        console.error("Error fetching user approvers:", userApproversError);
      if (usersError) console.error("Error fetching users:", usersError);

      setSingleApprovals(approvalsData || []);
      setUserApprovers(userApproversData || []);
      setUsers(usersData || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const [totalRemaining, setTotalRemaining] = React.useState(null);

  const fetchRemainingBalance = React.useCallback(async () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser || !storedUser.name) return;

    const { data, error } = await supabase
      .from("amount_badget")
      .select("remainingbalance")
      .eq("createduser", storedUser.name)
      .or("Approved.is.null,Approved.eq.true");

    if (error) {
      console.error("Error fetching remaining balance:", error);
      return;
    }

    const total = data.reduce(
      (acc, item) => acc + parseFloat(item.remainingbalance),
      0
    );
    setTotalRemaining(total);
  }, []);

  React.useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser || !storedUser.name) return;

    fetchRemainingBalance();

    const subscription = supabase
      .channel("public:amount_badget")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "amount_badget",
          filter: `createduser=eq.${storedUser.name}`,
        },
        (payload) => {
          fetchRemainingBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchRemainingBalance]);

  useEffect(() => {
    const fetchAccounts = async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("code", { ascending: true });
      if (error) {
        console.error("Error fetching account types:", error.message);
      } else {
        setAccountTypes(data);
      }
    };
    fetchAccounts();
  }, []);

  const selectedNames = accountTypes
    .filter(
      (opt) => formData.accountType && formData.accountType.includes(opt.id)
    )
    .map((opt) => opt.name)
    .join(", ");

  const [allCoverCodes, setAllCoverCodes] = useState([]);
  const [loadingCoverCode, setLoadingCoverCode] = useState(true);

  useEffect(() => {
    async function fetchCoverCodes() {
      const { data, error } = await supabase
        .from("cover_pwp")
        .select("cover_code");

      if (error) {
        console.error("Error fetching cover codes:", error);
        setLoadingCoverCode(false);
      } else {
        const codes = data.map((row) => row.cover_code).filter(Boolean);

        setAllCoverCodes(codes);

        if (!formData.coverCode) {
          const newCode = generateCoverCode(codes);
          setFormData((prev) => ({ ...prev, coverCode: newCode }));
        }

        setLoadingCoverCode(false);
      }
    }

    fetchCoverCodes();
  }, []);

  useEffect(() => {
    if (!formData.coverCode && allCoverCodes.length > 0) {
      const newCode = generateCoverCode(allCoverCodes);
      setFormData((prev) => ({ ...prev, coverCode: newCode }));
    }
  }, [allCoverCodes]);

  const generateCoverCode = (existingCodes = []) => {
    const year = new Date().getFullYear();
    const prefix = `C${year}-`;

    const codesForYear = existingCodes
      .filter((code) => code?.startsWith(prefix))
      .map((code) => parseInt(code.replace(prefix, ""), 10))
      .filter((num) => !isNaN(num));

    const newNumber = (codesForYear.length ? Math.max(...codesForYear) : 0) + 1;

    return `${prefix}${newNumber}`;
  };

  const [distributors, setDistributors] = useState([]);

  useEffect(() => {
    async function fetchDistributors() {
      const { data, error } = await supabase
        .from("distributors")
        .select("id, name, code");
      if (error) {
        console.error("Error fetching distributors:", error);
      } else {
        setDistributors(data);
      }
    }

    fetchDistributors();
  }, []);

  const selectedDistributor = distributors.find(
    (d) => d.code === formData.distributor
  );
  const selectedName = selectedDistributor ? selectedDistributor.name : "";

  const handleSubmits = async (e) => {
    e.preventDefault();

    if (
      !formData.coverCode ||
      !formData.distributor ||
      !formData.amountbadget
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Missing fields",
        text: "Please fill in all required fields.",
        confirmButtonText: "OK",
      });
      return;
    }

    try {
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const createdBy = parsedUser?.name || "Unknown";

      const accountCodes = formData.accountType;
      const dataToInsert = {
        cover_code: formData.coverCode,
        distributor_code: formData.distributor,
        account_type: accountCodes.join(","),
        amount_badget: parseFloat(formData.amountbadget),
        pwp_type: formData.coverType || "COVER_PWP",
        objective: formData.objective,
        promo_scheme: formData.promoScheme,
        details: formData.details,
        remarks: formData.remarks,
        notification: false,
        createForm: createdBy,
      };

      const { data: mainData, error: mainError } = await supabase
        .from("cover_pwp")
        .insert([dataToInsert]);

      if (mainError) {
        console.error("Error saving main form data:", mainError);
        await Swal.fire({
          icon: "error",
          title: "Submission Error",
          text: "Error saving form data.",
          confirmButtonText: "OK",
        });
        return;
      }

      console.log("Main form insert data result:", mainData);

      const { data: budgetInsert, error: budgetError } = await supabase
        .from("amount_badget")
        .insert([
          {
            pwp_code: formData.coverCode,
            amountbadget: parseFloat(formData.amountbadget),
            createduser: createdBy,
            remainingbalance: parseFloat(formData.amountbadget),
            Approved: false,
          },
        ]);

      if (budgetError) {
        console.error("Error inserting amount_badget:", budgetError);
        await Swal.fire({
          icon: "error",
          title: "Budget Entry Error",
          text: "Failed to insert into amount_badget table.",
          confirmButtonText: "OK",
        });
        return;
      }

      console.log("Amount budget inserted:", budgetInsert);

      setCurrentStep(2);
    } catch (err) {
      console.error("Unexpected error during submit:", err);
      await Swal.fire({
        icon: "error",
        title: "Unexpected Error",
        text: "Something went wrong. See console for details.",
        confirmButtonText: "OK",
      });
    }
  };

  const storedUser = localStorage.getItem("loggedInUser");
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;
  const loggedInUsername = parsedUser?.name || "Unknown";

  const [userDistributors, setUserDistributors] = useState([]);
  const [filteredDistributors, setFilteredDistributors] = useState([]);
  const loggedInUserId = parsedUser?.id || parsedUser?.user_id || null;

  useEffect(() => {
    const fetchUserDistributors = async () => {
      if (!loggedInUserId) {
        console.warn("[WARN] No logged-in user ID found, skipping distributor fetch.");
        return;
      }

      console.log(`🔍 Logged in UserID: ${loggedInUserId}`);

      try {
        setLoading(true);

        const { data: distributorsData, error: distributorsError } = await supabase
          .from("distributors")
          .select("*")
          .order("name", { ascending: true });

        if (distributorsError) throw distributorsError;
        if (!distributorsData || distributorsData.length === 0) {
          console.warn("⚠️ No distributors found.");
          Swal.fire("Notice", "No distributors found in the database.", "info");
          return;
        }

        console.log(`📦 Total distributors fetched: ${distributorsData.length}`);

        const filtered = distributorsData.filter((d) => {
          const agentCodes = (d.agent_code || "")
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          return agentCodes.includes(String(loggedInUserId));
        });

        console.log(`✅ Distributors assigned to agent ${loggedInUserId}:`, filtered);

        const { data: usersData, error: usersError } = await supabase
          .from("Account_Users")
          .select("UserID, name");

        if (usersError) throw usersError;

        const userMap = {};
        usersData.forEach((u) => {
          userMap[String(u.UserID)] = u.name;
        });

        const distributorsWithAgentNames = filtered.map((dist) => {
          const agentCodes = (dist.agent_code || "")
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          const agentNames = agentCodes
            .map((code) => userMap[code] || code)
            .join(", ");
          return { ...dist, agentNames };
        });

        console.log("📋 Distributors with agent names:", distributorsWithAgentNames);

        setDistributors(distributorsWithAgentNames);
        setFilteredDistributors(distributorsWithAgentNames);
      } catch (err) {
        console.error("[ERROR] Fetching distributors by agent_code:", err);
        Swal.fire("Error", "Failed to load distributors.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchUserDistributors();
  }, [loggedInUserId]);

  useEffect(() => {
    const fetchDistributors = async () => {
      const { data, error } = await supabase
        .from("distributors")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("[ERROR] Fetching distributors:", error);
      } else {
        console.log("[DEBUG] All distributors from DB:", data);
        setDistributors(data);

        const allowed = data.filter((dist) =>
          userDistributors.includes(dist.name)
        );
        console.log("[DEBUG] Filtered distributors for dropdown:", allowed);
        setFilteredDistributors(allowed);
      }
    };

    if (userDistributors.length > 0) {
      fetchDistributors();
    } else {
      setFilteredDistributors([]);
    }
  }, [userDistributors]);

  return (
    <div style={{ padding: "30px", minHeight: "100vh", background: "#f8f9fa" }} className="containers">
      {/* Header Section */}
      <div className="container-fluid mb-4">
        <div className="row g-3 align-items-start">
          {/* Title Card */}
          <div className="col-12 col-lg-5">
            <div
              className="card shadow-sm"
              style={{
                background: "linear-gradient(135deg, #7BB0FF 0%, #A8D0FF 40%, #D9EDF7 100%)",
                borderRadius: "16px",
                border: "none",
                padding: "24px",
             
              }}
            >
              <h3
                className="mb-0 text-white"
                style={{
                  fontWeight: "700",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  fontSize: "1.5rem",
                               color: "rgba(78, 78, 78, 0.95)",

                }}
              >
                💼 DISTRIBUTOR BUDGET
              </h3>
            </div>
          </div>



          {/* Remaining Budget Card */}

        </div>
      </div>

      {/* Form Section */}
      {currentStep === 1 && (
        <div className="container-fluid">
          <div className="card shadow-sm" style={{ borderRadius: "16px", border: "none" }}>
            <div className="card-body p-4">
              <form onSubmit={handleSubmits}>
                <div className="row g-4">
                  {/* Distributor Dropdown */}
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold">
                      Distributor <span className="text-danger">*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        name="distributor"
                        className="form-select form-select-lg"
                        value={formData.distributor}
                        onChange={handleFormChange}
                        style={{
                          paddingRight: "45px",
                          borderColor: formData.distributor ? "#28a745" : "#dee2e6",
                          borderWidth: "2px",
                          transition: "all 0.3s ease",
                          borderRadius: "12px",
                        }}
                      >
                        <option value="">Select Distributor</option>
                        {filteredDistributors.map((dist) => (
                          <option key={dist.id} value={dist.code}>
                            {dist.name}
                          </option>
                        ))}
                      </select>
                      {formData.distributor && (
                        <span
                          style={{
                            position: "absolute",
                            right: "15px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#28a745",
                            fontWeight: "bold",
                            fontSize: "24px",
                            pointerEvents: "none",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add more form fields here as needed */}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Budget Years Card */}
      {formData.distributor && budgetYears.length > 0 && (
        <div className="col-12 d-flex justify-content-center mt-3">
          <div
            className="card shadow-lg"
            style={{
              background: "linear-gradient(135deg, #7BB0FF 0%, #A8D0FF 40%, #D9EDF7 100%)",
              borderRadius: "20px",
              border: "none",
              padding: "35px",
              width: "95%",
              maxWidth: "800px",
              minHeight: "480px",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            }}
          >

            {/* TITLE */}
            <div
              style={{
                fontSize: "16px",
                color: "rgba(78, 78, 78, 0.95)",
                fontWeight: "700",
                marginBottom: "15px",
                letterSpacing: "1px",
                textTransform: "uppercase",
                textAlign: "center",
                textShadow: "0 0 6px rgba(255,255,255,0.5)",
              }}
            >
              📅 Budget Years Overview
            </div>

            {loadingBudgetYear ? (
              <div className="text-center text-white py-3">
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <span className="ms-2">Loading...</span>
              </div>
            ) : (
              <div style={{ maxHeight: "540px", overflowY: "auto", overflowX: "hidden", paddingRight: "6px" }}>

                {budgetYears.map((yearData, index) => (
                  <div
                    key={index}
                    className="mb-2"
                    style={{
                      background: "rgba(255,255,255,0.20)",
                      padding: "14px 16px",
                      borderRadius: "14px",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.35)",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div
                          style={{
                            fontSize: "26px",
                            fontWeight: "800",
                            color: "#000000ff",
                            lineHeight: "1",
                          }}
                        >
                          {yearData.year}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "rgba(12, 12, 12, 0.9)",
                            marginTop: "4px",
                          }}
                        >
                          {yearData.count} budget{yearData.count > 1 ? "s" : ""}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "900",
                          color: "#1d1d1dff",
                          textAlign: "right",
                        }}
                      >
                        ₱{yearData.totalBudget.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}

                {/* GRAND TOTAL */}
                {budgetYears.length > 1 && (
                  <div
                    className="mt-3"
                    style={{
                      background: "rgba(255,255,255,0.30)",
                      padding: "14px 16px",
                      borderRadius: "14px",
                      backdropFilter: "blur(12px)",
                      border: "2px solid rgba(255,255,255,0.4)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "700",
                          color: "#000000ff",
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                        }}
                      >
                        Total
                      </div>
                      <div
                        style={{
                          fontSize: "20px",
                          fontWeight: "900",
                          color: "#000000ff",
                        }}
                      >
                        ₱{budgetYears.reduce((s, y) => s + y.totalBudget, 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SELECTED DISTRIBUTOR NAME */}
            {selectedDistributorName && (
              <div
                className="mt-3 pt-2 text-center"
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.35)",
                  fontSize: "13px",
                  color: "rgba(0, 0, 0, 0.9)",
                  fontStyle: "italic",
                }}
              >
                {selectedDistributorName}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Total;
