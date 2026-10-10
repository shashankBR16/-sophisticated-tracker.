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

// Database Connection Pool using environment variables
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

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, email, password, is_verified) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, true]
    );
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'User not found.' });

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password.' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HABITS ROUTES ---
app.get('/api/habits', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM habits WHERE user_id = ?', [req.user.id]);
    // Map habit_name to name for frontend compatibility
    const formattedRows = rows.map(h => ({
      ...h,
      name: h.habit_name || h.name
    }));
    res.json(formattedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/habits', authenticateToken, async (req, res) => {
  try {
    const { name, category, target } = req.body;
    await pool.query(
      'INSERT INTO habits (user_id, habit_name, category, target) VALUES (?, ?, ?, ?)',
      [req.user.id, name, category || 'Daily', target || 'Done']
    );
    res.status(201).json({ message: 'Habit added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TEST EMAIL ROUTE ---
app.post('/api/reminders/test-email', authenticateToken, async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: req.user.email,
      subject: 'Sophisticated Tracker - Test Email',
      text: 'Hello! Your email reminder service is configured correctly.'
    });

    res.json({ message: 'Test email sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
});

// --- START SERVER ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
