import React, { useState, useEffect } from "react";
import "./Sidebar.css";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { supabase } from "../supabaseClient";
import logo from '../Assets/sssss.png';
import NotFoundPage from "../Nofound/NotFoundPage";

function Sidebar({ sidebarExpanded, setSidebarExpanded, setCurrentView, setLoggedIn, user, loggedIn }) {
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [localUser, setLocalUser] = useState({});
    const [avatar, setAvatar] = useState(null);
    const [rolePermissions, setRolePermissions] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [noPermissionsData, setNoPermissionsData] = useState(false);

    useEffect(() => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            setSidebarExpanded(false);
        }
    }, [loggedIn, setSidebarExpanded]);

    // ✅ Single function to fetch role permissions
    const fetchRolePermissions = async (permissionRoleCode) => {
        console.log("📌 Fetching permissions for code:", permissionRoleCode);

        if (!permissionRoleCode) {
            console.warn("⚠️ No PermissionRole provided");
            setRolePermissions({});
            return;
        }

        try {
            // Use maybeSingle() to handle empty results gracefully
            const { data: roleData, error: roleError } = await supabase
                .from('user_role')
                .select('role')
                .eq('code', Number(permissionRoleCode))
                .maybeSingle();

            if (roleError) {
                console.error("❌ Error fetching role:", roleError);
                setRolePermissions({});
                setNoPermissionsData(true);
                return;
            }

            if (!roleData) {
                console.warn("⚠️ No role found in user_role table for code:", permissionRoleCode);
                setRolePermissions({});
                setNoPermissionsData(true);
                return;
            }

            const roleName = roleData.role;
            console.log("✅ Found role name:", roleName);

            const { data: permissionsData, error: permissionsError } = await supabase
                .from('RolePermissions')
                .select('permission, allowed')
                .eq('role_name', roleName);

            if (permissionsError) {
                console.error("❌ Error fetching permissions:", permissionsError);
                setRolePermissions({});
                setNoPermissionsData(true);
                return;
            }

            if (!permissionsData || permissionsData.length === 0) {
                console.warn("⚠️ No permissions found for role:", roleName);
                setRolePermissions({});
                setNoPermissionsData(true);
                return;
            }

            const permissionsObj = {};
            permissionsData.forEach(({ permission, allowed }) => {
                permissionsObj[permission] = allowed === true;
            });

            console.log("✅ Permissions loaded:", permissionsObj);
            setRolePermissions(permissionsObj);
            setNoPermissionsData(false);
        } catch (error) {
            console.error("❌ Error in fetchRolePermissions:", error);
            setRolePermissions({});
            setNoPermissionsData(true);
        }
    };

    // ✅ Single useEffect for fetching user and permissions
    useEffect(() => {
        const fetchUserAndPermissions = async () => {
            // ALWAYS fetch fresh data from Supabase first to avoid stale localStorage data
            if (user?.id) {
                try {
                    const userIdNum = Number(user.id);
                    if (isNaN(userIdNum)) {
                        throw new Error("User ID is not a valid number");
                    }

                    console.log("🔄 Fetching fresh user data for UserID:", userIdNum);

                    let { data, error } = await supabase
                        .from('Account_Users')
                        .select('*')
                        .eq('UserID', userIdNum)
                        .single();

                    if (error) {
                        if (error.code === 'PGRST116' || error.message.includes('0 rows')) {
                            console.log("⚠️ No user found by UserID, trying by email:", user.email);
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
                        };

                        console.log("✅ Fresh user data from Supabase:", updatedUser);
                        
                        setLocalUser(updatedUser);
                        setAvatar(updatedUser.profilePicture);
                        // Update localStorage with fresh data
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        
                        if (updatedUser.PermissionRole) {
                            await fetchRolePermissions(updatedUser.PermissionRole);
                        }
                    }
                } catch (error) {
                    console.error("❌ Error fetching user data from Supabase:", error);
                    // Fallback to localStorage only if Supabase fails
                    const storedUser = JSON.parse(localStorage.getItem('user'));
                    if (storedUser) {
                        console.log("⚠️ Using localStorage fallback data");
                        setLocalUser(storedUser);
                        setAvatar(storedUser.profilePicture || '');
                        if (storedUser.PermissionRole) {
                            await fetchRolePermissions(storedUser.PermissionRole);
                        }
                    }
                }
            } else {
                // If no user.id, check localStorage
                const storedUser = JSON.parse(localStorage.getItem('user'));
                if (storedUser) {
                    console.log("📦 Using stored user data from localStorage");
                    setLocalUser(storedUser);
                    setAvatar(storedUser.profilePicture || '');
                    if (storedUser.PermissionRole) {
                        await fetchRolePermissions(storedUser.PermissionRole);
                    }
                }
            }
        };

        fetchUserAndPermissions();
    }, [user]); // Only depends on user prop

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
                    setCurrentView('UserPage');
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
                    setCurrentView('SettingProfileUpdate');
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
                    setCurrentView('SettingsPage');
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
        if (window.innerWidth <= 768) {
            setSidebarExpanded(false);
        }
    }

    const toggleDropdown = (key) => {
        setActiveDropdown((prev) => (prev === key ? null : key));
    };

    function handleViewChange(view) {
        setCurrentView(view);
        if (window.innerWidth <= 768) {
            setSidebarExpanded(false);
        }
    }

    function formatName(fullName) {
        if (!fullName) return 'Guest';
        const parts = fullName.trim().split(' ');
        if (parts.length === 1) {
            return parts[0];
        } else if (parts.length === 2) {
            return `${parts[0]} ${parts[1][0]}.`;
        } else {
            const firstName = parts[0];
            const initials = parts.slice(1).map(name => name[0] + '.').join(' ');
            return `${firstName} ${initials}`;
        }
    }

    const hasPermissionForView = (view) => {
        return !!rolePermissions[view];
    };

    const menuItems = [
        {
            key: "dashboard",
            icon: "fa fa-tachometer-alt",
            title: "Dashboards",
            badge: <span className="badge badge-pill badge-warning">New</span>,
            submenu: [
                { title: "Dashboard", view: "Dashboard" },
                { title: "Progress", view: "Progress" },
                { title: "Budget Status", view: "BudgetDashboard" },
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
                { title: "Claims PWP", view: "Claims_pwp" },
            ],
        },
        {
            key: "visa_approvals",
            icon: "fa fa-chart-line",
            title: "Marketing Approvals",
            submenu: [
                { title: "Approvals", view: "ApprovalsPage" },
                { title: "Approvals History", view: "ApprovalHistoryTable" },
            ],
        },
        {
            key: "maintenance",
            icon: "fa fa-wrench",
            title: "Maintenance",
            submenu: [
                { title: "References", view: "References" },
                { title: "User Management", view: "UserManagement" },
            ],
        },
        {
            key: "records_reports",
            icon: "fa fa-file-alt",
            title: "Records and Reports",
            submenu: [
                { title: "View Records", view: "RecordsPage" },
                { title: "Claims Records List", view: "ClaimsRecords" },
            ],
        },
    ];

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

    if (noPermissionsData) {
        return <NotFoundPage />;
    }

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
                                    onMouseDown={e => e.preventDefault()}
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
                                const allowedSubmenu = submenu.filter(item => item.view && hasPermissionForView(item.view));
                                const isTopLevelAllowed = view ? hasPermissionForView(view) : false;

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
                                    aria-label="Go to Calendar"
                                    style={{
                                        pointerEvents: hasPermissionForView("Calendar") ? "auto" : "none",
                                        opacity: hasPermissionForView("Calendar") ? 1 : 0.5,
                                    }}
                                >
                                    <i className="fa fa-calendar"></i>
                                    <span>Calendar</span>
                                </a>
                            </li>
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