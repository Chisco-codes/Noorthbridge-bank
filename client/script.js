const API_BASE = 'http://localhost:5000/api';

// Wait for DOM to load before attaching events
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, attaching events'); // Debug

    // Hamburger toggle
    document.getElementById('hamburger').addEventListener('click', () => {
        document.getElementById('nav-menu').classList.toggle('active');
    });

    // DOM Elements
    const authSection = document.getElementById('auth-section');
    const homeSection = document.getElementById('home');
    const loginLink = document.getElementById('login-link');
    const registerLink = document.getElementById('register-link');
    const getStartedBtn = document.getElementById('get-started-btn');

    console.log('Elements found:', { authSection, homeSection, loginLink, registerLink, getStartedBtn }); // Debug

    // Event Listeners
    if (loginLink) {
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Login link clicked');
            authSection.style.display = 'block';
            homeSection.style.display = 'none';
        });
    }

    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Register link clicked');
            authSection.style.display = 'block';
            homeSection.style.display = 'none';
        });
    }

    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            console.log('Get started button clicked');
            authSection.style.display = 'block';
            homeSection.style.display = 'none';
        });
    }

    // Switch forms
    document.getElementById('switch-to-register')?.addEventListener('click', () => {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });

    document.getElementById('switch-to-login')?.addEventListener('click', () => {
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });

    // Register - Your Existing Improved Version (Kept 100% Intact)
    document.getElementById('register-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();

        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim().toLowerCase();
        const password = document.getElementById('register-password').value;

        const messageEl = document.getElementById('auth-message');
        messageEl.textContent = '';
        messageEl.style.color = 'red';

        if (!name || name.length < 2) {
            messageEl.textContent = 'Please enter your full name';
            return;
        }
        if (!email || !email.includes('@') || !email.includes('.')) {
            messageEl.textContent = 'Please enter a valid email address';
            return;
        }
        if (!password || password.length < 6) {
            messageEl.textContent = 'Password must be at least 6 characters';
            return;
        }

        const btn = document.getElementById('register-btn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Creating Account...';

        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await res.json();

            if (res.ok) {
                messageEl.textContent = 'Registration successful! Redirecting...';
                messageEl.style.color = 'green';
                localStorage.setItem('token', data.token);
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                messageEl.textContent = data.msg || 'Registration failed. Please try again.';
            }
        } catch (err) {
            messageEl.textContent = 'Network error. Check your connection.';
            console.error('Register error:', err);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    // === IMPROVED LOGIN WITH FIELD-SPECIFIC ERRORS ===
    document.getElementById('login-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();

        // Clear previous errors
        document.getElementById('login-email-error').textContent = '';
        document.getElementById('login-password-error').textContent = '';
        document.getElementById('auth-message').textContent = '';

        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;

        let hasError = false;

        // Validate email
        if (!email) {
            document.getElementById('login-email-error').textContent = 'Please enter your email';
            hasError = true;
        } else if (!email.includes('@') || !email.includes('.')) {
            document.getElementById('login-email-error').textContent = 'Please enter a valid email';
            hasError = true;
        }

        // Validate password
        if (!password) {
            document.getElementById('login-password-error').textContent = 'Please enter your password';
            hasError = true;
        }

        if (hasError) return;

        // Change button to loading state
        const loginBtn = document.getElementById('login-btn');
        const originalText = loginBtn.textContent;
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                // Success: Show auth code form
                document.getElementById('login-form').innerHTML = `
                    <h2>Enter Auth Code</h2>
                    <p style="color:#666; font-size:14px;">Check your email for the 6-digit code.</p>
                    <input type="text" id="auth-code" placeholder="6-digit code" maxlength="6" required style="text-align:center; letter-spacing:8px; font-size:24px;">
                    <button id="verify-code-btn" style="margin-top:20px;">Verify Code</button>
                    <p id="auth-code-error" style="color:red; min-height:20px; margin-top:10px;"></p>
                `;

                // Verify code button
                document.getElementById('verify-code-btn').addEventListener('click', async () => {
                    const authCode = document.getElementById('auth-code').value.trim();
                    const errorEl = document.getElementById('auth-code-error');

                    if (!authCode || authCode.length !== 6) {
                        errorEl.textContent = 'Please enter the 6-digit code';
                        return;
                    }

                    const verifyBtn = document.getElementById('verify-code-btn');
                    verifyBtn.disabled = true;
                    verifyBtn.textContent = 'Verifying...';

                    try {
                        const verifyRes = await fetch(`${API_BASE}/auth/verify-code`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, authCode })
                        });

                        const verifyData = await verifyRes.json();

                        if (verifyRes.ok) {
                            localStorage.setItem('token', verifyData.token);
                            document.getElementById('auth-message').textContent = 'Login successful! Redirecting...';
                            document.getElementById('auth-message').style.color = 'green';
                            setTimeout(() => {
                                window.location.href = 'dashboard.html';
                            }, 1000);
                        } else {
                            errorEl.textContent = verifyData.msg || 'Invalid or expired code';
                            verifyBtn.disabled = false;
                            verifyBtn.textContent = 'Verify Code';
                        }
                    } catch (err) {
                        errorEl.textContent = 'Network error. Try again.';
                        verifyBtn.disabled = false;
                        verifyBtn.textContent = 'Verify Code';
                    }
                });
            } else {
                // Login failed (wrong email/password)
                document.getElementById('auth-message').textContent = data.msg || 'Invalid email or password';
                document.getElementById('auth-message').style.color = 'red';
            }
        } catch (err) {
            document.getElementById('auth-message').textContent = 'Network error. Please try again.';
            document.getElementById('auth-message').style.color = 'red';
        } finally {
            // Re-enable login button
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
        }
    });
});