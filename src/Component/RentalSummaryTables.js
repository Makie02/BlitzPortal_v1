import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import './RentalSummaryTables.css'
const data1 = [
  {
    Principal: "3M",
    ActualCount: 540,
    ActualAmount: 13296000,
    ExpectedCount: 270,
    ExpectedAmount: 6635000,
    VarianceCount: 270,
    VarianceAmount: 6661000,
  },
];

const data2 = [
  {
    Account: "Supervalue Inc.",
    ActualCount: 2806,
    ActualAmount: 60751467.74,
    ExpectedCount: 1495,
    ExpectedAmount: 32646500,
    VarianceCount: 1311,
    VarianceAmount: 28104967.74,
  },
];

// Rental Details sample data (just one row for example)
const rentalDetailsData = [
  {
    Principal: "3M",
    BPCode: "BP123",
    Account: "Supervalue Inc.",
    StoreOutlet: "Outlet 1",
    RentalAmountWithoutVAT: 120000,
    TypeOfRental: "Lease",
    Location: "NY",
    StartingDate: "2023-01-01",
    EndingDate: "2023-12-31",
    ContractNo: "CN001",
    Remarks: "N/A",
    JanDMNo: "DM001",
    JanAmountWithoutVAT: 10000,
    FebDMNo: "DM002",
    FebAmountWithoutVAT: 10000,
    MarDMNo: "DM003",
    MarAmountWithoutVAT: 10000,
    AprDMNo: "DM004",
    AprAmountWithoutVAT: 10000,
    MayDMNo: "DM005",
    MayAmountWithoutVAT: 10000,
    JunDMNo: "DM006",
    JunAmountWithoutVAT: 10000,
    JulDMNo: "DM007",
    JulAmountWithoutVAT: 10000,
    AugDMNo: "DM008",
    AugAmountWithoutVAT: 10000,
    SepDMNo: "DM009",
    SepAmountWithoutVAT: 10000,
    OctDMNo: "DM010",
    OctAmountWithoutVAT: 10000,
    NovDMNo: "DM011",
    NovAmountWithoutVAT: 10000,
    DecDMNo: "DM012",
    DecAmountWithoutVAT: 10000,
    DateAdded: "2023-01-01",
  },
];

// Pagination constants
const PAGE_SIZE = 5;

