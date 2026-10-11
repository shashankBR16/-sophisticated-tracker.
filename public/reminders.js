document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) return window.location.href = '/index.html';
  let allHabits = [];
  
  const selects = document.querySelectorAll('select');
  const categorySelect = selects[0];
  const itemSelect = selects[1];
  const timeInput = document.querySelector('input[type="time"]');
  const allButtons = Array.from(document.querySelectorAll('button, a, div'));
  const saveBtn = allButtons.find(el => el.innerText && el.innerText.includes('Save Reminder'));
  const testEmailBtn = allButtons.find(el => el.innerText && el.innerText.includes('Test Email Connection'));

  // FETCH ALL HABITS
  try {
    const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) allHabits = await res.json();
  } catch (err) {
    console.error('Error fetching habits for reminders:', err);
  }

  // BULLETPROOF DROPDOWN FILTER: Uses both 'type' and 'target' to catch older database entries
  function updateItemDropdown() {
    if (!categorySelect || !itemSelect) return;
    
    const catText = (categorySelect.options[categorySelect.selectedIndex].text || "").toLowerCase();
    const catVal = (categorySelect.value || "").toLowerCase();
    
    let filtered = allHabits;
    
    if (catText.includes('task') || catVal.includes('task')) {
      // Tasks are 'boolean' type or have no target
      filtered = allHabits.filter(h => h.type === 'boolean' || h.target === null || h.target === 0);
    } 
    else if (catText.includes('health') || catText.includes('metric') || catVal.includes('health')) {
      // Metrics are 'number' type or have a target > 0
      filtered = allHabits.filter(h => h.type === 'number' || h.target > 0);
    }

    if (filtered.length > 0) {
      itemSelect.innerHTML = filtered.map(h => `<option value="${h.id}">${h.title}</option>`).join('');
    } else {
      itemSelect.innerHTML = '<option value="">No items found</option>';
    }
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', updateItemDropdown);
    // Add a slight delay on initial load to ensure DOM is fully ready
    setTimeout(updateItemDropdown, 100); 
  }

  // SAVE REMINDER LOGIC
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const item_type = categorySelect.options[categorySelect.selectedIndex].text;
      const item_id = itemSelect.value;
      const start_time = timeInput ? timeInput.value : '';

      if (!item_id || !start_time) return alert('Please select an item and time.');
      try {
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ item_type, item_id, start_time })
        });
        if (res.ok) {
          alert('Reminder saved successfully!');
          loadReminders(); 
        } 
      } catch (err) {
        console.error(err);
      }
    });
  }

  // TEST EMAIL LOGIC
  if (testEmailBtn) {
    testEmailBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/reminders/test-email', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
          alert(data.message);
        } else {
          alert('BREVO ERROR:\n' + (data.error || JSON.stringify(data)));
        }
      } catch (err) { 
        alert('Network error connecting to API.'); 
      }
    });
  }

  // FETCH & MOUNT SAVED REMINDERS
  async function loadReminders() {
    try {
      const res = await fetch('/api/reminders', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return;
      const reminders = await res.json();
      
      let container = document.getElementById('remindersDisplayList');
      if (!container) {
        container = document.createElement('div');
        container.id = 'remindersDisplayList';
        container.style.marginTop = '2.5rem';
        container.style.padding = '0 10px';
        const card = document.querySelector('.card');
        if (card) card.appendChild(container);
        else document.body.appendChild(container);
      }

      container.innerHTML = `
        <h3 style="color:#38bdf8; margin-bottom:1rem; border-bottom: 1px solid #334155; padding-bottom: 0.5rem;">Scheduled Reminders</h3>
        ${reminders.length > 0 ? reminders.map(r => `
          <div style="background: rgba(30,41,59,0.8); border: 1px solid #334155; padding: 12px 16px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; color: white;">
            <span><strong style="color: #a78bfa;">${r.title || 'Deleted Habit'}</strong> <span style="color:#64748b; font-size:0.85em;">(${r.item_type})</span></span>
            <span style="color: #34d399; font-weight: bold;">🕒 ${r.start_time}</span>
          </div>
        `).join('') : '<p style="color:#94a3b8;">No reminders set.</p>'}
      `;
    } catch (err) {
      console.error(err);
    }
  }

  loadReminders();
});
