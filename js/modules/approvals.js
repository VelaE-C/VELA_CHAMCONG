// VELA_CHAMCONG — approvals.js
// CHT duyệt yêu cầu bù công

// ── INIT ──
async function initApprovals() {
  await loadPendingRequests();
}

// ── LOAD DANH SÁCH CHỜ DUYỆT ──
async function loadPendingRequests() {
  const el = document.getElementById('approvalList');
  if (!el) return;
  showLoading('approvalList');

  try {
    // CHT chỉ thấy dự án của mình, superadmin/site_admin thấy tất cả
    const u = STATE.currentUser;
    let url = `attendance_requests?status=eq.pending&order=request_date.desc&limit=100`;

    // Lọc theo dự án CHT quản lý
    if (u.role === 'cht') {
      // CHT chỉ quản lý dự án được gán
      const projectIds = u.project_scope === 'fixed'
        ? [u.project_id]
        : (u.allowed_projects || []);
      if (projectIds.length === 1) {
        url += `&project_id=eq.${projectIds[0]}`;
      } else if (projectIds.length > 1) {
        url += `&project_id=in.(${projectIds.join(',')})`;
      }
    }
    // site_admin và superadmin thấy tất cả

    const rows = await sbFetch(url);
    if (!rows.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">✅</div>
        Không có yêu cầu nào đang chờ duyệt
      </div>`;
      return;
    }

    // Group by project
    const byProject = {};
    rows.forEach(r => {
      const proj = STATE.projects.find(p => p.id === r.project_id);
      const key  = proj?.code || r.project_id;
      if (!byProject[key]) byProject[key] = { proj, rows: [] };
      byProject[key].rows.push(r);
    });

    el.innerHTML = Object.entries(byProject).map(([code, { proj, rows }]) => `
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
          color:var(--gray5);padding:8px 0;border-bottom:2px solid var(--gray2);margin-bottom:12px">
          🏗 ${proj?.name || code}
        </div>
        ${rows.map(r => renderApprovalCard(r)).join('')}
      </div>
    `).join('');

  } catch(e) {
    showEmpty('approvalList', '❌', e.message);
  }
}

function renderApprovalCard(r) {
  const proj    = STATE.projects.find(p => p.id === r.project_id);
  const user    = STATE.users.find(u => u.id === r.user_id);
  const d       = r.request_date.split('-').reverse().join('/');
  const created = fmtDate(r.created_at);
  const typeLabel = {
    missing:     '📋 Chưa chấm công',
    missing_out: '🚪 Quên check out',
    wrong_time:  '⏰ Chấm sai giờ',
  }[r.request_type] || r.request_type;

  return `<div id="req-${r.id}" style="padding:16px;background:white;border:1px solid var(--gray2);
    border-radius:8px;margin-bottom:10px">

    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--gray8)">${user?.full_name||'—'}</div>
        <div style="font-size:12px;color:var(--gray5);margin-top:2px">${user?.employee_code||''} · ${proj?.code||''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;font-size:15px;color:var(--navy)">${d}</div>
        <div style="font-size:11px;color:var(--gray3)">${created}</div>
      </div>
    </div>

    <div style="background:var(--gray1);border-radius:6px;padding:10px 12px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--blue);margin-bottom:4px">${typeLabel}</div>
      <div style="font-size:13px;color:var(--gray8)">📝 ${r.reason}</div>
    </div>

    <div style="margin-bottom:10px">
      <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
        color:var(--gray5);display:block;margin-bottom:4px">Ghi chú khi duyệt (tùy chọn)</label>
      <textarea id="note-${r.id}" class="form-control" style="min-height:60px"
        placeholder="VD: Xác nhận nhân viên có mặt tại công trường ngày này..."></textarea>
    </div>

    <div style="display:flex;gap:8px">
      <button onclick="approveRequest('${r.id}', '${r.user_id}', '${r.project_id}', '${r.request_date}', '${r.request_type}')"
        class="btn btn-success" style="flex:1">✅ Duyệt</button>
      <button onclick="rejectRequest('${r.id}')"
        class="btn btn-danger" style="flex:1">❌ Từ chối</button>
    </div>
  </div>`;
}

// ── DUYỆT YÊU CẦU ──
async function approveRequest(reqId, userId, projectId, reqDate, reqType) {
  const note = document.getElementById(`note-${reqId}`)?.value.trim() || '';
  const card = document.getElementById(`req-${reqId}`);

  // Disable buttons
  card.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    // 1. Kiểm tra đã có record attendance chưa
    const existing = await sbFetch(
      `attendance?user_id=eq.${userId}&project_id=eq.${projectId}&check_date=eq.${reqDate}&limit=1`
    );

    let attendanceId = null;

    if (existing.length) {
      // Có record → update note + is_adjusted
      await sbFetch(`attendance?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_adjusted: true,
          note: `[Bù công CHT duyệt] ${note}`
        })
      });
      attendanceId = existing[0].id;
    } else {
      // Chưa có record → tạo mới
      const created = await sbFetch('attendance', {
        method: 'POST',
        body: JSON.stringify({
          user_id:    userId,
          project_id: projectId,
          check_date: reqDate,
          status:     'present',
          is_adjusted: true,
          note: `[Bù công CHT duyệt] ${note}`
        })
      });
      attendanceId = created[0]?.id;
    }

    // 2. Cập nhật request → approved
    await sbFetch(`attendance_requests?id=eq.${reqId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status:        'approved',
        reviewed_by:   STATE.currentUser.id,
        reviewed_at:   new Date().toISOString(),
        review_note:   note,
        attendance_id: attendanceId
      })
    });

    showToast('✅ Đã duyệt — bảng công tự động cập nhật');

    // Remove card with animation
    card.style.opacity = '0.5';
    setTimeout(() => { card.remove(); }, 400);

  } catch(e) {
    card.querySelectorAll('button').forEach(b => b.disabled = false);
    showToast('❌ ' + e.message);
  }
}

// ── TỪ CHỐI YÊU CẦU ──
async function rejectRequest(reqId) {
  const note = document.getElementById(`note-${reqId}`)?.value.trim();
  if (!note) { showToast('⚠️ Nhập lý do từ chối trước'); return; }

  const card = document.getElementById(`req-${reqId}`);
  card.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    await sbFetch(`attendance_requests?id=eq.${reqId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status:      'rejected',
        reviewed_by: STATE.currentUser.id,
        reviewed_at: new Date().toISOString(),
        review_note: note
      })
    });
    showToast('✅ Đã từ chối yêu cầu');
    card.style.opacity = '0.5';
    setTimeout(() => { card.remove(); }, 400);
  } catch(e) {
    card.querySelectorAll('button').forEach(b => b.disabled = false);
    showToast('❌ ' + e.message);
  }
}

