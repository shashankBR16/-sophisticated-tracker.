document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Display User Name correctly
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const greetingEl = document.getElementById('userGreeting') || document.querySelector('h1, h2, span, div');
      if (user.username) {
        // Look specifically for greeting elements or update text containing "Hi"
        const greetingContainer = document.getElementById('userGreeting');
        if (greetingContainer) {
          greetingContainer.innerText = `Hi, ${user.username}`;
        }
      }
    } catch (e) {
      console.error('Error parsing user data', e);
    }
  }

  // Preset Selectors binding with pipe-splitting
  const dailyTaskPreset = document.getElementById('dailyTaskPreset') || document.querySelector('select'); 
  const habitNameInput = document.getElementById('habitName') || document.querySelector('input[type="text"]');

  if (dailyTaskPreset && habitNameInput) {
    dailyTaskPreset.addEventListener('change', (e) => {
      const selectedValue = e.target.value;
      if (selectedValue) {
        // Extract only the name part before the '|' character
        const cleanName = selectedValue.split('|')[0].trim();
        habitNameInput.value = cleanName;
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
          body: JSON.stringify({ name, category: 'Daily', target: 'Done' })
        });

        if (res.ok) {
          habitNameInput.value = '';
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
