import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../Firebase';
import Swal from 'sweetalert2';
import { supabase } from '../supabaseClient';
import { deleteDoc } from 'firebase/firestore';

export default function LicenseSelectionPage({ setNewUserData, setSelectedUser }) {
    const [filteredServices, setFilteredServices] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [clients, setClients] = useState([]);
    const [usersByClient, setUsersByClient] = useState({});
    const [viewingServiceDetails, setViewingServiceDetails] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [viewingClient, setViewingClient] = useState(false);

    const handleDeleteClient = async (clientId) => {
        try {
            const confirm = await Swal.fire({
                title: 'Are you sure?',
                text: "This will permanently delete the client and all its users!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, delete it!',
            });

            if (!confirm.isConfirmed) return;

            // Delete the client document
            const clientRef = doc(db, "services", selectedService.id, "clients", clientId);
            await deleteDoc(clientRef);

            // Update local state
            setClients(prev => prev.filter(c => c.id !== clientId));
            setUsersByClient(prev => {
                const updated = { ...prev };
                delete updated[clientId];
                return updated;
            });

            Swal.fire({
                icon: 'success',
                title: 'Deleted!',
                text: 'Client has been deleted.',
                timer: 1500,
                showConfirmButton: false,
            });

        } catch (error) {
            console.error("Error deleting client:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to delete client.',
            });
        }
    };

    // State for editing
    const [editingUserId, setEditingUserId] = useState(null);
    const [editFormData, setEditFormData] = useState({
        isTaken: false,
        subscriptionStart: '',
        subscriptionEnd: '',
    });

    // New state to track toggle loading per user
    const [togglingUserId, setTogglingUserId] = useState(null);

    useEffect(() => {
        const fetchLicenseCards = async () => {
            setLoadingUsers(true);
            try {
                const { data: supabaseLicenses, error } = await supabase
                    .from('subscription_licenses')
                    .select('key');

                if (error) throw error;

                const supabaseKeys = supabaseLicenses.map(item => item.key);

                const ref = collection(db, "services");
                const snapshot = await getDocs(ref);

                const filtered = snapshot.docs
                    .filter(doc => supabaseKeys.includes(doc.id))
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        hasLicense: true,
                    }));

                setFilteredServices(filtered);
            } catch (err) {
                console.error("Error loading license cards:", err);
                setFilteredServices([]);
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchLicenseCards();
    }, []);

    const formatDate = (timestamp) => {
        if (!timestamp?.seconds) return "N/A";
        return new Date(timestamp.seconds * 1000).toLocaleDateString();
    };

    const parseDateToTimestamp = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return { seconds: Math.floor(date.getTime() / 1000) };
    };

    const handleRowClick = async (user) => {
        try {
            const userRef = doc(
                db,
                "services",
                selectedService.id,
                "clients",
                selectedClientId,
                "users",
                user.id
            );

            await updateDoc(userRef, { isTaken: true });

            setUsersByClient((prev) => ({
                ...prev,
                [selectedClientId]: prev[selectedClientId].map((u) =>
                    u.id === user.id ? { ...u, isTaken: true } : u
                ),
            }));

            localStorage.setItem("selectedLicenseUser", JSON.stringify(user));
            localStorage.setItem("selectedLicenseKey", user.licenseKey || '');

            setNewUserData(prev => ({
                ...prev,
                licensekey: user.licenseKey,
                userCode: user.userCode || '',
                subscriptionStart: user.subscriptionStart,
                subscriptionEnd: user.subscriptionEnd,
            }));

            setSelectedUser(user);

            await Swal.fire({
                icon: 'success',
                title: 'License Assigned!',
                text: `User ${user.userCode || user.id} marked as taken.`,
            });
        } catch (error) {
            console.error("❌ Failed to mark license as taken:", error);

            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to assign the license.',
            });
        }
    };

    const handleServiceClick = async (service) => {
        setSelectedService(service);
        setViewingServiceDetails(true);
        setClients([]);
        setUsersByClient({});
        setLoadingUsers(true);

        try {
            const clientsRef = collection(db, "services", service.id, "clients");
            const clientSnap = await getDocs(clientsRef);
            const clientList = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClients(clientList);

            const usersMap = {};
            for (const client of clientList) {
                const usersRef = collection(db, "services", service.id, "clients", client.id, "users");
                const userSnap = await getDocs(usersRef);
                usersMap[client.id] = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            setUsersByClient(usersMap);
        } catch (err) {
            console.error("Error loading clients and users:", err);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Handle edit button click: open form with user data (only isTaken + dates)
    const handleEditClick = (user) => {
        setEditingUserId(user.id);

        setEditFormData({
            isTaken: !!user.isTaken,
            subscriptionStart: user.subscriptionStart
                ? new Date(user.subscriptionStart.seconds * 1000).toISOString().slice(0, 10)
                : '',
            subscriptionEnd: user.subscriptionEnd
                ? new Date(user.subscriptionEnd.seconds * 1000).toISOString().slice(0, 10)
                : '',
        });
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;

        if (name === "isTaken") {
            setEditFormData(prev => ({
                ...prev,
                isTaken: value === "true",
            }));
        } else {
            setEditFormData(prev => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handleSaveEdit = async () => {
        if (!editingUserId) return;

        setLoadingUsers(true);

        try {
            const userRef = doc(
                db,
                "services",
                selectedService.id,
                "clients",
                selectedClientId,
                "users",
                editingUserId
            );

            const updatedData = {
                isTaken: editFormData.isTaken,
                subscriptionStart: parseDateToTimestamp(editFormData.subscriptionStart),
                subscriptionEnd: parseDateToTimestamp(editFormData.subscriptionEnd),
            };

            if (!updatedData.subscriptionStart) delete updatedData.subscriptionStart;
            if (!updatedData.subscriptionEnd) delete updatedData.subscriptionEnd;

            await updateDoc(userRef, updatedData);

            setUsersByClient(prev => ({
                ...prev,
                [selectedClientId]: prev[selectedClientId].map(u =>
                    u.id === editingUserId ? { ...u, ...updatedData } : u
                ),
            }));

            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'User data updated successfully.',
            });

            setEditingUserId(null);
        } catch (error) {
            console.error("Error updating user:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to update user data.',
            });
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingUserId(null);
    };

    // --- New handlers for toggle and inline date edits ---

    // Handle toggle change for isTaken
    const handleToggleIsTaken = async (user) => {
        const newIsTaken = !user.isTaken;
        setTogglingUserId(user.id);

        try {
            const userRef = doc(
                db,
                "services",
                selectedService.id,
                "clients",
                selectedClientId,
                "users",
                user.id
            );

            await updateDoc(userRef, { isTaken: newIsTaken });

            setUsersByClient(prev => ({
                ...prev,
                [selectedClientId]: prev[selectedClientId].map(u =>
                    u.id === user.id ? { ...u, isTaken: newIsTaken } : u
                ),
            }));

            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: `License isTaken set to ${newIsTaken ? "Yes" : "No"}.`,
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Error toggling isTaken:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Failed to update isTaken status.',
            });
        } finally {
            setTogglingUserId(null);
        }
    };

    // Handle inline date changes
    const handleDateChange = (userId, field, value) => {
        setUsersByClient(prev => ({
            ...prev,
            [selectedClientId]: prev[selectedClientId].map(u =>
                u.id === userId ? { ...u, [field]: value } : u
            ),
        }));
    };

    // Save date to Firestore on blur
    const handleDateSave = async (user, field) => {
        const dateStr = user[field];
        const timestamp = parseDateToTimestamp(dateStr);

        if (!timestamp && dateStr !== '') {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Date',
                text: 'Please enter a valid date.',
            });
            return;
        }

        try {
            const userRef = doc(
                db,
                "services",
                selectedService.id,
                "clients",
                selectedClientId,
                "users",
                user.id
            );

            const updateData = {};
            if (dateStr === '') {
                updateData[field] = null; // or use deleteField if you want to remove from firestore
            } else {
                updateData[field] = timestamp;
            }

            await updateDoc(userRef, updateData);

            Swal.fire({
                icon: 'success',
                title: 'Date Updated',
                text: `${field === 'subscriptionStart' ? 'Subscription Start' : 'Subscription End'} updated.`,
                timer: 1200,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Error updating date:", error);
            Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: 'Could not update the date.',
            });
        }
    };

    return (
        <div className="container py-4">
            <h2>License Selection</h2>

            {loadingUsers ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                    <p className="mt-3">Loading license keys…</p>
                </div>
            ) : !viewingServiceDetails ? (
                <div className="d-flex flex-wrap gap-3">
                    {filteredServices.length === 0 ? (
                        <p className="text-muted">No license keys found.</p>
                    ) : (
                        filteredServices.map((service) => (
                            <div
                                key={service.id}
                                className="card shadow-sm border border-secondary"
                                style={{ width: "18rem", cursor: "pointer" }}
                                onClick={() => handleServiceClick(service)}
                            >
                                <div className="card-body">
                                    <h5 className="card-title text-truncate">ID: {service.id}</h5>
                                    <h6 className="card-subtitle mb-2 text-primary text-truncate">
                                        Name: {service.name || "N/A"}
                                    </h6>
                                    <p className="card-text text-muted mb-0">
                                        <small>
                                            <strong>Created:</strong>{" "}
                                            {service.createdAt
                                                ? new Date(service.createdAt.seconds * 1000).toLocaleString()
                                                : "Unknown"}
                                        </small>
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                // Viewing Service Details
                <div>
                    <button
                        className="btn btn-secondary mb-3"
                        onClick={() => {
                            setViewingServiceDetails(false);
                            setSelectedClientId(null);
                            setViewingClient(false);
                            setEditingUserId(null);
                        }}
                    >
                        &larr; Back to Services
                    </button>
                    {!viewingClient && (
                        <>
                            <h4 className="mb-4">Clients of Service: {selectedService?.id}</h4>

                            {clients.map(client => (
                                <div
                                    key={client.id}
                                    className="card shadow-sm border rounded-3 position-relative"
                                    style={{
                                        width: "20rem",
                                        cursor: "pointer",
                                        transition: "transform 0.3s ease, box-shadow 0.3s ease",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                                        backgroundColor: "#fff",
                                    }}
                                    onClick={() => {
                                        setSelectedClientId(client.id);
                                        setViewingClient(true);
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = "translateY(-6px) scale(1.03)";
                                        e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = "translateY(0) scale(1)";
                                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                                    }}
                                >
                                    <div className="card-body">
                                        <h5 className="card-title fw-semibold mb-2" style={{ fontSize: "1.25rem" }}>
                                            {client.name || "Client Name N/A"}
                                        </h5>
                                        <p
                                            className="card-text text-truncate text-muted"
                                            style={{ fontSize: "0.9rem", letterSpacing: "0.02em" }}
                                            title={client.id}
                                        >
                                            ID: {client.id}
                                        </p>

                                        {/* Delete Button */}
                                        <button
                                            className="btn btn-sm btn-danger mt-2"
                                            onClick={(e) => {
                                                e.stopPropagation(); // prevent navigating into client view
                                                handleDeleteClient(client.id);
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}


                        </>
                    )}




                    {viewingClient && (
                        <>
                            <button
                                className="btn btn-outline-secondary mb-3"
                                onClick={() => {
                                    setViewingClient(false);
                                    setSelectedClientId(null);
                                    setEditingUserId(null);
                                }}
                            >
                                &larr; Back to Clients
                            </button>

                            <h5>Users of Client: {selectedClientId}</h5>

                            {loadingUsers ? (
                                <div className="text-center my-3">
                                    <div className="spinner-border" role="status" />
                                </div>
                            ) : (
                                <div style={{ maxHeight: '500px', overflowX: 'auto' }}>
                                    <table
                                        className="table table-striped table-hover align-middle"
                                        style={{ minWidth: '850px', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}
                                    >
                                        <thead className="table-dark position-sticky top-0" style={{ boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                                            <tr>
                                                <th scope="col">License Key</th>
                                                <th scope="col">User Code</th>
                                                <th scope="col">Created At</th>
                                                <th scope="col" className="text-center">Is Taken?</th>
                                                <th scope="col">Subscription Start</th>
                                                <th scope="col">Subscription End</th>
                                                <th scope="col" style={{ minWidth: '100px' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {usersByClient[selectedClientId]?.map(user => {
                                                const createdDate = user.createdAt
                                                    ? new Date(user.createdAt.seconds * 1000).toLocaleString()
                                                    : "Unknown";

                                                return (
                                                    <tr
                                                        key={user.id}
                                                        style={{
                                                            backgroundColor: user.isTaken ? "#f8f9fa" : "white",
                                                            color: user.isTaken ? "#6c757d" : "inherit",
                                                            cursor: user.isTaken ? "not-allowed" : "pointer",
                                                            transition: 'background-color 0.3s ease',
                                                        }}
                                                        onClick={() => !user.isTaken && handleRowClick(user)}
                                                    >
                                                        <td className="text-break">{user.licenseKey}</td>
                                                        <td>{user.userCode || "N/A"}</td>
                                                        <td>{createdDate}</td>
                                                        <td className="text-center">
                                                            <div className="form-check form-switch d-flex justify-content-center align-items-center">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    role="switch"
                                                                    id={`toggleIsTaken-${user.id}`}
                                                                    checked={user.isTaken}
                                                                    disabled={togglingUserId === user.id}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        handleToggleIsTaken(user);
                                                                    }}
                                                                    style={{ cursor: 'pointer', width: '2.5em', height: '1.25em' }}
                                                                />
                                                                {togglingUserId === user.id && (
                                                                    <div className="spinner-border spinner-border-sm ms-2" role="status" />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="date"
                                                                className="form-control form-control-sm"
                                                                value={user.subscriptionStart ? (user.subscriptionStart.seconds
                                                                    ? new Date(user.subscriptionStart.seconds * 1000).toISOString().slice(0, 10)
                                                                    : user.subscriptionStart) : ''}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDateChange(user.id, 'subscriptionStart', e.target.value);
                                                                }}
                                                                onBlur={() => handleDateSave(user, 'subscriptionStart')}
                                                                style={{ maxWidth: '140px' }}
                                                                disabled={editingUserId === user.id}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="date"
                                                                className="form-control form-control-sm"
                                                                value={user.subscriptionEnd ? (user.subscriptionEnd.seconds
                                                                    ? new Date(user.subscriptionEnd.seconds * 1000).toISOString().slice(0, 10)
                                                                    : user.subscriptionEnd) : ''}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDateChange(user.id, 'subscriptionEnd', e.target.value);
                                                                }}
                                                                onBlur={() => handleDateSave(user, 'subscriptionEnd')}
                                                                style={{ maxWidth: '140px' }}
                                                                disabled={editingUserId === user.id}
                                                            />
                                                        </td>
                                                        <td>
                                                            {editingUserId === user.id ? (
                                                                <>
                                                                    <button
                                                                        className="btn btn-success btn-sm me-2"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleSaveEdit();
                                                                        }}
                                                                        style={{ minWidth: '80px' }}
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-outline-secondary btn-sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCancelEdit();
                                                                        }}
                                                                        style={{ minWidth: '80px' }}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    className="btn btn-primary btn-sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEditClick(user);
                                                                    }}
                                                                    disabled={user.isTaken}
                                                                    style={{ minWidth: '75px' }}
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )
            }
        </div >
    );

}
