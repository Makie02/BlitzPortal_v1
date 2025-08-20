import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  startAt,
  endAt,
  startAfter,
  limit,
} from "firebase/firestore";
import { db } from "../Firebase";

export default function Liecense() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  const [client, setClient] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalClients, setTotalClients] = useState(0);

  const [selectedClientDetails, setSelectedClientDetails] = useState(null);
  const [selectedClientUsers, setSelectedClientUsers] = useState([]);
  const [loadingSelectedClientUsers, setLoadingSelectedClientUsers] = useState(false);

  const ITEMS_PER_PAGE = 10;
  const clientCache = useRef({});

  const getCachedClients = (key, page) => clientCache.current[key]?.pages?.[page] || null;
  const setCachedClients = (key, page, data) => {
    clientCache.current[key] = clientCache.current[key] || { pages: {}, total: null };
    clientCache.current[key].pages[page] = data;
  };
  const getCachedTotal = key => clientCache.current[key]?.total ?? null;
  const setCachedTotal = (key, total) => {
    clientCache.current[key] = clientCache.current[key] || { pages: {}, total: null };
    clientCache.current[key].total = total;
  };

 useEffect(() => {
  const fetchServices = async () => {
    setLoading(true);
    try {
      const servicesRef = collection(db, "services");
      const q = query(servicesRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      console.log("Fetched services count:", snapshot.size);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("Service data:", data);
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
    const fetchClientAndUsers = async () => {
      if (!selectedService?.id || !selectedService?.clientId) {
        setClient(null);
        setUsers([]);
        return;
      }

      setLoadingUsers(true);
      try {
        const clientRef = doc(db, `services/${selectedService.id}/clients`, selectedService.clientId);
        const clientSnap = await getDoc(clientRef);

        if (clientSnap.exists()) {
          const clientData = { id: clientSnap.id, ...clientSnap.data() };
          setClient(clientData);

          const usersRef = collection(db, `services/${selectedService.id}/clients/${selectedService.clientId}/users`);
          const userSnap = await getDocs(usersRef);
          const userList = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUsers(userList);
        } else {
          setClient(null);
          setUsers([]);
        }
      } catch (error) {
        console.error("Error fetching client/users:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchClientAndUsers();
  }, [selectedService]);

  const fetchClients = useCallback(async () => {
    if (!selectedService?.id) return;
    setLoadingClients(true);

    const key = `${selectedService.id}-clients`;
    const term = searchTerm.trim().toLowerCase();

    try {
      if (term) {
        const q = query(
          collection(db, "services", selectedService.id, "clients"),
          orderBy("lowerCaseName"),
          startAt(term),
          endAt(term + "\uf8ff")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClients(list);
        setCachedClients(key, 1, list);
        setTotalClients(list.length);
        setCachedTotal(key, list.length);
        return;
      }

      const cached = getCachedClients(key, currentPage);
      if (cached) {
        setClients(cached);
        const total = getCachedTotal(key);
        if (total !== null) setTotalClients(total);
        return;
      }

      const baseRef = collection(db, "services", selectedService.id, "clients");
      let q = query(baseRef, orderBy("createdAt", "desc"), limit(ITEMS_PER_PAGE));

      if (currentPage > 1) {
        const prevSnap = await getDocs(query(baseRef, orderBy("createdAt", "desc"), limit((currentPage - 1) * ITEMS_PER_PAGE)));
        const last = prevSnap.docs[prevSnap.docs.length - 1];
        if (last) {
          q = query(baseRef, orderBy("createdAt", "desc"), startAfter(last), limit(ITEMS_PER_PAGE));
        }
      }

      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClients(list);
      setCachedClients(key, currentPage, list);

      if (currentPage === 1) {
        const allSnap = await getDocs(baseRef);
        setTotalClients(allSnap.size);
        setCachedTotal(key, allSnap.size);
      }
    } catch (err) {
      console.error("Error fetching paginated clients:", err);
    } finally {
      setLoadingClients(false);
    }
  }, [selectedService, currentPage, searchTerm]);

  useEffect(() => {
    if (selectedService?.id) {
      fetchClients();
      setSelectedClientDetails(null);
      setSelectedClientUsers([]);
    }
  }, [fetchClients]);

  const handleClientClick = async (client) => {
    setSelectedClientDetails(client);
    setSelectedClientUsers([]);
    setLoadingSelectedClientUsers(true);

    if (!selectedService?.id) {
      setLoadingSelectedClientUsers(false);
      return;
    }

    try {
      const usersRef = collection(db, "services", selectedService.id, "clients", client.id, "users");
      const userSnap = await getDocs(usersRef);
      const userList = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSelectedClientUsers(userList);
    } catch (error) {
      console.error("Error fetching users for client:", error);
      setSelectedClientUsers([]);
    } finally {
      setLoadingSelectedClientUsers(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    if (date.toDate) date = date.toDate();
    return date instanceof Date ? date.toLocaleDateString("en-US") : "-";
  };

  const thTdStyle = {
    borderBottom: "1px solid #ddd",
    padding: windowWidth <= 768 ? 6 : 8,
    verticalAlign: "top",
    textAlign: "left",
    cursor: "pointer",
  };
  const thStyle = { ...thTdStyle, backgroundColor: "#007BFF", color: "#fff", cursor: "default" };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <h2>Services</h2>
      {loading ? (
        <p>Loading services...</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={thStyle}>
                <th style={thTdStyle}>ID</th>
                <th style={thTdStyle}>Name</th>
                <th style={thTdStyle}>Code</th>
                <th style={thTdStyle}>Total Users</th>
                <th style={thTdStyle}>Has Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {services.map(service => (
                <tr
                  key={service.id}
                  style={{
                    backgroundColor: selectedService?.id === service.id ? "#e6f0ff" : "transparent",
                  }}
                  onClick={() => {
                    setSelectedService(service);
                    setCurrentPage(1);
                    setSearchTerm("");
                    setSelectedClientDetails(null);
                    setSelectedClientUsers([]);
                  }}
                >
                  <td style={thTdStyle}>{service.id}</td>
                  <td style={thTdStyle}>{service.name}</td>
                  <td style={thTdStyle}>{service.code}</td>
                  <td style={thTdStyle}>{service.totalUsers}</td>
                  <td style={thTdStyle}>{service.hasSubscribed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedService && (
            <div style={{ marginTop: 30 }}>
              <h3>Clients of {selectedService.name}</h3>
              <input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ marginBottom: 10, padding: 6, width: "100%", maxWidth: 300 }}
              />
              {loadingClients ? (
                <p>Loading clients...</p>
              ) : clients.length === 0 ? (
                <p>No clients found.</p>
              ) : (
                <>
                  <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                    {clients.map(c => (
                      <li
                        key={c.id}
                        onClick={() => handleClientClick(c)}
                        style={{
                          cursor: "pointer",
                          padding: "6px 10px",
                          backgroundColor: selectedClientDetails?.id === c.id ? "#d0e1ff" : "transparent",
                          borderRadius: 4,
                          marginBottom: 4,
                          border: selectedClientDetails?.id === c.id ? "1px solid #007BFF" : "1px solid transparent",
                        }}
                      >
                        <strong>{c.name}</strong> — License Key: {c.licenseKey || c.id}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 10 }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      style={{ marginRight: 10 }}
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPage} of {Math.ceil(totalClients / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      disabled={currentPage * ITEMS_PER_PAGE >= totalClients}
                      onClick={() => setCurrentPage(p => p + 1)}
                      style={{ marginLeft: 10 }}
                    >
                      Next
                    </button>
                  </div>

                  {selectedClientDetails && (
                    <div style={{ marginTop: 30 }}>
                      <h4>Client Details</h4>
                      <p><strong>Name:</strong> {selectedClientDetails.name}</p>
                      <p><strong>License Key:</strong> {selectedClientDetails.licenseKey || selectedClientDetails.id}</p>

                      <h5>Users</h5>
                      {loadingSelectedClientUsers ? (
                        <p>Loading users...</p>
                      ) : selectedClientUsers.length === 0 ? (
                        <p>No users found for this client.</p>
                      ) : (
                        <ul>
                          {selectedClientUsers.map(user => (
                            <li key={user.id}>
                              <strong>{user.name || "(No name)"}</strong> — License Key: {user.licenseKey || user.id} <br />
                              Subscription Start: {formatDate(user.subscriptionStart)} <br />
                              Subscription End: {formatDate(user.subscriptionEnd)} <br />
                              Status: {user.status || "-"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
