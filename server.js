require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serves your HTML files

// --- DATABASE CONNECTION (Aiven Cloud SSL Enabled) ---
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- BREVO EMAIL API SETUP ---
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
      console.log('Email successfully sent through Brevo!');
    } else {
      console.error('Email failed to send:', await response.text());
    }
  } catch (error) {
    console.error('Email API Error:', error);
  }
};

// --- AUTHENTICATION MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- AUTH ROUTES ---

// 1. Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    await pool.execute(
      'INSERT INTO users (username, email, password, role, verification_pin, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
      [req.body.username, req.body.email, hashedPassword, 'user', pin, false]
    );

    // Send the PIN via email
    await sendEmail(
      req.body.email, 
      "Welcome to Sophisticated Tracker", 
      `Your account has been successfully created! Your 6-digit verification PIN is: ${pin}`
    );

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    console.error("REGISTRATION CRASH REASON:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Username or Email already exists.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 2. Verify Email PIN
app.post('/api/auth/verify', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? AND verification_pin = ?', [req.body.email, req.body.pin]);
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid PIN' });

    await pool.execute('UPDATE users SET is_verified = true, verification_pin = NULL WHERE email = ?', [req.body.email]);
    res.json({ success: true, message: 'Account verified!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    // This safely grabs the input whether your frontend calls it 'username' or 'email'
    const loginID = req.body.username || req.body.email; 
    
    if (!loginID) {
      return res.status(400).json({ error: 'Please enter your username or email.' });
    }

    // Checks both columns in the database
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?', 
      [loginID, loginID]
    );
    
    if (rows.length === 0) return res.status(400).json({ error: 'User not found.' });

    const user = rows[0];
    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password.' });
    if (!user.is_verified) return res.status(403).json({ error: 'Please verify your email first.' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, email: user.email }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
