import React, { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FaSearch } from "react-icons/fa";
import "./BrandSelector.css";

function CategorySelector() {

  const handleExport = () => {
    if (!categories || categories.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(categories);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Categories");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `categories_${selectedDistributor}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    for (let row of rows) {
      if (!row.code) continue; // skip if no code
      const { data: existing } = await supabase
        .from("categorydetails")
        .select("*")
        .eq("code", row.code)
        .maybeSingle();

      if (existing) {
        await supabase.from("categorydetails").update(row).eq("code", row.code);
      } else {
        await supabase.from("categorydetails").insert({ ...row, principal_id: selectedDistributorId, parentname: selectedDistributor });
      }
    }

    Swal.fire("Success", "Import completed!", "success");
    fetchCategories(selectedDistributorId);
  };


  const [distributors, setDistributors] = useState([]);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [selectedDistributorId, setSelectedDistributorId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({
    code: null,
    name: "",
    description: "",
    mother_customer_group: "",
    customergroup1: "",
    customergroup2: "",
    customergroup3: "",
    customergroup4: "",
    customergroup5: "",
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch distributors on load
  useEffect(() => {
    const fetchDistributors = async () => {
      const { data, error } = await supabase.from("distributors").select("*").order("name");
      if (!error) setDistributors(data);
    };
    fetchDistributors();
  }, []);

  // Fetch categories for selected distributor
  const fetchCategories = async (distributorId) => {
    const { data, error } = await supabase
      .from("categorydetails")
      .select("*")
      .eq("principal_id", distributorId)
      .order("name");
    if (!error) setCategories(data);
  };

  const handleDistributorClick = (dist) => {
    setSelectedDistributor(dist.name);
    setSelectedDistributorId(dist.id);
    fetchCategories(dist.id);
    setShowFormModal(false);
  };

  const fetchCategoryDetailsFromSupabase = async (distributorId) => {
    try {
      console.log("📡 Fetching categories for distributorId:", distributorId);

      const batchSize = 1000;
      let allData = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        console.log(
          `📥 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`
        );

        const { data, error } = await supabase
          .from("categorydetails")
          .select(`
          code,
          name,
          description,
          parentname,
          principal_id,
          mother_customer_group,
          customergroup1,
          customergroup2,
          customergroup3,
          customergroup4,
          customergroup5
        `)
          .eq("principal_id", distributorId)
          .order("name", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error("❌ Error during batch fetch:", error);
          throw error;
        }

        console.log(
          `✅ Fetched batch ${Math.floor(offset / batchSize) + 1}: ${data?.length || 0} records`
        );

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
          console.log(`📊 Total records so far: ${allData.length}`);
        } else {
          hasMore = false;
          console.log("🏁 Finished fetching all category data");
        }
      }

      if (allData.length === 0) {
        console.log("⚠️ No categories found for selected distributor");
        return [];
      }

      // keep ALL fields intact
      console.log(`✅ Returning ${allData.length} full rows`);
      return allData;
    } catch (error) {
      console.error("🚨 Failed to fetch categories:", error);
      return [];
    }
  };


  const openFormModal = async (item = null) => {
    // If editing a specific category, populate the form
    if (item) {
      setFormData(item);
    } else {
      // Reset form for adding new category
      setFormData({
        code: null,
        name: "",
        description: "",
        mother_customer_group: "",
        customergroup1: "",
        customergroup2: "",
        customergroup3: "",
        customergroup4: "",
        customergroup5: "",
      });
    }

    // Fetch all categories for the distributor and keep in state
    if (selectedDistributorId) {
      try {
        const allCategories = await fetchCategoryDetailsFromSupabase(selectedDistributorId);
        setCategories(allCategories);
        console.log("📊 Categories loaded for modal:", allCategories.length);
      } catch (err) {
        console.error("❌ Failed to fetch categories for modal:", err);
      }
    }

    // Open the modal
    setShowFormModal(true);
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

const handleSave = async (e) => {
  e.preventDefault();

  if (!formData.name.trim()) {
    Swal.fire({
      icon: "warning",
      title: "Validation Error",
      text: "Name is required",
    });
    return;
  }

  if (!selectedDistributorId) {
    Swal.fire({
      icon: "warning",
      title: "No Distributor Selected",
      text: "Please select a distributor first.",
    });
    return;
  }

  try {
    if (formData.code) {
      // UPDATE
      const { error } = await supabase
        .from("categorydetails")
        .update({
          name: formData.name,
          description: formData.description || null,
          mother_customer_group: formData.mother_customer_group || null,
          customergroup1: formData.customergroup1 || null,
          customergroup2: formData.customergroup2 || null,
          customergroup3: formData.customergroup3 || null,
          customergroup4: formData.customergroup4 || null,
          customergroup5: formData.customergroup5 || null,
          principal_id: selectedDistributorId ? Number(selectedDistributorId) : null,
          parentname: selectedDistributor || null,
        })
        .eq("code", formData.code);

      if (error) throw error;
    } else {
      // INSERT
      const { data: existingCodes, error: fetchError } = await supabase
        .from("categorydetails")
        .select("code")
        .like("code", "A%")
        .order("code", { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      let nextCode = "A00001";
      if (existingCodes.length > 0) {
        const lastCode = existingCodes[0].code;
        const numericPart = parseInt(lastCode.slice(1)) + 1;
        nextCode = `A${numericPart.toString().padStart(5, "0")}`;
      }

      const { error } = await supabase
        .from("categorydetails")
        .insert({
          code: nextCode,
          name: formData.name,
          description: formData.description || null,
          mother_customer_group: formData.mother_customer_group || null,
          customergroup1: formData.customergroup1 || null,
          customergroup2: formData.customergroup2 || null,
          customergroup3: formData.customergroup3 || null,
          customergroup4: formData.customergroup4 || null,
          customergroup5: formData.customergroup5 || null,
          principal_id: selectedDistributorId,
          parentname: selectedDistributor,
        });

      if (error) throw error;
    }

    // ✅ Refresh table immediately
    const newDetails = await fetchCategoryDetailsFromSupabase(selectedDistributorId);
    setCategories(newDetails); // ← use correct state setter

    // Reset form & close modal
    setShowFormModal(false);
    setFormData({
      code: null,
      name: "",
      description: "",
      mother_customer_group: "",
      customergroup1: "",
      customergroup2: "",
      customergroup3: "",
      customergroup4: "",
      customergroup5: "",
    });

    Swal.fire({
      icon: "success",
      title: "Success",
      text: "Category saved successfully!",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Save failed:", error);
    Swal.fire({
      icon: "error",
      title: "Save Failed",
      text: error.message || "Unknown error",
    });
  }
};

const handleDelete = async (code) => {
  const result = await Swal.fire({
    title: "Are you sure?",
    text: "Do you really want to delete this category?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!",
  });

  if (result.isConfirmed) {
    try {
      const { error } = await supabase
        .from("categorydetails")
        .delete()
        .eq("code", code);

      if (error) throw error;

      setCategories((prev) => prev.filter((item) => item.code !== code)); // ← correct state setter

      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Category has been deleted.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Delete failed:", error);
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: error.message || "Unknown error",
      });
    }
  }
};


 
  const handleBack = () => {
    setSelectedDistributor(null);
    setSelectedDistributorId(null);
    setCategories([]);
    setSearchTerm("");
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const [distributorSearch, setDistributorSearch] = useState("");

  const filteredDistributors = distributors.filter(d =>
    d.name.toLowerCase().includes(distributorSearch.toLowerCase())
  );

  // --- Styles (same as your Category_Listing) ---
  const cardContainer = {
    display: "flex",
    flexWrap: "wrap",
    gap: "20px",
    justifyContent: "center",
  };

  const cardStyle = {
    flex: "300px",
    borderRadius: 12,
    background: "#f9f9f9",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
    overflow: "hidden",
  };
  
  const [showMotherModal, setShowMotherModal] = useState(false);
  const [motherAccounts, setMotherAccounts] = useState([]);

  // Fetch mother accounts
  const fetchMotherAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("mother_account")
        .select("id, code, name, status")
        .eq("status", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setMotherAccounts(data || []);
    } catch (error) {
      console.error("Error fetching mother accounts:", error);
      Swal.fire("Error", error.message, "error");
    }
  };

  const filteredMotherAccounts = motherAccounts.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectMother = (account) => {
    setFormData(prev => ({
      ...prev,
      mother_customer_group: account.code, // save code
    }));
    setMotherName(account.name); // display name
    setShowMotherModal(false);
  };


  // Top of your BrandSelector component
  const [motherName, setMotherName] = useState(""); // display Mother Customer Group name
  const [group1Name, setGroup1Name] = useState(""); // display Customer Group 1 name
  const [group2Name, setGroup2Name] = useState(""); // display Customer Group 2 name
  const [group3Name, setGroup3Name] = useState(""); // display Customer Group 3 name
  const [group4Name, setGroup4Name] = useState(""); // display Customer Group 4 name
  const [group5Name, setGroup5Name] = useState(""); // display Customer Group 5 name


  // === GROUP 1 ===
  const [showModal1, setShowModal1] = useState(false);
  const [groups1, setGroups1] = useState([]);
  const [searchTerm1, setSearchTerm1] = useState("");

  const fetchGroups1 = async () => {
    try {
      const { data, error } = await supabase
        .from("customer_group1")
        .select("id, code, name, status")
        .eq("status", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setGroups1(data || []);
    } catch (error) {
      console.error("Error fetching customer group 1:", error);
      Swal.fire("Error", error.message, "error");
    }
  };

  const filteredGroups1 = groups1.filter((item) =>
    item.name.toLowerCase().includes(searchTerm1.toLowerCase())
  );

  const handleSelectGroup1 = (group) => {
    setFormData(prev => ({
      ...prev,
      customergroup1: group.code,
    }));
    setGroup1Name(group.name);
    setShowModal1(false);
  };
  // === GROUP 2 ===
  const [showModal2, setShowModal2] = useState(false);
  const [groups2, setGroups2] = useState([]);
  const [searchTerm2, setSearchTerm2] = useState("");

  const fetchGroups2 = async () => {
    try {
      const { data, error } = await supabase
        .from("customer_group2")
        .select("id, code, name, status")
        .eq("status", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setGroups2(data || []);
    } catch (error) {
      console.error("Error fetching customer group 2:", error);
      Swal.fire("Error", error.message, "error");
    }
  };

  const filteredGroups2 = groups2.filter((item) =>
    item.name.toLowerCase().includes(searchTerm2.toLowerCase())
  );



  const handleSelectGroup2 = (group) => {
    setFormData(prev => ({
      ...prev,
      customergroup2: group.code,
    }));
    setGroup2Name(group.name);
    setShowModal2(false);
  };

  const [showModal3, setShowModal3] = useState(false);
  const [groups3, setGroups3] = useState([]);
  const [searchTerm3, setSearchTerm3] = useState("");

  // Fetch customer_group3
  const fetchGroups3 = async () => {
    try {
      const { data, error } = await supabase
        .from("customer_group3")
        .select("id, code, name, status")
        .eq("status", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setGroups3(data || []);
    } catch (error) {
      console.error("Error fetching customer group 3:", error);
      Swal.fire("Error", error.message, "error");
    }
  };

  const filteredGroups3 = groups3.filter((item) =>
    item.name.toLowerCase().includes(searchTerm3.toLowerCase())
  );




  const handleSelectGroup3 = (group) => {
    setFormData(prev => ({
      ...prev,
      customergroup3: group.code,
    }));
    setGroup3Name(group.name);
    setShowModal3(false);
  };
  // STATE
  const [showModal4, setShowModal4] = useState(false);
  const [groups4, setGroups4] = useState([]);
  const [searchTerm4, setSearchTerm4] = useState("");

  const [showModal5, setShowModal5] = useState(false);
  const [groups5, setGroups5] = useState([]);
  const [searchTerm5, setSearchTerm5] = useState("");

  // FETCH GROUPS
  const fetchGroups4 = async () => {
    try {
      const { data, error } = await supabase
        .from("customer_group4")
        .select("id, code, name, status")
        .eq("status", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setGroups4(data || []);
    } catch (error) {
      console.error("Error fetching customer group 4:", error);
      Swal.fire("Error", error.message, "error");
    }
  };

  const fetchGroups5 = async () => {
    try {
      const { data, error } = await supabase
        .from("customer_group5")
        .select("id, code, name, status")
        .eq("status", true)
        .order("name", { ascending: true });
      if (error) throw error;
      setGroups5(data || []);
    } catch (error) {
      console.error("Error fetching customer group 5:", error);
      Swal.fire("Error", error.message, "error");
    }
  };

  // FILTERED
  const filteredGroups4 = groups4.filter((item) =>
    item.name.toLowerCase().includes(searchTerm4.toLowerCase())
  );
  const filteredGroups5 = groups5.filter((item) =>
    item.name.toLowerCase().includes(searchTerm5.toLowerCase())
  );

  // SELECT HANDLERS



  const handleSelectGroup4 = (group) => {
    setFormData(prev => ({
      ...prev,
      customergroup4: group.code,
    }));
    setGroup4Name(group.name);
    setShowModal4(false);
  };
  const handleSelectGroup5 = (group) => {
    setFormData(prev => ({
      ...prev,
      customergroup5: group.code,
    }));
    setGroup5Name(group.name);
    setShowModal5(false);
  };

  const cardHeader = { background: "linear-gradient(135deg, #0087c5, #00b0ff)", padding: 15, textAlign: "center" };
  const cardBody = { padding: 15, textAlign: "center" };
  const tabPanel = { marginTop: 20, padding: 15, border: "1px solid #ccc", borderRadius: 8, background: "#fff", overflowX: "auto" };
  const btnBack = { padding: "6px 12px", background: "#555", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", marginBottom: 10 };
  const btnAdd = { padding: "6px 12px", background: "#0087c5", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", marginBottom: 10 };
  const searchInputStyle = { width: "100%", padding: 8, marginBottom: 10, borderRadius: 4, border: "1px solid #ccc" };
  const tableStyle = { width: "100%", borderCollapse: "collapse" };
  const thStyle = { padding: 10, textAlign: "left", background: "#0087c5", color: "#fff", fontSize: 14 };
  const tdStyle = { padding: 10, borderBottom: "1px solid #ddd", fontSize: 13 };
  const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" };
  const modalContent = { background: "#fff", padding: 20, borderRadius: 8, width: 400, position: "relative" };
  const closeBtn = { position: "absolute", top: 10, right: 10, fontSize: 20, background: "transparent", border: "none", cursor: "pointer" };
  const inputStyle = { width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc", marginBottom: 10 };
  const btnSave = { padding: "6px 12px", background: "#28a745", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" };
  const labelStyle = { display: "block", marginBottom: 4, fontWeight: 500, color: "#333" };
  const buttonBaseStyle = { background: "transparent", border: "none", cursor: "pointer", padding: "6px 10px", marginLeft: 8, borderRadius: 6 };
  const editButtonStyle = { ...buttonBaseStyle, color: "orange" };
  const deleteButtonStyle = { ...buttonBaseStyle, color: "#d32f2f" };

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      {!selectedDistributor && (
        <>
          <h1 style={{ textAlign: "center", marginBottom: 20, color: "#0087c5" }}>Distributors</h1>

          {/* Search bar for distributors */}
          <input
            type="text"
            placeholder="Search distributors..."
            value={distributorSearch}
            onChange={e => setDistributorSearch(e.target.value)}
            style={{ ...searchInputStyle, marginBottom: 20 }}
          />

          <div style={cardContainer}>
            {filteredDistributors.length === 0 ? (
              <p style={{ textAlign: "center", gridColumn: "1 / -1" }}>No distributors found.</p>
            ) : (
              filteredDistributors.map(d => (
                <div key={d.id} style={cardStyle} onClick={() => handleDistributorClick(d)}>
                  <div style={cardHeader}>
                    <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>{d.name}</h3>
                  </div>
                  <div style={cardBody}>
                    <p style={{ margin: 0 }}>ID: <strong>{d.id}</strong></p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {selectedDistributor && (
        <div style={tabPanel}>
          <button style={btnBack} onClick={handleBack}>← Back to Distributors</button>
          <h2>Distributor under {selectedDistributor}</h2>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button style={btnAdd} onClick={() => openFormModal()}>+ Add Category</button>

            <div>
              <button style={{ ...btnAdd, marginRight: 8 }} onClick={handleExport}>📥 Export Excel</button>

              <label style={{ padding: "6px 12px", background: "#00b0ff", color: "#fff", borderRadius: 4, cursor: "pointer" }}>
                📂 Import Excel
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImport}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>


          <input type="text" placeholder="Search categories..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={searchInputStyle} />

          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Mother</th>
                  <th style={thStyle}>C1</th>
                  <th style={thStyle}>C2</th>
                  <th style={thStyle}>C3</th>
                  <th style={thStyle}>C4</th>
                  <th style={thStyle}>C5</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 10 }}>No categories found.</td>
                  </tr>
                ) : (
                  filteredCategories.map(cat => (
                    <tr key={cat.code}>
                      <td style={tdStyle}>{cat.name}</td>
                      <td style={tdStyle}>{cat.description}</td>
                      <td style={tdStyle}>{cat.mother_customer_group || "-"}</td>
                      <td style={tdStyle}>{cat.customergroup1 || "-"}</td>
                      <td style={tdStyle}>{cat.customergroup2 || "-"}</td>
                      <td style={tdStyle}>{cat.customergroup3 || "-"}</td>
                      <td style={tdStyle}>{cat.customergroup4 || "-"}</td>
                      <td style={tdStyle}>{cat.customergroup5 || "-"}</td>
                      <td style={tdStyle}>
                        <button onClick={() => openFormModal(cat)} style={editButtonStyle}><FaEdit /></button>
                        <button onClick={() => handleDelete(cat.code)} style={deleteButtonStyle}><FaTrash /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

     {showFormModal && (
            <div
              className="DistriModal-overlay"
              style={{
                backgroundColor: "rgba(0,0,0,0.5)",
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 2000,
                overflowY: "auto",
                padding: "20px",
              }}
            >          <form
              className="DistriModal-content"
              onSubmit={handleSave}
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                padding: "30px",
                width: "90%",
                maxWidth: "1200px",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
                <h2 style={{ marginBottom: "20px", fontSize: "28px" }}>
                  {formData.code ? "Edit Category" : "Add Category"}
                </h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "15px",
                    marginTop: "10px",
                  }}
                >
                  <div>
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label htmlFor="mother_customer_group">Mother Customer Group</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="mother_customer_group"
                        name="mother_customer_group"
                        value={motherName}
                        onChange={handleInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          fetchMotherAccounts();
                          setShowMotherModal(true);
                        }}
                        style={{
                          padding: "0 10px",
                          backgroundColor: "#007bff",
                          border: "none",
                          color: "white",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        <FaSearch />
                      </button>
                    </div>

                    {/* Mother Account Modal */}
                    {showMotherModal && (
                      <div
                        style={{
                          position: "fixed",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          backgroundColor: "rgba(0,0,0,0.5)",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          zIndex: 1000,
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "white",
                            borderRadius: 8,
                            padding: 20,
                            width: "500px",
                            maxHeight: "80vh",
                            overflowY: "auto",
                          }}
                        >
                          <h3>Select Mother Customer Group</h3>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px",
                              marginBottom: "10px",
                              borderRadius: "4px",
                              border: "1px solid #ccc",
                            }}
                          />
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredMotherAccounts.length === 0 ? (
                                <tr>
                                  <td colSpan={2} style={{ textAlign: "center", padding: "10px" }}>
                                    No data found
                                  </td>
                                </tr>
                              ) : (
                                filteredMotherAccounts.map((account) => (
                                  <tr
                                    key={account.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelectMother(account)}
                                  >
                                    <td style={tdStyle}>{account.code}</td>
                                    <td style={tdStyle}>{account.name}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          <button
                            onClick={() => setShowMotherModal(false)}
                            style={{
                              marginTop: 10,
                              padding: "8px 16px",
                              borderRadius: 4,
                              border: "none",
                              backgroundColor: "#d33",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* === CUSTOMER GROUP 1 === */}
                  <div>
                    <label htmlFor="customergroup1">Customer Group 1</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="customergroup1"
                        name="customergroup1"
                        value={group1Name}
                        onChange={handleInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          fetchGroups1();
                          setShowModal1(true);
                        }}
                        style={{
                          padding: "0 10px",
                          backgroundColor: "#007bff",
                          border: "none",
                          color: "white",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        <FaSearch />
                      </button>
                    </div>

                    {showModal1 && (
                      <div style={modalOverlayStyle}>
                        <div style={modalContentStyle}>
                          <h3>Select Customer Group 1</h3>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm1}
                            onChange={(e) => setSearchTerm1(e.target.value)}
                            style={modalSearchStyle}
                          />
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredGroups1.length === 0 ? (
                                <tr>
                                  <td colSpan={2} style={{ textAlign: "center", padding: "10px" }}>
                                    No data found
                                  </td>
                                </tr>
                              ) : (
                                filteredGroups1.map((group) => (
                                  <tr
                                    key={group.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelectGroup1(group)}
                                  >
                                    <td style={tdStyle}>{group.code}</td>
                                    <td style={tdStyle}>{group.name}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          <button
                            onClick={() => setShowModal1(false)}
                            style={modalCloseBtnStyle}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* === CUSTOMER GROUP 2 === */}
                  <div>
                    <label htmlFor="customergroup2">Customer Group 2</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="customergroup2"
                        name="customergroup2"
                        value={group2Name}
                        onChange={handleInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          fetchGroups2();
                          setShowModal2(true);
                        }}
                        style={{
                          padding: "0 10px",
                          backgroundColor: "#007bff",
                          border: "none",
                          color: "white",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        <FaSearch />
                      </button>
                    </div>

                    {showModal2 && (
                      <div style={modalOverlayStyle}>
                        <div style={modalContentStyle}>
                          <h3>Select Customer Group 2</h3>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm2}
                            onChange={(e) => setSearchTerm2(e.target.value)}
                            style={modalSearchStyle}
                          />
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredGroups2.length === 0 ? (
                                <tr>
                                  <td colSpan={2} style={{ textAlign: "center", padding: "10px" }}>
                                    No data found
                                  </td>
                                </tr>
                              ) : (
                                filteredGroups2.map((group) => (
                                  <tr
                                    key={group.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelectGroup2(group)}
                                  >
                                    <td style={tdStyle}>{group.code}</td>
                                    <td style={tdStyle}>{group.name}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          <button
                            onClick={() => setShowModal2(false)}
                            style={modalCloseBtnStyle}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>


                  {/* === CUSTOMER GROUP 3 === */}
                  <div>
                    <label htmlFor="customergroup3">Customer Group 3</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="customergroup3"
                        name="customergroup3"
                        value={group3Name}
                        onChange={handleInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          fetchGroups3();
                          setShowModal3(true);
                        }}
                        style={{
                          padding: "0 10px",
                          backgroundColor: "#007bff",
                          border: "none",
                          color: "white",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        <FaSearch />
                      </button>
                    </div>

                    {showModal3 && (
                      <div style={modalOverlayStyle}>
                        <div style={modalContentStyle}>
                          <h3>Select Customer Group 3</h3>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm3}
                            onChange={(e) => setSearchTerm3(e.target.value)}
                            style={modalSearchStyle}
                          />
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredGroups3.length === 0 ? (
                                <tr>
                                  <td colSpan={2} style={{ textAlign: "center", padding: "10px" }}>
                                    No data found
                                  </td>
                                </tr>
                              ) : (
                                filteredGroups3.map((group) => (
                                  <tr
                                    key={group.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelectGroup3(group)}
                                  >
                                    <td style={tdStyle}>{group.code}</td>
                                    <td style={tdStyle}>{group.name}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          <button
                            onClick={() => setShowModal3(false)}
                            style={modalCloseBtnStyle}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* === CUSTOMER GROUP 4 === */}
                  <div>
                    <label htmlFor="customergroup4">Customer Group 4</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="customergroup4"
                        name="customergroup4"
                        value={group4Name}
                        onChange={handleInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          fetchGroups4();
                          setShowModal4(true);
                        }}
                        style={{
                          padding: "0 10px",
                          backgroundColor: "#007bff",
                          border: "none",
                          color: "white",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        <FaSearch />
                      </button>
                    </div>

                    {showModal4 && (
                      <div style={modalOverlayStyle}>
                        <div style={modalContentStyle}>
                          <h3>Select Customer Group 4</h3>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm4}
                            onChange={(e) => setSearchTerm4(e.target.value)}
                            style={modalSearchStyle}
                          />
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredGroups4.length === 0 ? (
                                <tr>
                                  <td colSpan={2} style={{ textAlign: "center", padding: "10px" }}>
                                    No data found
                                  </td>
                                </tr>
                              ) : (
                                filteredGroups4.map((group) => (
                                  <tr
                                    key={group.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelectGroup4(group)}
                                  >
                                    <td style={tdStyle}>{group.code}</td>
                                    <td style={tdStyle}>{group.name}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          <button onClick={() => setShowModal4(false)} style={modalCloseBtnStyle}>
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* === CUSTOMER GROUP 5 === */}
                  <div>
                    <label htmlFor="customergroup5">Customer Group 5</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        id="customergroup5"
                        name="customergroup5"
                        value={group5Name}
                        onChange={handleInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          fetchGroups5();
                          setShowModal5(true);
                        }}
                        style={{
                          padding: "0 10px",
                          backgroundColor: "#007bff",
                          border: "none",
                          color: "white",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        <FaSearch />
                      </button>
                    </div>

                    {showModal5 && (
                      <div style={modalOverlayStyle}>
                        <div style={modalContentStyle}>
                          <h3>Select Customer Group 5</h3>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm5}
                            onChange={(e) => setSearchTerm5(e.target.value)}
                            style={modalSearchStyle}
                          />
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Code</th>
                                <th style={thStyle}>Name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredGroups5.length === 0 ? (
                                <tr>
                                  <td colSpan={2} style={{ textAlign: "center", padding: "10px" }}>
                                    No data found
                                  </td>
                                </tr>
                              ) : (
                                filteredGroups5.map((group) => (
                                  <tr
                                    key={group.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelectGroup5(group)}
                                  >
                                    <td style={tdStyle}>{group.code}</td>
                                    <td style={tdStyle}>{group.name}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                          <button onClick={() => setShowModal5(false)} style={modalCloseBtnStyle}>
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                <div className="form-buttons" style={{ marginTop: "20px" }}>
                  <button type="submit" className="btn-save">
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowFormModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
    </div>
  );
}

export default CategorySelector;
const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 12px",
};

const thStyle = {
  padding: "12px 15px",
  textAlign: "left",
  fontWeight: 500,
  fontSize: 16,
  color: "#f7f7f7ff",
  backgroundColor: "#0087c5ff",
  borderBottom: "2px solid #ddd",
};

const tdStyle = {
  padding: "12px 15px",
  textAlign: "left",
  fontWeight: 500,
  fontSize: 16,
  color: "#333",
  backgroundColor: "#fafafa",
  borderBottom: "1px solid #eee",
  borderRadius: 0,
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  transition: "background-color 0.3s ease, box-shadow 0.3s ease",
};

const rowHoverStyle = {
  backgroundColor: "#e6f7ff",
  boxShadow: "0 4px 12px rgba(0, 127, 255, 0.15)",
};

const buttonBaseStyle = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "6px 10px",
  marginLeft: 8,
  borderRadius: 6,
  transition: "all 0.25s ease",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  outline: "none",
};

const editButtonStyle = {
  ...buttonBaseStyle,
  color: "orange",
};

const deleteButtonStyle = {
  ...buttonBaseStyle,
  color: "#d32f2f",
};
const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: "white",
  borderRadius: 8,
  padding: 20,
  width: "500px",
  maxHeight: "80vh",
  overflowY: "auto",
};

const modalSearchStyle = {
  width: "100%",
  padding: "8px",
  marginBottom: "10px",
  borderRadius: "4px",
  border: "1px solid #ccc",
};

const modalCloseBtnStyle = {
  marginTop: 10,
  padding: "8px 16px",
  borderRadius: 4,
  border: "none",
  backgroundColor: "#d33",
  color: "white",
  cursor: "pointer",
};
