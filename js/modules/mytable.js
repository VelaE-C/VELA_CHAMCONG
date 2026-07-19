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
    const rows=await sbFetch(`attendance?user_id=eq.${STATE.currentUser.id}&check_date=gte.${startDate}&check_date=lte.${endDate}&order=check_date`);
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
    tableRows+=`<tr style="">
      <td style="font-family:'JetBrains Mono',monospace">${dLabel}</td>
      <td>${DAYS_VI[dt.getDay()]}</td>
      <td>${r?`<span class="badge ${bClass}">${bLabel}</span>`:(isWe?'<span style="color:var(--gray5);font-size:11px">Nghỉ</span>':'<span class="badge badge-red">— Chưa có</span>')}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:12px">${ct?`${ct.getHours()}:${String(ct.getMinutes()).padStart(2,'0')}`:'—'}</td>
      <td style="font-size:12px;color:var(--gray5)">${r?.distance_m?r.distance_m+'m':'—'}</td>
      <td style="font-size:12px;color:var(--gray5)">${proj?proj.code:'—'}</td>
    </tr>`;
  }
  const totalDays = dateList.length;
  document.getElementById('myStats').innerHTML=`
    <div class="stat-card"><div class="stat-value" style="color:var(--green)">${present}</div><div class="stat-label">Ngày công</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--red)">${absent}</div><div class="stat-label">Vắng mặt</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--blue)">${leave}</div><div class="stat-label">Nghỉ phép</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--amber)">${totalDays-present-absent-leave}</div><div class="stat-label">Chưa có DL</div></div>`;
  document.getElementById('myTableContent').innerHTML=`<table>
    <thead><tr><th>#</th><th>Thứ</th><th>Trạng thái</th><th>Giờ chấm</th><th>Khoảng cách</th><th>Dự án</th></tr></thead>
    <tbody>${tableRows}</tbody></table>`;
}
