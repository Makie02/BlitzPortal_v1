import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import Papa from "papaparse";

function Sub_3rdmotherAccounts() {
  const [subMothers, setSubMothers] = useState([]);
  const [selectedSubMother, setSelectedSubMother] = useState(null);
  const [sub3Accounts, setSub3Accounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", branch: "" });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  // New: search state for sub‑3 accounts
  const [sub3SearchQuery, setSub3SearchQuery] = useState("");

  // Ref for import file input
  const importInputRef = useRef(null);

  // Fetch Sub Mother Accounts
  useEffect(() => {
    const fetchSubMothers = async () => {
      const { data, error } = await supabase
        .from("sub_mother_account")
        .select(`
          id,
          mother_id,
          name,
          status,
          bpcode,
          created_at,
          mother_account ( name )
        `)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        Swal.fire("Error", "Failed to fetch sub‑mother accounts", "error");
      } else {
        setSubMothers(data);
      }
    };

    fetchSubMothers();
  }, []);

  // Fetch Sub‑3 Accounts for a given subMother
  const fetchSub3Accounts = async (subMother) => {
    setSelectedSubMother(subMother);
    setSub3SearchQuery(""); // reset search when switching

    const { data, error } = await supabase
      .from("sub_3_mother_account")
      .select(`
      id,
      sub_mother_id,
      name,
      branch,
      branch_code,
      sub_mother_bpcode,
      status,
      distributor_code,
      distributor_name,
      sub_mother_account ( name )
    `)
      .eq("sub_mother_id", subMother.id)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      Swal.fire("Error", "Failed to fetch Sub-3 accounts", "error");
    } else {
      setSub3Accounts(data);
    }
  };


  // Filtered sub3 accounts based on search
  const filteredSub3 = sub3Accounts.filter((s3) => {
    const q = sub3SearchQuery.trim().toLowerCase();
    if (q === "") return true;
    // Search against name, description, branch, status
    const nameMatch = s3.name?.toLowerCase().includes(q);
    const descMatch = s3.description?.toLowerCase().includes(q);
    const branchMatch = s3.branch?.toLowerCase().includes(q);
    const statusText = s3.status ? "active" : "inactive";
    const statusMatch = statusText.includes(q);
    return nameMatch || descMatch || branchMatch || statusMatch;
  });

  // Handle input change
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Add or Update Sub‑3 Account

