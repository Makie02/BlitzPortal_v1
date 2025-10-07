import React, { useState } from 'react';
import UserRole from '../NewComponents/UserRole';

const CardButtons = () => {
  const [view, setView] = useState('cards'); // 'cards' or 'userrole'

  const cards = [
    { id: 1, title: "DISTRIBUTOR" },
    { id: 2, title: "ACTIVITY" },
    { id: 3, title: "ACCOUNTS" },
    { id: 4, title: "USER ROLE" },
    { id: 5, title: "USER MANAGEMENT" },
    { id: 6, title: "Promoted-SKU/s" },
    { id: 7, title: "BRANDS" },
  ];

  const handleClick = (card) => {
    if (card.title === 'USER ROLE') {
      setView('userrole');
    } else {
      alert(`${card.title} clicked`);
    }
  };

  if (view === 'userrole') {
    return (
      <div>
        <button onClick={() => setView('cards')} style={{marginBottom: '20px'}}>
          ← Back to Cards
        </button>
        <UserRole />
      </div>
    );
  }

  return (
    <div className="card-grid">
      {cards.map((card) => (
        <button
          key={card.id}
          className="card-button"
          onClick={() => handleClick(card)}
        >
          {card.title}
        </button>
      ))}
    </div>
  );
};

export default CardButtons;
