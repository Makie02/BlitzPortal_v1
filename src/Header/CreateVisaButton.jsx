import React from "react";
import "./CreateVisaButton.css"; // put the CSS below in this file

function CreateVisaButton({ onClick }) {
  return (
    <button className="Btn" onClick={onClick} aria-label="Create Visa">
      <div className="sign">+</div>
      <div className="text">Create</div>
    </button>
  );
}

export default CreateVisaButton;
