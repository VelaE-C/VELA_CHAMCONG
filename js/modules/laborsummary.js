// ============================================================
// VELA_CHAMCONG — js/modules/laborsummary.js
// Tổng Hợp Nhân Công Dự Án — chỉ site_admin & superadmin xem được
// Lọc theo nhiều dự án + khoảng ngày + loại công nhân, xuất PDF
// ============================================================

let _lsProjects = [];   // { id, code, name } — danh sách dự án (Supabase A)
let _lsRows = [];       // dữ liệu attendance_logs (Supabase B) sau khi lọc (chưa gộp — dùng cho timeline)
let _lsInited = false;
let _lsChart = null;    // Chart.js instance của timeline

const LS_CAT_COLORS = {
  qty_ketcau:    '#1A2B4A', // navy
  qty_hoanthien: '#0D9488', // teal
  qty_mep:       '#D97706', // amber
  qty_congnhat:  '#2563EB', // blue
  qty_khac:      '#F97316', // orange
};
const LS_SNAP_COLORS = ['#1A2B4A','#2563EB','#0D9488','#16A34A','#D97706','#DC2626','#F97316','#7C3AED','#0369A1','#92400E'];

async function initLaborSummary() {
  const today = localDateStr(new Date());
  const firstOfMonth = today.slice(0, 8) + '01';
  const fromEl = document.getElementById('lsDateFrom');
  const toEl   = document.getElementById('lsDateTo');
  if (fromEl && !fromEl.value) fromEl.value = firstOfMonth;
  if (toEl && !toEl.value)     toEl.value   = today;

  const snapEl = document.getElementById('lsSnapDate');
  if (snapEl && !snapEl.value) snapEl.value = today;

  if (!_lsInited) {
    await lsLoadProjects();
    _lsInited = true;
    lsRenderSnapshot(); // tự động xem thẻ báo cáo hôm nay khi vào tab lần đầu
  }
}

async function lsLoadProjects() {
  const box = document.getElementById('lsProjectFilter');
  try {
    const res = await sbFetch('projects?select=id,code,name&is_active=eq.true&order=code');
    _lsProjects = res || [];
  } catch (e) {
    console.error(e);
    showToast('❌ Lỗi tải danh sách dự án');
    _lsProjects = [];
  }

  if (!box) return;

  if (_lsProjects.length === 0) {
    box.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-icon">🗂</div>Không có dự án nào</div>';
    return;
  }

  box.innerHTML = `
    <label class="ls-checkbox-item" style="font-weight:600;border-bottom:1px solid var(--gray2);padding-bottom:8px;margin-bottom:4px">
      <input type="checkbox" id="lsSelectAll" checked onchange="lsToggleAll(this.checked)">
      <span>Chọn tất cả</span>
    </label>
    ${_lsProjects.map(p => `
      <label class="ls-checkbox-item">
        <input type="checkbox" class="ls-project-cb" value="${p.code}" checked>
        <span>${p.code} — ${p.name}</span>
      </label>
    `).join('')}
  `;
}

function lsToggleAll(checked) {
  document.querySelectorAll('.ls-project-cb').forEach(cb => (cb.checked = checked));
}

function lsGetSelectedCodes() {
  return Array.from(document.querySelectorAll('.ls-project-cb:checked')).map(cb => cb.value);
}

