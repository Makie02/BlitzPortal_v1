import React, { useEffect, useState } from 'react';
import { Table, Form, Spinner, Container, Card } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

export default function ListingActivity() {
  const [activities, setActivities] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch activities and settings
  const fetchData = async () => {
    setLoading(true);

    const { data: activityData, error: activityError } = await supabase
      .from('activity')
      .select('*')
      .order('id');

    if (activityError) {
      alert('Error loading activities: ' + activityError.message);
      setLoading(false);
      return;
    }

    const { data: settingsData, error: settingsError } = await supabase
      .from('activity_settings')
      .select('*');

    if (settingsError) {
      alert('Error loading activity settings: ' + settingsError.message);
      setLoading(false);
      return;
    }

    // Map settings by activity_code
    const settingsMap = {};
    settingsData.forEach(s => {
      settingsMap[s.activity_code] = s;
    });

    setActivities(activityData);
    setSettings(settingsMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Toggle a setting (sku, accounts, amount_display)
  const toggleSetting = async (activityCode, field) => {
    const currentSetting = settings[activityCode] || {
      sku: false,
      accounts: false,
      amount_display: false,
    };

    const newValue = !currentSetting[field];

    if (!currentSetting.id) {
      // Insert new setting row
      const { error } = await supabase
        .from('activity_settings')
        .insert([{ activity_code: activityCode, [field]: newValue }]);

      if (error) {
        alert('Error inserting setting: ' + error.message);
        return;
      }
    } else {
      // Update existing setting row
      const { error } = await supabase
        .from('activity_settings')
        .update({ [field]: newValue })
        .eq('id', currentSetting.id);

      if (error) {
        alert('Error updating setting: ' + error.message);
        return;
      }
    }

    fetchData();
  };

  return (
    <Container className="my-5">
      <Card>
        <Card.Header className="bg-primary text-white">
          <h4 className="mb-0">Activity Listing</h4>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table
                striped
                bordered
                hover
                responsive
                className="align-middle text-center"
              >
                <thead className="table-primary">
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>SKU</th>
                    <th>Accounts</th>
                    <th>Amount Display</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map(activity => {
                    const setting = settings[activity.code] || {};

                    return (
                      <tr key={activity.code}>
                        <td className="text-start">{activity.code}</td>
                        <td className="text-start">{activity.name}</td>
                        <td className="text-start">{activity.description}</td>
                        {['sku', 'accounts', 'amount_display'].map(field => (
                          <td key={field} style={{ verticalAlign: 'middle' }}>
                            <Form.Check
                              type="checkbox"
                              checked={!!setting[field]}
                              onChange={() => toggleSetting(activity.code, field)}
                              aria-label={`${field} toggle for ${activity.name}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
