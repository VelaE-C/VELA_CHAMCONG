// VELA_CHAMCONG — mytable.js
// Bảng công cá nhân

// ── MY ATTENDANCE ──
function populateMonthSelectors() {
  const now=new Date();
  [['myMonth','myYear'],['teamMonth','teamYear']].forEach(([mId,yId]) => {
    const mEl=document.getElementById(mId), yEl=document.getElementById(yId);
    if(!mEl||!yEl) return;
    mEl.innerHTML=MONTHS_VI.map((m,i)=>`<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${m}</option>`).join('');
    yEl.innerHTML='';
    for(let y=now.getFullYear();y>=now.getFullYear()-2;y--)
      yEl.innerHTML+=`<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`;
  });
}

async function loadMyAttendance() {
  const month=parseInt(document.getElementById('myMonth').value);
  const year=parseInt(document.getElementById('myYear').value);
  const el=document.getElementById('myTableContent');
  el.innerHTML='<div class="loading"><span class="spinner"></span> Đang tải...</div>';
  // Chu kỳ công: 26 tháng trước → 25 tháng này
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const startDate=`${prevYear}-${String(prevMonth).padStart(2,'0')}-26`;
  const endDate=`${year}-${String(month).padStart(2,'0')}-25`;
  try {
    const rows=await sbFetch(`attendance?select=*&user_id=eq.${STATE.currentUser.id}&check_date=gte.${startDate}&check_date=lte.${endDate}&order=check_date`);
    STATE.lastAttData={rows,month,year,user:STATE.currentUser};
    renderMyTable(rows,month,year);
  } catch(e) { el.innerHTML='<div class="empty-state">❌ '+e.message+'</div>'; }
}

