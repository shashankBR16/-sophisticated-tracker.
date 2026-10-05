require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,          // Make sure this is included
  ssl: {
    rejectUnauthorized: false         // This is the mandatory Aiven SSL bypass
  }
});


const sendEmail = async (toEmail, subject, textContent) => {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_USER, name: 'Sophisticated Tracker' },
        to: [{ email: toEmail }],
        subject: subject,
        textContent: textContent
      })
    });
    
    if (response.ok) {
      console.log('Email successfully sent through Brevo API!');
    } else {
      console.error('Email failed to send:', await response.text());
    }
  } catch (error) {
    console.error('Email API Error:', error);
  }
};


function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.execute(
  'INSERT INTO users (username, email, password, role, verification_pin, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
  [req.body.username, req.body.email, hashedPassword, 'user', pin, false]
);

    await sendEmail(req.body.email, "Welcome to Sophisticated Tracker", "Your account has been successfully created!"); 

    res.status(201).json({ message: 'User registered.' });
    } catch (err) {
    console.error("REGISTRATION CRASH REASON:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Username or Email already exists.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }

});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? AND verification_pin = ?', [req.body.email, req.body.pin]);
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid PIN.' });
    const user = rows[0];
    await pool.execute('UPDATE users SET is_verified = TRUE, verification_pin = NULL WHERE email = ?', [req.body.email]);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? OR username = ?', [req.body.email, req.body.email]);
    if (rows.length === 0) return res.status(400).json({ error: 'User not found' });
    const user = rows[0];
    if (!user.is_verified) return res.status(403).json({ error: 'Account not verified.' });
    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NEW: TEST EMAIL ROUTE ---
