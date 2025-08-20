import React, { useState } from 'react';
import './RentalsForm.css';
import { supabase } from '../supabaseClient';

const RentalsForm = () => {
    const [step, setStep] = useState(1);
const [formData, setFormData] = useState({
    Principal: {
        Principal: '',      // <-- add this key
        actualCount: '',
        actualAmount: '',
        expectedCount: '',
        expectedAmount: '',
        varianceCount: '',
        varianceAmount: '',
    },
    Account: {
        Account: '',        // <-- add this key
        actualCount: '',
        actualAmount: '',
        expectedCount: '',
        expectedAmount: '',
        varianceCount: '',
        varianceAmount: '',
    },
});



    const handleInputChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
    };

    // Initialize state with 3 rows on load
    const [tableRows, setTableRows] = React.useState(() => (
        Array.from({ length: 1 }, () => ({
            principal: '',
            bpCode: '',
            account: '',
            store: '',
            rentalAmount: '',
            rentalType: '',
            location: '',
            startDate: '',
            endDate: '',
            contractNo: '',
            remarks: '',
            dateAdded: '',
            months: Array.from({ length: 12 }, () => ({ dmNo: '', amount: '' })),
        }))
    ));

    // Add new row function adds 1 row only
    const addNewRow = () => {
        setTableRows(prev => [
            ...prev,
            {
                principal: '',
                bpCode: '',
                account: '',
                store: '',
                rentalAmount: '',
                rentalType: '',
                location: '',
                startDate: '',
                endDate: '',
                contractNo: '',
                remarks: '',
                dateAdded: '',
                months: Array.from({ length: 12 }, () => ({ dmNo: '', amount: '' })),
            }
        ]);
    };

    const updateRow = (rowIdx, field, value) => {
        const rows = [...tableRows];
        rows[rowIdx][field] = value;
        setTableRows(rows);
    };

    const updateMonth = (rowIdx, monthIdx, field, value) => {
        const rows = [...tableRows];
        rows[rowIdx].months[monthIdx][field] = value;
        setTableRows(rows);
    };


    // Save Principal data
    const savePrincipal = async () => {
        const { data, error } = await supabase
            .from('rentals_principal')
            .insert([{
                description: formData.Principal.Principal || null,
                actual_amount: formData.Principal.actualAmount || null,
                actual_count: formData.Principal.actualCount || null,
                expected_amount: formData.Principal.expectedAmount || null,
                expected_count: formData.Principal.expectedCount || null,
                variance_amount: formData.Principal.varianceAmount || null,
                variance_count: formData.Principal.varianceCount || null,
            }])
            .select()
            .single();

        if (error) {
            console.error('Error inserting principal:', error);
            return null;
        }

        return data; // inserted principal record with ID
    };

    // Save Account data
    const saveAccount = async () => {
        const { data, error } = await supabase
            .from('rentals_account')
            .insert([{
                description: formData.Account.Account || null,
                actual_amount: formData.Account.actualAmount || null,
                actual_count: formData.Account.actualCount || null,
                expected_amount: formData.Account.expectedAmount || null,
                expected_count: formData.Account.expectedCount || null,
                variance_amount: formData.Account.varianceAmount || null,
                variance_count: formData.Account.varianceCount || null,
            }])
            .select()
            .single();

        if (error) {
            console.error('Error inserting account:', error);
            return null;
        }

        return data; // inserted account record with ID
    };
