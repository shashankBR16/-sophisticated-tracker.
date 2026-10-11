document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) return window.location.href = '/index.html';
  window.currentHabits = [];

  // 1. SET USERNAME (Adds "Hi, ")
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const greetingEl = document.getElementById('userNameDisplay');
      if (greetingEl && user.username) greetingEl.innerText = `Hi, ${user.username}`;
    } catch(e) { console.error(e); }
  }

  // 2. WEEKLY & MONTHLY RECAP MODALS
  const reportModal = document.getElementById('reportModal');
  const reportTitle = document.getElementById('reportModalTitle');
  const reportContent = document.getElementById('reportContent');

  document.getElementById('weeklyReportBtn')?.addEventListener('click', () => {
    reportTitle.innerText = 'Weekly Recap';
    reportContent.innerHTML = '<p style="color:#f8fafc; font-size:1.1rem;">You had a great week! Stay consistent with your daily tasks.</p>';
    reportModal.style.display = 'flex';
  });

  document.getElementById('monthlyReportBtn')?.addEventListener('click', () => {
    reportTitle.innerText = 'Monthly Recap';
    reportContent.innerHTML = '<p style="color:#f8fafc; font-size:1.1rem;">Amazing progress this month across all your health metrics!</p>';
    reportModal.style.display = 'flex';
  });

  // 3. UI TOGGLES & PRESETS
  window.toggleNumberInputs = function(show) {
    const unitInput = document.getElementById('habitUnit');
    const targetInput = document.getElementById('habitTarget');
    if (show) {
      unitInput.style.display = 'inline-block';
      targetInput.style.display = 'inline-block';
    } else {
      unitInput.style.display = 'none';
      targetInput.style.display = 'none';
      unitInput.value = '';
      targetInput.value = '';
    }
  };

  window.applyPreset = function(value, sourceId) {
    if (!value) return;
    const parts = value.split('|');
    const title = parts[0].trim();
    const type = parts[1] || 'boolean';
    
    document.getElementById('habitInput').value = title;
    document.getElementById('habitType').value = type;

    if (sourceId === 'presetHealth') document.getElementById('presetTasks').selectedIndex = 0;
    if (sourceId === 'presetTasks') document.getElementById('presetHealth').selectedIndex = 0;

    window.toggleNumberInputs(type === 'number');
    if (type === 'number') {
      document.getElementById('habitUnit').value = parts[2] || '';
      document.getElementById('habitTarget').value = parts[3] || '';
    }
  };

  // 4. ADD HABIT
  const habitForm = document.getElementById('habitForm');
  if (habitForm) {
    habitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('habitInput').value.trim();
      const type = document.getElementById('habitType').value;
      const unit = document.getElementById('habitUnit').value.trim();
      const target = document.getElementById('habitTarget').value;

      if (!title) return alert('Please enter a habit name.');
      const isDuplicate = window.currentHabits.some(h => h.title.toLowerCase() === title.toLowerCase());
      if (isDuplicate) return alert('This habit is already in your tracker!');

      const payload = { title, type, unit: type === 'number' ? unit : null, target: type === 'number' ? parseFloat(target) : null };

      try {
        const res = await fetch('/api/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          document.getElementById('habitInput').value = '';
          document.getElementById('habitType').value = 'boolean';
          window.toggleNumberInputs(false);
          document.getElementById('presetHealth').selectedIndex = 0;
          document.getElementById('presetTasks').selectedIndex = 0;
          loadHabits();
        } else {
          alert('Failed to add habit');
        }
      } catch (err) { console.error(err); }
    });
  }

  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '/index.html';
  });

  loadHabits();
});

let mainPieChart;
let growthBarChart;
window.miniChartsRegistry = {}; 

