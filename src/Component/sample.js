import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "../supabaseClient"; // Your Supabase client
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../Firebase";

export async function fetchFirestoreCollection(collectionPath, orderField = "createdAt", orderDirection = "desc") {
  try {
    const colRef = collection(db, ...collectionPath); // collectionPath is an array of path segments
    const q = query(colRef, orderBy(orderField, orderDirection));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching Firestore collection:", error);
    return [];
  }
}

export default function CreateAnnouncementNews() {
  const { register, handleSubmit, reset } = useForm();
  const [uploading, setUploading] = useState(false);
  const [postType, setPostType] = useState("announcement");
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [firestoreClients, setFirestoreClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const servicesRef = collection(db, "services");
        const q = query(servicesRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        setServices(data);
      } catch (error) {
        console.error("Error fetching services:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const serviceId = "dQtOVf0YPiBLipn1CPoo"; // Replace this or make it dynamic
        const clientsRef = collection(db, "services", serviceId, "clients");
        const q = query(clientsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const clients = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFirestoreClients(clients);
      } catch (error) {
        console.error("Error fetching Firestore clients:", error);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const tableName = postType === "announcement" ? "announcements" : "news";
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formattedData = data.map((item) => ({
          ...item,
          showView: item.show_view,
        }));

        setItems(formattedData);
      } catch (error) {
        console.error("Error fetching items:", error);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [postType]);

  // Submit Handler
  const onSubmit = async (data) => {
    setUploading(true);

    try {
      let fileBase64 = "";

      // Convert file to base64 string
      if (data.file?.length > 0) {
        const file = data.file[0];

        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        fileBase64 = await base64Promise;
      }

      const tableName = postType === "announcement" ? "announcements" : "news";

      const { data: inserted, error } = await supabase
        .from(tableName)
        .insert([
          {
            title: data.title,
            description: data.description,
            file_base64: fileBase64,
            show_view: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      alert(`${postType === "announcement" ? "Announcement" : "News"} saved!`);
      reset();
      setItems((prev) => [inserted, ...prev]);
    } catch (err) {
      console.error("Error saving:", err);
      alert("Failed to save. Check console for details.");
    } finally {
      setUploading(false);
    }
  };

  // Toggle visibility
  const toggleShowView = async (item) => {
    try {
      const tableName = postType === "announcement" ? "announcements" : "news";
      const { error } = await supabase
        .from(tableName)
        .update({ show_view: !item.show_view })
        .eq("id", item.id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, show_view: !i.show_view } : i
        )
      );
    } catch (error) {
      console.error("Failed to update showView:", error);
      alert("Failed to update view permission.");
    }
  };

  // Delete post
  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This action cannot be undone.`)) return;

    try {
      const tableName = postType === "announcement" ? "announcements" : "news";
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      alert("Deleted successfully.");
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete. Check console for details.");
    }
  };

  // Responsive layout handler
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Styles
  const containerStyle = {
    display: "flex",
    flexWrap: "wrap",
    maxWidth: 1200,
    margin: "40px",
    gap: 40,
    padding: "0 15px",
  };
  const sectionStyle = { flex: "1 1 400px", minWidth: 300 };
  const tableContainerStyle = {
    ...sectionStyle,
    overflowX: windowWidth <= 768 ? "auto" : "visible",
  };
  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: windowWidth <= 768 ? 13 : 14,
    tableLayout: "fixed",
    wordBreak: "break-word",
  };
  const thTdStyle = {
    borderBottom: "1px solid #ddd",
    padding: windowWidth <= 768 ? 6 : 8,
    verticalAlign: "top",
    textAlign: "left",
  };
  const thStyle = { ...thTdStyle, backgroundColor: "#f5f5f5" };
  const centerTdStyle = { ...thTdStyle, textAlign: "center" };
  const buttonBaseStyle = {
    cursor: "pointer",
    border: "none",
    borderRadius: 4,
    padding: "6px 12px",
    backgroundColor: "blue",
    color: "#fff",
    fontSize: 14,
    transition: "background-color 0.3s ease",
  };
  const buttonViewStyle = {
    ...buttonBaseStyle,
    backgroundColor: "#2196f3",
    marginTop: windowWidth <= 768 ? 6 : 0,
    width: windowWidth <= 768 ? "100%" : "auto",
  };
  const buttonViewHoverStyle = { backgroundColor: "#1769aa" };
  const buttonDeleteStyle = {
    ...buttonBaseStyle,
    backgroundColor: "#f44336",
    marginLeft: windowWidth <= 768 ? 0 : 8,
    marginTop: windowWidth <= 768 ? 6 : 0,
    width: windowWidth <= 768 ? "100%" : "auto",
  };
  const buttonDeleteHoverStyle = { backgroundColor: "#aa2e25" };
  const labelStyle = { display: "block", marginBottom: 6, fontWeight: 600 };
  const inputStyle = {
    width: "100%",
    padding: 8,
    marginBottom: 16,
    boxSizing: "border-box",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: 14,
  };
  const switchStyle = {
    position: "relative",
    display: "inline-block",
    width: 40,
    height: 22,
    verticalAlign: "middle",
  };
  const sliderStyle = {
    position: "absolute",
    cursor: "pointer",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ccc",
    transition: "0.4s",
    borderRadius: 22,
  };
  const sliderBeforeStyle = {
    position: "absolute",
    content: '""',
    height: 16,
    width: 16,
    left: 3,
    bottom: 3,
    backgroundColor: "white",
    transition: "0.4s",
    borderRadius: "50%",
  };

  return (
    <div style={containerStyle}>
      {/* Left Side: Form */}
      {/* <div style={sectionStyle}>
        <h2>{postType === "announcement" ? "📢 Create Announcement" : "📰 Create News"}</h2>

        <form onSubmit={handleSubmit(onSubmit)}>
          <label style={labelStyle}>Select Type:</label>
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value)}
            style={inputStyle}
          >
            <option value="announcement">📢 Announcement</option>
            <option value="news">📰 News</option>
          </select>

          <label style={labelStyle}>Title</label>
          <input type="text" {...register("title", { required: true })} style={inputStyle} />

          <label style={labelStyle}>Description</label>
          <textarea {...register("description", { required: true })} rows={4} style={inputStyle} />

          <label style={labelStyle}>Attachment / Image (Optional)</label>
          <input
            type="file"
            {...register("file")}
            style={inputStyle}
            accept="image/*,application/pdf"
          />

          <button
            type="submit"
            disabled={uploading}
            style={{ ...buttonBaseStyle, padding: "10px 20px", width: "100%" }}
          >
            {uploading ? "Saving..." : `Save ${postType === "announcement" ? "Announcement" : "News"}`}
          </button>
        </form>
      </div>

      {/* Right Side: Table */}
      {/* <div style={tableContainerStyle}>
        <h2>{postType === "announcement" ? "📢 Announcements List" : "📰 News List"}</h2>

        {loadingItems ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <p>No {postType === "announcement" ? "Announcements" : "News"} found.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ backgroundColor: "blue", color: "#fff" }}>Title</th>
                <th style={{ backgroundColor: "blue", color: "#fff" }}>Description</th>
                <th style={{ backgroundColor: "blue", color: "#fff" }}>Show View</th>
                <th style={{ backgroundColor: "blue", color: "#fff" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={thTdStyle}>{item.title}</td>
                  <td style={thTdStyle}>{item.description}</td>
                  <td style={centerTdStyle}>
                    <label style={switchStyle}>
                      <input
                        type="checkbox"
                        checked={item.showView || false}
                        onChange={() => toggleShowView(item)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          ...sliderStyle,
                          backgroundColor: item.showView ? "#4caf50" : "#ccc",
                        }}
                      >
                        <span
                          style={{
                            ...sliderBeforeStyle,
                            transform: item.showView ? "translateX(18px)" : "none",
                          }}
                        />
                      </span>
                    </label>
                  </td>
                  <td style={thTdStyle}>
                    {item.showView ? (
                      <>
                        {item.file_base64 && (
                          <button
                            style={buttonViewStyle}
                            onClick={() => {
                              // Open base64 file in new tab
                              const win = window.open();
                              if (win) {
                                win.document.write(`<iframe src="${item.file_base64}" frameborder="0" style="width:100%;height:100%;"></iframe>`);
                              } else {
                                alert("Please allow popups for this site.");
                              }
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = buttonViewHoverStyle.backgroundColor)}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = buttonViewStyle.backgroundColor)}
                          >
                            View
                          </button>
                        )}


                        <button
                          style={buttonDeleteStyle}
                          onClick={() => handleDelete(item)}
                          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = buttonDeleteHoverStyle.backgroundColor)}
                          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = buttonDeleteStyle.backgroundColor)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span style={{ color: "#999", fontStyle: "italic" }}>No actions available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>  */}
      <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
        <h2>Services</h2>
        {loading ? (
          <p>Loading services...</p>
        ) : services.length === 0 ? (
          <p>No services found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#007BFF", color: "#fff" }}>
                <th style={thTdStyle}>ID</th>
                <th style={thTdStyle}>User Code</th>
                <th style={thTdStyle}>System User ID</th>
                <th style={thTdStyle}>Created At</th>
                <th style={thTdStyle}>Is Taken</th>
                <th style={thTdStyle}>Subscription Start</th>
                <th style={thTdStyle}>Subscription End</th>
                <th style={thTdStyle}>Has Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {services.map(service => (
                <tr key={service.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={thTdStyle}>{service.id}</td>
                  <td style={thTdStyle}>{service.userCode || "-"}</td>
                  <td style={thTdStyle}>{service.systemUserId || "-"}</td>
                  <td style={thTdStyle}>
                    {service.createdAt?.toDate
                      ? service.createdAt.toDate().toLocaleString()
                      : "-"}
                  </td>
                  <td style={thTdStyle}>{service.isTaken ? "Yes" : "No"}</td>
                  <td style={thTdStyle}>
                    {service.subscriptionStart?.toDate
                      ? service.subscriptionStart.toDate().toLocaleDateString()
                      : "-"}
                  </td>
                  <td style={thTdStyle}>
                    {service.subscriptionEnd?.toDate
                      ? service.subscriptionEnd.toDate().toLocaleDateString()
                      : "-"}
                  </td>
                  <td style={thTdStyle}>{service.hasSubscribed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
