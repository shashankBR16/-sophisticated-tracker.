const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) window.location.href = '/index.html';
document.getElementById('userNameDisplay').innerText = `Hi, ${user.username}`;
if (user.role === 'admin') {
  const adminLink = document.getElementById('adminLink');
  if (adminLink) adminLink.style.display = 'inline';
}

document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.clear();
  window.location.href = '/index.html';
});

window.toggleNumberInputs = function(show) {
  document.getElementById('habitUnit').style.display = show ? 'block' : 'none';
  document.getElementById('habitTarget').style.display = show ? 'block' : 'none';
};

window.applyPreset = function(val, sourceId) {
  if (sourceId === 'presetHealth') document.getElementById('presetTasks').value = '';
  if (sourceId === 'presetTasks') document.getElementById('presetHealth').value = '';
  const titleInput = document.getElementById('habitInput');
  const typeSelect = document.getElementById('habitType');
  const unitInput = document.getElementById('habitUnit');
  const targetInput = document.getElementById('habitTarget');
  if (!val) { titleInput.value = ''; unitInput.value = ''; targetInput.value = ''; return; }
  const [title, type, unit, target] = val.split('|');
  titleInput.value = title; typeSelect.value = type;
  if (type === 'number') { toggleNumberInputs(true); unitInput.value = unit || ''; targetInput.value = target || ''; } 
  else { toggleNumberInputs(false); }
};

async function fetchHabits() {
  const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
  const habits = await res.json();
  const booleanList = document.getElementById('booleanHabitList');
  const numberList = document.getElementById('numberHabitList');
  booleanList.innerHTML = ''; numberList.innerHTML = '';

  habits.forEach(h => {
    const el = document.createElement('div');
    el.className = `habit-item ${h.current_qty > 0 ? 'done' : ''}`;
    el.style.display = 'flex'; el.style.justifyContent = 'space-between'; el.style.alignItems = 'center'; el.style.width = '100%';
    const cleanQty = Math.round(h.current_qty * 100) / 100;
    const cleanTarget = Math.round((h.target || 0) * 100) / 100;

    if (h.type === 'number') {
      el.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
          <input type="number" min="0" step="1" value="${cleanQty}" style="width: 80px; background: #0f172a; color: #38bdf8; border: 1px solid #334155; padding: 0.4rem; border-radius: 6px; outline: none; flex-shrink: 0;" onchange="updateHabitQty(${h.id}, this.value)" />
          <span style="font-size: 0.85rem; color: #94a3b8; white-space: nowrap; flex-shrink: 0;">/ ${cleanTarget} ${h.unit}</span>
          <span style="font-size: 0.95rem; color: ${cleanQty >= cleanTarget ? '#34d399' : '#38bdf8'}; font-weight: ${cleanQty >= cleanTarget ? 'bold' : 'normal'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h.title}</span>
        </div>
        <button onclick="deleteHabit(${h.id})" style="background:none; color:#ef4444; border:none; cursor:pointer; font-size: 1.2rem;">✕</button>
      `;
      numberList.appendChild(el);
    } else {
      el.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
          <input type="checkbox" style="min-width: 22px; width: 22px; height: 22px; cursor: pointer; flex-shrink: 0;" ${h.current_qty > 0 ? 'checked' : ''} onchange="updateHabitQty(${h.id}, this.checked ? 1 : 0)" />
          <span style="font-size: 0.95rem; color: ${h.current_qty > 0 ? '#64748b' : '#f8fafc'}; text-decoration: ${h.current_qty > 0 ? 'line-through' : 'none'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h.title}</span>
        </div>
        <button onclick="deleteHabit(${h.id})" style="background:none; color:#ef4444; border:none; cursor:pointer; font-size: 1.2rem;">✕</button>
      `;
      booleanList.appendChild(el);
    }
  });
}

window.updateHabitQty = async function(id, qty) {
  await fetch(`/api/habits/${id}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ quantity: qty || 0 }) });
  fetchHabits(); loadStatsCharts();
};

window.deleteHabit = async function(id) {
  await fetch(`/api/habits/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
  fetchHabits(); loadStatsCharts();
};

document.getElementById('habitForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('habitInput').value;
  const type = document.getElementById('habitType').value;
  const unit = document.getElementById('habitUnit').value;
  const target = document.getElementById('habitTarget').value;
  await fetch('/api/habits', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ title, type, unit, target: parseFloat(target) || 0 }) });
  document.getElementById('habitInput').value = ''; document.getElementById('habitUnit').value = ''; document.getElementById('habitTarget').value = ''; document.getElementById('presetHealth').value = ''; document.getElementById('presetTasks').value = '';
  toggleNumberInputs(false); fetchHabits(); loadStatsCharts();
});

let pieChartInstance = null;
let lineChartInstance = null;
let miniChartInstances = {}; 