function formatCurrency(num) {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Table({ title, columns, data }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // Filter data by search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.accessor];
        if (val === null || val === undefined) return false;
        return val.toString().toLowerCase().includes(lower);
      })
    );
  }, [searchTerm, data, columns]);

  // Pagination slice
  const pageCount = Math.ceil(filteredData.length / PAGE_SIZE);
  const pagedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Handle export to excel
  const handleExport = () => {
    const exportData = filteredData.map((row) => {
      const newRow = {};
      columns.forEach((col) => {
        newRow[col.Header] = row[col.accessor];
      });
      return newRow;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${title.replace(/\s/g, "_")}.xlsx`);
  };

  return (
    <div style={{ marginBottom: 40 }}>
      {title && <h3 style={{ textAlign: "center", marginBottom: 12 }}>{title}</h3>}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "0.5rem",
            borderRadius: "6px",
            border: "1px solid #ccc",
            flexGrow: 1,
            minWidth: 150,
          }}
          aria-label={`Search in ${title || "table"}`}
        />
        <button
          onClick={handleExport}
          style={{
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "0.5rem 1rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          aria-label={`Export ${title || "table"} to Excel`}
        >
          Export to Excel
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: 600,
          }}
        >
          <thead style={{ backgroundColor: "#2563eb", color: "white" }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.accessor}
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "left",
                    borderBottom: "2px solid #1e40af",
                    minWidth: col.minWidth || 120,
                  }}
                >
                  {col.Header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ padding: "1rem", textAlign: "center" }}>
                  No matching records found.
                </td>
              </tr>
            )}
            {pagedData.map((row, idx) => (
              <tr
                key={idx}
                style={{ backgroundColor: idx % 2 === 0 ? "#f9fafb" : "white" }}
              >
                {columns.map((col) => (
                  <td
                    key={col.accessor}
                    style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #e5e7eb" }}
                  >
                    {col.isCurrency ? formatCurrency(row[col.accessor]) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}

            {/* Total Row */}
            <tr
              style={{
                backgroundColor: "#e0e7ff",
                fontWeight: "bold",
                borderTop: "2px solid #2563eb",
              }}
            >
              {columns.map((col, idx) => {
                if (idx === 0) {
                  return (
                    <td key={col.accessor} style={{ padding: "0.5rem 1rem" }}>
                      Total:
                    </td>
                  );
                }
                // Sum numeric columns
                if (
                  col.isCurrency ||
                  col.accessor.toLowerCase().includes("count") ||
                  col.accessor.toLowerCase().includes("amount")
                ) {
                  const total = filteredData.reduce((acc, row) => acc + (row[col.accessor] || 0), 0);
                  return (
                    <td key={col.accessor} style={{ padding: "0.5rem 1rem" }}>
                      {col.isCurrency ? formatCurrency(total) : total}
                    </td>
                  );
                }
                return <td key={col.accessor}></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div
        className="pagination"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.5rem",
          marginTop: "1rem",
        }}
      >
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
          style={paginationBtnStyle(page === 1)}
          aria-label="Previous page"
        >
          Prev
        </button>
        {[...Array(pageCount).keys()].map((i) => (
          <button
            key={i}
            onClick={() => setPage(i + 1)}
            aria-current={page === i + 1 ? "page" : undefined}
            style={paginationBtnStyle(page === i + 1)}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => setPage((p) => Math.min(p + 1, pageCount))}
          disabled={page === pageCount}
          style={paginationBtnStyle(page === pageCount)}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}

const paginationBtnStyle = (active) => ({
  padding: "0.3rem 0.7rem",
  borderRadius: "4px",
  border: "1px solid #2563eb",
  backgroundColor: active ? "#2563eb" : "white",
  color: active ? "white" : "#2563eb",
  cursor: active ? "default" : "pointer",
  minWidth: "32px",
  textAlign: "center",
});

export default function RentalSummaryTables() {
  const [activeTab, setActiveTab] = useState("summary");

  // Define columns for each table
  const columns1 = [
    { Header: "Principal", accessor: "Principal", minWidth: 120 },
    { Header: "Actual Count", accessor: "ActualCount" },
    { Header: "Actual Amount", accessor: "ActualAmount", isCurrency: true },
    { Header: "Expected Count", accessor: "ExpectedCount" },
    { Header: "Expected Amount", accessor: "ExpectedAmount", isCurrency: true },
    { Header: "Variance Count", accessor: "VarianceCount" },
    { Header: "Variance Amount", accessor: "VarianceAmount", isCurrency: true },
  ];

  const columns2 = [
    { Header: "Account", accessor: "Account", minWidth: 120 },
    { Header: "Actual Count", accessor: "ActualCount" },
    { Header: "Actual Amount", accessor: "ActualAmount", isCurrency: true },
    { Header: "Expected Count", accessor: "ExpectedCount" },
    { Header: "Expected Amount", accessor: "ExpectedAmount", isCurrency: true },
    { Header: "Variance Count", accessor: "VarianceCount" },
    { Header: "Variance Amount", accessor: "VarianceAmount", isCurrency: true },
  ];

  // Columns for Rental Details table
  const rentalDetailsColumns = [
    { Header: "Principal", accessor: "Principal" },
    { Header: "BP Code", accessor: "BPCode" },
    { Header: "Account", accessor: "Account" },
    { Header: "Store/Outlet", accessor: "StoreOutlet" },
    { Header: "Rental Amount (without) VAT", accessor: "RentalAmountWithoutVAT", isCurrency: true },
    { Header: "Type of Rental", accessor: "TypeOfRental" },
    { Header: "Location", accessor: "Location" },
    { Header: "Starting Date", accessor: "StartingDate" },
    { Header: "Ending Date", accessor: "EndingDate" },
    { Header: "Contract No.", accessor: "ContractNo" },
    { Header: "Remarks", accessor: "Remarks" },
    { Header: "Jan DM No.", accessor: "JanDMNo" },
    { Header: "Jan Amount (w/o VAT)", accessor: "JanAmountWithoutVAT", isCurrency: true },
    { Header: "Feb DM No.", accessor: "FebDMNo" },
    { Header: "Feb Amount (w/o VAT)", accessor: "FebAmountWithoutVAT", isCurrency: true },
    { Header: "Mar DM No.", accessor: "MarDMNo" },
    { Header: "Mar Amount (w/o VAT)", accessor: "MarAmountWithoutVAT", isCurrency: true },
    { Header: "Apr DM No.", accessor: "AprDMNo" },
    { Header: "Apr Amount (w/o VAT)", accessor: "AprAmountWithoutVAT", isCurrency: true },
    { Header: "May DM No.", accessor: "MayDMNo" },
    { Header: "May Amount (w/o VAT)", accessor: "MayAmountWithoutVAT", isCurrency: true },
    { Header: "Jun DM No.", accessor: "JunDMNo" },
    { Header: "Jun Amount (w/o VAT)", accessor: "JunAmountWithoutVAT", isCurrency: true },
    { Header: "Jul DM No.", accessor: "JulDMNo" },
    { Header: "Jul Amount (w/o VAT)", accessor: "JulAmountWithoutVAT", isCurrency: true },
    { Header: "Aug DM No.", accessor: "AugDMNo" },
    { Header: "Aug Amount (w/o VAT)", accessor: "AugAmountWithoutVAT", isCurrency: true },
    { Header: "Sep DM No.", accessor: "SepDMNo" },
    { Header: "Sep Amount (w/o VAT)", accessor: "SepAmountWithoutVAT", isCurrency: true },
    { Header: "Oct DM No.", accessor: "OctDMNo" },
    { Header: "Oct Amount (w/o VAT)", accessor: "OctAmountWithoutVAT", isCurrency: true },
    { Header: "Nov DM No.", accessor: "NovDMNo" },
    { Header: "Nov Amount (w/o VAT)", accessor: "NovAmountWithoutVAT", isCurrency: true },
    { Header: "Dec DM No.", accessor: "DecDMNo" },
    { Header: "Dec Amount (w/o VAT)", accessor: "DecAmountWithoutVAT", isCurrency: true },
    { Header: "Date Added", accessor: "DateAdded" },
  ].map(col => ({
    ...col,
    minWidth: Math.max(80, col.Header.length * 12) // 12px per character, min 80px width
  }));

  const [selectedFile, setSelectedFile] = React.useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadClick = () => {
    if (!selectedFile) return alert("Please select or drop a file.");

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      setUploadedData(json);
    };
    reader.readAsArrayBuffer(selectedFile);
  };
  // Upload Rentals - store uploaded data
  const [uploadedData, setUploadedData] = useState([]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setUploadedData(jsonData);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div style={{ padding: '20px', overflowX: 'auto' }}>

      <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>Rental Summary</h2>

      {/* Tab Buttons */}
      <div style={{ marginBottom: 20, display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveTab("summary")}
          style={tabButtonStyle(activeTab === "summary")}
          aria-selected={activeTab === "summary"}
        >
          Summary Tables
        </button>
        <button
          onClick={() => setActiveTab("details")}
          style={tabButtonStyle(activeTab === "details")}
          aria-selected={activeTab === "details"}
        >
          Rental Details
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          style={tabButtonStyle(activeTab === "upload")}
          aria-selected={activeTab === "upload"}
        >
          Upload Rentals
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "summary" && (
        <>
          <Table columns={columns1} data={data1} />
          <Table columns={columns2} data={data2} />
        </>
      )}

      {activeTab === "details" && (
        <Table title="Rental Details" columns={rentalDetailsColumns} data={rentalDetailsData} />
      )}

      {activeTab === "upload" && (
        <div>
          <h2 style={{ textAlign: 'center' }}>Upload Rentals</h2>
          <label htmlFor="upload-file" style={{ display: "block", marginBottom: "0.5rem" }}>
            Select or drag & drop your Rentals Excel file:
          </label>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "#2563eb";
              e.currentTarget.style.color = "#2563eb";
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "#ccc";
              e.currentTarget.style.color = "#888";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "#ccc";
              e.currentTarget.style.color = "#888";
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileChange({ target: { files: e.dataTransfer.files } });
                e.dataTransfer.clearData();
              }
            }}
            onClick={() => document.getElementById("upload-file").click()}
            style={{
              border: "2px dashed #ccc",
              borderRadius: 8,
              padding: 40,
              textAlign: "center",
              color: "#888",
              cursor: "pointer",
              marginBottom: 10,
              userSelect: "none",
              transition: "border-color 0.3s, color 0.3s",
            }}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === "Enter" && document.getElementById("upload-file").click()}
          >
            {selectedFile ? (
              <div>
                <strong>Selected file:</strong> {selectedFile.name}
              </div>
            ) : (
              "Drag & drop an Excel file here, or click to select"
            )}
          </div>

          <input
            id="upload-file"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />


          <button
            onClick={handleUploadClick}
            class="container-btn-file">
            <svg
              fill="#fff"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 50 50"
            >
              <path
                d="M28.8125 .03125L.8125 5.34375C.339844 
    5.433594 0 5.863281 0 6.34375L0 43.65625C0 
    44.136719 .339844 44.566406 .8125 44.65625L28.8125 
    49.96875C28.875 49.980469 28.9375 50 29 50C29.230469 
    50 29.445313 49.929688 29.625 49.78125C29.855469 49.589844 
    30 49.296875 30 49L30 1C30 .703125 29.855469 .410156 29.625 
    .21875C29.394531 .0273438 29.105469 -.0234375 28.8125 .03125ZM32 
    6L32 13L34 13L34 15L32 15L32 20L34 20L34 22L32 22L32 27L34 27L34 
    29L32 29L32 35L34 35L34 37L32 37L32 44L47 44C48.101563 44 49 
    43.101563 49 42L49 8C49 6.898438 48.101563 6 47 6ZM36 13L44 
    13L44 15L36 15ZM6.6875 15.6875L11.8125 15.6875L14.5 21.28125C14.710938 
    21.722656 14.898438 22.265625 15.0625 22.875L15.09375 22.875C15.199219 
    22.511719 15.402344 21.941406 15.6875 21.21875L18.65625 15.6875L23.34375 
    15.6875L17.75 24.9375L23.5 34.375L18.53125 34.375L15.28125 
    28.28125C15.160156 28.054688 15.035156 27.636719 14.90625 
    27.03125L14.875 27.03125C14.8125 27.316406 14.664063 27.761719 
    14.4375 28.34375L11.1875 34.375L6.1875 34.375L12.15625 25.03125ZM36 
    20L44 20L44 22L36 22ZM36 27L44 27L44 29L36 29ZM36 35L44 35L44 37L36 37Z"
              ></path>
            </svg>
            Upload File
            <input name="text" type="file" />
          </button>


          {uploadedData.length > 0 && (
            <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #ccc" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  minWidth: 600,
                }}
              >
                <thead style={{ backgroundColor: "#2563eb", color: "white" }}>
                  <tr>
                    {Object.keys(uploadedData[0]).map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "0.5rem 1rem",
                          textAlign: "left",
                          borderBottom: "2px solid #1e40af",
                          minWidth: 120,
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadedData.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{ backgroundColor: idx % 2 === 0 ? "#f9fafb" : "white" }}
                    >
                      {Object.keys(row).map((col) => (
                        <td
                          key={col}
                          style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #e5e7eb" }}
                        >
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {uploadedData.length === 0 && (
            <p>No data uploaded yet. Please upload an Excel file.</p>
          )}
        </div>
      )}

    </div>
  );
}

const tabButtonStyle = (active) => ({
  padding: "0.6rem 1.2rem",
  borderRadius: "8px",
  border: "1px solid #2563eb",
  backgroundColor: active ? "#2563eb" : "white",
  color: active ? "white" : "#2563eb",
  fontWeight: active ? "600" : "normal",
  cursor: "pointer",
  userSelect: "none",
});
