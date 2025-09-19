import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar/Sidebar";
import Header from "./Header/Header";
import Dashboard from "./Component/Dashboard";
import "./App.css";
import '@fortawesome/fontawesome-free/css/all.min.css';
import { collection, query, orderBy, onSnapshot , } from "firebase/firestore";
import { getDocs, getCollections } from "firebase/firestore";

import { db } from "./Firebase"; // your firebase config file
import Swal from 'sweetalert2';
import VisaForm from "./Create/VisaFormCorporate";
import ViewButtons from "./Create/ViewButtons.js";
import ManageMarketing from "./Component/ManageMarketing.js";
import CoverVisa from "./Create/CoverVisa.js";
import RegularVisaForm from "./Create/RegularVisaForm.js";
import BrandApprovalForm from "./Component/BrandApprovalForm.js";
import ClaimsStatus from "./Component/ClaimsStatus.js";
import RentalSummaryTables from "./Component/RentalSummaryTables.js";
import UserManagement from "./Component/UserManagement.js";
import BrandSelector from "./Component/BrandSelector.jsx";
import Activities from "./Component/Activities.jsx";
import RecordsPage from "./Component/RecordsPage.jsx";
import LoginPage from "./Login/LoginPage.jsx";
import Calendar from "./Component/Calendar.jsx";
import ApprovalHistoryTable from "./Component/ApprovalHistoryTable.jsx";
import ApprovalList from "./Component/ApprovalList.jsx";
import Progress from "./Component/Progress.jsx";
import ApprovalsPage from "./Component/ApprovalsPage.jsx";
import UserPage from "./Login/UserPage.jsx";
import View from "./Component/View_Cover.js";
import View_Regular from "./Component/View_Regular.jsx";
import ViewCorporate from "./Component/View_Corporate.jsx";
import SettingProfileUpdate from "./Login/SettingProfileUpdate.jsx";
import SettingsPage from "./Login/SettingsPage.jsx";
import AnnouncementForm from "./Component/AnnouncementForm.jsx";
import RolePermissionForm from "./Component/RolePermissionForm.jsx";
import AddendumCancellation from "./Component/AddendumCancellation.jsx";
import RentalsForm from "./Component/RentalsForm.jsx";
import ClaimsStatusUpload from "./Create/ClaimsStatusUpload.jsx";
import Liecense from "./Component/liecense.js";
import RegularPwpUploadForm from "./Create/RegularPwpUploadForm.jsx";
import { supabase } from "./supabaseClient.js";
import References from "./Component/References.jsx";

