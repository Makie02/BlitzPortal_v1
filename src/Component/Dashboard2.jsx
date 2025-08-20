import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Badge, Image, ProgressBar, ListGroup } from 'react-bootstrap';
import { supabase } from '../supabaseClient'; // Adjust the path if needed

const Dashboard = () => {
  const [user, setUser] = useState({
    id: '',
    name: '',
    profilePicture: '',
    role: '',
    email: ''
  });

  const [approvals, setApprovals] = useState({
    forApproval: 0,
    approved: 0,
    declined: 0,
  });

  const [newsItems, setNewsItems] = useState([]);
  const [announcementItems, setAnnouncementItems] = useState([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser({
        id: parsedUser.id || '',
        name: parsedUser.name || 'Unknown User',
        profilePicture: parsedUser.profilePicture || 'https://i.pravatar.cc/150?img=1',
        role: parsedUser.role || 'N/A',
        email: parsedUser.email || 'no-email@example.com',
      });
    }
  }, []);

  useEffect(() => {
    const fetchApprovalHistory = async () => {
      if (!user.id) return;

      try {
        const { data, error } = await supabase
          .from('Approval_History')
          .select('*')
          .eq('ApproverId', user.id);

        if (error) throw error;

        let forApprovalCount = 0;
        let approvedCount = 0;
        let declinedCount = 0;

        data.forEach(item => {
          switch ((item.Response || '').toLowerCase()) {
            case 'approved':
              approvedCount++;
              break;
            case 'declined':
              declinedCount++;
              break;
            default:
              forApprovalCount++;
          }
        });

        setApprovals({
          forApproval: forApprovalCount,
          approved: approvedCount,
          declined: declinedCount,
        });
      } catch (error) {
        console.error('Error fetching approval history from Supabase:', error);
      }
    };

    fetchApprovalHistory();
  }, [user.id]);

 useEffect(() => {
  const loadItems = async () => {
    try {
      const { data: news, error: newsError } = await supabase
        .from('news')
        .select('*')
        .eq('show_view', true)
        .order('created_at', { ascending: false });

      if (newsError) throw newsError;
      console.log('news:', news);  // Add this line

      const { data: announcements, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .eq('show_view', true)
        .order('created_at', { ascending: false });

      if (announcementsError) throw announcementsError;
      console.log('announcements:', announcements);  // Add this line

      setNewsItems(news || []);
      setAnnouncementItems(announcements || []);
    } catch (error) {
      console.error('Error fetching News or Announcements from Supabase:', error);
    }
  };

  loadItems();
}, []);


  const totalApprovalCount = approvals.forApproval + approvals.approved + approvals.declined;

  return (
    <div style={{ padding: '20px', overflowX: 'auto' }} className="mt-4">
      <Row>
        {/* Left Profile Column */}
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Image
                src={user.profilePicture}
                roundedCircle
                style={{ width: '100px', height: '100px' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://i.pravatar.cc/150?img=1';
                }}
              />
              <h5 className="mt-3">{user.name}</h5>
              <p className="text-muted">{user.role}</p>
              <p className="small">{user.email}</p>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Main Content */}
        <Col md={9}>
          {/* Approval Stats */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="text-center bg-warning-subtle border-warning">
                <Card.Body>
                  <h6>For Approval</h6>
                  <h3><Badge bg="warning">{approvals.forApproval}</Badge></h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center bg-success-subtle border-success">
                <Card.Body>
                  <h6>Approved</h6>
                  <h3><Badge bg="success">{approvals.approved}</Badge></h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center bg-danger-subtle border-danger">
                <Card.Body>
                  <h6>Declined</h6>
                  <h3><Badge bg="danger">{approvals.declined}</Badge></h3>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Approval Progress */}
          <Row className="mb-4">
            <Col>
              <Card className="p-3">
                <h6>Approval Progress</h6>
                <ProgressBar>
                  <ProgressBar
                    striped
                    animated
                    variant="success"
                    now={totalApprovalCount ? (approvals.approved / totalApprovalCount) * 100 : 0}
                    label={`${totalApprovalCount ? Math.round((approvals.approved / totalApprovalCount) * 100) : 0}% Approved`}
                    key={1}
                  />
                  <ProgressBar
                    striped
                    animated
                    variant="warning"
                    now={totalApprovalCount ? (approvals.forApproval / totalApprovalCount) * 100 : 0}
                    label={`${totalApprovalCount ? Math.round((approvals.forApproval / totalApprovalCount) * 100) : 0}% Pending`}
                    key={2}
                  />
                  <ProgressBar
                    striped
                    animated
                    variant="danger"
                    now={totalApprovalCount ? (approvals.declined / totalApprovalCount) * 100 : 0}
                    label={`${totalApprovalCount ? Math.round((approvals.declined / totalApprovalCount) * 100) : 0}% Declined`}
                    key={3}
                  />
                </ProgressBar>
              </Card>
            </Col>
          </Row>

          {/* News & Announcements */}
          <Row>
            <Col md={6}>
              <Card>
                <Card.Header><strong>📰 News</strong></Card.Header>
                <ListGroup variant="flush">
                  {newsItems.length === 0 ? (
                    <ListGroup.Item>No news available.</ListGroup.Item>
                  ) : (
                    newsItems.map(item => (
                      <ListGroup.Item key={item.id}>
                        <strong>{item.title || "Untitled"}</strong><br />
                        <span>{item.description || "No description."}</span>
                        {item.file_url && (
                          <>
                            <br />
                            <a href={item.file_url} target="_blank" rel="noreferrer">
                              View Attachment
                            </a>
                          </>
                        )}
                      </ListGroup.Item>
                    ))
                  )}
                </ListGroup>
              </Card>
            </Col>

            <Col md={6}>
              <Card>
                <Card.Header><strong>📢 Announcements</strong></Card.Header>
                <ListGroup variant="flush">
                  {announcementItems.length === 0 ? (
                    <ListGroup.Item>No announcements available.</ListGroup.Item>
                  ) : (
                    announcementItems.map(item => (
                      <ListGroup.Item key={item.id}>
                        <strong>{item.title || "Untitled"}</strong><br />
                        <span>{item.description || "No description."}</span>
                        {item.file_url && (
                          <>
                            <br />
                            <a href={item.file_url} target="_blank" rel="noreferrer">
                              View Attachment
                            </a>
                          </>
                        )}
                      </ListGroup.Item>
                    ))
                  )}
                </ListGroup>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
