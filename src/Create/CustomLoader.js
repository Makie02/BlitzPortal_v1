// src/Create/CustomLoader.jsx
import React from "react";
import "./CustomLoader.css"; // Add the CSS from below

const CustomLoader = () => {
  return (
    <div id="page">
      <div id="container">
        <div id="ring"></div>
        <div id="ring"></div>
        <div id="ring"></div>
        <div id="ring"></div>
        <div id="h3">loading</div>
      </div>
    </div>
  );
};

export default CustomLoader;
