// --- 1. SIGN IN PAGE LOGIC (index.html) ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('loginError');
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    errorMsg.innerText = '';
    submitBtn.disabled = true;
    submitBtn.innerText = 'Signing In...';
    
    const emailOrUsername = document.getElementById('loginId').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: emailOrUsername, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
      } else {
        errorMsg.innerText = data.error;
        submitBtn.disabled = false;
        submitBtn.innerText = 'Sign In';
      }
    } catch(err) { 
      errorMsg.innerText = "Connection error."; 
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In';
    }
  });
}

// --- 2. SIGN UP PAGE LOGIC (register.html) ---
const registerForm = document.getElementById('registerForm');
const verifyForm = document.getElementById('verifyForm');
let registeringEmail = ''; 

if (registerForm && verifyForm) {
  
  // Step 1: Create Account & Trigger Email PIN
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('regError');
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    
    errorMsg.innerText = '';
    submitBtn.disabled = true; // Prevents double-click ghost errors
    submitBtn.innerText = 'Sending PIN...';
    
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        errorMsg.innerText = ''; // Force clear text
        registeringEmail = email;
        registerForm.style.display = 'none';
        document.getElementById('footerLink').style.display = 'none';
        document.getElementById('regTitle').innerText = 'Verify Email';
        verifyForm.style.display = 'flex';
      } else {
        errorMsg.innerText = data.error;
        submitBtn.disabled = false;
        submitBtn.innerText = 'Register';
      }
    } catch(err) { 
      errorMsg.innerText = "Connection error."; 
      submitBtn.disabled = false;
      submitBtn.innerText = 'Register';
    }
  });

  // Step 2: Verify PIN & Auto-Login to Dashboard
  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('regError');
    const verifyBtn = verifyForm.querySelector('button[type="submit"]');
    
    errorMsg.innerText = '';
    verifyBtn.disabled = true;
    verifyBtn.innerText = 'Verifying...';
    
    const pin = document.getElementById('pinInput').value;

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeringEmail, pin })
      });
      const data = await res.json();
      
      if (res.ok) {
        // Boom! Instantly log them in and route directly to the dashboard
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
      } else {
        errorMsg.innerText = data.error;
        verifyBtn.disabled = false;
        verifyBtn.innerText = 'Verify & Activate';
      }
    } catch(err) { 
      errorMsg.innerText = "Connection error."; 
      verifyBtn.disabled = false;
      verifyBtn.innerText = 'Verify & Activate';
    }
  });
}
