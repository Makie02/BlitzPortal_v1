import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Button, Container, Badge, Form, Modal, Table } from 'react-bootstrap';
import {
  FaEdit,
  FaUserShield,
  FaTags,
  FaPlug,
  FaUserSlash,
  FaPlus,
  FaExclamationTriangle
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import { supabase } from '../supabaseClient';
import '../App.css'; // or wherever your CSS is defined

import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../Firebase";

const USERS_PER_PAGE = 4;

const UserManagement = ({ setCurrentView }) => {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ group: '', position: '', role: '' });

  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState(null); // 'edit', 'approvers', 'brands', 'connection', 'deactivate', 'create'
  const DisableDurations = [
    { label: 'Enable Account', value: 0 },    // <-- new option to enable account
    { label: '1 day disable account', value: 1 },
    { label: '3 days disable account', value: 3 },
    { label: '7 days disable account', value: 7 },
  ];

  // New User form state (for 'create' modal)
  const [newUserData, setNewUserData] = useState({
    name: '',
    role: '',
    email: '',
    username: '',
    password: '',
    position: '',
    group: '',
    contactNumber: '',
    isActive: true,
    profilePicture: '',
    keyType: '', // default value, or 'admin' if you prefer
    licensekey: '',
    PermissionRole: '',

  });


  // For editing user - editable form state
  const [editUserData, setEditUserData] = useState({
    username: '',
    email: '',
    contactNumber: '',
    profilePicture: '',
    licensekey: '',
    username: '',
    password: '',
    userCode: '',
    subscriptionStart: '',
    subscriptionEnd: '',
  });

  // When modalType is 'edit' and selectedUser changes, update editUserData
  useEffect(() => {
    if (modalType === 'edit' && selectedUser) {
      setEditUserData({
        username: selectedUser.username || '',
        email: selectedUser.email || '',
        contactNumber: selectedUser.contactNumber || '',
        profilePicture: selectedUser.profilePicture || '',
      });
    }
  }, [modalType, selectedUser]);

  // Fetch users from Firebase Realtime Database
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('Account_Users')
        .select('*')
        .order('createdat', { ascending: false });

      if (error) {
        console.error('Error fetching users from Supabase:', error);
        setUsers([]);
      } else {
        setUsers(data);
      }
    };

    fetchUsers();
  }, []);
  const [disableDays, setDisableDays] = useState(null);
  const deleteAccountUser = async (userId, userName) => {
    if (!userId) {
      Swal.fire("Error", "Invalid user ID.", "error");
      return;
    }

    const result = await Swal.fire({
      title: `Delete user ${userName}?`,
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete!",
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("Account_Users")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      Swal.fire("Deleted!", "User has been deleted.", "success");
      setModalType(null);
      setDisableDays(null);
    } catch (error) {
      Swal.fire("Error", error.message || "Failed to delete user.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedUser || disableDays === null) return;

    setLoading(true);
    try {
      if (!supabaseUserID) {
        throw new Error("Supabase User ID not provided.");
      }

      if (disableDays === 0) {
        // ✅ Enable account in Supabase
        const { error } = await supabase
          .from('User_Status')
          .upsert({
            UserID: supabaseUserID,
            isActive: true,
            disableUntil: null,
          }, { onConflict: 'UserID' });

        if (error) throw error;

        Swal.fire('Success', 'User account enabled.', 'success');
      } else {
        // ❌ Disable account for N days
        const disableUntil = Date.now() + disableDays * 24 * 60 * 60 * 1000;

        const { error } = await supabase
          .from('User_Status')
          .upsert({
            UserID: supabaseUserID,
            isActive: false,
            disableUntil,
          }, { onConflict: 'UserID' });

        if (error) throw error;

        Swal.fire('Success', `User disabled for ${disableDays} day(s).`, 'success');
      }

      // Reset modal state
      setModalType(null);
      setDisableDays(null);
    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update user status.', 'error');
    } finally {
      setLoading(false);
    }
  };





  // Get unique options for filters dynamically
  const groups = useMemo(() => [...new Set(users.map(u => u.group))], [users]);
  const positions = useMemo(() => [...new Set(users.map(u => u.position))], [users]);
  const roles = useMemo(() => [...new Set(users.map(u => u.role))], [users]);

  // Filter users based on filters state
  const filteredUsers = React.useMemo(() => {
    return users.filter(user => {
      return (
        (filters.group === '' || user.group === filters.group) &&
        (filters.position === '' || user.position === filters.position) &&
        (filters.role === '' || user.role === filters.role)
      );
    });
  }, [users, filters]);

  // Reset page if filteredUsers change to avoid invalid page
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);
  const itemsPerPage = 6;
  const [currentPage, setCurrentPage] = React.useState(1);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const paginatedUsers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const goToPrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const currentUsers = filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);

  // Handlers for opening modals
  const [supabaseUserId, setSupabaseUserId] = useState(null);
  const [originalSupabaseData, setOriginalSupabaseData] = useState(null);

  const openModal = async (user, type) => {
    setSelectedUser(user);
    setModalType(type);

    const emailOrUsername = user.email || user.username;

    if (!emailOrUsername) {
      console.warn('No email or username available to find Supabase user.');
      return;
    }

    try {
      // Step 1: Get Supabase user via email/username
      const { data: supaUsers, error } = await supabase
        .from('Account_Users')
        .select('*')
        .or(`email.eq.${emailOrUsername},username.eq.${emailOrUsername}`)
        .limit(1);

      if (error) {
        console.error('Error fetching Supabase user:', error);
        return;
      }

      if (!supaUsers || supaUsers.length === 0) {
        console.warn('No Supabase user found.');
        return;
      }

      const userFromSupabase = supaUsers[0];

      // Set Supabase UserID to state (this is the key)
      setSupabaseUserID(userFromSupabase.UserID);

      setSupabaseUserId(userFromSupabase.id);       // local DB ID
      setOriginalSupabaseData(userFromSupabase);

      console.log('Supabase UserID:', userFromSupabase.UserID);

      // Step 2: Fetch full user data by UserID (optional)
      const { data: fullUserData, error: fullError } = await supabase
        .from('Account_Users')
        .select('*')
        .eq('UserID', userFromSupabase.UserID)
        .single();

      if (fullError) {
        console.error('Error fetching full user data:', fullError);
        return;
      }

      // Step 3: Pre-fill form state (optional)
      setEditUserData({
        name: fullUserData.name || '',
        email: fullUserData.email || '',
        username: fullUserData.username || '',
        password: fullUserData.password, // Leave blank for security; only change if user edits
        contactNumber: fullUserData.contactNumber || '',
        group: fullUserData.group || '',
        salesGroup: fullUserData.salesGroup || '',
        position: fullUserData.position || '',
        keyType: fullUserData.role || '',
        licensekey: fullUserData.licensekey || '',
        profilePicture: fullUserData.profilePicture || '',
        isActive: fullUserData.isActive ?? true,
        PermissionRole: fullUserData.PermissionRole || '',


      });

    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };


  const [supabaseUserID, setSupabaseUserID] = useState(null);

  const [savedApprovals, setSavedApprovals] = useState([]);
  useEffect(() => {
    fetchPosition();
    fetchSavedApprovals();
  }, []);

  const fetchSavedApprovals = async () => {
    const { data, error } = await supabase.from('singleapprovals').select('*');

    if (error) {
      console.error('Error fetching saved approvals:', error);
      setSavedApprovals([]);
    } else {
      setSavedApprovals(data || []);
    }
  };

  const [permissionRole, setPermissionRoles] = useState([]);
  const [allowedToApprove, setAllowedToApprove] = useState(false);

  // ✅ Define fetchPosition OUTSIDE useEffect so it's reusable
  const fetchPosition = async () => {
    const { data, error } = await supabase
      .from("References")
      .select("*")
      .eq("reference_type", "Position");

    if (error) {
      console.error('Error loading positions:', error);
      setPermissionRoles([]);
    } else {
      setPermissionRoles(data || []);
    }
  };

  // ✅ Call fetchPosition from useEffect on mount
  useEffect(() => {
    fetchPosition();
  }, []);

  const handleSaveSingleApproval = async () => {
    if (!selectedUser || !selectedPosition) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing fields',
        text: 'Please select a user and a position.',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.from('singleapprovals').insert([
        {
          user_id: selectedUser.UserID,
          position: selectedPosition,
          allowed_to_approve: allowedToApprove,
        },
      ]);

      if (error) {
        Swal.fire({
          icon: 'error',
          title: 'Failed to Save',
          text: error.message,
        });
        return;
      }

      Swal.fire({
        icon: 'success',
        title: 'Saved!',
        text: 'Single Approval has been saved successfully.',
        timer: 2000,
        showConfirmButton: false,
      });

      // Optional: reset form or close view
      setSelectedPosition('');
      setAllowedToApprove(false);
      setApproverViewMode(null);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Unexpected Error',
        text: err.message || 'An unknown error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteApproval = async (id) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Are you sure?',
      text: 'This will delete the approval permanently.',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
    });

    if (confirm.isConfirmed) {
      const { error } = await supabase.from('singleapprovals').delete().eq('id', id);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Swal.fire('Deleted!', 'Approval was deleted.', 'success');
        fetchSavedApprovals();
      }
    }
  };
  const [editId, setEditId] = useState(null);
  const [editPosition, setEditPosition] = useState('');
  const [editAllowed, setEditAllowed] = useState(false);

  const handleUpdateApproval = async (id, updatedPosition, updatedAllowed) => {
    const { error } = await supabase
      .from('singleapprovals')
      .update({ position: updatedPosition, allowed_to_approve: updatedAllowed })
      .eq('id', id);

    if (error) {
      Swal.fire('Error', error.message, 'error');
    } else {
      Swal.fire('Updated!', 'Approval updated successfully.', 'success');
      fetchSavedApprovals();
    }
  };

  const openCreateModal = () => {
    setNewUserData({
      name: '',
      role: '',
      email: '',
      username: '',
      password: '',
      position: '',
      group: '',
      contactNumber: '',
      isActive: true,
      profilePicture: '',
      licensekey: '',
      PermissionRole: '',
    });
    setModalType('create');
  };

  // Handle new user form input change
  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUserData(prev => ({ ...prev, [name]: value }));
  };

  // Handle edit user form change
  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };


  // Handle profile picture upload for new user
  const handleNewUserImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (upload) => {
        setNewUserData(prev => ({ ...prev, profilePicture: upload.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle profile picture upload for editing user
  const handleEditUserImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (upload) => {
        setEditUserData(prev => ({ ...prev, profilePicture: upload.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Your existing Firebase function (unchanged)

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault(); // prevent default form submission

    if (!newUserData.licensekey || newUserData.licensekey.trim() === '') {
      Swal.fire({
        icon: 'warning',
        title: 'License Key Required',
        text: 'Please select or enter a valid License Key before creating a user.',
      });
      return;
    }

    try {
      const result = await saveNewUser(); // your existing saveNewUser function
      Swal.fire({
        icon: 'success',
        title: 'User Created!',
        text: `User ID: ${result.UserID} created successfully.`,
        timer: 2500,
        showConfirmButton: false,
      });

      setModalType(null); // close modal
      setNewUserData({}); // reset form state

      // Reload the page after the success alert closes
      setTimeout(() => {
        window.location.reload();
      }, 2500); // same delay as Swal timer

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to create user',
      });
    }
  };






  const saveNewUser = async () => {
    const keyType = newUserData.keyType;
    if (!keyType || keyType === '-') throw new Error("Invalid role");

    // Step 1: Get max UserID
    const { data: maxUserIdData, error: maxUserIdError } = await supabase
      .from('Account_Users')
      .select('UserID')
      .order('UserID', { ascending: false })
      .limit(1)
      .single();

    if (maxUserIdError && maxUserIdError.code !== 'PGRST116') {
      console.error('Error fetching max UserID:', maxUserIdError);
      throw maxUserIdError;
    }

    let newUserID = (maxUserIdData?.UserID ?? 0) + 1;

    // Step 2: Ensure unique UserID
    const { data: existingUsers, error: fetchError } = await supabase
      .from('Account_Users')
      .select('id')
      .eq('UserID', newUserID)
      .limit(1);

    if (fetchError) {
      console.error('Error checking existing user:', fetchError);
      throw fetchError;
    }

    if (existingUsers.length > 0) newUserID++;

    // Step 3: Insert new user
    const userDataToSave = {
      UserID: newUserID,
      role: keyType,
      name: newUserData.name,
      salesGroup: newUserData.salesGroup,
      email: newUserData.email,
      position: newUserData.position,
      group: newUserData.group,
      contactNumber: newUserData.contactNumber,
      isActive: newUserData.isActive,
      profilePicture: newUserData.profilePicture,
      username: newUserData.username,
      password: newUserData.password,
      licensekey: newUserData.licensekey,
      PermissionRole: newUserData.PermissionRole,
    };

    const { data: insertedUser, error: insertError } = await supabase
      .from('Account_Users')
      .insert(userDataToSave)
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    const userId = insertedUser.id;

    // Step 4: Add default security settings
    const { data: existingSettings, error: settingsFetchError } = await supabase
      .from('Account_SecuritySettings')
      .select('UserCode')
      .eq('UserCode', newUserID.toString())
      .limit(1);

    if (settingsFetchError) {
      console.error('Error checking user settings:', settingsFetchError);
      throw settingsFetchError;
    }

    if (!existingSettings || existingSettings.length === 0) {
      const defaultSettings = {
        Id: userId,
        UserCode: newUserID.toString(),
        approvals: true,
        notifications: true,
        visaForms: true,
        selectedDate: new Date().toISOString().slice(0, 10),
      };

      const { error: settingsInsertError } = await supabase
        .from('Account_SecuritySettings')
        .insert(defaultSettings);

      if (settingsInsertError) {
        console.error('Settings insert error:', settingsInsertError);
        throw settingsInsertError;
      }
    }

    // Step 5: Insert new license key only if not exists
    // Step 5: Insert new license key only if not exists
    const licenseKey = newUserData.licensekey?.trim();

    if (licenseKey) {
      const { data: existingLicense, error: licenseCheckError } = await supabase
        .from('license_keys')
        .select('id')
        .eq('licensekey', licenseKey)
        .maybeSingle();

      if (licenseCheckError) {
        console.error('License key lookup error:', licenseCheckError);
        throw licenseCheckError;
      }

      if (existingLicense) {
        throw new Error(`License key "${licenseKey}" already exists. Please use a different one.`);
      }

      // ✅ Read subscriptionEnd from localStorage
      let validUntil = null;
      const storedUserRaw = localStorage.getItem('selectedLicenseUser');
      if (storedUserRaw) {
        const storedUser = JSON.parse(storedUserRaw);
        if (storedUser.subscriptionEnd?.seconds) {
          validUntil = new Date(storedUser.subscriptionEnd.seconds * 1000).toISOString();
        }
      }

      const licenseKeyRecord = {
        licensekey: licenseKey,
        status: 'Active',
        created_at: new Date().toISOString(),
        UserID: newUserID,
        UserKey: userId,
        valid_until: validUntil, // ✅ safe value
      };

      const { error: licenseInsertError } = await supabase
        .from('license_keys')
        .insert(licenseKeyRecord);

      if (licenseInsertError) {
        console.error('License key insert error:', licenseInsertError);
        throw licenseInsertError;
      }
      await updateFirestoreUserIsTaken(db, selectedService.id, selectedClientId);

    } else {
      console.warn('No license key provided — skipping license_keys insert');



    }
    return { id: userId, UserID: newUserID };
  };



  async function updateFirestoreUserIsTaken(db, serviceId, clientId) {
    try {
      const storedUserRaw = localStorage.getItem('selectedLicenseUser');
      if (!storedUserRaw) return;

      const storedUser = JSON.parse(storedUserRaw);
      const { id: userId } = storedUser;
      if (!userId || !serviceId || !clientId) return;

      const userDocRef = doc(db, "services", serviceId, "clients", clientId, "users", userId);
      const userSnapshot = await getDoc(userDocRef);

      if (!userSnapshot.exists()) {
        console.warn("Firestore document doesn't exist—cannot update isTaken.");
        return;
      }

      await updateDoc(userDocRef, { isTaken: true });
      console.log(`Firestore user ${userId} isTaken updated.`);
    } catch (error) {
      console.error("Error updating Firestore user isTaken:", error);
    }
  }



  const [settings, setSettings] = useState({});
  const [notification, setNotification] = useState(null);

  const addLog = (msg) => console.log(msg);
  const toggleSetting = async (key) => {
    const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!currentUser?.id) return;

    const newValue = !settings[key];

    const updatedSettings = {
      ...settings,
      [key]: newValue,
    };

    setSettings(updatedSettings);
    addLog(`Setting "${key}" changed to ${newValue ? 'Enabled' : 'Disabled'}`);

    // Optional Notification
    if (key === 'approvals') {
      setNotification(`Approvals have been ${newValue ? 'enabled' : 'disabled'}.`);
      setTimeout(() => setNotification(null), 4000);
    }

    try {
      const { error } = await supabase
        .from('SecuritySettings')
        .upsert([
          {
            user_id: currentUser.id,
            settings: updatedSettings,
          }
        ], { onConflict: ['user_id'] });

      if (error) {
        console.error('Error saving setting to Supabase:', error);
      }
    } catch (error) {
      console.error('Unexpected error saving setting:', error);
    }
  };

  const [positionsList, setPositionsList] = useState([]);

  useEffect(() => {
    async function fetchPositions() {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "Position");

      if (error) {
        console.error('Error fetching Positions:', error);
        setPositionsList([]);
        return;
      }

      // If data is array of objects, map or just set
      setPositionsList(data || []);
    }

    fetchPositions();
  }, []);

  // Save edited user info
  const [showLicenseUpdate, setShowLicenseUpdate] = useState(true); // initially shown

  // Utility: Check if license key exists for a different user
  async function isLicenseKeyDuplicate(licensekey, currentUserId) {
    const { data, error } = await supabase
      .from('Account_Users')
      .select('id, UserID')
      .eq('licensekey', licensekey)
      .limit(1);

    if (error) throw error;

    // If found and UserID does NOT match current user, it's a duplicate
    if (data && data.length > 0 && data[0].UserID !== currentUserId) {
      return true;
    }
    return false;
  }

  const saveEditedUser = async (e) => {
    e.preventDefault();
    if (!selectedUser || !supabaseUserId || !originalSupabaseData) return;

    try {
      // ✅ 1. Check for duplicate license key if needed
      if (showLicenseUpdate && editUserData.licensekey) {
        const duplicate = await isLicenseKeyDuplicate(editUserData.licensekey, supabaseUserId);
        if (duplicate) {
          Swal.fire('Duplicate License', 'This license key is already assigned to another user.', 'error')
            .then(() => window.location.reload());
          return;
        }
      }

      // ✅ 2. Build payload for user update
      const updatePayload = {
        role: editUserData.keyType,
        name: editUserData.name || null,
        salesGroup: editUserData.salesGroup || null,
        email: editUserData.email || null,
        position: editUserData.position || null,
        group: editUserData.group || null,
        contactNumber: editUserData.contactNumber || null,
        profilePicture: editUserData.profilePicture || null,
        username: editUserData.username || null,
        password: editUserData.password || null,
        PermissionRole: editUserData.PermissionRole || null,
      };

      if (showLicenseUpdate) {
        updatePayload.licensekey = editUserData.licensekey || null;
      }

      Object.keys(updatePayload).forEach(
        (key) => updatePayload[key] === undefined && delete updatePayload[key]
      );

      // ✅ 3. Update main user record
      const { error: userUpdateError } = await supabase
        .from('Account_Users')
        .update(updatePayload)
        .eq('id', supabaseUserId);

      if (userUpdateError) throw userUpdateError;

      // ✅ 4. Update license_keys table
      if (showLicenseUpdate && editUserData.licensekey) {
        const { data: existingLicense, error: licenseFetchError } = await supabase
          .from('license_keys')
          .select('id')
          .eq('licensekey', editUserData.licensekey)
          .limit(1);

        if (licenseFetchError) throw licenseFetchError;

        const licensePayload = {
          UserKey: supabaseUserId,
          UserID: originalSupabaseData?.UserID,
          status: 'Active',
          valid_until: convertToPostgresDate(editUserData.subscriptionEnd), // ✅ Safe now
        };

        if (existingLicense && existingLicense.length > 0) {
          const licenseId = existingLicense[0].id;

          const { error: licenseUpdateError } = await supabase
            .from('license_keys')
            .update(licensePayload)
            .eq('id', licenseId);

          if (licenseUpdateError) throw licenseUpdateError;
        } else {
          const { error: licenseInsertError } = await supabase
            .from('license_keys')
            .insert([{ licensekey: editUserData.licensekey, ...licensePayload }]);

          if (licenseInsertError) throw licenseInsertError;
        }
      }
      await updateFirestoreUserIsTakenEdit(db, selectedService.id, selectedClientId);
      localStorage.removeItem('selectedLicenseUser');
      localStorage.removeItem('selectedLicenseKey');

      // ✅ 5. Done: Show success and reset
      Swal.fire('Success', 'User updated successfully!', 'success').then(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setModalType(null);
        window.location.reload();
      });

    } catch (error) {
      Swal.fire('Error', error.message || 'Failed to update user', 'error');
    }
  };

  async function updateFirestoreUserIsTakenEdit(db, serviceId, clientId) {
    try {
      const storedUserRaw = localStorage.getItem('selectedLicenseUser');
      if (!storedUserRaw) {
        console.warn("❌ No selectedLicenseUser found in localStorage.");
        return;
      }

      const storedUser = JSON.parse(storedUserRaw);
      const userId = storedUser?.id;

      if (!userId || !serviceId || !clientId) {
        console.warn("❌ Missing serviceId, clientId, or userId.");
        return;
      }

      const userDocRef = doc(db, "services", serviceId, "clients", clientId, "users", userId);
      const userSnapshot = await getDoc(userDocRef);

      if (!userSnapshot.exists()) {
        console.warn(`❌ Firestore document does not exist at path: services/${serviceId}/clients/${clientId}/users/${userId}`);
        return;
      }

      await updateDoc(userDocRef, { isTaken: true });
      console.log(`✅ Firestore user ${userId} marked as isTaken: true`);
    } catch (error) {
      console.error("🔥 Error updating Firestore user isTaken:", error);
    }
  }


  const convertToPostgresDate = (input) => {
    if (!input) return null;

    // If it's a Firestore timestamp (has .toDate)
    if (typeof input?.toDate === 'function') {
      return input.toDate().toISOString();
    }

    // If it's a plain object with `seconds` (from JSON)
    if (input.seconds && typeof input.seconds === 'number') {
      return new Date(input.seconds * 1000).toISOString();
    }

    // Native Date object
    if (input instanceof Date) {
      return input.toISOString();
    }

    // Already an ISO string
    if (typeof input === 'string') {
      return input;
    }

    return null;
  };



  // async function updateUserInSupabase(userId, userData) {
  //   if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
  //     throw new Error('Valid numeric or string user ID is required.');
  //   }

  //   if (!userData.keyType || userData.keyType === '-') {
  //     throw new Error('Invalid role selected.');
  //   }

  //   const updatePayload = {
  //     role: userData.keyType,
  //     name: userData.name || null,
  //     salesGroup: userData.salesGroup || null,
  //     email: userData.email || null,
  //     position: userData.position || null,
  //     group: userData.group || null,
  //     contactNumber: userData.contactNumber || null,
  //     isActive: userData.isActive !== undefined ? userData.isActive : null,
  //     profilePicture: userData.profilePicture || null,
  //     username: userData.username || null,
  //     password: userData.password || null, // Remember to hash passwords in production!
  //   };

  //   // Remove undefined keys
  //   Object.keys(updatePayload).forEach(
  //     (key) => updatePayload[key] === undefined && delete updatePayload[key]
  //   );

  //   const { data, error } = await supabase
  //     .from('Account_Users')
  //     .update(updatePayload)
  //     .eq('id', userId);

  //   if (error) {
  //     console.error('Supabase update error:', error);
  //     throw new Error(error.message || 'Failed to update user in Supabase');
  //   }

  //   return data;
  // }



  // Other button handlers (just alerts for now)
  const handleApprovers = (user) => alert(`Manage approvers for: ${user.name}`);
  const handleBrands = (user) => alert(`Manage brands for: ${user.name}`);
  const handleConnection = (user) => alert(`Manage connections for: ${user.name}`);

  // Pagination

  // Filter change handler
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // For clickable image upload input, hide actual input and trigger on img click
  const fileInputIdEdit = "profilePicInputEdit";
  const fileInputIdNew = "profilePicInputNew";





  const [selectedApprover, setSelectedApprover] = useState('');
  const [approvers, setApprovers] = useState([]); // array of strings
  const [loading, setLoading] = useState(false);

  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("Account_Users")
        .select("id, name");

      if (error) {
        console.error("Error fetching users from Supabase:", error.message);
      } else if (data) {
        const usersArray = data.map(user => ({
          id: user.id,
          name: user.name || "Unnamed User",
        }));
        setUsersList(usersArray);
      }
    };

    fetchUsers();
  }, []);




  const [primaryApprovers, setPrimaryApprovers] = useState([]);
  const [secondaryApprovers, setSecondaryApprovers] = useState([]);
  const [approverType, setApproverType] = useState('');
  useEffect(() => {
    const fetchApprovers = async () => {
      if (!selectedUser) {
        console.log('No selectedUser, skipping fetch');
        return;
      }

      console.log('Fetching approvers for UserID:', selectedUser.id);

      const { data, error } = await supabase
        .from('User_Approvers')
        .select('Approver_Name, Type')
        .eq('UserID', selectedUser.id);

      if (error) {
        console.error('Error fetching approvers:', error);
        setPrimaryApprovers([]);
        setSecondaryApprovers([]);
        setTertiaryApprovers([]);
        return;
      }

      console.log('Raw data from Supabase:', data);

      // Group approvers by type
      const primary = data.filter(a => a.Type === 'primary').map(a => a.Approver_Name);
      const secondary = data.filter(a => a.Type === 'secondary').map(a => a.Approver_Name);
      const tertiary = data.filter(a => a.Type === 'tertiary').map(a => a.Approver_Name);

      console.log('Primary Approvers:', primary);
      console.log('Secondary Approvers:', secondary);
      console.log('Tertiary Approvers:', tertiary);

      setPrimaryApprovers(primary);
      setSecondaryApprovers(secondary);
      setTertiaryApprovers(tertiary);
    };

    if (modalType === 'approvers') {
      fetchApprovers();
    }
  }, [modalType, selectedUser]);






  const [approverViewMode, setApproverViewMode] = useState(null); // 'manual' or 'plan'
  const [approvalPlans, setApprovalPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [savedPlan, setSavedPlan] = useState(null); // <- to show saved data

  const fetchApprovalPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('Rev_Approval_Plan') // Supabase table name
        .select('*');

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setApprovalPlans(data);
      } else {
        setApprovalPlans([]);
        console.log("No approval plans found");
      }
    } catch (error) {
      console.error("Error fetching plans:", error.message || error);
      setApprovalPlans([]);
    }
  };

  useEffect(() => {
    if (approverViewMode === 'plan') {
      fetchApprovalPlans();
    }
  }, [approverViewMode]);

  useEffect(() => {
    if (modalType === 'approvers' && selectedUser?.id) {
      fetchUserAssignedPlan(selectedUser.id).then(plan => {
        setSavedPlan(plan); // update savedPlan with data from DB
        setSelectedPlan(''); // reset dropdown
      });
    } else {
      setSavedPlan(null);
      setSelectedPlan('');
    }
  }, [modalType, selectedUser]);
  const fetchUserAssignedPlan = async (userId) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('user_assigned_plans')
        .select('plan_data')
        .eq('user_id', userId)
        .single(); // fetch one row only

      if (error) {
        if (error.code !== 'PGRST116') { // ignore "no rows returned" error
          console.error("Error fetching user's assigned plan:", error);
        }
        return null;
      }

      return data?.plan_data ?? null;
    } catch (err) {
      console.error("Unexpected error fetching user's assigned plan:", err);
      return null;
    }
  };

  const [savedPlans, setSavedPlans] = useState([]); // ✅ store all assigned plans

  // ✅ Fetch assigned plans from Supabase
  const fetchUserAssignedPlans = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_assigned_plans')
        .select('plan_data')
        .eq('user_id', userId);

      if (error) return console.error("Error loading plans:", error);

      setSavedPlans(data.map(d => d.plan_data)); // store the JSON plan_data array
    } catch (err) {
      console.error("Error fetching assigned plans:", err);
    }
  };

  // ✅ Load plans when user or view mode changes
  useEffect(() => {
    if (selectedUser?.UserID && approverViewMode === 'plan') {
      fetchUserAssignedPlans(selectedUser.UserID);
    } else {
      setSavedPlans([]);
    }
  }, [selectedUser, approverViewMode]);


  const deletePlan = async (planId) => {
    if (!selectedUser?.id) return console.error("No selected user");

    const { error } = await supabase
      .from('user_assigned_plans')
      .delete()
      .eq('user_id', selectedUser.id)
      .eq('plan_id', planId);

    if (error) {
      console.error("❌ Error deleting plan:", error);
      return;
    }

    // Update UI after delete
    setSavedPlans(prev => prev.filter(plan => plan.id !== planId));
  };

  const assignPlanToUser = async () => {
    try {
      const plan = approvalPlans.find(p => p.id === selectedPlan);
      if (!plan) return console.error("No plan selected");
      if (!selectedUser?.id) return console.error("No selected user");

      const alreadyAssigned = savedPlans.some(p => p.id === plan.id);
      if (alreadyAssigned) {
        alert("This plan is already assigned to the user.");
        return;
      }

      const { error } = await supabase
        .from('user_assigned_plans')
        .upsert(
          [{
            user_id: selectedUser.UserID,
            plan_id: plan.id,
            plan_data: plan,
            assigned_at: new Date().toISOString()
          }],
          {
            onConflict: ['user_id', 'plan_id']
          }
        );

      if (error) {
        console.error("❌ Error inserting plan:", error);
        return;
      }

      setSavedPlans(prev => [...prev, plan]);
      setSelectedPlan('');
    } catch (error) {
      console.error("❌ Unexpected error:", error);
    }
  };





  const renderApproverLists = () => (
    <div className="mt-4">
      {primaryApprovers.length > 0 && (
        <>
          <h6>Primary Approvers:</h6>
          <ul>
            {primaryApprovers.map((app, idx) => (
              <li key={`primary-${idx}`} style={{ marginBottom: '8px' }}>
                {app}
                <Button
                  variant="outline-danger"
                  size="sm"
                  style={{ float: 'right' }}
                  onClick={() => handleRemoveApprover(app, 'primary')}
                  disabled={loading}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {secondaryApprovers.length > 0 && (
        <>
          <h6>Secondary Approvers:</h6>
          <ul>
            {secondaryApprovers.map((app, idx) => (
              <li key={`secondary-${idx}`} style={{ marginBottom: '8px' }}>
                {app}
                <Button
                  variant="outline-danger"
                  size="sm"
                  style={{ float: 'right' }}
                  onClick={() => handleRemoveApprover(app, 'secondary')}
                  disabled={loading}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {tertiaryApprovers.length > 0 && (
        <>
          <h6>Tertiary Approvers:</h6>
          <ul>
            {tertiaryApprovers.map((app, idx) => (
              <li key={`tertiary-${idx}`} style={{ marginBottom: '8px' }}>
                {app}
                <Button
                  variant="outline-danger"
                  size="sm"
                  style={{ float: 'right' }}
                  onClick={() => handleRemoveApprover(app, 'tertiary')}
                  disabled={loading}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );


  const [salesGroup, setSalesGroup] = useState([]); // Holds array of sales group options


  useEffect(() => {
    async function fetchSalesGroup() {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "SalesGroup");

      if (error) {
        console.error('Error fetching SalesGroup:', error);
        return;
      }

      // Assuming data is an array of objects, map or just set it
      setSalesGroup(data || []);
    }

    fetchSalesGroup();
  }, []);



  const [tertiaryApprovers, setTertiaryApprovers] = useState([]);
  const handleAddApprover = async () => {
    if (!selectedApprover || !approverType) return;

    const isDuplicate =
      (approverType === 'primary' && primaryApprovers.includes(selectedApprover)) ||
      (approverType === 'secondary' && secondaryApprovers.includes(selectedApprover)) ||
      (approverType === 'tertiary' && tertiaryApprovers.includes(selectedApprover));

    if (isDuplicate) {
      Swal.fire('Oops', 'This approver is already added.', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Insert into Supabase table 'User_Approvers'
      const { error } = await supabase.from('User_Approvers').insert({
        UserID: selectedUser.UserID, // use selectedUser.id here
        Approver_Name: selectedApprover,
        Type: approverType,
      });

      if (error) {
        console.error('Supabase insert error:', error);
        Swal.fire('Error', `Supabase error: ${error.message}`, 'error');
        setLoading(false);
        return;
      }

      // Update local state
      if (approverType === 'primary') {
        setPrimaryApprovers([...primaryApprovers, selectedApprover]);
      } else if (approverType === 'secondary') {
        setSecondaryApprovers([...secondaryApprovers, selectedApprover]);
      } else if (approverType === 'tertiary') {
        setTertiaryApprovers([...tertiaryApprovers, selectedApprover]);
      }

      setSelectedApprover('');
      setApproverType('');
      Swal.fire('Saved', 'Approver added successfully', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
    setLoading(false);
  };



  const handleRemoveApprover = async (approverToRemove, type) => {
    setLoading(true);
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('User_Approvers')
        .delete()
        .match({
          UserID: selectedUser.id,
          Approver_Name: approverToRemove,
          Type: type,
        });

      if (error) throw error;

      // Update local state
      if (type === 'primary') {
        setPrimaryApprovers(primaryApprovers.filter(a => a !== approverToRemove));
      } else if (type === 'secondary') {
        setSecondaryApprovers(secondaryApprovers.filter(a => a !== approverToRemove));
      } else if (type === 'tertiary') {
        setTertiaryApprovers(tertiaryApprovers.filter(a => a !== approverToRemove));
      }

      Swal.fire('Removed', 'Approver removed successfully', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
    setLoading(false);
  };



  const [brands, setBrands] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const maxBrandsAllowed = 30; // or 1, or 10 — change as needed

  const [loadingBrands, setLoadingBrands] = useState(false);

  useEffect(() => {
    const fetchBrands = async () => {
      if (modalType !== 'brands') return;

      setLoadingBrands(true);

      // Fetch Branddetails where parentname is NOT null
      let { data: brandsData, error: brandsError } = await supabase
        .from('Branddetails')
        .select('name')
        .not('parentname', 'is', null)  // <-- Only get brands with parentname
        .order('name', { ascending: true });

      if (brandsError) {
        console.error('Error fetching brands:', brandsError);
        setBrands([]);
      } else {
        const brandList = brandsData?.map((b) => b.name) || [];
        setBrands(brandList);
      }

      // Fetch user's saved brands
      const { data: userBrands, error: userBrandsError } = await supabase
        .from('User_Brands')
        .select('Brand')
        .eq('UserID', supabaseUserID);

      if (userBrandsError) {
        console.error('Error fetching user brands:', userBrandsError);
        setSelectedBrands([]);
      } else {
        const saved = userBrands?.map((b) => b.Brand) || [];
        setSelectedBrands(saved);
      }

      setLoadingBrands(false);
    };

    fetchBrands();
  }, [modalType, supabaseUserID]);





  const handleBrandToggle = (brand) => {
    if (selectedBrands.includes(brand)) {
      setSelectedBrands(selectedBrands.filter((b) => b !== brand));
    } else if (selectedBrands.length < maxBrandsAllowed) {
      setSelectedBrands([...selectedBrands, brand]);
    }
  };

  const saveUserBrands = async ({
    userId,
    supabaseUserId,
    brandsToSave,
    setLoading,
    setModalType,
  }) => {
    if (!userId || !supabaseUserId) {
      console.error('User ID or Supabase User ID is missing');
      return;
    }

    setLoading(true);

    try {
      // 1. Remove existing user-brand mappings from Supabase
      const { error: delError } = await supabase
        .from('User_Brands')
        .delete()
        .eq('UserID', supabaseUserId);

      if (delError) {
        console.error('Error deleting old User_Brands:', delError);
        throw delError;
      }

      // 2. Insert new brand selections
      const inserts = brandsToSave.map((brand) => ({
        UserID: supabaseUserId,
        Brand: brand,
      }));

      const { error: insertError } = await supabase
        .from('User_Brands')
        .insert(inserts);

      if (insertError) {
        console.error('Error inserting User_Brands:', insertError);
        throw insertError;
      }

      alert('Brands saved successfully!');
      setModalType(null); // close modal after save
    } catch (error) {
      console.error('Failed to save brands:', error);
      alert('Error saving brands');
    } finally {
      setLoading(false);
    }
  };


  const handleSaveBrands = () => {
    saveUserBrands({
      userId: selectedUser?.id,
      supabaseUserId: supabaseUserID, // your Supabase user id state
      brandsToSave: selectedBrands,
      setLoading,
      setModalType,
    });
  };






  const [salesDivisions, setSalesDivisions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState('');

  // Fetch SalesDivision list when modal opens
  useEffect(() => {
    if (modalType === "connection") {
      const fetchSalesDivisions = async () => {
        try {
          const { data, error } = await supabase
            .from("References")
            .select("*")
            .eq("reference_type", "SalesDivision");

          if (error) {
            throw error;
          }

          if (data && data.length > 0) {
            const divisions = data.map((item) => ({
              id: item.id, // or another unique identifier
              name: item.name || item.label || item.value || "Unnamed",
            }));
            setSalesDivisions(divisions);
          } else {
            setSalesDivisions([]);
          }
        } catch (error) {
          console.error("Error fetching SalesDivisions from Supabase:", error);
          setSalesDivisions([]);
        }
      };

      fetchSalesDivisions();
    }
  }, [modalType]);
  // Fetch user's current sales division when modal opens or selectedUser changes


  const [selectedDivisions, setSelectedDivisions] = useState([]);

  // When modal opens, reset or load selected divisions (optional)
  useEffect(() => {
    if (modalType === 'connection' && selectedUser) {
      // Example: fetch existing divisions from database or reset array
      // For demo, resetting here:
      setSelectedDivisions([]); // or set to existing divisions if you fetch them
    }
  }, [modalType, selectedUser]);
  const handleDivisionToggle = (divisionName) => {
    setSelectedDivisions(prev =>
      prev.includes(divisionName)
        ? prev.filter(d => d !== divisionName)
        : [...prev, divisionName]
    );
  };

  // Save divisions to Firebase as an object with numeric keys
  const handleSaveDivisions = async () => {
    if (selectedDivisions.length === 0) {
      Swal.fire('Error', 'Please select at least one Sales Division.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Delete old connections for this user to prevent duplicates
      const { error: delError } = await supabase
        .from('User_Connections')
        .delete()
        .eq('UserID', supabaseUserID);

      if (delError) {
        console.error('Error deleting old User_Connections:', delError);
        throw delError;
      }

      // Step 2: Insert new connections, each division as a row, with flags on each
      const inserts = selectedDivisions.map(div => ({
        UserID: supabaseUserID,
        Division: div,
        IncludeBUHead: includeBUHead,
        IncludeVPSales: includeVPSales,
      }));

      const { error: insertError } = await supabase
        .from('User_Connections')
        .insert(inserts);

      if (insertError) {
        console.error('Error inserting User_Connections:', insertError);
        throw insertError;
      }

      Swal.fire('Success', 'Sales Divisions and settings saved successfully.', 'success');
      setModalType(null);
    } catch (error) {
      console.error('Failed to save Sales Divisions:', error);
      Swal.fire('Error', 'Failed to save Sales Divisions.', 'error');
    }
    setLoading(false);
  };



  useEffect(() => {
    const fetchSavedConnections = async () => {
      if (!selectedUser) return;

      // Replace `selectedUser.id` with your actual user ID in Supabase if different
      const { data, error } = await supabase
        .from('User_Connections')
        .select('Division, IncludeBUHead, IncludeVPSales')
        .eq('UserID', selectedUser.id);

      if (error) {
        console.error('Error fetching User_Connections:', error);
        setSelectedDivisions([]);
        setIncludeBUHead(false);
        setIncludeVPSales(false);
        return;
      }

      console.log('Fetched User_Connections:', data);

      // Extract divisions
      const divisions = data.map(row => row.Division);

      // Extract flags (assuming flags are the same for all rows; pick from first or default false)
      const includeBUHeadFlag = data.length > 0 ? data[0].IncludeBUHead : false;
      const includeVPSalesFlag = data.length > 0 ? data[0].IncludeVPSales : false;

      setSelectedDivisions(divisions);
      setIncludeBUHead(includeBUHeadFlag);
      setIncludeVPSales(includeVPSalesFlag);
    };

    if (modalType === 'connection') {
      fetchSavedConnections();
    } else {
      // Clear selections if modal closed
      setSelectedDivisions([]);
      setIncludeBUHead(false);
      setIncludeVPSales(false);
    }
  }, [modalType, selectedUser]);

  const [includeBUHead, setIncludeBUHead] = useState(false);
  const [includeVPSales, setIncludeVPSales] = useState(false);

  const [Department, setDepartment] = useState([]);
  const [PermissionRole, setPermissionRole] = useState([]);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "Department");

      if (error) {
        console.error('Error loading groups:', error);
        setDepartment([]);
      } else {
        // Keep the full objects, so you can access pos.name and pos.description
        setDepartment(data || []);
      }
    };

    fetchGroups();
  }, []);

  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from("References")
        .select("*")
        .eq("reference_type", "UserRole");

      if (error) {
        console.error('Error loading groups:', error);
        setPermissionRole([]);
      } else {
        // Keep the full objects, so you can access pos.name and pos.description
        setPermissionRole(data || []);
      }
    };

    fetchGroups();
  }, []);


  const [rolePermissions, setRolePermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);

  // Fetch RolePermissions from Firebase on component mount or modal open
  useEffect(() => {
    const fetchRolePermissions = async () => {
      if (modalType === "changeRole") {
        try {
          const { data, error } = await supabase
            .from("RolePermissions")
            .select("*");

          if (error) throw error;

          const rolesArray = data.map((role) => ({
            value: role.key || role.id, // adjust field based on your schema
            label: role.label || role.key || role.id,
          }));

          setRolePermissions(rolesArray);
        } catch (error) {
          console.error("Error fetching role permissions:", error.message || error);
          setRolePermissions([]);
        }
      }
    };

    fetchRolePermissions();
  }, [modalType]);


  // Set selectedRole when selectedUser changes
  useEffect(() => {
    if (selectedUser?.role) {
      setSelectedRole(selectedUser.role);
    } else {
      setSelectedRole(null);
    }
  }, [selectedUser]);



  const formatDate = (date) => {
    if (!date) return "-";
    if (date.toDate) date = date.toDate();
    return date instanceof Date ? date.toLocaleDateString("en-US") : "-";
  };

  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [licenseKeys, setLicenseKeys] = useState([]);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseCards, setLicenseCards] = useState([]);
  const [editingMode, setEditingMode] = useState(false);
  const [filteredServices, setFilteredServices] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [viewingClient, setViewingClient] = useState(false);
  const [viewingServiceDetails, setViewingServiceDetails] = useState(false);

  useEffect(() => {
    fetchLicenseCards();
  }, []);

  const fetchLicenseCards = async () => {
    setLoadingUsers(true); // or a separate loading flag if needed

    try {
      const { data: supabaseLicenses, error } = await supabase
        .from('subscription_licenses')
        .select('key');

      if (error) throw error;

      const supabaseKeys = supabaseLicenses.map(item => item.key);
      console.log("Supabase Keys:", supabaseKeys);

      const ref = collection(db, "services");
      const snapshot = await getDocs(ref);

      const filtered = snapshot.docs
        .filter(doc => supabaseKeys.includes(doc.id))
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          hasLicense: true,
        }));

      console.log("Matched Firebase Services:", filtered);
      setFilteredServices(filtered);
    } catch (err) {
      console.error("Error loading license cards:", err);
      setFilteredServices([]);
    } finally {
      setLoadingUsers(false);
    }
  };



  const handleLicenseKeySelect = (licenseKey) => {
    setNewUserData((prev) => ({ ...prev, licensekey: licenseKey }));
    setLicenseModalOpen(false);
  };


  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [client, setClient] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [usersByClient, setUsersByClient] = useState({});

  useEffect(() => {
    if (!selectedService?.id) {
      setClients([]);
      return;
    }
    setLoadingClients(true);
    getDocs(collection(db, "services", selectedService.id, "clients"))
      .then(snap => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      })
      .catch(err => {
        console.error(err);
        setClients([]);
      })
      .finally(() => setLoadingClients(false));
  }, [selectedService]);

  useEffect(() => {
    const fetchClientAndUsers = async () => {
      if (!selectedService?.id) {
        setClient(null);
        setUsers([]);
        return;
      }
      setLoadingUsers(true);
      try {
        const clientsCol = collection(db, "services", selectedService.id, "clients");
        const clientsSnap = await getDocs(clientsCol);
        if (clientsSnap.empty) {
          setClient(null);
          setUsers([]);
        } else {
          const clientDoc = clientsSnap.docs[0];
          const clientData = { id: clientDoc.id, ...clientDoc.data() };
          setClient(clientData);

          const usersCol = collection(db, "services", selectedService.id, "clients", clientDoc.id, "users");
          const usersSnap = await getDocs(usersCol);
          setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error(err);
        setClient(null);
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchClientAndUsers();
  }, [selectedService]);

  const handleRowClick = (user) => {
    setSelectedUser(user);
    setLicenseModalOpen(false);

    // 🧠 Save all user data into localStorage
    localStorage.setItem('selectedLicenseUser', JSON.stringify(user));

    // Optional: store only the licensekey as a separate item
    const licenseKey = user.licenseKey || '';
    localStorage.setItem('selectedLicenseKey', licenseKey);

    // 🧠 Update the form state
    setNewUserData(prev => ({
      ...prev,
      licensekey: licenseKey,



      // Optionally prefill other fields from user
      userCode: user.userCode || '',
      subscriptionStart: user.subscriptionStart,
      subscriptionEnd: user.subscriptionEnd,
    }));
  };


  const handleRowClickedit = (user) => {
    console.log('Clicked user:', user);

    const licenseKey = user.licenseKey || '';

    setEditUserData(prev => ({
      ...prev,
      licensekey: licenseKey, // ✅ MUST match form input's name
      userCode: user.userCode || '',
      subscriptionStart: user.subscriptionStart,
      subscriptionEnd: user.subscriptionEnd,
    }));

    localStorage.setItem('selectedLicenseUser', JSON.stringify(user));
    localStorage.setItem('selectedLicenseKey', licenseKey);

    setLicenseModalOpen(false);
  };


  useEffect(() => {
    const storedUser = localStorage.getItem('selectedLicenseUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setNewUserData(prev => ({
        ...prev,
        licensekey: parsedUser.id || '',
        userCode: parsedUser.userCode || '',
        subscriptionStart: parsedUser.subscriptionStart || null,
        subscriptionEnd: parsedUser.subscriptionEnd || null,
      }));
    }
  }, []);
  const [licenses, setLicenses] = useState({}); // store licenses by UserID

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("Account_Users")
        .select("*");

      if (usersError) {
        console.error("Error fetching users:", usersError);
        return;
      }

      setUsers(usersData || []);

      // 2. Fetch licenses for those users
      const userIds = usersData.map((u) => u.UserID);

      const { data: licenseData, error: licenseError } = await supabase
        .from("license_keys")
        .select("*")
        .in("UserID", userIds);

      if (licenseError) {
        console.error("Error fetching licenses:", licenseError);
        return;
      }

      // Convert licenses array to dictionary by UserID for quick lookup
      const licenseDict = {};
      (licenseData || []).forEach((license) => {
        licenseDict[license.UserID] = license;
      });
      setLicenses(licenseDict);
    }

    fetchData();
  }, []);






  return (
    <Container>
      <h2 className="my-4">User Management</h2>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <Button variant="primary" onClick={openCreateModal}>
          <FaPlus className="me-2" /> Create User
        </Button>




        <Form className="d-flex flex-wrap gap-3" style={{ flexGrow: 1, marginLeft: '1rem' }}>
          <Form.Group controlId="filterGroup" style={{ minWidth: 150 }}>
            <Form.Label>Department</Form.Label>
            <Form.Select name="group" value={filters.group} onChange={handleFilterChange}>
              <option value="">All</option>
              {groups.map(group => <option key={group} value={group}>{group}</option>)}
            </Form.Select>
          </Form.Group>

          <Form.Group controlId="filterPosition" style={{ minWidth: 150 }}>
            <Form.Label>Position</Form.Label>
            <Form.Select name="position" value={filters.position} onChange={handleFilterChange}>
              <option value="">All</option>
              {positions.map(position => <option key={position} value={position}>{position}</option>)}
            </Form.Select>
          </Form.Group>

          <Form.Group controlId="filterRole" style={{ minWidth: 150 }}>
            <Form.Label>Sales Group (Role)</Form.Label>
            <Form.Select name="role" value={filters.role} onChange={handleFilterChange}>
              <option value="">All</option>
              {roles.map(role => <option key={role} value={role}>{role}</option>)}
            </Form.Select>
          </Form.Group>
        </Form>
        <Button variant="primary" onClick={() => setCurrentView('RolePermissionForm')}>
          <FaPlus className="me-2" /> Role Permission
        </Button>
      </div>


      <Row xs={1} sm={2} md={3} className="g-4">
        {paginatedUsers.length > 0 ? (
          paginatedUsers.map((user) => {
            const userLicense = licenses[user.UserID];

            let daysLeft = null;
            let showExpiryWarning = false;

            if (userLicense?.valid_until) {
              const now = new Date();
              const expiryDate = new Date(userLicense.valid_until);
              const diffTime = expiryDate - now;
              daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (daysLeft <= 5 && daysLeft >= 0) {
                showExpiryWarning = true;
              }
            }

            return (
              <Col key={user.id}>
                <Card className="shadow-sm h-100">
                  <Card.Body>
                    {showExpiryWarning && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 10,
                          color: '#d9534f',
                          fontWeight: 'bold',
                        }}
                        title={`License expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                      >
                        <FaExclamationTriangle size={20} />
                        <span>
                          License expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}!
                        </span>
                      </div>
                    )}

                    <Row className="align-items-center">
                      <Col xs={12} sm={4} className="text-center mb-3 mb-sm-0">
                        <img
                          src={user.profilePicture || `https://i.pravatar.cc/150?img=${user.id}`}
                          alt={`${user.name}'s profile`}
                          style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #ccc',
                            cursor: 'pointer',
                          }}
                          onClick={() => openModal(user, 'edit')}
                          title="Click to edit profile picture"
                        />
                      </Col>

                      <Col xs={12} sm={8}>
                        <Card.Title>{user.name}</Card.Title>
                        <Card.Subtitle className="mb-2 text-muted">{user.role}</Card.Subtitle>
                        <Card.Text>
                          <strong>Position:</strong> {user.position}
                          <br />
                          <strong>Email:</strong> {user.email}
                          <br />
                          <strong>Contact Number:</strong> {user.contactNumber || 'N/A'}
                          <br />
                          <strong>Group:</strong>{' '}
                          <Badge
                            bg={
                              user.group === 'Office'
                                ? 'primary'
                                : user.group === 'Build'
                                  ? 'warning'
                                  : user.group === 'Home'
                                    ? 'success'
                                    : 'secondary'
                            }
                          >
                            {user.group}
                          </Badge>
                        </Card.Text>
                      </Col>
                    </Row>

                    <div className="d-flex justify-content-between flex-wrap mt-3">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => openModal(user, 'edit')}
                        title="Edit"
                        className="mb-1"
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        variant="outline-success"
                        size="sm"
                        onClick={() => openModal(user, 'approvers')}
                        title="Approvers"
                        className="mb-1"
                      >
                        <FaUserShield />
                      </Button>
                      <Button
                        variant="outline-warning"
                        size="sm"
                        onClick={() => openModal(user, 'brands')}
                        title="Brands"
                        className="mb-1"
                      >
                        <FaTags />
                      </Button>
                      <Button
                        variant="outline-info"
                        size="sm"
                        onClick={() => openModal(user, 'connection')}
                        title="Connection"
                        className="mb-1"
                      >
                        <FaPlug />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => openModal(user, 'deactivate')}
                        title="Deactivate"
                        className="mb-1"
                      >
                        <FaUserSlash />
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })
        ) : (
          <Col>
            <p>No users found with these filters.</p>
          </Col>
        )}
      </Row>


      {/* Pagination Controls */}
      <footer
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          padding: "0.5rem 1rem",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "10px",

          width: '100%',
        }}
      >
        <Button
          variant="secondary"
          onClick={goToPrevious}
          disabled={currentPage === 1}
          style={{ cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
        >
          Previous
        </Button>
        <span>Page {currentPage} of {totalPages}</span>
        <Button
          variant="secondary"
          onClick={goToNext}
          disabled={currentPage === totalPages || totalPages === 0}
          style={{ cursor: currentPage === totalPages || totalPages === 0 ? "not-allowed" : "pointer" }}
        >
          Next
        </Button>
      </footer>

      {/* Modals */}

      <Modal
        show={modalType === 'create'}
        onHide={() => setModalType(null)}
        dialogClassName="modal-wide-custom"
        centered
        backdrop="static"
        keyboard={true}
      >

        <Modal.Header closeButton>
          <Modal.Title>Create New User</Modal.Title>
        </Modal.Header>

        <Form onSubmit={handleCreateUserSubmit}>
          <Modal.Body>
            <Row className="mb-4">
              {/* Profile Picture on the top-left */}
              <Col md={3} className="d-flex flex-column align-items-center">
                <Form.Label>Profile Picture</Form.Label>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    border: '2px dashed #ccc',
                    position: 'relative',
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                  onClick={() => document.getElementById(fileInputIdNew).click()}
                >
                  {newUserData.profilePicture ? (
                    <img
                      src={newUserData.profilePicture}
                      alt="Profile"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: '#666',
                        fontSize: 16,
                      }}
                    >
                      Upload
                    </div>
                  )}

                  {/* Camera icon overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: '50%',
                      padding: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      fill="#fff"
                      viewBox="0 0 16 16"
                    >
                      <path d="M10.5 2a.5.5 0 0 1 .5.5V3h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1v-.5a.5.5 0 0 1 .5-.5h6zM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                    </svg>
                  </div>
                </div>

                <Form.Control
                  type="file"
                  id={fileInputIdNew}
                  accept="image/*"
                  onChange={handleNewUserImageChange}
                  style={{ display: 'none' }}
                />
              </Col>

              {/* Right side: License Key, Username, Password */}
              <Col md={9}>
                <Form.Group controlId="licenseKey" className="mb-3">
                  <Form.Label>License Key</Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Form.Control
                      type="text"
                      name="licensekey"
                      value={newUserData.licensekey}
                      onChange={handleNewUserChange}
                    />
                    <button
                      type="button"
                      className="glass-button"
                      onClick={() => {
                        fetchLicenseCards();
                        setLicenseModalOpen(true);
                      }}
                      title="Browse license keys"
                      style={{ position: 'absolute', right: 5, top: 5 }}
                    >
                      🔍
                    </button>
                  </div>
                </Form.Group>

                <Modal show={licenseModalOpen} onHide={() => setLicenseModalOpen(false)} centered size="xl" scrollable>
                  <Modal.Header closeButton>
                    <Modal.Title>Select License Key</Modal.Title>
                  </Modal.Header>

                  <Modal.Body>
                    {loading ? (
                      <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status" aria-label="Loading">
                          <span className="visually-hidden">Loading license keys…</span>
                        </div>
                        <p className="mt-3 mb-0 text-muted">Loading license keys…</p>
                      </div>
                    ) : (
                      <>
                        {/* Service License Cards */}
                        {!viewingServiceDetails && (
                          <div className="d-flex flex-wrap gap-3 justify-content-start mb-4">
                            {filteredServices.length === 0 ? (
                              <p className="text-muted fst-italic">No license keys found.</p>
                            ) : (
                              filteredServices.map((item) => (
                                <div
                                  key={item.id}
                                  className="card shadow-sm border border-secondary"
                                  style={{
                                    width: "18rem",
                                    cursor: "pointer",
                                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                  }}
                                  onClick={async () => {
                                    setSelectedService(item);
                                    setClients([]);
                                    setUsersByClient({});
                                    setLoadingUsers(true);
                                    setViewingServiceDetails(true);

                                    try {
                                      const clientsRef = collection(db, "services", item.id, "clients");
                                      const clientSnap = await getDocs(clientsRef);
                                      const clientList = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                      setClients(clientList);

                                      const usersMap = {};

                                      for (const client of clientList) {
                                        const usersRef = collection(db, "services", item.id, "clients", client.id, "users");
                                        const userSnap = await getDocs(usersRef);
                                        usersMap[client.id] = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                      }

                                      setUsersByClient(usersMap);
                                    } catch (err) {
                                      console.error("Error loading clients and users:", err);
                                      setClients([]);
                                      setUsersByClient({});
                                    } finally {
                                      setLoadingUsers(false);
                                    }
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.transform = "scale(1.03)";
                                    e.currentTarget.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.15)";
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.transform = "none";
                                    e.currentTarget.style.boxShadow = "none";
                                  }}
                                  aria-label={`Select license service ${item.name || 'Unnamed'}`}
                                >
                                  <div className="card-body">
                                    <h5 className="card-title text-truncate" title={item.id}>ID: {item.id}</h5>
                                    <h6 className="card-subtitle mb-2 text-primary text-truncate" title={item.name || "N/A"}>
                                      Name: {item.name || "N/A"}
                                    </h6>
                                    <p className="card-text text-muted mb-0">
                                      <small>
                                        <strong>Created:</strong>{" "}
                                        {item.createdAt
                                          ? new Date(item.createdAt.seconds * 1000).toLocaleString()
                                          : "Unknown"}
                                      </small>
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {/* Client Details Card */}
                        {selectedService && (
                          <div className="card border-info shadow-sm mt-3">
                            <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
                              <h5 className="mb-0">
                                {viewingClient
                                  ? `Client Details for Service ID: ${selectedService.id}`
                                  : `Clients for Service ID: ${selectedService.id}`}
                              </h5>

                              {viewingClient && (
                                <button
                                  className="btn btn-light btn-sm"
                                  onClick={() => {
                                    setViewingClient(false);
                                    setSelectedClientId(null);
                                  }}
                                  aria-label="Back to client list"
                                >
                                  ← Back to Clients
                                </button>
                              )}
                            </div>

                            <div className="card-body">
                              {loadingUsers ? (
                                <div className="text-center py-5">
                                  <div className="spinner-border text-info" role="status" aria-label="Loading clients and users">
                                    <span className="visually-hidden">Loading client info...</span>
                                  </div>
                                  <p className="mt-3 mb-0 text-muted">Loading client info...</p>
                                </div>
                              ) : clients.length === 0 ? (
                                <p className="text-muted fst-italic">No clients found for this service.</p>
                              ) : viewingClient && selectedClientId ? (
                                (() => {
                                  const client = clients.find(c => c.id === selectedClientId);
                                  if (!client) return <p className="text-danger">Client not found.</p>;

                                  return (
                                    <>
                                      <h5 className="mb-2">{client.name || "Client Name N/A"}</h5>
                                      <p className="mb-3"><strong>Client ID:</strong> {client.id}</p>

                                      <h6 className="mb-3">Users</h6>

                                      {usersByClient[client.id]?.length > 0 ? (
                                        <div
                                          style={{ maxHeight: "300px", overflowY: "auto" }}
                                          className="table-responsive"
                                          tabIndex={0}
                                          aria-label="Users table"
                                        >
                                          <table className="table table-bordered table-hover table-sm mb-0 align-middle">
                                            <thead
                                              style={{
                                                position: "sticky",
                                                top: 0,
                                                backgroundColor: "#0d6efd", // Bootstrap primary blue
                                                color: "#fff",
                                                zIndex: 1,
                                              }}
                                            >
                                              <tr>
                                                <th>License ID</th>
                                                <th>User Code</th>
                                                <th>Date Created</th>
                                                <th>Is Taken?</th>
                                                <th>Subscription Start</th>
                                                <th>Subscription End</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {usersByClient[client.id].map((user) => {
                                                const isTaken = user.isTaken;

                                                // Colors & styles for taken and available users
                                                const rowStyle = {
                                                  cursor: isTaken ? "default" : "pointer",
                                                  backgroundColor: isTaken ? "#e9ecef" : "transparent",
                                                  color: isTaken ? "#6c757d" : "inherit",
                                                  pointerEvents: isTaken ? "none" : "auto",
                                                  transition: "background-color 0.3s ease",
                                                };

                                                const hoverBg = isTaken ? "#dee2e6" : "#cff4fc";

                                                return (
                                                  <tr
                                                    key={user.id}
                                                    style={rowStyle}
                                                    onClick={() => !isTaken && handleRowClick(user)}
                                                    onMouseEnter={(e) => {
                                                      e.currentTarget.style.backgroundColor = hoverBg;
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.currentTarget.style.backgroundColor = rowStyle.backgroundColor;
                                                    }}
                                                    aria-disabled={isTaken}
                                                    aria-label={
                                                      isTaken
                                                        ? `User ${user.userCode || 'N/A'} is taken`
                                                        : `Select user ${user.userCode || 'N/A'}`
                                                    }
                                                  >
                                                    <td>{user.licenseKey}</td>
                                                    <td>{user.userCode || "N/A"}</td>
                                                    <td>
                                                      {user.createdAt
                                                        ? new Date(user.createdAt.seconds * 1000).toLocaleString()
                                                        : "Unknown"}
                                                    </td>
                                                    <td
                                                      style={{
                                                        backgroundColor: isTaken ? "#f8d7da" : "transparent",
                                                        color: isTaken ? "#721c24" : "inherit",
                                                        fontWeight: "600",
                                                        textAlign: "center",
                                                      }}
                                                    >
                                                      {isTaken ? "Yes" : "No"}
                                                    </td>
                                                    <td>{formatDate(user.subscriptionStart)}</td>
                                                    <td>{formatDate(user.subscriptionEnd)}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="text-muted fst-italic">No users found for this client.</p>
                                      )}
                                    </>
                                  );
                                })()
                              ) : (
                                // Clients list
                                clients.map((client) => (
                                  <div
                                    key={client.id}
                                    className="card mb-3 shadow-sm border border-secondary"
                                    style={{ cursor: "pointer", transition: "background-color 0.15s ease" }}
                                    onClick={() => {
                                      setSelectedClientId(client.id);
                                      setViewingClient(true);
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = "#e9ecef";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "white";
                                    }}
                                    aria-label={`Select client ${client.name || "Unnamed"}`}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        setSelectedClientId(client.id);
                                        setViewingClient(true);
                                      }
                                    }}
                                  >
                                    <div className="card-body">
                                      <h5 className="mb-1">{client.name || "Client Name N/A"}</h5>
                                      <p className="mb-0"><strong>Client ID:</strong> {client.id}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </Modal.Body>
                </Modal>








                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="newUserUsername">
                      <Form.Label>Username</Form.Label>
                      <Form.Control
                        type="text"
                        name="username"
                        value={newUserData.username}
                        onChange={handleNewUserChange}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="newUserPassword">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        value={newUserData.password}
                        onChange={handleNewUserChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

              </Col>
            </Row>



            {/* All User Info Fields */}
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="editUserName">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={newUserData.name}
                    onChange={handleNewUserChange}
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="newUserEmail">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={newUserData.email}
                    onChange={handleNewUserChange}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3" controlId="newUserContactNumber">
                  <Form.Label>Contact Number</Form.Label>
                  <Form.Control
                    type="text"
                    name="contactNumber"
                    value={newUserData.contactNumber}
                    onChange={handleNewUserChange}
                  />
                </Form.Group>

              </Col>

              <Col md={6}>
                <Form.Group className="mb-3" controlId="newsalesGroup">
                  <Form.Label>Sales Group</Form.Label>
                  <Form.Select
                    name="salesGroup"
                    value={newUserData.salesGroup || ''}
                    onChange={handleNewUserChange}
                    required
                  >
                    <option value="" disabled>-- Select Sales Group --</option>
                    {salesGroup.map((group, idx) => (
                      <option key={idx} value={group.name}>{group.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3" controlId="newUserPosition">
                  <Form.Label>Position</Form.Label>
                  <Form.Control
                    as="select"
                    name="position"
                    value={newUserData.position}
                    onChange={(e) => {
                      handleNewUserChange(e);
                      setSelectedApprover(e.target.value);
                    }}
                    disabled={loading}
                    required
                  >
                    <option value="">-- Select Position --</option>
                    {positionsList.map((pos, idx) => (
                      <option key={idx} value={pos.name}>
                        {pos.name} - {pos.description}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>

                <Form.Group className="mb-3" controlId="newUserGroup">
                  <Form.Label>Department</Form.Label>
                  <Form.Select
                    name="group"
                    value={newUserData.group}
                    onChange={handleNewUserChange}
                    required
                  >
                    <option value="">-- Select Department --</option>
                    <option value="All">All</option>
                    {Department.map((pos, idx) => (
                      <option key={idx} value={pos.name}>
                        {pos.name} - {pos.description}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>


              </Col>
            </Row>

            <Row>

              <Col md={6}>
                <Form.Group className="mb-3" controlId="newUserKeyType">
                  <Form.Label>User Type</Form.Label>
                  <Form.Control
                    as="select"
                    name="keyType"
                    value={newUserData.keyType}
                    onChange={handleNewUserChange}
                    required
                  >
                    <option value="">Select</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </Form.Control>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="newUserGroup">
                  <Form.Label>Permission Role</Form.Label>
                  <Form.Select
                    name="PermissionRole"
                    value={newUserData.PermissionRole}
                    onChange={handleNewUserChange}
                    required
                  >
                    <option value="">-- Select Permission --</option>
                    <option value="All">All</option>
                    {PermissionRole.map((pos, idx) => (
                      <option key={idx} value={pos.name}>
                        {pos.name}  {pos.description}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>


          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setModalType(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create User
            </Button>
          </Modal.Footer>
        </Form>
      </Modal >


      {/* Edit User Modal */}

      < Modal
        show={modalType === 'edit'}
        onHide={() => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          setModalType(null);
        }}
        dialogClassName="modal-wide-custom"
        centered
        backdrop="static"
        keyboard={true}
      >
        <Modal.Header closeButton>
          <Modal.Title>Edit User</Modal.Title>
        </Modal.Header>

        <Form onSubmit={saveEditedUser}>
          <Modal.Body>
            <Row className="mb-4">
              {/* Profile Picture on the top-left */}
              <Col md={3} className="d-flex flex-column align-items-center">
                <Form.Label>Profile Picture</Form.Label>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    border: '2px dashed #ccc',
                    position: 'relative',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: '#666',
                    fontSize: 16,
                  }}
                  onClick={() => document.getElementById(fileInputIdEdit).click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') document.getElementById(fileInputIdEdit).click();
                  }}
                >
                  {editUserData.profilePicture ? (
                    <img
                      src={editUserData.profilePicture}
                      alt="Profile"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    'Upload'
                  )}

                  {/* Camera icon overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: '50%',
                      padding: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      fill="#fff"
                      viewBox="0 0 16 16"
                    >
                      <path d="M10.5 2a.5.5 0 0 1 .5.5V3h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1v-.5a.5.5 0 0 1 .5-.5h6zM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                    </svg>
                  </div>
                </div>
                <Form.Control
                  type="file"
                  id={fileInputIdEdit}
                  accept="image/*"
                  onChange={handleEditUserImageChange}
                  style={{ display: 'none' }}
                />
              </Col>


              {/* Right side: License Key, Username, Password */}
              <Col md={9}>
                <>
                  <div className="mb-2">
                    <strong>Update the License Key?</strong>
                    <div>
                      <Button
                        variant="outline-success"
                        size="sm"
                        onClick={() => setShowLicenseUpdate(true)}
                        className="me-2"
                      >
                        Yes
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => {
                          setShowLicenseUpdate(false);
                          setEditUserData(prev => ({
                            ...prev,
                            licensekey: originalSupabaseData.licensekey || '',
                          }));
                        }}
                      >
                        No
                      </Button>
                    </div>
                  </div>

                  {showLicenseUpdate ? (
                    <Form.Group className="mb-3" controlId="editUserLicenseKey">
                      <Form.Label>License Key</Form.Label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Form.Control
                          type="text"
                          name="licensekey"
                          value={editUserData.licensekey || ''}
                          onChange={handleEditUserChange}
                        />

                        {/* Browse Button */}
                        <button
                          type="button"
                          className="glass-button"
                          onClick={() => {
                            fetchLicenseCards();
                            setLicenseModalOpen(true);
                          }}
                          title="Browse license keys"
                          style={{
                            position: 'absolute',
                            top: '50%',
                            right: 36,
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            fontSize: '18px',
                            cursor: 'pointer',
                          }}
                        >
                          🔍
                        </button>

                        {/* Remove Button */}
                        <button
                          type="button"
                          className="glass-button"
                          title="Remove License Key"
                          onClick={async () => {
                            const key = editUserData.licensekey;
                            if (!key) return;

                            const result = await Swal.fire({
                              title: 'Are you sure?',
                              text: 'Do you want to remove this license key?',
                              icon: 'warning',
                              showCancelButton: true,
                              confirmButtonText: 'Yes, remove it',
                              cancelButtonText: 'No, keep it',
                              reverseButtons: true,
                            });

                            if (result.isConfirmed) {
                              try {
                                const { error: updateError } = await supabase
                                  .from('license_keys')
                                  .update({
                                    UserID: 0,
                                    status: 'Inactive',
                                    UserKey: null,
                                  })
                                  .eq('licensekey', key);

                                if (updateError) {
                                  console.error('Error resetting license key:', updateError);
                                  Swal.fire('Error', 'Failed to reset license key', 'error');
                                } else {
                                  setEditUserData(prev => ({ ...prev, licensekey: '' }));
                                  Swal.fire('Success', 'License key removed successfully.', 'success');
                                }
                              } catch (err) {
                                console.error('Unexpected error:', err);
                                Swal.fire('Error', 'Unexpected error occurred', 'error');
                              }
                            }
                          }}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            right: 8,
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            fontSize: '18px',
                            color: '#dc3545',
                            cursor: 'pointer',
                          }}
                        >
                          ❌
                        </button>

                      </div>
                    </Form.Group>
                  ) : null}
                </>



                {/** License Key Selector Modal — shared between Create and Edit */}
                <Modal show={licenseModalOpen} onHide={() => setLicenseModalOpen(false)} centered size="xl">
                  <Modal.Header closeButton>
                    <Modal.Title>Select License Key</Modal.Title>
                  </Modal.Header>

                  <Modal.Body>
                    {loading ? (
                      <p>Loading license keys…</p>
                    ) : (
                      <>
                        {/* Service License Cards */}
                        {!viewingServiceDetails && (
                          <div className="d-flex flex-wrap justify-content-start gap-3 mb-4">
                            {filteredServices.length === 0 ? (
                              <p>No license keys found.</p>
                            ) : (
                              filteredServices.map((item) => (
                                <div
                                  key={item.id}
                                  className="card shadow-sm border-secondary"
                                  style={{
                                    width: "18rem",
                                    cursor: "pointer",
                                    opacity: 1,
                                  }}
                                  onClick={async () => {
                                    setSelectedService(item);
                                    setClients([]);
                                    setUsersByClient({});
                                    setLoadingUsers(true);
                                    setViewingServiceDetails(true); // 👈 Show detail view

                                    try {
                                      const clientsRef = collection(db, "services", item.id, "clients");
                                      const clientSnap = await getDocs(clientsRef);
                                      const clientList = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                      setClients(clientList);

                                      const usersMap = {};

                                      for (const client of clientList) {
                                        const usersRef = collection(db, "services", item.id, "clients", client.id, "users");
                                        const userSnap = await getDocs(usersRef);
                                        usersMap[client.id] = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                                      }

                                      setUsersByClient(usersMap);
                                    } catch (err) {
                                      console.error("Error loading clients and users:", err);
                                      setClients([]);
                                      setUsersByClient({});
                                    } finally {
                                      setLoadingUsers(false);
                                    }
                                  }}
                                >
                                  <div className="card-body">
                                    <h5 className="card-title">ID: {item.id}</h5>
                                    <h6 className="card-subtitle mb-2 text-primary">
                                      Name: {item.name || "N/A"}
                                    </h6>
                                    <p className="card-text">
                                      <strong>Created:</strong>{" "}
                                      {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : "Unknown"}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}


                        {/* Client Details Card */}
                        {selectedService && (
                          <div className="card border-info shadow-sm mt-3">
                            <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
                              <span>
                                {viewingClient
                                  ? `Client Details for Service ID: ${selectedService.id}`
                                  : `Clients for Service ID: ${selectedService.id}`}
                              </span>

                              {viewingClient && (
                                <button
                                  className="btn btn-light btn-sm"
                                  onClick={() => {
                                    setViewingClient(false);
                                    setSelectedClientId(null);
                                  }}
                                >
                                  ← Back to Clients
                                </button>
                              )}
                            </div>

                            <div className="card-body">
                              {loadingUsers ? (
                                <p>Loading client info...</p>
                              ) : clients.length === 0 ? (
                                <p>No clients found for this service.</p>
                              ) : viewingClient && selectedClientId ? (
                                // Show selected client details
                                (() => {
                                  const client = clients.find(c => c.id === selectedClientId);
                                  if (!client) return <p>Client not found.</p>;

                                  return (
                                    <div>
                                      <h5>{client.name || "Client Name N/A"}</h5>
                                      <p><strong>Client ID:</strong> {client.id}</p>

                                      <h6 className="mt-3">Users</h6>
                                      {usersByClient[client.id]?.length > 0 ? (
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                          <table className="table table-bordered table-sm mb-0">
                                            <thead
                                              style={{
                                                position: 'sticky',
                                                top: 0,
                                                backgroundColor: '#007bff',  // Bright blue background color
                                                color: '#ffffff',            // White text for contrast
                                                zIndex: 1,
                                              }}
                                            >
                                              <tr>
                                                <th>License ID</th>
                                                <th>User Code</th>
                                                <th>Date Created</th>
                                                <th>Is Taken?</th>
                                                <th>Subscription Start</th>
                                                <th>Subscription End</th>
                                              </tr>
                                            </thead>

                                            <tbody>
                                              {usersByClient[client.id].map(user => {
                                                const isTaken = user.isTaken;

                                                // Default bg and color, change on hover
                                                const defaultBg = isTaken ? '#e0e0e0' : 'transparent';
                                                const defaultColor = isTaken ? '#6c757d' : 'inherit';
                                                const hoverBg = isTaken ? '#d6d6d6' : '#d1ecf1'; // Slightly different hover for taken vs not taken

                                                return (
                                                  <tr
                                                    key={user.id}
                                                    style={{
                                                      cursor: 'pointer',   // always pointer to show clickable
                                                      backgroundColor: defaultBg,
                                                      color: defaultColor,
                                                      // Remove pointerEvents to allow clicking even if isTaken is true
                                                      transition: 'background-color 0.3s ease',
                                                    }}
                                                    onClick={() => handleRowClickedit(user)} // remove the !isTaken condition, allow always clickable
                                                    onMouseEnter={(e) => {
                                                      e.currentTarget.style.backgroundColor = hoverBg;
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      e.currentTarget.style.backgroundColor = defaultBg;
                                                    }}
                                                  >

                                                    <td>{user.licenseKey}</td>
                                                    <td>{user.userCode || "N/A"}</td>
                                                    <td>{user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString() : "Unknown"}</td>
                                                    <td
                                                      style={{
                                                        color: isTaken ? '#ecececff' : 'inherit',
                                                        backgroundColor: isTaken ? '#f1a7adff' : 'transparent', // light gray bg for "Yes"
                                                        padding: '0.5rem' // optional for better spacing
                                                      }}
                                                    >
                                                      {isTaken ? "Yes" : "No"}
                                                    </td>                                                    <td>{formatDate(user.subscriptionStart)}</td>
                                                    <td>{formatDate(user.subscriptionEnd)}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>


                                          </table>
                                        </div>

                                      ) : (
                                        <p>No users found for this client.</p>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : (
                                // Show client cards to pick from
                                clients.map(client => (
                                  <div
                                    key={client.id}
                                    className="card mb-3 shadow-sm"
                                    style={{
                                      border: "1px solid #ccc",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => {
                                      setSelectedClientId(client.id);
                                      setViewingClient(true);
                                    }}
                                  >
                                    <div className="card-body">
                                      <h5>{client.name || "Client Name N/A"}</h5>
                                      <p className="mb-0"><strong>Client ID:</strong> {client.id}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}




                      </>
                    )}
                  </Modal.Body>

                </Modal>


                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="editUserUsername">
                      <Form.Label>Username</Form.Label>
                      <Form.Control
                        type="text"
                        name="username"
                        value={editUserData.username || ''}
                        onChange={handleEditUserChange}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3" controlId="editUserPassword">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        value={editUserData.password || ''}
                        onChange={handleEditUserChange}
                        placeholder="Leave blank to keep existing password"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* User Info fields - two columns */}
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="editUserName">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={editUserData.name || ''}
                    onChange={handleEditUserChange}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="editUserEmail">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={editUserData.email || ''}
                    onChange={handleEditUserChange}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="editUserContactNumber">
                  <Form.Label>Contact Number</Form.Label>
                  <Form.Control
                    type="text"
                    name="contactNumber"
                    value={editUserData.contactNumber || ''}
                    onChange={handleEditUserChange}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3" controlId="editUserSalesGroup">
                  <Form.Label>Sales Group</Form.Label>
                  <Form.Select
                    name="salesGroup"
                    value={editUserData.salesGroup || ''}
                    onChange={handleEditUserChange}
                    required
                  >
                    <option value="" disabled>-- Select Sales Group --</option>
                    {salesGroup.map((group, idx) => (
                      <option key={idx} value={group.name}>{group.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3" controlId="editUserPosition">
                  <Form.Label>Position</Form.Label>
                  <Form.Control
                    as="select"
                    name="position"
                    value={editUserData.position || ''}
                    onChange={(e) => {
                      handleEditUserChange(e);
                      setSelectedApprover?.(e.target.value);
                    }}
                    disabled={loading}
                    required
                  >
                    <option value="">-- Select Position --</option>
                    {positionsList.map((pos, idx) => (
                      <option key={idx} value={pos.name}>
                        {pos.name} - {pos.description}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>

                <Form.Group className="mb-3" controlId="editUserGroup">
                  <Form.Label>Department</Form.Label>
                  <Form.Select
                    name="group"
                    value={editUserData.group || ''}
                    onChange={handleEditUserChange}
                    required
                  >
                    <option value="">-- Select Department --</option>
                    <option value="All">All</option>
                    {groups.map((grp) => (
                      <option key={grp} value={grp}>{grp}</option>
                    ))}
                  </Form.Select>
                </Form.Group>


              </Col>
            </Row>
            <Row>

              <Col md={6}>
                <Form.Group className="mb-3" controlId="newUserKeyType">
                  <Form.Label>User Type</Form.Label>
                  <Form.Control
                    as="select"
                    name="keyType"
                    value={editUserData.keyType || ''}
                    onChange={handleEditUserChange}
                    required
                  >
                    <option value="">Select</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </Form.Control>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="newUserGroup">
                  <Form.Label>Permission Role</Form.Label>
                  <Form.Select
                    name="PermissionRole"
                    value={editUserData.PermissionRole || ''}
                    onChange={handleEditUserChange}
                    required
                  >
                    <option value="">-- Select Permission --</option>
                    <option value="All">All</option>
                    {PermissionRole.map((pos, idx) => (
                      <option key={idx} value={pos.name}>
                        {pos.name}  {pos.description}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => {
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                setModalType(null);
              }}
            >
              Cancel
            </Button>

            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal >



      {/* Placeholder Modals for Approvers, Brands, Connection, Deactivate */}
      {/* You can implement these as needed */}
      <Modal show={modalType === 'approvers'} onHide={() => setModalType(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Manage Approvers for {selectedUser?.name}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {!approverViewMode && (
            <div className="d-flex flex-column gap-3">
              <Button variant="primary" onClick={() => setApproverViewMode('manual')}>
                Option 1: Manual Approver Selection
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  fetchApprovalPlans(); // Function to fetch plans
                  setApproverViewMode('plan');
                }}
              >
                Option 2: Choose from Brand Approval Plan
              </Button>
              <Button
                variant="info"
                onClick={() => {
                  setApproverViewMode('single');
                  fetchPosition();
                  fetchSavedApprovals();
                }}
              >
                Option 3: Single Approval
              </Button>


            </div>
          )}

          {approverViewMode === 'manual' && (
            <>
              <Form.Group controlId="approverSelect">
                <Form.Label>Select User</Form.Label>
                <Form.Select
                  value={selectedApprover}
                  onChange={(e) => setSelectedApprover(e.target.value)}
                  disabled={loading}
                >
                  <option value="">-- Select User --</option>
                  {usersList.map((user) => (
                    <option key={user.id} value={user.name}>
                      {user.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group controlId="approverTypeSelect" className="mt-3">
                <Form.Label>Select Approver Type</Form.Label>
                <Form.Select
                  value={approverType}
                  onChange={(e) => setApproverType(e.target.value)}
                  disabled={loading}
                >
                  <option value="">-- Select Type --</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="tertiary">Tertiary</option>
                </Form.Select>
              </Form.Group>

              <Button
                variant="primary"
                onClick={handleAddApprover}
                disabled={!selectedApprover || !approverType || loading}
                className="mt-3"
              >
                {loading ? 'Processing...' : 'Add Approver'}
              </Button>

              {renderApproverLists()}
            </>
          )}

          {approverViewMode === 'plan' && (
            <>
              <Form.Group>
                <Form.Label>Choose Plan</Form.Label>
                <Form.Select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                >
                  <option value="">-- Select Plan --</option>
                  {approvalPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.department} - {plan.position}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Button
                className="mt-3"
                variant="success"
                onClick={assignPlanToUser}
                disabled={!selectedPlan}
              >
                Save to User
              </Button>

              {savedPlans.length > 0 && (
                <div className="mt-4">
                  <h5>Assigned Plans:</h5>
                  <div
                    style={{
                      maxHeight: '250px',
                      overflowY: 'auto',
                      paddingRight: '8px',
                      border: '1px solid #dee2e6',
                      borderRadius: '0.25rem',
                    }}
                  >
                    {savedPlans.map((plan, idx) => (
                      <div key={idx} className="border p-3 mb-3 rounded position-relative">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deletePlan(plan.id)}
                          className="position-absolute top-0 end-0 m-2"
                        >
                          Remove
                        </Button>

                        <p><strong>Department:</strong> {plan.department}</p>
                        <p><strong>Position:</strong> {plan.position}</p>
                        <p><strong>Principal:</strong> {plan.principal}</p>
                        <p><strong>Visa Type:</strong> {plan.visaType}</p>
                        <p><strong>Charged To:</strong> {plan.chargedTo}</p>
                        <p><strong>Approver Level:</strong> {plan.approverLevel || '-'}</p>
                        <p><strong>Plan ID:</strong> {plan.id}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}
          {approverViewMode === 'single' && (
            <>
              {/* Your existing form */}
              <Form.Group controlId="positionSelect">
                <Form.Label>Select Position</Form.Label>
                <Form.Select
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  disabled={loading}
                >
                  <option value="">-- Select Position --</option>
                  {permissionRole.map((pos) => (
                    <option key={pos.id} value={pos.name}>
                      {pos.name} - {pos.description}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group
                controlId="allowedToApprove"
                className="mt-3 d-flex align-items-center justify-content-between"
              >
                <Form.Label className="mb-0">Allowed to Approve</Form.Label>
                <Form.Check
                  type="switch"
                  id="allowed-approve-switch"
                  checked={allowedToApprove}
                  onChange={() => setAllowedToApprove(!allowedToApprove)}
                />
              </Form.Group>

              <Button
                variant="success"
                className="mt-3"
                onClick={handleSaveSingleApproval}
                disabled={!selectedPosition || loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>

              {/* Display saved approvals as a list with edit & delete */}
              <hr className="my-4" />
              <h5>Saved Single Approvals</h5>
              {savedApprovals.length === 0 ? (
                <p>No approvals found.</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {savedApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="p-3 border rounded shadow-sm"
                      style={{ backgroundColor: '#f8f9fa' }}
                    >
                      {editId === approval.id ? (
                        <>
                          <Form.Group controlId={`editPosition-${approval.id}`}>
                            <Form.Label>Position</Form.Label>
                            <Form.Select
                              value={editPosition}
                              onChange={(e) => setEditPosition(e.target.value)}
                              disabled={loading}
                            >
                              <option value="">-- Select Position --</option>
                              {permissionRole.map((pos) => (
                                <option key={pos.id} value={pos.name}>
                                  {pos.name} - {pos.description}
                                </option>
                              ))}
                            </Form.Select>
                          </Form.Group>

                          <Form.Group
                            controlId={`editAllowed-${approval.id}`}
                            className="mt-3 d-flex align-items-center justify-content-between"
                          >
                            <Form.Label className="mb-0">Allowed to Approve</Form.Label>
                            <Form.Check
                              type="switch"
                              id={`editAllowedSwitch-${approval.id}`}
                              checked={editAllowed}
                              onChange={() => setEditAllowed(!editAllowed)}
                            />
                          </Form.Group>

                          <div className="mt-3">
                            <Button
                              variant="success"
                              className="me-2"
                              onClick={() =>
                                handleUpdateApproval(editId, editPosition, editAllowed).then(() =>
                                  setEditId(null)
                                )
                              }
                              disabled={!editPosition || loading}
                            >
                              Save
                            </Button>
                            <Button variant="secondary" onClick={() => setEditId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>
                            <strong>User ID:</strong> {approval.user_id}
                          </p>
                          <p>
                            <strong>Position:</strong> {approval.position}
                          </p>
                          <p>
                            <strong>Allowed to Approve:</strong>{' '}
                            {approval.allowed_to_approve ? 'Yes' : 'No'}
                          </p>

                          <div className="d-flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setEditId(approval.id);
                                setEditPosition(approval.position);
                                setEditAllowed(approval.allowed_to_approve);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteApproval(approval.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}



        </Modal.Body>

        <Modal.Footer>
          {approverViewMode && (
            <Button variant="outline-secondary" onClick={() => setApproverViewMode(null)}>
              Back to Options
            </Button>
          )}
          <Button variant="secondary" onClick={() => setModalType(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>



      <Modal show={modalType === 'brands'} onHide={() => setModalType(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Manage Brands for {selectedUser?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {brands.length === 0 ? (
            <p>Loading brands...</p>
          ) : (
            <>
              <p>Select up to {maxBrandsAllowed} brands:</p>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {brands.map((brand, idx) => (
                  <div key={idx} className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`brand-${idx}`}
                      checked={selectedBrands.includes(brand)}
                      onChange={() => handleBrandToggle(brand)}
                      disabled={
                        !selectedBrands.includes(brand) &&
                        selectedBrands.length >= maxBrandsAllowed
                      }
                    />
                    <label className="form-check-label" htmlFor={`brand-${idx}`}>
                      {brand}
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalType(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveBrands} disabled={selectedBrands.length === 0}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>


      <Modal show={modalType === 'connection'} onHide={() => setModalType(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Manage Connection for {selectedUser?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {salesDivisions.length === 0 ? (
            <p>No Sales Divisions found.</p>
          ) : (
            <>
              <p>Select one or more Sales Divisions:</p>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {salesDivisions.map((div, idx) => (
                  <div key={idx} className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`division-${idx}`}
                      checked={selectedDivisions.includes(div.name)}
                      onChange={() => handleDivisionToggle(div.name)}
                    />
                    <label className="form-check-label" htmlFor={`division-${idx}`}>
                      {div.name}
                    </label>
                  </div>
                ))}
              </div>

              {/* Display selected divisions */}
              {selectedDivisions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <strong>Selected Divisions:</strong>
                  <ul>
                    {selectedDivisions.map((div, idx) => (
                      <li key={idx}>{div}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: 20, borderBottom: '2px solid #1976d2', paddingBottom: '6px', marginBottom: '12px' }}>
                <h5 style={{ color: '#1976d2', fontWeight: '600', margin: 0 }}>
                  For Sales Department Only
                </h5>
              </div>


              <div className="form-check" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="include-bu-head"
                  checked={includeBUHead}
                  onChange={() => setIncludeBUHead(!includeBUHead)}
                />
                <label className="form-check-label" htmlFor="include-bu-head">
                  Include BU Head in Approval List
                </label>
              </div>

              <div className="form-check" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="include-vp-sales"
                  checked={includeVPSales}
                  onChange={() => setIncludeVPSales(!includeVPSales)}
                />
                <label className="form-check-label" htmlFor="include-vp-sales">
                  Include VP Sales in Approval List
                </label>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalType(null)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveDivisions}
            disabled={selectedDivisions.length === 0}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>


      <Modal show={modalType === "deactivate" ? true : undefined} onHide={() => setModalType(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Deactivate / Enable / Delete User {selectedUser?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Select duration to disable the account or enable it:</p>
          {DisableDurations.map(({ label, value }) => (
            <Form.Check
              key={value}
              type="radio"
              label={label}
              name="disableDuration"
              value={value}
              checked={disableDays === value}
              onChange={() => setDisableDays(value)}
              disabled={loading}
              className="mb-2"
            />
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalType(null)} disabled={loading}>
            Cancel
          </Button>

          {/* Delete button */}
          <Button
            variant="outline-danger"
            onClick={() => deleteAccountUser(selectedUser?.id, selectedUser?.name)}
            disabled={loading}
          >
            Delete Account
          </Button>




          {/* Enable/Deactivate button */}
          {disableDays === 0 ? (
            <Button variant="success" onClick={handleDeactivate} disabled={loading}>
              {loading ? "Processing..." : "Enable"}
            </Button>
          ) : (
            <Button variant="danger" onClick={handleDeactivate} disabled={!disableDays || loading}>
              {loading ? "Processing..." : "Deactivate"}
            </Button>
          )}
        </Modal.Footer>
      </Modal>




    </Container >
  );
};

export default UserManagement;