const saveRentalRows = async () => {
  for (const row of tableRows) {
    // Insert rental row into rentals_tables
    const { data: rentalData, error: rentalError } = await supabase
      .from('rentals_tables')
      .insert([{
        principal: row.principal || null,
        bp_code: row.bpCode || null,
        account: row.account || null,
        store: row.store || null,
        rental_amount: row.rentalAmount ? parseFloat(row.rentalAmount) : null,
        rental_type: row.rentalType || null,
        location: row.location || null,
        start_date: row.startDate || null,
        end_date: row.endDate || null,
        contract_no: row.contractNo || null,
        remarks: row.remarks || null,
        date_added: row.dateAdded || null,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (rentalError) {
      console.error('Error inserting rental row:', rentalError);
      continue; // skip this row on error
    }

    const rentalId = rentalData.id;

    // Prepare month inserts for rental_months table
    const monthsToInsert = row.months.map((month, idx) => ({
      rental_id: rentalId,
      month: idx + 1,
      dm_no: month.dmNo || null,
      amount: month.amount ? parseFloat(month.amount) : null,
    }));

    const { error: monthsError } = await supabase
      .from('rental_months')
      .insert(monthsToInsert);

    if (monthsError) {
      console.error('Error inserting rental months:', monthsError);
    }
  }
};



    return (
        <div className="rentals-container">
            <h1>🏠 Rentals</h1>

            {step === 1 && (
                <div className="form-step">
                    {/* Principal Card */}
                    <div className="form-card">
                        <h2>Principal</h2>
                        <div
                            className="form-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '16px',
                            }}
                        >
                            <div className="input-group">
                                <label>Principal Description</label>
                                <input
                                    type="text"
                                    value={formData['Principal'].Principal || ''}
                                    onChange={(e) => handleInputChange('Principal', 'Principal', e.target.value)}
                                    placeholder="Enter Principal "
                                />
                            </div>
                            <div className="input-group">
                                <label>Actual Amount</label>
                                <input
                                    type="number"
                                    value={formData['Principal'].actualAmount}
                                    onChange={(e) => handleInputChange('Principal', 'actualAmount', e.target.value)}
                                    placeholder="Actual Amount"
                                />
                            </div>
                            <div className="input-group">
                                <label>Actual Count</label>
                                <input
                                    type="number"
                                    value={formData['Principal'].actualCount}
                                    onChange={(e) => handleInputChange('Principal', 'actualCount', e.target.value)}
                                    placeholder="Actual Count"
                                />
                            </div>
                            <div className="input-group">
                                <label>Expected Amount</label>
                                <input
                                    type="number"
                                    value={formData['Principal'].expectedAmount}
                                    onChange={(e) => handleInputChange('Principal', 'expectedAmount', e.target.value)}
                                    placeholder="Expected Amount"
                                />
                            </div>
                            <div className="input-group">
                                <label>Expected Count</label>
                                <input
                                    type="number"
                                    value={formData['Principal'].expectedCount}
                                    onChange={(e) => handleInputChange('Principal', 'expectedCount', e.target.value)}
                                    placeholder="Expected Count"
                                />
                            </div>

                            {/* Second row: 2 inputs */}
                            <div className="input-group">
                                <label>Variance Amount</label>
                                <input
                                    type="number"
                                    value={formData['Principal'].varianceAmount}
                                    onChange={(e) => handleInputChange('Principal', 'varianceAmount', e.target.value)}
                                    placeholder="Variance Amount"
                                />
                            </div>
                            <div className="input-group">
                                <label>Variance Count</label>
                                <input
                                    type="number"
                                    value={formData['Principal'].varianceCount}
                                    onChange={(e) => handleInputChange('Principal', 'varianceCount', e.target.value)}
                                    placeholder="Variance Count"
                                />
                            </div>

                            {/* Empty div to keep grid alignment */}
                            <div></div>
                            <div></div>

                            {/* Description: spans all 4 columns */}

                        </div>
                    </div>

                    {/* Account Card */}
                    <div className="form-card">
                        <h2>Account</h2>
                        <div
                            className="form-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '16px',
                            }}
                        >
                            <div className="input-group">
                                <label>Account Description</label>
                                <input
                                    type="text"
                                    value={formData['Account'].Account || ''}
                                    onChange={(e) => handleInputChange('Account', 'Account', e.target.value)}
                                    placeholder="Enter Account "
                                />
                            </div>
                            <div className="input-group">
                                <label>Actual Amount</label>
                                <input
                                    type="number"
                                    value={formData['Account'].actualAmount}
                                    onChange={(e) => handleInputChange('Account', 'actualAmount', e.target.value)}
                                    placeholder="Actual Amount"
                                />
                            </div>
                            <div className="input-group">
                                <label>Actual Count</label>
                                <input
                                    type="number"
                                    value={formData['Account'].actualCount}
                                    onChange={(e) => handleInputChange('Account', 'actualCount', e.target.value)}
                                    placeholder="Actual Count"
                                />
                            </div>
                            <div className="input-group">
                                <label>Expected Amount</label>
                                <input
                                    type="number"
                                    value={formData['Account'].expectedAmount}
                                    onChange={(e) => handleInputChange('Account', 'expectedAmount', e.target.value)}
                                    placeholder="Expected Amount"
                                />
                            </div>
                            <div className="input-group">
                                <label>Expected Count</label>
                                <input
                                    type="number"
                                    value={formData['Account'].expectedCount}
                                    onChange={(e) => handleInputChange('Account', 'expectedCount', e.target.value)}
                                    placeholder="Expected Count"
                                />
                            </div>

                            {/* Second row: 2 inputs */}
                            <div className="input-group">
                                <label>Variance Amount</label>
                                <input
                                    type="number"
                                    value={formData['Account'].varianceAmount}
                                    onChange={(e) => handleInputChange('Account', 'varianceAmount', e.target.value)}
                                    placeholder="Variance Amount"
                                />
                            </div>
                            <div className="input-group">
                                <label>Variance Count</label>
                                <input
                                    type="number"
                                    value={formData['Account'].varianceCount}
                                    onChange={(e) => handleInputChange('Account', 'varianceCount', e.target.value)}
                                    placeholder="Variance Count"
                                />
                            </div>

                            {/* Empty divs for alignment */}
                            <div></div>
                            <div></div>

                            {/* Description: spans all 4 columns */}

                        </div>
                    </div>

                    <div className="footer">
                        <button style={{ float: 'right' }} className="next-btn" onClick={() => setStep(2)}>
                            Next →
                        </button>
                    </div>
                </div>
            )}



            {step === 2 && (
                <div className="table-step">
                    <div className="table-header">
                        <h2>📋 Rentals Table</h2>
                        <button onClick={addNewRow}>➕ Add New Row</button>
                    </div>

                    <div className="table-scroll">
                        <table className="rentals-table">
                            <thead>
                                <tr>
                                    <th style={{ minWidth: '140px' }}>Principal</th>
                                    <th style={{ minWidth: '100px' }}>BP Code</th>
                                    <th style={{ minWidth: '140px' }}>Account</th>
                                    <th style={{ minWidth: '120px' }}>Store</th>
                                    <th style={{ minWidth: '140px' }}>Rental (w/o VAT)</th>
                                    <th style={{ minWidth: '100px' }}>Type</th>
                                    <th style={{ minWidth: '140px' }}>Location</th>
                                    <th style={{ minWidth: '120px' }}>Start</th>
                                    <th style={{ minWidth: '120px' }}>End</th>
                                    <th style={{ minWidth: '140px' }}>Contract</th>
                                    <th style={{ minWidth: '140px' }}>Remarks</th>
                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                                        <React.Fragment key={month}>
                                            <th style={{ minWidth: '80px' }}>{month} DM</th>
                                            <th style={{ minWidth: '80px' }}>{month} Amt</th>
                                        </React.Fragment>
                                    ))}
                                    <th style={{ minWidth: '140px' }}>Date Added</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                        <td><input value={row.principal} onChange={(e) => updateRow(rowIdx, 'principal', e.target.value)} /></td>
                                        <td><input value={row.bpCode} onChange={(e) => updateRow(rowIdx, 'bpCode', e.target.value)} /></td>
                                        <td><input value={row.account} onChange={(e) => updateRow(rowIdx, 'account', e.target.value)} /></td>
                                        <td><input value={row.store} onChange={(e) => updateRow(rowIdx, 'store', e.target.value)} /></td>
                                        <td><input value={row.rentalAmount} onChange={(e) => updateRow(rowIdx, 'rentalAmount', e.target.value)} /></td>
                                        <td><input value={row.rentalType} onChange={(e) => updateRow(rowIdx, 'rentalType', e.target.value)} /></td>
                                        <td><input value={row.location} onChange={(e) => updateRow(rowIdx, 'location', e.target.value)} /></td>
                                        <td><input type="date" value={row.startDate} onChange={(e) => updateRow(rowIdx, 'startDate', e.target.value)} /></td>
                                        <td><input type="date" value={row.endDate} onChange={(e) => updateRow(rowIdx, 'endDate', e.target.value)} /></td>
                                        <td><input value={row.contractNo} onChange={(e) => updateRow(rowIdx, 'contractNo', e.target.value)} /></td>
                                        <td><input value={row.remarks} onChange={(e) => updateRow(rowIdx, 'remarks', e.target.value)} /></td>
                                        {row.months.map((month, mIdx) => (
                                            <React.Fragment key={mIdx}>
                                                <td><input value={month.dmNo} onChange={(e) => updateMonth(rowIdx, mIdx, 'dmNo', e.target.value)} /></td>
                                                <td><input value={month.amount} onChange={(e) => updateMonth(rowIdx, mIdx, 'amount', e.target.value)} /></td>
                                            </React.Fragment>
                                        ))}
                                        <td><input type="date" value={row.dateAdded} onChange={(e) => updateRow(rowIdx, 'dateAdded', e.target.value)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="footer">
                        <button className="back-btn" onClick={() => setStep(1)}>← Back</button>
                    </div>
                    <button
                        onClick={async () => {
                            const principalResult = await savePrincipal();
                            const accountResult = await saveAccount();

                            await saveRentalRows();

                            alert('Data saved!');
                        }}
                    >
                        Save All Data
                    </button>

                </div>
            )}


        </div>
    );
};

export default RentalsForm;
