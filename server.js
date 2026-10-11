require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
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
    await pool.query('INSERT INTO users (username, email, password, is_verified) VALUES (?, ?, ?, ?)', [username, email, hashedPassword, true]);
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
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username, email: rows[0].email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '24h' });
    res.json({ token, user: { id: rows[0].id, username: rows[0].username, email: rows[0].email } });
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

// FIXED FOR BREVO
app.post('/api/reminders/test-email', authenticateToken, async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // Must be the Brevo SMTP Key
      }
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: req.user.email,
      subject: 'Sophisticated Tracker - Test Email',
      text: 'Hello! Your Brevo email reminder service is configured correctly.'
    });
    res.json({ message: 'Sent' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
