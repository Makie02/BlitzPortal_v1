import React, { useState, useEffect } from "react";
import "./Sidebar.css";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { supabase } from "../supabaseClient";
import logo from '../Assets/sssss.png';

function Sidebar({ sidebarExpanded, setSidebarExpanded, setCurrentView, setLoggedIn, user, loggedIn }) {
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [IsOpen, setIsOpen] = useState(null);

    useEffect(() => {
        const isMobile = window.innerWidth <= 768; // adjust breakpoint if you want
        if (isMobile) {
            setSidebarExpanded(false);
        }
    }, [loggedIn, setSidebarExpanded]); // runs when loggedIn changes or component mounts

    const tooltipContent = (
        <div style={{
            minWidth: '160px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '8px 0',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}>
            <a
                href="#!"
                onClick={(e) => {
                    e.preventDefault();
                    setCurrentView('UserPage');  // call your state update here
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 20px',
                    color: '#333',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'background-color 0.2s',
                    gap: '8px',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <i className="fa fa-user" aria-hidden="true"></i>
                Profile Home
            </a>

            <a
                href="#!"
                onClick={(e) => {
                    e.preventDefault();
                    setCurrentView('SettingProfileUpdate'); // or whatever view you want
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 20px',
                    color: '#333',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'background-color 0.2s',
                    gap: '8px',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <i className="fa fa-cog" aria-hidden="true"></i>
                Profile Setting
            </a>

            <a
                href="#!"
                onClick={(e) => {
                    e.preventDefault();
                    setCurrentView('SettingsPage'); // or whatever view you want
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 20px',
                    color: '#333',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'background-color 0.2s',
                    gap: '8px',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <i className="fa fa-cog" aria-hidden="true"></i>
                Settings
            </a>


        </div>
    );

    function handleLinkClick(view, title) {
        setCurrentView(view);
        setActiveDropdown(null);

        // Close sidebar on mobile:
        if (window.innerWidth <= 768) {
            setSidebarExpanded(false);
        }
    }

    const toggleDropdown = (key) => {
        setActiveDropdown((prev) => (prev === key ? null : key));
    };

    function handleViewChange(view) {
        setCurrentView(view);

        // Close sidebar on mobile:
        if (window.innerWidth <= 768) {
            setSidebarExpanded(false);
        }
    }
    const [localUser, setLocalUser] = useState({});
    const [avatar, setAvatar] = useState(null);  // local avatar state
    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) {
            setLocalUser(storedUser);
            setAvatar(storedUser.profilePicture || '');
        }
        if (user?.id) {
            const fetchUserProfile = async () => {
                try {
                    const userIdNum = Number(user.id);
                    if (isNaN(userIdNum)) {
                        throw new Error("User ID is not a valid number");
                    }

                    // Try to get by UserID first
                    let { data, error } = await supabase
                        .from('Account_Users')
                        .select('*')
                        .eq('UserID', userIdNum)
                        .single();

                    if (error) {
                        // If no rows found or error, try by email as fallback
                        if (error.code === 'PGRST116' || error.message.includes('0 rows')) {
                            ({ data, error } = await supabase
                                .from('Account_Users')
                                .select('*')
                                .eq('email', user.email)
                                .single());
                        }

                        if (error) throw error;
                    }

                    if (data) {
                        const updatedUser = {
                            id: data.id,
                            name: data.name || user.name,
                            PermissionRole: data.PermissionRole || user.PermissionRole,
                            role: data.role || user.role,
                            profilePicture: data.profilePicture || '',
                            // add other fields as needed
                        };

                        setLocalUser(updatedUser);
                        setAvatar(updatedUser.profilePicture);
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                    }
                } catch (error) {
                    console.error("Error fetching user data from Supabase:", error);
                }
            };

            fetchUserProfile();
        }
    }, [user]);
    function formatName(fullName) {
        if (!fullName) return 'Guest';

        const parts = fullName.trim().split(' ');

        if (parts.length === 1) {
            // Just one name, return as is
            return parts[0];
        } else if (parts.length === 2) {
            // Two parts: show first name + first initial of last name with a dot
            return `${parts[0]} ${parts[1][0]}.`;
        } else {
            // More than two parts, show first name + initials of the rest with dots
            const firstName = parts[0];
            const initials = parts.slice(1).map(name => name[0] + '.').join(' ');
            return `${firstName} ${initials}`;
        }
    }
    const [rolePermissions, setRolePermissions] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // ✅ Fetch permissions based on PermissionRole
    useEffect(() => {
        const fetchRolePermissions = async () => {
            if (!localUser?.PermissionRole) return;

            try {
                // Step 1: Get the role name from user_role table
                const { data: roleData, error: roleError } = await supabase
                    .from('user_role')
                    .select('role')
                    .eq('code', localUser.PermissionRole)
                    .single();

                if (roleError) throw roleError;

                const roleName = roleData?.role;
                if (!roleName) {
                    console.warn("⚠️ No role name found for code:", localUser.PermissionRole);
                    setRolePermissions({});
                    return;
                }

                // Step 2: Get permissions based on role name
                const { data: permissionsData, error: permissionsError } = await supabase
                    .from('RolePermissions')
                    .select('permission, allowed')
                    .eq('role_name', roleName);

                if (permissionsError) throw permissionsError;

                const permissionsObj = {};
                permissionsData.forEach(({ permission, allowed }) => {
                    permissionsObj[permission] = allowed === true;
                });

                setRolePermissions(permissionsObj);
            } catch (error) {
                console.error("❌ Error fetching role or permissions:", error);
                setRolePermissions({});
            }
        };

        fetchRolePermissions();
    }, [localUser?.PermissionRole]);

    const hasPermissionForView = (view) => {
        const allowed = !!rolePermissions[view];
        // console.log(`🔍 Checking permission for view "${view}":`, allowed);
        return allowed;
    };
    // ✅ Check if the current view is allowed

    {
        hasPermissionForView("ManageMarketing") && (
            <li>
                <a
                    href="#!"
                    onClick={(e) => {
                        e.preventDefault();
                        handleViewChange("ManageMarketing");
                    }}
                    aria-label="Go to Manage Marketing"
                >
                    <i className="fa fa-book"></i>
                    <span>Manage Marketing</span>
                </a>
            </li>
        )
    }

    {
        hasPermissionForView("Calendar") && (
            <li>
                <a
                    href="#!"
                    onClick={(e) => {
                        e.preventDefault();
                        handleViewChange("Calendar");
                    }}
                    aria-label="Go to Manage Visa"
                >
                    <i className="fa fa-calendar"></i>
                    <span>Calendar</span>
                </a>
            </li>
        )
    }

    {
        hasPermissionForView("AnnouncementForm") && (
            <li>
                <a
                    href="#!"
                    onClick={(e) => {
                        e.preventDefault();
                        handleViewChange("AnnouncementForm");
                    }}
                    aria-label="Go to Announcement"
                >
                    <i className="fa fa-book"></i>
                    <span>Announcement</span>
                </a>
            </li>
        )
    }



    // ✅ Menu structure
    const menuItems = [
        {
            key: "dashboard",
            icon: "fa fa-tachometer-alt",
            title: "Dashboards",
            badge: <span className="badge badge-pill badge-warning">New</span>,
            submenu: [
                { title: "Dashboard", view: "Dashboard" },
                { title: "Progress", view: "Progress" },
            ],
        },
        {
            key: "visa",
            icon: "fa fa-passport",
            title: "Create Marketing",
            submenu: [
                { label: "Marketing Applications", view: "ViewButtons" },
                { title: "Addendum", view: "AddendumCancellation" },
            ],
        },
        {
            key: "claims",
            icon: "fa fa-file-alt",
            title: "Claims",
            submenu: [
                { title: "Claims Status", view: "ClaimsStatusUpload" },
                // { title: "Rentals", view: "RentalsForm" },


            ],
        },
        {
            key: "visa_approvals",
            icon: "fa fa-chart-line",
            title: "Marketing Approvals",
            submenu: [
                { title: "Approvals", view: "ApprovalsPage" },
                { title: "Approvals History", view: "ApprovalHistoryTable" },
                { title: "Claim Status" }, // No view? Will be ignored.
            ],
        },
        {
            key: "maintenance",
            icon: "fa fa-wrench",
            title: "Maintenance",
            submenu: [
                { title: "References", view: "References" },
                { title: "User Management", view: "UserManagement" },
                { title: "Category", view: "BrandSelector" },
                // { label: "Brand Approval Plan", view: "BrandApprovalForm" },
                // { title: "Cost Details", view: "Activities" },
            ],
        },
        {
            key: "records_reports",
            icon: "fa fa-file-alt",
            title: "Records and Reports",
            submenu: [
                { title: "References" }, // No view
                { title: "View Records", view: "RecordsPage" },
                { title: "Approved  List", view: "ApprovalList" },
            ],
        },
    ];

    // ✅ Filter based on permissions
    const filteredMenuItems = menuItems
        .map(menu => {
            // Filter submenu items that have a view and the user has permission for it
            const filteredSubmenu = (menu.submenu || []).filter(
                sub => sub.view && hasPermissionForView(sub.view)
            );

            // Check if the top-level menu item itself has a view and permission
            const isTopLevelAllowed = menu.view && hasPermissionForView(menu.view);

            // Only keep this menu section if it has allowed submenus or allowed top-level view
            if (filteredSubmenu.length > 0 || isTopLevelAllowed) {
                return {
                    ...menu,
                    submenu: filteredSubmenu.length > 0 ? filteredSubmenu : undefined,
                };
            }

            // Otherwise, exclude this section
            return null;
        })
        .filter(Boolean); // remove nulls


    // console.log("✅ Final Filtered Menu Items:", filteredMenuItems);

    // ✅ Search filtering remains unchanged
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const query = searchQuery.trim().toLowerCase();
        const results = [];

        menuItems.forEach(menu => {
            if (menu.title.toLowerCase().includes(query) && menu.view && hasPermissionForView(menu.view)) {
                results.push({ label: menu.title, view: menu.view, key: menu.key, isSubmenu: false });
            }

            (menu.submenu || []).forEach(sub => {
                const labelOrTitle = (sub.label || sub.title || "").toLowerCase();
                if (labelOrTitle.includes(query) && sub.view && hasPermissionForView(sub.view)) {
                    results.push({ label: sub.label || sub.title, view: sub.view, key: menu.key, isSubmenu: true });
                }
            });
        });

        setSearchResults(results);
    }, [searchQuery, rolePermissions]);


    const onSearchResultClick = (view) => {
        setCurrentView(view);
        setSearchQuery('');
        setSearchResults([]);
        setActiveDropdown(null);
    };
    return (
        <nav
            id="sidebar"
            className={`sidebar-wrapper ${sidebarExpanded ? "" : ""}`}
            style={{ left: sidebarExpanded ? "0" : "-320px" }}
        >
            <div className="sidebar-content">
                <div className="sidebar-brand enhanced-brand">
                    <img src={logo} alt="Logo" className="logs" />
                </div>
                <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="user-pic">
                        <div
                            onClick={() => setCurrentView('UserPage')}
                            style={{ cursor: 'pointer', display: 'inline-block' }}
                            title="Go to Profile Settings"
                        >
                            <img
                                src={avatar && avatar.trim() !== '' ? avatar : 'https://i.pravatar.cc/50'}
                                alt="User Avatar"
                                style={{ width: '50px', height: '50px', borderRadius: '50%' }}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://i.pravatar.cc/50';
                                }}
                            />

                        </div>
                    </div>
                    <div className="user-info" style={{ color: '#fff' }}>
                        <span className="user-name">
                            <strong>{formatName(user?.name)}</strong>
                        </span>


                        <br />
                        <span className="user-id" style={{ fontSize: '0.8rem', color: '#bbb' }}>
                            ID: {user?.UserID || 'N/A'}
                        </span>
                        <br />
                        <span className="user-status">
                            <i className="fa fa-circle" style={{ color: '#4caf50', marginRight: '5px' }}></i> Online
                        </span>
                    </div>
                </div>
                <div className="sidebar-search" style={{ position: "relative" }}>
                    <div className="search-bar-wrapper">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoComplete="off"
                        />
                        <span className="search-icon">🔍</span>
                    </div>
                    {/* Search results dropdown */}
                    {searchResults.length > 0 && (
                        <ul
                            style={{
                                position: "absolute",
                                top: "60px",
                                left: 0,
                                right: 0,
                                maxHeight: "200px",
                                overflowY: "auto",
                                backgroundColor: "#fff",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                                borderRadius: "10px",
                                zIndex: 1000,
                                listStyle: "none",
                                margin: 0,
                                padding: 0,
                            }}
                        >
                            {searchResults.map((result, i) => (
                                <li
                                    key={i}
                                    style={{
                                        padding: "10px 15px",
                                        cursor: "pointer",
                                        borderBottom: "1px solid #eee",
                                        fontWeight: result.isSubmenu ? 'normal' : '600',
                                        backgroundColor: 'white',
                                    }}
                                    onClick={() => onSearchResultClick(result.view)}
                                    onMouseDown={e => e.preventDefault()} // prevent input losing focus on click
                                >
                                    {result.label}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="sidebar-scrollable-menu">
                    <div className="sidebar-menu">
                        <ul>
                            <li className="header-menu">
                                <span>General</span>
                            </li>
                            {menuItems.map(({ key, icon, title, badge, submenu = [], view }) => {
                                // Filter submenu items by permissions
                                const allowedSubmenu = submenu.filter(item => item.view && hasPermissionForView(item.view));

                                // Check if top-level item is allowed (if it has a view)
                                const isTopLevelAllowed = view ? hasPermissionForView(view) : false;

                                // If neither top-level nor submenu items are allowed, skip rendering
                                if (!isTopLevelAllowed && allowedSubmenu.length === 0) return null;

                                const isActive = activeDropdown === key;

                                return (
                                    <li key={key} className={`sidebar-dropdown ${isActive ? "active" : ""}`}>
                                        <a
                                            href="#!"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (view && isTopLevelAllowed) {
                                                    handleLinkClick(view, title);
                                                } else {
                                                    toggleDropdown(key);
                                                }
                                            }}
                                        >
                                            <i className={icon || "fa fa-folder"} style={{ marginRight: "8px" }}></i>
                                            <span>{title}</span>
                                            {badge && <span className="badge badge-pill ml-2">{badge}</span>}
                                        </a>

                                        {allowedSubmenu.length > 0 && (
                                            <div className={`sidebar-submenu ${isActive ? "show" : ""}`}>
                                                <ul>
                                                    {allowedSubmenu.map((item, i) => {
                                                        const label = item.label || item.title;
                                                        return (
                                                            <li key={i}>
                                                                <a
                                                                    href="#!"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        if (item.view) {
                                                                            handleLinkClick(item.view, label);
                                                                        }
                                                                    }}
                                                                >
                                                                    {label}
                                                                    {item.badge && (
                                                                        <span className="badge badge-pill ml-2">{item.badge}</span>
                                                                    )}
                                                                </a>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}

                            <li className="header-menu">
                                <span>Extra</span>
                            </li>
                            <li>
                                <a
                                    href="#!"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (hasPermissionForView("ManageMarketing")) {
                                            handleViewChange("ManageMarketing");
                                        }
                                    }}
                                    aria-label="Go to Manage Marketing"
                                    style={{
                                        pointerEvents: hasPermissionForView("ManageMarketing") ? "auto" : "none",
                                        opacity: hasPermissionForView("ManageMarketing") ? 1 : 0.5,
                                    }}
                                >
                                    <i className="fa fa-book"></i>
                                    <span>Manage Marketing</span>
                                </a>
                            </li>

                            <li>
                                <a
                                    href="#!"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (hasPermissionForView("Calendar")) {
                                            handleViewChange("Calendar");
                                        }
                                    }}
                                    aria-label="Go to Manage  Calendar"
                                    style={{
                                        pointerEvents: hasPermissionForView("Calendar") ? "auto" : "none",
                                        opacity: hasPermissionForView("Calendar") ? 1 : 0.5,
                                    }}
                                >
                                    <i className="fa fa-calendar"></i>
                                    <span>Calendar</span>
                                </a>
                            </li>
                            {/* <li>
                                    <a
                                        href="#!"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (hasPermissionForView("Calendar")) {
                                                handleViewChange("Liecense");
                                            }
                                        }}
                                        aria-label="Go to Manage  Calendar"
                                        style={{
                                            pointerEvents: hasPermissionForView("Calendar") ? "auto" : "none",
                                            opacity: hasPermissionForView("Calendar") ? 1 : 0.5,
                                        }}
                                    >
                                        <i className="fa fa-calendar"></i>
                                        <span>Liecense</span>
                                    </a>
                                </li> */}




                            <li>
                                <a
                                    href="#!"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (hasPermissionForView("AnnouncementForm")) {
                                            handleViewChange("AnnouncementForm");
                                        }
                                    }}
                                    aria-label="Go to Announcement"
                                    style={{
                                        pointerEvents: hasPermissionForView("AnnouncementForm") ? "auto" : "none",
                                        opacity: hasPermissionForView("AnnouncementForm") ? 1 : 0.5,
                                    }}
                                >
                                    <i className="fa fa-book"></i>
                                    <span>Announcement</span>
                                </a>
                            </li>

                        </ul>
                        <div className="sidebar-footer">


                            <Tippy
                                interactive={true}
                                placement="bottom-end"
                                trigger="click"
                                animation="shift-away"
                                arrow={true}
                                content={tooltipContent}

                            >
                                <a href="#!" style={{ position: 'relative', display: 'inline-block', color: '#ffff', fontSize: '18px' }}>
                                    <i className="fa fa-cog"></i>
                                    <span
                                        className="badge-sonar"
                                        style={{
                                            position: 'absolute',
                                            top: '-4px',
                                            right: '50px',
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: '#ff4d4f',
                                            boxShadow: '0 0 8px #ff4d4f',
                                        }}
                                    ></span>
                                </a>
                            </Tippy>
                            <Tippy content="Logout">
                                <a
                                    href="#!"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        localStorage.removeItem("loggedIn");
                                        localStorage.removeItem("currentView");
                                        setLoggedIn(false);
                                    }}
                                >
                                    <i className="fa fa-power-off"></i>
                                </a>
                            </Tippy>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
export default Sidebar;
