import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

const ROW_OPTIONS = [5, 10, 20];

const Budgets = () => {
    const [budgets, setBudgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ id: null, pwp_code: '', amountbadget: '', remainingbalance: '', approved: null });
    const [isEditing, setIsEditing] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    const fetchBudgets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('amount_badget')
            .select('*')
            .order('pwp_code', { ascending: true });

        if (error) {
            Swal.fire('Error', 'Error fetching budgets: ' + error.message, 'error');
        } else {
            setBudgets(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBudgets();
    }, []);

    const openEditModal = (budget) => {
        setForm({
            id: budget.id,
            pwp_code: budget.pwp_code,
            amountbadget: budget.amountbadget,
            remainingbalance: budget.remainingbalance,
            approved: budget.Approved
        });
        setIsEditing(true);
        setModalOpen(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.pwp_code.trim() || !form.amountbadget || !form.remainingbalance) {
            Swal.fire('Validation Error', 'All fields are required.', 'warning');
            return;
        }

        setLoading(true);

        if (isEditing) {
            const { error } = await supabase
                .from('amount_badget')
                .update({
                    pwp_code: form.pwp_code,
                    amountbadget: parseFloat(form.amountbadget),
                    remainingbalance: parseFloat(form.remainingbalance),
                    Approved: form.approved === 'true' ? true : false
                })
                .eq('id', form.id);

            if (error) {
                Swal.fire('Update Error', error.message, 'error');
            } else {
                Swal.fire('Success', 'Budget updated successfully!', 'success');
                setModalOpen(false);
                fetchBudgets();
            }
        }

        setLoading(false);
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'You will not be able to recover this budget!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('amount_badget').delete().eq('id', id);
            if (error) {
                Swal.fire('Delete Error', error.message, 'error');
            } else {
                Swal.fire('Deleted!', 'Budget has been deleted.', 'success');
                fetchBudgets();
            }
        }
    };

    // Search
    const filteredBudgets = budgets.filter(budget => {
        const term = searchTerm.toLowerCase();
        return (
            budget.pwp_code.toLowerCase().includes(term) ||
            budget.amountbadget.toString().includes(term) ||
            budget.remainingbalance.toString().includes(term)
        );
    });

    // Pagination
    const totalPages = Math.ceil(filteredBudgets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentItems = filteredBudgets.slice(startIndex, startIndex + itemsPerPage);

    const goToPage = (page) => {
        if (page < 1) page = 1;
        else if (page > totalPages) page = totalPages;
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (e) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    return (
        <div style={containerStyle}>
            <h2>Budgets</h2>
            <button onClick={() => setModalOpen(true)} style={addButtonStyle}>+ Add New Budget</button>

            <div style={tableWrapperStyle}>
                <div style={searchWrapperStyle}>
                    <input
                        type="text"
                        placeholder="Search by PWP code, amount, etc."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        style={searchInputStyle}
                    />
                </div>

                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>ID</th>
                                    <th style={thStyle}>PWP Code</th>
                                    <th style={thStyle}>Amount</th>
                                    <th style={thStyle}>Remaining Balance</th>
                                    <th style={thStyle}>Approved</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: 12, textAlign: 'center' }}>No budgets found.</td>
                                    </tr>
                                ) : currentItems.map(budget => (
                                    <tr key={budget.id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={tdStyle}>{budget.id}</td>
                                        <td style={tdStyle}>{budget.pwp_code}</td>
                                        <td style={tdStyle}>{budget.amountbadget}</td>
                                        <td style={tdStyle}>{budget.remainingbalance}</td>
                                        <td style={tdStyle}>{budget.Approved ? 'Yes' : 'No'}</td>
                                        <td style={tdStyle}>
                                            <button onClick={() => openEditModal(budget)} style={actionBtnStyle}>Edit</button>
                                            <button onClick={() => handleDelete(budget.id)} style={{ ...actionBtnStyle, backgroundColor: '#dc3545' }}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={footerStyle}>
                            <div>
                                <label htmlFor="rowsPerPage" style={{ marginRight: '6px' }}>Rows per page:</label>
                                <select
                                    id="rowsPerPage"
                                    value={itemsPerPage}
                                    onChange={handleItemsPerPageChange}
                                    style={selectStyle}
                                >
                                    {ROW_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={paginationStyle}>
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    style={{
                                        ...pageButtonStyle,
                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === 1 ? 0.5 : 1
                                    }}
                                >Prev</button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => goToPage(page)}
                                        style={currentPage === page ? activePageButtonStyle : pageButtonStyle}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    style={{
                                        ...pageButtonStyle,
                                        cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer',
                                        opacity: currentPage === totalPages || totalPages === 0 ? 0.5 : 1
                                    }}
                                >Next</button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal for Adding/Editing Budget */}
            {modalOpen && (
                <div style={modalOverlayStyle}>
                    <div style={modalStyle}>
                        <div style={modalHeaderStyle}>
                            {isEditing ? 'Edit Budget' : 'Add New Budget'}
                        </div>
                        <form onSubmit={handleSubmit} style={formStyle}>
                            <label>PWP Code</label>
                            <input
                                type="text"
                                name="pwp_code"
                                value={form.pwp_code}
                                onChange={handleChange}
                                required
                                style={inputStyle}
                                placeholder="Enter PWP Code"
                            />
                            <label>Amount</label>
                            <input
                                type="number"
                                name="amountbadget"
                                value={form.amountbadget}
                                onChange={handleChange}
                                required
                                style={inputStyle}
                                placeholder="Enter Amount"
                            />
                            <label>Remaining Balance</label>
                            <input
                                type="number"
                                name="remainingbalance"
                                value={form.remainingbalance}
                                onChange={handleChange}
                                required
                                style={inputStyle}
                                placeholder="Enter Remaining Balance"
                            />
                            <label>Approved</label>
                            <select
                                name="approved"
                                value={form.approved}
                                onChange={handleChange}
                                required
                                style={inputStyle}
                            >
                                <option value={null}>Select Approval Status</option>
                                <option value={true}>Approved</option>
                                <option value={false}>Not Approved</option>
                            </select>

                            <div style={modalActionsStyle}>
                                <button type="submit" style={submitButtonStyle}>{isEditing ? 'Update' : 'Create'} Budget</button>
                                <button type="button" onClick={() => setModalOpen(false)} style={cancelButtonStyle}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Styles
const containerStyle = {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    backgroundColor: '#fff',
};

const addButtonStyle = {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

const tableWrapperStyle = {
    marginTop: '20px',
    overflowX: 'auto',
};

const searchWrapperStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '10px',
};

const searchInputStyle = {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    width: '250px',
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
};

const thStyle = {
    padding: '12px 15px',
    backgroundColor: '#f2f2f2',
    textAlign: 'left',
    fontWeight: 'bold',
};

const tdStyle = {
    padding: '12px 15px',
    borderBottom: '1px solid #ddd',
};

const actionBtnStyle = {
    padding: '6px 12px',
    margin: '0 5px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

const footerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px',
};

const selectStyle = {
    padding: '6px',
    fontSize: '14px',
    borderRadius: '5px',
    border: '1px solid #ccc',
};

const paginationStyle = {
    display: 'flex',
    alignItems: 'center',
};

const pageButtonStyle = {
    padding: '8px 12px',
    margin: '0 5px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

const activePageButtonStyle = {
    ...pageButtonStyle,
    backgroundColor: '#0056b3',
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
};

const modalStyle = {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '8px',
    width: '500px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
};

const modalHeaderStyle = {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '20px',
    textAlign: 'center',
};

const formStyle = {
    display: 'flex',
    flexDirection: 'column',
};

const inputStyle = {
    padding: '10px',
    marginBottom: '15px',
    border: '1px solid #ccc',
    borderRadius: '5px',
    fontSize: '14px',
};

const modalActionsStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
};

const submitButtonStyle = {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

const cancelButtonStyle = {
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
};

export default Budgets;
