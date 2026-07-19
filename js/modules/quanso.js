// VELA_CHAMCONG — quanso.js
// Báo cáo quân số → Supabase B (Tiến Độ)

// ── QUAN SO ──
// State: map project_id (ChamCong A) → project in Tiến Độ B
 // chamcong_code → {id, code, name} in B

async function initQuanSo() {
  const todayEl = document.getElementById('qsNgay');
  if (todayEl && !todayEl.value) todayEl.value = localDateStr();

  // Populate dropdown from STATE.projects (Supabase A - ChamCong)
  const accessible = getAccessibleProjects();
  const sel = document.getElementById('qsDuAn');
  const filterSel = document.getElementById('qsFilterProject');
  sel.innerHTML = '<option value="">-- Chọn dự án --</option>';
  if (filterSel) filterSel.innerHTML = '<option value="">Tất cả dự án</option>';

  accessible.forEach(p => {
    sel.innerHTML += `<option value="${p.id}" data-code="${p.code}">${p.code} — ${p.name}</option>`;
    if (filterSel) filterSel.innerHTML += `<option value="${p.id}" data-code="${p.code}">${p.code}</option>`;
  });

  // Load project map from Supabase B (for UUID mapping)
  try {
    const projsB = await sb2Fetch('projects?order=code&select=id,code,name');
    qsProjectMap = {};
    projsB.forEach(p => { qsProjectMap[p.code] = p; });
  } catch(e) {
    console.warn('Không load được projects từ Tiến Độ:', e.message);
  }

  await loadQuanSoHistory();
}

function calcTotal() {
  const kc   = parseInt(document.getElementById('qsKetCau').value)||0;
  const ht   = parseInt(document.getElementById('qsHoanThien').value)||0;
  const mep  = parseInt(document.getElementById('qsMEP').value)||0;
  const cn   = parseInt(document.getElementById('qsCongNhat').value)||0;
  const khac = parseInt(document.getElementById('qsKhac').value)||0;
  document.getElementById('qsTotal').textContent = kc + ht + mep + cn + khac;
}

async function onQsDuAnChange() {
  await checkExistingReport();
  await autoFillBCH();
}

async function onQsNgayChange() {
  await checkExistingReport();
  await autoFillBCH();
}

// Auto-count BCH from attendance table (Supabase A)
async function autoFillBCH() {
  const projectId = document.getElementById('qsDuAn').value;
  const ngay = document.getElementById('qsNgay').value;
  const infoDiv = document.getElementById('qsBCHInfo');
  const infoText = document.getElementById('qsBCHInfoText');
  if (!projectId || !ngay) { infoDiv.style.display='none'; return; }
  try {
    const rows = await sbFetch(
      `attendance?project_id=eq.${projectId}&check_date=eq.${ngay}&status=eq.present`
    );
    const count = rows.length;
    document.getElementById('qsBCH').value = count;
    infoDiv.style.display = 'block';
    infoText.textContent = `Tự động đếm từ bảng chấm công: ${count} người có mặt ngày ${ngay.split('-').reverse().join('/')}`;
  } catch(e) {
    infoDiv.style.display = 'none';
  }
}

// Find matching project in Supabase B by code similarity
async function checkExistingReport() {
  const sel = document.getElementById('qsDuAn');
  const projectIdA = sel.value;
  const codeA = sel.options[sel.selectedIndex]?.dataset?.code || '';
  const ngay = document.getElementById('qsNgay').value;
  const warn = document.getElementById('qsExistingWarn');
  if (!projectIdA || !ngay) { warn.style.display='none'; return; }

  const projB = findProjectB(codeA);
  if (!projB) { warn.style.display='none'; return; }

  try {
    const rows = await sb2Fetch(
      `attendance_logs?project_id=eq.${projB.id}&report_date=eq.${ngay}&limit=1`
    );
    if (rows.length) {
      warn.style.display = 'block';
      document.getElementById('qsKetCau').value   = rows[0].qty_ketcau    || 0;
      document.getElementById('qsHoanThien').value = rows[0].qty_hoanthien || 0;
      document.getElementById('qsMEP').value       = rows[0].qty_mep       || 0;
      document.getElementById('qsCongNhat').value  = rows[0].qty_congnhat  || 0;
      document.getElementById('qsKhac').value      = rows[0].qty_khac      || 0;
      document.getElementById('qsBCH').value       = rows[0].qty_bch       || 0;
      document.getElementById('qsNote').value      = rows[0].note          || '';
      calcTotal();
    } else {
      warn.style.display = 'none';
      // Reset fields
      ['qsKetCau','qsHoanThien','qsMEP','qsCongNhat','qsKhac'].forEach(id => document.getElementById(id).value=0);
      document.getElementById('qsNote').value = '';
      calcTotal();
    }
  } catch(e) { warn.style.display='none'; }
}

