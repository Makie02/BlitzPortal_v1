import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import Papa from "papaparse";

function Sub_3rdmotherAccounts() {
  const [subMothers, setSubMothers] = useState([]);
  const [selectedSubMother, setSelectedSubMother] = useState(null);
  const [sub3Accounts, setSub3Accounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", branch: "", bp_code: "" });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  // New: search state for sub‑3 accounts
  const [sub3SearchQuery, setSub3SearchQuery] = useState("");

  // Ref for import file input
  const importInputRef = useRef(null);

  // Fetch Sub Mother Accounts
  useEffect(() => {
    const fetchSubMothers = async () => {
      const batchSize = 1000;
      let allData = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        console.log(`📥 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`);
        const { data, error } = await supabase
          .from("sub_mother_account")
          .select(`
            id,
            mother_id,
            name,
            status,
            dscode,
            created_at,
            mother_account ( name )
          `)
          .order("created_at", { ascending: true })
          .range(offset, offset + batchSize - 1);

        console.log(
          `✅ Fetched batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`
        );

        if (error) {
          console.error(error);
          Swal.fire("Error", "Failed to fetch sub-mother accounts", "error");
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
          console.log(`📊 Total records so far: ${allData.length}`);
        } else {
          hasMore = false;
        }
      }

      setSubMothers(allData);
      console.log(`🎉 Finished fetching all Sub-Mothers: ${allData.length}`);
    };

    fetchSubMothers();
  }, []);

  // ✅ Batched fetch for Sub-3 Accounts
  const fetchSub3Accounts = async (subMother) => {
    setSelectedSubMother(subMother);
    setSub3SearchQuery("");

    const batchSize = 1000;
    let allData = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      console.log(`📥 Fetching Sub-3 batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`);
      const { data, error } = await supabase
        .from("sub_3_mother_account")
        .select(`
          id,
          sub_mother_id,
          name,
          branch,
          bp_code,
          sub_mother_dscode,
          status,
          distributor_code,
          distributor_name,
          sub_mother_account ( name )
        `)
        .eq("sub_mother_id", subMother.id)
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1);

      console.log(
        `✅ Fetched Sub-3 batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`
      );

      if (error) {
        console.error(error);
        Swal.fire("Error", "Failed to fetch Sub-3 accounts", "error");
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        offset += batchSize;
        hasMore = data.length === batchSize;
        console.log(`📊 Total Sub-3 records so far: ${allData.length}`);
      } else {
        hasMore = false;
      }
    }

    setSub3Accounts(allData);
    console.log(`🎉 Finished fetching all Sub-3 accounts: ${allData.length}`);
  };


  // Filtered sub3 accounts based on search
  const filteredSub3 = sub3Accounts.filter((s3) => {
    const q = sub3SearchQuery.trim().toLowerCase();
    if (q === "") return true;
    // Search against name, , branch, status
    const nameMatch = s3.name?.toLowerCase().includes(q);
    const branchMatch = s3.branch?.toLowerCase().includes(q);
    const statusText = s3.status ? "active" : "inactive";
    const statusMatch = statusText.includes(q);
    return nameMatch || branchMatch || statusMatch;
  });

  // Handle input change
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Add or Update Sub‑3 Account





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
            sub_mother_dscode: selectedSubMother.dscode || null,
          })
          .eq("id", editId);
        if (error) throw error;
        Swal.fire("Updated", "Sub-3 account updated!", "success");
      } else {
        const { error } = await supabase.from("sub_3_mother_account").insert([
          {
            sub_mother_id: selectedSubMother.id,
            sub_mother_dscode: selectedSubMother.dscode,
            name: formData.name,
            branch: formData.branch,
            bp_code: formData.bp_code || null, // 🆕 use manual input
            distributor_code: distributorCodes || null,
            distributor_name: distributorNames || null,
          },
        ]);

        if (error) throw error;
        Swal.fire("Success", "Sub-3 account created!", "success");
      }

      setFormData({ name: "", branch: "", bp_code: "" });
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

      branch: s3.branch || "",
      bp_code: s3.bp_code || "", // 🆕 load existing bp_code

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
      complete: async (results) => {
        const parsedData = results.data;
        const fields = results.meta.fields;

        // ✅ Validate required columns
        if (!fields.includes("Name")) {
          Swal.fire("Error", 'Missing required column: "Name"', "error");
          return;
        }

        if (!selectedSubMother) {
          Swal.fire("Error", "No Sub-Mother selected.", "error");
          return;
        }

        // ✅ Fetch existing data for comparison
        let existingData = [];
        try {
          const { data: existing, error } = await supabase
            .from("sub_3_mother_account")
            .select("id, bp_code");

          if (error) throw error;
          existingData = existing || [];
        } catch (err) {
          console.error(err);
          Swal.fire("Error", "Failed to fetch existing Sub-3 accounts", "error");
          return;
        }

        const toInsert = [];
        const toUpdate = [];

        // ✅ Parse and classify data
        for (const row of parsedData) {
          const name = row["Name"]?.trim();
          if (!name) continue;

          const branch = row["Branch"]?.trim() || "";
          const distributor_code = row["Distributor Codes"]?.trim() || "";
          const distributor_name = row["Distributor Names"]?.trim() || "";
          const statusRaw = row["Status"]?.trim().toLowerCase() || "";
          const status =
            statusRaw === "inactive" || statusRaw === "false" ? false : true;

          let bp_code = row["BP Code"]?.trim();
          if (!bp_code) bp_code = ""; // leave empty if not provided

          const existing = existingData.find(
            (d) =>
              d.id === Number(row["ID"]) ||
              (d.bp_code && d.bp_code === bp_code)
          );

          const record = {
            sub_mother_id: selectedSubMother.id,
            sub_mother_dscode: selectedSubMother.dscode,
            name,

            branch,
            bp_code,
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

        // ✅ Execute insert/update operations
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

  // ---------- Export CSV ----------
  const exportSub3ToCSV = (subs) => {
    if (!selectedSubMother) {
      Swal.fire("Error", "No Sub-Mother selected.", "error");
      return;
    }

    if (subs.length === 0) {
      Swal.fire("Info", "No Sub-3 accounts to export.", "info");
      return;
    }

    const header = [
      "ID",
      "Sub-Mother ID",
      "Sub-Mother BP Code",
      "Name",

      "Branch",
      "BP Code",
      "Distributor Codes",
      "Distributor Names",
      "Status",
    ];

    const rows = subs.map((s3) => [
      s3.id,
      s3.sub_mother_id,
      s3.sub_mother_dscode || "",
      s3.name,

      s3.branch || "",
      s3.bp_code || "",
      s3.distributor_code || "",
      s3.distributor_name || "",
      s3.status ? "Active" : "Inactive",
    ]);

    const csvContent =
      [header, ...rows]
        .map((row) =>
          row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
        )
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
  const [searchTerm, setSearchTerm] = useState("");


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

          {/* 🔍 Search Bar */}
          <div style={{ marginTop: 15, marginBottom: 15 }}>
            <input
              type="text"
              placeholder="Search Sub-Mother..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "14px",
              }}
            />
          </div>

          {/* Two main containers side-by-side */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "20px",
              marginTop: "20px",
            }}
          >
            {/* LEFT CONTAINER - DIRECT MEGASOFT */}
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  color: "#0087c5",
                  fontSize: "20px",
                  marginBottom: "10px",
                  textAlign: "center",
                }}
              >
                DIRECT MEGASOFT
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "15px",
                }}
              >
                {subMothers
                  .filter(
                    (sub) =>
                      sub.mother_account?.name === "DIRECT MEGASOFT" &&
                      sub.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((sub) => (
                    <div
                      key={sub.id}
                      style={cardStyle}
                      onClick={() => fetchSub3Accounts(sub)}
                    >
                      <div style={cardHeader}>
                        <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>
                          {sub.name}
                        </h3>
                      </div>
                      <div style={cardBody}>
                        <p style={{ margin: 0, color: "#555", fontSize: 14 }}>
                          <strong>Mother:</strong>{" "}
                          {sub.mother_account?.name || "-"}
                        </p>
                        <p
                          style={{ margin: "5px 0 0 0", color: "#777", fontSize: 12 }}
                        >
                          <strong>Status:</strong>{" "}
                          {sub.status ? "Active" : "Inactive"}
                        </p>
                        <p
                          style={{ margin: "5px 0 0 0", color: "#999", fontSize: 12 }}
                        >
                          <strong>Created:</strong>{" "}
                          {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* RIGHT CONTAINER - DIRECT DISTRIBUTOR */}
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  color: "#0087c5",
                  fontSize: "20px",
                  marginBottom: "10px",
                  textAlign: "center",
                }}
              >
                DIRECT DISTRIBUTOR
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "15px",
                }}
              >
                {subMothers
                  .filter(
                    (sub) =>
                      sub.mother_account?.name === "DIRECT DISTRIBUTOR" &&
                      sub.name.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((sub) => (
                    <div
                      key={sub.id}
                      style={cardStyle}
                      onClick={() => fetchSub3Accounts(sub)}
                    >
                      <div style={cardHeader}>
                        <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>
                          {sub.name}
                        </h3>
                      </div>
                      <div style={cardBody}>
                        <p style={{ margin: 0, color: "#555", fontSize: 14 }}>
                          <strong>Mother:</strong>{" "}
                          {sub.mother_account?.name || "-"}
                        </p>
                        <p
                          style={{ margin: "5px 0 0 0", color: "#777", fontSize: 12 }}
                        >
                          <strong>Status:</strong>{" "}
                          {sub.status ? "Active" : "Inactive"}
                        </p>
                        <p
                          style={{ margin: "5px 0 0 0", color: "#999", fontSize: 12 }}
                        >
                          <strong>Created:</strong>{" "}
                          {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
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
              setFormData({
                name: "",
                branch: "", bp_code: ""
              });
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
                  <th style={thStyle}>Sub Mother DS Code</th> {/* ✅ added */}
                  <th style={thStyle}>BP Code</th> {/* ✅ added */}
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Branch</th>
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
                      <td style={tdStyle}>{s3.sub_mother_dscode || "-"}</td> {/* ✅ shows dscode */}
                      <td style={tdStyle}>{s3.bp_code || "-"}</td> {/* ✅ shows branch_code */}
                      <td style={tdStyle}>{s3.name}</td>
                      <td style={tdStyle}>{s3.branch}</td>
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
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            {/* Header */}
            <h3 style={styles.header}>
              {editMode
                ? `Edit Sub-3 Account (${selectedSubMother.name})`
                : `Create Sub-3 Account for ${selectedSubMother.name}`}
            </h3>

            {/* Close Button */}
            <button style={styles.closeBtn} onClick={() => setShowModal(false)}>
              &times;
            </button>

            {/* Form */}
            <form onSubmit={handleSaveSub3Account} style={styles.form}>

              {/* Input Fields */}
              <input
                type="text"
                name="bp_code"
                value={formData.bp_code}
                onChange={handleInputChange}
                placeholder="BP Code"
                style={styles.inputStyle}
              />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Sub-3 account name"
                style={styles.inputStyle}
                required
              />
              <input
                type="text"
                name="branch"
                value={formData.branch}
                onChange={handleInputChange}
                placeholder="Branch"
                style={styles.inputStyle}
              />

              {/* Distributor Selection Section */}
              <div style={styles.distributorSection}>
                <label style={styles.distributorLabel}>
                  Select Distributors: 📦
                </label>

                {/* Search Bar */}
                <input
                  type="text"
                  placeholder="Search distributors by name or code..."
                  value={distributorSearch}
                  onChange={(e) => setDistributorSearch(e.target.value)}
                  style={styles.searchBar}
                />

                {/* Distributor List Container */}
                <div style={styles.distributorListContainer}>
                  {distributors
                    .filter((dist) =>
                      (dist.name || "").toLowerCase().includes(distributorSearch.toLowerCase()) ||
                      (dist.code || "").toString().toLowerCase().includes(distributorSearch.toLowerCase())
                    )
                    .map((dist) => (
                      <label key={dist.code} style={styles.distributorItem}>
                        <input
                          type="checkbox"
                          checked={selectedDistributors.includes(dist.code)}
                          onChange={() => handleDistributorToggle(dist.code)}
                          style={{ marginRight: '6px' }}
                        />
                        {dist.name}
                      </label>
                    ))}
                </div>

              </div>

              {/* Save/Update Button */}
              <button type="submit" style={styles.btnSave}>
                {editMode ? "Update Account" : "Create Account"}
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
const styles = {
  // --- Modal Structure Styles ---
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '10px', // Smoother corners
    width: '90%',
    maxWidth: '550px', // A good standard width for forms
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', // Stronger shadow
    position: 'relative',
    maxHeight: '90vh', // Prevent content from going off-screen
    display: 'flex',
    flexDirection: 'column',
  },

  // --- Header and Close Button Styles ---
  header: {
    color: '#333',
    borderBottom: '2px solid #007bff', // Highlight color
    paddingBottom: '10px',
    marginBottom: '20px',
    fontSize: '1.4em',
  },
  closeBtn: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#aaa',
    padding: '5px 10px',
    transition: 'color 0.2s',
    // We can't do true :hover in inline styles easily without useState/onMouseEnter/onMouseLeave,
    // so we rely on the clean look.
  },

  // --- Form and Input Styles ---
  form: {
    marginTop: '0px', // Adjusted margin since header has marginBottom
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto', // Allows form content to scroll if tall
    paddingRight: '5px', // Space for the scrollbar
  },
  inputStyle: {
    width: '100%',
    padding: '12px', // More padding for better feel
    margin: '8px 0',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '15px',
    boxSizing: 'border-box', // Ensures padding doesn't increase total width
    transition: 'border-color 0.2s, box-shadow 0.2s',
    // Focus effect (requires onFocus/onBlur hooks for true inline hover/focus)
  },

  // --- Distributor Selection Styles ---
  distributorSection: {
    marginBottom: '20px', // More space below the section
    padding: '10px 0',
  },
  distributorLabel: {
    fontWeight: '600',
    display: 'block',
    marginBottom: '10px', // More space
    fontSize: '1.1em',
    color: '#555',
  },
  searchBar: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #007bff', // Highlight border for search
    marginBottom: '10px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  distributorListContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', // Wider minimum column
    gap: '10px', // More gap
    maxHeight: '250px', // Slightly shorter scrollable area
    overflowY: 'auto',
    border: '1px solid #eee',
    backgroundColor: '#f9f9f9', // Light background for the list
    padding: '12px',
    borderRadius: '6px',
  },
  distributorItem: {
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 0',
    cursor: 'pointer',
    color: '#333',
  },

  // --- Save Button Styles ---
  btnSave: {
    backgroundColor: '#007bff', // Primary Blue
    color: 'white',
    padding: '12px 20px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '20px',
    transition: 'background-color 0.3s, transform 0.1s',
    // For a real app, you'd use onMouseEnter/onMouseLeave to apply a darker color here.
    // Example alternative hover style: ':hover': { backgroundColor: '#0056b3' }
  },
};
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
