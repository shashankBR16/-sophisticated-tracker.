document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  // Security Gate
  if (!token || !userStr) return window.location.href = '/index.html';
  const user = JSON.parse(userStr);
  if (user.role !== 'admin') {
    alert('Access Denied: You do not have administrator privileges.');
    return window.location.href = '/dashboard.html';
  }

  // Logout Handler
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
      container.style.width = '100%';
      container.style.marginTop = '20px';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      
      // FIX: Force the main card to stack items vertically
      const card = document.querySelector('.card') || document.body;
      if (card.classList.contains('card')) {
         card.style.display = 'flex';
         card.style.flexDirection = 'column';
      }
      card.appendChild(container);
    }

    container.innerHTML = users.map(u => `
      <div style="display: flex; align-items: center; padding: 12px 20px; background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 8px; color: #f8fafc; font-size: 0.95rem; width: 100%; box-sizing: border-box;">
        <div style="flex: 0.5; color: #94a3b8;">${u.id}</div>
        <div style="flex: 1.5; font-weight: bold; color: #38bdf8;">${u.username}</div>
        <div style="flex: 2; color: #cbd5e1;">${u.email}</div>
        <div style="flex: 1; color: #34d399; font-weight: bold;">${u.habit_count} Habits</div>
        <div style="flex: 1.5; text-align: right; display: flex; gap: 10px; justify-content: flex-end;">
          <button onclick="alert('User Inspect Data:\\nID: ${u.id}\\nUsername: ${u.username}\\nEmail: ${u.email}\\nHabits Tracked: ${u.habit_count}')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">Inspect</button>
          <button onclick="deleteUser(${u.id})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">Delete</button>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

window.deleteUser = async function(id) {
  if (!confirm('WARNING: Are you sure you want to permanently delete this user?')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) loadUsers(); 
    else alert('Failed to delete user.');
  } catch (err) { console.error(err); }
};
