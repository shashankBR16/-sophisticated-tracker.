document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Display User Greeting
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const greetingEl = document.getElementById('userGreeting');
      if (greetingEl && user.username) {
        greetingEl.innerText = `Hi, ${user.username}`;
      }
    } catch (e) {
      console.error('Error parsing user data', e);
    }
  }

  // Elements
  const habitNameInput = document.getElementById('habitName') || document.querySelector('input[type="text"]');
  const taskPreset = document.getElementById('dailyTaskPreset') || document.querySelectorAll('select')[0];
  const healthPreset = document.getElementById('healthMetricPreset') || document.querySelectorAll('select')[1];
  const addForm = document.getElementById('addHabitForm') || document.querySelector('form');

  let habitData = {
    title: '',
    type: 'boolean',
    unit: null,
    target: null
  };

  // Handle Daily Task Preset Selection
  if (taskPreset && habitNameInput) {
    taskPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        const parts = val.split('|');
        habitData = {
          title: parts[0].trim(),
          type: parts[1] || 'boolean',
          unit: parts[2] || null,
          target: parts[3] ? parseFloat(parts[3]) : null
        };
        habitNameInput.value = habitData.title;
        if (healthPreset) healthPreset.selectedIndex = 0;
      }
    });
  }

  // Handle Health Metric Preset Selection (captures units and targets)
  if (healthPreset && habitNameInput) {
    healthPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        const parts = val.split('|');
        habitData = {
          title: parts[0].trim(),
          type: parts[1] || 'number',
          unit: parts[2] || null,
          target: parts[3] ? parseFloat(parts[3]) : null
        };
        habitNameInput.value = habitData.title;
        if (taskPreset) taskPreset.selectedIndex = 0;
      }
    });
  }

  // Manual typing override
  if (habitNameInput) {
    habitNameInput.addEventListener('input', (e) => {
      habitData.title = e.target.value.trim();
      if (!habitData.unit) habitData.type = 'boolean';
    });
  }

  // Form Submission
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (habitNameInput) {
        habitData.title = habitNameInput.value.trim();
      }

      if (!habitData.title) {
        alert('Please enter or select a habit name.');
        return;
      }

      try {
        const res = await fetch('/api/habits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(habitData)
        });

        if (res.ok) {
          if (habitNameInput) habitNameInput.value = '';
          habitData = { title: '', type: 'boolean', unit: null, target: null };
          if (taskPreset) taskPreset.selectedIndex = 0;
          if (healthPreset) healthPreset.selectedIndex = 0;
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

  loadHabits();
});

async function loadHabits() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/habits', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const habits = await res.json();
      const container = document.getElementById('habitsContainer');
      if (container) {
        container.innerHTML = habits.map(h => `
          <div class="habit-item" style="padding: 10px; margin-bottom: 5px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <strong>${h.title}</strong> ${h.unit ? `(${h.target}${h.unit})` : ''}
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading habits:', err);
  }
}
