const API_BASE = 'https://northbridge-bank-api.onrender.com/api';
// Toast Notification System
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '16px 24px';
    notification.style.borderRadius = '12px';
    notification.style.color = 'white';
    notification.style.background = type === 'success' ? '#28a745' : '#dc3545';
    notification.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
    notification.style.zIndex = '10000';
    notification.style.fontWeight = 'bold';
    notification.style.transform = 'translateX(120%)';
    notification.style.transition = 'transform 0.4s ease';

    document.body.appendChild(notification);

    setTimeout(() => notification.style.transform = 'translateX(0)', 100);

    setTimeout(() => {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => document.body.removeChild(notification), 400);
    }, 3000);
}

// Load Dashboard Data
async function loadDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please log in to continue', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            showNotification('Your session has expired. Please log in again.', 'error');
            setTimeout(logout, 2000);
            return;
        }

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const user = await res.json();

        // Update UI
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-balance').textContent = `$${user.balance.toFixed(2)} CAD`;
        document.getElementById('user-account-number').textContent = user.accountNumber;
        document.getElementById('user-account-type').textContent = user.accountType;
        document.getElementById('total-transactions').textContent = user.transactions.length;
        document.getElementById('last-login').textContent = new Date().toLocaleString();

        // Profile Image
        if (user.profileImage) {
            document.getElementById('profile-img').src = `http://localhost:5000/${user.profileImage}?t=${Date.now()}`;
        }

        // Recent Transactions
        const transactionList = document.getElementById('transaction-list');
        transactionList.innerHTML = '';
        const recentTx = user.transactions.slice(-5).reverse();
        if (recentTx.length === 0) {
            transactionList.innerHTML = '<li style="color:#666; padding:15px;">No transactions yet</li>';
        } else {
            recentTx.forEach(tx => {
                const li = document.createElement('li');
                const date = new Date(tx.date).toLocaleDateString();
                const amountColor = tx.type.includes('Deposit') || tx.type.includes('In') ? '#28a745' : '#dc3545';
                li.innerHTML = `
                    <strong>${tx.type}</strong><br>
                    <span style="color:${amountColor}; font-weight:bold;">$${tx.amount.toFixed(2)}</span> 
                    <span style="color:#666; font-size:0.9em;">• ${date}</span><br>
                    <span style="color:#888; font-size:0.9em;">${tx.description || ''}</span>
                `;
                transactionList.appendChild(li);
            });
        }

        // Show Admin Button Only for Admins
        const adminBtn = document.getElementById('admin-panel-btn');
        if (adminBtn) {
            adminBtn.style.display = user.role === 'admin' ? 'block' : 'none';
        }

        // Load Balance Flow Chart
        loadBalanceFlowChart(user.transactions);

    } catch (err) {
        console.error('Dashboard error:', err);
        showNotification('Unable to load dashboard. Check connection.', 'error');
    }
}

// Balance Flow Chart
function loadBalanceFlowChart(transactions) {
    const canvas = document.getElementById('balance-flow-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (window.balanceChart) window.balanceChart.destroy();

    const currentYear = new Date().getFullYear();
    const monthlyData = { received: new Array(12).fill(0), sent: new Array(12).fill(0), withdrawn: new Array(12).fill(0) };
    let hasData = false;

    transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === currentYear) {
            const month = txDate.getMonth();
            const amount = tx.amount;
            if (tx.type.includes('Deposit') || tx.type.includes('In')) monthlyData.received[month] += amount;
            else if (tx.type.includes('Transfer Out')) monthlyData.sent[month] += amount;
            else if (tx.type.includes('Withdrawal')) monthlyData.withdrawn[month] += amount;
            hasData = true;
        }
    });

    window.balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [
                { label: 'Received', data: monthlyData.received, borderColor: '#28a745', backgroundColor: 'rgba(40,167,69,0.1)', tension: 0.4, fill: true },
                { label: 'Sent', data: monthlyData.sent, borderColor: '#1976d2', backgroundColor: 'rgba(25,118,210,0.1)', tension: 0.4, fill: true },
                { label: 'Withdrawn', data: monthlyData.withdrawn, borderColor: '#ffc107', backgroundColor: 'rgba(255,193,7,0.1)', tension: 0.4, fill: true }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: !hasData, text: 'No transactions this year yet', color: '#666', font: { size: 16 } }
            },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Amount (CAD)' } } }
        }
    });
}

