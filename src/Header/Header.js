import React, { useState, useEffect, useRef } from "react";
import { FaBell, FaClipboardList } from "react-icons/fa";
import CreateVisaButton from "./CreateVisaButton";
import CustomLoader from "../Create/CustomLoader";
import bellIcon from '../Assets/stamp.png';
import FaBells from '../Assets/bell.png';
import './Header.css';
import { supabase } from '../supabaseClient';

function Header({ sidebarExpanded, setSidebarExpanded, setCurrentView, currentView }) {
  // User & UI states
  const [loggedInUser, setLoggedInUser] = useState(() => {
    const userData = localStorage.getItem("loggedInUser");
    return userData ? JSON.parse(userData) : null;
  });
  const [name, setname] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);
        setname(userObj.name || "User");
      } catch {
        setname("User");
      }
    }
  }, []);

  const [showApprovalIcon, setShowApprovalIcon] = useState(true); // Show/hide logic as needed



  const [approvalUnreadCount, setApprovalUnreadCount] = useState(0);
  const [approvalNotifications, setApprovalNotifications] = useState([]);
  const [showApprovalNotifications, setShowApprovalNotifications] = useState(false);

  // Move fetchApprovalCount outside useEffect so you can call it anywhere
  const fetchApprovalCount = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
      const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
      const role = currentUser?.role || "";

      let query = supabase
        .from('Approval_History')
        .select('Notication, CreatedForm')
        .eq('Notication', false);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching approval notifications:', error);
        return;
      }

      if (!data) {
        setApprovalUnreadCount(0);
        return;
      }

      if (role === 'admin') {
        setApprovalUnreadCount(data.length);
        return;
      }

      // Filter for CreatedForm === currentUserName (case insensitive)
      const filtered = data.filter(row =>
        (row.CreatedForm?.toLowerCase().trim() || '') === currentUserName
      );

      setApprovalUnreadCount(filtered.length);
    } catch (err) {
      console.error('Unexpected error fetching approval notifications:', err);
      setApprovalUnreadCount(0);
    }
  };

  // Fetch all approval notifications (you might already have this)
  const fetchApprovalNotifications = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
      const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
      const role = currentUser?.role || "";

      const { data, error } = await supabase
        .from('Approval_History')
        .select('*')
        .order('DateResponded', { ascending: false });

      if (error) {
        console.error('Error fetching approval notifications:', error);
        return;
      }

      if (!data) {
        setApprovalNotifications([]);
        return;
      }

      if (role === 'admin') {
        // Admin sees all notifications
        setApprovalNotifications(data);
        return;
      }

      // Filter to only include rows where CreatedForm matches currentUserName
      const filtered = data.filter(row =>
        (row.CreatedForm?.toLowerCase().trim() || '') === currentUserName
      );

      setApprovalNotifications(filtered);
    } catch (err) {
      console.error('Unexpected error fetching approval notifications:', err);
      setApprovalNotifications([]);
    }
  };

  const markApprovalAsRead = async (approvalId) => {
    if (!approvalId) return;

    try {
      const { error } = await supabase
        .from('Approval_History')
        .update({ Notication: true })
        .eq('id', approvalId);

      if (error) {
        console.error('Error marking approval as read:', error.message);
        return;
      }

      // Refresh notifications list AND count right after marking as read
      await fetchApprovalNotifications();
      await fetchApprovalCount();
    } catch (err) {
      console.error('Unexpected error in markApprovalAsRead:', err);
    }
  };

  useEffect(() => {
    // Initial load of notifications and count
    fetchApprovalNotifications();
    fetchApprovalCount();

    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchApprovalNotifications();
      fetchApprovalCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);



  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingView, setLoadingView] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showVisaModal, setShowVisaModal] = useState(false);

  const [showNotificationIcon, setShowNotificationIcon] = useState(false);
  const [highlightIds, setHighlightIds] = useState(new Set());
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("approvals");

  // Refs for dropdown clicks outside
  const notificationsRef = useRef(null);
  const approvalNotificationsRef = useRef(null);

  // Effect: Log user info on login change
  const loggedOnce = useRef(false);

  useEffect(() => {
    if (loggedInUser && !loggedOnce.current) {
      // console.log("✅ Logged-in User Info:", loggedInUser);
      loggedOnce.current = true;
    }
  }, [loggedInUser]);

  // Fetch user security settings
  useEffect(() => {
    const fetchSecuritySettings = async () => {
      try {
        const userId = loggedInUser?.UserID;
        if (!userId) {
          console.warn('No userId found in loggedInUser.');
          return;
        }

        const { data, error } = await supabase
          .from('Account_SecuritySettings')
          .select('*')
          .eq('UserCode', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('❌ Error fetching security settings:', error.message);
          return;
        }

        if (data) {
          setShowApprovalIcon(!!data.approvals);
          setShowNotificationIcon(!!data.notifications);
        } else {
          setShowApprovalIcon(false);
          setShowNotificationIcon(false);
          console.warn('⚠️ No security settings found for user:', userId);
        }
      } catch (err) {
        console.error('❌ Unexpected error fetching security settings:', err);
      }
    };

    if (loggedInUser?.UserID) {
      fetchSecuritySettings();
    }
  }, [loggedInUser]);

