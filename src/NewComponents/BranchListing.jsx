import React, { useEffect, useState } from "react";
import { Table, Form, Spinner, Container, Card } from "react-bootstrap";
import { supabase } from "../supabaseClient";

export default function BranchListing() {
  const [departments, setDepartments] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);

  // Toggle fields for branches
  const settingFields = [
    "mother_account",
    "customer1",
    "customer2",
    "customer3",
    "customer4",
    "customer5",
  ];

  // Fetch data
  const fetchData = async () => {
    setLoading(true);

    // Fetch all departments
    const { data: deptData, error: deptError } = await supabase
      .from("department")
      .select("id, code, name, description")
      .order("id");

    if (deptError) {
      console.error("Error loading departments:", deptError.message);
      setLoading(false);
      return;
    }

    // Fetch all branch_settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("branch_settings")
      .select("*");

    if (settingsError) {
      console.error("Error loading branch settings:", settingsError.message);
      setLoading(false);
      return;
    }

    // Create a settings map for quick access
    const settingsMap = {};
    settingsData.forEach((s) => {
      settingsMap[s.department_code] = s;
    });

    setDepartments(deptData);
    setSettings(settingsMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Toggle setting
// Toggle setting (Insert if missing, Update if exists)
const toggleSetting = async (departmentCode, field) => {
  const currentSetting = settings[departmentCode] || {};
  const newValue = !currentSetting[field];

  if (!currentSetting.id) {
    // Insert new row if not exists
    const newSetting = { department_code: departmentCode, [field]: newValue };
    const { data, error } = await supabase
      .from("branch_settings")
      .insert([newSetting])
      .select()
      .single(); // return the new row with ID

    if (error) {
      console.error("Insert error:", error.message);
      return;
    }

    // Update state locally
    setSettings((prev) => ({
      ...prev,
      [departmentCode]: data,
    }));
  } else {
    // Update existing row
    const { error } = await supabase
      .from("branch_settings")
      .update({ [field]: newValue })
      .eq("id", currentSetting.id);

    if (error) {
      console.error("Update error:", error.message);
      return;
    }

    // Update state locally
    setSettings((prev) => ({
      ...prev,
      [departmentCode]: {
        ...prev[departmentCode],
        [field]: newValue,
      },
    }));
  }
};


  return (
    <Container className="my-5">
      <Card>
        <Card.Header className="bg-success text-white">
          <h4 className="mb-0">Branch / Department Listing</h4>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div
              className="d-flex justify-content-center align-items-center"
              style={{ height: "200px" }}
            >
              <Spinner animation="border" variant="success" />
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table
                striped
                bordered
                hover
                responsive
                className="align-middle text-center"
              >
                <thead className="table-success">
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    {settingFields.map((field) => (
                      <th key={field} className="text-capitalize">
                        {field.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => {
                    const setting = settings[dept.code] || {};
                    return (
                      <tr key={dept.code}>
                        <td className="text-start">{dept.code}</td>
                        {/* ✅ This ensures the department NAME is displayed */}
                        <td className="text-start">{dept.name}</td>
                        {settingFields.map((field) => (
                          <td key={field}>
                            <Form.Check
                              type="checkbox"
                              checked={!!setting[field]}
                              onChange={() => toggleSetting(dept.code, field)}
                              aria-label={`${field} toggle for ${dept.name}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