async function lsApplyFilter() {
  const codes = lsGetSelectedCodes();
  const dateFrom = document.getElementById('lsDateFrom').value;
  const dateTo   = document.getElementById('lsDateTo').value;
  const laborType = document.getElementById('lsLaborType').value;

  if (codes.length === 0) { showToast('⚠️ Chọn ít nhất 1 dự án'); return; }
  if (!dateFrom || !dateTo || dateFrom > dateTo) { showToast('⚠️ Khoảng ngày không hợp lệ'); return; }

  const resultArea = document.getElementById('lsResultArea');
  resultArea.innerHTML = '<div class="loading" style="margin-top:16px"><span class="loading-spinner"></span> Đang tải dữ liệu...</div>';
  document.getElementById('lsExportBtn').disabled = true;

  try {
    const codesFilter = codes.map(c => `"${c}"`).join(',');
    const query =
      `attendance_logs?select=project_code,report_date,qty_ketcau,qty_hoanthien,qty_mep,qty_congnhat,qty_khac,qty_total,qty_bch` +
      `&project_code=in.(${codesFilter})&report_date=gte.${dateFrom}&report_date=lte.${dateTo}` +
      `&order=project_code,report_date&limit=10000`;
    const rows = await sb2Fetch(query, { headers: { Range: '0-9999' } });
    _lsRows = rows || [];
    lsRenderResult(dateFrom, dateTo, laborType);
  } catch (e) {
    console.error(e);
    resultArea.innerHTML = '<div class="alert alert-danger">Lỗi tải dữ liệu báo cáo</div>';
    showToast('❌ Lỗi tải dữ liệu');
  }
}

