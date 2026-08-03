// ============================================================
// VELA_CHAMCONG — js/modules/laborsummary.js
// Tổng Hợp Nhân Công Dự Án — chỉ site_admin & superadmin xem được
// Lọc theo nhiều dự án + preset thời gian + loại công nhân
// Số liệu hiển thị: TRUNG BÌNH THEO NGÀY trong khoảng đã chọn
// ============================================================
//
// LƯU Ý QUAN TRỌNG: danh sách dự án để lọc lấy trực tiếp từ các
// project_code ĐÃ TỪNG XUẤT HIỆN trong attendance_logs (Supabase B),
// KHÔNG lấy từ bảng projects (Supabase A) — vì 2 nguồn này có thể
// lệch mã dự án (quân số dùng normalizeCode() fuzzy-match khi nhập,
// không đảm bảo khớp tuyệt đối với mã bên Supabase A). Lấy trực tiếp
// từ Supabase B đảm bảo lọc đúng 100% với dữ liệu thật.

let _lsProjectCodes = [];  // danh sách mã dự án (distinct, từ attendance_logs)
let _lsRows = [];          // dữ liệu attendance_logs sau khi lọc (chưa gộp — dùng cho bảng + timeline)
let _lsInited = false;
let _lsChart = null;       // Chart.js instance của timeline
let _lsPreset = 'all';     // 'all' | 'week' | 'month' | 'quarter'

const LS_CAT_COLORS = {
  qty_ketcau:    '#1A2B4A', // navy
  qty_hoanthien: '#0D9488', // teal
  qty_mep:       '#D97706', // amber
  qty_congnhat:  '#2563EB', // blue
  qty_khac:      '#F97316', // orange
};

async function initLaborSummary() {
  if (!_lsInited) {
    await lsLoadProjects();
    _lsInited = true;
  }
}

