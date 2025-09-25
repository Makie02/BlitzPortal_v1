import React, { useState } from 'react';
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

const References = (setCurrentView) => {
    const [view, setView] = useState(null); // null means show cards list

    const cards = [
        { id: 1, title: "DISTRIBUTOR" },
        { id: 2, title: "DISTRIBUTOR-LISTING" },

        { id: 3, title: "MODULE" },

        { id: 4, title: "ACTIVITY" },
        { id: 5, title: "DEPARTMENT" },

        { id: 6, title: "USER ROLE" },

        { id: 7, title: "SALESGROUP" },
        { id: 8, title: "POSITION" },

        { id: 9, title: "LISTING-ACTIVITY" },


        { id: 10, title: "CATEGORY" },
        { id: 11, title: "CATEGORY-LIST-SKU/s" },

        { id: 12, title: "APPROVAL-SETTING" },

        { id: 13, title: "BUDGET-VIEW" },

        { id: 14, title: "404-PAGE" },

        { id: 15, title: "CLAIMS-lISTING-ACTIVITY" },




        

    ];

    const handleClick = (card) => {
        // For cards that have components, set view to title
        if (card.title === 'USER ROLE' || card.title === 'CLAIMS-lISTING-ACTIVITY' || card.title === 'MODULE'|| card.title === 'BUDGET-VIEW' || card.title === '404-PAGE' || card.title === 'DISTRIBUTOR-LISTING' || card.title === 'USER MANAGEMENT' || card.title === 'POSITION' || card.title === 'LISTING-ACTIVITY' || card.title === 'REGULAR-SKU'

            || card.title === 'APPROVAL-SETTING'

            || card.title === 'DEPARTMENT' || card.title === 'ACCOUNTS' || card.title === 'Promoted-SKU/s' || card.title === 'ACTIVITY' || card.title === 'SALESGROUP' || card.title === 'DISTRIBUTOR' || card.title === 'CATEGORY' || card.title === 'CATEGORY-LIST-SKU/s') {
            setView(card.title);
        } else {
            alert(`${card.title} clicked`);
        }
    };


    if (view) {
        // Back button styles reused
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
                    ← Back to Cards
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



            </div>
        );
    }

    return (
        <div
            className="card-grid"
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '20px',
                padding: '40px',
                maxWidth: '1000px',
                margin: '0 auto',
            }}
        >
            {cards.map((card) => (
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
