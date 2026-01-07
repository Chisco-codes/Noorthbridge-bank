document.getElementById('change-password-btn').addEventListener('click', async () => {
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    alert(data.msg);
});