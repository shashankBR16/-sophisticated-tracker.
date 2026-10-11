document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) return window.location.href = '/index.html';

  let allHabits = [];
  
  // Connect to HTML Elements
  const selects = document.querySelectorAll('select');
  const categorySelect = selects[0];
  const itemSelect = selects[1];
  const timeInput = document.querySelector('input[type="time"]');
  
  // Find buttons by their text
  const allButtons = Array.from(document.querySelectorAll('button, a, div'));
  const saveBtn = allButtons.find(el => el.innerText && el.innerText.includes('Save Reminder'));
  const testEmailBtn = allButtons.find(el => el.innerText && el.innerText.includes('Test Email Connection'));

  // Fetch all user habits to populate the dropdowns
  try {
    const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) allHabits = await res.json();
  } catch (err) {
    console.error(err);
  }

  // Filter dropdown based on Category selected
  function updateItemDropdown() {
    if (!categorySelect || !itemSelect) return;
    const category = categorySelect.value.toLowerCase();
    let filtered = allHabits;
    
    if (category.includes('task')) {
      filtered = allHabits.filter(h => h.type === 'boolean');
    } else if (category.includes('health') || category.includes('metric')) {
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

  // Handle Save Reminder
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const item_type = categorySelect.value;
      const item_id = itemSelect.value;
      const start_time = timeInput ? timeInput.value : '';

      if (!item_id || !start_time) return alert('Please select an item and set a time.');

      try {
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ item_type, item_id, start_time })
        });

        if (res.ok) {
          alert('Reminder saved successfully!');
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to save reminder');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Handle Test Email
  if (testEmailBtn) {
    testEmailBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/reminders/test-email', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          alert('Test email sent! Check your inbox.');
        } else {
          alert('Failed to send email. Check your Render Environment Variables for EMAIL_USER and EMAIL_PASS.');
        }
      } catch (err) {
        alert('Network error connecting to email server.');
      }
    });
  }
});