// ALL BUTTON LISTENERS (Inside DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    // Force hide transfer modal on every page load
    const transferModal = document.getElementById('transfer-modal');
    if (transferModal) {
        transferModal.style.display = 'none';
    }

    // Image Upload
    document.getElementById('profile-img').addEventListener('click', () => document.getElementById('image-upload').click());
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('image-upload').click());

    document.getElementById('image-upload').addEventListener('change', async () => {
        const token = localStorage.getItem('token');
        const file = document.getElementById('image-upload').files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('profile-img').src = e.target.result;
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${API_BASE}/user/upload-image`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                showNotification('Profile picture updated successfully!');
                document.getElementById('profile-img').src = `http://localhost:5000/${data.image}?t=${Date.now()}`;
            } else {
                showNotification(data.msg || 'Upload failed', 'error');
            }
        } catch (err) {
            showNotification('Network error. Try again.', 'error');
        }
    });

    // Transfer Modal with Receipt
    const formContent = document.getElementById('transfer-form-content');
    const receiptContent = document.getElementById('receipt-content');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Only open modal when clicking the transfer button
    document.getElementById('transfer-btn').addEventListener('click', () => {
        // Pre-fill with current values
        document.getElementById('modal-to-account').value = document.getElementById('transfer-to').value.trim();
        document.getElementById('modal-amount').value = document.getElementById('transfer-amount').value;
        document.getElementById('modal-description').value = '';

        formContent.style.display = 'block';
        receiptContent.style.display = 'none';
        transferModal.style.display = 'flex';
    });

    // Confirm Transfer
    document.getElementById('confirm-transfer-btn').addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        const toAccount = document.getElementById('modal-to-account').value.trim();
        const amount = parseFloat(document.getElementById('modal-amount').value);
        const description = document.getElementById('modal-description').value.trim();

        if (!toAccount || isNaN(amount) || amount <= 0) {
            showNotification('Please fill recipient and amount correctly', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/transaction/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ toAccount, amount })
            });

            const data = await res.json();

            if (res.ok) {
                showNotification('Transfer completed successfully!');

                // Clear dashboard fields
                document.getElementById('transfer-to').value = '';
                document.getElementById('transfer-amount').value = '';

                // Show beautiful receipt
                formContent.style.display = 'none';
                receiptContent.style.display = 'block';

                document.getElementById('receipt-amount').textContent = amount.toFixed(2);
                document.getElementById('receipt-recipient').textContent = toAccount;
                document.getElementById('receipt-description').textContent = description || 'No description';
                document.getElementById('receipt-date').textContent = new Date().toLocaleString();
                document.getElementById('receipt-id').textContent = 'TX-' + Math.random().toString(36).substring(2, 11).toUpperCase();

                // Download Receipt
                document.getElementById('download-receipt-btn').onclick = () => {
                    const element = receiptContent;
                    html2pdf().from(element).set({
                        margin: 1,
                        filename: 'Northbridge_Transfer_Receipt.pdf',
                        html2canvas: { scale: 2 },
                        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
                    }).save();
                };

                loadDashboard(); // Refresh balance
            } else {
                showNotification(data.msg || 'Transfer failed', 'error');
            }
        } catch (err) {
            showNotification('Network error during transfer', 'error');
        }
    });

    // Close modal
    closeModalBtn.addEventListener('click', () => {
        transferModal.style.display = 'none';
    });

    transferModal.addEventListener('click', (e) => {
        if (e.target === transferModal) {
            transferModal.style.display = 'none';
        }
    });

    // View Full Transaction History Modal
    const viewAllBtn = document.getElementById('view-all-btn');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`${API_BASE}/user`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const user = await res.json();

                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                    background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;
                `;

                let txList = '<ul style="list-style:none; padding:0; max-height:60vh; overflow-y:auto;">';
                if (user.transactions.length === 0) {
                    txList += '<li style="padding:15px; color:#666;">No transactions yet</li>';
                } else {
                    user.transactions.reverse().forEach(tx => {
                        const date = new Date(tx.date).toLocaleString();
                        const color = tx.type.includes('Deposit') || tx.type.includes('In') ? '#28a745' : '#dc3545';
                        txList += `
                            <li style="background:white; margin:10px; padding:15px; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                                <strong>${tx.type}</strong> — <span style="color:${color}; font-weight:bold;">$${tx.amount.toFixed(2)}</span><br>
                                <small style="color:#666;">${date}</small><br>
                                <small style="color:#888;">${tx.description || 'No description'}</small>
                            </li>
                        `;
                    });
                }
                txList += '</ul>';

                modal.innerHTML = `
                    <div style="background:#f8f9fa; padding:30px; border-radius:20px; max-width:90%; width:600px; text-align:center;">
                        <h2 style="color:#1976d2; margin-top:0;">Full Transaction History</h2>
                        ${txList}
                        <button onclick="this.closest('.modal').remove()" style="margin-top:20px; padding:12px 30px; background:#1976d2; color:white; border:none; border-radius:8px; cursor:pointer;">
                            Close
                        </button>
                    </div>
                `;
                modal.className = 'modal';
                document.body.appendChild(modal);
            } catch (err) {
                showNotification('Failed to load history', 'error');
            }
        });
    }

    // Account Settings Modal with Password Change
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`${API_BASE}/user`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const user = await res.json();

                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                    background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;
                `;

                modal.innerHTML = `
                    <div style="background:white; padding:40px; border-radius:20px; max-width:90%; width:500px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                        <h2 style="color:#1976d2;">Account Settings</h2>
                        <p><strong>Name:</strong> ${user.name}</p>
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Account Number:</strong> ${user.accountNumber}</p>
                        <hr style="margin:20px 0;">
                        <h3 style="color:#1976d2; margin-bottom:15px;">Change Password</h3>
                        <input type="password" id="old-password" placeholder="Current Password" style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:8px;">
                        <input type="password" id="new-password" placeholder="New Password (min 6 chars)" style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:8px;">
                        <button id="change-password-btn" style="width:100%; padding:12px; background:#1976d2; color:white; border:none; border-radius:8px; cursor:pointer; margin:10px 0;">
                            Update Password
                        </button>
                        <p id="settings-message" style="min-height:24px; margin:10px 0;"></p>
                        <hr style="margin:20px 0;">
                        <label style="display:flex; align-items:center; justify-content:center; gap:10px; color:#666;">
                            Enable 2FA <input type="checkbox" disabled> (Coming Soon)
                        </label>
                        <button onclick="this.closest('.modal').remove()" style="margin-top:20px; width:100%; padding:12px; background:#dc3545; color:white; border:none; border-radius:8px; cursor:pointer;">
                            Close
                        </button>
                    </div>
                `;
                modal.className = 'modal';
                document.body.appendChild(modal);

                modal.querySelector('#change-password-btn').addEventListener('click', async () => {
                    const oldPassword = modal.querySelector('#old-password').value;
                    const newPassword = modal.querySelector('#new-password').value;
                    const msgEl = modal.querySelector('#settings-message');

                    if (!oldPassword || !newPassword || newPassword.length < 6) {
                        msgEl.textContent = 'Fill all fields correctly';
                        msgEl.style.color = '#dc3545';
                        return;
                    }

                    try {
                        const res = await fetch(`${API_BASE}/user/change-password`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ oldPassword, newPassword })
                        });

                        const data = await res.json();
                        if (res.ok) {
                            msgEl.textContent = 'Password changed successfully!';
                            msgEl.style.color = '#28a745';
                        } else {
                            msgEl.textContent = data.msg || 'Failed';
                            msgEl.style.color = '#dc3545';
                        }
                    } catch (err) {
                        msgEl.textContent = 'Network error';
                        msgEl.style.color = '#dc3545';
                    }
                });

            } catch (err) {
                showNotification('Failed to open settings', 'error');
            }
        });
    }

    // Dark Mode Toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            darkModeToggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
            localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
        });

        if (localStorage.getItem('darkMode') === 'enabled') {
            darkModeToggle.click();
        }
    }

    // Admin Panel Button
    const adminBtn = document.getElementById('admin-panel-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            window.location.href = 'admin.html';
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            showNotification('Logged out successfully');
            setTimeout(() => window.location.href = 'index.html', 1000);
        });
    }

    // Notifications Button (optional)
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', () => {
            showNotification('No new notifications', 'success');
        });
    }
});

// Load Dashboard
window.addEventListener('load', loadDashboard);