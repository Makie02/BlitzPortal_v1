import { useState, useEffect, useRef } from "react";
import { FaCaretDown } from "react-icons/fa";

export default function ApprovalDropdownButtons({
  entry,
  handleDeclineClick,
  handleSendBackClick,
  isDisabledByModal,  // new prop here
  disableModal,  // function to block/clear modalVisaCode in parent
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClickedDisabled, setIsClickedDisabled] = useState(false);
  const dropdownRef = useRef(null);

  const isDisabled = entry.status === "Approved" || entry.status === "Declined" || isDisabledByModal;

  const toggleDropdown = () => {
    if (!isDisabled) setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleDecline = (code) => {
    setIsClickedDisabled(true);    // Disable button on click
    disableModal();                // Block/hide modal in parent
    handleDeclineClick(code);
    setIsOpen(false);
  };

  const handleSendBack = (code) => {
    setIsClickedDisabled(true);    // Disable button on click
    disableModal();                // Block/hide modal in parent
    handleSendBackClick(code);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        onClick={toggleDropdown}
        disabled={isDisabled}
        style={{
          padding: "8px 16px",
          backgroundColor: isDisabled ? "#888" : "#dc3545",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: isDisabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          transition: "background-color 0.3s ease, box-shadow 0.3s ease",
          userSelect: "none",
          fontWeight: "600",
          boxShadow: isDisabled ? "none" : "0 4px 8px rgba(220,53,69,0.3)",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.backgroundColor = "#b02a37";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(176,42,55,0.4)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.backgroundColor = "#dc3545";
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(220,53,69,0.3)";
          }
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {entry.status === "Declined" ? "Declined" : "Actions"}
        {!isDisabled && <FaCaretDown />}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            borderRadius: "6px",
            zIndex: 1000,
            minWidth: "180px",
            overflow: "hidden",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDecline(entry.code);
            }}
            style={{
              width: "100%",
              padding: "10px 16px",
              border: "none",
              background: "none",
              textAlign: "left",
              cursor: "pointer",
              color: "#dc3545",
              fontWeight: "600",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fdecea")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Decline
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSendBack(entry.code);
            }}
            style={{
              width: "100%",
              padding: "10px 16px",
              border: "none",
              background: "none",
              textAlign: "left",
              cursor: "pointer",
              color: "#007bff",
              fontWeight: "600",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e7f1ff")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Send Back for Revision
          </button>
        </div>
      )}
    </div>
  );
}
