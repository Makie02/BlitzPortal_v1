import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FaEye, FaEyeSlash, FaUser, FaLock, FaCamera, FaEnvelope, FaPhone, FaBriefcase } from 'react-icons/fa';
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

    isActive: true,
    profilePicture: '',
  });

  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
      Swal.fire({
        icon: 'error',
        title: 'Failed to Load',
        text: 'Could not load user data.',
      });
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

    Swal.fire({
      icon: 'success',
      title: 'Profile Updated!',
      text: 'Your changes have been saved.',
      confirmButtonText: 'OK',
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.reload();
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

      setPasswords({ newPassword: '', confirmPassword: '' });

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
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        setTab('info');
        fetchUserProfile();
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
    setIsDragging(false);
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

    if (error) {
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: 'Failed to save profile picture.',
      });
    } else {
      Swal.fire({
        icon: 'success',
        title: 'Picture Updated!',
        text: 'Your profile picture has been changed.',
        timer: 2000,
        showConfirmButton: false,
      });
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: 20,
        color: '#6b7280'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      padding: '40px 20px'
    }}>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .input-field {
            transition: all 0.3s ease;
          }
          .input-field:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            outline: none;
          }
          .btn-primary {
            transition: all 0.3s ease;
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
          }
          .btn-secondary {
            transition: all 0.3s ease;
          }
          .btn-secondary:hover {
            background-color: #4b5563;
          }
          .tab-button {
            transition: all 0.3s ease;
            position: relative;
          }
          .tab-button.active::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 3px;
            background: #3b82f6;
            border-radius: 3px 3px 0 0;
          }
        `}
      </style>

      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        animation: 'fadeIn 0.5s ease'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px 16px 0 0',
          padding: '32px 40px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 700,
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <FaUser style={{ color: '#3b82f6' }} />
            Account Settings
          </h1>
          <p style={{
            margin: '8px 0 0 0',
            color: '#6b7280',
            fontSize: 16
          }}>
            Manage your profile information and security settings
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          backgroundColor: '#ffffff',
          padding: '0 40px',
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid #f3f4f6'
        }}>
          <button
            onClick={() => setTab('info')}
            className={`tab-button ${tab === 'info' ? 'active' : ''}`}
            style={{
              padding: '16px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600,
              color: tab === 'info' ? '#3b82f6' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <FaUser />
            Profile Information
          </button>
          <button
            onClick={() => setTab('password')}
            className={`tab-button ${tab === 'password' ? 'active' : ''}`}
            style={{
              padding: '16px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600,
              color: tab === 'password' ? '#3b82f6' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <FaLock />
            Security
          </button>
        </div>

        {/* Content */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '0 0 16px 16px',
          padding: 40,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          {/* Profile Info Tab */}
          {tab === 'info' && (
            <form onSubmit={handleInfoSubmit}>
              {/* Profile Picture Section */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: 48,
                padding: '32px 0',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  style={{
                    position: 'relative',
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: isDragging ? '3px solid #3b82f6' : '3px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                  }}
                >
                  {formData.profilePicture ? (
                    <img
                      src={formData.profilePicture}
                      alt="Profile"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 64,
                      color: '#d1d5db'
                    }}>
                      <FaUser />
                    </div>
                  )}

                  <div style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 30,
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: '#4e4e4e85',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: 20,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    cursor: 'pointer'
                  }}>
                    <FaCamera />
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePicUpload}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <p style={{
                  marginTop: 16,
                  fontSize: 14,
                  color: '#6b7280',
                  textAlign: 'center'
                }}>
                  Click or drag to upload profile picture
                  <br />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    Recommended: Square image, at least 400x400px
                  </span>
                </p>
              </div>

              {/* Form Fields */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 24,
                marginBottom: 24
              }}>
                {/* Name */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8
                  }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FaUser style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: 16
                    }} />
                    <input
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      className="input-field"
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 44px',
                        fontSize: 16,
                        border: '2px solid #e5e7eb',
                        borderRadius: 8,
                        backgroundColor: '#ffffff'
                      }}
                    />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8
                  }}>
                    Username
                  </label>
                  <input
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    className="input-field"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: 16,
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                      backgroundColor: '#ffffff'
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8
                  }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FaEnvelope style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: 16
                    }} />
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="input-field"
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 44px',
                        fontSize: 16,
                        border: '2px solid #e5e7eb',
                        borderRadius: 8,
                        backgroundColor: '#ffffff'
                      }}
                    />
                  </div>
                </div>

                {/* Contact Number */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 8
                  }}>
                    Contact Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FaPhone style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: 16
                    }} />
                    <input
                      name="contactNumber"
                      type="text"
                      value={formData.contactNumber}
                      onChange={handleChange}
                      className="input-field"
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 44px',
                        fontSize: 16,
                        border: '2px solid #e5e7eb',
                        borderRadius: 8,
                        backgroundColor: '#ffffff'
                      }}
                    />
                  </div>
                </div>

    </div>
              {/* Bio */}
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 8
                }}>
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  className="input-field"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    backgroundColor: '#ffffff',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  placeholder="Tell us about yourself..."
                />
              </div>

              {/* Active Status */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                backgroundColor: '#f9fafb',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 32
              }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  style={{
                    width: 20,
                    height: 20,
                    cursor: 'pointer',
                    accentColor: '#3b82f6'
                  }}
                />
                <span style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#374151'
                }}>
                  Active User Account
                </span>
              </label>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
                paddingTop: 24,
                borderTop: '1px solid #f3f4f6'
              }}>
                <button
                  type="button"
                  onClick={() => setCurrentView('ProfileDashboard')}
                  className="btn-secondary"
                  style={{
                    padding: '12px 24px',
                    fontSize: 16,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: '#6b7280',
                    color: '#ffffff'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    padding: '12px 32px',
                    fontSize: 16,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* Password Tab */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordSubmit} style={{ maxWidth: 600, margin: '0 auto' }}>
              {/* Header */}
              <div style={{
                textAlign: 'center',
                marginBottom: 40,
                padding: '32px 0',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: 36,
                  color: '#3b82f6'
                }}>
                  <FaLock />
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px 0' }}>
                  Change Password
                </h3>
                <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
                  Create a strong password to keep your account secure
                </p>
              </div>

              {/* Input Styles */}
              {/** Common input style */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  New Password
                </label>
                <input
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={passwords.newPassword}
                  onChange={handlePasswordChange}
                  required
                  className="input-field"
                  placeholder="Enter new password"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Confirm Password
                </label>
                <input
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={passwords.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  className="input-field"
                  placeholder="Confirm new password"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* Show Password */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 15,
                color: '#374151',
                marginBottom: 32
              }}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={toggleShowPassword}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#3b82f6' }}
                />
                {showPassword ? <FaEyeSlash /> : <FaEye />}
                Show Password
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  backgroundColor: '#1877f2',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 16,
                  marginTop: 20
                }}
              >
                Change Password
              </button>
            </form>
          )}
        </div>        </div>
        </div>
        );
};

        export default SettingProfileUpdate;
