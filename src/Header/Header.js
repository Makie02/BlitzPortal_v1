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

  const [showNotifications, setShowNotifications] = useState(false);
  const [showApprovalNotifications, setShowApprovalNotifications] = useState(false);
  const [loadingView, setLoadingView] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [approvalNotifications, setApprovalNotifications] = useState([]);
  const [showVisaModal, setShowVisaModal] = useState(false);

  const [showApprovalIcon, setShowApprovalIcon] = useState(false);
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
      const tables = ["cover_pwp", "regular_pwp"];
      const allNotifications = [];

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.error(`Error fetching from ${table}:`, error.message);
          continue;
        }
        if (data?.length) {
          data.forEach(item => {
            // Exclude notifications where CreatedForm matches current user's name (names)
            if (item.CreatedForm !== names) {
              allNotifications.push({
                ...item,
                _path: table,
                _key: item.id, // Adjust if your PK is different
              });
            }
          });
        }
      }

      setNotifications(allNotifications);
    } catch (err) {
      console.error('Unexpected error fetching notifications:', err);
    }
  };

  const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
  const userId = currentUser?.UserID || "unknown";
  const names = currentUser?.name || "";

  const [unreadCount, setUnreadCount] = useState(0);

  const fetchApprovalNotifications = async () => {
    console.log("User name:", names);  // <--- console log here

    try {
      const { data, error } = await supabase
        .from("Approval_History")
        .select("*")
        .neq("ApproverId", userId)
        .eq("CreatedForm", names)
        .order("DateResponded", { ascending: false });

      if (error) {
        console.error("Error fetching Approval_History:", error.message);
        return;
      }

      const list = data.map((item) => ({ ...item, _key: item.id }));
      setApprovalNotifications(list);

      // Count all notifications where Notification is false
      const unreadCount = data.filter((item) => item.Notification === false).length;
      setUnreadCount(unreadCount);
    } catch (err) {
      console.error("Unexpected error fetching Approval_History:", err);
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

      await fetchApprovalNotifications();
    } catch (err) {
      console.error('Unexpected error in markApprovalAsRead:', err);
    }
  };

  useEffect(() => {
    fetchApprovalNotifications();

    const interval = setInterval(() => {
      fetchApprovalNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);



  // Mark all unread notifications as read in bulk
  const markAllRead = async () => {
    try {
      const updatesByTable = {};

      notifications.forEach(n => {
        if (!n.notification) {
          if (!updatesByTable[n._path]) updatesByTable[n._path] = [];
          updatesByTable[n._path].push(n._key);
        }
      });

      for (const [table, ids] of Object.entries(updatesByTable)) {
        const { error } = await supabase
          .from(table)
          .update({ notification: true })
          .in('id', ids);

        if (error) {
          console.error(`Error updating notifications in ${table}:`, error.message);
        }
      }

      await fetchNotifications();
    } catch (err) {
      console.error('Unexpected error marking all notifications as read:', err);
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
  useEffect(() => {
    const interval = setInterval(() => {
      const unreadIds = notifications.filter(n => !n.Notification).map(n => n._key);
      if (unreadIds.length === 0) return;

      setHighlightIds(new Set(unreadIds));
      setTimeout(() => setHighlightIds(new Set()), 10000);
    }, 10000);

    return () => clearInterval(interval);
  }, [notifications]);

  // Approval unread count for UI badges
  const approvalUnreadCount = approvalNotifications.filter(n => !n.Notification).length;

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

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
    setShowModal(true);
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
            ref={approvalNotificationsRef} // Attach the ref here
            className="approval-dropdown"

            style={{
              position: "absolute",
              top: 40,
              right: 50,  // Adjust this to avoid overlap with bell icon
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
                background: "#28a745", // green header for approval
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
              .sort((a, b) => new Date(b.DateResponded).getTime() - new Date(a.DateResponded).getTime())
              .map((n, i) => {
                const isUnread = !n.Notification; // We mark read/unread by Notification boolean

                // Determine background color based on Response value
                let responseBgColor = "transparent"; // default transparent
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
                      backgroundColor: "#e6f7ff", // unread highlight
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
                        marginTop: "4px"
                      }}
                    >
                      Response: {n.Response || "Pending"}
                    </span>
                    <span style={{ fontSize: 12, color: "#555", marginTop: "4px" }}>
                      Date: {new Date(n.DateResponded).toLocaleString()}
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
        await markAllRead();
      }
    }}
    className="notification-bell"
    style={{ cursor: "pointer", position: "relative", color: "#fff", fontSize: 22 }}
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
                  new Date(b.DateCreated).getTime() -
                  new Date(a.DateCreated).getTime()
              )
              .map((n, i) => {
                const isRead = !!n.notification;
                return (
                  <div
                    key={i}
                    onClick={() => handleNotificationClick(n)}
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
                      {n.createForm} •{" "}
                      {new Date(n.created_at).toLocaleString()}
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
