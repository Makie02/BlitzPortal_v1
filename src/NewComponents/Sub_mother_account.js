import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import Papa from "papaparse";

function MotherAccountPage() {
  const [motherAccounts, setMotherAccounts] = useState([]);
  const [activeMother, setActiveMother] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [editingSubAccount, setEditingSubAccount] = useState(null);
  const importInputRef = useRef(null);

  // Search states
  const [motherSearchQuery, setMotherSearchQuery] = useState("");
  const [subAccountSearchQuery, setSubAccountSearchQuery] = useState("");

  // Fetch mother accounts on component mount
  useEffect(() => {
    const fetchMotherAccounts = async () => {
      const { data, error } = await supabase
        .from("mother_account")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        console.error(error);
        Swal.fire("Error", "Failed to load mother accounts", "error");
      } else {
        setMotherAccounts(data);
      }
    };
    fetchMotherAccounts();
  }, []);

  // Filter mother accounts based on search query (name or code)
  const filteredMotherAccounts = motherAccounts.filter((mother) => {
    const q = motherSearchQuery.trim().toLowerCase();
    if (q === "") return true;
    const nameMatch = mother.name.toLowerCase().includes(q);
    const codeMatch = mother.code && mother.code.toLowerCase().includes(q);
    return nameMatch || codeMatch;
  });

  // Fetch sub-accounts when a mother account is selected
