document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) return window.location.href = '/index.html';
  const user = JSON.parse(userStr);
  if (user.role !== 'admin') {
    alert('Access Denied: You do not have administrator privileges.');
    return window.location.href = '/dashboard.html';
  }

  const logoutBtn = Array.from(document.querySelectorAll('a')).find(el => el.innerText.includes('Logout'));
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.href = '/index.html';
    });
  }

  loadUsers();
});

async function loadUsers() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to fetch users');
    const users = await res.json();
    
    let container = document.getElementById('adminUsersList');
    if (!container) {
      container = document.createElement('div');
      container.id = 'adminUsersList';
      container.style.marginTop = '15px';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      
      // FIX: Places the list directly underneath the header row, keeping it inside the card
      const headersContainer = Array.from(document.querySelectorAll('div')).find(el => el.innerText.includes('Username') && el.innerText.includes('Email'));
      
      if (headersContainer) {
        headersContainer.after(container);
      } else {
        const card = document.querySelector('.card');
        if (card) card.appendChild(container);
        else document.body.appendChild(container);
      }
    }

    container.innerHTML = users.map(u => `
      <div style="display: flex; align-items: center; padding: 12px 20px; background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 8px; color: #f8fafc; font-size: 0.95rem;">
        <div style="flex: 0.5; color: #94a3b8;">${u.id}</div>
        <div style="flex: 1.5; font-weight: bold; color: #38bdf8;">${u.username}</div>
        <div style="flex: 2; color: #cbd5e1;">${u.email}</div>
        <div style="flex: 1; color: #34d399; font-weight: bold;">${u.habit_count} Habits</div>
        <div style="flex: 1; text-align: right;">
          <button onclick="deleteUser(${u.id})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">Delete</button>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

window.deleteUser = async function(id) {
  if (!confirm('WARNING: Are you sure you want to permanently delete this user and all their tracked habits?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) loadUsers(); 
    else alert('Failed to delete user.');
  } catch (err) { console.error(err); }
};
