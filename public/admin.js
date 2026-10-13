document.addEventListener('DOMContentLoaded', () => {
  // 1. INJECT RESPONSIVE CSS CAPABILITIES
  if (!document.getElementById('adminResponsiveStyles')) {
    const style = document.createElement('style');
    style.id = 'adminResponsiveStyles';
    style.innerHTML = `
      .admin-container { width: 100%; display: flex; flex-direction: column; box-sizing: border-box; }
      .admin-row {
        display: flex; align-items: center; padding: 15px 20px; background: rgba(30, 41, 59, 0.8);
        border: 1px solid #334155; border-radius: 8px; color: #f8fafc; font-size: 0.95rem; width: 100%; box-sizing: border-box; margin-bottom: 10px;
      }
      .admin-actions { display: flex; gap: 10px; justify-content: flex-end; }
      .mobile-label { display: none; color: #94a3b8; font-weight: normal; min-width: 70px; }
      
      /* Mobile Optimization Trigger */
      @media (max-width: 768px) {
        .admin-row { flex-direction: column; align-items: flex-start; gap: 8px; padding: 15px; }
        .admin-col { width: 100% !important; flex: none !important; display: flex; align-items: center; word-break: break-word; }
        .mobile-label { display: inline-block; margin-right: 10px; }
        .admin-actions { width: 100%; justify-content: space-between !important; margin-top: 10px; }
        .admin-actions button { flex: 1; padding: 10px; }
        .desktop-headers { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  // 2. SECURITY CHECK
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) return window.location.href = '/index.html';
  const user = JSON.parse(userStr);
  if (user.role !== 'admin') {
    alert('Access Denied: You do not have administrator privileges.');
    return window.location.href = '/dashboard.html';
  }

  // 3. LOGOUT LOGIC
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
    
    // BUG FIX: .reverse() forces it to grab the innermost header row instead of the outermost main container
    const headersContainer = Array.from(document.querySelectorAll('div')).reverse().find(el => 
        el.innerText && el.innerText.includes('Username') && el.innerText.includes('Email') && 
        !el.id && !el.classList.contains('admin-row') && !el.classList.contains('admin-container')
    );
    if (headersContainer) headersContainer.classList.add('desktop-headers');

    let container = document.getElementById('adminUsersList');
    if (!container) {
      container = document.createElement('div');
      container.id = 'adminUsersList';
      container.className = 'admin-container';
      container.style.marginTop = '20px';
      
      const card = document.querySelector('div[style*="max-width"]') || document.body;
      card.appendChild(container);
    }

    // Map database users to the new responsive structure
    container.innerHTML = users.map(u => `
      <div class="admin-row">
        <div class="admin-col" style="flex: 0.5; color: #94a3b8;">
          <span class="mobile-label">ID:</span>${u.id}
        </div>
        <div class="admin-col" style="flex: 1.5; font-weight: bold; color: #38bdf8;">
          <span class="mobile-label">User:</span>${u.username}
        </div>
        <div class="admin-col" style="flex: 2; color: #cbd5e1;">
          <span class="mobile-label">Email:</span>${u.email}
        </div>
        <div class="admin-col" style="flex: 1; color: #34d399; font-weight: bold;">
          <span class="mobile-label">Habits:</span>${u.habit_count}
        </div>
        <div class="admin-col admin-actions" style="flex: 1.5;">
          <button onclick="window.location.href='/dashboard.html?inspect=${u.id}&name=${encodeURIComponent(u.username)}'" style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">Inspect</button>
          <button onclick="deleteUser(${u.id})" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">Delete</button>
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
