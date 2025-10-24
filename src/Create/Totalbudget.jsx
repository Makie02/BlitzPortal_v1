import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Swal from "sweetalert2"; // <---- import sweetalert2
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

  // Auto-generate Visa Code on mount
  const handleFormChange = async (e) => {
    const { name, value } = e.target;

    // Update formData with the new field value
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
          return;
        }

        console.log("📦 Selected distributor:", selectedDistributor);

        // Fetch budget info using distributor CODE (stored as text in DB)
        const { data: budgetData, error: budgetError } = await supabase
          .from("amount_badget")
          .select("amountbadget, remainingbalance, createduser, distributor")
          .eq("distributor", value.toString()) // Use distributor CODE as string
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

          // Auto-populate the amount budget and remaining budget
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
            title: "Budget Loaded",
            html: `
              <strong>Distributor:</strong> ${selectedDistributor.name}<br/>
              <strong>Amount Budget:</strong> ₱${parseFloat(budgetAmount || 0).toLocaleString()}<br/>
              <strong>Remaining Balance:</strong> ₱${remainingBalance.toLocaleString()}
            `,
            timer: 2500,
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
      maximumFractionDigits: 0, // No decimal places
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

  //albert
  useEffect(() => {
    const fetchApprovedExpenses = async () => {
      if (!formData.visaCode) return;

      try {
        // Fetch approved regular PWP budget expenses
        const { data, error } = await supabase
          .from("approved_pwp_expenses") // Replace with your actual table name
          .select("amount")
          .eq("visa_code", formData.visaCode)
          .eq("status", "approved");

        if (error) {
          console.error("Error fetching approved expenses:", error);
          return;
        }

        // Calculate total approved expenses
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

      // Fetch singleapprovals
      const { data: approvalsData, error: approvalsError } = await supabase
        .from("singleapprovals")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch user approvers
      const { data: userApproversData, error: userApproversError } =
        await supabase
          .from("User_Approvers")
          .select("*")
          .order("created_at", { ascending: false });

      // Fetch users for name lookup
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
      .or("Approved.is.null,Approved.eq.true"); // ✅ Only include Approved = true or null

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
          fetchRemainingBalance(); // ✅ will re-filter automatically
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchRemainingBalance]);

  // Helper: get name from user_id



  // fetch account types
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




  // compute selected names
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

        // Generate cover code if not already set
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
      // ✅ Get the logged-in user from localStorage
      const storedUser = localStorage.getItem("loggedInUser");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const createdBy = parsedUser?.name || "Unknown"; // You could use parsedUser.UserID too

      // ✅ Convert selected accountType IDs into codes
      const accountCodes = formData.accountType; // array of codes
      const dataToInsert = {
        cover_code: formData.coverCode,
        distributor_code: formData.distributor,
        account_type: accountCodes.join(","), // <-- join codes with comma
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
      // ✅ Insert to amount_badget table
      const { data: budgetInsert, error: budgetError } = await supabase
        .from("amount_badget")
        .insert([
          {
            pwp_code: formData.coverCode,
            amountbadget: parseFloat(formData.amountbadget),
            createduser: createdBy,
            remainingbalance: parseFloat(formData.amountbadget), // initially same as amount
            Approved: false, // or null if not yet reviewed
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

      // ✅ Handle file attachments


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
  console.log("[DEBUG] Logged in user ID:", loggedInUserId);
  // useEffect(() => {
  //   const fetchUserDistributors = async () => {
  //     const { data, error } = await supabase
  //       .from("user_distributors")
  //       .select("distributor_name")
  //       .eq("username", loggedInUsername);

  //     if (error) {
  //       console.error("[ERROR] Fetching user_distributors:", error);
  //     } else {
  //       const names = data.map((d) => d.distributor_name);
  //       console.log("[DEBUG] Distributors assigned to user:", names);
  //       setUserDistributors(names);
  //     }
  //   };

  //   if (loggedInUsername !== "Unknown") {
  //     fetchUserDistributors();
  //   }
  // }, [loggedInUsername]);


  useEffect(() => {
    const fetchUserDistributors = async () => {
      if (!loggedInUserId) {
        console.warn("[WARN] No logged-in user ID found, skipping distributor fetch.");
        return;
      }

      console.log(`🔍 Logged in UserID: ${loggedInUserId}`);

      try {
        setLoading(true);

        // 1️⃣ Fetch all distributors
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

        // 2️⃣ Filter only those where loggedInUserId is inside agent_code list
        const filtered = distributorsData.filter((d) => {
          const agentCodes = (d.agent_code || "")
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          return agentCodes.includes(String(loggedInUserId));
        });

        console.log(`✅ Distributors assigned to agent ${loggedInUserId}:`, filtered);

        // 3️⃣ Fetch Account_Users for name lookup
        const { data: usersData, error: usersError } = await supabase
          .from("Account_Users")
          .select("UserID, name");

        if (usersError) throw usersError;

        // 4️⃣ Create a map for UserID → name
        const userMap = {};
        usersData.forEach((u) => {
          userMap[String(u.UserID)] = u.name;
        });

        // 5️⃣ Add readable agent names for display
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

        // 6️⃣ Update state
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

        // Filter distributors based on user allowed list
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
      // If no distributors assigned, clear filtered list
      setFilteredDistributors([]);
    }
  }, [userDistributors]);

  return (
    <div style={{ padding: "30px", height: "90vh" }} className="containers">
      <div className="row align-items-center mb-4">
        <div className="col-12 col-md-6">
          <div
            className="card p-4 animate-fade-slide-up shadow-sm"
            style={{
              background: "linear-gradient(135deg, #a8d0ff, #d9edf7)", // gentle blue gradient
              borderRadius: "12px",
              border: "1px solid #99cfff",
              color: "#1a3e72",
              boxShadow: "0 4px 8px rgba(26, 62, 114, 0.15)",
            }}
          >
            <h3
              className="mb-0"
              style={{
                fontWeight: "700",
                letterSpacing: "2px",
                textTransform: "uppercase",
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                textShadow: "1px 1px 2px rgba(26, 62, 114, 0.3)",
              }}
            >
              DISTRIBUTOR BUDGET
            </h3>
          </div>
        </div>
        {/* Remaining Budget */}
        <div
          className="col-md-4 d-flex justify-content-end align-items-center"
          style={{ position: "absolute", top: "40px", right: "20px" }} // ⬅ added margin-top effect
        >
          <span
            style={{
              fontSize: "18px", // ⬅ mas malaki label
              fontWeight: "600",
              marginRight: "12px",
              color: "#444",
            }}
          >
            Remaining Budget:
          </span>
          <span
            style={{
              fontSize: "24px", // ⬅ mas malaki value
              fontWeight: "bold",
              color: "#000",
              background: "#ffffff",
              padding: "8px 20px", // ⬅ mas spacious
              borderRadius: "10px",
              boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
            }}
          >
            {displayedRemainingBudget !== null
              ? `₱${displayedRemainingBudget.toLocaleString()}`
              : totalRemaining !== null
                ? `₱${totalRemaining.toLocaleString()}`
                : "Loading..."}
          </span>
        </div>

        <div className="col-12 col-md-6 text-md-end pt-3 pt-md-0"></div>
      </div>

      {currentStep === 1 && (
        <form style={{ marginTop: "50px" }} onSubmit={handleSubmits}>
          <h2
            className="fw-bold mb-0"
            style={{
              letterSpacing: "1px",
              fontSize: "24px",
              marginBottom: "50px",
              textAlign: "right",
            }}
          >

          </h2>
          <div className="row g-3">
            <div
              className="col-md-3"
              style={{ position: "relative", width: "550px" }}
            >
              <label className="form-label">
                Distributor <span style={{ color: "red" }}>*</span>
              </label>

              <select
                name="distributor"
                className="form-control"
                value={formData.distributor}
                onChange={handleFormChange}
                style={{
                  paddingRight: "30px",
                  borderColor: formData.distributor ? "green" : "",
                  transition: "border-color 0.3s",
                }}
                onMouseEnter={(e) => {
                  if (formData.distributor)
                    e.currentTarget.style.borderColor = "green";
                }}
                onMouseLeave={(e) => {
                  if (formData.distributor)
                    e.currentTarget.style.borderColor = "green";
                  else e.currentTarget.style.borderColor = "";
                }}
              >
                <option value="">Select Distributor</option>
                {filteredDistributors.map((dist) => (
                  <option key={dist.id} value={dist.code}>
                    {dist.name}
                  </option>
                ))}
              </select>
              <span
                style={{
                  position: "absolute",
                  top: "75%",
                  right: "20px",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  fontSize: "0.8rem",
                  color: "#666",
                }}
              >
                ▼
              </span>
              {formData.principal !== "" && (
                <span
                  style={{
                    position: "absolute",
                    right: "40px",
                    top: "55%",
                    transform: "translateY(-20%)",
                    color: "green",
                    fontWeight: "bold",
                    fontSize: "25px",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  ✓
                </span>
              )}
            </div>

            <div className="col-md-3" style={{ position: "relative" }}>
              <label className="form-label">
                Amount Budget <span style={{ color: "red" }}>*</span>
              </label>
              <input
                type="text"
                name="amountbadget"
                className="form-control"
                value={formatCurrency(formData.amountbadget)}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/,/g, "");
                  if (/^[0-9]*\.?[0-9]*$/.test(rawValue)) {
                    handleFormChange({
                      target: { name: "amountbadget", value: rawValue },
                    });
                  }
                }}
                style={{ paddingRight: "30px" }}
              />
            </div>
            {/* <div className="col-md-3" style={{ position: "relative" }}>
              <label className="form-label" style={{ color: "#888" }}>
                Marketing Type
              </label>
              <select
                name="coverType"
                className="form-control"
                value={formData.coverType}
                onChange={handleFormChange}
                style={{
                  paddingRight: "30px",
                  textTransform: "uppercase",
                  backgroundColor: "#f5f5f5",
                  cursor: "not-allowed",
                }}
                disabled
              >
                <option value="COVER_PWP">COVER_PWP</option>
              </select>

              {formData.coverType !== "" && (
                <span
                  style={{
                    position: "absolute",
                    right: "20px",
                    top: "50%",
                    transform: "translateY(-20%)",
                    color: "green",
                    fontWeight: "bold",
                    fontSize: "25px",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  ✓
                </span>
              )}
            </div> */}
          </div>
        </form>
      )}
    </div>
  );
};

export default Total;
