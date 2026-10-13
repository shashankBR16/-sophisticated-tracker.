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

window.togglePasswordVisibility = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  btn.innerHTML = isPassword
    ? `<svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>`
    : `<svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>`;
};
