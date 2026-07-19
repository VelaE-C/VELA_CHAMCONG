// ============================================================
// VELA_CHAMCONG — auth.js
// Google OAuth, session management, role check
// ============================================================

function loginGoogle() {
  const redirectTo = encodeURIComponent(CFG.APP_URL);
  window.location.href = `${CFG.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
}

async function doLogout() {
  try {
    await fetch(`${CFG.SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'apikey': CFG.SUPABASE_KEY, 'Authorization': `Bearer ${STATE.session?.access_token}` }
    });
  } catch(e) {}
  localStorage.removeItem('vela_session');
  Object.assign(STATE, { session: null, currentUser: null, projects: [], users: [], checkedInToday: false, todayAttId: null, mode: 'checkin' });
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginMsg').textContent = '';
}

async function checkAuth() {
  // Handle Google OAuth callback (hash fragment)
  const hash = window.location.hash;
  if (hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1));
    try {
      const session = { access_token: params.get('access_token'), refresh_token: params.get('refresh_token'), user: null };
      const res = await fetch(`${CFG.SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': CFG.SUPABASE_KEY, 'Authorization': `Bearer ${session.access_token}` }
      });
      session.user = await res.json();
      STATE.session = session;
      localStorage.setItem('vela_session', JSON.stringify(session));
      window.history.replaceState(null, '', window.location.pathname);
      return true;
    } catch(e) { console.error(e); return false; }
  }
  // Restore saved session
  const saved = localStorage.getItem('vela_session');
  if (saved) {
    try { STATE.session = JSON.parse(saved); return true; } catch(e) {}
  }
  return false;
}

async function loadCurrentUser() {
  const email = STATE.session?.user?.email;
  if (!email) throw new Error('Không có email trong session');
  const users = await sbFetch(`users?email=eq.${encodeURIComponent(email)}&is_active=eq.true&limit=1`);
  if (!users.length) {
    // Not in whitelist
    await doLogout();
    document.getElementById('loginMsg').textContent = `❌ Tài khoản ${email} chưa được cấp quyền. Liên hệ Admin.`;
    throw new Error('Unauthorized');
  }
  STATE.currentUser = users[0];
  return users[0];
}

function isAdmin()      { return ['superadmin'].includes(STATE.currentUser?.role); }
function isSiteAdmin()  { return ['superadmin','site_admin'].includes(STATE.currentUser?.role); }
function canViewAdmin() { return isSiteAdmin(); }
