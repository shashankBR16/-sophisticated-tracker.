require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const https = require('https'); // Added native https for Brevo API
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    // Auto-assign 'admin' role if the username is shashank
    const role = username.toLowerCase() === 'shashank' ? 'admin' : 'user';
    await pool.query('INSERT INTO users (username, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)', [username, email, hashedPassword, role, true]);
    res.status(201).json({ message: 'User registered' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (rows.length === 0) return res.status(400).json({ error: 'User not found.' });
    const validPassword = await bcrypt.compare(password, rows[0].password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password.' });
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username, email: rows[0].email, role: rows[0].role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '24h' });
    res.json({ token, user: { id: rows[0].id, username: rows[0].username, email: rows[0].email, role: rows[0].role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- HABITS ROUTES ---
app.get('/api/habits', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM habits WHERE user_id = ?', [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/habits', authenticateToken, async (req, res) => {
  try {
    const { title, type, unit, target } = req.body;
    const [existing] = await pool.query('SELECT * FROM habits WHERE user_id = ? AND title = ?', [req.user.id, title]);
    if (existing.length > 0) return res.status(400).json({ error: 'Habit already exists.' });
    await pool.query('INSERT INTO habits (user_id, title, type, unit, target) VALUES (?, ?, ?, ?, ?)', [req.user.id, title, type || 'boolean', unit || null, target || null]);
    res.status(201).json({ message: 'Habit added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/habits/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM habits WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REMINDERS ROUTES ---
app.get('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT r.*, h.title FROM reminders r LEFT JOIN habits h ON r.item_id = h.id WHERE r.user_id = ? ORDER BY r.start_time ASC', [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reminders', authenticateToken, async (req, res) => {
  try {
    const { item_type, item_id, start_time } = req.body;
    await pool.query('INSERT INTO reminders (user_id, item_type, item_id, start_time) VALUES (?, ?, ?, ?)', [req.user.id, item_type, item_id, start_time]);
    res.status(201).json({ message: 'Saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CRITICAL FIX: CLEAN BREVO API CALL
app.post('/api/reminders/test-email', authenticateToken, async (req, res) => {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.EMAIL_PASS,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_USER },
        to: [{ email: req.user.email }],
        subject: 'Sophisticated Tracker - Test Email',
        textContent: 'Hello! Your Brevo API email reminder service is working perfectly.'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      res.json({ message: 'Test email sent successfully via API!' });
    } else {
      // Sends the exact Brevo error back to your screen
      res.status(400).json({ error: data.message || JSON.stringify(data) });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server network error: ' + err.message });
  }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  // Double-check security on the backend
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admins only' });
  
  try {
    // Fetches all users and counts how many habits they have created
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.email, COUNT(h.id) as habit_count 
      FROM users u 
      LEFT JOIN habits h ON u.id = h.user_id 
      GROUP BY u.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admins only' });
  try {
    // Deleting the user will automatically delete their habits due to MySQL ON DELETE CASCADE
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
