// VELA_CHAMCONG — leave.js
// Đơn Xin Nghỉ Phép — nhân viên gửi, theo dõi duyệt 3 bước:
// Trưởng bộ phận (CHT) → TP.HCNS → Phó Tổng Giám Đốc

const LEAVE_TYPE_LABEL = {
  om:          '🤒 Nghỉ ốm',
  dam_tang:    '⚰️ Đám tang',
  dam_cuoi:    '💍 Đám cưới',
  sinh:        '👶 Nghỉ sinh',
  khac:        '📌 Khác',
  khong_luong: '💸 Không lương',
};

const LEAVE_STATUS_LABEL = {
  pending_cht:     '⏳ Chờ Trưởng bộ phận duyệt',
  pending_hcns:    '⏳ Chờ TP.HCNS duyệt',
  pending_pho_tgd: '⏳ Chờ Phó TGĐ duyệt',
  approved:        '✅ Đã duyệt',
  rejected:        '❌ Đã từ chối',
};

// ── INIT ──
async function initLeave() {
  const sel = document.getElementById('lvProject');
  if (sel) {
    sel.innerHTML = '<option value="">-- Chọn dự án --</option>';
    getAccessibleProjects().forEach(p => {
      sel.innerHTML += `<option value="${p.id}">${p.code} — ${p.name}</option>`;
    });
  }

  const today = localDateStr();
  const fromEl = document.getElementById('lvDateFrom');
  const toEl   = document.getElementById('lvDateTo');
  if (fromEl && !fromEl.value) fromEl.value = today;
  if (toEl   && !toEl.value)   toEl.value   = today;

  lvCalcCong();
  await loadMyLeaveRequests();
}

// ── TÍNH CÔNG NGHỈ: T2-T6 = 1 công, T7 = 0.5 công, CN không tính ──
function calcLeaveCong(dateFromStr, dateToStr) {
  let total = 0;
  let d = new Date(dateFromStr + 'T00:00:00');
  const end = new Date(dateToStr + 'T00:00:00');
  while (d <= end) {
    const dow = d.getDay(); // 0 = CN, 6 = T7
    if (dow === 6) total += 0.5;
    else if (dow !== 0) total += 1;
    d.setDate(d.getDate() + 1);
  }
  return total;
}

function lvCalcCong() {
  const from = document.getElementById('lvDateFrom').value;
  const to   = document.getElementById('lvDateTo').value;
  const el   = document.getElementById('lvTotalCong');
  if (!from || !to || from > to) { el.textContent = '0'; return; }
  el.textContent = calcLeaveCong(from, to);
}

// ── GỬI ĐƠN ──
async function submitLeaveRequest() {
  const projectId = document.getElementById('lvProject').value;
  const category  = document.getElementById('lvCategory').value;
  const type      = document.getElementById('lvType').value;
  const dateFrom  = document.getElementById('lvDateFrom').value;
  const dateTo    = document.getElementById('lvDateTo').value;
  const reason    = document.getElementById('lvReason').value.trim();
  const repName   = document.getElementById('lvRepName').value.trim();
  const repPos    = document.getElementById('lvRepPosition').value.trim();

  if (!projectId)          { showToast('⚠️ Chọn dự án'); return; }
  if (!dateFrom || !dateTo){ showToast('⚠️ Chọn ngày nghỉ'); return; }
  if (dateFrom > dateTo)   { showToast('⚠️ Ngày kết thúc phải sau ngày bắt đầu'); return; }
  if (!reason)             { showToast('⚠️ Nhập lý do'); return; }

  const totalCong = calcLeaveCong(dateFrom, dateTo);
  const btn = document.getElementById('lvSubmitBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang gửi...';

  try {
    await sbFetch('leave_requests', {
      method: 'POST',
      body: JSON.stringify({
        user_id:              STATE.currentUser.id,
        project_id:           projectId,
        leave_category:       category,
        leave_type:           type,
        date_from:            dateFrom,
        date_to:              dateTo,
        total_cong:           totalCong,
        reason,
        replacement_name:     repName || null,
        replacement_position: repPos || null,
        status: 'pending_cht'
      })
    });
    showToast('✅ Đã gửi đơn — chờ Trưởng bộ phận duyệt');
    document.getElementById('lvReason').value = '';
    document.getElementById('lvRepName').value = '';
    document.getElementById('lvRepPosition').value = '';
    await loadMyLeaveRequests();
  } catch(e) {
    showToast('❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '📤 Gửi đơn xin nghỉ phép';
  }
}

// ── DANH SÁCH ĐƠN CỦA TÔI ──
async function loadMyLeaveRequests() {
  const el = document.getElementById('myLeaveList');
  if (!el) return;
  showLoading('myLeaveList');
  try {
    const rows = await sbFetch(
      `leave_requests?user_id=eq.${STATE.currentUser.id}&order=created_at.desc&limit=30`
    );
    if (!rows.length) { showEmpty('myLeaveList', '📋', 'Chưa có đơn nghỉ phép nào'); return; }
    el.innerHTML = rows.map(r => renderMyLeaveCard(r)).join('');
  } catch(e) {
    showEmpty('myLeaveList', '❌', e.message);
  }
}

function lvStepIndex(status) {
  return { pending_cht: 1, pending_hcns: 2, pending_pho_tgd: 3, approved: 4, rejected: 0 }[status] || 0;
}

function renderMyLeaveCard(r) {
  const proj = STATE.projects.find(p => p.id === r.project_id);
  const from = r.date_from.split('-').reverse().join('/');
  const to   = r.date_to.split('-').reverse().join('/');
  const isRejected = r.status === 'rejected';
  const stepIdx = lvStepIndex(r.status);
  const steps = ['Trưởng bộ phận', 'TP.HCNS', 'Phó TGĐ'];
  const rejectStepLabel = { cht:'Trưởng bộ phận', hcns:'TP.HCNS', pho_tgd:'Phó TGĐ' }[r.rejected_at_step] || '';

  return `<div style="padding:16px;background:white;border:1px solid var(--gray2);border-radius:8px;margin-bottom:10px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--gray8)">${from} → ${to}
          <span style="color:var(--gray5);font-weight:400;font-size:12px">(${r.total_cong} công)</span>
        </div>
        <div style="font-size:12px;color:var(--gray5);margin-top:2px">${proj?.code||''} · ${LEAVE_TYPE_LABEL[r.leave_type]||r.leave_type}</div>
      </div>
      <span class="badge ${isRejected?'badge-red':r.status==='approved'?'badge-green':'badge-amber'}" style="flex-shrink:0">${LEAVE_STATUS_LABEL[r.status]}</span>
    </div>
    <div style="font-size:13px;color:var(--gray7);margin-bottom:12px">📝 ${r.reason}</div>
    ${!isRejected ? `
      <div class="leave-stepper">
        ${steps.map((label, i) => `
          ${i>0 ? '<div class="leave-step-line"></div>' : ''}
          <div class="leave-step ${stepIdx > i+1 ? 'done' : stepIdx===i+1 ? 'active' : ''}">
            <div class="leave-step-dot">${stepIdx > i+1 ? '✓' : i+1}</div>
            <div class="leave-step-label">${label}</div>
          </div>
        `).join('')}
      </div>
    ` : `<div class="alert alert-danger" style="margin:0">❌ Bị từ chối ở bước <strong>${rejectStepLabel}</strong>: ${r.reject_note||''}</div>`}
  </div>`;
}