function renderMyTable(rows,month,year) {
  // Build date array: 26 prev month → 25 curr month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const dateList = [];
  for(let d=26; d<=31; d++) {
    const dt = new Date(prevYear, prevMonth-1, d);
    if(dt.getMonth() === prevMonth-1) dateList.push(dt);
  }
  for(let d=1; d<=25; d++) {
    dateList.push(new Date(year, month-1, d));
  }
  const byDate={};
  rows.forEach(r=>byDate[r.check_date]=r);
  let present=0,absent=0,leave=0;
  const statusMap={present:['badge-present','✅ Có mặt'],absent:['badge-absent','❌ Vắng'],leave:['badge-leave','🏖️ Nghỉ phép'],holiday:['badge-holiday','🎌 Nghỉ lễ']};
  let tableRows='';
  for(const dt of dateList) {
    const dateStr=localDateStr(dt);
    const isWe=false; // Tất cả các ngày đều tính công
    const r=byDate[dateStr];
    let bClass='',bLabel='';
    if(r){[bClass,bLabel]=statusMap[r.status]||['','—'];if(r.status==='present')present++;else if(r.status==='absent')absent++;else if(r.status==='leave')leave++;}
    const ct=r?new Date(r.check_time):null;
    const proj=STATE.projects.find(p=>p.id===r?.project_id);
    const dLabel=`${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
    const cout   = r?.check_out ? new Date(r.check_out) : null;
    const coutVN = cout ? new Date(cout.getTime() + 7*3600000) : null;
    const ctVN   = ct   ? new Date(ct.getTime()   + 7*3600000) : null;
    // Nếu is_adjusted=true và note có "[Bù công CHT duyệt]" → hiện badge bù công
    const isBuCong = r?.is_adjusted && (r?.note||'').includes('[Bù công CHT duyệt]') && !r?.distance_m;
    const cinStr  = isBuCong
      ? '<span style="color:var(--amber);font-size:11px;font-weight:700">📋 Bù công</span>'
      : (ctVN ? `${ctVN.getUTCHours()}:${String(ctVN.getUTCMinutes()).padStart(2,'0')}` : '—');
    const coutStr = isBuCong ? '—'
      : (coutVN ? `${coutVN.getUTCHours()}:${String(coutVN.getUTCMinutes()).padStart(2,'0')}` : '—');
    const isMobileRow = window.innerWidth < 1024;
    const rowBg = dateList.indexOf(dt) % 2 === 0 ? 'white' : 'var(--gray1)';
    const isSun = dt.getDay() === 0;

    if (isMobileRow) {
      // Mobile: 4 cột gọn
      const inOutCell = r
        ? `<div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6">
             <span style="color:var(--green);font-weight:600">${cinStr}</span><br>
             <span style="color:var(--blue)">${coutStr}</span>
           </div>`
        : '<span style="color:var(--gray3);font-size:12px">—</span>';
      tableRows += `<tr style="background:${rowBg}">
        <td style="padding:8px 4px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;border-bottom:1px solid var(--gray2);color:${isSun?'var(--amber)':'var(--gray8)'}">${dLabel}</td>
        <td style="padding:8px 4px;text-align:center;font-size:11px;border-bottom:1px solid var(--gray2);color:${isSun?'var(--amber)':'var(--gray5)'}">${DAYS_VI[dt.getDay()].replace('Thứ ','T')}</td>
        <td style="padding:8px 8px;text-align:center;border-bottom:1px solid var(--gray2)">${inOutCell}</td>
        <td style="padding:8px 4px;text-align:center;font-size:11px;border-bottom:1px solid var(--gray2);color:var(--gray5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${proj?proj.code:'—'}</td>
      </tr>`;
    } else {
      // Desktop: đầy đủ 7 cột
      tableRows += `<tr style="background:${rowBg}">
        <td style="padding:10px 12px;font-family:'JetBrains Mono',monospace;font-weight:600;border-bottom:1px solid var(--gray2)">${dLabel}</td>
        <td style="padding:10px 12px;color:${isSun?'var(--amber)':'var(--gray5)'};border-bottom:1px solid var(--gray2)">${DAYS_VI[dt.getDay()]}</td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--gray2)">${r?`<span class="badge ${bClass}">${bLabel}</span>`:'<span class="badge badge-red">— Chưa có</span>'}</td>
        <td style="padding:10px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--green);font-weight:600;border-bottom:1px solid var(--gray2)">${cinStr}</td>
        <td style="padding:10px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--blue);border-bottom:1px solid var(--gray2)">${coutStr}</td>
        <td style="padding:10px 12px;font-size:12px;color:var(--gray5);border-bottom:1px solid var(--gray2)">${r?.distance_m?r.distance_m+'m':'—'}</td>
        <td style="padding:10px 12px;font-size:12px;color:var(--gray5);border-bottom:1px solid var(--gray2)">${proj?proj.code:'—'}</td>
      </tr>`;
    }
  }
  const totalDays = dateList.length;
  document.getElementById('myStats').innerHTML=`
    <div class="stat-card"><div class="stat-value" style="color:var(--green)">${present}</div><div class="stat-label">Ngày công</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--red)">${absent}</div><div class="stat-label">Vắng mặt</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--blue)">${leave}</div><div class="stat-label">Nghỉ phép</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--amber)">${totalDays-present-absent-leave}</div><div class="stat-label">Chưa có DL</div></div>`;

  const isMobile = window.innerWidth < 1024;

  if (isMobile) {
    // Mobile: 4 cột, sticky header, không scroll ngang, checkin/out gộp 1 cột
    document.getElementById('myTableContent').innerHTML = `
      <div style="overflow-y:auto;max-height:calc(100vh - 300px)">
        <table style="width:100%;table-layout:fixed;border-collapse:collapse">
          <colgroup>
            <col style="width:52px">
            <col style="width:52px">
            <col style="width:auto">
            <col style="width:70px">
          </colgroup>
          <thead>
            <tr style="position:sticky;top:0;z-index:2;background:var(--gray1)">
              <th style="padding:8px 4px;font-size:11px;text-align:center;border-bottom:2px solid var(--gray2);color:var(--gray5)">Ngày</th>
              <th style="padding:8px 4px;font-size:11px;text-align:center;border-bottom:2px solid var(--gray2);color:var(--gray5)">Thứ</th>
              <th style="padding:8px 8px;font-size:11px;text-align:center;border-bottom:2px solid var(--gray2);color:var(--gray5)">In / Out</th>
              <th style="padding:8px 4px;font-size:11px;text-align:center;border-bottom:2px solid var(--gray2);color:var(--gray5)">Dự án</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
  } else {
    // Desktop: full table với tất cả cột
    document.getElementById('myTableContent').innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead style="position:sticky;top:0;z-index:2;background:var(--gray1)">
            <tr>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray5);border-bottom:2px solid var(--gray2)">Ngày</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray5);border-bottom:2px solid var(--gray2)">Thứ</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray5);border-bottom:2px solid var(--gray2)">Trạng thái</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray5);border-bottom:2px solid var(--gray2)">Check In</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray5);border-bottom:2px solid var(--gray2)">Check Out</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray5);border-bottom:2px solid var(--gray2)">Khoảng cách</th>
              <th style="padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray5);border-bottom:2px solid var(--gray2)">Dự án</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
  }
}
