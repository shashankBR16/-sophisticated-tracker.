document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) return window.location.href = '/index.html';

  // 1. SET USERNAME (Maps to <span id="userNameDisplay">)
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const greetingEl = document.getElementById('userNameDisplay');
      if (greetingEl && user.username) greetingEl.innerText = user.username;
    } catch(e) {
      console.error('Error parsing user data', e);
    }
  }

  // 2. TOGGLE NUMBER INPUTS GLOBALLY (Triggered by HTML onchange)
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

  // 3. APPLY PRESET GLOBALLY (Triggered by HTML onchange)
  window.applyPreset = function(value, sourceId) {
    if (!value) return;

    // Split the preset values: Title|Type|Unit|Target
    const parts = value.split('|');
    const title = parts[0].trim();
    const type = parts[1] || 'boolean';
    const unit = parts[2] || '';
    const target = parts[3] || '';

    // Populate the form fields
    document.getElementById('habitInput').value = title;
    document.getElementById('habitType').value = type;

    // Reset the *other* dropdown so they don't conflict
    if (sourceId === 'presetHealth') document.getElementById('presetTasks').selectedIndex = 0;
    if (sourceId === 'presetTasks') document.getElementById('presetHealth').selectedIndex = 0;

    // Show/Hide unit and target fields based on type
    window.toggleNumberInputs(type === 'number');
    
    // Fill in the numbers if it is a health metric
    if (type === 'number') {
      document.getElementById('habitUnit').value = unit;
      document.getElementById('habitTarget').value = target;
    }
  };

  // 4. HANDLE ADD HABIT FORM SUBMISSION
  const habitForm = document.getElementById('habitForm');
  if (habitForm) {
    habitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('habitInput').value.trim();
      const type = document.getElementById('habitType').value;
      const unit = document.getElementById('habitUnit').value.trim();
      const target = document.getElementById('habitTarget').value;

      if (!title) return alert('Please enter a habit name.');

      // Build payload for database
      const payload = {
        title: title,
        type: type,
        unit: type === 'number' ? unit : null,
        target: type === 'number' ? parseFloat(target) : null
      };

      try {
        const res = await fetch('/api/habits', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          // Reset Form to blank state
          document.getElementById('habitInput').value = '';
          document.getElementById('habitType').value = 'boolean';
          window.toggleNumberInputs(false);
          document.getElementById('presetHealth').selectedIndex = 0;
          document.getElementById('presetTasks').selectedIndex = 0;
          
          // Refresh the lists instantly
          loadHabits();
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to add habit');
        }
      } catch (err) {
        console.error('Submission error:', err);
      }
    });
  }

  // Handle Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/index.html';
    });
  }

  // Load lists on startup
  loadHabits();
});

// 5. RENDER THE SEPARATE HABIT LISTS
async function loadHabits() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const habits = await res.json();

      const booleanList = document.getElementById('booleanHabitList');
      const numberList = document.getElementById('numberHabitList');

      // Sort habits into the two columns
      const tasks = habits.filter(h => h.type === 'boolean');
      const metrics = habits.filter(h => h.type === 'number');

      // HTML template for Daily Tasks (Boolean)
      const renderTask = (h) => `
        <div style="display: flex; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 8px; color: #f8fafc;">
          <span style="font-weight: 500;">${h.title}</span>
          <span style="color: #94a3b8; font-size: 0.85em;">Checklist</span>
        </div>`;

      // HTML template for Health Metrics (Numbers with Units)
      const renderMetric = (h) => `
        <div style="display: flex; justify-content: space-between; padding: 12px; margin-bottom: 8px; background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 8px; color: #f8fafc;">
          <span style="font-weight: 500;">${h.title}</span>
          <span style="color: #34d399; font-weight: bold; font-size: 0.9em;">0 / ${h.target} ${h.unit}</span>
        </div>`;

      // Inject into the DOM
      if (booleanList) {
        booleanList.innerHTML = tasks.length ? tasks.map(renderTask).join('') : '<div style="color: #94a3b8; text-align: center; padding: 10px;">No daily tasks yet.</div>';
      }
      if (numberList) {
        numberList.innerHTML = metrics.length ? metrics.map(renderMetric).join('') : '<div style="color: #94a3b8; text-align: center; padding: 10px;">No health metrics yet.</div>';
      }
    }
  } catch (err) {
    console.error('Error loading habits:', err);
  }
}