async function loadStatsCharts() {
  try {
    const res = await fetch('/api/habits/stats/monthly', { headers: { 'Authorization': `Bearer ${token}` } });
    const { habits, logs } = await res.json();
    const todayDate = new Date().toISOString().split('T')[0];
    const booleanHabits = habits.filter(h => h.type === 'boolean');
    const numberHabits = habits.filter(h => h.type === 'number');
    const pieColors = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf'];

    const pieLabels = [], pieData = [], pieBackgrounds = [];
    booleanHabits.forEach((h, index) => { pieLabels.push(h.title); pieData.push(1); const isDone = logs.find(l => l.habit_id === h.id && l.date === todayDate); pieBackgrounds.push(isDone ? pieColors[index % pieColors.length] : '#334155'); });

    const pieCtx = document.getElementById('pieChart');
    if (pieChartInstance) pieChartInstance.destroy();
    if (booleanHabits.length > 0) pieChartInstance = new Chart(pieCtx.getContext('2d'), { type: 'doughnut', data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieBackgrounds, borderWidth: 2, borderColor: '#0f172a' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });

    const miniChartsContainer = document.getElementById('healthMiniCharts');
    miniChartsContainer.innerHTML = '';
    Object.values(miniChartInstances).forEach(chart => chart.destroy()); miniChartInstances = {};
    numberHabits.forEach((h, index) => {
      let todayQty = 0;
      const todayLog = logs.find(l => l.habit_id === h.id && l.date === todayDate);
      if (todayLog) todayQty = todayLog.quantity;
      const cleanQty = Math.round(todayQty * 100) / 100;
      const cleanTarget = Math.round((h.target || 1) * 100) / 100;
      const remaining = Math.max(0, cleanTarget - cleanQty);
      const wrapper = document.createElement('div');
      wrapper.style = "width: 110px; text-align: center;";
      wrapper.innerHTML = `<h5 style="color:#cbd5e1; font-size:0.75rem; margin-bottom:0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h.title}</h5><div style="position: relative; height: 80px;"><canvas id="mini-${h.id}"></canvas></div><p style="font-size:0.7rem; color:${cleanQty >= cleanTarget ? '#34d399' : '#94a3b8'}; margin-top:0.3rem; font-weight:bold;">${cleanQty} / ${cleanTarget}</p>`;
      miniChartsContainer.appendChild(wrapper);
      miniChartInstances[h.id] = new Chart(document.getElementById(`mini-${h.id}`).getContext('2d'), { type: 'doughnut', data: { labels: ['Done', 'Remaining'], datasets: [{ data: [cleanQty, remaining], backgroundColor: [pieColors[index % pieColors.length], '#334155'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
    });

    const dates = [], labels = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })); 
    }
    const datasets = numberHabits.map((habit, index) => {
      const dataPoints = dates.map(dateStr => { const log = logs.find(l => l.habit_id === habit.id && l.date === dateStr); return log ? Math.round(log.quantity * 100) / 100 : 0; });
      return { label: habit.title, data: dataPoints, backgroundColor: pieColors[index % pieColors.length], borderRadius: 4 };
    });

    const lineCtx = document.getElementById('lineChart');
    if (lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart(lineCtx.getContext('2d'), { type: 'bar', data: { labels: labels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155', drawBorder: false } }, x: { ticks: { color: '#94a3b8', maxTicksLimit: 7 }, grid: { display: false } } }, plugins: { legend: { display: true, labels: { color: '#f8fafc', font: { size: 12 } } } } } });
  } catch(err) { console.error("Chart error:", err); }
}

async function generateReport(days) {
  try {
    const res = await fetch('/api/habits/stats/monthly', { headers: { 'Authorization': `Bearer ${token}` } });
    const { habits, logs } = await res.json();
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = ''; 
    document.getElementById('reportModalTitle').innerText = days === 7 ? '7-Day Recap 🏅' : '30-Day Recap 🏆';
    document.getElementById('reportModalSubtitle').innerText = days === 7 ? 'Here is your progress over the last week.' : 'Here is everything you accomplished this month.';

    const validDates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      validDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    const filteredLogs = logs.filter(l => validDates.includes(l.date));
    const booleanHabits = habits.filter(h => h.type === 'boolean');
    const numberHabits = habits.filter(h => h.type === 'number');

    let totalTasksDone = 0;
    booleanHabits.forEach(h => { totalTasksDone += filteredLogs.filter(l => l.habit_id === h.id).length; });
    reportContent.innerHTML += `<div style="background: rgba(52, 211, 153, 0.1); border: 1px solid #34d399; padding: 1rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;"><span style="color: #f8fafc; font-weight: bold; font-size: 1.1rem;">✔️ Total Tasks Completed</span><span style="color: #34d399; font-size: 1.5rem; font-weight: 900;">${totalTasksDone}</span></div>`;

    numberHabits.forEach(h => {
      let totalMetric = 0;
      filteredLogs.filter(l => l.habit_id === h.id).forEach(log => { totalMetric += log.quantity; });
      totalMetric = Math.round(totalMetric * 100) / 100;
      if (totalMetric > 0) reportContent.innerHTML += `<div style="background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; padding: 1rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;"><span style="color: #f8fafc; font-weight: bold; font-size: 1.1rem;">📈 Total ${h.title}</span><span style="color: #38bdf8; font-size: 1.3rem; font-weight: 900;">${totalMetric} <span style="font-size: 0.9rem; color:#94a3b8;">${h.unit}</span></span></div>`;
    });

    if (totalTasksDone === 0 && reportContent.children.length === 1) reportContent.innerHTML += `<p style="text-align: center; color: #94a3b8; margin-top: 1rem;">No data logged yet. Start tracking to build your report!</p>`;
    document.getElementById('reportModal').style.display = 'flex';
  } catch(err) { console.error("Error generating report:", err); }
}

if(document.getElementById('weeklyReportBtn')) {
  document.getElementById('weeklyReportBtn').addEventListener('click', (e) => { e.preventDefault(); generateReport(7); });
  document.getElementById('monthlyReportBtn').addEventListener('click', (e) => { e.preventDefault(); generateReport(30); });
}

fetchHabits();
loadStatsCharts();
