import React, { useEffect, useState } from 'react';
import { Table, Button, Form } from 'react-bootstrap';
import { supabase } from './supabaseClient'; // your supabase client

export default function AccountBadget() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch data
  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('account_badget').select('*').order('id');
    if (error) alert('Error fetching accounts: ' + error.message);
    else setAccounts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Update field handler
  const handleFieldChange = (id, field, value) => {
    setAccounts(accounts.map(acc => acc.id === id ? { ...acc, [field]: value } : acc));
  };

  // Save updated account
  const saveAccount = async (id) => {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;
    const { error } = await supabase
      .from('account_badget')
      .update({
        budget: parseFloat(acc.budget) || 0,
        RegularCode: acc.RegularCode ? parseInt(acc.RegularCode) : null,
      })
      .eq('id', id);

    if (error) alert('Failed to update: ' + error.message);
    else fetchAccounts();
  };

  // Export CSV
  const exportCSV = () => {
    const header = ['Account', 'Name', 'Budget', 'RegularCode'];
    const rows = accounts.map(({ account, name, budget, RegularCode }) => [account, name, budget, RegularCode]);
    let csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "account_badget_export.csv";
    link.click();
  };

  // Import CSV (simple implementation)
  const importCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').slice(1); // skip header
      for (let line of lines) {
        if (!line.trim()) continue;
        const [account, name, budget, RegularCode] = line.split(',');
        // Upsert to supabase
        const { error } = await supabase
          .from('account_badget')
          .upsert({
            account: account.trim(),
            name: name.trim(),
            budget: parseFloat(budget) || 0,
            RegularCode: RegularCode ? parseInt(RegularCode) : null,
          }, { onConflict: 'account' });
        if (error) alert('Import error: ' + error.message);
      }
      fetchAccounts();
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <h3>Account Badget</h3>
      <div className="mb-3">
        <Button variant="primary" onClick={exportCSV} className="me-2">Export CSV</Button>
        <Form.Control
          type="file"
          accept=".csv"
          onChange={importCSV}
          style={{ display: 'inline-block', width: 'auto' }}
        />
      </div>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Account</th>
            <th>Name</th>
            <th>Budget</th>
            <th>RegularCode</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan="5">Loading...</td></tr>
          ) : (
            accounts.map(({ id, account, name, budget, RegularCode }) => (
              <tr key={id}>
                <td>{account}</td>
                <td>{name}</td>
                <td>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={budget || 0}
                    onChange={(e) => handleFieldChange(id, 'budget', e.target.value)}
                  />
                </td>
                <td>
                  <Form.Control
                    type="number"
                    value={RegularCode || ''}
                    onChange={(e) => handleFieldChange(id, 'RegularCode', e.target.value)}
                  />
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => saveAccount(id)}
                  >
                    Save
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
