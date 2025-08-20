import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "./ViewData.css";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString();
}

const headerCellStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid #ccc",
  textAlign: "left",
  whiteSpace: "nowrap",
  fontWeight: "600",
  fontSize: "14px",
  backgroundColor: "#1976d2",
  color: "white",
};

const cellStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid #dee2e6",
  whiteSpace: "nowrap",
  fontSize: "14px",
};

export default function ViewData({ visaCode, onClose }) {
  const [corporateData, setCorporateData] = useState(null);
  const [regularData, setRegularData] = useState(null);
  const [coverData, setCoverData] = useState(null);

  const [corporateDetails, setCorporateDetails] = useState([]);
  const [coverCostDetails, setCoverCostDetails] = useState([]);
  const [coverVolumePlans, setCoverVolumePlans] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);



  const [regularVolumePlans, setRegularVolumePlans] = useState([]);
  const [regularCostDetails, setRegularCostDetails] = useState([]);
  const [loadingRegularDetails, setLoadingRegularDetails] = useState(false);
  const [errorRegularDetails, setErrorRegularDetails] = useState(null);

  useEffect(() => {
    if (!visaCode) return;

    async function fetchVisaData() {
      setLoading(true);
      setError(null);
      setCorporateDetails([]);
      setCoverCostDetails([]);
      setCoverVolumePlans([]);
      setErrorDetails(null);
      try {
        const { data: corpData, error: corpError } = await supabase
          .from("Corporate_Visa")
          .select("*")
          .eq("visaCode", visaCode)
          .single();
        if (corpError && corpError.code !== "PGRST116") throw corpError;

        const { data: regData, error: regError } = await supabase
          .from("Regular_Visa")
          .select("*")
          .eq("visaCode", visaCode)
          .single();
        if (regError && regError.code !== "PGRST116") throw regError;

        const { data: coverData, error: coverError } = await supabase
          .from("Cover_Visa")
          .select("*")
          .eq("visaCode", visaCode)
          .single();
        if (coverError && coverError.code !== "PGRST116") throw coverError;

        setCorporateData(corpData || null);
        setRegularData(regData || null);
        setCoverData(coverData || null);
      } catch (err) {
        setError(err.message || "Failed to fetch visa data.");
      } finally {
        setLoading(false);
      }
    }

    fetchVisaData();
  }, [visaCode]);

  // Fetch Corporate Visa Details
  useEffect(() => {
    if (!corporateData || !visaCode) return;

    async function fetchCorporateDetails() {
      setLoadingDetails(true);
      setErrorDetails(null);
      try {
        const { data, error } = await supabase
          .from("Corporate_Visa_Details")
          .select("*")
          .eq("visaCode", visaCode);
        if (error) throw error;
        setCorporateDetails(data || []);
      } catch (err) {
        setErrorDetails(err.message || "Failed to fetch corporate visa details.");
      } finally {
        setLoadingDetails(false);
      }
    }

    fetchCorporateDetails();
  }, [corporateData, visaCode]);

  // Fetch Cover Visa CostDetails and VolumePlan
  useEffect(() => {
    if (!visaCode) return;

    async function fetchCoverDetails() {
      try {
        const { data: costDetailsData, error: costDetailsError } = await supabase
          .from("Cover_Visa_CostDetails")
          .select("*")
          .eq("visaCode", visaCode);
        if (costDetailsError) throw costDetailsError;
        setCoverCostDetails(costDetailsData || []);

        const { data: volumePlanData, error: volumePlanError } = await supabase
          .from("Cover_Visa_VolumePlan")
          .select("*")
          .eq("visaCode", visaCode);
        if (volumePlanError) throw volumePlanError;
        setCoverVolumePlans(volumePlanData || []);
      } catch (err) {
        console.error("Error fetching cover visa details:", err.message);
      }
    }

    fetchCoverDetails();
  }, [visaCode]);


  useEffect(() => {
    if (!visaCode) return;

    async function fetchRegularDetails() {
      setLoadingRegularDetails(true);
      setErrorRegularDetails(null);
      try {
        const { data: volumePlanData, error: volumePlanError } = await supabase
          .from("Regular_Visa_VolumePlan")
          .select("*")
          .eq("visaCode", visaCode);
        if (volumePlanError) throw volumePlanError;
        setRegularVolumePlans(volumePlanData || []);

        const { data: costDetailsData, error: costDetailsError } = await supabase
          .from("Regular_Visa_CostDetails")
          .select("*")
          .eq("visaCode", visaCode);
        if (costDetailsError) throw costDetailsError;
        setRegularCostDetails(costDetailsData || []);
      } catch (err) {
        setErrorRegularDetails(err.message || "Failed to fetch regular visa details.");
      } finally {
        setLoadingRegularDetails(false);
      }
    }

    fetchRegularDetails();
  }, [visaCode]);


