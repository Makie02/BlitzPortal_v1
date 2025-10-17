import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editUser, setEditUser] = useState(null); // for editing user
  const [showModal, setShowModal] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    handleSearch();
    setCurrentPage(1);
  }, [searchTerm, users]);

  // ✅ Fetch all users (paginated style)
  const fetchUsers = async () => {
    try {
      setLoading(true);

      const batchSize = 1000;
      let allData = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        console.log(`📥 Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})`);

        const { data, error } = await supabase
          .from('Account_Users')
          .select('id, username, role, name, "UserID"')
          .range(offset, offset + batchSize - 1)
          .order('UserID', { ascending: true });

        if (error) throw error;

        console.log(`✅ Fetched ${data?.length || 0} users`);

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setUsers(allData);
      console.log(`🏁 Total fetched users: ${allData.length}`);
    } catch (error) {
      Swal.fire('Error', `Failed to fetch users: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const term = searchTerm.toLowerCase();
    const filtered = users.filter((user) =>
      user.name?.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  };

  const handleEditClick = (user) => {
    setEditUser({ ...user });
    setShowModal(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase
        .from('Account_Users')
        .update({
          username: editUser.username,
          role: editUser.role,
          name: editUser.name,
        })
        .eq('id', editUser.id);

      if (error) throw error;

      Swal.fire('✅ Success', 'User updated successfully!', 'success');
      setShowModal(false);
      fetchUsers(); // refresh
    } catch (error) {
      Swal.fire('❌ Error', error.message, 'error');
    }
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
      <table className="table table-bordered table-hover">
        <thead className="table-primary">
          <tr>
            <th>ID</th>
            <th>Agent Code</th>
            <th>Username</th>
            <th>Role</th>
            <th>Agent Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedUsers.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.UserID}</td>
              <td>{user.username}</td>
              <td>{user.role}</td>
              <td>{user.name}</td>
              <td>
                <button
                  className="btn btn-sm btn-warning"
                  onClick={() => handleEditClick(user)}
                >
                  ✏️ Edit
                </button>
              </td>
            </tr>
          ))}
          {paginatedUsers.length === 0 && (
            <tr>
              <td colSpan="6" className="text-center">
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Controls */}
      {filteredUsers.length > itemsPerPage && (
        <div className="d-flex justify-content-center align-items-center mt-3 gap-2">
          <button
            className="btn btn-primary"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-primary"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {showModal && (
        <div
          className="modal fade show"
          style={{
            display: 'block',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">Edit User</h5>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={editUser.username || ''}
                    onChange={handleEditChange}
                    className="form-control"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Role</label>
                  <input
                    type="text"
                    name="role"
                    value={editUser.role || ''}
                    onChange={handleEditChange}
                    className="form-control"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Agent Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editUser.name || ''}
                    onChange={handleEditChange}
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-success" onClick={handleSaveEdit}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
