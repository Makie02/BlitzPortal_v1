import React, { useState, useEffect } from 'react';
import { Button, Collapse } from 'react-bootstrap';
import './RolePermissionForm.css';
import { supabase } from '../supabaseClient';

const roleCategories = [
  "Dashboard", "Progress", "ViewButtons", "ClaimsStatus", "RentalSummaryTables",
  "ApprovalsPage", "ApprovalHistoryTable", "References", "UserManagement",
  "BrandSelector", "BrandApprovalForm", "Activities", "RecordsPage",
  "ApprovalList", "ManageMarketing", "Calendar", "LoginPage", "AnnouncementForm",
  "RentalsForm", "AddendumCancellation", "ClaimsStatusUpload"
];

export default function RolePermissionForm({ onSubmit }) {
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  // Fetch userRoles from new user_role table
  useEffect(() => {
    let isMounted = true;

    const fetchUserRoles = async () => {
      const { data, error } = await supabase
        .from("user_role")
        .select("*");

      if (error) {
        console.error("❌ Error fetching UserRoles:", error);
        if (isMounted) setUserRoles([]);
      } else {
        console.log("✅ UserRoles fetched:", data);
        if (isMounted) setUserRoles(data || []);
      }
    };

    fetchUserRoles();

    return () => { isMounted = false; };
  }, []);

  // Fetch permissions after userRoles are loaded
  useEffect(() => {
    const fetchPermissions = async () => {
      const { data, error } = await supabase.from("RolePermissions").select("*");

      if (error) {
        console.error("Error fetching RolePermissions:", error);
        return;
      }

      // Map role_name to allowed permissions array
      const permissionMap = {};
      data.forEach(({ role_name, permission, allowed }) => {
        if (!permissionMap[role_name]) permissionMap[role_name] = [];
        if (allowed) permissionMap[role_name].push(permission);
      });

      // Extract unique role names from userRoles.role
      const uniqueRoleNames = [...new Set(userRoles.map(r => r.role))];

      // Create roles array with permission selections
      const loadedRoles = uniqueRoleNames.map(roleName => ({
        name: roleName,
        selected: permissionMap[roleName] || [],
        open: true
      }));

      setRoles(loadedRoles);
    };

    if (userRoles.length) fetchPermissions();
  }, [userRoles]);

  useEffect(() => {
    console.log("✅ Loaded roles:", roles);
  }, [roles]);

  const handleCheckboxChange = (roleIndex, category) => {
    setRoles(prevRoles =>
      prevRoles.map((role, idx) => {
        if (idx !== roleIndex) return role;
        const isSelected = role.selected.includes(category);
        const updatedSelected = isSelected
          ? role.selected.filter(item => item !== category)
          : [...role.selected, category];

        return { ...role, selected: updatedSelected };
      })
    );
  };

  const toggleRole = (index) => {
    setRoles(prevRoles =>
      prevRoles.map((role, i) =>
        i === index ? { ...role, open: !role.open } : role
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Delete all existing RolePermissions
      await supabase.from('RolePermissions').delete().neq('id', 0);

      // Prepare insert array
      const inserts = [];

      roles.forEach((role) => {
        if (!role.name.trim()) return;
        roleCategories.forEach((permission) => {
          inserts.push({
            role_name: role.name.trim(),
            permission,
            allowed: role.selected.includes(permission),
          });
        });
      });

      // Insert new permissions
      const { error } = await supabase.from("RolePermissions").insert(inserts);
      if (error) throw error;

      if (onSubmit) onSubmit(inserts);

      alert("Roles saved to Supabase successfully!");
    } catch (error) {
      console.error("Error saving roles:", error);
      alert("Failed to save roles. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="role-form-container">
      <h4 className="mb-4">Role Permission Settings</h4>

      {roles.map((role, index) => (
        <div key={index} className="role-card fade-in">
          <div className="role-header mb-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{role.name}</h5>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => toggleRole(index)}
            >
              {role.open ? "Hide" : "Show"}
            </Button>
          </div>

          <Collapse in={role.open}>
            <div className="fade-in">
              <div className="row" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {roleCategories.map((category, catIdx) => (
                  <div className="col-md-4 col-sm-6" key={catIdx}>
                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`role-${index}-cat-${catIdx}`}
                        checked={role.selected.includes(category)}
                        onChange={() => handleCheckboxChange(index, category)}
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`role-${index}-cat-${catIdx}`}
                      >
                        {category}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Collapse>
        </div>
      ))}

      <Button variant="primary" type="submit" className="mt-3">
        Save All Roles
      </Button>
    </form>
  );
}
