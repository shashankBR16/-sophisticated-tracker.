const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));
if (!token || !user || user.role !== 'admin') window.location.href = '/dashboard.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/index.html';
});

async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
    const users = await res.json();
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '';

    users.forEach((u, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td> <!-- Generates sequential 1, 2, 3 perfectly -->
        <td>${u.username}</td>
        <td>${u.email}</td>
        <td>${u.total_habits}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button onclick="inspectUser(${u.id}, '${u.username}')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: #38bdf8; color: #0f172a; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Inspect</button>
            <button onclick="deleteUser(${u.id}, '${u.username}')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: #ef4444; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading admin data:", err);
  }
}

window.deleteUser = async function(userId, username) {
  if (!confirm(`Are you absolutely sure you want to permanently delete ${username}'s account and all their data? This cannot be undone.`)) {
    return; 
  }

  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert(`${username} has been successfully deleted.`);
      loadAdminData(); 
    } else {
      alert(`Error: ${data.error}`);
    }
  } catch (err) {
    console.error("Delete error:", err);
  }
};

let adminPieChartInst = null;
let adminBarChartInst = null;
let adminMiniChartInsts = {};

window.inspectUser = async function(userId, username) {
  const modal = document.getElementById('userModal');
  document.getElementById('modalTitle').innerText = `Viewing Dashboard: ${username}`;
  modal.style.display = 'block';

  const res = await fetch(`/api/admin/users/${userId}/habits`, { headers: { 'Authorization': `Bearer ${token}` } });
  const { habits, logs } = await res.json();

  const todayDate = new Date().toISOString().split('T')[0];
  const booleanHabits = habits.filter(h => h.type === 'boolean');
  const numberHabits = habits.filter(h => h.type === 'number');
  const pieColors = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf'];

  const pieLabels = [], pieData = [], pieBackgrounds = [];
  booleanHabits.forEach((h, index) => {
    pieLabels.push(h.title);
    pieData.push(1); 
    const isDone = logs.find(l => l.habit_id === h.id && l.date === todayDate);
    pieBackgrounds.push(isDone ? pieColors[index % pieColors.length] : '#334155');
  });

  if (adminPieChartInst) adminPieChartInst.destroy();
  adminPieChartInst = new Chart(document.getElementById('adminPieChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieBackgrounds, borderWidth: 2, borderColor: '#0f172a' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  const miniContainer = document.getElementById('adminHealthMiniCharts');
  miniContainer.innerHTML = '';
  Object.values(adminMiniChartInsts).forEach(chart => chart.destroy());
  adminMiniChartInsts = {};

  numberHabits.forEach((h, index) => {
    let todayQty = 0;
    const todayLog = logs.find(l => l.habit_id === h.id && l.date === todayDate);
    if (todayLog) todayQty = todayLog.quantity;
    const cleanQty = Math.round(todayQty * 100) / 100;
    const cleanTarget = Math.round((h.target || 1) * 100) / 100;
    const remaining = Math.max(0, cleanTarget - cleanQty);
    
    const wrapper = document.createElement('div');
    wrapper.style = "width: 110px; text-align: center;";
    wrapper.innerHTML = `
      <h5 style="color:#cbd5e1; font-size:0.75rem; margin-bottom:0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h.title}</h5>
      <div style="position: relative; height: 80px;"><canvas id="admin-mini-${h.id}"></canvas></div>
      <p style="font-size:0.7rem; color:${cleanQty >= cleanTarget ? '#34d399' : '#94a3b8'}; margin-top:0.3rem; font-weight:bold;">${cleanQty} / ${cleanTarget}</p>
    `;
    miniContainer.appendChild(wrapper);

    adminMiniChartInsts[h.id] = new Chart(document.getElementById(`admin-mini-${h.id}`).getContext('2d'), {
      type: 'doughnut',
      data: { labels: ['Done', 'Remaining'], datasets: [{ data: [cleanQty, remaining], backgroundColor: [pieColors[index % pieColors.length], '#334155'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  });

  const dates = [], labels = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })); 
  }
  const datasets = numberHabits.map((habit, index) => {
    const dataPoints = dates.map(dateStr => {
      const log = logs.find(l => l.habit_id === habit.id && l.date === dateStr);
      return log ? Math.round(log.quantity * 100) / 100 : 0; 
    });
    return { label: habit.title, data: dataPoints, backgroundColor: pieColors[index % pieColors.length], borderRadius: 4 };
  });

  if (adminBarChartInst) adminBarChartInst.destroy();
  adminBarChartInst = new Chart(document.getElementById('adminBarChart').getContext('2d'), {
    type: 'bar',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155', drawBorder: false } }, x: { ticks: { color: '#94a3b8', maxTicksLimit: 7 }, grid: { display: false } } },
      plugins: { legend: { display: true, labels: { color: '#f8fafc', font: { size: 12 } } } }
    }
  });
}

loadAdminData();