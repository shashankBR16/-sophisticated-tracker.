document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Display User Name
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const greetingContainer = document.getElementById('userGreeting') || document.querySelector('h1, h2, span');
      if (greetingContainer && user.username) {
        greetingContainer.innerText = `Hi, ${user.username}`;
      }
    } catch (e) {
      console.error('Error parsing user data', e);
    }
  }

  // Preset Selectors & Input Elements
  const taskPreset = document.getElementById('dailyTaskPreset') || document.querySelectorAll('select')[0];
  const healthPreset = document.getElementById('healthMetricPreset') || document.querySelectorAll('select')[1];
  const habitNameInput = document.getElementById('habitName') || document.querySelector('input[type="text"]');

  let currentPayload = {
    title: '',
    type: 'boolean',
    unit: null,
    target: null
  };

  if (taskPreset && habitNameInput) {
    taskPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        const parts = val.split('|');
        currentPayload = {
          title: parts[0].trim(),
          type: parts[1] || 'boolean',
          unit: parts[2] || null,
          target: parts[3] ? parseFloat(parts[3]) : null
        };
        habitNameInput.value = currentPayload.title;
        if (healthPreset) healthPreset.selectedIndex = 0;
      }
    });
  }

  if (healthPreset && habitNameInput) {
    healthPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        const parts = val.split('|');
        currentPayload = {
          title: parts[0].trim(),
          type: parts[1] || 'number',
          unit: parts[2] || null,
          target: parts[3] ? parseFloat(parts[3]) : null
        };
        habitNameInput.value = currentPayload.title;
        if (taskPreset) taskPreset.selectedIndex = 0;
      }
    });
  }

  if (habitNameInput) {
    habitNameInput.addEventListener('input', (e) => {
      currentPayload.title = e.target.value.trim();
    });
  }

  // Handle Add Habit Form submission
  const addForm = document.getElementById('addHabitForm') || document.querySelector('form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentPayload.title && habitNameInput) {
        currentPayload.title = habitNameInput.value.trim();
      }

      if (!currentPayload.title) {
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
          body: JSON.stringify(currentPayload)
        });

        if (res.ok) {
          if (habitNameInput) habitNameInput.value = '';
          currentPayload = { title: '', type: 'boolean', unit: null, target: null };
          if (taskPreset) taskPreset.selectedIndex = 0;
          if (healthPreset) healthPreset.selectedIndex = 0;
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
        container.innerHTML = habits.map(h => `<div class="habit-item"><span>${h.title}</span> (${h.type})</div>`).join('');
      }
    }
  } catch (err) {
    console.error('Error loading habits:', err);
  }
}
