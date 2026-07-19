// VELA_CHAMCONG — adjust.js
// Điều chỉnh công + audit trail

// ── ADJUST ──
async function initAdjust() {
  // Populate user select
  const sel = document.getElementById('adjUser');
  const filterSel = document.getElementById('adjFilterUser');
  if (sel && sel.options.length <= 1) {
    sel.innerHTML = '<option value="">-- Chọn nhân viên --</option>';
    if (filterSel) filterSel.innerHTML = '<option value="">Tất cả nhân viên</option>';
    STATE.users.forEach(u => {
      sel.innerHTML += `<option value="${u.id}">${u.full_name} (${u.employee_code||u.email})</option>`;
      if (filterSel) filterSel.innerHTML += `<option value="${u.id}">${u.full_name}</option>`;
    });
  }

  // Populate project select
  const psel = document.getElementById('adjProject');
  if (psel && psel.options.length <= 1) {
    psel.innerHTML = '<option value="">-- Chọn dự án --</option>';
    STATE.projects.forEach(p => {
      psel.innerHTML += `<option value="${p.id}">${p.code} — ${p.name}</option>`;
    });
  }

  // Default date = today
  const dateEl = document.getElementById('adjDate');
  if (dateEl && !dateEl.value) dateEl.value = localDateStr();

  await loadAdjHistory();
}

async function adjLoadExisting() {
  const userId = document.getElementById('adjUser').value;
  const date = document.getElementById('adjDate').value;
  const info = document.getElementById('adjExistingInfo');
  const infoText = document.getElementById('adjExistingText');
  const projSel = document.getElementById('adjProject');
  const statusSel = document.getElementById('adjStatus');

  if (!userId || !date) { info.style.display='none'; return; }

  try {
    const rows = await sbFetch(`attendance?user_id=eq.${userId}&check_date=eq.${date}&limit=1`);
    if (rows.length) {
      const r = rows[0];
      const proj = STATE.projects.find(p => p.id === r.project_id);
      const statusMap = { present:'✅ Có mặt', absent:'❌ Vắng', leave:'🏖️ Nghỉ phép', holiday:'🎌 Nghỉ lễ' };
      const ct = new Date(r.check_time);
      info.style.display = 'block';
      infoText.innerHTML = `Đã có record: <strong>${statusMap[r.status]||r.status}</strong> tại <strong>${proj?.code||'—'}</strong> lúc ${ct.getHours()}:${String(ct.getMinutes()).padStart(2,'0')}${r.is_adjusted?' <span style="color:var(--amber)">(đã điều chỉnh)</span>':''}`;
      if (projSel && r.project_id) projSel.value = r.project_id;
      if (statusSel) statusSel.value = r.status;
    } else {
      info.style.display = 'block';
      infoText.innerHTML = '<span style="color:var(--gray5)">Chưa có record ngày này — sẽ tạo mới</span>';
    }
  } catch(e) { info.style.display='none'; }
}

