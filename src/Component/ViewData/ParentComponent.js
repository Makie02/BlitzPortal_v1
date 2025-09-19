import React, { useState, useEffect } from "react";
import EditModal from "./EditModal"; // adjust path if needed
import { supabase } from "./supabaseClient"; // adjust your supabase client import

function ParentComponent({ parsedUser }) {
  const [userDistributors, setUserDistributors] = useState([]);
  const [filteredDistributors, setFilteredDistributors] = useState([]);
  const [distributors, setDistributors] = useState([]);

  const loggedInUsername = parsedUser?.name || "Unknown";

  useEffect(() => {
    const fetchUserDistributors = async () => {
      const { data, error } = await supabase
        .from("user_distributors")
        .select("distributor_name")
        .eq("username", loggedInUsername);

      if (error) {
        console.error("[ERROR] Fetching user_distributors:", error);
      } else {
        const names = data.map((d) => d.distributor_name);
        setUserDistributors(names);
      }
    };

    fetchUserDistributors();
  }, [loggedInUsername]);

  useEffect(() => {
    const fetchDistributors = async () => {
      const { data, error } = await supabase
        .from("distributors")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("[ERROR] Fetching distributors:", error);
      } else {
        setDistributors(data);
        const allowed = data.filter((dist) =>
          userDistributors.includes(dist.name)
        );
        setFilteredDistributors(allowed);
      }
    };

    if (userDistributors.length > 0) {
      fetchDistributors();
    }
  }, [userDistributors]);

  // For demo, control modal open and row data here:
  const [modalOpen, setModalOpen] = useState(true);
  const [rowData, setRowData] = useState({
    id: 1,
    distributor_code: "", // initial distributor_code, empty or some value
    cover_code: "COVER123",
    regularpwpcode: "REG456",
  });

  const handleClose = () => setModalOpen(false);
  const handleSave = (updatedData) => {
    console.log("Saving data:", updatedData);
    // Save logic here
    setModalOpen(false);
  };

  return (
    <>
      {modalOpen && (
        <EditModal
          isOpen={modalOpen}
          onClose={handleClose}
          rowData={rowData}
          onSave={handleSave}
          updating={false}
          filteredDistributors={filteredDistributors}
          distributors={distributors}
        />
      )}
    </>
  );
}

export default ParentComponent;