// 5. RENDER UI
async function loadHabits() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const habits = await res.json();
    window.currentHabits = habits; 

    const tasks = habits.filter(h => h.type === 'boolean');
    const metrics = habits.filter(h => h.type === 'number');

    const booleanList = document.getElementById('booleanHabitList');
    const numberList = document.getElementById('numberHabitList');

    if (booleanList) {
      booleanList.innerHTML = tasks.length ? tasks.map(h => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="checkbox" class="task-checkbox" data-title="${h.title}" onchange="updateTaskChart()" style="width: 18px; height: 18px; accent-color: #38bdf8; cursor: pointer;" id="check_${h.id}">
            <label for="check_${h.id}" style="color: #94a3b8; font-weight: 500; cursor: pointer;">${h.title}</label>
          </div>
          <button onclick="deleteHabit(${h.id})" style="color: #ef4444; background: none; border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>
      `).join('') : '<div style="color: #94a3b8; text-align: center;">No daily tasks yet.</div>';
    }

    if (numberList) {
      numberList.innerHTML = metrics.length ? metrics.map(h => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="number" oninput="updateMetricChart(${h.id}, this.value, ${h.target})" placeholder="0" style="width: 70px; padding: 6px; background: #0f172a; border: 1px solid #334155; color: #38bdf8; border-radius: 6px; outline: none;">
            <span style="color: #64748b; font-size: 0.9em;">/ ${h.target} ${h.unit}</span>
            <span style="color: #38bdf8; font-weight: 600; margin-left: 8px;">${h.title}</span>
          </div>
          <button onclick="deleteHabit(${h.id})" style="color: #ef4444; background: none; border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>
      `).join('') : '<div style="color: #94a3b8; text-align: center;">No health metrics yet.</div>';
    }

    renderCharts(tasks, metrics);
  } catch (err) { console.error(err); }
}

// 6. DYNAMIC MULTI-COLOR PIE CHART
window.updateTaskChart = function() {
  const checkboxes = document.querySelectorAll('.task-checkbox');
  const palette = ['#38bdf8', '#34d399', '#facc15', '#a78bfa', '#fb923c', '#fb7185', '#2dd4bf'];
  
  let labels = [];
  let data = [];
  let bgColors = [];

  checkboxes.forEach((c, index) => {
    if (c.checked) {
      labels.push(c.dataset.title);
      data.push(1); 
      bgColors.push(palette[index % palette.length]);
    }
  });

  if (labels.length === 0) {
    labels = ['Pending'];
    data = [1];
    bgColors = ['#334155'];
  }

  if (mainPieChart) {
    mainPieChart.data.labels = labels;
    mainPieChart.data.datasets[0].data = data;
    mainPieChart.data.datasets[0].backgroundColor = bgColors;
    mainPieChart.update();
  }
};

window.updateMetricChart = function(id, value, target) {
  const chart = window.miniChartsRegistry[id];
  if (chart) {
    let val = parseFloat(value) || 0;
    let remaining = target - val;
    if (remaining < 0) remaining = 0;
    chart.data.datasets[0].data = [val, remaining];
    chart.update();
  }
};

window.deleteHabit = async function(id) {
  if(!confirm('Delete this habit?')) return;
  const token = localStorage.getItem('token');
  try {
    await fetch(`/api/habits/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadHabits(); 
  } catch(e) { console.error(e); }
}

// 7. RENDER GRAPHS
function renderCharts(tasks, metrics) {
  const pieCtx = document.getElementById('pieChart');
  if (pieCtx) {
    if (mainPieChart) mainPieChart.destroy(); 
    mainPieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Pending'],
        datasets: [{ data: [1], backgroundColor: ['#334155'], borderWidth: 0, cutout: '60%' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  // Mini Pie Charts
  const miniContainer = document.getElementById('healthMiniCharts');
  if (miniContainer) {
    miniContainer.innerHTML = ''; 
    window.miniChartsRegistry = {}; 
    metrics.forEach(m => {
      const wrapper = document.createElement('div');
      wrapper.style = 'width: 80px; text-align: center;';
      wrapper.innerHTML = `
        <div style="font-size: 0.7rem; color: #f8fafc; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</div>
        <div style="position: relative; height: 60px; width: 60px; margin: 0 auto;"><canvas id="mini_${m.id}"></canvas></div>
      `;
      miniContainer.appendChild(wrapper);

      window.miniChartsRegistry[m.id] = new Chart(document.getElementById(`mini_${m.id}`), {
        type: 'doughnut',
        data: { datasets: [{ data: [0, m.target], backgroundColor: ['#34d399', '#334155'], borderWidth: 0, cutout: '75%' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } } }
      });
    });
  }

  // All-in-One Bar Graph for Health Metrics
  const barCtx = document.getElementById('lineChart');
  if (barCtx) {
    if (growthBarChart) growthBarChart.destroy();
    growthBarChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: metrics.map(m => m.title),
        datasets: [{
          label: 'Target',
          data: metrics.map(m => m.target),
          backgroundColor: '#38bdf8',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}
