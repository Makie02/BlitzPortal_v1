import React, { useState, useEffect } from 'react';
import './LoginPage.css';
import logo from '../Assets/blitz portal logo (1).png';
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
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
            // Step 1: Fetch user from Supabase
            const { data: users, error: supaError } = await supabase
                .from('Account_Users')
                .select('*')
                .eq('username', email)
                .eq('password', password) // ⚠️ Insecure! Use hashing in production
                .limit(1);

            if (supaError) throw new Error(`Supabase error: ${supaError.message}`);

            if (!users || users.length === 0) {
                setError('Invalid username or password');
                await Swal.fire({
                    icon: 'error',
                    title: 'Login Failed',
                    text: 'Invalid username or password',
                    confirmButtonText: 'OK',
                });
                return;
            }

            const matchedUser = users[0];

            // Step 1.5: Check user status (disabled or not)
            const { data: statusData, error: statusError } = await supabase
                .from('User_Status')
                .select('*')
                .eq('UserID', matchedUser.UserID)
                .single();

            if (statusError && statusError.code !== 'PGRST116')
                throw new Error(`User status error: ${statusError.message}`);

            if (statusData) {
                if (!statusData.isActive) {
                    const nowMs = Date.now();
                    if (!statusData.disableUntil || nowMs < statusData.disableUntil) {
                        setError('Your account is disabled. Please contact support.');
                        await Swal.fire({
                            icon: 'error',
                            title: 'Account Disabled',
                            text: 'Your account is disabled. Please contact support.',
                            confirmButtonText: 'OK',
                        });
                        return;
                    }
                }
            }

            // Step 2: Load license keys from localStorage
            const savedKeys = JSON.parse(localStorage.getItem('licenseKeys') || '[]');
            const userLicense = savedKeys.find((key) => key.UserID === matchedUser.UserID);

            if (!userLicense) {
                setError('No active subscription found for this user.');
                await Swal.fire({
                    icon: 'error',
                    title: 'Subscription Required',
                    text: 'No active subscription found for this user. Please contact support or your administrator to activate your subscription.',
                    confirmButtonText: 'OK',
                });
                return;
            }

            if (userLicense.status === 'Expired') {
                setError('Your license key is expired. Please renew your license.');
                await Swal.fire({
                    icon: 'error',
                    title: 'License Expired',
                    text: 'Your license key is expired. Please renew your license.',
                    confirmButtonText: 'OK',
                });
                return;
            }

            // Step 3: Check expiration and calculate days left
            let daysLeft = null;
            let showExpiryWarning = false;

            if (userLicense.valid_until) {
                const now = new Date();
                const expiryDate = new Date(userLicense.valid_until);
                const diffTime = expiryDate - now;
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                console.log(`📆 License expires in ${daysLeft} day(s)`);

                if (daysLeft <= 5 && daysLeft >= 0) {
                    showExpiryWarning = true;
                }
            }

            const enrichedUser = {
                UserID: matchedUser.UserID,
                role: matchedUser.role || 'User',
                ...matchedUser,
            };

            // Save to localStorage
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

            // Show success alert with expiration notice
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

            // Navigate to dashboard
            setLoggedInUser(enrichedUser);
            setCurrentView('Dashboard');
        } catch (err) {
            console.error('🚨 Login error:', err);
            setError(err.message || 'Unexpected error during login.');

            await Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: err.message || 'Unexpected error during login.',
                confirmButtonText: 'OK',
            });
        }
    };

    const saveAuditLog = async (log) => {
        try {
            const { error } = await supabase
                .from('AuditLogs')
                .insert([{
                    action: log.Action,
                    userId: log.UserId,
                    timestamp: log.DateCreated,
                    metadata: log.metadata || null
                }]);

            if (error) console.error('❌ Audit log error:', error.message);
            else console.log('✅ Audit log saved to Supabase');
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

            const { error } = await supabase
                .from('RecentActivity')
                .insert([entry]);

            if (error) console.error('❌ Recent activity error:', error.message);
            else console.log('✅ Activity saved to Supabase');
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
                                <span className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </span>
                            </div>
                        </div>

                        {error && <p className="error-message fade-slide delay-2">{error}</p>}

                        <button type="submit" className="login-button fade-slide delay-2">Login</button>
                    </form>
              
                </div>
                  <footer className="login-footer">
                        Version 1.0
                    </footer>
            </div>
                
        </div>
    );
}

export default LoginPage;