app.post('/api/test-email', authenticateToken, async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Sophisticated Tracker" <${process.env.EMAIL_USER}>`,
      to: req.user.email,
      subject: 'Test Connection Successful 🟢',
      html: '<h2 style="color: #34d399;">Your email connection is working perfectly!</h2>'
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- HABIT ROUTES ---
app.get('/api/habits', authenticateToken, async (req, res) => {
  try {
    const [habits] = await pool.execute(`SELECT h.id, h.title, h.type, h.unit, h.target, h.reminder_time, h.reminder_frequency, h.reminder_count, COALESCE(l.quantity, 0) AS current_qty FROM habits h LEFT JOIN habit_logs l ON h.id = l.habit_id AND l.completed_date = CURDATE() WHERE h.user_id = ?`, [req.user.id]);
    res.json(habits);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/habits', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.execute('INSERT INTO habits (user_id, title, type, unit, target) VALUES (?, ?, ?, ?, ?)', [req.user.id, req.body.title, req.body.type, req.body.unit || '', req.body.target || 0]);
    res.status(201).json({ id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/habits/:id/update', authenticateToken, async (req, res) => {
  const qty = parseFloat(req.body.quantity);
  try {
    if (qty === 0 || isNaN(qty)) await pool.execute('DELETE FROM habit_logs WHERE habit_id = ? AND completed_date = CURDATE()', [req.params.id]);
    else await pool.execute(`INSERT INTO habit_logs (habit_id, user_id, completed_date, quantity) VALUES (?, ?, CURDATE(), ?) ON DUPLICATE KEY UPDATE quantity = ?`, [req.params.id, req.user.id, qty, qty]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/habits/:id', authenticateToken, async (req, res) => {
  try {
    await pool.execute('DELETE FROM habits WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/habits/stats/monthly', authenticateToken, async (req, res) => {
  try {
    const [habits] = await pool.execute('SELECT id, title, type, unit, target FROM habits WHERE user_id = ?', [req.user.id]);
    const [logs] = await pool.execute(`SELECT habit_id, DATE_FORMAT(completed_date, '%Y-%m-%d') as date, quantity FROM habit_logs WHERE user_id = ? AND completed_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`, [req.user.id]);
    res.json({ habits, logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REMINDER ROUTES ---
app.post('/api/habits/:id/reminder', authenticateToken, async (req, res) => {
  const { time, frequency_mins, count } = req.body;
  try {
    await pool.execute('UPDATE habits SET reminder_time = ?, reminder_frequency = ?, reminder_count = ? WHERE id = ? AND user_id = ?', [time, frequency_mins, count, req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/habits/:id/reminder/clear', authenticateToken, async (req, res) => {
  try {
    await pool.execute('UPDATE habits SET reminder_time = NULL, reminder_frequency = NULL, reminder_count = NULL WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  try {
    const [users] = await pool.execute(`
      SELECT u.id, u.username, u.email, u.role, u.created_at, COUNT(DISTINCT h.id) AS total_habits
      FROM users u LEFT JOIN habits h ON u.id = h.user_id GROUP BY u.id ORDER BY u.id ASC
    `);
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  if (req.params.id == req.user.id) return res.status(400).json({ error: "Cannot delete yourself." });
  try {
    await pool.execute('DELETE FROM habit_logs WHERE user_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM habits WHERE user_id = ?', [req.params.id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User removed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/users/:id/habits', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  try {
    const [habits] = await pool.execute('SELECT id, title, type, unit, target FROM habits WHERE user_id = ?', [req.params.id]);
    const [logs] = await pool.execute(`SELECT habit_id, DATE_FORMAT(completed_date, '%Y-%m-%d') as date, quantity FROM habit_logs WHERE user_id = ? AND completed_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`, [req.params.id]);
    res.json({ habits, logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



// --- AUTOMATED EMAIL ENGINE ---
setInterval(async () => {
  // FORCE Node.js to use Indian Standard Time (IST) regardless of Windows/WSL settings
  const now = new Date();
  const istString = now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
  const istTime = new Date(istString);
  
  const currentHour = istTime.getHours();
  const currentMinute = istTime.getMinutes();

  try {
    const [habits] = await pool.execute(`SELECT h.*, u.email, u.username FROM habits h JOIN users u ON h.user_id = u.id WHERE h.reminder_time IS NOT NULL`);
    
    habits.forEach(habit => {
      const timeParts = habit.reminder_time.split(':');
      if (timeParts.length < 2) return;
      const startH = parseInt(timeParts[0]);
      const startM = parseInt(timeParts[1]);
      let shouldSend = false;
      let currentIteration = 0;

      if (habit.type === 'boolean') {
        if (currentHour === startH && currentMinute === startM) shouldSend = true;
      } else if (habit.type === 'number' && habit.reminder_frequency && habit.reminder_count) {
        for (let i = 0; i < habit.reminder_count; i++) {
          let totalMins = (startH * 60) + startM + (i * habit.reminder_frequency);
          let targetH = Math.floor(totalMins / 60) % 24;
          let targetM = totalMins % 60;
          if (currentHour === targetH && currentMinute === targetM) {
            shouldSend = true;
            currentIteration = i + 1;
            break;
          }
        }
      }

      if (shouldSend) {
        let emailHtml = `<div style="padding: 20px; background-color: #0f172a; color: #f8fafc; text-align: center; border-radius: 10px;"><h2 style="color: #38bdf8;">Task Reminder: ${habit.title}</h2><p style="font-size: 1.1rem; color: #94a3b8;">Hi ${habit.username}, time to check off your task.</p></div>`;
        if (habit.type === 'number') {
          const qtyPerReminder = (habit.target / habit.reminder_count).toFixed(2);
          emailHtml = `<div style="padding: 20px; background-color: #0f172a; color: #f8fafc; text-align: center; border-radius: 10px;"><h2 style="color: #34d399;">Health Goal: ${habit.title}</h2><p style="color: #94a3b8;">Reminder ${currentIteration} of ${habit.reminder_count}</p><h1 style="color: #38bdf8; font-size: 2.5rem; margin: 10px 0;">Complete: ${qtyPerReminder} ${habit.unit}</h1><p style="color: #94a3b8;">Stay on pace for your daily goal of ${habit.target} ${habit.unit}!</p></div>`;
        }
        transporter.sendMail({
          from: `"Sophisticated Tracker" <${process.env.EMAIL_USER}>`,
          to: habit.email,
          subject: `🔔 Time for ${habit.title}!`,
          html: emailHtml
        }).catch(err => console.error("Reminder email failed:", err));
      }
    });
  } catch(err) { console.error("Timer Error:", err); }
}, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
