document.addEventListener('DOMContentLoaded', () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    window.location.href = '/index.html';
    return;
  }
  
  const user = JSON.parse(userStr);
  
  // STRICT SECURITY: Only allows access if the database explicitly gave them the 'admin' role
  if (user.role !== 'admin') {
    alert('Access Denied: You do not have administrator privileges.');
    window.location.href = '/dashboard.html';
  }
});
