import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const SettingProfileUpdate = ({ setCurrentView }) => {
  const storedUser = JSON.parse(localStorage.getItem('loggedInUser')) || {};
  const userId = storedUser.id;
  const Role = storedUser.Role; // 'admin' or 'user'

  const [tab, setTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    bio: '',
    email: '',
    contactNumber: '',
    position: '',
    group: '',
    isActive: true,
    profilePicture: '',
  });

  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const userIdNum = Number(userId);
      if (isNaN(userIdNum)) {
        throw new Error("User ID is not a valid number");
      }

      // Try to get by UserID first
      let { data, error } = await supabase
        .from('Account_Users')
        .select('*')
        .eq('UserID', userIdNum)
        .maybeSingle();  // <-- Use maybeSingle to avoid throwing if no rows

      if (error) throw error;

      // If no data found by UserID, try fallback by email if email exists
      if (!data && storedUser.email) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('Account_Users')
          .select('*')
          .eq('email', storedUser.email)
          .maybeSingle();

        if (fallbackError) throw fallbackError;
        data = fallbackData;
      }

      if (data) {
        setFormData((prev) => ({
          ...prev,
          name: data.name || prev.name,
          username: data.username || prev.username,
          bio: data.bio || prev.bio,
          email: data.email || prev.email,
          contactNumber: data.contactNumber || prev.contactNumber,
          position: data.position || prev.position,
          group: data.group || prev.group,
          isActive: data.isActive ?? true,
          profilePicture: data.profilePicture || '',
        }));

        const updatedUser = {
          ...storedUser,
          ...data,
          profilePicture: data.profilePicture || '',
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        // setAvatar(updatedUser.profilePicture); // if you have avatar state
      } else {
        console.warn('No user data found in Supabase for given UserID or email.');
      }
    } catch (err) {
      console.error("Error fetching user data from Supabase:", err);
      alert('Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    } else {
      setLoading(false); // no userId, so stop loading spinner
    }
  }, [userId]);


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    const uid = Number(userId);
    if (isNaN(uid)) return alert('Invalid user ID');

    console.log('Updating Account_Users for id or UserID =', uid);

    let resp = await supabase
      .from('Account_Users')
      .select('UserID,id')  // make sure to select both for matchField check
      .or(`UserID.eq.${uid},id.eq.${uid}`)
      .limit(1);

    if (resp.error) throw resp.error;
    if (!resp.data.length) {
      alert(`No user found with UserID or id = ${uid}`);
      return;
    }

    const matchField = resp.data[0].UserID === uid ? 'UserID' : 'id';

    const { data, error } = await supabase
      .from('Account_Users')
      .update({
        name: formData.name,
        username: formData.username,
        bio: formData.bio,
        email: formData.email,
        contactNumber: formData.contactNumber,
        position: formData.position,
        group: formData.group,
        isActive: formData.isActive,
      })
      .eq(matchField, uid)
      .select();

    console.log('Update response:', { data, error });

    if (error) throw error;
    if (!data.length) {
      alert('Update didn’t apply, unexpected mismatch.');
      return;
    }

    alert('Profile updated');
    setCurrentView('ProfileDashboard');

    // --- Log RecentActivity ---
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipRes.json();

      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geo = await geoRes.json();
      const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
      const userId = currentUser?.UserID || "unknown";
      const activityLog = {
        userId: userId, // or just userId,
        device: navigator.userAgent || 'Unknown Device',
        location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
        ip,
        time: new Date().toISOString(),
        action: `Updated profile information for UserID: ${uid}`,
      };

      const { error: activityError } = await supabase
        .from('RecentActivity')
        .insert(activityLog);

      if (activityError) {
        console.warn('Failed to log profile update:', activityError.message);
      }
    } catch (logError) {
      console.warn('Error logging profile update:', logError.message);
    }
  };




  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    const { newPassword, confirmPassword } = passwords;

    if (!newPassword || !confirmPassword) {
      alert('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    const uid = Number(userId);
    if (isNaN(uid)) {
      alert('Invalid UserID');
      return;
    }

    try {
      // 🔹 Attempt password update
      let { data, error } = await supabase
        .from('Account_Users')
        .update({ password: newPassword })
        .eq('UserID', uid)
        .select();

      console.log('Update via UserID:', { data, error });

      // 🔄 Fallback: try 'id' column if 'UserID' fails
      if ((!data || data.length === 0) && !error) {
        ({ data, error } = await supabase
          .from('Account_Users')
          .update({ password: newPassword })
          .eq('id', uid)
          .select());
        console.log('Update via id:', { data, error });
      }

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No rows were updated. Check your equality column and value.');
      }

      // ✅ Password updated
      alert('Password updated successfully!');
      setPasswords({ newPassword: '', confirmPassword: '' });
      setTab('info');

      // 🔹 Log into RecentActivity
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipRes.json();

        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const geo = await geoRes.json();
        const currentUser = JSON.parse(localStorage.getItem("loggedInUser"));
        const userId = currentUser?.UserID || "unknown";
        const activityLog = {
          userId: userId, // or just userId,
          device: navigator.userAgent || "Unknown Device",
          location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
          ip,
          time: new Date().toISOString(),
          action: `Changed password for UserID: ${uid}`,
        };

        const { error: activityError } = await supabase
          .from("RecentActivity")
          .insert(activityLog);

        if (activityError) {
          console.warn("Failed to log password change:", activityError.message);
        }
      } catch (logError) {
        console.warn("Logging error:", logError.message);
      }

    } catch (err) {
      console.error(err);
      alert('Failed to update password:\n' + err.message);
    }
  };

  const handleDrop = async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) await uploadProfilePicToTable(file);
};

