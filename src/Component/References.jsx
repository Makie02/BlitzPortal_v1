import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
// import ng lahat ng components mo
import UserRole from '../NewComponents/UserRole';
import Distributor from '../NewComponents/DISTRIBUTOR';
import Account from '../NewComponents/Account';
import Activity from '../NewComponents/activity.jsx';
import SalesGroup from '../NewComponents/Salesgroup.jsx';
import CategorySelector from './BrandSelector.jsx';
import PromotedSKU from '../NewComponents/promoted_sku.jsx';
import Department from '../NewComponents/Department.jsx';
import Position from '../NewComponents/Position.js';
import ListingActivity from '../NewComponents/ListingActivity.jsx';
import RegularSkuTable from '../NewComponents/RegularSkuTable.jsx';
import Category from '../NewComponents/Category.jsx';
import Category_Listing from '../NewComponents/Category_Listing.jsx';
import ApprovalSettings from '../NewComponents/ApprovalSettings.jsx';
import Budgets from '../NewComponents/Budget.js';
import NotFoundPage from '../Nofound/NotFoundPage.js';
import ModuleForm from '../NewComponents/ModuleForm.js';
import ClaimsListing from '../NewComponents/ClaimsListing.jsx';
import LicenseSelectionPage from '../NewComponents/LicenseSelectionPage.js';
import CustomerGroup from '../NewComponents/CustomerGroup.js';
import MotherAccount from '../NewComponents/MotherAccount.js';
import MotherAccountUI from '../NewComponents/Sub_mother_account.js';
import BranchListing from '../NewComponents/BranchListing.jsx';
import Sub_3rdmotherAccounts from '../NewComponents/Sub_3_mother_account.js';
import UserList from '../NewComponents/UserList.jsx';
import MasterDataBranch from '../NewComponents/MasterdataBranch.jsx';
import Bp_Account from '../NewComponents/Bp_Account.jsx';
import Year from '../NewComponents/Year.jsx';
import AccountingModule from './AccountingModule.jsx';
const References = ({ setCurrentView }) => {
  const [view, setView] = useState(null);
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState('all'); // sorting state

  // Cards info + what boolean flag each card corresponds to + CATEGORY
  const cards = [
    { id: 1, title: "DISTRIBUTOR", flag: 'distributor', category: 'accounts', requirePassword: false },
    { id: 3, title: "MODULE", flag: 'module', category: 'settings', requirePassword: true },
    { id: 4, title: "ACTIVITY", flag: 'activity', category: 'activities', requirePassword: false },
    { id: 5, title: "DEPARTMENT", flag: 'department', category: 'organization', requirePassword: false },
    { id: 6, title: "USER ROLE", flag: 'user_role', category: 'organization', requirePassword: false },
    { id: 7, title: "SALESGROUP", flag: 'salesgroup', category: 'organization', requirePassword: false },
    { id: 8, title: "POSITION", flag: 'position', category: 'organization', requirePassword: false },
    { id: 9, title: "LISTING-ACTIVITY", flag: 'listing_activity', category: 'activities', requirePassword: false },
    { id: 10, title: "CATEGORY", flag: 'category', category: 'products', requirePassword: false },
    { id: 11, title: "CATEGORY-LIST-SKU/s", flag: 'category_list_skus', category: 'products', requirePassword: false },
    { id: 12, title: "APPROVAL-SETTING", flag: 'approval_setting', category: 'settings', requirePassword: false },
    { id: 13, title: "BUDGET-VIEW", flag: 'budget_view', category: 'finance', requirePassword: false },
    { id: 14, title: "404-PAGE", flag: 'page_404', category: 'settings', requirePassword: false },
    { id: 15, title: "CLAIMS-lISTING-ACTIVITY", flag: 'claims_listing_activity', category: 'activities', requirePassword: false },
    { id: 16, title: "LICENSE", flag: 'license', category: 'settings', requirePassword: true },
    { id: 18, title: "GROUP-ACCOUNT", flag: 'monther_account', category: 'accounts', requirePassword: false },
    { id: 19, title: "MOTHER-ACCOUNT", flag: 'sub_mother_account', category: 'accounts', requirePassword: false },
    { id: 21, title: "USER-LIST", flag: 'userList', category: 'organization', requirePassword: false },
    { id: 22, title: "Bp Accounts", flag: 'Bp_Account', category: 'accounts', requirePassword: false },
    { id: 23, title: "LIST-BP_ACCOUNT", flag: 'masterDataBranch', category: 'accounts', requirePassword: false },
    { id: 24, title: "Year", flag: 'Year', category: 'Year', requirePassword: false },

    { id: 24, title: "Accounting Rules", flag: 'Year', category: 'Year', requirePassword: false },

    
  ];

  useEffect(() => {
    async function fetchUserAndPermissions() {
      setLoading(true);

      try {
        const storedUser = localStorage.getItem('loggedInUser');
        if (!storedUser) {
          setLoading(false);
          return;
        }
        const loggedInUser = JSON.parse(storedUser);

        const { data: userData, error: userError } = await supabase
          .from('Account_Users')
          .select('*')
          .eq('id', loggedInUser.id)
          .single();

        if (userError) throw userError;
        setUser(userData);

        if (userData.ReferencePermission) {
          const { data: permData, error: permError } = await supabase
            .from('modules_permissions')
            .select('*')
            .eq('code', userData.ReferencePermission)
            .single();

          if (permError) throw permError;
          setUserPermissions(permData);
        } else {
          setUserPermissions(null);
        }

      } catch (error) {
        console.error('Error fetching user/permissions:', error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUserAndPermissions();
  }, []);

  const handleClick = async (card) => {
    if (!userPermissions) {
      Swal.fire({
        icon: 'warning',
        title: 'Oops!',
        text: 'Permissions not loaded yet',
        confirmButtonColor: '#007bff',
      });
      return;
    }

    if (!userPermissions[card.flag]) {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: `You don't have permission to access ${card.title}`,
        confirmButtonColor: '#dc3545',
      });
      return;
    }

    // Check if password is required
    if (card.requirePassword) {
      const result = await Swal.fire({
        title: '🔒 Password Required',
        text: `Enter password to access ${card.title}`,
        input: 'password',
        inputPlaceholder: 'Enter password',
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#007bff',
        cancelButtonColor: '#6c757d',
        inputValidator: (value) => {
          if (!value) {
            return 'Password is required!';
          }
        }
      });

      if (result.isConfirmed) {
        if (result.value === 'QSIT') {
          Swal.fire({
            icon: 'success',
            title: 'Access Granted!',
            text: `Welcome to ${card.title}`,
            timer: 1500,
            showConfirmButton: false,
          });
          setView(card.title);
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Wrong Password!',
            text: 'Access denied. Please try again.',
            confirmButtonColor: '#dc3545',
          });
        }
      }
    } else {
      // No password required
      setView(card.title);
    }
  };

  // Filter cards based on sort option
  const getFilteredCards = () => {
    let filtered = cards.filter(card => userPermissions[card.flag]);
    
    if (sortOption === 'all') {
      return filtered;
    } else if (sortOption === 'alphabetical') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      return filtered.filter(card => card.category === sortOption);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please log in to access modules.</div>;
  }

  if (!userPermissions) {
    return <div>No permission data found for your account.</div>;
  }

  if (view) {
    const backButtonStyle = {
      marginBottom: '20px',
      padding: '8px 16px',
      cursor: 'pointer',
      borderRadius: '6px',
      border: 'none',
      backgroundColor: '#007bff',
      color: 'white',
      fontWeight: '600',
    };

    return (
      <div style={{ padding: '20px' }}>
        <button onClick={() => setView(null)} style={backButtonStyle}>
          ← Back
        </button>

        {view === 'USER ROLE' && <UserRole />}
        {view === 'DISTRIBUTOR' && <Distributor />}
        {view === 'ACCOUNTS' && <Account />}
        {view === 'ACTIVITY' && <Activity />}
        {view === 'SALESGROUP' && <SalesGroup />}
        {view === 'DISTRIBUTOR-LISTING' && <CategorySelector />}
        {view === 'DEPARTMENT' && <Department />}
        {view === 'BUDGET-VIEW' && <Budgets />}
        {view === 'Promoted-SKU/s' && <PromotedSKU />}
        {view === 'POSITION' && <Position />}
        {view === 'LISTING-ACTIVITY' && <ListingActivity />}
        {view === 'REGULAR-SKU' && <RegularSkuTable />}
        {view === 'CATEGORY' && <Category />}
        {view === 'CATEGORY-LIST-SKU/s' && <Category_Listing />}
        {view === 'APPROVAL-SETTING' && <ApprovalSettings />}
        {view === '404-PAGE' && <NotFoundPage />}
        {view === 'MODULE' && <ModuleForm />}
        {view === 'CLAIMS-lISTING-ACTIVITY' && <ClaimsListing />}
        {view === 'LICENSE' && <LicenseSelectionPage />}
        {view === 'CUSTOMER-GROUP' && <CustomerGroup />}
        {view === 'GROUP-ACCOUNT' && <MotherAccount />}
        {view === 'MOTHER-ACCOUNT' && <MotherAccountUI />}
        {view === 'BRANCH-LISTING' && <BranchListing />}
        {view === 'BP-ACCOUNT' && <Sub_3rdmotherAccounts />}
        {view === 'USER-LIST' && <UserList />}
        {view === 'LIST-BP_ACCOUNT' && <MasterDataBranch />}
        {view === 'Bp Accounts' && <Bp_Account />}

        {view === 'Year' && <Year />}
        {view === 'Accounting Rules' && <AccountingModule />}
        
      </div>
    );
  }

  const filteredCards = getFilteredCards();

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header with Sort Dropdown */}
      <div style={{ 
        marginBottom: '30px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <h1 style={{ margin: 0, color: '#333', fontSize: '28px', fontWeight: '700' }}>
          Reference Modules
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: '600', color: '#555', fontSize: '14px' }}>
            Sort by:
          </label>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              backgroundColor: 'white',
              color: '#333',
              outline: 'none',
            }}
          >
            <option value="all">All Modules</option>
            <option value="alphabetical">A-Z Alphabetical</option>
            <option value="accounts">Accounts</option>
            <option value="organization">Organization</option>
            <option value="activities">Activities</option>
            <option value="products">Products</option>
            <option value="finance">Finance</option>
            <option value="settings">Settings</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div
        className="card-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
        }}
      >
        {filteredCards.map((card) => (
          <button
            key={card.id}
            className="card-button"
            onClick={() => handleClick(card)}
            style={{
              background: card.requirePassword 
                ? 'linear-gradient(to bottom right, #fff3cd, #ffeaa7)' 
                : 'linear-gradient(to bottom right, #ffffff, #f0f0f0)',
              border: card.requirePassword ? '1px solid #ffc107' : '1px solid #ccc',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              height: '150px',
              color: '#333',
              textAlign: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={e => {
              if (card.requirePassword) {
                e.currentTarget.style.background = 'linear-gradient(to bottom right, #ffeaa7, #fdcb6e)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(255, 193, 7, 0.3)';
              } else {
                e.currentTarget.style.background = 'linear-gradient(to bottom right, #e9f5ff, #dbefff)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.borderColor = '#99cfff';
                e.currentTarget.style.color = '#1d5ea8';
              }
              e.currentTarget.style.transform = 'translateY(-5px)';
            }}
            onMouseLeave={e => {
              if (card.requirePassword) {
                e.currentTarget.style.background = 'linear-gradient(to bottom right, #fff3cd, #ffeaa7)';
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.borderColor = '#ffc107';
              } else {
                e.currentTarget.style.background = 'linear-gradient(to bottom right, #ffffff, #f0f0f0)';
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.borderColor = '#ccc';
                e.currentTarget.style.color = '#333';
              }
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {card.requirePassword && (
              <span style={{ fontSize: '24px' }}>🔒</span>
            )}
            {card.title}
          </button>
        ))}
      </div>
    </div>
  );
};

export default References;
