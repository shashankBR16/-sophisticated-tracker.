document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) return window.location.href = '/index.html';

  window.currentHabits = []; // Store current list to check duplicates

  // 1. SET USERNAME
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const greetingEl = document.getElementById('userNameDisplay');
      if (greetingEl && user.username) greetingEl.innerText = user.username;
    } catch(e) { console.error(e); }
  }

  // 2. TOGGLE NUMBER INPUTS
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

  // 3. APPLY PRESET
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

  // 4. HANDLE ADD HABIT FORM
  const habitForm = document.getElementById('habitForm');
  if (habitForm) {
    habitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('habitInput').value.trim();
      const type = document.getElementById('habitType').value;
      const unit = document.getElementById('habitUnit').value.trim();
      const target = document.getElementById('habitTarget').value;

      if (!title) return alert('Please enter a habit name.');

      // PREVENT DUPLICATES FRONTEND CHECK
      const isDuplicate = window.currentHabits.some(h => h.title.toLowerCase() === title.toLowerCase());
      if (isDuplicate) return alert('This habit is already in your tracker!');

      const payload = {
        title, type,
        unit: type === 'number' ? unit : null,
        target: type === 'number' ? parseFloat(target) : null
      };

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
          const data = await res.json();
          alert(data.error || 'Failed to add habit');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Handle Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.href = '/index.html';
    });
  }

  // Initial Load
  loadHabits();
});

// Global chart tracking variables
let mainPieChart;
let growthLineChart;
window.miniChartsRegistry = {}; 

// 5. RENDER THE INTERACTIVE UI & CHARTS
async function loadHabits() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const habits = await res.json();
    window.currentHabits = habits; // Update global list

    const tasks = habits.filter(h => h.type === 'boolean');
    const metrics = habits.filter(h => h.type === 'number');

    const booleanList = document.getElementById('booleanHabitList');
    const numberList = document.getElementById('numberHabitList');

    // UI for Daily Tasks (Checkboxes trigger updateTaskChart)
    if (booleanList) {
      booleanList.innerHTML = tasks.length ? tasks.map(h => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="checkbox" class="task-checkbox" onchange="updateTaskChart()" style="width: 18px; height: 18px; accent-color: #38bdf8; cursor: pointer;" id="check_${h.id}">
            <label for="check_${h.id}" style="color: #94a3b8; font-weight: 500; cursor: pointer;">${h.title}</label>
          </div>
          <button onclick="deleteHabit(${h.id})" style="color: #ef4444; background: none; border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>
      `).join('') : '<div style="color: #94a3b8; text-align: center;">No daily tasks yet.</div>';
    }

    // UI for Health Metrics (Number inputs trigger updateMetricChart)
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

  } catch (err) {
    console.error('Error loading habits:', err);
  }
}

// MAKE CHARTS INTERACTIVE
window.updateTaskChart = function() {
  const checkboxes = document.querySelectorAll('.task-checkbox');
  let completed = 0;
  checkboxes.forEach(c => { if(c.checked) completed++; });
  const pending = checkboxes.length - completed;

  if (mainPieChart) {
    mainPieChart.data.datasets[0].data = [completed, pending];
    mainPieChart.update();
  }
};

window.updateMetricChart = function(id, value, target) {
  const chart = window.miniChartsRegistry[id];
  if (chart) {
    let val = parseFloat(value) || 0;
    let remaining = target - val;
    if (remaining < 0) remaining = 0; // Prevent chart from reversing
    chart.data.datasets[0].data = [val, remaining];
    chart.update();
  }
};

// DELETE FUNCTION
window.deleteHabit = async function(id) {
  if(!confirm('Delete this habit?')) return;
  const token = localStorage.getItem('token');
  try {
    await fetch(`/api/habits/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadHabits(); 
  } catch(e) { console.error(e); }
}

// 6. RENDER GRAPHS
function renderCharts(tasks, metrics) {
  const pieCtx = document.getElementById('pieChart');
  if (pieCtx) {
    if (mainPieChart) mainPieChart.destroy(); 
    mainPieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Pending'],
        datasets: [{
          data: [0, tasks.length > 0 ? tasks.length : 1], // Default to 0 completed on load
          backgroundColor: ['#38bdf8', '#fb7185'],
          borderWidth: 0,
          cutout: '60%'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  const miniContainer = document.getElementById('healthMiniCharts');
  if (miniContainer) {
    miniContainer.innerHTML = ''; 
    window.miniChartsRegistry = {}; // Clear old charts memory
    metrics.forEach(m => {
      const wrapper = document.createElement('div');
      wrapper.style = 'width: 80px; text-align: center;';
      wrapper.innerHTML = `
        <div style="font-size: 0.7rem; color: #f8fafc; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</div>
        <div style="position: relative; height: 60px; width: 60px; margin: 0 auto;">
          <canvas id="mini_${m.id}"></canvas>
        </div>
      `;
      miniContainer.appendChild(wrapper);

      window.miniChartsRegistry[m.id] = new Chart(document.getElementById(`mini_${m.id}`), {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [0, m.target], // [Completed, Remaining]
            backgroundColor: ['#34d399', '#334155'],
            borderWidth: 0,
            cutout: '75%'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } } }
      });
    });
  }
}
