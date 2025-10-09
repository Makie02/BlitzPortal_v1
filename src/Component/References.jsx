import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // iyong supabase client config dito
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

const References = ({ setCurrentView }) => {
  const [view, setView] = useState(null); // selected view
  const [user, setUser] = useState(null); // logged in user from Account_Users
  const [userPermissions, setUserPermissions] = useState(null); // modules_permissions row matched
  const [loading, setLoading] = useState(true);

  // Cards info + what boolean flag each card corresponds to
  const cards = [
    { id: 1, title: "DISTRIBUTOR", flag: 'distributor' },
    { id: 2, title: "DISTRIBUTOR-LISTING", flag: 'distributor_listing' },
    { id: 3, title: "MODULE", flag: 'module' },
    { id: 4, title: "ACTIVITY", flag: 'activity' },
    { id: 5, title: "DEPARTMENT", flag: 'department' },
    { id: 6, title: "USER ROLE", flag: 'user_role' },
    { id: 7, title: "SALESGROUP", flag: 'salesgroup' },
    { id: 8, title: "POSITION", flag: 'position' },
    { id: 9, title: "LISTING-ACTIVITY", flag: 'listing_activity' },
    { id: 10, title: "CATEGORY", flag: 'category' },
    { id: 11, title: "CATEGORY-LIST-SKU/s", flag: 'category_list_skus' },
    { id: 12, title: "APPROVAL-SETTING", flag: 'approval_setting' },
    { id: 13, title: "BUDGET-VIEW", flag: 'budget_view' },
    { id: 14, title: "404-PAGE", flag: 'page_404' },
    { id: 15, title: "CLAIMS-lISTING-ACTIVITY", flag: 'claims_listing_activity' },
    { id: 16, title: "LICENSE", flag: 'license' },
    { id: 17, title: "CUSTOMER-GROUP", flag: 'customer_group' },
    { id: 18, title: "GROUP-ACCOUNT", flag: 'monther_account' },
    { id: 19, title: "SUB-MOTHER-ACCOUNT", flag: 'sub_mother_account' },
    { id: 20, title: "BRANCH-ACCOUNT", flag: 'sub_3rd_mother_account' },

    { id: 21, title: "BRANCH-LISTING", flag: 'branch_listing' },
  ];

  useEffect(() => {
    async function fetchUserAndPermissions() {
      setLoading(true);

      try {
        // Assume you already have user ID stored in localStorage or auth session
        const storedUser = localStorage.getItem('loggedInUser');
        if (!storedUser) {
          setLoading(false);
          return;
        }
        const loggedInUser = JSON.parse(storedUser);

        // Fetch user from Account_Users with ReferencePermission
        const { data: userData, error: userError } = await supabase
          .from('Account_Users')
          .select('*')
          .eq('id', loggedInUser.id)
          .single();

        if (userError) throw userError;
        setUser(userData);

        // Fetch modules_permissions where code = user.ReferencePermission
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

  const handleClick = (card) => {
    if (!userPermissions) {
      alert('Permissions not loaded yet');
      return;
    }

    // Check if permission flag for this card is true
    if (userPermissions[card.flag]) {
      setView(card.title);
    } else {
      alert(`Access denied for ${card.title}`);
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
        {view === 'SUB-MOTHER-ACCOUNT' && <MotherAccountUI />}
        {view === 'BRANCH-LISTING' && <BranchListing />}
        {view === 'BRANCH-ACCOUNT' && <Sub_3rdmotherAccounts />}
      </div>
    );
  }

  return (
    <div
      className="card-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        padding: '20px',
        maxWidth: '1300px',
        margin: '0 auto',
      }}
    >
      {cards
        .filter(card => userPermissions[card.flag]) // <-- only show if user has permission
        .map((card) => (
          <button
            key={card.id}
            className="card-button"
            onClick={() => handleClick(card)}
            style={{
              background: 'linear-gradient(to bottom right, #ffffff, #f0f0f0)',
              border: '1px solid #ccc',
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
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(to bottom right, #e9f5ff, #dbefff)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12)';
              e.currentTarget.style.borderColor = '#99cfff';
              e.currentTarget.style.color = '#1d5ea8';
              e.currentTarget.style.transform = 'translateY(-5px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'linear-gradient(to bottom right, #ffffff, #f0f0f0)';
              e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.06)';
              e.currentTarget.style.borderColor = '#ccc';
              e.currentTarget.style.color = '#333';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {card.title}
          </button>
        ))}
    </div>
  );

};

export default References;