function lsRenderResult(dateFrom, dateTo, laborType) {
  const resultArea = document.getElementById('lsResultArea');
  const exportBtn = document.getElementById('lsExportBtn');
  const trendCard = document.getElementById('lsTrendCard');

  if (_lsRows.length === 0) {
    resultArea.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">📊</div>Không có dữ liệu trong khoảng thời gian đã chọn</div></div>';
    exportBtn.disabled = true;
    if (trendCard) trendCard.style.display = 'none';
    return;
  }

  // Gộp dữ liệu theo dự án (project_code)
  const byProject = {};
  _lsRows.forEach(r => {
    if (!byProject[r.project_code]) {
      byProject[r.project_code] = {
        code: r.project_code,
        qty_ketcau: 0, qty_hoanthien: 0, qty_mep: 0, qty_congnhat: 0, qty_khac: 0, qty_total: 0,
        days: 0,
      };
    }
    const p = byProject[r.project_code];
    p.qty_ketcau    += r.qty_ketcau    || 0;
    p.qty_hoanthien += r.qty_hoanthien || 0;
    p.qty_mep       += r.qty_mep       || 0;
    p.qty_congnhat  += r.qty_congnhat  || 0;
    p.qty_khac      += r.qty_khac      || 0;
    p.qty_total     += r.qty_total     || 0;
    p.days += 1;
  });

  const projectRows = Object.values(byProject).sort((a, b) => a.code.localeCompare(b.code));

  const grand = projectRows.reduce((acc, p) => {
    acc.qty_ketcau    += p.qty_ketcau;
    acc.qty_hoanthien += p.qty_hoanthien;
    acc.qty_mep       += p.qty_mep;
    acc.qty_congnhat  += p.qty_congnhat;
    acc.qty_khac      += p.qty_khac;
    acc.qty_total     += p.qty_total;
    return acc;
  }, { qty_ketcau: 0, qty_hoanthien: 0, qty_mep: 0, qty_congnhat: 0, qty_khac: 0, qty_total: 0 });

  const cols = [
    { key: 'qty_ketcau',    label: '🏗 KC' },
    { key: 'qty_hoanthien', label: '🎨 HT' },
    { key: 'qty_mep',       label: '⚡ MEP' },
    { key: 'qty_congnhat',  label: '📅 Công nhật' },
    { key: 'qty_khac',      label: '🔨 Khác' },
  ];
  const visibleCols = laborType === 'all' ? cols : cols.filter(c => c.key === laborType);

  resultArea.innerHTML = `
    <div class="card" id="lsPrintArea">
      <div class="ls-print-header">
        <img src="https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png" class="ls-print-logo" alt="VelaE&C">
        <div>
          <div style="font-weight:700;color:var(--navy);font-size:16px">BÁO CÁO TỔNG HỢP NHÂN CÔNG DỰ ÁN</div>
          <div style="font-size:12px;color:var(--gray5)">Từ ${lsFmtDate(dateFrom)} đến ${lsFmtDate(dateTo)} · ${projectRows.length} dự án</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dự án</th>
              ${visibleCols.map(c => `<th>${c.label}</th>`).join('')}
              <th>Tổng CN</th>
              <th>Số ngày BC</th>
            </tr>
          </thead>
          <tbody>
            ${projectRows.map(p => `
              <tr>
                <td><strong>${p.code}</strong></td>
                ${visibleCols.map(c => `<td>${p[c.key]}</td>`).join('')}
                <td><strong>${p.qty_total}</strong></td>
                <td>${p.days}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#EFF6FF">
              <td style="font-weight:700;color:var(--navy)">TỔNG CỘNG</td>
              ${visibleCols.map(c => `<td style="font-weight:700;color:var(--navy)">${grand[c.key]}</td>`).join('')}
              <td style="font-weight:700;color:var(--navy)">${grand.qty_total}</td>
              <td>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="text-align:right;font-size:11px;color:var(--gray5);margin-top:10px">Xuất báo cáo lúc ${new Date().toLocaleString('vi-VN')}</div>
    </div>
  `;

  exportBtn.disabled = false;

  // Cập nhật dropdown chọn dự án cho Timeline + vẽ lại
  if (trendCard) {
    trendCard.style.display = '';
    const sel = document.getElementById('lsTrendProject');
    const curVal = sel.value;
    sel.innerHTML = projectRows.map(p => `<option value="${p.code}">${p.code}</option>`).join('');
    sel.value = projectRows.some(p => p.code === curVal) ? curVal : projectRows[0].code;
    lsRenderTrendChart();
  }
}

function lsFmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function lsExportPDF() {
  const el = document.getElementById('lsPrintArea');
  if (!el) return;
  showToast('⏳ Đang tạo PDF...');

  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth  = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);
    }

    const dateFrom = document.getElementById('lsDateFrom').value;
    const dateTo   = document.getElementById('lsDateTo').value;
    pdf.save(`TongHopNhanCong_${dateFrom}_${dateTo}.pdf`);
    showToast('✅ Đã xuất PDF thành công');
  } catch (e) {
    console.error(e);
    showToast('❌ Lỗi khi xuất PDF');
  }
}

// ── Timeline theo dự án (line tổng CN + bar 5 loại) ──
function lsRenderTrendChart() {
  const sel = document.getElementById('lsTrendProject');
  if (!sel || !sel.value) return;
  const code = sel.value;

  const rows = _lsRows
    .filter(r => r.project_code === code)
    .sort((a, b) => a.report_date.localeCompare(b.report_date));

  if (_lsChart) { _lsChart.destroy(); _lsChart = null; }
  if (rows.length === 0) return;

  const labels = rows.map(r => lsFmtDate(r.report_date));
  const catKeys = [
    { key: 'qty_ketcau',    label: 'CN Kết cấu' },
    { key: 'qty_hoanthien', label: 'CN Hoàn thiện' },
    { key: 'qty_mep',       label: 'CN MEP' },
    { key: 'qty_congnhat',  label: 'CN Công nhật' },
    { key: 'qty_khac',      label: 'CN Khác' },
  ];

  const ctx = document.getElementById('lsTrendChart');
  _lsChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Tổng CN',
          data: rows.map(r => r.qty_total || 0),
          borderColor: '#DC2626',
          backgroundColor: 'rgba(220,38,38,.1)',
          tension: 0.3,
          pointRadius: 3,
          fill: true,
          order: 0,
        },
        ...catKeys.map(c => ({
          type: 'bar',
          label: c.label,
          data: rows.map(r => r[c.key] || 0),
          backgroundColor: LS_CAT_COLORS[c.key] + 'cc',
          borderColor: LS_CAT_COLORS[c.key],
          borderWidth: 1,
          borderRadius: 3,
          order: 1,
        })),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
      },
      scales: {
        x: { ticks: { font: { size: 10 }, autoSkip: true, maxRotation: 45 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: { size: 11 } } },
      },
    },
  });
}

// ── Thẻ báo cáo nhanh dạng ảnh (1 ngày, tất cả dự án đang chọn) ──
async function lsRenderSnapshot() {
  const date = document.getElementById('lsSnapDate').value;
  const area = document.getElementById('lsSnapArea');
  const saveBtn = document.getElementById('lsSnapSaveBtn');
  if (!date) return;

  area.innerHTML = '<div class="loading" style="margin-top:12px"><span class="loading-spinner"></span> Đang tải...</div>';
  saveBtn.disabled = true;

  // Ưu tiên dùng đúng các dự án đang tick trong bộ lọc; nếu chưa tick gì thì lấy tất cả
  let codes = lsGetSelectedCodes();
  if (codes.length === 0) codes = _lsProjects.map(p => p.code);
  if (codes.length === 0) {
    area.innerHTML = '<div class="empty-state"><div class="empty-icon">🗂</div>Chưa có dự án nào</div>';
    return;
  }

  try {
    const codesFilter = codes.map(c => `"${c}"`).join(',');
    const query =
      `attendance_logs?select=project_code,qty_ketcau,qty_hoanthien,qty_mep,qty_congnhat,qty_khac,qty_total,qty_bch` +
      `&project_code=in.(${codesFilter})&report_date=eq.${date}&order=qty_total.desc`;
    const rows = await sb2Fetch(query);

    if (!rows || rows.length === 0) {
      area.innerHTML = '<div class="empty-state"><div class="empty-icon">🖼</div>Không có báo cáo quân số cho ngày này</div>';
      saveBtn.disabled = true;
      return;
    }

    const totalCN  = rows.reduce((s, r) => s + (r.qty_total || 0), 0);
    const totalBCH = rows.reduce((s, r) => s + (r.qty_bch || 0), 0);

    area.innerHTML = `
      <div class="ls-snap-card" id="lsSnapCard">
        <div class="ls-snap-header">
          <img src="https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png" alt="VelaE&C">
          <div class="ls-snap-header-r">
            <div class="ls-snap-label">Báo cáo quân số</div>
            <div class="ls-snap-date">${lsFmtDate(date)}</div>
          </div>
        </div>
        <div class="ls-snap-total">
          <div>
            <div class="ls-snap-big">${totalCN}</div>
            <div class="ls-snap-big-label">Công nhân</div>
          </div>
          <div>
            <div class="ls-snap-bch">${totalBCH}</div>
            <div class="ls-snap-bch-label">BCH</div>
          </div>
        </div>
        <div>
          ${rows.map((r, i) => {
            const pct = totalCN > 0 ? Math.round((r.qty_total || 0) / totalCN * 100) : 0;
            const color = LS_SNAP_COLORS[i % LS_SNAP_COLORS.length];
            return `
              <div class="ls-snap-item" style="--item-color:${color}">
                <div class="ls-snap-left">
                  <div class="ls-snap-name">${r.project_code}</div>
                  <div class="ls-snap-bar-bg"><div class="ls-snap-bar-fill" style="width:${pct}%;background:${color}"></div></div>
                </div>
                <div class="ls-snap-right">
                  <div class="ls-snap-cn" style="color:${color}">${r.qty_total || 0}</div>
                  <div class="ls-snap-bchcount">${r.qty_bch || 0} BCH</div>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div class="ls-snap-footer">
          <span>${rows.length} dự án</span>
          <span>VelaE&C · Cập nhật ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    `;
    saveBtn.disabled = false;
  } catch (e) {
    console.error(e);
    area.innerHTML = '<div class="alert alert-danger">Lỗi tải dữ liệu thẻ báo cáo</div>';
    showToast('❌ Lỗi tải dữ liệu');
  }
}

async function lsSaveSnapshotImage() {
  const card = document.getElementById('lsSnapCard');
  if (!card) return;
  showToast('⏳ Đang tạo ảnh...');

  try {
    const canvas = await html2canvas(card, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
    const date = document.getElementById('lsSnapDate').value || 'baocao';
    const link = document.createElement('a');
    link.download = `VELA_QuanSo_${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('✅ Đã lưu ảnh');
  } catch (e) {
    console.error(e);
    showToast('❌ Lỗi tạo ảnh');
  }
}
