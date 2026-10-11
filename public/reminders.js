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

  try {
    const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) allHabits = await res.json();
  } catch (err) {}

  // FIXED: Now checks the visible text of the dropdown instead of the hidden value
  function updateItemDropdown() {
    if (!categorySelect || !itemSelect) return;
    const categoryText = categorySelect.options[categorySelect.selectedIndex].text.toLowerCase();
    
    let filtered = allHabits;
    if (categoryText.includes('task')) {
      filtered = allHabits.filter(h => h.type === 'boolean');
    } else if (categoryText.includes('health') || categoryText.includes('metric')) {
      filtered = allHabits.filter(h => h.type === 'number');
    }

    if (filtered.length > 0) {
      itemSelect.innerHTML = filtered.map(h => `<option value="${h.id}">${h.title}</option>`).join('');
    } else {
      itemSelect.innerHTML = '<option value="">No items found</option>';
    }
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', updateItemDropdown);
    updateItemDropdown(); 
  }

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
      } catch (err) {}
    });
  }

  if (testEmailBtn) {
    testEmailBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/reminders/test-email', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
          alert('Test email sent successfully! Check your inbox.');
        } else {
          // This will now show EXACTLY what Brevo is complaining about
          alert('BREVO ERROR: ' + (data.error || JSON.stringify(data)));
        }
      } catch (err) { alert('Network error connecting to API.'); }
    });
  }

  async function loadReminders() {
    try {
      const res = await fetch('/api/reminders', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) return;
      const reminders = await res.json();
      
      let container = document.getElementById('remindersDisplayList');
      if (!container) {
        container = document.createElement('div');
        container.id = 'remindersDisplayList';
        container.style.marginTop = '2rem';
        const card = document.querySelector('.card');
        if (card) card.appendChild(container);
        else document.body.appendChild(container);
      }

      container.innerHTML = `
        <h3 style="color:#38bdf8; margin-bottom:1rem; border-bottom: 1px solid #334155; padding-bottom: 0.5rem;">Scheduled Reminders</h3>
        ${reminders.length > 0 ? reminders.map(r => `
          <div style="background: rgba(30,41,59,0.8); border: 1px solid #334155; padding: 12px 16px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; color: white;">
            <span><strong style="color: #a78bfa;">${r.title || 'Habit'}</strong> <span style="color:#64748b; font-size:0.85em;">(${r.item_type})</span></span>
            <span style="color: #34d399; font-weight: bold;">🕒 ${r.start_time}</span>
          </div>
        `).join('') : '<p style="color:#94a3b8;">No reminders set.</p>'}
      `;
    } catch (err) {}
  }

  loadReminders();
});
