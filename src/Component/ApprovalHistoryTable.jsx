import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { MdPictureAsPdf } from 'react-icons/md';
import excelIcon from '../Assets/exel.png'; // adjust path as needed

export default function ApprovalHistoryTable() {
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [visaTypeFilter, setVisaTypeFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [principalFilter, setPrincipalFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [uniqueCompanies, setUniqueCompanies] = useState([]);
  const [uniqueBrands, setUniqueBrands] = useState([]);
  const [uniquePrincipals, setUniquePrincipals] = useState([]);
  const [uniqueVisaTypes, setUniqueVisaTypes] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: approvals, error } = await supabase
        .from('Approval_History')
        .select('*');

      if (error) {
        console.error('Error fetching approval history:', error.message);
        return;
      }

      const formatted = await Promise.all(
        approvals.map(async (record) => {
          const visaCode = record.BabyVisaId;
          const visaData = await getVisaDetails(visaCode);
          return {
            ...record,
            ...visaData,
          };
        })
      );

      setApprovalHistory(formatted);
    };

    fetchData();
  }, []);

  const getVisaDetails = async (visaCode) => {
    const tables = ['Cover_Visa', 'Regular_Visa', 'Corporate_Visa'];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('visaCode', visaCode)
        .limit(1)
        .single();

      if (!error && data) return data;
    }

    return {};
  };

  useEffect(() => {
    const data = approvalHistory.filter((entry) => {
      const text = Object.values(entry).join(' ').toLowerCase();
      const matchesSearch = text.includes(searchTerm.toLowerCase());
      const matchesVisa = visaTypeFilter ? entry.visaType === visaTypeFilter : true;
      const matchesCompany = companyFilter ? entry.company === companyFilter : true;
      const matchesBrand = brandFilter ? entry.brand === brandFilter : true;
      const matchesPrincipal = principalFilter ? entry.principal === principalFilter : true;

      const createdDate = new Date(entry.created_at);
      const inDateRange =
        (!fromDate || createdDate >= new Date(fromDate)) &&
        (!toDate || createdDate <= new Date(toDate));

      return (
        matchesSearch &&
        matchesVisa &&
        matchesCompany &&
        matchesBrand &&
        matchesPrincipal &&
        inDateRange
      );
    });

    setFilteredData(data);

    setUniqueCompanies([...new Set(approvalHistory.map(e => e.company).filter(Boolean))]);
    setUniqueBrands([...new Set(approvalHistory.map(e => e.brand).filter(Boolean))]);
    setUniquePrincipals([...new Set(approvalHistory.map(e => e.principal).filter(Boolean))]);
    setUniqueVisaTypes([...new Set(approvalHistory.map(e => e.visaType || e.type).filter(Boolean))]);
  }, [searchTerm, visaTypeFilter, companyFilter, brandFilter, principalFilter, fromDate, toDate, approvalHistory]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Approval History Report', 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [[
        'Code', 'Type', 'Company', 'Distributor', 'Brand',
        'Date Created', 'Approver', 'Response Date', 'Response'
      ]],
      body: filteredData.map((entry) => [
        entry.BabyVisaId || '—',
        entry.visaType || entry.type || '—',
        entry.company || '—',
        entry.principal || '—',
        entry.brand || '—',
        entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—',
        entry.ApproverId || '—',
        entry.DateResponded ? new Date(entry.DateResponded).toLocaleDateString() : '—',
        entry.Response || '—',
      ]),
      styles: { fontSize: 10 },
    });

    doc.save('Approval_History_Report.pdf');
  };

  const generateExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredData.map((entry) => ({
        Code: entry.BabyVisaId || '—',
        Type: entry.visaType || entry.type || '—',
        Company: entry.company || '—',
        Distributor: entry.principal || '—',
        Brand: entry.brand || '—',
        'Date Created': entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—',
        Approver: entry.ApproverId || '—',
        'Response Date': entry.DateResponded ? new Date(entry.DateResponded).toLocaleDateString() : '—',
        Response: entry.Response || '—',
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ApprovalHistory');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'Approval_History_Report.xlsx');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '90vh', padding: '15px' }}>
      <h2>Approval History</h2>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          backgroundColor: '#fff',
        }}
      >
        {/* Left Side Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search anything..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '10px 12px',
              width: '400px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              outline: 'none',
              transition: 'border 0.3s ease, box-shadow 0.3s ease',
            }}
            onFocus={(e) => {
              e.target.style.border = '1px solid #10b981';
              e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.2)';
            }}
            onBlur={(e) => {
              e.target.style.border = '1px solid #d1d5db';
              e.target.style.boxShadow = 'none';
            }}
          />

          {/* Dropdown Filters */}
          {[
            { value: visaTypeFilter, set: setVisaTypeFilter, options: uniqueVisaTypes, placeholder: "All  Types" },
            { value: companyFilter, set: setCompanyFilter, options: uniqueCompanies, placeholder: "All Companies" },
      
          ].map(({ value, set, options, placeholder }, index) => (
            <select
              key={index}
              value={value}
              onChange={(e) => set(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                outline: 'none',
                minWidth: '160px',
                transition: 'border 0.3s ease, box-shadow 0.3s ease',
              }}
              onFocus={(e) => {
                e.target.style.border = '1px solid #10b981';
                e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.2)';
              }}
              onBlur={(e) => {
                e.target.style.border = '1px solid #d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="">{placeholder}</option>
              {options.map((opt, idx) => (
                <option key={idx} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ))}
        </div>

        {/* Right Side Date Filters */}
        <div style={{ display: 'flex', gap: '20px', }}>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="From Date"
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              outline: 'none',
              minWidth: '160px',
              transition: 'border 0.3s ease, box-shadow 0.3s ease',
            }}
            onFocus={(e) => {
              e.target.style.border = '1px solid #10b981';
              e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.2)';
            }}
            onBlur={(e) => {
              e.target.style.border = '1px solid #d1d5db';
              e.target.style.boxShadow = 'none';
            }}
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="To Date"
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              outline: 'none',
              minWidth: '160px',
              transition: 'border 0.3s ease, box-shadow 0.3s ease',
            }}
            onFocus={(e) => {
              e.target.style.border = '1px solid #10b981';
              e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.2)';
            }}
            onBlur={(e) => {
              e.target.style.border = '1px solid #d1d5db';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>
      {/* Button Row */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "10px" }}>
        <button
          onClick={generatePDF}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#d9534f",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <MdPictureAsPdf size={20} />
          Generate PDF
        </button>
        <button
          onClick={generateExcel}
          style={{
            padding: "0.5rem 1rem",
            background: "linear-gradient(90deg, rgba(87, 199, 133, 1) 50%, rgba(237, 221, 83, 1) 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginLeft: '10px'
          }}
        >
          <img src={excelIcon} alt="Excel icon" style={{ width: 20, height: 20 }} />
          Generate Excel
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead style={{ background: '#f4f4f4', position: 'sticky', top: 0 }}>
            <tr>
              {['Code', 'Type', 'Company', 'Distributor', 'Brand', 'Date Created', 'Approver', 'Response Date', 'Response'].map((h, i) => (
                <th key={i} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((entry, index) => (
                <tr key={entry.id || index} style={{ borderBottom: '1px solid #ccc' }}>
                  <td style={tdStyle}>{entry.BabyVisaId || '—'}</td>
                  <td style={tdStyle}>{entry.visaType || entry.type || '—'}</td>
                  <td style={tdStyle}>{entry.company || '—'}</td>
                  <td style={tdStyle}>{entry.principal || '—'}</td>
                  <td style={tdStyle}>{entry.brand || '—'}</td>
                  <td style={tdStyle}>{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—'}</td>
                  <td style={tdStyle}>{entry.ApproverId || '—'}</td>
                  <td style={tdStyle}>{entry.DateResponded ? new Date(entry.DateResponded).toLocaleDateString() : '—'}</td>
                  <td style={{ ...tdStyle, color: entry.Response === 'Approved' ? 'green' : 'red', fontWeight: 'bold' }}>
                    {entry.Response || '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Styles
const inputStyle = {
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  outline: 'none',
  minWidth: '160px',
};

const selectStyle = { ...inputStyle, backgroundColor: '#ffffff' };

const thStyle = {
  padding: '8px',
  borderBottom: '1px solid #ccc',
};

const tdStyle = {
  padding: '8px',
};

const pdfButtonStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#d9534f',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
};

const excelButtonStyle = {
  padding: '0.5rem 1rem',
  background: 'linear-gradient(90deg, rgba(87,199,133,1) 50%, rgba(237,221,83,1) 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  marginLeft: '10px',
};
