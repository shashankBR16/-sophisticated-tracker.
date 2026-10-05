const token = localStorage.getItem('token');
if (!token) window.location.href = '/index.html';

let allHabits = [];

// TEST EMAIL BUTTON LOGIC
document.getElementById('testEmailBtn').addEventListener('click', async () => {
  const resultText = document.getElementById('testEmailResult');
  resultText.style.color = '#fbbf24';
  resultText.innerText = 'Attempting to log into Gmail... Please wait.';
  
  try {
    const res = await fetch('/api/test-email', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok) {
      resultText.style.color = '#34d399';
      resultText.innerText = 'SUCCESS! Check your Gmail inbox right now for the test email.';
    } else {
      resultText.style.color = '#ef4444';
      resultText.innerText = `ERROR: ${data.error} (Check your .env App Password)`;
    }
  } catch (err) {
    resultText.style.color = '#ef4444';
    resultText.innerText = 'Network error attempting to send email.';
  }
});

async function loadRemindersData() {
  const res = await fetch('/api/habits', { headers: { 'Authorization': `Bearer ${token}` } });
  allHabits = await res.json();
  
  const select = document.getElementById('habitSelect');
  select.innerHTML = '<option value="">-- Choose a Habit --</option>';
  
  const activeList = document.getElementById('activeRemindersList');
  activeList.innerHTML = '';

  let hasActive = false;

  allHabits.forEach(h => {
    // Populate Dropdown
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.dataset.type = h.type;
    opt.innerText = h.title;
    select.appendChild(opt);

    // Populate Active Reminders list
    if (h.reminder_time) {
      hasActive = true;
      const card = document.createElement('div');
      card.className = 'reminder-card';
      
      let details = `Start: ${h.reminder_time}`;
      if (h.type === 'number' && h.reminder_count) {
        details += ` | ${h.reminder_count}x daily (Gap: ${h.reminder_frequency} mins)`;
      }

      card.innerHTML = `
        <div>
          <h4 style="color: #f8fafc; margin: 0 0 5px 0;">${h.title}</h4>
          <p style="color: #94a3b8; font-size: 0.85rem; margin: 0;">${details}</p>
        </div>
        <button onclick="clearReminder(${h.id})" style="background: none; border: none; color: #ef4444; font-size: 1.2rem; cursor: pointer;">✕</button>
      `;
      activeList.appendChild(card);
    }
  });

  if (!hasActive) {
    activeList.innerHTML = '<p style="color: #94a3b8; text-align: center;">No active reminders set.</p>';
  }
}

document.getElementById('habitSelect').addEventListener('change', function() {
  const selectedOption = this.options[this.selectedIndex];
  const type = selectedOption.dataset.type;
  const repeatSettings = document.getElementById('repeatSettings');
  const countInput = document.getElementById('reminderCount');

  if (type === 'number') {
    repeatSettings.style.display = 'flex';
    countInput.setAttribute('required', 'true');
  } else {
    repeatSettings.style.display = 'none';
    countInput.removeAttribute('required');
  }
});

document.getElementById('reminderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const select = document.getElementById('habitSelect');
  const id = select.value;
  const type = select.options[select.selectedIndex].dataset.type;
  
  let h = parseInt(document.getElementById('startHour').value);
  let m = parseInt(document.getElementById('startMin').value);
  let ampm = document.getElementById('startAmPm').value;
  
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  
  const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;

  const gapH = parseInt(document.getElementById('gapHours').value) || 0;
  const gapM = parseInt(document.getElementById('gapMins').value) || 0;
  const totalGapMins = (gapH * 60) + gapM;
  
  const payload = {
    time: timeStr,
    frequency_mins: type === 'number' ? totalGapMins : null,
    count: type === 'number' ? document.getElementById('reminderCount').value : null
  };

  try {
    await fetch(`/api/habits/${id}/reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    document.getElementById('reminderForm').reset();
    document.getElementById('repeatSettings').style.display = 'none';
    loadRemindersData();
  } catch (err) { alert('Failed to set reminder.'); }
});

window.clearReminder = async function(id) {
  try {
    await fetch(`/api/habits/${id}/reminder/clear`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    loadRemindersData();
  } catch (err) { alert('Failed to delete reminder.'); }
};

loadRemindersData();
