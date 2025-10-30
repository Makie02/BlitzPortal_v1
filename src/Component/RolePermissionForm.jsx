	import React, { useState, useEffect } from 'react';
import { Button, Collapse, Spinner, Alert } from 'react-bootstrap';
import './RolePermissionForm.css';
import { supabase } from '../supabaseClient';

const roleCategories = [
  "Dashboard", "Progress", "ViewButtons", "ClaimsStatus", "RentalSummaryTables",
  "ApprovalsPage", "ApprovalHistoryTable", "References", "UserManagement",
  "BrandSelector", "BrandApprovalForm", "Activities", "RecordsPage",
  "ApprovalList", "ManageMarketing", "Calendar", "LoginPage", "AnnouncementForm",
  "RentalsForm", "AddendumCancellation", "ClaimsStatusUpload", "Claims_pwp", "ClaimsRecords",
  "BudgetDashboard" ,"Analytics","UploadingSap"
];

export default function RolePermissionForm({ onSubmit }) {
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Fetch userRoles from user_role table
  useEffect(() => {
    let isMounted = true;

    const fetchUserRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("user_role")
          .select("*");

        if (error) throw error;

        console.log("✅ UserRoles fetched:", data);
        if (isMounted) setUserRoles(data || []);
      } catch (err) {
        console.error("❌ Error fetching UserRoles:", err);
        if (isMounted) {
          setError("Failed to load user roles");
          setUserRoles([]);
        }
      }
    };

    fetchUserRoles();

    return () => { isMounted = false; };
  }, []);

  // Fetch permissions after userRoles are loaded
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setLoading(true);
        
        // Use role field for matching, keep description for display
        const roleMapping = userRoles.reduce((acc, r) => {
          if (r.role?.trim()) {
            acc[r.role.trim()] = r.description?.trim() || r.role.trim();
          }
          return acc;
        }, {});
        const uniqueRoleNames = Object.keys(roleMapping);
        
        console.log("📋 Unique roles from user_role table:", uniqueRoleNames);
        console.log("📋 Role mapping (role -> description):", roleMapping);

        if (uniqueRoleNames.length === 0) {
          console.warn("⚠️ No roles found in user_role table");
          setRoles([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("RolePermissions")
          .select("*");

        if (error) throw error;

        console.log("📊 RolePermissions data from Supabase:", data);

        // Map role_name to allowed permissions array
        const permissionMap = {};
        const originalMap = {};
        
        if (data && data.length > 0) {
          data.forEach(({ role_name, permission, allowed }) => {
            // Normalize role_name from database
            const normalizedRoleName = role_name.trim().replace(/\s+/g, ' ');
            
            if (!permissionMap[normalizedRoleName]) {
              permissionMap[normalizedRoleName] = [];
              originalMap[normalizedRoleName] = {};
            }
            if (allowed) permissionMap[normalizedRoleName].push(permission);
            originalMap[normalizedRoleName][permission] = allowed;
          });
        }

        // Store original permissions for comparison
        setOriginalPermissions(originalMap);

        // Create roles array with both role and displayName
        const loadedRoles = uniqueRoleNames.map(roleName => {
          const existingPermissions = permissionMap[roleName] || [];
          
          // If role has no permissions in RolePermissions table, initialize empty
          if (!originalMap[roleName]) {
            originalMap[roleName] = {};
            roleCategories.forEach(cat => {
              originalMap[roleName][cat] = false;
            });
          }
          
          return {
            name: roleName,  // Role 1, Role 2, etc (for matching database)
            displayName: roleMapping[roleName],  // ADMIN, Accounting, etc (for display)
            selected: existingPermissions,
            open: false
          };
        });

        console.log("✅ Loaded roles with permissions:", loadedRoles);
        setRoles(loadedRoles);
        setOriginalPermissions(originalMap);
        setError(null);
      } catch (err) {
        console.error("❌ Error fetching permissions:", err);
        setError("Failed to load permissions: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userRoles.length > 0) {
      fetchPermissions();
    } else if (userRoles.length === 0) {
      setLoading(false);
    }
  }, [userRoles]);

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
    // Clear success message when making changes
    setSuccess(false);
  };

  const toggleRole = (index) => {
    setRoles(prevRoles =>
      prevRoles.map((role, i) =>
        i === index ? { ...role, open: !role.open } : role
      )
    );
  };

  const toggleAllRoles = (shouldOpen) => {
    setRoles(prevRoles =>
      prevRoles.map(role => ({ ...role, open: shouldOpen }))
    );
  };

  const handleSubmit = async (e, specificRoleIndex = null) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updates = [];
      const inserts = [];

      // Filter roles to save - either specific role or all roles
      const rolesToSave = specificRoleIndex !== null 
        ? [roles[specificRoleIndex]] 
        : roles;

      rolesToSave.forEach((role) => {
        // Normalize role name - remove extra spaces and trim
        const roleName = role.name.trim().replace(/\s+/g, ' ');
        if (!roleName) return;

        console.log(`📝 Processing role: "${roleName}"`);

        roleCategories.forEach((permission) => {
          const isCurrentlySelected = role.selected.includes(permission);
          const originalPermission = originalPermissions[roleName]?.[permission];

          // Check if this permission exists in original data
          const permissionExists = originalPermissions[roleName] && 
                                  originalPermissions[roleName].hasOwnProperty(permission);

          if (permissionExists) {
            // If permission exists and value changed, add to updates
            if (originalPermission !== isCurrentlySelected) {
              updates.push({
                role_name: roleName,
                permission,
                allowed: isCurrentlySelected,
              });
            }
          } else {
            // If permission doesn't exist, add to inserts (always add for new permissions)
            inserts.push({
              role_name: roleName,
              permission,
              allowed: isCurrentlySelected,
            });
          }
        });
      });

      console.log(`📊 Changes detected: ${updates.length} updates, ${inserts.length} inserts`);

      if (updates.length === 0 && inserts.length === 0) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        setSaving(false);
        console.log("ℹ️ No changes to save");
        return;
      }

      // Perform updates
      if (updates.length > 0) {
        console.log("🔄 Updating permissions:", updates);
        
        // Use individual updates instead of upsert
        for (const update of updates) {
          const { error } = await supabase
            .from("RolePermissions")
            .update({ allowed: update.allowed })
            .eq('role_name', update.role_name)
            .eq('permission', update.permission);

          if (error) {
            console.error("❌ Update error:", error);
            console.error("Failed update data:", update);
            throw new Error(`Update failed: ${error.message}`);
          }
        }
        console.log(`✅ Successfully updated ${updates.length} permissions`);
      }

      // Perform inserts
      if (inserts.length > 0) {
        console.log("➕ Inserting permissions:", inserts);
        
        // Check for existing records first to avoid duplicates
        for (const insert of inserts) {
          // Try to find existing record
          const { data: existing, error: checkError } = await supabase
            .from("RolePermissions")
            .select("*")
            .eq('role_name', insert.role_name)
            .eq('permission', insert.permission)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is fine
            console.error("❌ Check error:", checkError);
            throw new Error(`Check failed: ${checkError.message}`);
          }

          if (existing) {
            // Record exists, update it instead
            console.log("🔄 Record exists, updating instead:", insert);
            const { error: updateError } = await supabase
              .from("RolePermissions")
              .update({ allowed: insert.allowed })
              .eq('role_name', insert.role_name)
              .eq('permission', insert.permission);

            if (updateError) {
              console.error("❌ Update error:", updateError);
              throw new Error(`Update failed: ${updateError.message}`);
            }
          } else {
            // Record doesn't exist, insert it
            const { error: insertError } = await supabase
              .from("RolePermissions")
              .insert([insert]);

            if (insertError) {
              console.error("❌ Insert error:", insertError);
              throw new Error(`Insert failed: ${insertError.message}`);
            }
          }
        }
        console.log(`✅ Successfully processed ${inserts.length} new permissions`);
      }

      // Update original permissions state
      rolesToSave.forEach(role => {
        if (!originalPermissions[role.name]) {
          originalPermissions[role.name] = {};
        }
        roleCategories.forEach(permission => {
          originalPermissions[role.name][permission] = role.selected.includes(permission);
        });
      });

      setOriginalPermissions({...originalPermissions});

      if (onSubmit) onSubmit([...updates, ...inserts]);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Reload permissions from database to ensure UI is in sync
      await refetchPermissions();
    } catch (err) {
      console.error("❌ Error saving roles:", err);
      setError(`Failed to save permissions: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Helper function to refetch permissions
  const refetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("RolePermissions")
        .select("*");

      if (error) throw error;

      console.log("🔄 Refetched permissions:", data);

      // Map role_name to allowed permissions array
      const permissionMap = {};
      const originalMap = {};
      
      if (data && data.length > 0) {
        data.forEach(({ role_name, permission, allowed }) => {
          if (!permissionMap[role_name]) {
            permissionMap[role_name] = [];
            originalMap[role_name] = {};
          }
          if (allowed) permissionMap[role_name].push(permission);
          originalMap[role_name][permission] = allowed;
        });
      }

      // Update roles with fresh data
      setRoles(prevRoles =>
        prevRoles.map(role => ({
          ...role,
          selected: permissionMap[role.name] || []
        }))
      );

      setOriginalPermissions(originalMap);
      console.log("✅ UI refreshed with latest data");
    } catch (err) {
      console.error("❌ Error refetching permissions:", err);
    }
  };

  const selectAllForRole = (roleIndex) => {
    setRoles(prevRoles =>
      prevRoles.map((role, idx) =>
        idx === roleIndex ? { ...role, selected: [...roleCategories] } : role
      )
    );
    setSuccess(false);
  };

  const deselectAllForRole = (roleIndex) => {
    setRoles(prevRoles =>
      prevRoles.map((role, idx) =>
        idx === roleIndex ? { ...role, selected: [] } : role
      )
    );
    setSuccess(false);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading permissions...</p>
        <small className="text-muted">Fetching roles from Supabase...</small>
      </div>
    );
  }

  if (error) {
    return (
      <div className="role-form-container">
        <Alert variant="danger">
          <Alert.Heading>Connection Error</Alert.Heading>
          <p>{error}</p>
          <hr />
          <div className="d-flex justify-content-end">
            <Button
              onClick={() => window.location.reload()}
              variant="outline-danger"
            >
              Retry Connection
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="role-form-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Role Permission Settings</h4>
        <div>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => toggleAllRoles(true)}
            className="me-2"
          >
            Expand All
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => toggleAllRoles(false)}
          >
            Collapse All
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(false)} dismissible>
          ✅ Permissions saved successfully!
        </Alert>
      )}

      {roles.length === 0 ? (
        <Alert variant="info">
          No roles found. Please add roles in the user management section.
        </Alert>
      ) : (
        roles.map((role, index) => (
          <div key={index} className="role-card fade-in mb-3">
            <div className="role-header mb-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                {role.displayName}
                <span className="ms-2 text-muted" style={{ fontSize: '0.875rem' }}>
                  ({role.selected.length}/{roleCategories.length} selected)
                </span>
              </h5>
              <div>
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={() => selectAllForRole(index)}
                  className="me-2"
                >
                  Select All
                </Button>
                <Button
                  variant="outline-warning"
                  size="sm"
                  onClick={() => deselectAllForRole(index)}
                  className="me-2"
                >
                  Deselect All
                </Button>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => toggleRole(index)}
                >
                  {role.open ? "Hide" : "Show"}
                </Button>
              </div>
            </div>

            <Collapse in={role.open}>
              <div className="fade-in">
                <div className="row" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
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
                          style={{ cursor: 'pointer' }}
                        >
                          {category}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Save button for this specific role */}
                <div className="mt-3 d-flex justify-content-end">
                  <Button 
                    variant="success" 
                    size="sm"
                    onClick={(e) => handleSubmit(e, index)}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Saving...
                      </>
                    ) : (
                      <>💾 Save {role.displayName} Permissions</>
                    )}
                  </Button>
                </div>
              </div>
            </Collapse>
          </div>
        ))
      )}

      <Button 
        variant="primary" 
        type="submit" 
        className="mt-3"
        disabled={saving || roles.length === 0}
      >
        {saving ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
              className="me-2"
            />
            Saving...
          </>
        ) : (
          'Save All Roles'
        )}
      </Button>
    </form>
  );
}
