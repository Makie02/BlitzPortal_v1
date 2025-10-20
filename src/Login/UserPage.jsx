import React, { useEffect, useState } from 'react';
import defaultCover from '../Assets/bg.jpg';
import { supabase } from '../supabaseClient';

const TABS = [
    { key: "distributor", label: "Distributor" },
    { key: 'approvers', label: 'Approvers' },
    { key: 'salesDivision', label: 'Sales Division' },

];


const renderValue = (value) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
        return <p><i>No data available.</i></p>;
    }

    if (Array.isArray(value)) {
        // Filter out items where both are false
        const filtered = value.filter(item => item.IncludeBUHead || item.IncludeVPSales);

        if (filtered.length === 0) {
            return <p><i>No data available.</i></p>;
        }

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {filtered.map((item, idx) => (
                    <div
                        key={idx}
                        style={{
                            border: "1px solid #ddd",
                            padding: "10px",
                            borderRadius: "6px",
                            backgroundColor: "#f8f8f8"
                        }}
                    >
                        <p><strong>Division:</strong> {item.Division}</p>
                        {item.IncludeBUHead && (
                            <p><strong>Include BU Head:</strong> Yes</p>
                        )}
                        {item.IncludeVPSales && (
                            <p><strong>Include VP Sales:</strong> Yes</p>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // Fallback for non-array values
    return <p>{value.toString()}</p>;
};



const UserPage = ({ user, setCurrentView }) => {



    // 🔹 State for distributor data
    const [UserID, setUserId] = useState(null);
    const [name, setname] = useState("");
    const [distributorData, setDistributorData] = useState([]);
    const [loadingDistributor, setLoadingDistributor] = useState(false);
    const [errorDistributor, setErrorDistributor] = useState(null);

    // ✅ Load logged-in user info
    useEffect(() => {
        const storedUser = localStorage.getItem("loggedInUser");
        if (storedUser) {
            try {
                const userObj = JSON.parse(storedUser);
                const extractedUserId = userObj.UserID || "Unknown ID";
                const userName = userObj.name || "User";
                setUserId(extractedUserId);
                setname(userName);
                console.log("[DEBUG] Logged in user info:");
                console.log("UserID:", extractedUserId);
                console.log("User Name:", userName);
            } catch (err) {
                console.error("[ERROR] Failed to parse loggedInUser:", err);
                setname("User");
            }
        } else {
            console.warn("[DEBUG] No loggedInUser found in localStorage.");
        }
    }, []);

    // ✅ Fetch distributors for the logged-in user (by agent_code)
    useEffect(() => {
        const fetchDistributorsByAgent = async () => {
            if (!UserID || UserID === "Unknown ID") {
                console.warn("⚠️ No UserID found — skipping fetch.");
                return;
            }

            console.log("🔍 Fetching distributors for agent_code:", UserID);
            setLoadingDistributor(true);
            setErrorDistributor(null);

            try {
                const { data, error } = await supabase
                    .from("distributors")
                    .select("id, code, name, description, agent_code, created_at");

                if (error) throw error;
                if (!data || data.length === 0) {
                    console.warn("⚠️ No distributors found.");
                    setDistributorData([]);
                    return;
                }

                // ✅ Match distributors where their agent_code contains this UserID
                const matchedDistributors = data.filter((d) => {
                    if (!d.agent_code) return false;
                    const agentCodes = d.agent_code
                        .split(",")
                        .map((c) => c.trim());
                    return agentCodes.includes(String(UserID));
                });

                if (matchedDistributors.length > 0) {
                    console.log("✅ Matching distributors:", matchedDistributors);
                    setDistributorData(matchedDistributors);
                } else {
                    console.log("⚠️ No matching distributors for agent_code:", UserID);
                    setDistributorData([]);
                }
            } catch (err) {
                console.error("❌ Fetch error:", err.message);
                setErrorDistributor(err.message);
            } finally {
                setLoadingDistributor(false);
            }
        };

        fetchDistributorsByAgent();
    }, [UserID]);

    // ✅ Render distributors
    const renderDistributor = () => {
        if (loadingDistributor)
            return <p style={{ textAlign: "center", color: "#555" }}>Loading distributors...</p>;
        if (errorDistributor)
            return <p style={{ color: "red", textAlign: "center" }}>Error: {errorDistributor}</p>;

        if (!distributorData || distributorData.length === 0)
            return <p style={{ textAlign: "center", fontStyle: "italic" }}>No distributors assigned.</p>;

        return (
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                    gap: "16px",
                    padding: "20px",
                }}
            >
                {distributorData.map((dist) => (
                    <div
                        key={dist.id}
                        style={{
                            background: "white",
                            borderRadius: "12px",
                            boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                            padding: "20px",
                            border: "1px solid #eee",
                            transition: "transform 0.2s ease, box-shadow 0.2s ease",
                            cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-3px)";
                            e.currentTarget.style.boxShadow = "0 6px 14px rgba(0,0,0,0.1)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 10px rgba(0,0,0,0.08)";
                        }}
                    >
                        <div style={{ borderBottom: "1px solid #eee", paddingBottom: "8px", marginBottom: "10px" }}>
                            <h5 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#333" }}>
                                {dist.name || "Unnamed Distributor"}
                            </h5>
                            <p style={{ margin: "4px 0", color: "#888", fontSize: "14px" }}>
                                Code: <strong style={{ color: "#007bff" }}>{dist.code || "N/A"}</strong>
                            </p>
                        </div>

                        {dist.description && (
                            <p style={{ color: "#555", marginBottom: "10px" }}>
                                {dist.description}
                            </p>
                        )}

                        <p
                            style={{
                                fontSize: "12px",
                                color: "#999",
                                borderTop: "1px solid #f0f0f0",
                                paddingTop: "8px",
                            }}
                        >
                            Created at:{" "}
                            <span style={{ color: "#666" }}>
                                {dist.created_at ? new Date(dist.created_at).toLocaleString() : "N/A"}
                            </span>
                        </p>
                    </div>
                ))}
            </div>
        );
    };



    const [categoryData, setCategoryData] = useState([]);
    useEffect(() => {
        const fetchCategoryData = async () => {
            try {
                const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
                const currentUserName = (currentUser?.name || "").toLowerCase().trim();

                if (!currentUserName) {
                    console.warn("No logged in user found");
                    setCategoryData([]);
                    return;
                }

                const { data, error } = await supabase
                    .from('user_distributors')
                    .select('*')
                    .ilike('username', currentUserName); // case-insensitive match

                if (error) {
                    console.error('Error fetching category data:', error.message);
                    setCategoryData([]);
                } else {
                    setCategoryData(data || []);
                }
            } catch (err) {
                console.error('Unexpected error fetching category data:', err);
                setCategoryData([]);
            }
        };

        fetchCategoryData();
    }, []);

    const [profile, setProfile] = useState(null);
    const [coverUrl, setCoverUrl] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [activeTab, setActiveTab] = useState('category');
    const [animating, setAnimating] = useState(false);
    const [singleApprovalApprovers, setSingleApprovalApprovers] = useState([]);
    const [loadingSingleApprovals, setLoadingSingleApprovals] = useState(false);
    const [errorSingleApprovals, setErrorSingleApprovals] = useState(null);


    const fetchSingleApprovals = async (currentUserName) => {
        if (!currentUserName) return;

        setLoadingSingleApprovals(true);
        setErrorSingleApprovals(null);

        try {
            const { data, error } = await supabase
                .from('Single_Approval')
                .select('*')
                .ilike('username', currentUserName)
                .eq('allowed_to_approve', true);

            if (error) throw error;

            setSingleApprovalApprovers(data || []);
        } catch (err) {
            console.error("Error fetching Single_Approval data:", err.message);
            setErrorSingleApprovals(err.message);
            setSingleApprovalApprovers([]);
        } finally {
            setLoadingSingleApprovals(false);
        }
    };
    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
        if (activeTab === "approvers" && currentUser?.UserID) {
            fetchUserApprovers(currentUser.UserID);
        }
    }, [activeTab]);
    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
        const currentUserName = (currentUser?.name || "").toLowerCase().trim();

        if (activeTab === "approvers" && currentUser?.UserID && currentUserName) {
            fetchUserApprovers(currentUser.UserID);
            fetchSingleApprovals(currentUserName);
        }
    }, [activeTab]);


    const [tabData, setTabData] = useState({
        assignedPlan: null,
        brands: [],
        salesDivision: [],
        approvers: [],
    });

    const [showUploadButtons, setShowUploadButtons] = useState(false);
    const [newCoverFile, setNewCoverFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Local user state for upload logic
    const [localUser, setLocalUser] = useState({});
    const [avatar, setAvatar] = useState(null);

    // Load profile from localStorage on mount
    useEffect(() => {
        const storedProfile = localStorage.getItem('loggedInUser');
        if (storedProfile) {
            try {
                const parsed = JSON.parse(storedProfile);
                setProfile(parsed);
                // Set cover URL from Supabase storage path (public URL)
                if (parsed.coverPhoto) {
                    const publicUrl = supabase
                        .storage
                        .from('user-media')
                        .getPublicUrl(parsed.coverPhoto).data.publicUrl;
                    setCoverUrl(publicUrl);
                }
                // Set avatar from profilePicture path (public URL)
                if (parsed.profilePicture) {
                    const publicAvatarUrl = supabase
                        .storage
                        .from('user-media')
                        .getPublicUrl(parsed.profilePicture).data.publicUrl;
                    setAvatarUrl(publicAvatarUrl);
                }
            } catch {
                setProfile(null);
            }
        }
    }, []);

    // Load local user from localStorage and fetch updated info from Supabase


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
    // Fetch both User_Approvers and Single_Approval
    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
        const currentUserName = (currentUser?.name || "").toLowerCase().trim();
        const userId = currentUser?.UserID;

        if (activeTab === "approvers" && (userId || currentUserName)) {
            fetchUserApprovers(userId);
            fetchSingleApprovals(currentUserName);
        }
    }, [activeTab]);

    // Combined approvers renderer
    const renderApprovers = () => {
        if (loadingApprovers || loadingSingleApprovals)
            return <p>Loading approvers...</p>;

        if (errorApprovers)
            return <p style={{ color: "red" }}>Error: {errorApprovers}</p>;

        if (errorSingleApprovals)
            return <p style={{ color: "red" }}>Error: {errorSingleApprovals}</p>;

        // Merge both sources
        const combinedApprovers = [
            ...(userApprovers || []).map((approver) => ({
                id: `ua_${approver.id}`,
                name: approver.Approver_Name || "N/A",
                type: approver.Type || "User Approver",
            })),
            ...(singleApprovalApprovers || []).map((sa) => ({
                id: `sa_${sa.id}`,
                name: sa.username || "N/A",
                type: "Single Approval",
            })),
        ];

        if (combinedApprovers.length === 0)
            return <p><i>No approvers assigned.</i></p>;

        return (
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                    gap: "16px",
                    marginTop: "10px",
                }}
            >
                {combinedApprovers.map((approver) => (
                    <div
                        key={approver.id}
                        style={{
                            border: "1px solid #ddd",
                            padding: "12px",
                            borderRadius: "8px",
                            backgroundColor: "#f9f9f9",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        }}
                    >
                        <p style={{ margin: "4px 0" }}>
                            <strong>Name:</strong> {approver.name}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                            <strong>Type:</strong> {approver.type}
                        </p>
                    </div>
                ))}
            </div>
        );
    };



    const [userApprovers, setUserApprovers] = useState([]);
    const [loadingApprovers, setLoadingApprovers] = useState(false);
    const [errorApprovers, setErrorApprovers] = useState(null);

    const fetchUserApprovers = async () => {
        setLoadingApprovers(true);
        setErrorApprovers(null);

        try {
            // 🟢 Fetch all users from Single_Approval who are allowed to approve
            const { data, error } = await supabase
                .from("Single_Approval")
                .select("*")
                .eq("allowed_to_approve", true)
                .order("created_at", { ascending: true });

            if (error) throw error;

            // 🧩 Format the data for display
            const formattedData = (data || []).map((item) => ({
                id: item.id,
                Approver_Name: item.username,
                Type: "Single Approval",
                created_at: item.created_at,
            }));

            setUserApprovers(formattedData);
        } catch (err) {
            console.error("Fetch Single_Approval error:", err.message);
            setErrorApprovers(err.message);
        } finally {
            setLoadingApprovers(false);
        }
    };

    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
        if (activeTab === "approvers" && currentUser?.UserID) {
            fetchUserApprovers(currentUser.UserID);
        }
    }, [activeTab]);
    const [salesDivision, setSalesDivision] = useState([]);

    useEffect(() => {
        const fetchUserConnections = async () => {
            const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
            const userId = currentUser?.UserID;

            if (!userId) {
                console.warn("No UserID found in localStorage");
                return;
            }

            try {
                const { data, error } = await supabase
                    .from("User_Connections")
                    .select("*")
                    .eq("UserID", userId);

                if (error) throw error;

                setSalesDivision(data || []);
            } catch (err) {
                console.error("Error fetching User_Connections:", err.message);
            }
        };

        fetchUserConnections();
    }, []);

    const [userBrands, setUserBrands] = useState([]);

    useEffect(() => {
        const fetchUserBrands = async () => {
            try {
                const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
                const userId = currentUser?.UserID;
                if (!userId) {
                    console.warn("No logged in user.");
                    return;
                }

                const { data, error } = await supabase
                    .from("User_Brands")
                    .select("*")
                    .eq("UserID", userId)
                    .order("created_at", { ascending: false });

                if (error) {
                    console.error("Error fetching user brands:", error.message);
                } else {
                    setUserBrands(data || []);
                }
            } catch (err) {
                console.error("Unexpected error fetching user brands:", err.message);
            }
        };

        fetchUserBrands();
    }, []);

    // Handle clicking on cover photo to show upload buttons
    const handleCoverClick = () => {
        setShowUploadButtons(true);
    };

    // Handle selecting a new cover photo file
    const handleCoverFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setNewCoverFile(e.target.files[0]);
        }
    };

    // Handle uploading the new cover photo to Supabase Storage and updating profile
    const handleSaveCover = async () => {
        if (!newCoverFile || !localUser?.id) return;
        setUploading(true);

        try {
            const fileExt = newCoverFile.name.split('.').pop();
            const filePath = `coverPhotos/${localUser.id}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('user-media')
                .upload(filePath, newCoverFile, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase
                .storage
                .from('user-media')
                .getPublicUrl(filePath);

            const publicUrl = publicUrlData?.publicUrl;

            const { error: updateError } = await supabase
                .from('Account_Users')
                .update({ coverPhoto: filePath })
                .eq('id', localUser.id);

            if (updateError) throw updateError;

            const updatedProfile = { ...profile, coverPhoto: filePath };
            setProfile(updatedProfile);
            localStorage.setItem('loggedInUser', JSON.stringify(updatedProfile));

            setCoverUrl(publicUrl);
            setNewCoverFile(null);
            setShowUploadButtons(false);
        } catch (error) {
            console.error("Error uploading cover photo to Supabase:", error.message);
            alert("Failed to upload cover photo.");
        } finally {
            setUploading(false);
        }
    };

    // Tab content renderers
    const renderCategory = (categories) => {
        if (!categories || categories.length === 0) return <p><i>No categories assigned.</i></p>;

        return (
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
                    gap: "12px",
                    padding: "10px 0",
                }}
            >
                {categories.map((cat, idx) => (
                    <div
                        key={cat.id || idx}
                        style={{
                            border: "1px solid #ccc",
                            padding: "8px",
                            borderRadius: "4px",
                            backgroundColor: "#f9f9f9",
                            fontSize: "14px",
                        }}
                    >
                        <strong>Distributor Code:</strong> {cat.code || "N/A"}<br />
                        <strong>Distributor Name:</strong> {cat.distributor_name || "N/A"}
                    </div>
                ))}
            </div>
        );
    };








    // Handle tab switching with animation
    const handleTabChange = (tabKey) => {
        if (tabKey === activeTab) return;
        setAnimating(true);
        setTimeout(() => {
            setActiveTab(tabKey);
            setAnimating(false);
        }, 300);
    };

    if (!profile) {
        return (
            <div style={styles.page}>
                <p style={{ textAlign: 'center', marginTop: 50, color: '#eee', fontSize: 18 }}>
                    No profile data found. Please log in.
                </p>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                {/* Cover photo with zoom animation */}
                <div
                    style={{
                        ...styles.cover,
                        backgroundImage: `url(${coverUrl || defaultCover})`,
                        cursor: 'pointer',
                        position: 'relative',
                    }}
                    className="cover-zoom"
                    onClick={handleCoverClick}
                >
                    {showUploadButtons && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                padding: 12,
                                borderRadius: 8,
                                zIndex: 10,
                            }}
                            onClick={(e) => e.stopPropagation()} // prevent closing when clicking buttons
                        >
                            {!newCoverFile && (
                                <label style={{ color: '#fff', cursor: 'pointer', display: 'block' }}>
                                    Upload Cover
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleCoverFileChange}
                                    />
                                </label>
                            )}

                            {newCoverFile && (
                                <>
                                    <p style={{ color: '#eee', marginBottom: 8 }}>{newCoverFile.name}</p>
                                    <button
                                        disabled={uploading}
                                        onClick={handleSaveCover}
                                        style={{
                                            backgroundColor: '#1877f2',
                                            border: 'none',
                                            color: 'white',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            cursor: uploading ? 'not-allowed' : 'pointer',
                                            marginRight: 8,
                                        }}
                                    >
                                        {uploading ? 'Uploading...' : 'Save'}
                                    </button>
                                    <button
                                        disabled={uploading}
                                        onClick={() => {
                                            setNewCoverFile(null);
                                            setShowUploadButtons(false);
                                        }}
                                        style={{
                                            backgroundColor: '#aaa',
                                            border: 'none',
                                            color: 'white',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            cursor: uploading ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Overlay for darkening */}
                    <div style={styles.coverOverlay} />

                    {/* Avatar */}
                    <img
                        src={avatar && avatar.trim() !== '' ? avatar : 'https://i.pravatar.cc/50'}
                        alt="User Avatar"
                        style={styles.avatar}
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://i.pravatar.cc/150';
                        }}
                    />
                </div>

                {/* User info */}
                <div style={styles.userInfo}>
                    <h1 style={styles.name}>{profile.name || 'No Name'}</h1>
                    <h3 style={styles.username}>@{profile.username || 'username'}</h3>
                    <p style={styles.bio}>{profile.bio || 'This user hasn’t written a bio yet.'}</p>
                    <button
                        onClick={() => setCurrentView("SettingProfileUpdate")}
                        style={{
                            backgroundColor: '#1877f2',       // Facebook blue vibe
                            color: 'white',
                            padding: '10px 20px',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '16px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 8px rgba(24, 119, 242, 0.3)',
                            transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                            userSelect: 'none',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#145dbf';
                            e.currentTarget.style.boxShadow = '0 6px 12px rgba(20, 93, 191, 0.4)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#1877f2';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(24, 119, 242, 0.3)';
                        }}
                    >
                        Edit Profile
                    </button>

                </div>

                {/* Tabs */}
                <nav style={styles.tabs}>
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => handleTabChange(key)}
                            style={{
                                ...styles.tabButton,
                                ...(activeTab === key ? styles.activeTabButton : {}),
                            }}

                        >
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Tab content */}
                <div
                    style={{
                        ...styles.tabContent,
                        opacity: animating ? 0 : 1,
                        transform: animating ? 'translateY(10px)' : 'translateY(0)',
                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                    }}
                    key={activeTab}
                >
                    {activeTab === 'distributor' && renderDistributor(distributorData)}
                    {activeTab === 'approvers' && renderApprovers()}
                    {activeTab === 'salesDivision' && renderValue(salesDivision)}
                </div>

            </div>

            {/* CSS for zoom animation */}
            <style>{`
        .cover-zoom {
          animation: zoomInOut 15s ease-in-out infinite alternate;
        }
        @keyframes zoomInOut {
          0% { background-size: 100% 100%; }
          100% { background-size: 110% 110%; }
        }
        button:hover {
          color: #1877f2;
          border-bottom-color: #1877f2 !important;
        }
      `}</style>
        </div>
    );
};

const styles = {
    page: {
        padding: 20,
        boxSizing: 'border-box',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: '#eee',
    },
    container: {
        maxWidth: 1500,
        margin: '0 auto',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
    },
    cover: {
        height: 280,
        borderRadius: '16px 16px 0 0',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        position: 'relative',
        boxShadow: 'inset 0 0 80px rgba(0,0,0,0.3)',
    },
    coverOverlay: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: '16px 16px 0 0',
    },
    avatar: {
        width: 160,
        height: 160,
        borderRadius: '50%',
        border: '6px solid white',
        position: 'absolute',
        bottom: -80,
        left: 40,
        boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
        backgroundColor: '#fff',
        objectFit: 'cover',
    },
    userInfo: {
        paddingLeft: 220,
        paddingTop: 40,
        paddingBottom: 30,
        color: '#222',
    },
    name: {
        fontSize: '2.75rem',
        margin: 0,
        fontWeight: '800',
        color: '#222',
        textShadow: '0 2px 6px rgba(0,0,0,0.1)',
    },
    username: {
        fontWeight: 600,
        color: '#444',
        marginTop: 6,
        marginBottom: 20,
    },
    bio: {
        fontSize: 18,
        fontWeight: 400,
        color: '#444',
        maxWidth: 500,
    },
    tabs: {
        display: 'flex',
        borderTop: '1px solid #ccc',
        borderBottom: '1px solid #ccc',
        marginBottom: 30,
    },
    tabButton: {
        cursor: 'pointer',
        padding: '12px 28px',
        margin: '0 20px',
        background: 'none',
        border: 'none',
        borderBottom: '2px solid transparent',
        fontWeight: 'bold',
        fontSize: 16,
        color: '#555',
        outline: 'none',
        transition: 'color 0.3s, border-bottom-color 0.3s',
    },
    activeTabButton: {
        color: '#1877f2',
        borderBottomColor: '#1877f2',
    },
    tabContent: {
        padding: '0 40px 40px 40px',
        color: '#333',
    },
};

export default UserPage;