const fetchNotifications = async () => {
  try {
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const currentUserName = currentUser?.name?.toLowerCase().trim() || "";
    const role = currentUser?.role || "";

    const tables = ["cover_pwp", "regular_pwp"];
    const allNotifications = [];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*');

      if (error) {
        console.error(`Error fetching from ${table}:`, error.message);
        continue;
      }

      console.log(`Fetched ${data?.length || 0} items from ${table}`);

      if (data?.length) {
        data.forEach(item => {
          const createdFormName = (item.createForm || "").toLowerCase().trim();
          const isCreatedByUser = createdFormName === currentUserName;

          // Only push if admin or creator AND notification is unread (false)
          if ((role === "admin" || isCreatedByUser) && item.notification === false) {
            allNotifications.push({
              ...item,
              _path: table,
              _key: item.id,
            });
          }
        });
      }
    }

    console.log("Total unread notifications found:", allNotifications.length);

    setNotifications(allNotifications);
    setUnreadCount(allNotifications.length); // unread count

  } catch (err) {
    console.error('Unexpected error fetching notifications:', err);
  }
};


  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);



  const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
  const userId = currentUser?.UserID || "unknown";
  const names = currentUser?.name || "";








  // Mark all unread notifications as read in bulk
  const markAllRead = async () => {
    try {
      const updatesByTable = {};

      notifications.forEach(n => {
        // ✅ Only mark those that are currently "read" (true)
        if (n.notification === true) {
          if (!updatesByTable[n._path]) updatesByTable[n._path] = [];
          updatesByTable[n._path].push(n._key);
        }
      });

      for (const [table, ids] of Object.entries(updatesByTable)) {
        if (ids.length > 0) {
          const { error } = await supabase
            .from(table)
            .update({ notification: false }) // ✅ Mark as UNREAD
            .in('id', ids);

          if (error) {
            console.error(`Error updating notifications in ${table}:`, error.message);
          }
        }
      }

      await fetchNotifications(); // 🔁 Refresh the notifications list
    } catch (err) {
      console.error('Unexpected error marking notifications as unread:', err);
    }
  };






  // Handle outside click to close dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showNotifications &&
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }

      if (
        showApprovalNotifications &&
        approvalNotificationsRef.current &&
        !approvalNotificationsRef.current.contains(event.target)
      ) {
        setShowApprovalNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications, showApprovalNotifications]);

  // Periodic polling of notifications every 30 seconds
  useEffect(() => {
    fetchNotifications();
    fetchApprovalNotifications();

    const interval = setInterval(() => {
      fetchNotifications();
      fetchApprovalNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Highlight unread notifications briefly every 10 seconds

  // Approval unread count for UI badges

  // UI button definitions etc.
  const buttons = [
    // {
    //   label: "CORPORATE",
    //   view: "VisaForm",
    //   className: "instagram-card",
    //   icon: (
    //     <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24">
    //       <path d="M10 2h4a2 2 0 012 2v2h3a1 1 0 011 1v2H4V7a1 1 0 011-1h3V4a2 2 0 012-2zm0 2v2h4V4h- 4zM4 10h16v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9zm8 3a2 2 0 00-2 2v1h4v-1a2 2 0 00-2-2z" />
    //     </svg>
    //   ),
    // },
    {
      label: "COVER PWP",
      view: "CoverVisa",
      className: "twitter-card",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24">
          <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3zM12 20c-3.31-1.06-6-5.17-6-9V6.26l6-2.25 6 2.25V11c0 3.83-2.69 7.94-6 9z" />
        </svg>
      ),
    },
    {
      label: "REGULAR PWP",
      view: "RegularVisaForm",
      className: "facebook-card",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24">
          <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm1 17.93V19h-2v.93A8.12 8.12 0 014.07 13H5v-2H4.07A8.12 8.12 0 0111 4.07V5h2v-.93A8.12 8.12 0 0119.93 11H19v2h.93A8.12 8.12 0 0113 19.93z" />
        </svg>
      ),
    },
    {
      label: "PRE - Upload Regular PWP",
      view: "RegularPwpUploadForm",
      className: "Upload-card", // Reuse existing class to fix design
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24">
          <path d="M19 9h-4V3H9v6H5l7 8 7-8zM5 18v2h14v-2H5z" />
        </svg>
      ),
    },
  ];

  const handleClick = (view) => {
    setLoadingView(view);
    setTimeout(() => {
      setCurrentView(view);
      setLoadingView(null);
      setShowVisaModal(false);
    }, 1000);
  };

  const handleNotificationClick = async (notificationItem) => {
    console.log("Clicked notification:", notificationItem);

    // Skip if already read
    if (notificationItem.notification === true) {
      setSelectedNotification(notificationItem);
      setShowModal(true);
      return;
    }

    try {
      const { error } = await supabase
        .from(notificationItem._path)
        .update({ notification: true })  // Mark as read
        .eq("id", notificationItem._key);

      if (error) {
        console.error("Error updating notification:", error.message);
        return;
      }

      // Refresh list and show modal with the selected notification
      await fetchNotifications();
      setSelectedNotification(notificationItem);
      setShowModal(true);

    } catch (err) {
      console.error("Unexpected error updating notification:", err);
    }
  };


  return (
    <header
      style={{
        padding: "14.5px 25px",
        background: "#4689A6",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "'Roboto Slab', serif",
        letterSpacing: "1px",
        textTransform: "uppercase",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          style={{
            fontSize: "24px",
            background:
              "linear-gradient(179deg, rgb(56, 53, 250) 50%, rgba(85, 127, 242, 1) 100%)",
            border: "2px solid rgb(167, 167, 167)",
            color: "#fff",
            cursor: "pointer",
            borderRadius: "3px",
            marginRight: "20px",
            width: '44px',
            boxShadow: "0 3px 6px rgba(0,0,0,0.5)",
            height: '45px'
          }}
          aria-label="Toggle sidebar"
        >
          <i className="fas fa-bars"></i>
        </button>
        <CreateVisaButton onClick={() => setShowVisaModal(true)} />
      </div>

      {loadingView && <CustomLoader />}

      {/* Approval Notifications Icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          position: "relative",
        }}
      >
        {/* Approval Notifications Icon — LEFT */}
        {/* Approval Notifications Icon */}
        {showApprovalIcon && (
          <div
            onClick={() => setShowApprovalNotifications(!showApprovalNotifications)}
            style={{ cursor: "pointer", position: "relative", color: "#fff", fontSize: 22 }}
            aria-label="Toggle approval notifications"
          >
            <img src={bellIcon} alt="Approval Notifications" style={{ width: 30, height: 30 }} />
            {approvalUnreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-8px",
                  backgroundColor: "red",
                  color: "#fff",
                  borderRadius: "50%",
                  fontSize: "10px",
                  padding: "2px 5px",
                  fontWeight: "bold",
                }}
              >
                {approvalUnreadCount}
              </span>
            )}
          </div>
        )}


        {/* Approval Notifications Dropdown */}
        {showApprovalNotifications && (
          <div
            ref={approvalNotificationsRef}
            className="approval-dropdown"
            style={{
              position: "absolute",
              top: 40,
              right: 50,
              width: 320,
              maxHeight: 400,
              overflowY: "auto",
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
              padding: 0,
              zIndex: 1000,
            }}
          >
            <h4
              style={{
                margin: 0,
                padding: "12px 16px",
                background: "#28a745",
                color: "#fff",
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                fontSize: 14,
              }}
            >
              Approval History
            </h4>
            {approvalNotifications.length === 0 && (
              <p style={{ padding: 16 }}>No approvals available.</p>
            )}
            {approvalNotifications
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.DateResponded).getTime() -
                  new Date(a.DateResponded).getTime()
              )
              .map((n) => {
                const isUnread = n.Notication === false; // unread if Notication === false

                // Determine background color based on Response value
                let responseBgColor = "transparent";
                if (n.Response === "Sent back for revision") responseBgColor = "orange";
                else if (n.Response === "Declined") responseBgColor = "red";
                else if (n.Response === "Approved") responseBgColor = "green";

                return (
                  <div
                    key={n.id}
                    onClick={() => markApprovalAsRead(n.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "12px 16px",
                      borderBottom: "1px solid #eee",
                      backgroundColor: isUnread ? "#e6f7ff" : "#d3d3d3", // light blue if unread, gray if read
                      cursor: "pointer",
                      transition: "background-color 0.3s",
                    }}
                  >
                    <span style={{ fontWeight: "bold" }}>
                      M-ID: {n.PwpCode || n.regularpwpcode}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        backgroundColor: responseBgColor,
                        color: "#fff",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        display: "inline-block",
                        maxWidth: "fit-content",
                        marginTop: "4px",
                      }}
                    >
                      Response: {n.Response || "Pending"}
                    </span>
                    <span style={{ fontSize: 12, color: "#555", marginTop: "4px" }}>
                      Date: {new Date(n.DateResponded).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
          </div>
        )}



        {/* Notification Bell Icon — RIGHT */}
        {showNotificationIcon && (
          <div
            onClick={async () => {
              setShowNotifications(!showNotifications);

              if (!showNotifications) {
                await markAllRead(); // ✅ This now marks all as UNREAD
              }
            }}
            className="notification-bell"
            style={{
              cursor: "pointer",
              position: "relative",
              color: "#fff",
              fontSize: 22
            }}
          >
            <img src={FaBells} alt="Notifications" style={{ width: 30, height: 30 }} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-8px",
                  backgroundColor: "red",
                  color: "#fff",
                  borderRadius: "50%",
                  fontSize: "10px",
                  padding: "2px 5px",
                  fontWeight: "bold",
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
        )}







        {showNotifications && (
          <div
            ref={notificationsRef}
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              width: 320,
              maxHeight: 400,
              overflowY: "auto",
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
              padding: 0,
              zIndex: 1000,
            }}
          >
            <h4
              style={{
                margin: 0,
                padding: "12px 16px",
                background: "#4267B2",
                color: "#fff",
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                fontSize: 14,
              }}
            >
              Notifications
            </h4>

            {notifications.length === 0 && (
              <p style={{ padding: 16 }}>No notifications available.</p>
            )}

            {notifications
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
              .map((n, i) => {
                const isRead = !!n.notification;
                return (
                  <div
                    key={i}
                    onClick={() => handleNotificationClick(n)}  // just pass n here
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "12px 16px",
                      borderBottom: "1px solid #eee",
                      backgroundColor: isRead ? "#f5f5f5" : "#e6f7ff",
                      cursor: "pointer",
                      transition: "background-color 0.3s",
                    }}
                  >
                    <span style={{ fontWeight: "bold" }}>
                      {n.regularpwpcode || n.cover_code} – {n.pwp_type || n.pwptype}
                    </span>
                    <span style={{ fontSize: 12, color: "#555" }}>
                      {n.createForm} • {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                );
              })}

          </div>
        )}


        {showModal && selectedNotification && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1100,
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 10,
                padding: 20,
                width: 400,
                position: "relative",
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  position: "absolute",
                  top: 30,
                  right: 30,
                  background: "red",
                  border: "none",
                  fontSize: 20,
                  color: '#ffff',
                  cursor: "pointer",
                  borderRadius: '5px'
                }}
              >
                x
              </button>

              <h3 style={{
                margin: "0 0 16px 0",
                fontSize: "20px",
                fontWeight: "600",
                color: "#fff",
                backgroundColor: "#4267B2", // Facebook-style blue or choose your color
                padding: "12px 16px",
                borderRadius: "6px 6px 0 0"
              }}>
                Notification Details
              </h3>
              <p><strong>M-Code:</strong> {selectedNotification.regularpwpcode || selectedNotification.cover_code}</p>
              <p><strong>M-Type:</strong> {selectedNotification.pwp_type || selectedNotification.pwptype}</p>
              <p>
                <strong>badget:</strong>
                ₱{(selectedNotification.credit_budget || selectedNotification.amount_badget)?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0'}
              </p>
              <p><strong>Date:</strong> {new Date(selectedNotification.created_at).toLocaleString()}</p>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setActiveTab("approvals") || setCurrentView("ApprovalsPage")}
                  style={{
                    flex: 1,
                    padding: 10,
                    backgroundColor: activeTab === "approvals" ? "#4267B2" : "#f0f0f0",
                    color: activeTab === "approvals" ? "#fff" : "#000",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  Approvals
                </button>
                <button
                  onClick={() => setActiveTab("manage") || setCurrentView("ManageVisa")}
                  style={{
                    flex: 1,
                    padding: 10,
                    backgroundColor: activeTab === "manage" ? "#4267B2" : "#f0f0f0",
                    color: activeTab === "manage" ? "#fff" : "#000",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  Manage
                </button>
              </div>

              <div style={{ marginTop: 20 }}>
                {activeTab === "approvals" ? (
                  <p>✅ Approvals content goes here.</p>
                ) : (
                  <p>⚙️ Manage content goes here.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          className="welcome-message"
          style={{
            background: "#62aaff",
            padding: "8px 16px",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "10px",
            boxShadow: "inset 0 0 6px rgba(255,255,255,0.1)",
          }}
        >
          Welcome, <strong>{name || "User"}</strong>
        </div>

      </div>
      <style>
        {`
  @media (max-width: 768px) {
    .welcome-message {
      display: none !important;
    }
  }
`}
      </style>

      {
        showVisaModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1500,
            }}
            onClick={() => setShowVisaModal(false)}
          >
            <div
              style={{
                backgroundColor: "#fff",
                padding: "30px",
                borderRadius: "12px",
                width: "320px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                textAlign: "center",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cards">
                {buttons.map(({ label, view, className, icon }) => (
                  <div
                    key={view}
                    className={`card-container ${className} ${currentView === view ? "active-card" : ""
                      }`}
                    onClick={() => handleClick(view)}
                  >
                    <div className="icon-container">
                      {icon}
                      <p>{label}</p>
                    </div>
                    <p>&rarr;</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }

      <style>{`
        .notification-unread:hover {
          background-color:rgb(98, 119, 131) !important;
        }
      `}</style>
    </header >
  );
}

export default Header;