async function submitQuanSo() {
  const sel = document.getElementById('qsDuAn');
  const projectIdA = sel.value;
  const codeA = sel.options[sel.selectedIndex]?.dataset?.code || '';
  const ngay  = document.getElementById('qsNgay').value;
  const kc    = parseInt(document.getElementById('qsKetCau').value)||0;
  const ht    = parseInt(document.getElementById('qsHoanThien').value)||0;
  const mep   = parseInt(document.getElementById('qsMEP').value)||0;
  const cn    = parseInt(document.getElementById('qsCongNhat').value)||0;
  const khac  = parseInt(document.getElementById('qsKhac').value)||0;
  const bch   = parseInt(document.getElementById('qsBCH').value)||0;
  const note  = document.getElementById('qsNote').value.trim();

  if (!projectIdA) { showToast('⚠️ Chọn dự án trước'); return; }
  if (!ngay)       { showToast('⚠️ Chọn ngày báo cáo'); return; }
  if (kc+ht+mep+cn+khac === 0) {
    if (!confirm('Tổng nhân công = 0. Bạn có chắc muốn lưu?')) return;
  }

  // Find matching project in Supabase B
  const projB = findProjectB(codeA);
  if (!projB) {
    showToast(`❌ Không tìm thấy dự án "${codeA}" trong hệ thống Tiến Độ`);
    return;
  }

  const btn = document.getElementById('qsSubmitBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang lưu...';

  try {
    await sb2Fetch('attendance_logs?on_conflict=project_id,report_date', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        project_id:    projB.id,
        project_code:  projB.code,
        report_date:   ngay,
        qty_ketcau:    kc,
        qty_hoanthien: ht,
        qty_mep:       mep,
        qty_congnhat:  cn,
        qty_khac:      khac,
        qty_bch:       bch,
        reported_by:   STATE.currentUser.email || '',
        note:          note
      })
    });
    const dateDisplay = ngay.split('-').reverse().join('/');
    showToast(`✅ Đã lưu báo cáo ${projB.code} ngày ${dateDisplay}`);
    document.getElementById('qsExistingWarn').style.display = 'none';
    await loadQuanSoHistory();
  } catch(e) {
    showToast('❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Lưu báo cáo';
  }
}

async function loadQuanSoHistory() {
  const el = document.getElementById('qsHistory'); if (!el) return;
  const filterEl = document.getElementById('qsFilterProject');
  const filterCodeA = filterEl?.options[filterEl.selectedIndex]?.dataset?.code || '';
  el.innerHTML = '<div class="loading"><span class="spinner"></span> Đang tải...</div>';
  try {
    let url = 'attendance_logs?order=report_date.desc&limit=50';
    if (filterCodeA) {
      const projB = findProjectB(filterCodeA);
      if (projB) url += `&project_id=eq.${projB.id}`;
    }
    const rows = await sb2Fetch(url);
    if (!rows.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>Chưa có dữ liệu</div>';
      return;
    }
    el.innerHTML = `<div class="att-table-wrap"><table>
      <thead><tr>
        <th>Ngày</th><th>Dự án</th>
        <th style="text-align:center">KC</th>
        <th style="text-align:center">HT</th>
        <th style="text-align:center">MEP</th>
        <th style="text-align:center">CN nhật</th>
        <th style="text-align:center">CN khác</th>
        <th style="text-align:center;color:var(--amber)">Tổng</th>
        <th style="text-align:center">BCH</th>
        <th>Người nhập</th><th>Ghi chú</th>
      </tr></thead>
      <tbody>${rows.map((r,i) => {
        const d = r.report_date.split('-').reverse().join('/');
        const bg = i%2===0?'':'background:rgba(255,255,255,.02)';
        return `<tr style="${bg}">
          <td style="font-family:monospace;white-space:nowrap">${d}</td>
          <td><span style="color:var(--amber);font-weight:600;font-size:12px">${r.project_code||'—'}</span></td>
          <td style="text-align:center">${r.qty_ketcau||0}</td>
          <td style="text-align:center">${r.qty_hoanthien||0}</td>
          <td style="text-align:center">${r.qty_mep||0}</td>
          <td style="text-align:center">${r.qty_congnhat||0}</td>
          <td style="text-align:center">${r.qty_khac||0}</td>
          <td style="text-align:center;font-weight:700;color:var(--amber)">${r.qty_total||0}</td>
          <td style="text-align:center">${r.qty_bch||0}</td>
          <td style="font-size:12px;color:var(--gray5)">${(r.reported_by||'').split('@')[0]}</td>
          <td style="font-size:12px;color:var(--gray5)">${r.note||'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    el.innerHTML = '<div class="empty-state">❌ ' + e.message + '</div>';
  }
}
