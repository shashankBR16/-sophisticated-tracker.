document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Display User Name if element exists
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const greetingEl = document.getElementById('userGreeting');
  if (greetingEl && user.username) {
    greetingEl.innerText = `Hi, ${user.username}`;
  }

  // Preset Selectors binding to Habit Name input
  const dailyTaskPreset = document.getElementById('dailyTaskPreset') || document.querySelector('select'); 
  const habitNameInput = document.getElementById('habitName') || document.querySelector('input[type="text"]');

  if (dailyTaskPreset && habitNameInput) {
    dailyTaskPreset.addEventListener('change', (e) => {
      if (e.target.value) {
        habitNameInput.value = e.target.value;
      }
    });
  }

  // Handle Add Habit Form submission
  const addForm = document.getElementById('addHabitForm') || document.querySelector('form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = habitNameInput.value;
      if (!name) return alert('Please enter or select a habit name.');

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
        container.innerHTML = habits.map(h => `<div class="habit-item"><span>${h.name}</span></div>`).join('');
      }
    }
  } catch (err) {
    console.error('Error loading habits:', err);
  }
}
