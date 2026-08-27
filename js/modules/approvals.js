// VELA_CHAMCONG — approvals.js
// CHT duyệt yêu cầu bù công

// ── INIT ──
async function initApprovals() {
  await loadPendingRequests();
  await loadPendingLeaveRequests();
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

    <div style="display:flex;gap:8px">
      <button onclick="approveRequest('${r.id}', '${r.user_id}', '${r.project_id}', '${r.request_date}', '${r.request_type}')"
        class="btn btn-success" style="flex:1">✅ Duyệt</button>
      <button onclick="toggleReject('${r.id}')"
        class="btn btn-danger" style="flex:1">❌ Từ chối</button>
    </div>

    <!-- Lý do từ chối - chỉ hiện khi bấm Từ chối -->
    <div id="reject-${r.id}" style="display:none;margin-top:8px">
      <textarea id="note-${r.id}" class="form-control" style="min-height:60px"
        placeholder="Nhập lý do từ chối..."></textarea>
      <button onclick="rejectRequest('${r.id}')"
        class="btn btn-danger" style="width:100%;margin-top:6px">Xác nhận từ chối</button>
    </div>
  </div>`;
}

// ── DUYỆT YÊU CẦU ──
async function approveRequest(reqId, userId, projectId, reqDate, reqType) {
  const note = ''; // CHT không cần nhập lý do khi duyệt
  const card = document.getElementById(`req-${reqId}`);

  // Disable buttons
  card.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    // 1. Kiểm tra record attendance hiện tại
    const existing = await sbFetch(
      `attendance?user_id=eq.${userId}&check_date=eq.${reqDate}&limit=1`
    );

    let attendanceId = null;
    const rec = existing[0] || null;

    // ── Trường hợp đã được bù công trước đó ──
    if (rec && rec.is_adjusted && (rec.note||'').includes('[Bù công CHT duyệt]')) {
      // Tìm tên CHT đã duyệt
      const prevCHT = STATE.users.find(u => u.id === rec.adjusted_by_id) || null;
      const prevName = prevCHT?.full_name || 'CHT khác';
      card.querySelectorAll('button').forEach(b => b.disabled = false);
      showToast(`⚠️ Đã được bù công bởi ${prevName} rồi`);
      card.innerHTML = `<div class="alert alert-warning">
        ⚠️ Yêu cầu này đã được duyệt và bù công trước đó.<br>
        <span style="font-size:12px;color:var(--gray5)">Nếu cần thay đổi, vui lòng dùng tab Điều Chỉnh.</span>
      </div>`;
      // Vẫn cập nhật request → approved để dọn sạch pending
      await sbFetch(`attendance_requests?id=eq.${reqId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved', reviewed_by: STATE.currentUser.id,
          reviewed_at: new Date().toISOString(),
          review_note: `[Đã bù công trước đó] ${note}`,
          attendance_id: rec.id
        })
      });
      return;
    }

    // ── Xử lý theo loại yêu cầu ──
    if (reqType === 'missing') {
      // Chưa chấm công
      if (rec) {
        // Đã có record thật (chấm bình thường) → chỉ thêm note, không đè data
        await sbFetch(`attendance?id=eq.${rec.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            is_adjusted: true,
            note: `[Bù công CHT duyệt - bổ sung] ${note}`
          })
        });
        attendanceId = rec.id;
        showToast('✅ Duyệt — đã bổ sung ghi chú (record gốc giữ nguyên)');
      } else {
        // Chưa có record → tạo mới
        const created = await sbFetch('attendance', {
          method: 'POST',
          body: JSON.stringify({
            user_id: userId, project_id: projectId,
            check_date: reqDate, status: 'present',
            is_adjusted: true,
            note: `[Bù công CHT duyệt] ${note}`
          })
        });
        attendanceId = created[0]?.id;
        showToast('✅ Duyệt — đã tạo record bù công');
      }

    } else if (reqType === 'missing_out') {
      // Quên check out
      if (!rec) {
        // Không có record checkin → không thể thêm checkout
        card.querySelectorAll('button').forEach(b => b.disabled = false);
        showToast('❌ Không tìm thấy record check in ngày này');
        return;
      }
      if (rec.check_out) {
        // Đã có checkout rồi
        card.querySelectorAll('button').forEach(b => b.disabled = false);
        const t = new Date(rec.check_out);
        showToast(`⚠️ Đã có check out lúc ${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')} rồi`);
        card.innerHTML = `<div class="alert alert-warning">
          ⚠️ Nhân viên đã có check out lúc <strong>${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}</strong> ngày này.<br>
          <span style="font-size:12px;color:var(--gray5)">Nếu cần sửa, dùng tab Điều Chỉnh.</span>
        </div>`;
        return;
      }
      // Thêm check_out = thời điểm duyệt
      await sbFetch(`attendance?id=eq.${rec.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          check_out: new Date().toISOString(),
          is_adjusted: true,
          note: `[Bù checkout CHT duyệt] ${note}`
        })
      });
      attendanceId = rec.id;
      showToast('✅ Duyệt — đã thêm check out');

    } else if (reqType === 'wrong_time') {
      // Chấm sai giờ → chỉ thêm note, giữ nguyên giờ (CHT không biết giờ đúng)
      if (!rec) {
        card.querySelectorAll('button').forEach(b => b.disabled = false);
        showToast('❌ Không tìm thấy record chấm công ngày này');
        return;
      }
      await sbFetch(`attendance?id=eq.${rec.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_adjusted: true,
          note: `[Xác nhận CHT - sai giờ] ${note}`
        })
      });
      attendanceId = rec.id;
      showToast('✅ Duyệt — đã xác nhận (giờ giữ nguyên)');

    } else {
      // Loại khác → xử lý như missing
      if (!rec) {
        const created = await sbFetch('attendance', {
          method: 'POST',
          body: JSON.stringify({
            user_id: userId, project_id: projectId,
            check_date: reqDate, status: 'present',
            is_adjusted: true,
            note: `[Bù công CHT duyệt] ${note}`
          })
        });
        attendanceId = created[0]?.id;
      } else {
        await sbFetch(`attendance?id=eq.${rec.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_adjusted: true, note: `[Bù công CHT duyệt] ${note}` })
        });
        attendanceId = rec.id;
      }
      showToast('✅ Đã duyệt');
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

    // Remove card with animation
    card.style.opacity = '0.5';
    setTimeout(() => { card.remove(); }, 400);

  } catch(e) {
    card.querySelectorAll('button').forEach(b => b.disabled = false);
    showToast('❌ ' + e.message);
  }
}

// ── TOGGLE FORM TỪ CHỐI ──
function toggleReject(reqId) {
  const el = document.getElementById(`reject-${reqId}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  if (el.style.display === 'block') {
    document.getElementById(`note-${reqId}`)?.focus();
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
      `attendance_requests?status=neq.pending&reviewed_by=eq.${STATE.currentUser.id}&order=reviewed_at.desc&limit=100`
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

// ============================================================
// ĐƠN XIN NGHỈ PHÉP — duyệt 3 bước: CHT → TP.HCNS → Phó TGĐ
// ============================================================

const LEAVE_TYPE_LABEL_APV = {
  om: '🤒 Nghỉ ốm', dam_tang: '⚰️ Đám tang', dam_cuoi: '💍 Đám cưới',
  sinh: '👶 Nghỉ sinh', khac: '📌 Khác', khong_luong: '💸 Không lương',
};
const LEAVE_STEP_LABEL = { pending_cht: 'Trưởng bộ phận', pending_hcns: 'TP.HCNS', pending_pho_tgd: 'Phó TGĐ' };

function emptyLeaveHtml() {
  return `<div class="empty-state"><div class="empty-icon">✅</div>Không có đơn phép nào cần bạn duyệt</div>`;
}

async function loadPendingLeaveRequests() {
  const el = document.getElementById('leaveApprovalList');
  if (!el) return;
  showLoading('leaveApprovalList');

  try {
    const u = STATE.currentUser;
    let rows = [];

    if (['site_admin','superadmin'].includes(u.role)) {
      rows = await sbFetch(`leave_requests?status=in.(pending_cht,pending_hcns,pending_pho_tgd)&order=created_at.desc&limit=100`);

    } else if (u.role === 'tp_hcns') {
      rows = await sbFetch(`leave_requests?status=eq.pending_hcns&order=created_at.desc&limit=100`);

    } else if (u.role === 'cht' || u.role === 'pho_tgd') {
      const step = u.role === 'cht' ? 'pending_cht' : 'pending_pho_tgd';
      let url = `leave_requests?status=eq.${step}&order=created_at.desc&limit=100`;

      if (u.project_scope === 'fixed') {
        if (!u.project_id) { el.innerHTML = emptyLeaveHtml(); return; }
        url += `&project_id=eq.${u.project_id}`;
      } else if (u.project_scope === 'multi') {
        const ids = u.allowed_projects || [];
        if (!ids.length) { el.innerHTML = emptyLeaveHtml(); return; }
        url += `&project_id=in.(${ids.join(',')})`;
      }
      // project_scope === 'all' → không lọc, thấy tất cả dự án

      rows = await sbFetch(url);

    } else {
      el.innerHTML = emptyLeaveHtml();
      return;
    }

    if (!rows.length) { el.innerHTML = emptyLeaveHtml(); return; }
    el.innerHTML = rows.map(r => renderLeaveApprovalCard(r)).join('');

  } catch(e) {
    showEmpty('leaveApprovalList', '❌', e.message);
  }
}

function renderLeaveApprovalCard(r) {
  const proj = STATE.projects.find(p => p.id === r.project_id);
  const user = STATE.users.find(u => u.id === r.user_id);
  const from = r.date_from.split('-').reverse().join('/');
  const to   = r.date_to.split('-').reverse().join('/');
  const stepLabel = LEAVE_STEP_LABEL[r.status] || '';

  return `<div id="lvreq-${r.id}" style="padding:16px;background:white;border:1px solid var(--gray2);
    border-radius:8px;margin-bottom:10px">

    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--gray8)">${user?.full_name||'—'}</div>
        <div style="font-size:12px;color:var(--gray5);margin-top:2px">${user?.employee_code||''} · ${proj?.code||''}</div>
      </div>
      <span class="badge badge-amber" style="flex-shrink:0">⏳ Chờ ${stepLabel}</span>
    </div>

    <div style="background:var(--gray1);border-radius:6px;padding:10px 12px;margin-bottom:12px">
      <div style="font-size:13px;color:var(--navy);font-weight:600;margin-bottom:4px">
        ${from} → ${to} · ${r.total_cong} công · ${LEAVE_TYPE_LABEL_APV[r.leave_type]||r.leave_type}
      </div>
      <div style="font-size:13px;color:var(--gray8)">📝 ${r.reason}</div>
      ${r.replacement_name ? `<div style="font-size:12px;color:var(--gray5);margin-top:6px">
        👤 Người thay thế: <strong>${r.replacement_name}</strong>${r.replacement_position?' — '+r.replacement_position:''}
      </div>` : ''}
    </div>

    <div style="display:flex;gap:8px">
      <button onclick="approveLeaveStep('${r.id}','${r.status}','${r.user_id}','${r.project_id}','${r.date_from}','${r.date_to}')"
        class="btn btn-success" style="flex:1">✅ Duyệt</button>
      <button onclick="toggleLeaveReject('${r.id}')"
        class="btn btn-danger" style="flex:1">❌ Từ chối</button>
    </div>

    <div id="lvreject-${r.id}" style="display:none;margin-top:8px">
      <textarea id="lvnote-${r.id}" class="form-control" style="min-height:60px"
        placeholder="Nhập lý do từ chối..."></textarea>
      <button onclick="rejectLeaveRequest('${r.id}','${r.status}')"
        class="btn btn-danger" style="width:100%;margin-top:6px">Xác nhận từ chối</button>
    </div>
  </div>`;
}

function toggleLeaveReject(reqId) {
  const el = document.getElementById(`lvreject-${reqId}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  if (el.style.display === 'block') document.getElementById(`lvnote-${reqId}`)?.focus();
}

async function approveLeaveStep(reqId, currentStatus, userId, projectId, dateFrom, dateTo) {
  const card = document.getElementById(`lvreq-${reqId}`);
  card.querySelectorAll('button').forEach(b => b.disabled = true);

  const stepMap = {
    pending_cht:     { field: 'cht',     next: 'pending_hcns' },
    pending_hcns:    { field: 'hcns',    next: 'pending_pho_tgd' },
    pending_pho_tgd: { field: 'pho_tgd', next: 'approved' },
  };
  const step = stepMap[currentStatus];
  if (!step) { card.querySelectorAll('button').forEach(b => b.disabled = false); return; }

  try {
    await sbFetch(`leave_requests?id=eq.${reqId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        [`${step.field}_id`]:           STATE.currentUser.id,
        [`${step.field}_approved_at`]:  new Date().toISOString(),
        status: step.next
      })
    });

    if (step.next === 'approved') {
      showToast('✅ Đã duyệt xong — đang cập nhật Bảng Công Nhóm...');
      await markAttendanceForApprovedLeave(userId, projectId, dateFrom, dateTo);
      showToast('✅ Đã duyệt đơn phép và cập nhật Bảng Công Nhóm');
    } else {
      showToast('✅ Đã duyệt — chuyển sang bước tiếp theo');
    }

    card.style.opacity = '0.5';
    setTimeout(() => card.remove(), 400);
  } catch(e) {
    card.querySelectorAll('button').forEach(b => b.disabled = false);
    showToast('❌ ' + e.message);
  }
}

async function rejectLeaveRequest(reqId, currentStatus) {
  const note = document.getElementById(`lvnote-${reqId}`)?.value.trim();
  if (!note) { showToast('⚠️ Nhập lý do từ chối'); return; }

  const stepKey = { pending_cht:'cht', pending_hcns:'hcns', pending_pho_tgd:'pho_tgd' }[currentStatus] || '';
  const card = document.getElementById(`lvreq-${reqId}`);
  card.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    await sbFetch(`leave_requests?id=eq.${reqId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status:            'rejected',
        rejected_by:       STATE.currentUser.id,
        rejected_at:       new Date().toISOString(),
        rejected_at_step:  stepKey,
        reject_note:       note
      })
    });
    showToast('✅ Đã từ chối đơn phép');
    card.style.opacity = '0.5';
    setTimeout(() => card.remove(), 400);
  } catch(e) {
    card.querySelectorAll('button').forEach(b => b.disabled = false);
    showToast('❌ ' + e.message);
  }
}

// Tự động đánh dấu status='leave' vào bảng attendance cho các ngày đã duyệt
// (bỏ qua Chủ nhật, và KHÔNG ghi đè nếu ngày đó đã có chấm công thật)
async function markAttendanceForApprovedLeave(userId, projectId, dateFrom, dateTo) {
  let d = new Date(dateFrom + 'T00:00:00');
  const end = new Date(dateTo + 'T00:00:00');

  while (d <= end) {
    if (d.getDay() !== 0) {
      const dateStr = localDateStr(d);
      try {
        const existing = await sbFetch(`attendance?user_id=eq.${userId}&check_date=eq.${dateStr}&limit=1`);
        if (existing.length && existing[0].check_time) {
          // Đã có chấm công thật ngày này — không ghi đè
        } else if (existing.length) {
          await sbFetch(`attendance?id=eq.${existing[0].id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'leave', is_adjusted: true, note: '[Nghỉ phép đã duyệt]' })
          });
        } else {
          await sbFetch('attendance', {
            method: 'POST',
            body: JSON.stringify({
              user_id: userId, project_id: projectId, check_date: dateStr,
              status: 'leave', is_adjusted: true, note: '[Nghỉ phép đã duyệt]'
            })
          });
        }
      } catch(e) {
        console.warn('Không đánh dấu được ngày', dateStr, e.message);
      }
    }
    d.setDate(d.getDate() + 1);
  }
}