function App() {


    const [licenseData, setLicenseData] = useState([]);

  useEffect(() => {
        fetchLicenses();
    }, []);

    const fetchLicenses = async () => {
        const { data, error } = await supabase
            .from('subscription_licenses')
            .select('*')
            .order('submitted_at', { ascending: false });

        if (!error) {
            // Save to state
            setLicenseData(data);

            // Save to localStorage
            localStorage.setItem('licenseData', JSON.stringify(data));

            // Log to console
            console.log('Fetched license data:', data);
        } else {
            console.error('Error fetching license data:', error);
        }
    };

  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [currentView, _setCurrentView] = useState(localStorage.getItem("currentView") || "Dashboard");
  const [selectedNotification, setSelectedNotification] = useState(null);

  const watchedCollections = ['Corporate_Visa', 'Corver_Visa', 'Regular_Visa', 'Approval_History'];
  const lastKnownTimestampsRef = useRef({});
  const isExpired = (validUntil) => {
    if (!validUntil) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // start of today
    const validDate = new Date(validUntil);
    validDate.setHours(0, 0, 0, 0);
    return validDate <= today;
  };

  const fetchAndUpdateLicenseKeys = async () => {
    try {
      // Step 1: Fetch all license keys
      const { data, error } = await supabase
        .from('license_keys')
        .select('*');

      if (error) {
        console.error('❌ Error fetching license keys:', error.message);
        return;
      }

      if (!data || data.length === 0) {
        console.log('No license keys found.');
        localStorage.setItem('licenseKeys', JSON.stringify([]));
        return;
      }

      // Step 2: Find keys needing status update
      const keysToExpire = data.filter(
        (key) => isExpired(key.valid_until) && key.status !== 'Expired'
      );

      // Step 3: Update all expired keys statuses in parallel
      await Promise.all(
        keysToExpire.map(async (key) => {
          const { error } = await supabase
            .from('license_keys')
            .update({ status: 'Expired' })
            .eq('id', key.id);

          if (error) {
            console.error(`❌ Failed to update status for key ID ${key.id}:`, error.message);
          } else {
            console.log(`✅ Updated status to Expired for key ID ${key.id}`);
          }
        })
      );

      // Step 4: Fetch updated list again and log it
      const { data: updatedData, error: updatedError } = await supabase
        .from('license_keys')
        .select('*');

      if (updatedError) {
        // console.error('❌ Error fetching updated license keys:', updatedError.message);
      } else {
        // console.log('🔑 License keys after status update:', updatedData);

        // Save license keys to localStorage
        localStorage.setItem('licenseKeys', JSON.stringify(updatedData));
        // console.log('💾 License keys saved to localStorage.');
      }

    } catch (err) {
      console.error('❌ Unexpected error:', err);
    }
  };

  // Call the function when component mounts
  useEffect(() => {
    fetchAndUpdateLicenseKeys();
  }, []);






  useEffect(() => {
    const unsubscribes = [];

    watchedCollections.forEach((path) => {
      const q = query(collection(db, path), orderBy("DateCreated", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const latestDoc = snapshot.docs[0].data();

          let docDate;
          if (latestDoc.DateCreated?.toDate) {
            docDate = latestDoc.DateCreated.toDate();
          } else if (typeof latestDoc.DateCreated === "string" || latestDoc.DateCreated instanceof Date) {
            docDate = new Date(latestDoc.DateCreated);
          } else {
            docDate = new Date(); // fallback
          }

          const lastTimestamp = lastKnownTimestampsRef.current[path];
          if (!lastTimestamp || docDate > new Date(lastTimestamp)) {
            lastKnownTimestampsRef.current[path] = docDate.toISOString();

            let notification;

            if (path === "Approval_History") {
              notification = {
                visaCode: latestDoc.BabyVisaId || "N/A",
                visaType: "Approval Response",
                brand: `Approver: ${latestDoc.ApproverId || "Unknown"}`,
                DateCreated: docDate.toISOString(),
                response: latestDoc.Response || "No response",
              };
            } else {
              notification = {
                visaCode: latestDoc.visaCode || latestDoc.VisaCode || "N/A",
                visaType: latestDoc.visaType || latestDoc.Visa_Type || path,
                brand: latestDoc.brand || latestDoc.Brand || "N/A",
                DateCreated: docDate.toISOString(),
              };
            }

            Swal.fire({
              toast: true,
              position: 'top-end', // top-right
              icon: 'info',
              title: '🔔 New Notification',
              html: `
    <strong>Visa Code:</strong> ${notification.visaCode}<br/>
    <strong>Type:</strong> ${notification.visaType}<br/>
    <strong>Brand / Approver:</strong> ${notification.brand}<br/>
    ${notification.response ? `<strong>Response:</strong> ${notification.response}<br/>` : ""}
    <strong>Date:</strong> ${new Date(notification.DateCreated).toLocaleString()}
  `,
              showConfirmButton: false,
              timer: 5000,
              timerProgressBar: true,
              background: '#ffffff',
              customClass: {
                popup: 'swal2-toast-popup'
              }
            });

          }
        }
      });

      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, []);
useEffect(() => {
  const content = mainContentRef.current;
  if (content) {
    content.addEventListener("scroll", handleScroll);
    return () => content.removeEventListener("scroll", handleScroll);
  }
}, []);



  const closeNotification = () => setSelectedNotification(null);

  // Store logged-in user object
  const [loggedInUser, setLoggedInUser] = useState(() => {
    const userData = localStorage.getItem("loggedInUser");
    return userData ? JSON.parse(userData) : null;
  });
  useEffect(() => {
    if (loggedInUser) {
      // console.log("✅ Logged-in User Info:", loggedInUser);
    }
  }, [loggedInUser]);


  // Persist login state
  useEffect(() => {
    if (loggedInUser) {
      localStorage.setItem("loggedInUser", JSON.stringify(loggedInUser));
    } else {
      localStorage.removeItem("loggedInUser");
    }
  }, [loggedInUser]);


const setCurrentView = (view) => {
  localStorage.setItem("currentView", view);
  _setCurrentView(view);
};

  // Scroll behavior
  const mainContentRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = () => {
    if (mainContentRef.current) {
      setShowScrollTop(mainContentRef.current.scrollTop > 200);
    }
  };

  const scrollToTop = () => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const content = mainContentRef.current;
    if (content) {
      content.addEventListener("scroll", handleScroll);
      return () => content.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Render views
  const renderComponent = (view) => {
    switch (view) {
      case "Dashboard": return <Dashboard setCurrentView={setCurrentView} />;
      case "VisaForm": return <VisaForm setCurrentView={setCurrentView} />;
      case "ViewButtons": return <ViewButtons setCurrentView={setCurrentView} />;
      case "CoverVisa": return <CoverVisa setCurrentView={setCurrentView} />;
      case "RegularVisaForm": return <RegularVisaForm setCurrentView={setCurrentView} />;
      case "ManageMarketing": return <ManageMarketing setCurrentView={setCurrentView} />;
      case "BrandApprovalForm": return <BrandApprovalForm setCurrentView={setCurrentView} />;
      case "ClaimsStatus": return <ClaimsStatus setCurrentView={setCurrentView} />;
      case "RentalSummaryTables": return <RentalSummaryTables setCurrentView={setCurrentView} />;
      case "UserManagement": return <UserManagement setCurrentView={setCurrentView} />;
      case "BrandSelector": return <BrandSelector setCurrentView={setCurrentView} />;
      case "Activities": return <Activities setCurrentView={setCurrentView} />;
      // case "References": return <References setCurrentView={setCurrentView} />;
      case "RecordsPage": return <RecordsPage setCurrentView={setCurrentView} />;
      case "Calendar": return <Calendar setCurrentView={setCurrentView} />;
      case "ApprovalHistoryTable": return <ApprovalHistoryTable setCurrentView={setCurrentView} />;
      case "ApprovalList": return <ApprovalList setCurrentView={setCurrentView} />;
      case "Progress": return <Progress setCurrentView={setCurrentView} />;
      case "View": return <View setCurrentView={setCurrentView} />;

      case "View_Regular": return <View_Regular setCurrentView={setCurrentView} />;
      case "ViewCorporate": return <ViewCorporate setCurrentView={setCurrentView} />;

      case "SettingsPage": return <SettingsPage setCurrentView={setCurrentView} />;


      case "RegularPwpUploadForm": return <RegularPwpUploadForm setCurrentView={setCurrentView} />;
      case "References": return <References setCurrentView={setCurrentView} />;

      
      case "SettingProfileUpdate": return <SettingProfileUpdate setCurrentView={setCurrentView} />;
      case "AnnouncementForm": return <AnnouncementForm setCurrentView={setCurrentView} />;
      case "RolePermissionForm": return <RolePermissionForm setCurrentView={setCurrentView} />;
      case "AddendumCancellation": return <AddendumCancellation setCurrentView={setCurrentView} />;
      case "RentalsForm": return <RentalsForm setCurrentView={setCurrentView} />;
      case "Liecense": return <Liecense setCurrentView={setCurrentView} />;
      case "ClaimsStatusUpload": return <ClaimsStatusUpload setCurrentView={setCurrentView} />;


      case "ApprovalsPage": return <ApprovalsPage setCurrentView={setCurrentView} />;
      case "UserPage":
        return <UserPage setCurrentView={setCurrentView} userId={loggedInUser.id} profile={loggedInUser} />;

      default: return <Dashboard setCurrentView={setCurrentView} />;


    }
  };

  // If user not logged in, show login
  if (!loggedInUser) {
    return (
      <LoginPage setLoggedInUser={setLoggedInUser} setCurrentView={setCurrentView} />

    );
  }

  // Main App Layout
  return (
    <div className="app-wrapper" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
        setCurrentView={setCurrentView}
        setLoggedIn={() => setLoggedInUser(null)}
        user={loggedInUser}
      />


      <div
        className="main-content"
        style={{
          flexGrow: 1,
          marginLeft: sidebarExpanded ? "260px" : "0px",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          position: "relative",
          transition: "margin-left 0.3s ease",
        }}
      >
        <Header
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          setCurrentView={setCurrentView}
        />

        <div
          className="main-content-container"
          ref={mainContentRef}
          style={{ flexGrow: 1, overflowY: "auto", width: "100%", maxWidth: "100vw", position: "relative" }}
        >
          {renderComponent(currentView)}



        </div>
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            style={{
              position: "fixed",
              bottom: "20px",
              left: "20px",
              zIndex: 1000,
              backgroundColor: "#007bff",
              border: "none",
              borderRadius: "50%",
              width: "50px",
              height: "50px",
              color: "white",
              fontSize: "24px",
              cursor: "pointer",
              display: window.innerWidth <= 768 ? "flex" : "none",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}
            aria-label="Scroll to top"
            title="Scroll to top"
          >
            <i className="fas fa-chevron-up"></i>
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
