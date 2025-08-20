import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const ApprovalVisaList = () => {
  const [visaData, setVisaData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Unify Regular_Visa data structure
  const unifyRegularVisa = (item) => ({
    id: `regular-${item.id}`,
    visaCode: item.visaCode,
    visaTitle: item.visaTitle || "",
    visaType: item.visaType || "",
    company: item.company || "",
    principal: item.principal || "",
    brand: item.brand || "",
    salesDivision: item.salesDivision || "",
    accountType: item.accountType || "",
    account: item.account || "",
    activity: item.activity || "",
    notification: item.Notification ?? false,
    created_at: item.created_at,
    source: "Regular",
  });

  // Unify Cover_Visa data structure
  const unifyCoverVisa = (item) => ({
    id: `cover-${item.id}`,
    visaCode: item.visaCode,
    visaTitle: item.visaTitle || "",
    visaType: item.visaType || "",
    company: item.company || "",
    principal: item.principal || "",
    brand: item.brand || "",
    salesDivision: item.salesDivision || "",
    accountType: item.accountType || "",
    account: item.account || "",
    activity: "", // Cover_Visa does not have activity in your schema
    notification: item.Notification ?? false,
    created_at: item.created_at,
    source: "Cover",
  });

  // Unify Corporate_Visa data structure
  const unifyCorporateVisa = (item) => ({
    id: `corporate-${item.id}`,
    visaCode: item.visaCode || "",
    visaTitle: "", // No visaTitle field in Corporate_Visa
    visaType: item.visaType || "",
    company: item.account || "", // Map account as company
    principal: "", // No principal field
    brand: "", // No brand field
    salesDivision: item.salesDivision || "",
    accountType: item.accountType || "",
    account: item.account || "",
    activity: item.activity || "",
    notification: item.Notification ?? false,
    created_at: item.created_at,
    source: "Corporate",
  });
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all visas
        const { data: regularData, error: regularError } = await supabase
          .from("Regular_Visa")
          .select("*");
        if (regularError) throw regularError;

        const { data: coverData, error: coverError } = await supabase
          .from("Cover_Visa")
          .select("*");
        if (coverError) throw coverError;

        const { data: corporateData, error: corporateError } = await supabase
          .from("Corporate_Visa")
          .select("*");
        if (corporateError) throw corporateError;

        // ✅ Fetch approvals that are "Approved"
        const { data: approvalData, error: approvalError } = await supabase
          .from("Approval_History")
          .select("BabyVisaId, DateResponded")
          .eq("Response", "Approved");


        if (approvalError) throw approvalError;

        // ✅ Create Set of approved visaCodes (BabyVisaId === visaCode)
        const approvedVisaCodes = new Set(approvalData.map(item => item.BabyVisaId));

        // Map unified visa data
        const unifiedRegular = regularData.map(unifyRegularVisa);
        const unifiedCover = coverData.map(unifyCoverVisa);
        const unifiedCorporate = corporateData.map(unifyCorporateVisa);

        const combined = [...unifiedRegular, ...unifiedCover, ...unifiedCorporate];
        const approvalDateMap = {};
        approvalData.forEach(item => {
          approvalDateMap[item.BabyVisaId] = item.DateResponded;
        });
        // ✅ Filter by approved visaCode
        const approvedVisas = combined
          .filter(visa => approvedVisaCodes.has(visa.visaCode))
          .map(visa => ({
            ...visa,
            approvedDate: approvalDateMap[visa.visaCode] || null
          }));


        // Sort
        approvedVisas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setVisaData(approvedVisas);
      } catch (err) {
        setError(err.message);
        setVisaData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);



  // Filtering + search
  const filteredData = visaData
    .filter(
      (item) =>
        item.visaCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.visaTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.account?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((item) => (companyFilter ? item.company === companyFilter : true))
    .filter((item) => (brandFilter ? item.brand === brandFilter : true))
    .filter((item) => (activityFilter ? item.activity === activityFilter : true));

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Export filtered data to Excel
  const handleExportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ApprovedVisas");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "ApprovedVisaList.xlsx");
  };

  // Helper for unique filter values, excluding empty
  const getUnique = (field) =>
    [...new Set(visaData.map((item) => item[field]).filter(Boolean))];

  return (
    <div style={{ padding: "20px", overflowX: "auto" }}>
      <h2 className="manage-visa-title">Approved Visa List (All Types)</h2>

      {/* Filters */}
      <div className="filters" style={{ marginBottom: 20 }}>
        <input
          type="search"
          placeholder="Search  Code, Title or Account"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          style={{ marginRight: 10 }}
        />

        <select
          value={companyFilter}
          onChange={(e) => {
            setCompanyFilter(e.target.value);
            setCurrentPage(1);
          }}
          style={{ marginRight: 10 }}
        >
          <option value="">All Companies</option>
          {getUnique("company").map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={brandFilter}
          onChange={(e) => {
            setBrandFilter(e.target.value);
            setCurrentPage(1);
          }}
          style={{ marginRight: 10 }}
        >
          <option value="">All Brands</option>
          {getUnique("brand").map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={activityFilter}
          onChange={(e) => {
            setActivityFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">All Activities</option>
          {getUnique("activity").map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <button
          className="page-button"
          onClick={handleExportToExcel}
          style={{ marginLeft: 10 }}
        >
          Export to Excel
        </button>
      </div>

      {/* Loading and error states */}
      {loading && <p>Loading data...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {/* Table */}
      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Visa Code</th>
              <th>Title</th>
              <th>Type</th>
              <th>Company</th>
              <th>Principal</th>
              <th>Brand</th>
              <th>Sales Division</th>
              <th>Account</th>
              <th>Activity</th>
              <th>Created At</th>
              <th>Source</th>
              <th>Approved Date</th>

            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan="11" className="no-data">
                  No approved visas found.
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr key={item.id}>
                  <td>{item.visaCode}</td>
                  <td>{item.visaTitle}</td>
                  <td>{item.visaType}</td>
                  <td>{item.company}</td>
                  <td>{item.principal}</td>
                  <td>{item.brand}</td>
                  <td>{item.salesDivision}</td>
                  <td>{item.account}</td>
                  <td>{item.activity}</td>
                  <td>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : ""}
                  </td>
                  <td>{item.source}</td>
                  <td>
                    {item.approvedDate
                      ? new Date(item.approvedDate).toLocaleString("en-US", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true, // 👈 shows AM/PM
                      })
                      : ""}
                  </td>


                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <footer
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          width: "auto",
          padding: "0.5rem 1rem",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          backdropFilter: "blur(1px)",
          zIndex: 1000,
        }}
      >
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          className="page-button"
        >
          Prev
        </button>
        <span className="page-info" style={{ margin: "0 10px" }}>
          Page {currentPage} of {totalPages || 1}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="page-button"
        >
          Next
        </button>
      </footer>
    </div>
  );
};

export default ApprovalVisaList;
