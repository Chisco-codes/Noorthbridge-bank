const API_BASE = 'http://localhost:5000/api';

// Toast Notification System (Same as dashboard)
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

// Load Admin Data
async function loadAdmin() {
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please log in', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return;
    }

    // Show loading
    document.getElementById('loading').style.display = 'block';

    try {
        const res = await fetch(`${API_BASE}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403 || res.status === 401) {
            showNotification('Access denied. Admins only.', 'error');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        if (!res.ok) {
            throw new Error('Failed to load users');
        }

        const users = await res.json();

        // Update Table
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.accountNumber}</td>
                <td>$${user.balance.toFixed(2)}</td>
                <td><span style="padding:4px 8px; border-radius:4px; background:${user.role === 'admin' ? '#1976d2' : '#28a745'}; color:white;">${user.role}</span></td>
                <td>
                    <button class="copy-id-btn" data-id="${user._id}" style="padding:6px 12px; background:#1976d2; color:white; border:none; border-radius:4px; cursor:pointer;">Copy ID</button>
                </td>
            `;
            usersList.appendChild(row);
        });

        // Copy ID Buttons
        document.querySelectorAll('.copy-id-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                navigator.clipboard.writeText(id);
                showNotification('User ID copied to clipboard!');
            });
        });

        // Update Summary
        const totalUsers = users.length;
        const totalBalance = users.reduce((sum, user) => sum + user.balance, 0);

        document.getElementById('total-users').textContent = totalUsers;
        document.getElementById('total-bank-balance').textContent = `$${totalBalance.toFixed(2)} CAD`;

        document.getElementById('loading').style.display = 'none';

    } catch (err) {
        console.error('Admin load error:', err);
        showNotification('Unable to load users. Try again.', 'error');
        document.getElementById('loading').style.display = 'none';
    }
}

// Add Funds
document.getElementById('add-funds-btn').addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    const userId = document.getElementById('user-id').value.trim();
    const amount = parseFloat(document.getElementById('funds-amount').value);
    const description = document.getElementById('funds-description')?.value.trim() || 'Admin deposit';

    if (!userId || !amount || amount <= 0) {
        showNotification('Enter valid User ID and amount', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/admin/add-funds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, amount, description })
        });

        const data = await res.json();

        if (res.ok) {
            showNotification(data.msg || 'Funds added successfully!');
            document.getElementById('user-id').value = '';
            document.getElementById('funds-amount').value = '';
            if (document.getElementById('funds-description')) {
                document.getElementById('funds-description').value = '';
            }
            document.getElementById('admin-message').textContent = '';
            loadAdmin(); // Refresh
        } else {
            showNotification(data.msg || 'Failed to add funds', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    }
});

// Refresh Button
document.getElementById('refresh-btn').addEventListener('click', loadAdmin);

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    showNotification('Logged out successfully');
    setTimeout(() => window.location.href = 'index.html', 1000);
});

// Load on Start
window.addEventListener('load', loadAdmin);