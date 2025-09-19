import React, { useEffect, useState } from 'react';
import { Table, Button, Form, Container, Card, Spinner } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

const UOM_OPTIONS = ['Case', 'PC', 'IBX'];

export default function RegularSkuTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tempIdCounter, setTempIdCounter] = useState(0);

  // Fetch rows from Supabase
  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('Regular_SKU')
      .select('*')
      .order('id', { ascending: true });
    if (error) {
      console.error('Error fetching Regular_SKU:', error);
      alert('Error loading data');
    } else {
      setRows(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  // Count how many rows per UOM
  const countUOMs = (rowsToCount) => {
    return rowsToCount.reduce((acc, row) => {
      if (row.UOM && UOM_OPTIONS.includes(row.UOM)) {
        acc[row.UOM] = (acc[row.UOM] || 0) + 1;
      }
      return acc;
    }, {});
  };

  // Handle input changes per row
 const handleChange = (id, field, value) => {
  setRows(prev =>
    prev.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: value };

        // Calculate billing amount automatically
        const srp = parseFloat(field === 'SRP' ? value : updatedRow.SRP) || 0;
        const qty = parseInt(field === 'QTY' ? value : updatedRow.QTY) || 0;
        const discount = parseFloat(field === 'DISCOUNT' ? value : updatedRow.DISCOUNT) || 0;

        updatedRow.BILLING_AMOUNT = (srp * qty) - discount;

        return updatedRow;
      }
      return row;
    })
  );
};


  // Save existing row to Supabase
  const saveRow = async (id) => {
    const row = rows.find(r => r.id === id);
    if (!row || typeof row.id !== 'number') return; // only save rows with real numeric IDs
    const { error } = await supabase
      .from('Regular_SKU')
      .update({
        PWP_CODE: row.PWP_CODE,
        SKU: row.SKU,
        SRP: parseFloat(row.SRP) || 0,
        QTY: parseInt(row.QTY) || 0,
        UOM: row.UOM,
        DISCOUNT: parseFloat(row.DISCOUNT) || 0,
        BILLING_AMOUNT: parseFloat(row.BILLING_AMOUNT) || 0,
      })
      .eq('id', id);
    if (error) {
      console.error('Error updating row:', error);
      alert('Failed to save row');
    } else {
      fetchRows();
    }
  };

  // Delete row from Supabase
  const deleteRow = async (id) => {
    if (typeof id !== 'number') {
      // Just remove new unsaved row from state
      setRows(prev => prev.filter(row => row.id !== id));
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this row?');
    if (!confirmed) return;

    const { error } = await supabase
      .from('Regular_SKU')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting row:', error);
      alert('Failed to delete');
    } else {
      fetchRows();
    }
  };

  // Add a new row with unique temp ID and balanced UOM default
  const addRow = () => {
    const uomCounts = countUOMs(rows);
    const minCount = Math.min(...UOM_OPTIONS.map(uom => uomCounts[uom] || 0));
    const leastUsedUOMs = UOM_OPTIONS.filter(uom => (uomCounts[uom] || 0) === minCount);
    const defaultUOM = leastUsedUOMs.length > 0 ? leastUsedUOMs[0] : 'Case';

    const newId = `new-${tempIdCounter}`;
    setTempIdCounter(tempIdCounter + 1);

    const newRow = {
      id: newId,
      PWP_CODE: '',
      SKU: '',
      SRP: 0,
      QTY: 0,
      UOM: defaultUOM,
      DISCOUNT: 0,
      BILLING_AMOUNT: 0,
    };
    setRows(prev => [newRow, ...prev]);
  };

  // Save a new row to Supabase
 

  // Calculate totals live
  const totals = rows.reduce(
    (acc, row) => {
      acc.SRP += parseFloat(row.SRP) || 0;
      acc.QTY += parseInt(row.QTY) || 0;
      acc.DISCOUNT += parseFloat(row.DISCOUNT) || 0;
      acc.BILLING_AMOUNT += parseFloat(row.BILLING_AMOUNT) || 0;

      if (row.UOM && UOM_OPTIONS.includes(row.UOM)) {
        acc.UOMCount[row.UOM] = (acc.UOMCount[row.UOM] || 0) + 1;
      }
      return acc;
    },
    { SRP: 0, QTY: 0, DISCOUNT: 0, BILLING_AMOUNT: 0, UOMCount: {} }
  );

  return (
    <Container className="mt-4">
      <Card border="primary" className="shadow">
        <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
          <h4 className="mb-0">💼 Regular SKU Listing</h4>
          <Button variant="light" onClick={addRow}>➕ Add Row</Button>
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
                    <th>SKU</th>
                    <th>SRP</th>
                    <th>QTY</th>
                    <th>UOM</th>
                    <th>DISCOUNT</th>
                    <th>BILLING AMOUNT</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id}>
                      <Form.Control
                        type="hidden"
                        value={row.PWP_CODE}
                        onChange={e => handleChange(row.id, 'PWP_CODE', e.target.value)}
                      />
                      <td>
                        <Form.Control
                          value={row.SKU}
                          onChange={e => handleChange(row.id, 'SKU', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          step="0.01"
                          value={row.SRP}
                          onChange={e => handleChange(row.id, 'SRP', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          value={row.QTY}
                          onChange={e => handleChange(row.id, 'QTY', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Select
                          value={row.UOM}
                          onChange={e => handleChange(row.id, 'UOM', e.target.value)}
                        >
                          {UOM_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          step="0.01"
                          value={row.DISCOUNT}
                          onChange={e => handleChange(row.id, 'DISCOUNT', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          step="0.01"
                          value={row.BILLING_AMOUNT}
                          onChange={e => handleChange(row.id, 'BILLING_AMOUNT', e.target.value)}
                        />
                      </td>
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
                              variant="outline-danger"
                              size="sm"
                              className="ms-2"
                              onClick={() => deleteRow(row.id)}
                            >🗑 Remove</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer with totals */}
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <th>{totals.SRP.toFixed(2)}</th>
                    <th>{totals.QTY}</th>
                    <th>
                      {UOM_OPTIONS.map(opt => (
                        <div key={opt} style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>
                          {opt}: {totals.UOMCount[opt] || 0}
                        </div>
                      ))}
                    </th>
                    <th>{totals.DISCOUNT.toFixed(2)}</th>
                    <th>{totals.BILLING_AMOUNT.toFixed(2)}</th>
                    <th></th>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
