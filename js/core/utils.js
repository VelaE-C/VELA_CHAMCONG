// ============================================================
// VELA_CHAMCONG — utils.js
// Shared helpers: fetch, date, toast, distance, fingerprint
// ============================================================

// ── Supabase REST helpers ──
async function sbFetch(path, options = {}) {
  const headers = {
    'apikey': CFG.SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers,
    'Authorization': `Bearer ${STATE.session?.access_token || CFG.SUPABASE_KEY}`
  };
  const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `HTTP ${res.status}`); }
  const t = await res.text(); return t ? JSON.parse(t) : [];
}

async function sb2Fetch(path, options = {}) {
  const headers = {
    'apikey': CFG.SB2_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers,
    'Authorization': `Bearer ${CFG.SB2_KEY}`
  };
  const res = await fetch(`${CFG.SB2_URL}/rest/v1/${path}`, { ...options, headers });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `HTTP ${res.status}`); }
  const t = await res.text(); return t ? JSON.parse(t) : [];
}

// ── Storage helpers ──
const STORAGE_URL = `${CFG.SUPABASE_URL}/storage/v1`;

async function uploadHRDoc(userId, file, docType, note) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'pdf') throw new Error('Chỉ chấp nhận file PDF');
  if (file.size > 50 * 1024 * 1024) throw new Error('File quá lớn (tối đa 50MB)');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${userId}/${Date.now()}_${safeName}`;
  const uploadRes = await fetch(`${STORAGE_URL}/object/hr-documents/${filePath}`, {
    method: 'POST',
    headers: {
      'apikey': CFG.SUPABASE_KEY,
      'Authorization': `Bearer ${STATE.session?.access_token || CFG.SUPABASE_KEY}`,
      'Content-Type': 'application/pdf',
    },
    body: file
  });
  if (!uploadRes.ok) { const err = await uploadRes.json().catch(() => ({})); throw new Error(err.message || 'Upload lỗi'); }
  await sbFetch('hr_documents', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, file_name: file.name, file_path: filePath, file_size: file.size, doc_type: docType, note: note || '', uploaded_by: STATE.currentUser.id })
  });
  return filePath;
}

async function getSignedUrl(filePath) {
  const res = await fetch(`${STORAGE_URL}/object/sign/hr-documents/${filePath}`, {
    method: 'POST',
    headers: { 'apikey': CFG.SUPABASE_KEY, 'Authorization': `Bearer ${STATE.session?.access_token || CFG.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 300 })
  });
  if (!res.ok) throw new Error('Không tạo được link xem file');
  const data = await res.json();
  const signedPath = data.signedURL || data.signedUrl || data.signed_url || '';
  if (!signedPath) throw new Error('Link không hợp lệ');
  return signedPath.startsWith('http') ? signedPath : `${STORAGE_URL}${signedPath}`;
}

async function deleteHRDoc(docId, filePath) {
  await fetch(`${STORAGE_URL}/object/hr-documents/${filePath}`, {
    method: 'DELETE',
    headers: { 'apikey': CFG.SUPABASE_KEY, 'Authorization': `Bearer ${STATE.session?.access_token || CFG.SUPABASE_KEY}` }
  });
  await sbFetch(`hr_documents?id=eq.${docId}`, { method: 'DELETE' });
}

// ── Date helpers ──
function localDateStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ── GPS ──
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Device helpers ──
function isMobileDevice() {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
  return isMobile || (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
}

async function getDeviceFingerprint() {
  const KEY = 'vela_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    id = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ── Toast ──
let toastTimer;
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Loading state ──
function showLoading(elId, msg = 'Đang tải...') {
  const el = document.getElementById(elId);
  if (el) el.innerHTML = `<div class="loading"><span class="loading-spinner"></span>${msg}</div>`;
}

function showEmpty(elId, icon = '📋', msg = 'Chưa có dữ liệu') {
  const el = document.getElementById(elId);
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon}</div>${msg}</div>`;
}

// ── Month selector populate ──
function populateMonthYear(monthId, yearId) {
  const now = new Date();
  // Tự động chọn đúng kỳ công hiện tại:
  // Nếu hôm nay >= 26 → kỳ đang chạy là tháng sau
  // Nếu hôm nay <= 25 → kỳ đang chạy là tháng này
  let currentMonth = now.getMonth() + 1; // 1-12
  let currentYear  = now.getFullYear();
  if (now.getDate() >= 26) {
    // Đã qua ngày 26 → kỳ tháng sau đang chạy
    currentMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    if (currentMonth === 1) currentYear += 1;
  }

  const mEl = document.getElementById(monthId);
  const yEl = document.getElementById(yearId);
  if (!mEl || !yEl) return;
  mEl.innerHTML = MONTHS_VI.map((m,i) =>
    `<option value="${i+1}" ${i+1===currentMonth?'selected':''}>${m}</option>`
  ).join('');
  yEl.innerHTML = '';
  for (let y = now.getFullYear()+1; y >= now.getFullYear()-2; y--) {
    yEl.innerHTML += `<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`;
  }
}

// ── Quân số project matching ──
let _qsProjectMap = {};
function normalizeCode(s) { return (s||'').toLowerCase().replace(/[\s\-_]+/g,''); }
function findProjectB(codeA) {
  if (_qsProjectMap[codeA]) return _qsProjectMap[codeA];
  const normA = normalizeCode(codeA);
  for (const [codeB, proj] of Object.entries(_qsProjectMap)) {
    if (normalizeCode(codeB) === normA) return proj;
  }
  for (const [codeB, proj] of Object.entries(_qsProjectMap)) {
    const normB = normalizeCode(codeB);
    if (normA.includes(normB) || normB.includes(normA)) return proj;
  }
  const prefixA = normA.replace(/[0-9]/g,'').slice(0,6);
  for (const [codeB, proj] of Object.entries(_qsProjectMap)) {
    const prefixB = normalizeCode(codeB).replace(/[0-9]/g,'').slice(0,6);
    if (prefixA === prefixB && prefixA.length >= 3) return proj;
  }
  return null;
}