const handleProfilePicUpload = async (e) => {
  const file = e.target.files[0];
  if (file) await uploadProfilePicToTable(file);
};

const uploadProfilePicToTable = async (file) => {
  if (!userId) {
    alert("User ID missing!");
    return;
  }

  // Convert file to base64
  const base64 = await toBase64(file);

  if (!base64) {
    alert("Failed to convert image.");
    return;
  }

  // Set in form for preview
  setFormData((prev) => ({
    ...prev,
    profilePicture: base64,
  }));

  // Save to Supabase table
  await updateProfilePictureInDatabase(base64);
};

// Helper to convert file to base64
const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

const updateProfilePictureInDatabase = async (base64Image) => {
  try {
    const { error } = await supabase
      .from("Account_Users")
      .update({ profilePicture: base64Image })
      .eq("id", userId); // Change to 'UserID' if needed

    if (error) {
      console.error("DB update error:", error);
      alert("Failed to save image to database.");
    } else {
      console.log("Profile picture saved in DB.");
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    alert("Unexpected error while saving image.");
  }
};


  if (loading) return <div>Loading...</div>;

  return (
    <div style={styles.page}>
      <h2>Settings</h2>

      {/* Tab Buttons */}
      <div style={styles.tabs}>
        <button
          onClick={() => setTab('info')}
          style={tab === 'info' ? styles.activeTab : styles.tab}
        >
          Edit Info
        </button>
        <button
          onClick={() => setTab('password')}
          style={tab === 'password' ? styles.activeTab : styles.tab}
        >
          Change Password
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'info' ? (
        <form onSubmit={handleInfoSubmit} style={styles.form}>
          <div style={styles.profilePicWrapper}>
            <label
              htmlFor="profile-upload"
              style={{
                ...styles.dropZone,
                backgroundImage: formData.profilePicture
                  ? `url(${formData.profilePicture})`
                  : 'none',
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {!formData.profilePicture && (
                <div style={styles.uploadText}>
                  <strong>Upload Profile Picture</strong>
                  <p>Click or drag image here</p>
                </div>
              )}
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                onChange={handleProfilePicUpload}
                style={styles.fileInput}
              />
            </label>
          </div>



          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px 40px',
            }}
          >
            {[
              'name',
              'username',
              'bio',
              'email',
              'contactNumber',
              'position',
              'group',
            ].map((field) => (
              <label
                key={field}
                style={{ display: 'flex', flexDirection: 'column', fontWeight: '500' }}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}:
                {field === 'bio' ? (
                  <textarea
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: 10,
                      fontSize: 16,
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      height: 80,
                    }}
                  />
                ) : (
                  <input
                    name={field}
                    type={field === 'email' ? 'email' : 'text'}
                    value={formData[field]}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: 10,
                      fontSize: 16,
                      borderRadius: 6,
                      border: '1px solid #ccc',
                    }}
                  />
                )}
              </label>
            ))}
          </div>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
            />
            {' '}Active User
          </label>

          <div style={{ marginTop: 20 }}>
            <button type="submit" style={styles.saveButton}>Save</button>
            <button
              type="button"
              style={styles.cancelButton}
              onClick={() => setCurrentView('ProfileDashboard')}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} style={styles.form}>
          <label>
            New Password:
            <input
              name="newPassword"
              type="password"
              value={passwords.newPassword}
              onChange={handlePasswordChange}
              style={styles.input}
              required
            />
          </label>
          <label>
            Confirm Password:
            <input
              name="confirmPassword"
              type="password"
              value={passwords.confirmPassword}
              onChange={handlePasswordChange}
              style={styles.input}
              required
            />
          </label>
          <div style={{ marginTop: 20 }}>
            <button type="submit" style={styles.saveButton}>
              Change Password
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const styles = {
  page: {
    maxWidth: 600,
    margin: '40px auto',
    padding: 20,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: '#222',
    backgroundColor: '#fff',
    borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 15,
  },
  input: {
    width: '100%',
    padding: 10,
    fontSize: 16,
    borderRadius: 6,
    border: '1px solid #ccc',
  },
  saveButton: {
    backgroundColor: '#1877f2',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 16,
    marginRight: 10,
  },
  cancelButton: {
    backgroundColor: '#aaa',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 16,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontWeight: '500',
  },
  tabs: {
    display: 'flex',
    gap: 10,
    marginBottom: 20,
  },
  tab: {
    padding: '10px 20px',
    backgroundColor: '#eee',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  activeTab: {
    padding: '10px 20px',
    backgroundColor: '#1877f2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  profilePicWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 30,
  },

  dropZone: {
    height: 160,
    width: 160,
    borderRadius: '50%',
    border: '2px dashed #aaa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backgroundColor: '#f5f5f5',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative',
    transition: 'border-color 0.3s ease-in-out',
  },

  uploadText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#555',
    padding: 10,
  },

  fileInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    opacity: 0,
    cursor: 'pointer',
  },

};

export default SettingProfileUpdate;