const generateNextBranchCode = async (subMotherId) => {
  try {
    // Fetch the latest branch_code for this subMother
    const { data, error } = await supabase
      .from("sub_3_mother_account")
      .select("branch_code")
      .eq("sub_mother_id", subMotherId)
      .order("branch_code", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching last branch code:", error);
      return "B20000"; // fallback start
    }

    if (data && data.length > 0 && data[0].branch_code) {
      const lastCode = data[0].branch_code; // e.g., "B20001"
      const lastNum = parseInt(lastCode.replace(/^B/, ""), 10); // remove "B" and parse
      return "B" + (lastNum + 1); // increment
    } else {
      return "B20000"; // start code if no previous
    }
  } catch (err) {
    console.error("Unexpected error in generateNextBranchCode:", err);
    return "B20000"; // fallback
  }
};



 const handleSaveSub3Account = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return Swal.fire("Warning", "Sub-3 account name is required", "warning");

    const selectedDistObjects = distributors.filter((d) => selectedDistributors.includes(d.code));
    const distributorNames = selectedDistObjects.map((d) => d.name).join(", ");
    const distributorCodes = selectedDistObjects.map((d) => d.code).join(", ");

    try {
      if (editMode) {
        const { error } = await supabase
          .from("sub_3_mother_account")
          .update({
            name: formData.name,
            branch: formData.branch,
            distributor_code: distributorCodes || null,
            distributor_name: distributorNames || null,
            sub_mother_bpcode: selectedSubMother.bpcode || null,
          })
          .eq("id", editId);
        if (error) throw error;
        Swal.fire("Updated", "Sub-3 account updated!", "success");
      } else {
        const nextBranchCode = await generateNextBranchCode(selectedSubMother.id);
        const { error } = await supabase.from("sub_3_mother_account").insert([
          {
            sub_mother_id: selectedSubMother.id,
            sub_mother_bpcode: selectedSubMother.bpcode,
            name: formData.name,
            branch: formData.branch,
            branch_code: nextBranchCode,
            distributor_code: distributorCodes || null,
            distributor_name: distributorNames || null,
          },
        ]);
        if (error) throw error;
        Swal.fire("Success", "Sub-3 account created!", "success");
      }

      setFormData({ name: "", branch: "", description: "" });
      setSelectedDistributors([]);
      setShowModal(false);
      setEditMode(false);
      setEditId(null);
      fetchSub3Accounts(selectedSubMother);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err.message, "error");
    }
  };




    // Delete Sub‑3 account
    const handleDelete = async (id) => {
      const confirm = await Swal.fire({
        title: "Are you sure?",
        text: "This will permanently delete the Sub-3 account.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete it!",
      });

      if (confirm.isConfirmed) {
        const { error } = await supabase
          .from("sub_3_mother_account")
          .delete()
          .eq("id", id);
        if (error) {
          Swal.fire("Error", error.message, "error");
        } else {
          Swal.fire("Deleted!", "Sub‑3 account has been deleted.", "success");
          fetchSub3Accounts(selectedSubMother);
        }
      }
    };

    // Edit handler
    const handleEdit = (s3) => {
      setEditMode(true);
      setEditId(s3.id);
      setFormData({
        name: s3.name || "",
        description: s3.description || "",
        branch: s3.branch || "",
      });

      // Preselect distributors if data exists
      const codes =
        s3.distributor_code && typeof s3.distributor_code === "string"
          ? s3.distributor_code.split(",").map((c) => c.trim())
          : [];
      setSelectedDistributors(codes);

      setShowModal(true);
    };


    // Back to selecting subMother
    const handleBackSubMother = () => {
      setSelectedSubMother(null);
      setSub3Accounts([]);
    };

    // Export filteredSub3 to CSV
    // Export filteredSub3 to CSV (includes distributor fields)



    // Import CSV for Sub-3 accounts
    const triggerImportClick = () => {
      if (importInputRef.current) importInputRef.current.click();
    };

    // ---------- Import CSV function enhancement ----------
    const handleImportCSV = (e) => {
      const file = e.target.files[0];
      if (!file) {
        Swal.fire("Warning", "No file selected.", "warning");
        return;
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function (results) {
          const parsedData = results.data;
          const fields = results.meta.fields;

          if (!fields.includes("Name")) {
            Swal.fire("Error", 'Missing required column: "Name"', "error");
            return;
          }

          let existingData = [];
          try {
            const { data: existing, error } = await supabase
              .from("sub_3_mother_account")
              .select("id, branch_code");
            if (error) throw error;
            existingData = existing;
          } catch (err) {
            console.error(err);
            Swal.fire("Error", "Failed to fetch existing Sub-3 accounts", "error");
            return;
          }

          const toInsert = [];
          const toUpdate = [];

          for (const row of parsedData) {
            const name = row["Name"]?.trim();
            if (!name) continue;

            const description = row["Description"]?.trim() || "";
            const branch = row["Branch"]?.trim() || "";
            const distributor_code = row["Distributor Codes"]?.trim() || "";
            const distributor_name = row["Distributor Names"]?.trim() || "";
            const statusRaw = row["Status"]?.trim().toLowerCase() || "";
            const status = statusRaw === "inactive" || statusRaw === "false" ? false : true;

            const existing = existingData.find((d) => d.id === Number(row["ID"]));
            let branch_code = row["Branch Code"]?.trim();
            if (!branch_code) {
              // auto-generate branch_code if missing
              branch_code = await generateNextBranchCode();
            }

            const record = {
              sub_mother_id: selectedSubMother.id,
              sub_mother_bpcode: selectedSubMother.bpcode,
              name,
              description,
              branch,
              branch_code,
              distributor_code,
              distributor_name,
              status,
            };

            if (existing) {
              toUpdate.push({ ...record, id: existing.id });
            } else {
              toInsert.push(record);
            }
          }

          try {
            if (toInsert.length > 0) {
              const { error: insertErr } = await supabase
                .from("sub_3_mother_account")
                .insert(toInsert);
              if (insertErr) throw insertErr;
            }

            for (const upd of toUpdate) {
              const { id, ...fields } = upd;
              const { error: updateErr } = await supabase
                .from("sub_3_mother_account")
                .update(fields)
                .eq("id", id);
              if (updateErr) throw updateErr;
            }

            Swal.fire("Success", "Import complete!", "success");
            fetchSub3Accounts(selectedSubMother);
          } catch (err) {
            console.error(err);
            Swal.fire("Error", err.message, "error");
          }
        },
        error: (err) => {
          console.error(err);
          Swal.fire("Error", "Failed to parse CSV", "error");
        },
      });

      e.target.value = null; // reset input
    };

    // ---------- Export CSV function enhancement ----------
    const exportSub3ToCSV = (subs) => {
      if (!selectedSubMother) return;

      if (subs.length === 0) {
        Swal.fire("Info", "No Sub-3 accounts to export.", "info");
        return;
      }

      const header = [
        "ID",
        "Sub-Mother ID",
        "Sub-Mother BP Code",
        "Name",
        "Description",
        "Branch",
        "Branch Code",
        "Distributor Codes",
        "Distributor Names",
        "Status",
      ];

      const rows = subs.map((s3) => [
        s3.id,
        s3.sub_mother_id,
        s3.sub_mother_bpcode || "",
        s3.name,
        s3.description || "",
        s3.branch || "",
        s3.branch_code || "",
        s3.distributor_code || "",
        s3.distributor_name || "",
        s3.status ? "Active" : "Inactive",
      ]);

      const csvContent =
        [header, ...rows]
          .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
          .join("\n") + "\n";

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sub3_accounts_${selectedSubMother.name || selectedSubMother.id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };




    const [distributors, setDistributors] = useState([]);
    const [selectedDistributors, setSelectedDistributors] = useState([]);
    const [distributorSearch, setDistributorSearch] = useState("");

    // Fetch distributors
    useEffect(() => {
      const fetchDistributors = async () => {
        const { data, error } = await supabase
          .from("distributors")
          .select("id, code, name")
          .order("name", { ascending: true });
        if (error) {
          console.error(error);
          Swal.fire("Error", "Failed to fetch distributors", "error");
        } else {
          setDistributors(data);
        }
      };
      fetchDistributors();
    }, []);
    const handleDistributorToggle = (code) => {
      setSelectedDistributors((prev) =>
        prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
      );
    };


    return (
      <div style={{ padding: 20, fontFamily: "Arial" }}>
        {!selectedSubMother && (
          <div style={{ marginTop: 20 }}>
            <div style={sectionHeader}>
              <h1 style={{ margin: 0, color: "#0087c5", fontSize: "26px" }}>
                Branch Accounts
              </h1>
              <p style={{ margin: "5px 0 0 0", color: "#666", fontSize: "14px" }}>
                Select a Sub-Mother account to manage its Branch Accounts
              </p>
            </div>

            <div style={cardContainer}>
              {subMothers.map((sub) => (
                <div
                  key={sub.id}
                  style={cardStyle}
                  onClick={() => fetchSub3Accounts(sub)}
                >
                  <div style={cardHeader}>
                    <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>{sub.name}</h3>
                  </div>
                  <div style={cardBody}>
                    <p style={{ margin: 0, color: "#555", fontSize: 14 }}>
                      <strong>Mother:</strong> {sub.mother_account?.name || "-"}
                    </p>
                    <p style={{ margin: "5px 0 0 0", color: "#777", fontSize: 12 }}>
                      <strong>Status:</strong> {sub.status ? "Active" : "Inactive"}
                    </p>
                    <p style={{ margin: "5px 0 0 0", color: "#999", fontSize: 12 }}>
                      <strong>Created:</strong>{" "}
                      {new Date(sub.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedSubMother && (
          <div style={tabPanel}>
            <button style={btnBack} onClick={handleBackSubMother}>
              ← Back to Sub Branch Accounts
            </button>

            <h2>Branch Accounts for {selectedSubMother.name}</h2>

            {/* Search bar for sub‑3 */}
            <div style={{ marginTop: 10, marginBottom: 10, width: "300px" }}>
              <input
                type="text"
                placeholder="Search sub‑3 accounts..."
                value={sub3SearchQuery}
                onChange={(e) => setSub3SearchQuery(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <button style={btnAdd} onClick={() => {
                setEditMode(false);
                setEditId(null);
                setFormData({ name: "", description: "", branch: "" });
                setShowModal(true);
              }}>
                + Add Sub-3 Account
              </button>
              <button
                style={{ ...btnAdd, marginLeft: 10, backgroundColor: "#6c757d" }}
                onClick={triggerImportClick}
              >
                Import CSV
              </button>
              <button
                style={{ ...btnAdd, marginLeft: 10, backgroundColor: "#17a2b8" }}
                onClick={() => exportSub3ToCSV(filteredSub3)}
              >
                Export CSV
              </button>
              <input
                type="file"
                accept=".csv"
                ref={importInputRef}
                style={{ display: "none" }}
                onChange={handleImportCSV}
              />
            </div>

            <div style={{ ...responsiveTableWrapper, maxHeight: "480px", overflowY: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Sub Mother</th>
                    <th style={thStyle}>Sub Mother BP Code</th> {/* ✅ added */}
                    <th style={thStyle}>Branch Code</th> {/* ✅ added */}
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Branch</th>
                    <th style={thStyle}>Distributor Codes</th>
                    <th style={thStyle}>Distributor Names</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSub3.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: "center", padding: 10 }}>
                        No Sub-3 accounts found.
                      </td>
                    </tr>
                  ) : (
                    filteredSub3.map((s3) => (
                      <tr key={s3.id} style={trResponsive}>
                        <td style={tdStyle}>{s3.id}</td>
                        <td style={tdStyle}>{s3.sub_mother_account?.name || "-"}</td>
                        <td style={tdStyle}>{s3.sub_mother_bpcode || "-"}</td> {/* ✅ shows bpcode */}
                        <td style={tdStyle}>{s3.branch_code || "-"}</td> {/* ✅ shows branch_code */}
                        <td style={tdStyle}>{s3.name}</td>
                        <td style={tdStyle}>{s3.branch}</td>
                        <td style={tdStyle}>{s3.distributor_code || "-"}</td>
                        <td style={tdStyle}>{s3.distributor_name || "-"}</td>
                        <td style={tdStyle}>{s3.status ? "Active" : "Inactive"}</td>
                        <td style={tdStyle}>
                          <button style={actionBtn} onClick={() => handleEdit(s3)}>✏️ Edit</button>
                          <button style={deleteBtn} onClick={() => handleDelete(s3.id)}>🗑 Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {showModal && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3>
                {editMode
                  ? `Edit Sub-3 Account (${selectedSubMother.name})`
                  : `Create Sub-3 Account for ${selectedSubMother.name}`}
              </h3>
              <button style={closeBtn} onClick={() => setShowModal(false)}>
                &times;
              </button>
              <form onSubmit={handleSaveSub3Account} style={{ marginTop: 20 }}>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Sub-3 account name"
                  style={inputStyle}
                  required
                />

                <input
                  type="text"
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  placeholder="Branch"
                  style={inputStyle}
                />
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontWeight: "bold", display: "block", marginBottom: 5 }}>
                    Select Distributors:
                  </label>

                  {/* Search Bar */}
                  <input
                    type="text"
                    placeholder="Search distributors..."
                    value={distributorSearch}
                    onChange={(e) => setDistributorSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      marginBottom: "8px",
                      fontSize: "13px",
                    }}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                      gap: "6px",
                      maxHeight: "300px",
                      overflowY: "auto",
                      border: "1px solid #ddd",
                      padding: "8px",
                      borderRadius: "4px",
                    }}
                  >
                    {distributors
                      .filter((dist) =>
                        (dist.name || "").toLowerCase().includes(distributorSearch.toLowerCase()) ||
                        (dist.code || "").toString().toLowerCase().includes(distributorSearch.toLowerCase())
                      )
                      .map((dist) => (
                        <label
                          key={dist.code}
                          style={{
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDistributors.includes(dist.code)}
                            onChange={() => handleDistributorToggle(dist.code)}
                          />
                          {dist.name} ({dist.code})
                        </label>
                      ))}

                  </div>
                </div>

                <button type="submit" style={btnSave}>
                  {editMode ? "Update" : "Create"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  export default Sub_3rdmotherAccounts;

  // ---------- Styles ----------

  const cardContainer = {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "20px",
    justifyItems: "center",
  };

  const cardStyle = {
    width: "100%",
    maxWidth: "250px",
    borderRadius: 12,
    background: "#f9f9f9",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    transition: "transform 0.2s, boxShadow 0.2s",
    overflow: "hidden",
  };

  const cardHeader = {
    background: "linear-gradient(135deg, #0087c5, #00b0ff)",
    padding: "15px",
    textAlign: "center",
  };

  const cardBody = { padding: "15px", textAlign: "center" };

  const tabPanel = {
    marginTop: 20,
    padding: 15,
    border: "1px solid #ccc",
    borderRadius: 8,
    background: "#fff",
    overflowX: "auto",
  };

  const btnBack = {
    padding: "6px 12px",
    background: "#555",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    marginBottom: 10,
  };

  const btnAdd = {
    padding: "6px 12px",
    background: "#0087c5",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    marginBottom: 10,
  };

  const actionBtn = {
    padding: "4px 8px",
    background: "#ffc107",
    color: "#000",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    marginRight: 6,
  };

  const deleteBtn = {
    padding: "4px 8px",
    background: "#dc3545",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  };

  const responsiveTableWrapper = { width: "100%", overflowX: "auto" };

  const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: 600 };

  const thStyle = {
    padding: 10,
    textAlign: "left",
    background: "#0087c5",
    color: "#fff",
    fontSize: 14,
  };

  const tdStyle = { padding: 10, borderBottom: "1px solid #ddd", fontSize: 13 };

  const trResponsive = { background: "#fafafa" };

  const modalOverlay = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const modalContent = {
    background: "#fff",
    borderRadius: "12px",
    padding: "30px 40px",
    width: "90%",            // ✅ Larger width
    maxWidth: "900px",       // ✅ Wider maximum
    maxHeight: "90vh",       // ✅ Prevent overflow on small screens
    overflowY: "auto",       // ✅ Scroll inside if content too long
    position: "relative",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
  };


  const closeBtn = {
    position: "absolute",
    top: 10,
    right: 10,
    fontSize: 20,
    background: "transparent",
    border: "none",
    cursor: "pointer",
  };

  const inputStyle = {
    width: "100%",
    padding: 8,
    borderRadius: 4,
    border: "1px solid #ccc",
    marginBottom: 10,
  };

  const btnSave = {
    padding: "6px 12px",
    background: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  };

  const sectionHeader = { textAlign: "center", marginBottom: "30px" };
