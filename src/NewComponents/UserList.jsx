import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    handleSearch();
    setCurrentPage(1); // Reset to first page on new search
  }, [searchTerm, users]);

const fetchUsers = async () => {
  setLoading(true);
  const { data, error } = await supabase
    .from('Account_Users')
    .select('id, username, role, name, "UserID"')
    .gte('UserID', 1)
    .lte('UserID', 100)
    .order('UserID', { ascending: true }); // Optional: sorts by UserID

  if (error) {
    console.error('Error fetching users:', error.message);
  } else {
    setUsers(data);
  }

  setLoading(false);
};

  const handleSearch = () => {
    const term = searchTerm.toLowerCase();
    const filtered = users.filter((user) =>
      user.name?.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  };

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) return <p style={{ padding: '20px' }}>🔄 Loading users...</p>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2 style={{ color: '#0077cc' }}>User List</h2>

      {/* Search Bar */}
      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          placeholder="Search by Agent Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px',
            width: '100%',
            maxWidth: '300px',
            borderRadius: '6px',
            border: '1px solid #0077cc',
            fontSize: '14px',
          }}
        />
      </div>

      {/* User Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#0077cc', color: 'white' }}>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>User ID</th>
            <th style={thStyle}>Username</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Agent Name</th>
          </tr>
        </thead>
        <tbody>
          {paginatedUsers.map((user) => (
            <tr
              key={user.id}
              style={{
                ...rowStyle,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#e6f2ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <td style={tdStyle}>{user.id}</td>
              <td style={tdStyle}>{user.UserID}</td>
              <td style={tdStyle}>{user.username}</td>
              <td style={tdStyle}>{user.role}</td>
              <td style={tdStyle}>{user.name}</td>
            </tr>
          ))}
          {paginatedUsers.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Controls */}
      {filteredUsers.length > itemsPerPage && (
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={paginationButtonStyle}
          >
            ← Prev
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            style={paginationButtonStyle}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

// Table styles
const thStyle = {
  padding: '12px',
  textAlign: 'left',
  borderBottom: '1px solid #ccc',
};

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #eee',
};

const rowStyle = {
  backgroundColor: '#fff',
};

const paginationButtonStyle = {
  padding: '8px 12px',
  borderRadius: '5px',
  border: 'none',
  backgroundColor: '#0077cc',
  color: 'white',
  cursor: 'pointer',
};

export default UserList;
