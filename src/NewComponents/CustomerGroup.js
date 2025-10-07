import React, { useState } from 'react';
import UserRole from '../NewComponents/UserRole';
import CustomerGroup1 from '../Customer/CustomerGroup1';
import CustomerGroup2 from '../Customer/CustomerGroup2';
import CustomerGroup3 from '../Customer/CustomerGroup3';
import CustomerGroup4 from '../Customer/CustomerGroup4';
import CustomerGroup5 from '../Customer/CustomerGroup5';

const CustomerGroup = (setCurrentView) => {
    const [view, setView] = useState(null); // null means show cards list

    const cards = [
        { id: 1, title: "CUSTOMER-GROUP-1" },
        { id: 2, title: "CUSTOMER-GROUP-2" },

        { id: 3, title: "CUSTOMER-GROUP-3" },

        { id: 4, title: "CUSTOMER-GROUP-4" },
        { id: 5, title: "CUSTOMER-GROUP-5" },




    ];

    const handleClick = (card) => {
        // For cards that have components, set view to title
        if (card.title === 'CUSTOMER-GROUP-1' || card.title === 'CUSTOMER-GROUP-2' ||
            card.title === 'CUSTOMER-GROUP-3' || card.title === 'CUSTOMER-GROUP-4' || card.title === 'CUSTOMER-GROUP-5'


        ) {
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
                    ← Back to Customer Groups
                </button>

                {view === 'CUSTOMER-GROUP-1' && <CustomerGroup1 />}

                {view === 'CUSTOMER-GROUP-2' && <CustomerGroup2 />}
                {view === 'CUSTOMER-GROUP-3' && <CustomerGroup3 />}
                {view === 'CUSTOMER-GROUP-4' && <CustomerGroup4 />}
                {view === 'CUSTOMER-GROUP-5' && <CustomerGroup5 />}



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

export default CustomerGroup;
