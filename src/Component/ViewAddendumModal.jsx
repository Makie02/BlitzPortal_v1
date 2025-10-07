import React from "react";

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  zIndex: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalContentStyle = {
  background: "#fff",
  padding: "24px",
  borderRadius: "10px",
  maxWidth: "800px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
};

export const ViewAddendumModal = ({ visa, viewType, onClose }) => {
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <h2>Viewing Addendum</h2>
        <p><strong>Type:</strong> {visa.type}</p>
        <p><strong>Code:</strong> {visa.regularpwpcode || visa.cover_code || "N/A"}</p>
        <p><strong>View Mode:</strong> {viewType}</p>

        {viewType === "regular_pwp" && (
          <div>
            <h4>Regular Upload Details</h4>
            <pre>{JSON.stringify(visa, null, 2)}</pre>
          </div>
        )}
        {viewType === "cover+pwp" && (
          <div>
            <h4>Cover PWP Details</h4>
            <pre>{JSON.stringify(visa, null, 2)}</pre>
          </div>
        )}
        {viewType === "regularDetails" && (
          <div>
            <h4>Regular Visa Details</h4>
            <pre>{JSON.stringify(visa, null, 2)}</pre>
          </div>
        )}

        <button
          style={{
            marginTop: "20px",
            backgroundColor: "#4f46e5",
            color: "#fff",
            padding: "10px 16px",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};