// ── XEM LỊCH SỬ ĐÃ DUYỆT ──
async function loadApprovalHistory() {
  const el = document.getElementById('approvalHistory');
  if (!el) return;
  showLoading('approvalHistory');
  try {
    const rows = await sbFetch(
      `attendance_requests?status=neq.pending&order=reviewed_at.desc&limit=50`
    );
    if (!rows.length) { showEmpty('approvalHistory', '📋', 'Chưa có lịch sử'); return; }

    const statusInfo = {
      approved: { badge: 'badge-green', label: '✅ Đã duyệt' },
      rejected: { badge: 'badge-red',   label: '❌ Từ chối' },
    };

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr>
        <th>Ngày</th><th>Nhân viên</th><th>Dự án</th>
        <th>Loại</th><th>Kết quả</th><th>Ghi chú CHT</th><th>Duyệt lúc</th>
      </tr></thead>
      <tbody>${rows.map((r,i) => {
        const user = STATE.users.find(u => u.id === r.user_id);
        const proj = STATE.projects.find(p => p.id === r.project_id);
        const si   = statusInfo[r.status] || { badge:'badge-gray', label: r.status };
        const bg   = i%2===0?'white':'var(--gray1)';
        return `<tr style="background:${bg}">
          <td style="font-family:monospace">${r.request_date.split('-').reverse().join('/')}</td>
          <td style="font-weight:500">${user?.full_name||'—'}</td>
          <td><span class="badge badge-navy" style="font-size:11px">${proj?.code||'—'}</span></td>
          <td style="font-size:12px">${{missing:'Chưa chấm',missing_out:'Quên out',wrong_time:'Sai giờ'}[r.request_type]||r.request_type}</td>
          <td><span class="badge ${si.badge}">${si.label}</span></td>
          <td style="font-size:12px;color:var(--gray5)">${r.review_note||'—'}</td>
          <td style="font-size:12px;color:var(--gray5)">${r.reviewed_at?fmtDate(r.reviewed_at):'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    showEmpty('approvalHistory', '❌', e.message);
  }
}
