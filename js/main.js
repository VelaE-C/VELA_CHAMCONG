// ============================================================
// VELA_CHAMCONG — main.js
// Bootstrap: auth check → loadApp() → navigate()
// ============================================================

// ── Navigation ──
const NAV_PAGES = {
  checkin:    { label: 'Chấm Công',       icon: '⏱', adminOnly: false, role: null },
  mytable:    { label: 'Bảng Công Tôi',   icon: '📋', adminOnly: false, role: null },
  requests:   { label: 'Bù Công',         icon: '📤', adminOnly: false, role: null },
  teamtable:  { label: 'Bảng Công Nhóm',  icon: '👥', adminOnly: true,  role: null },
  approvals:  { label: 'Phê Duyệt',       icon: '✅', adminOnly: false, role: 'cht' },
  quanso:     { label: 'Báo Cáo Quân Số', icon: '👷', adminOnly: false, role: null },
  projects:   { label: 'Dự Án',           icon: '🗂', adminOnly: true,  role: null },
  users:      { label: 'Nhân Sự',         icon: '👤', adminOnly: true,  role: null },
  adjust:     { label: 'Điều Chỉnh',      icon: '✏️', adminOnly: true,  role: null },
  warnings:   { label: 'Cảnh Báo',        icon: '⚠️', adminOnly: true,  role: null },
  laborsummary: { label: 'Tổng Hợp Nhân Công', icon: '📊', adminOnly: true, role: null },
};

// Phân quyền truy cập từng page
const PAGE_PERMISSIONS = {
  checkin:   () => true,
  mytable:   () => true,
  requests:  () => true,
  quanso:    () => true,
  approvals: () => isCHT() || canViewAdmin(),
  teamtable: () => canViewAdmin(),
  projects:  () => canViewAdmin(),
  users:     () => canViewAdmin(),
  adjust:    () => canViewAdmin(),
  warnings:  () => canViewAdmin(),
  laborsummary: () => canViewAdmin(),
};

function navigate(pageId) {
  // Kiểm tra quyền truy cập
  const check = PAGE_PERMISSIONS[pageId];
  if (check && !check()) {
    showToast('❌ Bạn không có quyền truy cập trang này');
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add('active');

  // Update sidebar
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });

  // Full-width for teamtable
  const contentEl = document.querySelector('.content');
  if (contentEl) {
    contentEl.style.padding = pageId === 'teamtable' ? '0' : '';
  }

  // Page init hooks
  const hooks = {
    teamtable: () => { /* auto-load handled by user */ },
    adjust:    () => initAdjust(),
    quanso:    () => initQuanSo(),
    warnings:  () => loadWarnings(),
    users:     () => { renderUserList(); },
    projects:  () => { renderProjectList(); },
    requests:  () => initRequests(),
    approvals: () => initApprovals(),
    laborsummary: () => initLaborSummary(),
  };
  if (hooks[pageId]) hooks[pageId]();
}

// ── Build sidebar and bottom nav ──
function buildNav() {
  const sidebarEl = document.getElementById('sidebarNav');
  const bottomEl  = document.getElementById('bottomNav');
  const admin     = canViewAdmin();

  const groups = [
    { label: 'CHẤM CÔNG', pages: ['checkin', 'mytable', 'requests', 'teamtable', 'quanso'] },
    { label: 'DUYỆT CÔNG', pages: ['approvals'] },
    { label: 'QUẢN LÝ',   pages: ['projects', 'users', 'adjust', 'warnings', 'laborsummary'] },
  ];

  let sidebarHtml = '';
  groups.forEach(g => {
    const visiblePages = g.pages.filter(p => {
      const page = NAV_PAGES[p];
      if (!page) return false;
      // 'cht' role: show approvals page
      if (page.role === 'cht') return isCHT() || admin;
      // admin-only pages
      if (page.adminOnly) return admin;
      return true;
    });
    if (!visiblePages.length) return;
    sidebarHtml += `<div class="sidebar-group-label">${g.label}</div>`;
    visiblePages.forEach(p => {
      sidebarHtml += `<button class="sidebar-item" data-page="${p}" onclick="navigate('${p}')">
        <span class="icon">${NAV_PAGES[p].icon}</span>
        ${NAV_PAGES[p].label}
      </button>`;
    });
  });
  if (sidebarEl) sidebarEl.innerHTML = sidebarHtml;

  // Bottom nav: up to 4 main + More
  const isCht = isCHT();
  // Mobile bottom nav: luôn hiện Bù công + Phê duyệt (nếu có quyền)
  const bottomPages = admin
    ? ['checkin', 'mytable', 'requests', 'approvals', 'teamtable']
    : isCht
      ? ['checkin', 'mytable', 'requests', 'approvals', 'quanso']
      : ['checkin', 'mytable', 'requests', 'quanso'];
  const bottomLabels = {
    checkin:   'Chấm công',
    mytable:   'Bảng công',
    teamtable: 'Nhóm',
    users:     'Nhân sự',
    quanso:    'Quân số',
    requests:  'Bù công',
    approvals: 'Phê duyệt'
  };
  if (bottomEl) {
    bottomEl.innerHTML = bottomPages.map(p =>
      `<button class="bottom-nav-item" data-page="${p}" onclick="navigate('${p}')">
        <span class="nav-icon">${NAV_PAGES[p].icon}</span>
        <span>${bottomLabels[p]||NAV_PAGES[p].label}</span>
      </button>`
    ).join('');
  }
}

// ── App init ──
async function loadApp() {
  try {
    await loadCurrentUser();
    const u = STATE.currentUser;

    // Set topbar user info
    document.getElementById('topbarAvatar').textContent = u.full_name.charAt(0).toUpperCase();
    document.getElementById('topbarUserName').textContent = u.full_name;

    // Show desktop warning if needed
    if (!isMobileDevice()) {
      document.getElementById('desktopWarning').style.display = 'block';
    }

    // Load shared data
    await Promise.all([loadProjects(), loadUsers()]);

    // Build navigation
    buildNav();

    // Populate month selectors
    populateMonthYear('myMonth', 'myYear');
    populateMonthYear('teamMonth', 'teamYear');

    // Start clock
    startClock();

    // Check today attendance
    await checkTodayAttendance();

    // Show app
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display    = 'block';

    // Navigate to checkin by default
    navigate('checkin');

  } catch(e) {
    if (e.message !== 'Unauthorized') {
      console.error(e);
      showToast('❌ ' + e.message);
    }
  }
}

// ── Bootstrap ──
(async () => {
  const authed = await checkAuth();
  if (authed) {
    await loadApp();
  }
  // (login screen is shown by default in HTML)
})();
