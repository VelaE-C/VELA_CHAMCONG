// VELA_CHAMCONG — warnings.js
// Cảnh báo chấm công hộ

// ── WARNINGS ──
async function loadWarnings() {
  const el = document.getElementById('warningList'); if(!el) return;
  el.innerHTML = '<div class="loading"><span class="spinner"></span> Đang tải...</div>';
  try {
    const rows = await sbFetch('attendance?is_suspicious=eq.true&order=check_date.desc&limit=100');
    if(!rows.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div>Chưa phát hiện trường hợp bất thường</div>';
      return;
    }
    // Group by fingerprint + date
    const groups = {};
    rows.forEach(r => {
      const key = r.device_fingerprint + '_' + r.check_date;
      if(!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    const cards = Object.entries(groups).map(([key, items]) => {
      const names = items.map(r => {
        const u = STATE.users.find(x => x.id === r.user_id);
        return u ? u.full_name : r.user_id;
      });
      const date = items[0].check_date;
      const fp = items[0].device_fingerprint;
      return `<div style="background:var(--lred);border:1px solid #FECACA;border-radius:12px;padding:16px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="color:var(--red);font-weight:600;font-size:14px">⚠️ Chấm công hộ nghi ngờ</span>
          <span style="font-family:monospace;font-size:12px;color:var(--gray5)">${date}</span>
        </div>
        <div style="font-size:13px;color:var(--gray7);margin-bottom:6px">
          <strong style="color:var(--gray8)">${names.join(' & ')}</strong> — cùng thiết bị
        </div>
        <div style="font-size:11px;color:var(--gray5);font-family:monospace">Device ID: ${fp}</div>
      </div>`;
    }).join('');
    el.innerHTML = cards;
  } catch(e) { el.innerHTML = '<div class="empty-state">❌ ' + e.message + '</div>'; }
}