function lsSetPreset(preset) {
  _lsPreset = preset;
  document.querySelectorAll('.ls-preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });
}

function lsGetDateRangeFromPreset() {
  if (_lsPreset === 'all') return { from: null, to: null };
  const today = localDateStr(new Date());
  const d = new Date();
  if (_lsPreset === 'week')    d.setDate(d.getDate() - 7);
  else if (_lsPreset === 'month')   d.setMonth(d.getMonth() - 1);
  else if (_lsPreset === 'quarter') d.setMonth(d.getMonth() - 3);
  return { from: localDateStr(d), to: today };
}

// ── Lấy danh sách dự án — trực tiếp từ attendance_logs ──
async function lsLoadProjects() {
  const box = document.getElementById('lsProjectFilter');
  try {
    const rows = await sb2Fetch(
      'attendance_logs?select=project_code&order=project_code&limit=10000',
      { headers: { Range: '0-9999' } }
    );
    const set = new Set((rows || []).map(r => r.project_code).filter(Boolean));
    _lsProjectCodes = [...set].sort();
  } catch (e) {
    console.error(e);
    showToast('❌ Lỗi tải danh sách dự án');
    _lsProjectCodes = [];
  }

  if (!box) return;

  if (_lsProjectCodes.length === 0) {
    box.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-icon">🗂</div>Chưa có dữ liệu quân số nào được nhập</div>';
    return;
  }

  box.innerHTML = `
    <label class="ls-checkbox-item" style="font-weight:600;border-bottom:1px solid var(--gray2);padding-bottom:8px;margin-bottom:4px">
      <input type="checkbox" id="lsSelectAll" checked onchange="lsToggleAll(this.checked)">
      <span>Chọn tất cả</span>
    </label>
    ${_lsProjectCodes.map(code => `
      <label class="ls-checkbox-item">
        <input type="checkbox" class="ls-project-cb" value="${code}" checked>
        <span>${code}</span>
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
  const laborType = document.getElementById('lsLaborType').value;

  if (codes.length === 0) { showToast('⚠️ Chọn ít nhất 1 dự án'); return; }

  const { from: dateFrom, to: dateTo } = lsGetDateRangeFromPreset();

  const resultArea = document.getElementById('lsResultArea');
  resultArea.innerHTML = '<div class="loading" style="margin-top:16px"><span class="loading-spinner"></span> Đang tải dữ liệu...</div>';
  document.getElementById('lsExportBtn').disabled = true;

  try {
    const codesFilter = codes.map(c => `"${c}"`).join(',');
    let query =
      `attendance_logs?select=project_code,report_date,qty_ketcau,qty_hoanthien,qty_mep,qty_congnhat,qty_khac,qty_total,qty_bch` +
      `&project_code=in.(${codesFilter})`;
    if (dateFrom) query += `&report_date=gte.${dateFrom}`;
    if (dateTo)   query += `&report_date=lte.${dateTo}`;
    query += `&order=project_code,report_date&limit=10000`;

    const rows = await sb2Fetch(query, { headers: { Range: '0-9999' } });
    _lsRows = rows || [];
    lsRenderResult(dateFrom, dateTo, laborType);
  } catch (e) {
    console.error(e);
    resultArea.innerHTML = '<div class="alert alert-danger">Lỗi tải dữ liệu báo cáo</div>';
    showToast('❌ Lỗi tải dữ liệu');
  }
}

// ── Render bảng: TRUNG BÌNH THEO NGÀY ──
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

  const catList = ['qty_ketcau', 'qty_hoanthien', 'qty_mep', 'qty_congnhat', 'qty_khac'];

  // Gộp theo dự án — tính tổng và số ngày BC để suy ra trung bình/ngày
  const byProject = {};
  _lsRows.forEach(r => {
    if (!byProject[r.project_code]) {
      byProject[r.project_code] = { code: r.project_code, sum: {}, days: 0 };
      catList.forEach(k => (byProject[r.project_code].sum[k] = 0));
      byProject[r.project_code].sum.qty_total = 0;
    }
    const p = byProject[r.project_code];
    catList.forEach(k => (p.sum[k] += r[k] || 0));
    p.sum.qty_total += r.qty_total || 0;
    p.days += 1;
  });

  const projectRows = Object.values(byProject)
    .map(p => {
      const avg = {};
      catList.forEach(k => (avg[k] = p.days ? Math.round(p.sum[k] / p.days) : 0));
      avg.qty_total = p.days ? Math.round(p.sum.qty_total / p.days) : 0;
      return { code: p.code, days: p.days, avg };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const cols = [
    { key: 'qty_ketcau',    label: '🏗 KC' },
    { key: 'qty_hoanthien', label: '🎨 HT' },
    { key: 'qty_mep',       label: '⚡ MEP' },
    { key: 'qty_congnhat',  label: '📅 Công nhật' },
    { key: 'qty_khac',      label: '🔨 Khác' },
  ];
  const visibleCols = laborType === 'all' ? cols : cols.filter(c => c.key === laborType);

  const periodLabel = dateFrom && dateTo
    ? `Từ ${lsFmtDate(dateFrom)} đến ${lsFmtDate(dateTo)}`
    : 'Toàn bộ thời gian có dữ liệu';

  resultArea.innerHTML = `
    <div class="card" id="lsPrintArea">
      <div class="ls-print-header">
        <img src="https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png" class="ls-print-logo" alt="VelaE&C">
        <div>
          <div style="font-weight:700;color:var(--navy);font-size:16px">BÁO CÁO TỔNG HỢP NHÂN CÔNG DỰ ÁN (TB/NGÀY)</div>
          <div style="font-size:12px;color:var(--gray5)">${periodLabel} · ${projectRows.length} dự án</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dự án</th>
              ${visibleCols.map(c => `<th>TB ${c.label}/ngày</th>`).join('')}
              <th>TB Tổng CN/ngày</th>
              <th>Số ngày BC</th>
            </tr>
          </thead>
          <tbody>
            ${projectRows.map(p => `
              <tr>
                <td><strong>${p.code}</strong></td>
                ${visibleCols.map(c => `<td>${p.avg[c.key]}</td>`).join('')}
                <td><strong>${p.avg.qty_total}</strong></td>
                <td>${p.days}</td>
              </tr>
            `).join('')}
          </tbody>
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

    pdf.save(`TongHopNhanCong_${_lsPreset}_${localDateStr(new Date())}.pdf`);
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
