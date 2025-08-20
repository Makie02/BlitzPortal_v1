import React, { useState, useRef } from "react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import excelIcon from "../Assets/exel.png"; // Adjust path if needed

const acceptedExcelTypes = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export default function ClaimsStatus() {
  const [excelFileMER, setExcelFileMER] = useState(null);
  const [excelFileCollection, setExcelFileCollection] = useState(null);
  const [promoCode, setPromoCode] = useState("");

  const excelInputMERRef = useRef(null);
  const excelInputCollectionRef = useRef(null);

  const handleExcelChange = (e, setFile) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!acceptedExcelTypes.includes(file.type)) {
      Swal.fire({
        icon: "error",
        title: "Invalid File",
        text: "Only Excel files (.xls, .xlsx) are allowed.",
      });
      return;
    }

    setFile(file);
    e.target.value = null;
  };

  const uploadExcelFile = async (file, typeName) => {
    if (!file) return;

    try {
      const safeFileName = file.name.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");

      Swal.fire({
        icon: "success",
        title: `${typeName} Uploaded`,
        text: `${safeFileName} is ready (no upload, simulated only).`,
      });
    } catch (error) {
      console.error("❌ Upload Error:", error);
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: `Failed to process ${typeName}.`,
      });
    }
  };

  const handleGenerateExcel = async () => {
    if (!promoCode.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Promo Code Required",
        text: "Enter a valid VISA promo code.",
      });
      return;
    }

    try {
      // Simulated Data (Replace with Supabase fetch later if needed)
      const simulatedData = {
        Corporate_Visa: [{ name: "Alice", amount: 1000 }],
        Regular_Visa: [{ name: "Bob", amount: 800 }],
        Corver_Visa: [],
      };

      const workbook = XLSX.utils.book_new();
      let hasData = false;

      Object.entries(simulatedData).forEach(([sheetName, data]) => {
        if (data.length) {
          hasData = true;
          const sheet = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
        }
      });

      if (!hasData) {
        Swal.fire({
          icon: "info",
          title: "No Data Found",
          text: `No records found for promo code "${promoCode}".`,
        });
        return;
      }

      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([wbout], { type: "application/octet-stream" }),
        `${promoCode}_visa_data.xlsx`
      );

      Swal.fire({
        icon: "success",
        title: "Excel Generated",
        text: `Data for "${promoCode}" exported.`,
      });
    } catch (err) {
      console.error("❌ Excel generation failed:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to generate Excel.",
      });
    }
  };

  const renderExcelPreview = (file) => (
    <div style={{ marginTop: 8, textAlign: "center" }}>
      <img src={excelIcon} alt="Excel file" style={{ width: 54, height: 54 }} />
      <p style={{ fontStyle: "italic" }}>{file.name}</p>
    </div>
  );

  const dropZoneStyle = {
    border: "3px dashed #9ca3af",
    padding: "1.5rem",
    borderRadius: 8,
    textAlign: "center",
    cursor: "pointer",
    marginBottom: "1rem",
  };

  const buttonStyle = {
    padding: "0.6rem 1.2rem",
    fontSize: 16,
    borderRadius: 6,
    border: "none",
    backgroundColor: "#3b82f6",
    color: "#fff",
    cursor: "pointer",
    marginTop: 8,
    width: "100%",
  };

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "Segoe UI, Tahoma, Geneva" }}>
      <h2 style={{ textAlign: "center", marginBottom: 24 }}>Claims Status Excel Upload</h2>

      {/* MER Excel */}
      <label style={{ fontWeight: "600" }}>Upload MER Excel</label>
      <div
        style={dropZoneStyle}
        onClick={() => excelInputMERRef.current.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && excelInputMERRef.current.click()}
      >
        {excelFileMER ? renderExcelPreview(excelFileMER) : <p>Click to upload Excel file</p>}
      </div>
      <input
        type="file"
        accept={acceptedExcelTypes.join(",")}
        ref={excelInputMERRef}
        style={{ display: "none" }}
        onChange={(e) => handleExcelChange(e, setExcelFileMER)}
      />
      {excelFileMER && (
        <button
          onClick={() => uploadExcelFile(excelFileMER, "MER_Excel")}
          style={{ ...buttonStyle, backgroundColor: "#10b981" }}
        >
          Submit MER Excel
        </button>
      )}

      {/* Collection Excel */}
      <label style={{ fontWeight: "600", marginTop: 24, display: "block" }}>
        Upload Collection Excel
      </label>
      <div
        style={dropZoneStyle}
        onClick={() => excelInputCollectionRef.current.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && excelInputCollectionRef.current.click()
        }
      >
        {excelFileCollection ? renderExcelPreview(excelFileCollection) : <p>Click to upload Excel file</p>}
      </div>
      <input
        type="file"
        accept={acceptedExcelTypes.join(",")}
        ref={excelInputCollectionRef}
        style={{ display: "none" }}
        onChange={(e) => handleExcelChange(e, setExcelFileCollection)}
      />
      {excelFileCollection && (
        <button
          onClick={() => uploadExcelFile(excelFileCollection, "Collection_Excel")}
          style={{ ...buttonStyle, backgroundColor: "#10b981" }}
        >
          Submit Collection Excel
        </button>
      )}

      {/* Promo Code */}
      <label htmlFor="promo-code" style={{ fontWeight: "600", marginTop: 24, display: "block" }}>
        Marketing Code
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          id="promo-code"
          type="text"
          placeholder="Enter your promo code"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          style={{ flex: 1, padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button
          onClick={handleGenerateExcel}
          style={{ ...buttonStyle, width: "auto", padding: "0.6rem 1.5rem" }}
        >
          Generate Excel
        </button>
      </div>
    </div>
  );
}
