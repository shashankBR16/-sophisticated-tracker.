document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) return window.location.href = '/index.html';
  window.currentHabits = [];

  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const greetingEl = document.getElementById('userNameDisplay');
      if (greetingEl && user.username) greetingEl.innerText = user.username; 
    } catch(e) {}
  }

  // DYNAMIC RECAP GENERATOR
  const generateRecap = (titleText) => {
    const reportModal = document.getElementById('reportModal');
    const reportTitle = document.getElementById('reportModalTitle');
    const reportContent = document.getElementById('reportContent');
    
    const checkboxes = document.querySelectorAll('.task-checkbox');
    let tasksDone = 0;
    checkboxes.forEach(c => { if(c.checked) tasksDone++; });

    const numberInputs = document.querySelectorAll('.metric-input');
    let metricsHtml = '';
    numberInputs.forEach(input => {
      let val = parseFloat(input.value) || 0;
      if(val > 0) {
        metricsHtml += `<li style="margin-bottom: 5px; color: #34d399;">${input.dataset.title}: <strong>${val}</strong></li>`;
      }
    });

    reportTitle.innerText = titleText;
    reportContent.innerHTML = `
      <div style="color:#f8fafc; margin-top:10px;">
        <h4 style="color:#38bdf8;">✅ Tasks Completed: ${tasksDone} / ${checkboxes.length}</h4>
        <h4 style="color:#a78bfa; margin-top: 15px;">📈 Metrics Progress:</h4>
        <ul style="padding-left: 20px;">${metricsHtml || '<li style="color:#94a3b8;">No progress recorded yet.</li>'}</ul>
      </div>
    `;
    reportModal.style.display = 'flex';
  };

  document.getElementById('weeklyReportBtn')?.addEventListener('click', () => generateRecap('Weekly Recap'));
  document.getElementById('monthlyReportBtn')?.addEventListener('click', () => generateRecap('Monthly Recap'));

  // UI PRESETS
  window.toggleNumberInputs = function(show) {
    const unitInput = document.getElementById('habitUnit');
    const targetInput = document.getElementById('habitTarget');
    if (show) {
      unitInput.style.display = 'inline-block';
      targetInput.style.display = 'inline-block';
    } else {
      unitInput.style.display = 'none';
      targetInput.style.display = 'none';
      unitInput.value = ''; targetInput.value = '';
    }
  };

  window.applyPreset = function(value, sourceId) {
    if (!value) return;
    const parts = value.split('|');
    document.getElementById('habitInput').value = parts[0].trim();
    document.getElementById('habitType').value = parts[1] || 'boolean';
    if (sourceId === 'presetHealth') document.getElementById('presetTasks').selectedIndex = 0;
    if (sourceId === 'presetTasks') document.getElementById('presetHealth').selectedIndex = 0;
    window.toggleNumberInputs((parts[1] || 'boolean') === 'number');
    if ((parts[1] || 'boolean') === 'number') {
      document.getElementById('habitUnit').value = parts[2] || '';
      document.getElementById('habitTarget').value = parts[3] || '';
    }
  };

  const habitForm = document.getElementById('habitForm');
  if (habitForm) {
    habitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('habitInput').value.trim();
      const type = document.getElementById('habitType').value;
      const unit = document.getElementById('habitUnit').value.trim();
      const target = document.getElementById('habitTarget').value;
      
      if (!title) return alert('Please enter a habit name.');
      if (window.currentHabits.some(h => h.title.toLowerCase() === title.toLowerCase())) return alert('Habit already exists!');
      
      const payload = { title, type, unit: type === 'number' ? unit : null, target: type === 'number' ? parseFloat(target) : null };
      try {
        const res = await fetch('/api/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          document.getElementById('habitInput').value = '';
          window.toggleNumberInputs(false);
          loadHabits();
        }
      } catch (err) {}
    });
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.clear(); window.location.href = '/index.html';
  });

  loadHabits();
});

let mainPieChart;
let growthBarChart;
window.miniChartsRegistry = {}; 