async function submitAdjust() {
  const userId = document.getElementById('adjUser').value;
  const date = document.getElementById('adjDate').value;
  const projectId = document.getElementById('adjProject').value;
  const status = document.getElementById('adjStatus').value;
  const reason = document.getElementById('adjReason').value.trim();

  if (!userId) { showToast('⚠️ Chọn nhân viên'); return; }
  if (!date) { showToast('⚠️ Chọn ngày'); return; }
  if (!projectId) { showToast('⚠️ Chọn dự án'); return; }
  if (!reason) { showToast('⚠️ Nhập lý do điều chỉnh'); return; }

  const btn = document.getElementById('adjSubmitBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang lưu...';

  try {
    // Check existing
    const existing = await sbFetch(`attendance?user_id=eq.${userId}&check_date=eq.${date}&limit=1`);
    let attId;

    if (existing.length) {
      // Update existing
      const oldStatus = existing[0].status;
      await sbFetch(`attendance?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, project_id: projectId, is_adjusted: true, note: reason })
      });
      attId = existing[0].id;

      // Log adjustment
      await sbFetch('adjustments', {
        method: 'POST',
        body: JSON.stringify({
          attendance_id: attId,
          user_id: userId,
          check_date: date,
          old_status: oldStatus,
          new_status: status,
          reason,
          adjusted_by: STATE.currentUser.id
        })
      });
    } else {
      // Create new record
      const created = await sbFetch('attendance', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          project_id: projectId,
          check_date: date,
          check_time: new Date(date + 'T08:00:00').toISOString(),
          status,
          is_adjusted: true,
          note: reason
        })
      });
      attId = created[0]?.id;

      // Log adjustment
      if (attId) {
        await sbFetch('adjustments', {
          method: 'POST',
          body: JSON.stringify({
            attendance_id: attId,
            user_id: userId,
            check_date: date,
            old_status: null,
            new_status: status,
            reason,
            adjusted_by: STATE.currentUser.id
          })
        });
      }
    }

    const u = STATE.users.find(x => x.id === userId);
    showToast(`✅ Đã điều chỉnh công ${u?.full_name||''} ngày ${date.split('-').reverse().join('/')}`);
    clearAdjustForm();
    await loadAdjHistory();
  } catch(e) {
    showToast('❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Lưu điều chỉnh';
  }
}

function clearAdjustForm() {
  document.getElementById('adjUser').value = '';
  document.getElementById('adjDate').value = localDateStr();
  document.getElementById('adjProject').value = '';
  document.getElementById('adjStatus').value = 'present';
  document.getElementById('adjReason').value = '';
  document.getElementById('adjExistingInfo').style.display = 'none';
}

async function loadAdjHistory() {
  const el = document.getElementById('adjHistory'); if (!el) return;
  const filterUserId = document.getElementById('adjFilterUser')?.value || '';
  el.innerHTML = '<div class="loading"><span class="spinner"></span> Đang tải...</div>';

  try {
    let url = 'adjustments?order=adjusted_at.desc&limit=50';
    if (filterUserId) url += `&user_id=eq.${filterUserId}`;

    const rows = await sbFetch(url);
    if (!rows.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div>Chưa có điều chỉnh nào</div>';
      return;
    }

    const statusMap = { present:'✅ Có mặt', absent:'❌ Vắng', leave:'🏖️ Nghỉ phép', holiday:'🎌 Nghỉ lễ' };
    el.innerHTML = `<div class="att-table-wrap"><table>
      <thead><tr>
        <th>Ngày</th><th>Nhân viên</th>
        <th>Cũ → Mới</th>
        <th>Lý do</th>
        <th>Người điều chỉnh</th>
        <th>Thời gian</th>
      </tr></thead>
      <tbody>${rows.map((r,i) => {
        const u = STATE.users.find(x => x.id === r.user_id);
        const adjBy = STATE.users.find(x => x.id === r.adjusted_by);
        const adjTime = new Date(r.adjusted_at);
        const bg = i%2===0?'':'background:rgba(255,255,255,.02)';
        return `<tr style="${bg}">
          <td style="font-family:monospace;white-space:nowrap">${r.check_date.split('-').reverse().join('/')}</td>
          <td style="font-weight:500;color:var(--gray8)">${u?.full_name||'—'}</td>
          <td style="white-space:nowrap">
            <span style="color:var(--gray5);font-size:12px">${r.old_status?statusMap[r.old_status]:'(mới)'}</span>
            <span style="color:var(--gray5)"> → </span>
            <span style="color:var(--green);font-weight:600;font-size:12px">${statusMap[r.new_status]||r.new_status}</span>
          </td>
          <td style="font-size:13px;color:var(--gray7)">${r.reason}</td>
          <td style="font-size:12px;color:var(--gray5)">${adjBy?.full_name||'—'}</td>
          <td style="font-size:12px;color:var(--gray5);white-space:nowrap">
            ${adjTime.toLocaleDateString('vi-VN')} ${adjTime.getHours()}:${String(adjTime.getMinutes()).padStart(2,'0')}
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    el.innerHTML = '<div class="empty-state">❌ ' + e.message + '</div>';
  }
}