const renderDataGrid = (data, dateKeys = []) => {
  const entries = Object.entries(data)
    .filter(([key]) => key !== "Regular" && key !== "UploadRegular"); // exclude keys here

  const rows = [];

  const formatLabel = (label) => {
    if (!label) return "";

    if (label === "principal") return "Distributor";

    let formatted = label.replace(/_/g, " ");
    formatted = formatted.replace(/([a-z])([A-Z])/g, "$1 $2");
    formatted = formatted.replace(/\b\w/g, (c) => c.toUpperCase());

    return formatted;
  };

  for (let i = 0; i < entries.length; i += 2) {
    const firstPair = entries[i];
    const secondPair = entries[i + 1];

    const formatValue = (key, value) => {
      if (dateKeys.includes(key)) {
        return formatDate(value);
      }
      if (value != null && !isNaN(value)) {
        return Number(value).toLocaleString();
      }
      return value?.toString() || "-";
    };

    rows.push(
      <tr key={i}>
        <td className="key-cell">{formatLabel(firstPair[0])}</td>
        <td className="value-cell">{formatValue(firstPair[0], firstPair[1])}</td>

        {secondPair ? (
          <>
            <td className="key-cell">{formatLabel(secondPair[0])}</td>
            <td className="value-cell">{formatValue(secondPair[0], secondPair[1])}</td>
          </>
        ) : (
          <>
            <td className="key-cell"></td>
            <td className="value-cell"></td>
          </>
        )}
      </tr>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
};



  if (!visaCode) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            position: 'sticky',
            top: '-20px',  // move up by 20px
            background: 'white',
            zIndex: 10,
            padding: '1rem',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 id="modal-title" className="modal-title" style={{ margin: 0 }}>
         Details: {visaCode}
          </h2>

          <button
            onClick={onClose}
            className="close-button"
            aria-label="Close"
            type="button"
            style={{
              fontSize: '1.5rem',
              lineHeight: '1',
              background: '#e53e3e',      // red background color
              border: 'none',
              color: 'white',             // white cross
              borderRadius: '4px',
              padding: '0.25rem 0.6rem',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#c53030'}  // darker red on hover
            onMouseLeave={e => e.currentTarget.style.background = '#e53e3e'}  // revert on leave
          >
            &times;
          </button>

        </div>



        {loading && <p>Loading data...</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && !error && (
          <>
            {corporateData && (
              <section className="visa-section">
                <h3 className="section-title">Corporate Visa</h3>
                {renderDataGrid(corporateData, [
                  "created_at",
                  "fromDate",
                  "sellInDate",
                  "start",
                  "end",
                  "toDate",
                ])}

                {loadingDetails && <p>Loading corporate details...</p>}
                {errorDetails && <p className="error-text">{errorDetails}</p>}

                {corporateDetails.length > 0 && (
                  <div
                    style={{
                      marginTop: "20px",
                      overflowX: "auto",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      maxWidth: "100%",
                    }}
                  >
                    <h4
                      style={{ marginLeft: "8px", marginBottom: "8px" }}
                    >
                      Corporate Visa Details
                    </h4>
                    <table
                      style={{
                        width: "100%",
                        minWidth: "1200px",
                        borderCollapse: "collapse",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={headerCellStyle}>Index</th>
                          <th style={headerCellStyle}>Checked</th>
                          <th style={headerCellStyle}>Sales Visa</th>
                          <th style={headerCellStyle}>Brand</th>
                          <th style={headerCellStyle}>Sales 2024</th>
                          <th style={headerCellStyle}>Target 2025</th>
                          <th style={headerCellStyle}>Diff</th>
                          <th style={headerCellStyle}>Percent Cont</th>
                          <th style={headerCellStyle}>Fixed Support</th>
                          <th style={headerCellStyle}>Variable Support</th>
                          <th style={headerCellStyle}>Total Support</th>
                          <th style={headerCellStyle}>Total Fixed Support VAT</th>
                          <th style={headerCellStyle}>Yago Support</th>
                          <th style={headerCellStyle}>Support Diff</th>
                          <th style={headerCellStyle}>CTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {corporateDetails.map((detail) => (
                          <tr key={detail.id}>
                            <td style={cellStyle}>{detail.index ?? "-"}</td>
                            <td style={cellStyle}>{detail.checked ? "Yes" : "No"}</td>
                            <td style={cellStyle}>{detail.salesVisa ?? "-"}</td>
                            <td style={cellStyle}>{detail.brand ?? "-"}</td>
                            <td style={cellStyle}>{detail.sales2024 ?? "-"}</td>
                            <td style={cellStyle}>{detail.target2025 ?? "-"}</td>
                            <td style={cellStyle}>{detail.diff ?? "-"}</td>
                            <td style={cellStyle}>{detail.percentCont ?? "-"}</td>
                            <td style={cellStyle}>{detail.fixedSupport ?? "-"}</td>
                            <td style={cellStyle}>{detail.variableSupport ?? "-"}</td>
                            <td style={cellStyle}>{detail.totalSupport ?? "-"}</td>
                            <td style={cellStyle}>{detail.totalFixedSupportVAT ?? "-"}</td>
                            <td style={cellStyle}>{detail.yagoSupport ?? "-"}</td>
                            <td style={cellStyle}>{detail.supportDiff ?? "-"}</td>
                            <td style={cellStyle}>{detail.cts ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {regularData && (
              <section className="visa-section">
                <h3 className="section-title">Regular PWP</h3>
                {renderDataGrid(regularData, [
                  "created_at",
                  "leadTimeFrom",
                  "leadTimeTo",
                  "activityDurationFrom",
                  "activityDurationTo",
                ])}
              </section>
            )}

            {/* Show loading or error for regular details */}
            {loadingRegularDetails && <p>Loading Regular Visa details...</p>}
            {errorRegularDetails && <p style={{ color: "red" }}>{errorRegularDetails}</p>}

            {/* Regular Visa Volume Plans */}
            {!loadingRegularDetails && !errorRegularDetails && regularVolumePlans.length > 0 && (
              <section className="visa-section">
                <h3 className="section-title">Regular Visa Volume Plans</h3>

                {regularVolumePlans.map((plan) => (
                  <div
                    key={plan.id}
                    style={{
                      marginTop: "20px",
                      overflowX: "auto",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      maxWidth: "100%",
                    }}
                  >
                    <h4 style={{ marginLeft: "8px", marginBottom: "8px" }}>
                      Regular Visa Volume Plan
                    </h4>

                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                      <thead>
                        <tr>
                          {plan.rows && plan.rows.length > 0
                            ? Object.keys(plan.rows[0]).map((col) => (
                              <th key={col} style={headerCellStyle}>
                                {col
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                              </th>
                            ))
                            : null}
                        </tr>
                      </thead>
                      <tbody>
                        {plan.rows && plan.rows.length > 0
                          ? plan.rows.map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((val, i) => {
                                // Check if val is a number or numeric string
                                const formattedVal =
                                  val != null && !isNaN(val)
                                    ? Number(val).toLocaleString()
                                    : val ?? "-";
                                return (
                                  <td key={i} style={cellStyle}>
                                    {formattedVal}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                          : null}
                      </tbody>
                    </table>


                    <div style={{ padding: "0 16px", marginTop: "8px", fontSize: "14px" }}>
                      <p>
                        <strong>Total List Price:</strong>{" "}
                        {plan.totalListPrice != null
                          ? Number(plan.totalListPrice).toLocaleString()
                          : "-"}
                      </p>
                      <p>
                        <strong>Total Non Promo Avg Sales:</strong>{" "}
                        {plan.totalNonPromoAvgSales != null
                          ? Number(plan.totalNonPromoAvgSales).toLocaleString()
                          : "-"}
                      </p>
                      <p>
                        <strong>Total Non Promo Avg Sales Amount:</strong>{" "}
                        {plan.totalNonPromoAvgSalesAmount != null
                          ? Number(plan.totalNonPromoAvgSalesAmount).toLocaleString()
                          : "-"}
                      </p>
                      <p>
                        <strong>Total Projected Avg Sales:</strong>{" "}
                        {plan.totalProjectedAvgSales != null
                          ? Number(plan.totalProjectedAvgSales).toLocaleString()
                          : "-"}
                      </p>
                      <p>
                        <strong>Total Projected Avg Sales Amount:</strong>{" "}
                        {plan.totalProjectedAvgSalesAmount != null
                          ? Number(plan.totalProjectedAvgSalesAmount).toLocaleString()
                          : "-"}
                      </p>
                      <p>
                        <strong>Average Increase Percent:</strong>{" "}
                        {plan.avgIncreasePercent != null
                          ? Number(plan.avgIncreasePercent).toLocaleString()
                          : "-"}
                      </p>

                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Regular Visa Cost Details */}
            {!loadingRegularDetails && !errorRegularDetails && regularCostDetails.length > 0 && (
              <section className="visa-section">
                <h3 className="section-title">Regular Visa Cost Details</h3>

                {regularCostDetails.map((cost) => (
                  <div
                    key={cost.id}
                    style={{
                      marginTop: "20px",
                      overflowX: "auto",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      maxWidth: "100%",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                      <thead>
                        <tr>
                          {cost.rows && cost.rows.length > 0
                            ? Object.keys(cost.rows[0]).map((col) => (
                              <th key={col} style={headerCellStyle}>
                                {col
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                              </th>
                            ))
                            : null}
                        </tr>
                      </thead>
                      <tbody>
                        {cost.rows && cost.rows.length > 0
                          ? cost.rows.map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((val, i) => {
                                const formattedVal =
                                  val != null && !isNaN(val)
                                    ? Number(val).toLocaleString()
                                    : val ?? "-";
                                return (
                                  <td key={i} style={cellStyle}>
                                    {formattedVal}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                          : null}
                      </tbody>
                    </table>


                    <div style={{ padding: "0 16px", marginTop: "8px", fontSize: "14px" }}>
                      <p>
                        <strong>Total Quantity:</strong> {cost.totalQuantity != null ? Number(cost.totalQuantity).toLocaleString() : "-"}
                      </p>
                      <p>
                        <strong>Total Cost Sum:</strong> {cost.totalCostSum != null ? Number(cost.totalCostSum).toLocaleString() : "-"}
                      </p>
                      <p>
                        <strong>Cost To Sales:</strong> {cost.costToSales != null ? Number(cost.costToSales).toLocaleString() : "-"}
                      </p>

                      <p>
                        <strong>Remarks:</strong> {cost.remarks ?? "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {coverData && (
              <section className="visa-section">
                <h3 className="section-title">Cover PWP</h3>
                {renderDataGrid(coverData, ["created_at"])}

                {/* Cover Pwp Cost Details Table */}
                {coverCostDetails.length > 0 && (
                  <div
                    style={{
                      marginTop: "20px",
                      overflowX: "auto",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      maxWidth: "100%",
                    }}
                  >
                    <h4
                      style={{ marginLeft: "8px", marginBottom: "8px" }}
                    >
                      Cover Pwp Cost Details
                    </h4>
                    <table
                      style={{
                        width: "100%",
                        minWidth: "1200px",
                        borderCollapse: "collapse",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={headerCellStyle}>Cost Details</th>
                          <th style={headerCellStyle}>Cost Remark</th>
                          <th style={headerCellStyle}>Quantity</th>
                          <th style={headerCellStyle}>Unit Cost</th>
                          <th style={headerCellStyle}>Discount</th>
                          <th style={headerCellStyle}>Charge To</th>
                          <th style={headerCellStyle}>Total Cost Sum</th>
                          <th style={headerCellStyle}>Cost To Sales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverCostDetails.map((item) => (
                          <tr key={item.id}>
                            <td style={cellStyle}>{item.costDetails ?? "-"}</td>
                            <td style={cellStyle}>{item.costRemark ?? "-"}</td>
                            <td style={cellStyle}>
                              {item.quantity != null && !isNaN(item.quantity)
                                ? Number(item.quantity).toLocaleString()
                                : "-"}
                            </td>
                            <td style={cellStyle}>
                              {item.unitCost != null && !isNaN(item.unitCost)
                                ? Number(item.unitCost).toLocaleString()
                                : "-"}
                            </td>
                            <td style={cellStyle}>
                              {item.discount != null && !isNaN(item.discount)
                                ? Number(item.discount).toLocaleString()
                                : "-"}
                            </td>
                            <td style={cellStyle}>{item.chargeTo ?? "-"}</td>
                            <td style={cellStyle}>
                              {item.totalCostSum != null && !isNaN(item.totalCostSum)
                                ? Number(item.totalCostSum).toLocaleString()
                                : "-"}
                            </td>
                            <td style={cellStyle}>
                              {item.costToSales != null && !isNaN(item.costToSales)
                                ? Number(item.costToSales).toLocaleString()
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                    </table>
                  </div>
                )}

                {/* Cover Pwp Volume Plan Table */}
                {coverVolumePlans.length > 0 && (
                  <div
                    style={{
                      marginTop: "20px",
                      overflowX: "auto",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      maxWidth: "100%",
                    }}
                  >
                    <h4
                      style={{ marginLeft: "8px", marginBottom: "8px" }}
                    >
                      Cover Pwp Volume Plan
                    </h4>
                    <table
                      style={{
                        width: "100%",
                        minWidth: "1200px",
                        borderCollapse: "collapse",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={headerCellStyle}>Item Code</th>
                          <th style={headerCellStyle}>Projected Avg Sales</th>
                          <th style={headerCellStyle}>UM</th>
                          <th style={headerCellStyle}>Projected Avg Sales Amount</th>
                          <th style={headerCellStyle}>Total Projected Avg Sales</th>
                          <th style={headerCellStyle}>Total Projected Avg Sales Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverVolumePlans.map((item) => (
                          <tr key={item.id}>
                            <td style={cellStyle}>{item.itemCode ?? "-"}</td>
                            <td style={cellStyle}>
                              {item.projectedAvgSales != null && !isNaN(item.projectedAvgSales)
                                ? Number(item.projectedAvgSales).toLocaleString()
                                : "-"}
                            </td>
                            <td style={cellStyle}>{item.UM ?? "-"}</td>
                            <td style={cellStyle}>
                              {item.projectedAvgSalesAmount != null && !isNaN(item.projectedAvgSalesAmount)
                                ? Number(item.projectedAvgSalesAmount).toLocaleString()
                                : "-"}
                            </td>
                            <td style={cellStyle}>
                              {item.totalProjectedAvgSales != null && !isNaN(item.totalProjectedAvgSales)
                                ? Number(item.totalProjectedAvgSales).toLocaleString()
                                : "-"}
                            </td>
                            <td style={cellStyle}>
                              {item.totalProjectedAvgSalesAmount != null && !isNaN(item.totalProjectedAvgSalesAmount)
                                ? Number(item.totalProjectedAvgSalesAmount).toLocaleString()
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
