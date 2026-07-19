// VELA_CHAMCONG — checkin.js
// Check in / Check out + GPS geofencing

// ── CLOCK ──
function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById('timeDisplay').textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    document.getElementById('dateDisplay').textContent = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
    document.getElementById('dayDisplay').textContent = DAYS_VI[now.getDay()];
  }
  tick(); setInterval(tick, 1000);
}

// ── CHECK TODAY ──
async function checkTodayAttendance() {
  const today = localDateStr();
  try {
    const rows = await sbFetch(`attendance?user_id=eq.${STATE.currentUser.id}&check_date=eq.${today}&limit=1`);
    if (!rows.length) return;
    const rec = rows[0];
    STATE.checkedInToday = true;
    STATE.todayAttId = rec.id;
    const tin = new Date(rec.check_time);
    const tinStr = `${tin.getHours()}:${String(tin.getMinutes()).padStart(2,'0')}`;
    if (rec.check_out) {
      const tout = new Date(rec.check_out);
      const toutStr = `${tout.getHours()}:${String(tout.getMinutes()).padStart(2,'0')}`;
      setCheckedOutState(tinStr, toutStr);
    } else {
      setCheckedInState(tinStr);
    }
  } catch(e) { console.error(e); }
}

function setCheckedInState(tinStr) {
  const btn = document.getElementById('checkinBtn');
  // Change button to checkout style (blue)
  btn.className = 'btn-checkin-main state-checkin';
  
  document.getElementById('checkinBtnIcon').textContent = '🚪';
  document.getElementById('checkinBtnLabel').textContent = '🚪 CHECK OUT';
  document.getElementById('checkinResult').innerHTML =
    `✅ Check in: <strong>${tinStr}</strong> &nbsp;&nbsp;<span style="color:var(--text3);font-size:12px">Chưa check out</span>`;
  STATE.mode = 'checkout';
}

function setCheckedOutState(tinStr, toutStr) {
  const btn = document.getElementById('checkinBtn');
  btn.className = 'btn-checkin-main state-done';
  
  document.getElementById('checkinBtnIcon').textContent = '✅';
  document.getElementById('checkinBtnLabel').textContent = 'CẬP NHẬT OUT';
  document.getElementById('checkinResult').innerHTML =
    `✅ Check in: <strong>${tinStr}</strong> &nbsp;|&nbsp; 🚪 Check out: <strong>${toutStr}</strong>`;
  STATE.mode = 'checkout'; // still allow updating checkout
}

// ── DEVICE FINGERPRINT ──
async function getDeviceFingerprint() {
  // Lấy hoặc tạo device ID bền vững lưu trong localStorage
  // Mỗi thiết bị có 1 ID duy nhất, không phụ thuộc vào model
  const STORAGE_KEY = 'vela_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    // Tạo ID ngẫu nhiên lần đầu, lưu vĩnh viễn
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    deviceId = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}


