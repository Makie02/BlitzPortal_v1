import React, { useState, useEffect } from "react";
import CustomLoader from "./CustomLoader";
import "./ViewButtons.css";
import { supabase } from "../supabaseClient"; // ✅ make sure to import your Supabase client

const ViewButtons = ({ setCurrentView, currentView }) => {
    const [loadingView, setLoadingView] = useState(null);
    const [permissions, setPermissions] = useState({
        Create_Budget: false,
        View_Budget: false,
        Regular: false,
        Pre_Regular: false,
    });

    const [loggedInUser, setLoggedInUser] = useState(() => {
        const userData = localStorage.getItem("loggedInUser");
        return userData ? JSON.parse(userData) : null;
    });

    // Fetch permissions when loggedInUser is available
    useEffect(() => {
        const fetchPermissions = async () => {
            if (!loggedInUser?.id) return;

            const { data, error } = await supabase
                .from("Account_Users")
                .select("Create_Budget, View_Budget, Regular, Pre_Regular")
                .eq("id", loggedInUser.id)
                .single();

            if (error) {
                console.error("Error fetching user permissions:", error);
                return;
            }

            if (data) {
                setPermissions({
                    Create_Budget: data.Create_Budget === true,
                    View_Budget: data.View_Budget === true,
                    Regular: data.Regular === true,
                    Pre_Regular: data.Pre_Regular === true,
                });
            }
        };

        fetchPermissions();
    }, [loggedInUser]);

    const handleClick = (view) => {
        setLoadingView(view);
        setTimeout(() => {
            setCurrentView(view);
            setLoadingView(null);
        }, 1500);
    };

    // All buttons with conditional display based on permissions
    const buttons = [
        permissions.Create_Budget && {
            label: "CREATE BUDGET",
            view: "CoverVisa",
            className: "twitter-card",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24">
                    <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3zM12 20c-3.31-1.06-6-5.17-6-9V6.26l6-2.25 6 2.25V11c0 3.83-2.69 7.94-6 9z" />
                </svg>
            ),
        },
        permissions.View_Budget && {
            label: "VIEW BUDGET",
            view: "Total",
            className: "twitter-card",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24">
                    <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3zM12 20c-3.31-1.06-6-5.17-6-9V6.26l6-2.25 6 2.25V11c0 3.83-2.69 7.94-6 9z" />
                </svg>
            ),
        },
        permissions.Regular && {
            label: "REGULAR PWP",
            view: "RegularVisaForm",
            className: "facebook-card",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24">
                    <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm1 17.93V19h-2v.93A8.12 8.12 0 014.07 13H5v-2H4.07A8.12 8.12 0 0111 4.07V5h2v-.93A8.12 8.12 0 0119.93 11H19v2h.93A8.12 8.12 0 0113 19.93z" />
                </svg>
            ),
        },
        permissions.Pre_Regular && {
            label: "PRE - Upload Regular PWP",
            view: "RegularPwpUploadForm",
            className: "Upload-card",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24">
                    <path d="M19 9h-4V3H9v6H5l7 8 7-8zM5 18v2h14v-2H5z" />
                </svg>
            ),
        },
    ].filter(Boolean); // Remove false/null items

    return (
        <>
            {loadingView && <CustomLoader />}

            <div className="view-buttons-wrapper">
                <h3 className="section-title">Choose Marketing Type</h3>
                <div className="cards">
                    {buttons.map(({ label, view, className, icon }) => (
                        <div
                            key={view}
                            className={`card-container ${className} ${currentView === view ? "active-card" : ""}`}
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
        </>
    );
};

export default ViewButtons;
