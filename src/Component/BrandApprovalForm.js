import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { supabase } from "../supabaseClient"; // Supabase client
import "./BrandApprovalForm.css";

function BrandApprovalForm() {
  const [formData, setFormData] = useState({
    approverLevel: "",
    principal: "",
    visaType: "",
    department: "",
    chargedTo: "Company",
    position: "",
  });

  const [departments, setDepartments] = useState(["-"]);
  const [visaTypes, setVisaTypes] = useState(["-"]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddApprover = async (e) => {
    e.preventDefault();

    try {
      const { principal, visaType, department, chargedTo, position } = formData;

      // ===== SAVE TO SUPABASE ONLY ===== //
      const { error: supabaseError } = await supabase
        .from("brand_approval_plan")
        .insert([
          {
            principal,
            visa_type: visaType,
            department,
            charged_to: chargedTo,
            position,
          },
        ]);

      if (supabaseError) throw supabaseError;

      Swal.fire({
        icon: "success",
        title: "Saved!",
        text: "Approval Plan has been saved to Supabase.",
      });

      handleResetMatrix();

    } catch (error) {
      console.error("Save error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to save to Supabase.",
      });
    }
  };

  const handleResetMatrix = () => {
    setFormData({
      brandApprovalPlan: "",
      principal: "",
      approverLevel: "",
      visaType: "Regular",
      department: "Claims",
      chargedTo: "Company",
      position: "-",
    });
  };

  const handleCopyMatrix = () => {
    navigator.clipboard.writeText(JSON.stringify(formData, null, 2))
      .then(() => alert("Matrix copied to clipboard!"))
      .catch(() => alert("Failed to copy matrix."));
  };

  const [principal, setPrincipal] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchPrincipals = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "Principals");

      if (error) {
        console.error("Error fetching Activity data:", error);
      } else if (isMounted) {
        setPrincipal(data);
      }
    };

    fetchPrincipals();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchDepartments = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "Department");

      if (error) {
        console.error("Error fetching department data:", error);
      } else if (isMounted) {
        setDepartments(data);
      }
    };

    fetchDepartments();

    return () => {
      isMounted = false;
    };
  }, []);

  const [chargedToOptions, setChargedToOptions] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchChargedTo = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "ChargeTo");

      if (error) {
        console.error("Error fetching 'Charged To' options:", error);
      } else if (isMounted) {
        setChargedToOptions(data);
      }
    };

    fetchChargedTo();

    return () => {
      isMounted = false;
    };
  }, []);

  const [positions, setPositions] = useState(["-"]);

  useEffect(() => {
    let isMounted = true;

    const fetchPositions = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("name")
        .eq("reference_type", "Position");

      if (error) {
        console.error("Error fetching positions:", error);
      } else if (isMounted && data) {
        const positionNames = data
          .map((item) => item.name)
          .filter((name) => name && name.trim() !== "-");

        setPositions(positionNames.length ? positionNames : ["-"]);
      }
    };

    fetchPositions();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <form className="formContainer" aria-label="Brand Approval Form">
      <h3
        style={{
          fontSize: "1.8rem",
          fontWeight: "700",
          marginBottom: "1rem",
          letterSpacing: "1px",
          borderBottom: "3px solid #2575fc",
          paddingBottom: "0.5rem",
        }}
      >
        Brand Approval Plan
      </h3>

      <div className="formGrid">
        <div className="formGroup">
          <label htmlFor="principal" className="label">
            Principal
          </label>

          <select
            name="principal"
            className="form-control"
            value={formData.principal}
            onChange={handleChange}
            style={{ paddingRight: "30px" }}
          >
            <option value="">Select Sales Division</option>
            {principal.map((opt, index) => (
              <option key={index} value={opt.name || opt}>
                {opt.name || opt}
              </option>
            ))}
          </select>
        </div>

        <div className="formGroup">
          <label htmlFor="visaType" className="label">
            Visa Type
          </label>
          <select
            id="visaType"
            name="visaType"
            value={formData.visaType}
            onChange={handleChange}
            className="select"
            required
          >
            <option value="" disabled>
              Select Visa Type
            </option>
            <option value="REGULAR">REGULAR</option>
            <option value="CORPORATE">CORPORATE</option>
            <option value="COVER">COVER</option>
          </select>
        </div>

        <div className="formGroup">
          <label htmlFor="department" className="label">
            Department
          </label>
          <select
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            className="select"
          >
            <option value="" disabled>
              Select Department
            </option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="formGroup">
          <label htmlFor="chargedTo" className="label">
            Charged To
          </label>
          <select
            id="chargedTo"
            name="chargedTo"
            value={formData.chargedTo}
            onChange={handleChange}
            className="select"
          >
            <option value="" disabled>
              Select Charged To
            </option>
            {chargedToOptions.map((option) => (
              <option key={option.id} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="formGroup" style={{ position: "relative" }}>
          <label htmlFor="position" className="label">
            Select Position
          </label>
          <select
            id="position"
            name="position"
            value={formData.position}
            onChange={handleChange}
            className="select form-control"
            style={{
              paddingRight: "30px",
              borderColor: formData.position ? "green" : "",
              transition: "border-color 0.3s",
            }}
            onMouseEnter={(e) => {
              if (formData.position) e.currentTarget.style.borderColor = "green";
            }}
            onMouseLeave={(e) => {
              if (formData.position) e.currentTarget.style.borderColor = "green";
              else e.currentTarget.style.borderColor = "";
            }}
            required
          >
            <option value="" disabled>
              Select Position
            </option>
            {positions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>

          {formData.position && (
            <span
              style={{
                position: "absolute",
                right: "20px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "green",
                fontWeight: "bold",
                fontSize: "25px",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              ✓
            </span>
          )}
        </div>
      </div>

      <div className="buttonGroup">
        <button
          type="submit"
          onClick={handleAddApprover}
          className="button"
          aria-label="Add approver"
        >
          Add Approver
        </button>
        <button
          type="button"
          onClick={handleResetMatrix}
          className="button resetButton"
          aria-label="Reset matrix"
        >
          Reset Matrix
        </button>
        <button
          type="button"
          onClick={handleCopyMatrix}
          className="button copyButton"
          aria-label="Copy matrix"
        >
          Copy Matrix
        </button>
      </div>
    </form>
  );
}

export default BrandApprovalForm;