// ── CHECKOUT ──
async function doCheckout() {
  let attId = STATE.todayAttId;
  if (!attId) {
    const today = localDateStr();
    const rows = await sbFetch(`attendance?user_id=eq.${STATE.currentUser.id}&check_date=eq.${today}&limit=1`);
    if (!rows.length) { showToast('❌ Chưa check in hôm nay'); return; }
    attId = rows[0].id;
    STATE.todayAttId = attId;
  }

  const btn = document.getElementById('checkinBtn');
  const result = document.getElementById('checkinResult');

  if (!navigator.geolocation) { showToast('⚠️ Trình duyệt không hỗ trợ GPS'); return; }

  btn.disabled = true;
  document.getElementById('checkinBtnLabel').textContent = '⏳ Đang lấy GPS...';
  document.getElementById('locDot').className = 'loc-dot checking';
  document.getElementById('locText').textContent = 'Đang xác định vị trí checkout...';

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      // Check geofence - same as checkin
      const accessible = getAccessibleProjects();
      const matches = accessible
        .map(p => ({ ...p, dist: Math.round(calcDistance(latitude, longitude, p.lat, p.lng)) }))
        .filter(p => p.dist <= p.radius_m)
        .sort((a,b) => a.dist - b.dist);

      if (matches.length === 0) {
        const nearest = accessible
          .map(p => ({ ...p, dist: Math.round(calcDistance(latitude, longitude, p.lat, p.lng)) }))
          .sort((a,b) => a.dist - b.dist)[0];
        document.getElementById('locDot').className = 'loc-dot fail';
        document.getElementById('locText').textContent = 'Ngoài phạm vi dự án';
        result.innerHTML = nearest
          ? `❌ Không thể check out — ngoài phạm vi. Gần nhất: <strong>${nearest.name}</strong> (cách ${nearest.dist}m)`
          : '❌ Không trong phạm vi dự án nào';
        btn.disabled = false;
        document.getElementById('checkinBtnLabel').textContent = '🚪 CHECK OUT';
        return;
      }

      // In geofence — save checkout
      document.getElementById('locDot').className = 'loc-dot ok';
      document.getElementById('locText').textContent = `📍 ${matches[0].name} — cách ${matches[0].dist}m | ±${Math.round(accuracy)}m`;
      await saveCheckout(attId, latitude, longitude, matches[0].dist, result, btn);
    },
    () => {
      btn.disabled = false;
      document.getElementById('checkinBtnLabel').textContent = '🚪 CHECK OUT';
      document.getElementById('locDot').className = 'loc-dot fail';
      result.innerHTML = '❌ Không lấy được GPS';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

async function saveCheckout(attId, lat, lng, dist, result, btn) {
  const now = new Date();
  const nowStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  try {
    // PATCH check_out — overwrites previous, always latest time
    await sbFetch(`attendance?id=eq.${attId}`, {
      method: 'PATCH',
      body: JSON.stringify({ check_out: now.toISOString() })
    });
    // Get check_in time to display
    const rows = await sbFetch(`attendance?id=eq.${attId}&select=check_time&limit=1`);
    const tin = rows.length ? new Date(rows[0].check_time) : null;
    const tinStr = tin ? `${tin.getHours()}:${String(tin.getMinutes()).padStart(2,'0')}` : '—';
    setCheckedOutState(tinStr, nowStr);
    result.innerHTML = `✅ Check in: <strong>${tinStr}</strong> &nbsp;|&nbsp; 🚪 Check out: <strong>${nowStr}</strong> — cách ${dist}m`;
    showToast(`✅ Check out lúc ${nowStr} — có thể cập nhật lại nếu cần`);
  } catch(e) {
    btn.disabled = false;
    document.getElementById('checkinBtnLabel').textContent = '🚪 CHECK OUT';
    showToast('❌ ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

// ── CHECKIN/CHECKOUT DISPATCHER ──
function handleCheckinBtn() {
  if (STATE.mode === 'checkout') {
    doCheckout();
  } else {
    doCheckin();
  }
}

// ── GET ACCESSIBLE PROJECTS BY SCOPE ──
function getAccessibleProjects() {
  const scope = STATE.currentUser.project_scope || 'fixed';
  if (scope === 'all') return STATE.projects;
  if (scope === 'multi') {
    const allowed = STATE.currentUser.allowed_projects || [];
    return STATE.projects.filter(p => allowed.includes(p.id));
  }
  return STATE.projects.filter(p => p.id === STATE.currentUser.project_id);
}

// ── AUTO-DETECT CHECKIN ──
async function doCheckin() {
  if (STATE.checkedInToday) { showToast('⚠️ Hôm nay đã chấm công rồi'); return; }

  // Lớp 1: Chặn desktop
  const deviceCheck = checkDeviceAllowed();
  if (!deviceCheck.allowed) {
    const result = document.getElementById('checkinResult');
    const locDot = document.getElementById('locDot');
    document.getElementById('locDot').className = 'loc-dot fail';
    document.getElementById('locText').textContent = 'Thiết bị không hợp lệ';
    result.innerHTML = `<div style="color:var(--red);text-align:center;padding:8px">${deviceCheck.reason}</div>`;
    showToast('❌ Chỉ được chấm công bằng điện thoại');
    return;
  }

  if (!navigator.geolocation) { showToast('⚠️ Trình duyệt không hỗ trợ GPS'); return; }

  const btn = document.getElementById('checkinBtn');
  const locDot = document.getElementById('locDot');
  const locText = document.getElementById('locText');
  const result = document.getElementById('checkinResult');
  const detectedDiv = document.getElementById('detectedProject');
  const detectedName = document.getElementById('detectedProjectName');
  const manualRow = document.getElementById('manualProjectRow');

  btn.disabled = true;
  document.getElementById('locDot').className = 'loc-dot checking';
  locText.textContent = 'Đang lấy vị trí GPS...';
  result.textContent = '⏳ Đang xác định vị trí...';
  detectedDiv.style.display = 'none';
  manualRow.style.display = 'none';

  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude, accuracy } = pos.coords;
    locText.textContent = `Độ chính xác: ±${Math.round(accuracy)}m`;

    // Lớp 2: Kiểm tra GPS accuracy
    const gpsCheck = checkGpsAccuracy(accuracy);
    if (!gpsCheck.allowed) {
      document.getElementById('locDot').className = 'loc-dot fail';
      result.innerHTML = `<div style="color:var(--accent);line-height:1.7;white-space:pre-line">${gpsCheck.reason}</div>`;
      btn.disabled = false;
      return;
    }

    const accessible = getAccessibleProjects();
    const matches = accessible
      .map(p => ({ ...p, dist: Math.round(calcDistance(latitude, longitude, p.lat, p.lng)) }))
      .filter(p => p.dist <= p.radius_m)
      .sort((a, b) => a.dist - b.dist);

    if (matches.length === 0) {
      document.getElementById('locDot').className = 'loc-dot fail';
      const nearest = accessible
        .map(p => ({ ...p, dist: Math.round(calcDistance(latitude, longitude, p.lat, p.lng)) }))
        .sort((a, b) => a.dist - b.dist)[0];
      result.innerHTML = nearest
        ? `❌ Không trong phạm vi dự án nào — gần nhất: <strong>${nearest.name}</strong> (cách ${nearest.dist}m, giới hạn ${nearest.radius_m}m)`
        : '❌ Không tìm thấy dự án nào được phép';
      btn.disabled = false;
      return;
    }

    if (matches.length === 1) {
      document.getElementById('locDot').className = 'loc-dot ok';
      locText.textContent = `📍 ${matches[0].name} — cách ${matches[0].dist}m | Độ chính xác: ±${Math.round(accuracy)}m`;
      detectedName.textContent = `🏗️ ${matches[0].code} — ${matches[0].name} (cách ${matches[0].dist}m)`;
      detectedDiv.style.display = 'block';
      await submitCheckin(matches[0].id, latitude, longitude, matches[0].dist, result, btn);
    } else {
      document.getElementById('locDot').className = 'loc-dot ok';
      locText.textContent = `Phát hiện ${matches.length} dự án gần đây`;
      const sel = document.getElementById('projectSelect');
      sel.innerHTML = '<option value="">-- Chọn dự án --</option>' +
        matches.map(p => `<option value="${p.id}">${p.code} — ${p.name} (${p.dist}m)</option>`).join('');
      manualRow.style.display = 'block';
      result.textContent = 'Chọn dự án bên trên rồi nhấn Xác nhận';
      btn.disabled = false;
    }
  }, () => {
    document.getElementById('locDot').className = 'loc-dot fail';
    locText.textContent = 'Không lấy được vị trí';
    result.textContent = '❌ Không lấy được GPS. Kiểm tra quyền vị trí trên trình duyệt.';
    btn.disabled = false;
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

async function confirmManualCheckin() {
  const projectId = document.getElementById('projectSelect').value;
  if (!projectId) { showToast('⚠️ Chọn dự án trước'); return; }
  const proj = STATE.projects.find(p => p.id === projectId);
  const result = document.getElementById('checkinResult');
  const btn = document.getElementById('checkinBtn');
  btn.disabled = true;
  result.textContent = '⏳ Đang chấm công...';
  navigator.geolocation.getCurrentPosition(async pos => {
    const dist = Math.round(calcDistance(pos.coords.latitude, pos.coords.longitude, proj.lat, proj.lng));
    await submitCheckin(projectId, pos.coords.latitude, pos.coords.longitude, dist, result, btn);
  }, () => { result.textContent = '❌ Không lấy được GPS'; btn.disabled = false; },
  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

async function submitCheckin(projectId, latitude, longitude, dist, result, btn) {
  const today = localDateStr();
  try {
    const fingerprint = await getDeviceFingerprint();
    const deviceType = isMobileDevice() ? 'mobile' : 'desktop';
    const sameDevice = await sbFetch(`attendance?check_date=eq.${today}&device_fingerprint=eq.${fingerprint}&user_id=neq.${STATE.currentUser.id}&limit=5`);
    if (sameDevice.length > 0) {
      const names = sameDevice.map(r => {
        const u = STATE.users.find(x => x.id === r.user_id);
        return u ? u.full_name : 'Người khác';
      }).join(', ');
      showToast('⚠️ Phát hiện chấm công hộ — đã cảnh báo HR');
    }
    const created = await sbFetch('attendance', { method: 'POST', body: JSON.stringify({
      user_id: STATE.currentUser.id, project_id: projectId,
      check_date: today, check_time: new Date().toISOString(),
      lat: latitude, lng: longitude, distance_m: dist, status: 'present',
      device_fingerprint: fingerprint, is_suspicious: sameDevice.length > 0,
      note: `device:${deviceType}|accuracy:${dist}m`
    })});
    STATE.checkedInToday = true;
    if (created && created[0]) STATE.todayAttId = created[0].id;
    const now = new Date();
    const proj = STATE.projects.find(p => p.id === projectId);
    const tinStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    result.innerHTML = `✅ Check in: <strong>${tinStr}</strong> tại ${proj?.name || ''} — cách ${dist}m`;
    showToast('✅ Check in thành công!');
    document.getElementById('myMonth').value = now.getMonth() + 1;
    document.getElementById('myYear').value = now.getFullYear();
    document.getElementById('manualProjectRow').style.display = 'none';
    document.getElementById('detectedProject').style.display = 'none';
    setCheckedInState(tinStr);
  } catch(e) {
    if (e.message.includes('unique')) { result.innerHTML = '⚠️ Đã chấm công hôm nay rồi'; STATE.checkedInToday = true; }
    else result.innerHTML = '❌ ' + e.message;
    btn.disabled = false;
  }
}

// ── DEVICE & ACCURACY CHECK ──
function isMobileDevice() {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
  const isTablet = /tablet|ipad/i.test(ua);
  // Check touch support as secondary indicator
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  return isMobile || isTablet || (hasTouch && window.innerWidth <= 1024);
}

function checkDeviceAllowed() {
  if (!isMobileDevice()) {
    return {
      allowed: false,
      reason: '🖥️ Chỉ được chấm công bằng điện thoại. Laptop không được phép.'
    };
  }
  return { allowed: true };
}

function checkGpsAccuracy(accuracy) {
  // Laptop WiFi positioning usually > 200m accuracy
  // Real phone GPS usually < 100m
  if (accuracy > 150) {
    return { allowed: false, reason: `📡 GPS yếu (±${Math.round(accuracy)}m). Cần dưới 150m. Ra ngoài trời, bật GPS.` };
  }
  return { allowed: true };
}

// ── GEOFENCING ──
function calcDistance(lat1,lng1,lat2,lng2) {
  const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