const fetchSubAccounts = async (mother) => {
  setActiveMother(mother);
  setSubAccountSearchQuery("");

  const { data, error } = await supabase
    .from("sub_mother_account")
    .select(`
      id,
      mother_id,
      bpcode,
      name,
      status,
      created_at,
      mother_account (
        id,
        code,
        name
      )
    `)
    .eq("mother_id", mother.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    Swal.fire("Error", "Failed to load sub-accounts", "error");
  } else {
    setSubAccounts(data);
  }
};


  // Filter sub-accounts by name or status
  const filteredSubAccounts = subAccounts.filter((sub) => {
    const q = subAccountSearchQuery.trim().toLowerCase();
    if (q === "") return true;
    const nameMatch = sub.name.toLowerCase().includes(q);
    const statusText = sub.status ? "active" : "inactive";
    const statusMatch = statusText.includes(q);
    return nameMatch || statusMatch;
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetModal = () => {
    setFormData({ name: "" });
    setEditingSubAccount(null);
    setShowModal(false);
  };

  const handleAddEditSubAccount = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return Swal.fire("Warning", "Sub-account name is required", "warning");
    }

    try {
      if (editingSubAccount) {
        // ✅ Edit existing sub-account
        const { error } = await supabase
          .from("sub_mother_account")
          .update({ name: formData.name })
          .eq("id", editingSubAccount.id);
        if (error) throw error;
        Swal.fire("Success", "Sub-account updated!", "success");
      } else {
        // ✅ Create new sub-account with auto BP code
        // Step 1: Get last bpcode
        const { data: existing, error: fetchError } = await supabase
          .from("sub_mother_account")
          .select("bpcode")
          .order("id", { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        // Step 2: Determine next BP code
        let nextBPCode = "BP100000";
        if (existing && existing.length > 0 && existing[0].bpcode) {
          const lastCode = existing[0].bpcode;
          const lastNumber = parseInt(lastCode.replace("BP", ""), 10);
          if (!isNaN(lastNumber)) {
            nextBPCode = `BP${lastNumber + 1}`;
          }
        }

        // Step 3: Insert new record
        const { error: insertError } = await supabase
          .from("sub_mother_account")
          .insert([
            {
              mother_id: activeMother.id,
              name: formData.name,
              bpcode: nextBPCode,
              status: true,
            },
          ]);
        if (insertError) throw insertError;

        Swal.fire("Success", `Sub-account created! (${nextBPCode})`, "success");
      }

      resetModal();
      fetchSubAccounts(activeMother);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", error.message, "error");
    }
  };

  const handleBack = () => {
    setActiveMother(null);
    setSubAccounts([]);
    setMotherSearchQuery("");
  };

  const triggerImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  const handleImportCSV = async (e) => {
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
        const hasName = results.meta.fields.includes("Sub-Mother Name");
        if (!hasName) {
          Swal.fire(
            "Error",
            `Missing required column: "Sub-Mother Name"`,
            "error"
          );
          return;
        }
        const hasID = results.meta.fields.includes("ID");
        let existingIDs = [];
        if (hasID) {
          const { data: existingSubs, error } = await supabase
            .from("sub_mother_account")
            .select("id");
          if (error) {
            console.error(error);
            Swal.fire("Error", "Failed to check existing records", "error");
            return;
          }
          existingIDs = existingSubs.map((item) => String(item.id));
        }

        const toInsert = [];
        const toUpdate = [];

        parsedData.forEach((row) => {
          const name = row["Sub-Mother Name"]?.trim();
          const id = String(row["ID"] || "").trim();
          if (!name) return;
          const record = {
            name,
            mother_id: activeMother.id,
          };
          if (hasID && id) {
            if (existingIDs.includes(id)) {
              toUpdate.push({ ...record, id });
            } else {
              toInsert.push({ ...record, id });
            }
          } else {
            toInsert.push(record);
          }
        });

        if (toInsert.length === 0 && toUpdate.length === 0) {
          Swal.fire("Info", "No valid records found to import.", "info");
          return;
        }

        try {
          if (toInsert.length > 0) {
            const { error: insertError } = await supabase
              .from("sub_mother_account")
              .insert(toInsert);
            if (insertError) throw insertError;
          }
          for (const updateRow of toUpdate) {
            const { id, ...fields } = updateRow;
            const { error: updateError } = await supabase
              .from("sub_mother_account")
              .update(fields)
              .eq("id", id);
            if (updateError) throw updateError;
          }
          Swal.fire("Success", "CSV import complete (inserted & updated).", "success");
          fetchSubAccounts(activeMother);
        } catch (err) {
          console.error(err);
          Swal.fire("Error", err.message, "error");
        }
      },
      error: function (error) {
        console.error(error);
        Swal.fire("Error", "Failed to parse CSV file.", "error");
      },
    });

    e.target.value = null;
  };

  const exportSubAccountsToCSV = (subs, motherInfo) => {
    if (subs.length === 0) {
      Swal.fire("Info", "No sub-accounts to export.", "info");
      return;
    }
    const header = [
      "ID",
      "Mother Code",
      "BP Code",
      "Sub-Mother Name",
      "Status",
      "Created At",
    ];
    const rows = subs.map((sub) => [
      sub.id,
      sub.mother_account?.code || "",
      sub.mother_account?.name || "",
      sub.name,
      sub.status ? "Active" : "Inactive",
      new Date(sub.created_at).toLocaleString(),
    ]);
    const csvContent =
      [header, ...rows]
        .map((row) => row.map((v) => `"${v}"`).join(","))
        .join("\n") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sub_accounts_${motherInfo.code || motherInfo.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = (sub) => {
    setEditingSubAccount(sub);
    setFormData({ name: sub.name });
    setShowModal(true);
  };

  const handleDelete = (sub) => {
    Swal.fire({
      title: "Are you sure?",
      text: `Delete sub-account "${sub.name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const { error } = await supabase
            .from("sub_mother_account")
            .delete()
            .eq("id", sub.id);
          if (error) throw error;
          Swal.fire("Deleted!", "Sub-account has been deleted.", "success");
          fetchSubAccounts(activeMother);
        } catch (error) {
          console.error(error);
          Swal.fire("Error", error.message, "error");
        }
      }
    });
  };

  const toggleStatus = async (sub) => {
    try {
      const { error } = await supabase
        .from("sub_mother_account")
        .update({ status: !sub.status })
        .eq("id", sub.id);
      if (error) throw error;
      fetchSubAccounts(activeMother);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to update status", "error");
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      {!activeMother && (
        <>
          <h1 style={{ textAlign: "center", marginBottom: 30, color: "#0087c5" }}>
            Mother Accounts
          </h1>

          {/* Search bar for mother accounts */}
          <div style={{ margin: "0 auto", width: "300px", marginBottom: 20 }}>
            <input
              type="text"
              placeholder="Search mother accounts..."
              value={motherSearchQuery}
              onChange={(e) => setMotherSearchQuery(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={cardContainer}>
            {filteredMotherAccounts.map((mother) => (
              <div
                key={mother.id}
                style={cardStyle}
                onClick={() => fetchSubAccounts(mother)}
              >
                <div style={cardHeader}>
                  <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>{mother.name}</h3>
                </div>
                <div style={cardBody}>
                  <p style={{ margin: 0, color: "#555", fontSize: 14 }}>
                    Code: <strong>{mother.code}</strong>
                  </p>
                  <p style={{ margin: "5px 0 0 0", color: "#777", fontSize: 12 }}>
                    Status: {mother.status ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            ))}
            {filteredMotherAccounts.length === 0 && (
              <p style={{ textAlign: "center", color: "#888", width: "100%" }}>
                No mother accounts found.
              </p>
            )}
          </div>
        </>
      )}

      {activeMother && (
        <div style={tabPanel}>
          <button style={btnBack} onClick={handleBack}>
            ← Back to Mother Accounts
          </button>

          <h2>Sub-Mother Accounts for {activeMother.name}</h2>

          {/* Search bar for sub-accounts */}
          <div style={{ marginBottom: 10, width: "300px" }}>
            <input
              type="text"
              placeholder="Search sub-accounts..."
              value={subAccountSearchQuery}
              onChange={(e) => setSubAccountSearchQuery(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <button style={btnAdd} onClick={() => { resetModal(); setShowModal(true); }}>
              + Add Sub-Account
            </button>
            <button
              style={{ ...btnAdd, marginLeft: 10, backgroundColor: "#6c757d" }}
              onClick={triggerImportClick}
            >
              Import CSV
            </button>
            <button
              style={{ ...btnAdd, marginLeft: 10, backgroundColor: "#17a2b8" }}
              onClick={() => exportSubAccountsToCSV(filteredSubAccounts, activeMother)}
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
                  <th style={thStyle}>Mother Code</th>
                  <th style={thStyle}>BP Code</th>
                  <th style={thStyle}>Sub-Mother Name</th> {/* <-- COLUMN HEADER for sub.name */}
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created At</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 10 }}>
                      No sub-accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredSubAccounts.map((sub) => (
                    <tr key={sub.id} style={trResponsive}>
                      <td style={tdStyle}>{sub.id}</td>
                      <td style={tdStyle}>{sub.mother_account?.code || "-"}</td>
                      <td style={tdStyle}>{sub.bpcode}</td> {/* ✅ KEPT THIS LINE */}

                      <td style={tdStyle}>{sub.name}</td> {/* ✅ KEPT THIS LINE */}
                      <td style={tdStyle}>{sub.status ? "Active" : "Inactive"}</td>
                      <td style={tdStyle}>{new Date(sub.created_at).toLocaleString()}</td>
                      <td style={tdStyle}>
                        <button style={btnEdit} onClick={() => handleEdit(sub)}>
                          Edit
                        </button>
                        <button style={btnDelete} onClick={() => handleDelete(sub)}>
                          Delete
                        </button>
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
              {editingSubAccount
                ? `Edit Sub-Account for ${activeMother?.name}`
                : `Create Sub-Account for ${activeMother?.name}`}
            </h3>
            <button style={closeBtn} onClick={resetModal}>
              &times;
            </button>
            <form onSubmit={handleAddEditSubAccount} style={{ marginTop: 20 }}>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Sub-account name"
                style={inputStyle}
                autoFocus
              />
              <button type="submit" style={btnSave}>
                {editingSubAccount ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MotherAccountPage;

// --- Styles ---
const cardContainer = {
  display: "flex",
  flexWrap: "wrap",
  gap: "20px",
  justifyContent: "center",
};

const cardStyle = {
  flex: "0 0 220px",
  borderRadius: 12,
  background: "#f9f9f9",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  transition: "transform 0.2s, box-shadow 0.2s",
  overflow: "hidden",
};

const cardHeader = {
  background: "linear-gradient(135deg, #0087c5, #00b0ff)",
  padding: "15px",
  textAlign: "center",
};

const cardBody = {
  padding: "15px",
  textAlign: "center",
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
  padding: 20,
  borderRadius: 8,
  width: "400px",
  position: "relative",
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

const responsiveTableWrapper = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 700,
};

const thStyle = {
  padding: 10,
  textAlign: "left",
  background: "#0087c5",
  color: "#fff",
  fontSize: 14,
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid #ddd",
  fontSize: 13,
};

const trResponsive = {
  background: "#fafafa",
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

const btnEdit = {
  padding: "4px 8px",
  background: "#ffc107",
  color: "#212529",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  marginRight: 8,
  fontSize: 12,
};

const btnDelete = {
  padding: "4px 8px",
  background: "#dc3545",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
};