async function loadHabits() {
  const token = localStorage.getItem('token');
  try {
    // 1. TAKE SNAPSHOT OF CURRENT PROGRESS BEFORE REDRAWING
    const savedTasks = [];
    document.querySelectorAll('.task-checkbox').forEach(cb => {
      if (cb.checked) savedTasks.push(cb.id);
    });

    const savedMetrics = {};
    document.querySelectorAll('.metric-input').forEach(input => {
      if (input.value) savedMetrics[input.id] = input.value;
    });

    // 2. FETCH NEW DATA
    const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const habits = await res.json();
    window.currentHabits = habits; 

    const tasks = habits.filter(h => h.type === 'boolean');
    const metrics = habits.filter(h => h.type === 'number');

    const booleanList = document.getElementById('booleanHabitList');
    const numberList = document.getElementById('numberHabitList');

    // 3. DRAW NEW HTML
    if (booleanList) {
      booleanList.innerHTML = tasks.length ? tasks.map(h => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="checkbox" class="task-checkbox" data-title="${h.title}" onchange="updateTaskChart()" style="width: 18px; height: 18px; accent-color: #38bdf8; cursor: pointer;" id="check_${h.id}">
            <label style="color: #94a3b8; font-weight: 500;">${h.title}</label>
          </div>
          <button onclick="deleteHabit(${h.id})" style="color: #ef4444; background: none; border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>
      `).join('') : '<div style="color: #94a3b8; text-align: center;">No daily tasks.</div>';
    }

    if (numberList) {
      numberList.innerHTML = metrics.length ? metrics.map(h => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="number" id="metric_${h.id}" class="metric-input" data-title="${h.title}" oninput="updateMetricChart(${h.id}, this.value, ${h.target}, '${h.title}')" placeholder="0" style="width: 70px; padding: 6px; background: #0f172a; border: 1px solid #334155; color: #38bdf8; border-radius: 6px; outline: none;">
            <span style="color: #64748b; font-size: 0.9em;">/ ${h.target} ${h.unit}</span>
            <span style="color: #38bdf8; font-weight: 600; margin-left: 8px;">${h.title}</span>
          </div>
          <button onclick="deleteHabit(${h.id})" style="color: #ef4444; background: none; border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>
      `).join('') : '<div style="color: #94a3b8; text-align: center;">No metrics.</div>';
    }

    // Initialize blank charts based on new lists
    renderCharts(tasks, metrics);

    // 4. RESTORE SNAPSHOT PROGRESS & FORCE CHART UPDATES
    savedTasks.forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = true;
    });

    Object.keys(savedMetrics).forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.value = savedMetrics[id];
        input.dispatchEvent(new Event('input')); // Forces the bar chart to update
      }
    });

    updateTaskChart(); // Forces the pie chart to update

  } catch (err) {}
}

window.updateTaskChart = function() {
  const checkboxes = document.querySelectorAll('.task-checkbox');
  const palette = ['#38bdf8', '#34d399', '#facc15', '#a78bfa', '#fb923c', '#fb7185', '#2dd4bf'];
  
  let labels = [];
  let data = [];
  let bgColors = [];
  let pendingCount = 0;

  checkboxes.forEach((c, index) => {
    if (c.checked) {
      labels.push(c.dataset.title);
      data.push(1); 
      bgColors.push(palette[index % palette.length]);
    } else {
      pendingCount++;
    }
  });

  if (pendingCount > 0) {
    labels.push('Pending');
    data.push(pendingCount);
    bgColors.push('#334155');
  }

  if (labels.length === 0) { labels = ['Pending']; data = [1]; bgColors = ['#334155']; }

  if (mainPieChart) {
    mainPieChart.data.labels = labels;
    mainPieChart.data.datasets[0].data = data;
    mainPieChart.data.datasets[0].backgroundColor = bgColors;
    mainPieChart.update();
  }
};

window.updateMetricChart = function(id, value, target, title) {
  let val = parseFloat(value) || 0;
  
  const chart = window.miniChartsRegistry[id];
  if (chart) {
    let remaining = target - val;
    if (remaining < 0) remaining = 0;
    chart.data.datasets[0].data = [val, remaining];
    chart.update();
  }
  
  if (growthBarChart) {
    const idx = growthBarChart.data.labels.indexOf(title);
    if (idx !== -1) {
      growthBarChart.data.datasets[0].data[idx] = val;
      growthBarChart.update();
    }
  }
};

window.deleteHabit = async function(id) {
  if(!confirm('Delete this habit?')) return;
  const token = localStorage.getItem('token');
  try {
    await fetch(`/api/habits/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadHabits(); 
  } catch(e) {}
}

function renderCharts(tasks, metrics) {
  const pieCtx = document.getElementById('pieChart');
  if (pieCtx) {
    if (mainPieChart) mainPieChart.destroy(); 
    mainPieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Pending'],
        datasets: [{ data: [tasks.length || 1], backgroundColor: ['#334155'], borderWidth: 0, cutout: '60%' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

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

  const barCtx = document.getElementById('lineChart');
  if (barCtx) {
    if (growthBarChart) growthBarChart.destroy();
    growthBarChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: metrics.map(m => m.title),
        datasets: [{
          label: 'Current Progress',
          data: metrics.map(() => 0),
          backgroundColor: '#38bdf8',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8' } } },
        plugins: { legend: { display: false } }
      }
    });
  }
}
