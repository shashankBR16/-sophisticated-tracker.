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

  // Preset Selectors (Daily Tasks & Health Metrics)
  const taskPreset = document.getElementById('dailyTaskPreset') || document.querySelectorAll('select')[0];
  const healthPreset = document.getElementById('healthMetricPreset') || document.querySelectorAll('select')[1];
  const habitNameInput = document.getElementById('habitName') || document.querySelector('input[type="text"]');

  let selectedCategory = 'Daily';

  if (taskPreset && habitNameInput) {
    taskPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        habitNameInput.value = val.split('|')[0].trim();
        selectedCategory = 'Daily';
        if (healthPreset) healthPreset.selectedIndex = 0; // Reset other dropdown
      }
    });
  }

  if (healthPreset && habitNameInput) {
    healthPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        habitNameInput.value = val.split('|')[0].trim();
        selectedCategory = 'Health';
        if (taskPreset) taskPreset.selectedIndex = 0; // Reset other dropdown
      }
    });
  }

  // Handle Add Habit Form submission
  const addForm = document.getElementById('addHabitForm') || document.querySelector('form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = habitNameInput.value.trim();
      if (!name) {
        alert('Please select or enter a habit name.');
        return;
      }

      try {
        const res = await fetch('/api/habits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, category: selectedCategory, target: 'Done' })
        });

        if (res.ok) {
          habitNameInput.value = '';
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
        container.innerHTML = habits.map(h => `<div class="habit-item"><span>${h.name || h.habit_name}</span></div>`).join('');
      }
    }
  } catch (err) {
    console.error('Error loading habits:', err);
  }
}
