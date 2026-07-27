// VELA_CHAMCONG — requests.js
// Nhân viên gửi yêu cầu bù công

const REQUEST_TYPE_LABEL = {
  missing:     '📋 Chưa chấm công',
  missing_out: '🚪 Quên check out',
  wrong_time:  '⏰ Chấm sai giờ',
};

// ── INIT ──
async function initRequests() {
  // Populate project select theo scope của user
  const sel = document.getElementById('reqProject');
  if (sel) {
    sel.innerHTML = '<option value="">-- Chọn dự án --</option>';
    getAccessibleProjects().forEach(p => {
      sel.innerHTML += `<option value="${p.id}" data-code="${p.code}">${p.code} — ${p.name}</option>`;
    });
  }

  // Default date = hôm nay
  const dateEl = document.getElementById('reqDate');
  if (dateEl && !dateEl.value) {
    dateEl.value = localDateStr();
    dateEl.max   = localDateStr();
    const d7 = new Date(); d7.setDate(d7.getDate() - 7);
    dateEl.min = localDateStr(d7);
  }

  await loadMyRequests();
}

// ── GỬI YÊU CẦU ──
async function submitRequest() {
  const projectId = document.getElementById('reqProject').value;
  const date      = document.getElementById('reqDate').value;
  const type      = document.getElementById('reqType').value;
  const reason    = document.getElementById('reqReason').value.trim();

  if (!projectId) { showToast('⚠️ Chọn dự án'); return; }
  if (!date)      { showToast('⚠️ Chọn ngày'); return; }
  if (!reason)    { showToast('⚠️ Nhập lý do'); return; }

  // Validate: chỉ trong 7 ngày
  const today   = new Date(localDateStr());
  const reqDate = new Date(date);
  const diffDays = Math.floor((today - reqDate) / 86400000);
  if (diffDays > 7) { showToast('❌ Chỉ được gửi yêu cầu trong vòng 7 ngày'); return; }
  if (diffDays < 0) { showToast('❌ Không thể gửi yêu cầu cho ngày tương lai'); return; }

  const btn = document.getElementById('reqSubmitBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang gửi...';

  try {
    await sbFetch('attendance_requests', {
      method: 'POST',
      body: JSON.stringify({
        user_id:      STATE.currentUser.id,
        project_id:   projectId,
        request_date: date,
        request_type: type,
        reason,
        status: 'pending'
      })
    });
    showToast('✅ Đã gửi yêu cầu — chờ CHT duyệt');
    document.getElementById('reqReason').value = '';
    document.getElementById('reqDate').value = localDateStr();
    await loadMyRequests();
  } catch(e) {
    if (e.message.includes('unique') || e.message.includes('duplicate')) {
      showToast('⚠️ Đã có yêu cầu pending cho ngày và dự án này');
    } else if (e.message.includes('request_within_7_days')) {
      showToast('❌ Chỉ được gửi yêu cầu trong vòng 7 ngày gần nhất');
    } else {
      showToast('❌ ' + e.message);
    }
  } finally {
    btn.disabled = false; btn.textContent = '📤 Gửi yêu cầu';
  }
}

// ── DANH SÁCH YÊU CẦU CỦA TÔI ──
async function loadMyRequests() {
  const el = document.getElementById('myRequestList');
  if (!el) return;
  showLoading('myRequestList');
  try {
    const rows = await sbFetch(
      `attendance_requests?user_id=eq.${STATE.currentUser.id}&order=created_at.desc&limit=30`
    );
    if (!rows.length) {
      showEmpty('myRequestList', '📋', 'Chưa có yêu cầu nào');
      return;
    }
    el.innerHTML = rows.map(r => {
      const proj = STATE.projects.find(p => p.id === r.project_id);
      const d    = r.request_date.split('-').reverse().join('/');
      const created = fmtDate(r.created_at);
      const statusInfo = {
        pending:  { badge: 'badge-amber', label: '⏳ Chờ duyệt' },
        approved: { badge: 'badge-green', label: '✅ Đã duyệt' },
        rejected: { badge: 'badge-red',   label: '❌ Từ chối' },
      }[r.status] || { badge: 'badge-gray', label: r.status };

      return `<div style="padding:14px 16px;background:white;border:1px solid var(--gray2);
        border-radius:8px;margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
          <div>
            <span style="font-weight:700;font-size:13px;color:var(--gray8)">${d}</span>
            <span style="margin-left:8px;font-size:12px;color:var(--gray5)">${proj?.code||'—'}</span>
          </div>
          <span class="badge ${statusInfo.badge}" style="flex-shrink:0">${statusInfo.label}</span>
        </div>
        <div style="font-size:12px;color:var(--blue);margin-bottom:4px">${REQUEST_TYPE_LABEL[r.request_type]||r.request_type}</div>
        <div style="font-size:13px;color:var(--gray7);margin-bottom:6px">📝 ${r.reason}</div>
        ${r.review_note ? `<div style="font-size:12px;background:var(--gray1);border-radius:6px;padding:8px 10px;color:var(--gray7)">
          💬 CHT: "${r.review_note}"
        </div>` : ''}
        <div style="font-size:11px;color:var(--gray3);margin-top:6px">Gửi lúc: ${created}</div>
        ${r.status === 'pending' ? `<button onclick="cancelRequest('${r.id}')" 
          class="btn btn-secondary btn-sm" style="margin-top:8px">Hủy yêu cầu</button>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    showEmpty('myRequestList', '❌', e.message);
  }
}

// ── HỦY YÊU CẦU ──
async function cancelRequest(id) {
  if (!confirm('Hủy yêu cầu này?')) return;
  try {
    await sbFetch(`attendance_requests?id=eq.${id}`, { method: 'DELETE' });
    showToast('✅ Đã hủy yêu cầu');
    await loadMyRequests();
  } catch(e) { showToast('❌ ' + e.message); }
}
