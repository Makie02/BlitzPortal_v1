// Regular_List_Account_badget.jsx

import React, { useEffect, useState } from 'react';
import { Table, Button, Form, Container, Card, Spinner } from 'react-bootstrap';
import { supabase } from '../supabaseClient';
// If you need CSV import/export you can use libraries like react-csv or react-bootstrap-table2-toolkit

// for export
import { CSVLink } from 'react-csv';

export default function RegularListAccountBadget() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tempIdCounter, setTempIdCounter] = useState(0);
  const [fileImport, setFileImport] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('Regular_AccountLis_badget')
      .select('*')
      .order('id', { ascending: true });
    if (error) {
      console.error('Error fetching Regular_AccountLis_badget:', error);
      alert('Error loading data');
    } else {
      setRows(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const handleChange = (id, field, value) => {
    setRows(prev =>
      prev.map(row => {
        if (row.id === id) {
          return { ...row, [field]: value };
        }
        return row;
      })
    );
  };

  const saveRow = async (id) => {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    // if it's a new temp row (non-numeric id) then insert; otherwise update
    const storedUser = localStorage.getItem('loggedInUser');
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const createdBy = parsedUser?.name || 'Unknown';

    if (typeof id === 'number') {
      // update
      const { error } = await supabase
        .from('Regular_AccountLis_badget')
        .update({
          regulrCode: row.regulrCode,
          account_code: row.account_code,
          account_name: row.account_name,
          budget: parseFloat(row.budget) || 0,
          // optionally update create_at or createForm? probably not on update
        })
        .eq('id', id);
      if (error) {
        console.error('Error updating row:', error);
        alert('Failed to save row');
      } else {
        fetchRows();
      }
    } else {
      // insert new
      const { data, error } = await supabase
        .from('Regular_AccountLis_badget')
        .insert([
          {
            regulrCode: row.regulrCode,
            account_code: row.account_code,
            account_name: row.account_name,
            budget: parseFloat(row.budget) || 0,
            createForm: createdBy,
            // create_at will default from DB
          }
        ]);
      if (error) {
        console.error('Error inserting new row:', error);
        alert('Failed to insert new row');
      } else {
        fetchRows();
      }
    }
  };

  const deleteRow = async (id) => {
    if (typeof id !== 'number') {
      // remove temp row from state
      setRows(prev => prev.filter(r => r.id !== id));
      return;
    }
    const confirmed = window.confirm('Are you sure you want to delete this row?');
    if (!confirmed) return;
    const { error } = await supabase
      .from('Regular_AccountLis_badget')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting row:', error);
      alert('Failed to delete row');
    } else {
      fetchRows();
    }
  };

  const addRow = () => {
    const newId = `new-${tempIdCounter}`;
    setTempIdCounter(tempIdCounter + 1);
    const newRow = {
      id: newId,
      regulrCode: '',
      account_code: '',
      account_name: '',
      budget: 0,
      createForm: '',
      create_at: ''  // will show blank or placeholder until loaded
    };
    setRows(prev => [newRow, ...prev]);
  };

  // For export CSV, prepare headers/data
  const csvHeaders = [
    { label: 'ID', key: 'id' },
    { label: 'RegulrCode', key: 'regulrCode' },
    { label: 'Account Code', key: 'account_code' },
    { label: 'Account Name', key: 'account_name' },
    { label: 'Budget', key: 'budget' },
    { label: 'Create At', key: 'create_at' },
    { label: 'Created By', key: 'createForm' }
  ];

  const csvData = rows.map(r => ({
    id: r.id,
    regulrCode: r.regulrCode,
    account_code: r.account_code,
    account_name: r.account_name,
    budget: r.budget,
    create_at: r.create_at,
    createForm: r.createForm
  }));

  // Import functionality (e.g CSV file)
  const handleFileChange = (e) => {
    setFileImport(e.target.files[0]);
  };

  const importCSV = async () => {
    if (!fileImport) {
      alert('Select a CSV file first');
      return;
    }
    const text = await fileImport.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const [headerLine, ...dataLines] = lines;
    const headers = headerLine.split(',').map(h => h.trim());

    // expecting headers like: regulrCode,account_code,account_name,budget
    const inserted = [];
    for (const line of dataLines) {
      const cols = line.split(',').map(c => c.trim());
      const record = {};
      headers.forEach((h, idx) => {
        record[h] = cols[idx];
      });
      // optional: parse budget, etc
      const storedUser = localStorage.getItem('loggedInUser');
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const createdBy = parsedUser?.name || 'Unknown';

      const { data, error } = await supabase
        .from('Regular_AccountLis_badget')
        .insert([
          {
            regulrCode: record.regulrCode,
            account_code: record.account_code,
            account_name: record.account_name,
            budget: parseFloat(record.budget) || 0,
            createForm: createdBy
          }
        ]);
      if (error) {
        console.error('Error importing record:', error, record);
      } else {
        inserted.push(data);
      }
    }
    alert(`Imported ${inserted.length} records`);
    fetchRows();
  };

  return (
    <Container className="mt-4">
      <Card border="primary" className="shadow">
        <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
          <h4 className="mb-0">📋 Regular Account Budget List</h4>
          <div>
            <Button variant="light" className="me-2" onClick={addRow}>➕ Add Row</Button>
            <CSVLink filename={"RegularAccountBudget.csv"} data={csvData} headers={csvHeaders}>
              <Button variant="light">⬇ Export CSV</Button>
            </CSVLink>
            {' '}
            <Form.Control type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'inline-block', width: 'auto' }} />
            <Button variant="light" onClick={importCSV}>⬆ Import CSV</Button>
          </div>
        </Card.Header>

        <Card.Body>
          {loading ? (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '150px' }}>
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table bordered hover responsive className="align-middle text-center">
                <thead className="bg-primary text-white">
                  <tr>
                    <th>RegulrCode</th>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th>Budget</th>
                    <th>Create At</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <Form.Control
                          value={row.regulrCode}
                          onChange={e => handleChange(row.id, 'regulrCode', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          value={row.account_code}
                          onChange={e => handleChange(row.id, 'account_code', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          value={row.account_name}
                          onChange={e => handleChange(row.id, 'account_name', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          step="0.01"
                          value={row.budget}
                          onChange={e => handleChange(row.id, 'budget', e.target.value)}
                        />
                      </td>
                      <td>{row.create_at ? new Date(row.create_at).toLocaleString() : '—'}</td>
                      <td>{row.createForm || '—'}</td>
                      <td>
                        {typeof row.id === 'number' ? (
                          <>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="me-2"
                              onClick={() => saveRow(row.id)}
                            >💾 Save</Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => deleteRow(row.id)}
                            >🗑 Delete</Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="me-2"
                              onClick={() => saveRow(row.id)}
                            >✅ Save</Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => deleteRow(row.id)}
                            >🗑 Remove</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
