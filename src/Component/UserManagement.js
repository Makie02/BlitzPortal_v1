import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Button, Container, Badge, Form, Modal, FormControl } from 'react-bootstrap';
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

import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from '../Firebase';

const USERS_PER_PAGE = 4;

const UserManagement = ({ setCurrentView }) => {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ department: '', position: '', role: '' });
  const [positionsList, setPositionsList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]); // Add this line

  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState(null); // 'edit', 'approvers', 'brands', 'deactivate', 'create'
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
  const [search, setSearch] = useState('');
  // Get unique options for filters dynamically
  //const groups = useMemo(() => [...new Set(users.map(u => u.group))], [users]); "if want i access yung all sa database"
  const departments = useMemo(() => {
    if (!departmentsList || departmentsList.length === 0) return [];

    return [...new Set(users.map(u => {
      const deptObj = departmentsList.find(dept => dept.code === u.department);
      return deptObj ? deptObj.name : u.department;
    }))];
  }, [users, departmentsList]);


  const positions = useMemo(() => {
    if (!positionsList || positionsList.length === 0) return [];

    return [...new Set(users.map(u => {
      const posObj = positionsList.find(pos => pos.code === u.position);
      return posObj ? posObj.name : u.position;
    }))];
  }, [users, positionsList]);

  const roles = useMemo(() => [...new Set(users.map(u => u.role))], [users]);

  const filteredUsers = React.useMemo(() => {
    return users.filter(user => {
      // First apply the search filter
      const matchesSearch = search === '' ||
        (user.name && user.name.toLowerCase().includes(search.toLowerCase())) ||
        (user.username && user.username.toLowerCase().includes(search.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(search.toLowerCase()));
      // Then apply the dropdown filters
      // Safe department matching with fallback
      let matchesDepartment = filters.department === '';
      if (!matchesDepartment && departmentsList && departmentsList.length > 0) {
        const userDepartmentName = departmentsList.find(dept => dept.code === user.department)?.name || user.department;
        matchesDepartment = userDepartmentName === filters.department;
      } else if (!matchesDepartment) {
        matchesDepartment = user.department === filters.department;
      }


      const matchesRole = filters.role === '' || user.role === filters.role;
      // Safe position matching with fallback
      let matchesPosition = filters.position === '';
      if (!matchesPosition && positionsList && positionsList.length > 0) {
        const userPositionName = positionsList.find(pos => pos.code === user.position)?.name || user.position;
        matchesPosition = userPositionName === filters.position;
      } else if (!matchesPosition) {
        // Fallback to direct code comparison if positionsList not loaded
        matchesPosition = user.position === filters.position;
      }
      return matchesSearch && matchesDepartment && matchesPosition && matchesRole;

    });
  }, [users, filters, search]); // Add 'search' to the dependency array

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
  const [supabaseUsername, setSupabaseUsername] = useState('');

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
      setSupabaseUsername(userFromSupabase.name);

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
        department: fullUserData.department || '',
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
  const [permissionRoles, setPermissionRoles] = useState([]);
  const [allowedToApprove, setAllowedToApprove] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');

  // Fetch user roles
  const fetchPosition = async () => {
    const { data, error } = await supabase
      .from("user_role")
      .select("*");

    if (error) {
      console.error('Error loading positions:', error);
      setPermissionRoles([]);
    } else {
      setPermissionRoles(data || []);
    }
  };

  // Fetch saved approvals from the correct table name
  const fetchSavedApprovals = async () => {
    const { data, error } = await supabase.from('Single_Approval').select('*');

    if (error) {
      console.error('Error fetching saved approvals:', error);
      setSavedApprovals([]);
    } else {
      setSavedApprovals(data || []);
    }
  };
  const fetchApprovals = async () => {
    const { data, error } = await supabase.from('Single_Approval').select('*');

    if (error) {
      console.error('Error fetching approvals:', error);
      setSavedApprovals([]);
    } else {
      setSavedApprovals(data || []);
    }
  };
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const { data, error } = await supabase
          .from('position')
          .select('*');

        if (error) {
          throw error;
        }

        setPositionsList(data || []);
      } catch (error) {
        console.error('Error fetching sales groups:', error.message);
      }
    };

    fetchPositions();
  }, []);
  // Load username from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const username = parsedUser?.name || parsedUser?.email || parsedUser?.user_id || '';
    setCurrentUsername(username);
  }, []);

  // On component mount, fetch roles and approvals
  useEffect(() => {
    fetchPosition();
    fetchSavedApprovals();
  }, []);

  const handleSaveSingleApproval = async () => {
    const usernameToSave = selectedUser?.name;

    if (!usernameToSave) {
      Swal.fire('Error', 'Username not found.', 'error');
      return;
    }

    setLoading(true);

    const { data: existing, error: selErr } = await supabase
      .from('Single_Approval')
      .select('*')
      .eq('username', usernameToSave)
      .single();

    if (selErr && selErr.code !== 'PGRST116') {
      console.error('Error checking existing:', selErr);
      setLoading(false);
      Swal.fire('Error', 'Failed to check existing approval.', 'error');
      return;
    }

    const payload = {
      username: usernameToSave,
      allowed_to_approve: allowedToApprove,
    };

    let res, error;

    if (existing) {
      const { data: updatedData, error: updErr } = await supabase
        .from('Single_Approval')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      error = updErr;
      res = updatedData;
    } else {
      const { data: insertedData, error: insErr } = await supabase
        .from('Single_Approval')
        .insert([payload])
        .select()
        .single();
      error = insErr;
      res = insertedData;
    }

    setLoading(false);

    if (error) {
      console.error('Error saving approval:', error);
      Swal.fire('Error', 'Failed to save approval.', 'error');
    } else {
      Swal.fire('Success', 'Approval saved successfully.', 'success');
      fetchApprovals();  // make sure to use your unified fetch function here
    }
  };

  const handleDeleteApproval = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the approval.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      const { error } = await supabase
        .from('Single_Approval')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete error:', error);
        Swal.fire('Error', 'Failed to delete approval.', 'error');
      } else {
        Swal.fire('Deleted!', 'Approval has been deleted.', 'success');
        fetchApprovals();
      }
    }
  };

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

    if (name === 'salesGroup') {
      const selected = salesGroup.find(group => group.code === value);
      setNewUserData(prev => ({
        ...prev,
        salesGroup: selected.code,
        salesGroupName: selected.name
      }));
    } else {
      setNewUserData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  // Handle edit user form change
  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUserData(prev => ({
      ...prev,
      [name]: value,
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

    const licenseKey = newUserData.licensekey?.trim();

    // 🔒 Step 0: Check for duplicate license key BEFORE any inserts
    if (licenseKey) {
      const { data: existingLicense, error: licenseCheckError } = await supabase
        .from('license_keys')
        .select('licensekey')
        .eq('licensekey', licenseKey)
        .maybeSingle();

      if (licenseCheckError) {
        console.error('License key lookup error:', licenseCheckError);
        throw licenseCheckError;
      }

      if (existingLicense) {
        // ⛔ License key already exists — throw error and stop here
        throw new Error(`License key "${licenseKey}" already exists. Please use a different one.`);
      }
    }

    // ✅ Step 1: Get max UserID
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

    // ✅ Step 3: Insert new user
    const userDataToSave = {
      UserID: newUserID,
      role: keyType,
      name: newUserData.name,
      salesGroup: newUserData.salesGroup,
      email: newUserData.email,
      position: newUserData.position,
      department: newUserData.department,
      contactNumber: newUserData.contactNumber,
      isActive: newUserData.isActive,
      profilePicture: newUserData.profilePicture,
      username: newUserData.username,
      password: newUserData.password,
      licensekey: licenseKey,
      PermissionRole: newUserData.PermissionRole,
    };

    const { data: insertedUsers, error: insertError } = await supabase
      .from('Account_Users')
      .insert(userDataToSave)
      .select('id');

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    if (!insertedUsers || insertedUsers.length === 0 || !insertedUsers[0]) {
      console.error('User insert returned no data or unexpected format:', insertedUsers);
      throw new Error('User insert returned no data');
    }

    const userId = insertedUsers[0].id;

    // ✅ Step 4: Add default security settings
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

    // ✅ Step 5: Insert new license key
    if (licenseKey) {
      let validUntil = null;
      const storedUserRaw = localStorage.getItem('selectedLicenseUser');
      if (storedUserRaw) {
        try {
          const storedUser = JSON.parse(storedUserRaw);
          if (storedUser.subscriptionEnd?.seconds) {
            validUntil = new Date(storedUser.subscriptionEnd.seconds * 1000).toISOString();
          }
        } catch (e) {
          console.warn('Failed to parse stored license user:', e);
        }
      }

      const licenseKeyRecord = {
        licensekey: licenseKey,
        status: 'Active',
        created_at: new Date().toISOString(),
        UserID: newUserID,
        valid_until: validUntil,
      };

      const { error: licenseInsertError } = await supabase
        .from('license_keys')
        .insert(licenseKeyRecord);

      if (licenseInsertError) {
        console.error('License key insert error:', licenseInsertError);
        throw licenseInsertError;
      }

      // ✅ Update Firestore license user to isTaken = true
      try {
        const storedUser = JSON.parse(localStorage.getItem('selectedLicenseUser'));
        if (storedUser?.id) {
          const licenseDocRef = doc(db, "LicenseUsers", storedUser.id);
          await updateDoc(licenseDocRef, {
            isTaken: true,
          });
          console.log(`✅ Firestore: Marked license ID ${storedUser.id} as taken`);
        } else {
          console.warn("⚠️ Could not find stored license user ID to update in Firestore");
        }
      } catch (error) {
        console.error("❌ Failed to update isTaken in Firestore:", error);
        throw error;
      }
    }

    return { id: userId, UserID: newUserID };
  };

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

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const { data, error } = await supabase
          .from('position')
          .select('*');

        if (error) {
          throw error;
        }

        setPositionsList(data || []);
      } catch (error) {
        console.error('Error fetching sales groups:', error.message);
      }
    };

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
      // 1. Check duplicate license key if needed
      if (showLicenseUpdate && editUserData.licensekey) {
        const duplicate = await isLicenseKeyDuplicate(editUserData.licensekey, supabaseUserId);
        if (duplicate) {
          Swal.fire('Duplicate License', 'This license key is already assigned to another user.', 'error')
            .then(() => window.location.reload());
          return;
        }
      }

      // 2. Build payload for user update
      // NOTE: Use IDs here from editUserData, assuming they are saved as IDs in the form.
      const updatePayload = {
        role: editUserData.keyType,
        name: editUserData.name || null,
        salesGroup: editUserData.salesGroup || null,
        email: editUserData.email || null,
        position: editUserData.position || null,
        department: editUserData.department || null,
        contactNumber: editUserData.contactNumber || null,
        profilePicture: editUserData.profilePicture || null,
        username: editUserData.username || null,
        password: editUserData.password || null,
        PermissionRole: editUserData.permissionRole || null,
      };


      if (showLicenseUpdate) {
        updatePayload.licensekey = editUserData.licensekey || null;
      }

      // Clean undefined
      Object.keys(updatePayload).forEach(
        (key) => updatePayload[key] === undefined && delete updatePayload[key]
      );

      // 3. Update main user record
      const { error: userUpdateError } = await supabase
        .from('Account_Users')
        .update(updatePayload)
        .eq('id', supabaseUserId);

      if (userUpdateError) throw userUpdateError;

      // 4. Update license_keys table if needed (same as before)
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
          valid_until: convertToPostgresDate(editUserData.subscriptionEnd),
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

      localStorage.removeItem('selectedLicenseUser');
      localStorage.removeItem('selectedLicenseKey');

      // 5. Show success and reset
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
  const [selectedPosition, setSelectedPosition] = useState('');
  const [savedPlan, setSavedPlan] = useState(null); // <- to show saved data


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
    const fetchSalesGroup = async () => {
      try {
        const { data, error } = await supabase
          .from('sales_group')
          .select('*');

        if (error) {
          throw error;
        }

        setSalesGroup(data || []);
      } catch (error) {
        console.error('Error fetching sales groups:', error.message);
      }
    };

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



  const [Department, setDepartment] = useState([]);
  const [PermissionRole, setPermissionRole] = useState([]);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase
        .from("department")
        .select("*")
        .order('code', { ascending: true });

      if (error) {
        console.error('Error loading departments:', error);
        setDepartmentsList([]); // ✅ TAMA - gamitin ang setDepartmentsList
      } else {
        setDepartmentsList(data || []); // ✅ TAMA - gamitin ang setDepartmentsList
      }
    };

    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchUserRoles = async () => {
      const { data, error } = await supabase
        .from("user_role")   // changed from References to user_role table
        .select("*")
        .order('code', { ascending: true });  // optional ordering by code

      if (error) {
        console.error('Error loading user roles:', error);
        setPermissionRole([]);  // make sure this matches your state setter name
      } else {
        setPermissionRole(data || []);
      }
    };

    fetchUserRoles();
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


  const handleRowClick = async (user) => {
    try {
      const userRef = doc(
        db,
        "services",
        selectedService.id,
        "clients",
        client.id,
        "users",
        user.id
      );

      await updateDoc(userRef, { isTaken: true });

      // ✅ Local state update (UI)
      setUsers(prev =>
        prev.map(u =>
          u.id === user.id ? { ...u, isTaken: true } : u
        )
      );

      // ✅ Save to localStorage
      localStorage.setItem("selectedLicenseUser", JSON.stringify(user));
      const licenseKey = user.licenseKey || '';
      localStorage.setItem("selectedLicenseKey", licenseKey);

      setNewUserData(prev => ({
        ...prev,
        licensekey: licenseKey,
        userCode: user.userCode || '',
        subscriptionStart: user.subscriptionStart,
        subscriptionEnd: user.subscriptionEnd,
      }));

      setSelectedUser(user);
      setLicenseModalOpen(false);

      // ✅ Show Swal Success
      await Swal.fire({
        icon: 'success',
        title: 'License Assigned!',
        text: `User ${user.userCode || user.id} marked as taken.`,
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK'
      });

    } catch (error) {
      console.error("❌ Failed to mark license as taken:", error);

      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to assign the license.',
        confirmButtonColor: '#d33',
        confirmButtonText: 'Close'
      });
    }
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



  useEffect(() => {
    if (modalType === 'edit' && originalSupabaseData) {
      // Show Swal prompt once when modal opens
      Swal.fire({
        title: 'Update the License Key?',
        text: 'Do you want to update the license key for this user?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, update it',
        cancelButtonText: 'No, keep current',
        reverseButtons: true,
      }).then((result) => {
        if (result.isConfirmed) {
          setShowLicenseUpdate(true);
          setEditUserData(originalSupabaseData);
        } else {
          setShowLicenseUpdate(false);
          setEditUserData({
            ...originalSupabaseData,
            licensekey: originalSupabaseData.licensekey || '',
          });
        }
      });
    }
  }, [modalType, originalSupabaseData]);




  // assuming supabase is initialized

  const fetchSingleApprovals = async () => {
    const { data, error } = await supabase
      .from('Single_Approval')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching approvals:', error);
    } else {
      setSavedApprovals(data);
    }
  };



  const [distributors, setDistributors] = useState([]);
  const [selectedDistributors, setSelectedDistributors] = useState([]);


  // Fetch distributors from Supabase
  useEffect(() => {
    const fetchDistributors = async () => {
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching distributors:', error);
      } else {
        setDistributors(data);
      }
    };

    if (modalType === 'Distributor') {
      fetchDistributors();
    }
  }, [modalType]);

  const handleDistributorToggle = (name) => {
    setSelectedDistributors((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name]
    );
  };

  const [savedDistributors, setSavedDistributors] = useState([]);

  const fetchSavedDistributors = async (username) => {
    const { data, error } = await supabase
      .from('user_distributors')
      .select('*')
      .eq('username', username)
      .order('distributor_name', { ascending: true });

    if (error) {
      console.error('Error fetching saved distributors:', error);
    } else {
      setSavedDistributors(data);
    }
  };


  useEffect(() => {
    if (modalType === 'Distributor' && selectedUser?.username) {
      fetchSavedDistributors(selectedUser.username);
    }
  }, [modalType, selectedUser]);

  const handleSaveDistributors = async () => {
    if (!supabaseUsername) {
      Swal.fire({
        icon: 'warning',
        title: 'No Supabase username!',
        text: 'Unable to find Supabase username. Please reselect the user.',
      });
      return;
    }

    const selected = distributors.filter((d) =>
      selectedDistributors.includes(d.name)
    );

    const inserts = selected.map((dist) => ({
      code: dist.code,
      distributor_name: dist.name,
      username: supabaseUsername, // ✅ Use Supabase username here
    }));

    const { error } = await supabase
      .from('user_distributors')
      .insert(inserts);

    if (error) {
      console.error('Error saving distributors:', error);
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: 'An error occurred while saving. Please try again.',
      });
    } else {
      await Swal.fire({
        icon: 'success',
        title: 'Distributors Saved',
        text: 'The selected distributors were saved successfully!',
        confirmButtonColor: '#3085d6',
      });

      setSelectedDistributors([]);
      fetchSavedDistributors(supabaseUsername); // ✅ Fetch saved distributors using supabaseUsername
    }
  };


  const filteredDistributors = distributors.filter((dist) =>
    dist.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  return (
    <Container>
      <h2 className="my-4">User Management</h2>

      <div className="d-flex justify-content-between align-items-center mb-3">


        <Form className="d-flex flex-wrap gap-3" style={{ flexGrow: 1, marginLeft: '1rem' }}>
          <Form.Group controlId="searchName" style={{ minWidth: 200 }}>
            <Form.Label>Search Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="filterDepartment" style={{ minWidth: 150 }}>
            <Form.Label>Department</Form.Label>
            <Form.Select name="department" value={filters.department} onChange={handleFilterChange}>
              <option value="">All</option>
              {departments.map(department => <option key={department} value={department}>{department}</option>)}
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
        <Button variant="primary" onClick={openCreateModal} className="me-2">
          <FaPlus className="me-2" /> Create User
        </Button>
        <Button variant="primary" onClick={() => setCurrentView('RolePermissionForm')} classname="ms-2">
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
                          <strong>Position:</strong> {
                            positionsList.find(pos => pos.code === user.position)?.name || user.position
                          }
                          <br />
                          <strong>Email:</strong> {user.email}
                          <br />
                          <strong>Contact Number:</strong> {user.contactNumber || 'N/A'}
                          <br />
                          <strong>Department:</strong>{' '}
                          <Badge bg="secondary">
                            {departmentsList.find(dept => dept.code === user.department)?.name || user.department}
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
                        onClick={() => openModal(user, 'Distributor')}
                        title="Distributor"
                        className="mb-1"
                      >
                        <FaTags />
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
                      <option key={idx} value={group.code}>
                        {group.name} {group.description && ` - ${group.description}`}
                      </option>
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
                      <option key={idx} value={pos.code}>
                        {pos.name}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>

                <Form.Group className="mb-3" controlId="newUserGroup">
                  <Form.Label>Department</Form.Label>
                  <Form.Select
                    name="department"
                    value={newUserData.department}
                    onChange={handleNewUserChange}
                    required
                  >
                    <option value="">-- Select Department --</option>
                    {departmentsList.map((dept, idx) => (  // ✅ TAMA - departmentsList
                      <option key={idx} value={dept.code}>
                        {dept.name} - {dept.description}
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
                    {PermissionRole.map((role, idx) => (
                      <option key={idx} value={role.code}>
                        {role.name} {role.description}
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
                    {salesGroup.map((group) => (
                      <option key={group.code} value={group.code}>{group.name}</option>
                    ))}
                  </Form.Select>

                </Form.Group>

                <Form.Group className="mb-3" controlId="editUserPosition">
                  <Form.Label>Position</Form.Label>
                  <Form.Select
                    name="position"
                    value={editUserData.position || ''}
                    onChange={handleEditUserChange}
                    required
                  >
                    <option value="" disabled>-- Select Position --</option>
                    {positionsList.map((pos) => (
                      <option key={pos.code} value={pos.code}>{pos.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3" controlId="editUserGroup">
                  <Form.Label>Department</Form.Label>


                  <Form.Select
                    name="department"  // Changed from "group" to "department"
                    value={editUserData.department || ''}
                    onChange={handleEditUserChange}
                    required
                  >
                    <option value="" disabled>-- Select Department --</option>
                    {departmentsList.map((dep) => (
                      <option key={dep.code} value={dep.code}>{dep.name}</option>
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
                    name="permissionRole"
                    value={editUserData.permissionRole || ''}
                    onChange={handleEditUserChange}
                    required
                  >
                    <option value="" disabled>-- Select Permission Role --</option>
                    {PermissionRole.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.name} {role.description}
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



      {/* Placeholder Modals for Approvers, Brands, Deactivate */}
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
                variant="info"
                onClick={() => {
                  setApproverViewMode('single');
                  fetchPosition();
                  fetchSavedApprovals();
                }}
              >
                Option 2: Single Approval
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





          {approverViewMode === 'Distributor' && (
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
              <Form.Group controlId="usernameDisplay">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedUser?.name || ''}
                  readOnly
                />
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
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>

              <hr className="my-4" />
              <h5>Saved Single Approvals</h5>

              {savedApprovals.length === 0 ? (
                <p>No approvals found.</p>
              ) : (
                <table striped bordered hover responsive>

                  <div className="container-fluid px-2">
                    <div className="table-responsive w-100">
                      <table className="table table-striped table-bordered table-hover align-middle">
                        <thead className="table-dark">
                          <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Allowed</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {savedApprovals.map((approval) => (
                            <tr key={approval.id}>
                              <td>{approval.id}</td>
                              <td>{approval.username}</td>
                              <td>
                                <span
                                  className={`badge ${approval.allowed_to_approve ? 'bg-success' : 'bg-secondary'}`}
                                >
                                  {approval.allowed_to_approve ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleDeleteApproval(approval.id)}
                                >
                                  <i className="bi bi-trash-fill me-1"></i> Delete
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>


                </table>
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









      <Modal show={modalType === 'Distributor'} onHide={() => setModalType(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Manage Distributor for {supabaseUsername}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {distributors.length === 0 ? (
            <p>No Sales Distributor found.</p>
          ) : (
            <>
              <p>Select one or more Distributors:</p>

              {/* Search Bar */}
              <FormControl
                type="text"
                placeholder="Search Distributors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ marginBottom: '12px' }}
              />

              {/* Scrollable List */}
              <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '6px' }}>
                {filteredDistributors.length === 0 ? (
                  <p>No matching distributors found.</p>
                ) : (
                  filteredDistributors.map((dist, idx) => (
                    <div key={idx} className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`distributor-${idx}`}
                        checked={selectedDistributors.includes(dist.name)}
                        onChange={() => handleDistributorToggle(dist.name)}
                      />
                      <label className="form-check-label" htmlFor={`distributor-${idx}`}>
                        {dist.name}
                      </label>
                    </div>
                  ))
                )}
              </div>


              {selectedDistributors.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <strong>Selected Distributors:</strong>
                  <ul>
                    {selectedDistributors.map((name, idx) => (
                      <li key={idx}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {savedDistributors.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h6 style={{ fontWeight: '600' }}>Saved Distributors for {selectedUser?.name}:</h6>
                  <ul>
                    {savedDistributors.map((dist, idx) => (
                      <li key={idx}>
                        {dist.distributor_name} <span style={{ color: '#999' }}>({dist.code})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalType(null)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveDistributors}
            disabled={selectedDistributors.length === 0}
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
