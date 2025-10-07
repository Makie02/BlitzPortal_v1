import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Swal from 'sweetalert2';

const SettingProfileUpdate = ({ setCurrentView }) => {
  const storedUser = JSON.parse(localStorage.getItem('loggedInUser')) || {};
  const userId = storedUser.id || storedUser.UserID;
  const Role = storedUser.Role;

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

  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = () => setShowPassword(prev => !prev);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const uid = Number(userId);
      if (isNaN(uid)) throw new Error("Invalid user ID");

      let { data, error } = await supabase
        .from('Account_Users')
        .select('*')
        .or(`UserID.eq.${uid},id.eq.${uid}`)
        .maybeSingle();

      if (error) throw error;
      if (!data && storedUser.email) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('Account_Users')
          .select('*')
          .eq('email', storedUser.email)
          .maybeSingle();

        if (fallbackError) throw fallbackError;
        data = fallback;
      }

      if (data) {
        setFormData(prev => ({
          ...prev,
          ...data,
        }));
        localStorage.setItem('user', JSON.stringify({ ...storedUser, ...data }));
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      alert("Failed to load user data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchUserProfile();
    else setLoading(false);
  }, [userId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    const uid = Number(userId);
    if (isNaN(uid)) {
      return Swal.fire({
        icon: 'error',
        title: 'Invalid User ID',
        text: 'Your User ID is not valid.',
      });
    }

    const { data: match, error: matchError } = await supabase
      .from('Account_Users')
      .select('UserID,id')
      .or(`UserID.eq.${uid},id.eq.${uid}`)
      .maybeSingle();

    if (matchError || !match) {
      return Swal.fire({
        icon: 'error',
        title: 'User Not Found',
        text: 'We could not find a matching user.',
      });
    }

    const matchField = match?.UserID === uid ? 'UserID' : 'id';

    const { data, error } = await supabase
      .from('Account_Users')
      .update(formData)
      .eq(matchField, uid)
      .select();

    if (error || !data?.length) {
      return Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: 'Something went wrong while saving your profile.',
      });
    }

    // ✅ Success - prompt and reload on confirm
    Swal.fire({
      icon: 'success',
      title: 'Profile Updated!',
      text: 'Your changes have been saved.',
      confirmButtonText: 'OK',
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.reload(); // 🔄 refresh the page
      }
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const { newPassword, confirmPassword } = passwords;

    if (!newPassword || !confirmPassword) {
      return Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please fill in both password fields.',
      });
    }

    if (newPassword !== confirmPassword) {
      return Swal.fire({
        icon: 'error',
        title: 'Password Mismatch',
        text: 'The new passwords do not match.',
      });
    }

    const uid = Number(userId);
    if (isNaN(uid)) {
      return Swal.fire({
        icon: 'error',
        title: 'Invalid User ID',
        text: 'User ID is not a valid number.',
      });
    }

    try {
      const { data, error } = await supabase
        .from('Account_Users')
        .update({ password: newPassword })
        .or(`UserID.eq.${uid},id.eq.${uid}`)
        .select();

      if (error || !data?.length) {
        return Swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: 'Could not update password. Please try again later.',
        });
      }

      // Clear password fields
      setPasswords({ newPassword: '', confirmPassword: '' });

      // Prompt user with success and options
      const result = await Swal.fire({
        icon: 'success',
        title: 'Password Changed!',
        text: 'Your password has been updated.',
        showCancelButton: true,
        confirmButtonText: 'Log out',
        cancelButtonText: 'Stay here',
        reverseButtons: true,
      });

      if (result.isConfirmed) {
        // 🔐 Log out user
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('user');
        window.location.href = '/login'; // or your login route
      } else {
        // 🔄 Stay on page — you can also refetch user data if needed
        setTab('info');
        fetchUserProfile(); // optional: refresh user info
      }

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Unexpected Error',
        text: err.message || 'Something went wrong.',
      });
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

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const uploadProfilePicToTable = async (file) => {
    const base64 = await toBase64(file);
    setFormData(prev => ({ ...prev, profilePicture: base64 }));

    const { error } = await supabase
      .from('Account_Users')
      .update({ profilePicture: base64 })
      .or(`UserID.eq.${userId},id.eq.${userId}`);

    if (error) alert('Failed to save image');
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '40px auto',
        padding: 20,
        fontFamily: 'Segoe UI, sans-serif',
        backgroundColor: '#fff',
        borderRadius: 10,
        boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
      }}
    >
      <h2>Settings</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setTab('info')}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: tab === 'info' ? '#1877f2' : '#eee',
            color: tab === 'info' ? '#fff' : '#000',
          }}
        >
          Edit Info
        </button>
        <button
          onClick={() => setTab('password')}
          style={{
            padding: '10px 20px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: tab === 'password' ? '#1877f2' : '#eee',
            color: tab === 'password' ? '#fff' : '#000',
          }}
        >
          Change Password
        </button>
      </div>

      {/* Profile Picture Upload */}
      {tab === 'info' && (
        <form onSubmit={handleInfoSubmit}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 30 }}>
            <label
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              style={{
                height: 160,
                width: 160,
                borderRadius: '50%',
                border: '2px dashed #aaa',
                backgroundColor: '#f5f5f5',
                backgroundImage: formData.profilePicture
                  ? `url(${formData.profilePicture})`
                  : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {!formData.profilePicture && (
                <div style={{ textAlign: 'center', color: '#555' }}>
                  <strong>Upload Profile Picture</strong>
                  <p>Click or drag image here</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleProfilePicUpload}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
            </label>
          </div>

          {/* Info Fields Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 20,
            }}
          >
            {['name', 'username', 'email', 'contactNumber', 'bio'].map((field) => (
              <label key={field} style={{ display: 'flex', flexDirection: 'column', fontWeight: 500 }}>
                {field.charAt(0).toUpperCase() + field.slice(1)}:
                {field === 'bio' ? (
                  <textarea
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    style={{
                      padding: 10,
                      fontSize: 16,
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      minHeight: 80,
                    }}
                  />
                ) : (
                  <input
                    name={field}
                    type={field === 'email' ? 'email' : 'text'}
                    value={formData[field]}
                    onChange={handleChange}
                    style={{
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

          <label style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
            />
            Active User
          </label>

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button type="submit" style={{
              backgroundColor: '#1877f2',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16,
            }}>
              Save
            </button>
            <button type="button" onClick={() => setCurrentView('ProfileDashboard')} style={{
              backgroundColor: '#aaa',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16,
            }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {tab === 'password' && (
        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <label>
            New Password:
            <div style={{ position: 'relative' }}>
              <input
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={passwords.newPassword}
                onChange={handlePasswordChange}
                required
                style={{
                  width: '100%',
                  padding: 10,
                  fontSize: 16,
                  borderRadius: 6,
                  border: '1px solid #ccc',
                }}
              />
            </div>
          </label>

          <label>
            Confirm Password:
            <div style={{ position: 'relative' }}>
              <input
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={passwords.confirmPassword}
                onChange={handlePasswordChange}
                required
                style={{
                  width: '100%',
                  padding: 10,
                  fontSize: 16,
                  borderRadius: 6,
                  border: '1px solid #ccc',
                }}
              />
              <span
                onClick={toggleShowPassword}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  color: '#1877f2',
                  fontSize: 14,
                  marginTop: 10,
                }}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />} Show Password
              </span>
            </div>
          </label>

          <button type="submit" style={{
            backgroundColor: '#1877f2',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 16,
            marginTop: 20,
          }}>
            Change Password
          </button>
        </form>
      )}
    </div>
  );
};

export default SettingProfileUpdate;
