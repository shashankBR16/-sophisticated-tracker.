document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Populate Select Item dropdown from user habits so it doesn't show "No items found"
  const selectItemDropdown = document.getElementById('selectItem') || document.querySelector('select:nth-of-type(2)');
  try {
    const res = await fetch('/api/habits', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const habits = await res.json();
      if (selectItemDropdown) {
        if (habits.length > 0) {
          selectItemDropdown.innerHTML = habits.map(h => `<option value="${h.name}">${h.name}</option>`).join('');
        } else {
          selectItemDropdown.innerHTML = '<option value="">No habits created yet</option>';
        }
      }
    }
  } catch (err) {
    console.error('Failed to load items for reminders:', err);
  }

  // Test Email Button Handler
  const testEmailBtn = document.getElementById('testEmailBtn');
  if (testEmailBtn) {
    testEmailBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/reminders/test-email', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          alert('Test email sent successfully!');
        } else {
          alert(data.error || 'Failed to send test email.');
        }
      } catch (err) {
        alert('Network error sending test email.');
      }
    });
  }
});
