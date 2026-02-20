import React, { useState } from 'react';
import './LoginPage.css';
import logo from '../Assets/blitz portal logo (1).png';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

function LoginPage({ setLoggedInUser, setCurrentView }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        console.clear();

        try {
            // Step 1: Get user credentials
            const { data: users, error: userError } = await supabase
                .from('Account_Users')
                .select('*')
                .eq('username', email)
                .eq('password', password)
                .limit(1);

            if (userError) throw new Error(userError.message);
            if (!users || users.length === 0) {
                await Swal.fire({
                    icon: 'error',
                    title: 'Login Failed',
                    text: 'Invalid username or password.',
                });
                return;
            }

            const matchedUser = users[0];

            // Step 2: Check user status (active/disabled)
            const { data: statusData, error: statusError } = await supabase
                .from('User_Status')
                .select('*')
                .eq('UserID', matchedUser.UserID)
                .maybeSingle();

            if (statusError && statusError.code !== 'PGRST116') {
                console.error('Status error:', statusError);
                throw new Error('Failed to fetch user status.');
            }

            // ✅ If record exists, check if disabled
            // ✅ Check user status in User_Status
            if (statusData) {
                const { isActive, disableUntil } = statusData;

                if (!isActive) {
                    let title = 'Account Disabled';
                    let htmlMessage = 'Your account is currently disabled. Please contact support.';

                    if (disableUntil) {
                        const disableDate = new Date(disableUntil);
                        const now = new Date();

                        if (disableDate > now) {
                            // Calculate remaining days
                            const diffTime = disableDate - now;
                            const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            const formattedDate = disableDate.toLocaleString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            });

                            htmlMessage = `
          <p style="font-size:16px; color:#555;">
            ⛔ Your account has been <b>temporarily disabled</b>.
          </p>
          <p style="margin-top:10px;">
            It will be re-enabled on:<br>
            <b style="color:#e74c3c;">${formattedDate}</b><br>
            <span style="font-size:14px; color:#888;">(${remainingDays} day${remainingDays > 1 ? 's' : ''} remaining)</span>
          </p>
        `;
                        }
                    }

                    await Swal.fire({
                        icon: 'error',
                        title: title,
                        html: htmlMessage,
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#3085d6',
                    });

                    return;
                }
            }


            // Step 3: Check license key from localStorage
            const savedKeys = JSON.parse(localStorage.getItem('licenseKeys') || '[]');
            const userLicense = savedKeys.find((key) => key.UserID === matchedUser.UserID);

            if (!userLicense) {
                await Swal.fire({
                    icon: 'error',
                    title: 'Subscription Required',
                    text: 'No active subscription found for this user.',
                });
                return;
            }

            if (userLicense.status === 'Expired') {
                await Swal.fire({
                    icon: 'error',
                    title: 'License Expired',
                    text: 'Your license key has expired. Please renew your license.',
                });
                return;
            }

            // Step 4: Check expiration
            let daysLeft = null;
            let showExpiryWarning = false;

            if (userLicense.valid_until) {
                const now = new Date();
                const expiryDate = new Date(userLicense.valid_until);
                const diffTime = expiryDate - now;
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (daysLeft <= 5 && daysLeft >= 0) showExpiryWarning = true;
            }

            const enrichedUser = {
                UserID: matchedUser.UserID,
                role: matchedUser.role || 'User',
                ...matchedUser,
            };

            localStorage.setItem('loggedInUser', JSON.stringify(enrichedUser));
            localStorage.setItem('loggedIn', 'true');

            // Log actions
            const nowISO = new Date().toISOString();
            await saveAuditLog({
                Action: 'User Login',
                UserId: enrichedUser.UserID,
                DateCreated: nowISO,
            });

            await saveRecentActivity(enrichedUser.UserID);

            await Swal.fire({
                title: 'Login Successful',
                html: `
          Welcome, <strong>${enrichedUser.name || enrichedUser.username}</strong>!
          ${showExpiryWarning
                        ? `<br /><br /><span style="color:#e74c3c; font-weight:bold;">⚠️ Your license will expire in ${daysLeft} day(s)</span>`
                        : ''
                    }
        `,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false,
                timerProgressBar: true,
            });

            setLoggedInUser(enrichedUser);
            setCurrentView('Dashboard');
        } catch (err) {
            console.error('🚨 Login error:', err);
            setError(err.message || 'Unexpected error during login.');

            await Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: err.message || 'Unexpected error during login.',
            });
        }
    };

    const saveAuditLog = async (log) => {
        try {
            const { error } = await supabase.from('AuditLogs').insert([
                {
                    action: log.Action,
                    userId: log.UserId,
                    timestamp: log.DateCreated,
                    metadata: log.metadata || null,
                },
            ]);
            if (error) console.error('❌ Audit log error:', error.message);
        } catch (err) {
            console.error('❌ Error saving audit log:', err);
        }
    };

    const saveRecentActivity = async (UserId) => {
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const { ip } = await ipRes.json();
            const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
            const geo = await geoRes.json();

            const entry = {
                userId: UserId,
                device: navigator.userAgent || 'Unknown Device',
                location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
                ip: ip,
                time: new Date().toISOString(),
                action: 'Login',
            };

            const { error } = await supabase.from('RecentActivity').insert([entry]);
            if (error) console.error('❌ Activity log error:', error.message);
        } catch (err) {
            console.error('❌ Failed to log recent activity:', err);
        }
    };

    function AnimatedText({ text }) {
        return (
            <p className="lightning-text">
                {text.split('').map((char, idx) => (
                    <span key={idx} style={{ animationDelay: `${idx * 0.15}s` }}>
                        {char === ' ' ? '\u00A0' : char}
                    </span>
                ))}
            </p>
        );
    }

    return (
        <div className="login-background">
            <img src={logo} alt="Logo" className="top-login-logo fade-slide desktop-logo" />

            <div className="login-container glass">
                <div className="login-left">
                    <div className="mobile-logo-wrapper">
                        <img src={logo} alt="Logo" className="mobile-login-logo fade-slide" />
                    </div>
                    <div className="login-header fade-slide">
                        <h2>Login</h2>
                        <AnimatedText text="We're glad to see you again. Please login to continue." />
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="input-group fade-slide">
                            <label>Username</label>
                            <div className="input-icon-wrapper">
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group fade-slide delay-1">
                            <label>Password</label>
                            <div className="input-icon-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    required
                                />
                                <span
                                    className="toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </span>
                            </div>
                        </div>

                        {error && <p className="error-message fade-slide delay-2">{error}</p>}

                        <button type="submit" className="login-button fade-slide delay-2">
                            Login
                        </button>
                    </form>

                    <footer className="login-footer">
                        <div>Version 2.0.0</div>
                        <div
                            style={{
                                marginTop: '6px',
                                fontSize: '14px',
                                color: '#64748b',
                            }}
                        >
                            Powered By{' '}
                            <span style={{ fontWeight: '600', color: '#3b82f6' }}>
                                Ichthus Technology
                            </span>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
