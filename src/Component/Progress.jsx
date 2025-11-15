import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Badge, Image, ProgressBar, ListGroup, Button } from 'react-bootstrap';
import { supabase } from '../supabaseClient';

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
    cancelled: 0,
  });

  const [newsItems, setNewsItems] = useState([]);
  const [announcementItems, setAnnouncementItems] = useState([]);

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser({
        id: parsedUser.UserID || parsedUser.id || '',
        name: parsedUser.name || 'Unknown User',
        profilePicture: parsedUser.profilePicture || 'https://i.pravatar.cc/150?img=1',
        role: parsedUser.role || 'N/A',
        email: parsedUser.email || 'no-email@example.com',
      });
    }
  }, []);

  // Fetch approval history - FIXED VERSION
  useEffect(() => {
    async function fetchApprovalHistory() {
      try {
        // Get user directly from localStorage
        const currentUser = JSON.parse(localStorage.getItem('loggedInUser'));
        const currentUserId = currentUser?.UserID ? String(currentUser.UserID) : null;
        const role = currentUser?.role || "";

        if (!currentUserId) {
          console.log('[Dashboard] No user ID found');
          return;
        }

        console.log("[Dashboard] Current User:", currentUser?.name, "UserID:", currentUserId, "Role:", role);

        // Fetch approval history with Response and CreatedForm
        const { data: approvalRecords, error } = await supabase
          .from("Approval_History")
          .select("Response, CreatedForm");

        if (error) {
          console.error("Error fetching Approval_History:", error);
          return;
        }

        console.log("[Dashboard] Total approval records fetched:", approvalRecords?.length);

        // Filter approval records by CreatedForm (UserID) if not admin
        const filteredApprovalRecords = role === 'admin'
          ? approvalRecords
          : approvalRecords.filter(record => {
              const recordCreatorId = record.CreatedForm ? String(record.CreatedForm) : null;
              return recordCreatorId === currentUserId;
            });

        console.log("[Dashboard] Filtered approval records:", filteredApprovalRecords.length);

        // Count status occurrences
        let approvedCount = 0;
        let declinedCount = 0;
        let cancelledCount = 0;
        let forApprovalCount = 0;

        filteredApprovalRecords.forEach(record => {
          const response = record.Response;
          if (response === "Approved") {
            approvedCount++;
          } else if (response === "Declined" || response === "Disapproved") {
            declinedCount++;
          } else if (response === "Cancelled") {
            cancelledCount++;
          } else {
            forApprovalCount++;
          }
        });

        console.log("[Dashboard] Counts - Approved:", approvedCount, "Declined:", declinedCount, "Cancelled:", cancelledCount, "For Approval:", forApprovalCount);

        setApprovals({
          forApproval: forApprovalCount,
          approved: approvedCount,
          declined: declinedCount,
          cancelled: cancelledCount,
        });
      } catch (error) {
        console.error("Error fetching approval history:", error);
      }
    }

    fetchApprovalHistory();
  }, []); // Runs once on mount

  // Fetch news and announcements
  useEffect(() => {
    const loadItems = async () => {
      try {
        const { data: news, error: newsError } = await supabase
          .from('news')
          .select('*')
          .eq('show_view', true)
          .order('created_at', { ascending: false });

        if (newsError) throw newsError;
        console.log('news:', news);

        const { data: announcements, error: announcementsError } = await supabase
          .from('announcements')
          .select('*')
          .eq('show_view', true)
          .order('created_at', { ascending: false });

        if (announcementsError) throw announcementsError;
        console.log('announcements:', announcements);

        setNewsItems(news || []);
        setAnnouncementItems(announcements || []);
      } catch (error) {
        console.error('Error fetching News or Announcements from Supabase:', error);
      }
    };

    loadItems();
  }, []);

  const totalApprovalCount = approvals.forApproval + approvals.approved + approvals.declined + approvals.cancelled;

  return (
    <div style={{ padding: '20px', overflowX: 'auto' }} className="mt-4">
      <Row>
        {/* Left Profile Column */}
        <Col md={3}>
          {/* User Profile Card */}
          <Card className="text-center shadow-sm border-0 mb-4">
            <Card.Body>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Image
                  src={user.profilePicture}
                  roundedCircle
                  style={{
                    width: '110px',
                    height: '110px',
                    border: '4px solid #f0f0f0',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://i.pravatar.cc/150?img=1';
                  }}
                />
              </div>
              <h5 className="mb-1">{user.name}</h5>
              <span
                className="badge bg-secondary text-uppercase"
                style={{ fontSize: '0.7rem' }}
              >
                {user.role}
              </span>
              <p className="text-muted mt-2 mb-0" style={{ fontSize: '0.85rem' }}>
                {user.email}
              </p>
              {user.role !== 'admin' && (
                <Badge bg="info" className="mt-2">
                  Viewing Your Records
                </Badge>
              )}
              {user.role === 'admin' && (
                <Badge bg="primary" className="mt-2">
                  Admin - All Records
                </Badge>
              )}
            </Card.Body>
          </Card>

          {/* Apply for Subscription Card */}
          <Card className="shadow-sm border-0">
            <Card.Body className="text-center">
              <div className="mb-3">
                <i
                  className="bi bi-stars"
                  style={{ fontSize: '2rem', color: '#0d6efd' }}
                ></i>
              </div>
              <h6 className="fw-bold">License Key Subscription</h6>
              <p className="text-muted small mb-3">
                Get access to premium features by applying for a license key.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="rounded-pill px-4"
                onClick={() => {
                  window.open("https://service-subscription.web.app/", "_blank");
                }}
              >
                Apply Now
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Main Content */}
        <Col md={9}>
          {/* Approval Stats */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center bg-warning-subtle border-warning">
                <Card.Body>
                  <h6>For Approval</h6>
                  <h3><Badge bg="warning">{approvals.forApproval}</Badge></h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center bg-success-subtle border-success">
                <Card.Body>
                  <h6>Approved</h6>
                  <h3><Badge bg="success">{approvals.approved}</Badge></h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center bg-danger-subtle border-danger">
                <Card.Body>
                  <h6>Declined</h6>
                  <h3><Badge bg="danger">{approvals.declined}</Badge></h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center bg-info-subtle border-info">
                <Card.Body>
                  <h6>Cancelled</h6>
                  <h3><Badge bg="info">{approvals.cancelled}</Badge></h3>
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
                  <ProgressBar
                    striped
                    animated
                    variant="info"
                    now={totalApprovalCount ? (approvals.cancelled / totalApprovalCount) * 100 : 0}
                    label={`${totalApprovalCount ? Math.round((approvals.cancelled / totalApprovalCount) * 100) : 0}% Cancelled`}
                    key={4}
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
                        {item.file_base64 && (
                          <>
                            <br />
                            {item.file_base64.startsWith('data:image') ? (
                              <Image
                                src={item.file_base64}
                                alt="attachment"
                                thumbnail
                                style={{ maxWidth: '100%', marginTop: '10px' }}
                              />
                            ) : item.file_base64.startsWith('data:application/pdf') ? (
                              <iframe
                                src={item.file_base64}
                                title="PDF preview"
                                style={{ width: '100%', height: '300px', marginTop: '10px', border: '1px solid #ccc' }}
                              />
                            ) : (
                              <a href={item.file_base64} target="_blank" rel="noreferrer">
                                Download Attachment
                              </a>
                            )}
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
                        {item.file_base64 && (
                          <>
                            <br />
                            {item.file_base64.startsWith('data:image') ? (
                              <Image
                                src={item.file_base64}
                                alt="attachment"
                                thumbnail
                                style={{ maxWidth: '100%', marginTop: '10px' }}
                              />
                            ) : item.file_base64.startsWith('data:application/pdf') ? (
                              <iframe
                                src={item.file_base64}
                                title="PDF preview"
                                style={{ width: '100%', height: '300px', marginTop: '10px', border: '1px solid #ccc' }}
                              />
                            ) : (
                              <a href={item.file_base64} target="_blank" rel="noreferrer">
                                Download Attachment
                              </a>
                            )}
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
