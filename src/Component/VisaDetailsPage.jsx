// VisaDetailsPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function VisaDetailsPage({ visaCode, setCurrentView }) {
    const [visaData, setVisaData] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVisaDetails = async () => {
            setLoading(true);

            const [{ data: visa, error: visaError }, { data: history, error: historyError }] = await Promise.all([
                supabase.from('visa_table').select('*').eq('visaCode', visaCode).single(),
                supabase.from('amount_badget_history').select('*').eq('visacode', visaCode).order('action_date', { ascending: false }),
            ]);

            if (visaError) console.error('Visa Error:', visaError);
            if (historyError) console.error('History Error:', historyError);

            setVisaData(visa);
            setHistoryData(history || []);
            setLoading(false);
        };

        if (visaCode) fetchVisaDetails();
    }, [visaCode]);

    if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
    if (!visaData) return <div style={{ padding: '2rem', color: 'red' }}>Visa not found.</div>;

    return (
        <div style={{ padding: '2rem', fontFamily: 'Segoe UI, sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
            <button
                onClick={() => setCurrentView('Main')}
                style={{
                    marginBottom: '1.5rem',
                    backgroundColor: '#6b7280',
                    color: '#fff',
                    padding: '0.6rem 1.2rem',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                }}
            >
                ← Back
            </button>

            <h1 style={{ marginBottom: '1.5rem' }}>
                PWP Details for: <span style={{ color: '#4a90e2' }}>{visaCode}</span>
            </h1>

            {/* Main Visa Info */}
            <section style={{ marginBottom: '2.5rem' }}>
                <h2>Main Details</h2>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem'
                }}>
                    {Object.entries(visaData).map(([key, value]) => (
                        <div key={key} style={{
                            backgroundColor: '#f8f9fa',
                            padding: '1rem',
                            borderRadius: '6px',
                            border: '1px solid #ddd'
                        }}>
                            <strong style={{ textTransform: 'capitalize' }}>{key}</strong>:<br />
                            <span>{String(value)}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Budget History */}
            <section>
                <h2>Budget History</h2>
                {historyData.length === 0 ? (
                    <p style={{ color: '#888' }}>No history found.</p>
                ) : (
                    <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
                                    <th style={thStyle}>Action Type</th>
                                    <th style={thStyle}>Amount</th>
                                    <th style={thStyle}>Remaining</th>
                                    <th style={thStyle}>User</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Created By</th>
                                    <th style={thStyle}>Original ID</th>
                                    <th style={thStyle}>Total Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyData.map((item) => (
                                    <tr key={item.history_id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={tdStyle}>{item.action_type}</td>
                                        <td style={tdStyle}>₱{Number(item.amountbadget).toLocaleString()}</td>
                                        <td style={tdStyle}>₱{Number(item.remainingbalance).toLocaleString()}</td>
                                        <td style={tdStyle}>{item.action_user}</td>
                                        <td style={tdStyle}>{new Date(item.action_date).toLocaleString()}</td>
                                        <td style={tdStyle}>{item.createduser}</td>
                                        <td style={tdStyle}>{item.original_id}</td>
                                        <td style={tdStyle}>{item.TotalCost ? `₱${Number(item.TotalCost).toLocaleString()}` : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

// Styles
const thStyle = {
    padding: '0.75rem',
    textAlign: 'left',
    borderBottom: '2px solid #ddd',
    fontWeight: 'bold',
};

const tdStyle = {
    padding: '0.75rem',
    verticalAlign: 'top',
};
