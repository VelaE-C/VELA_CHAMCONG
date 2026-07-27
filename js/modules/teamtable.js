// VELA_CHAMCONG — teamtable.js
// Bảng công nhóm

// ── TEAM ATTENDANCE ──
async function loadTeamAttendance() {
  const month=parseInt(document.getElementById('teamMonth').value);
  const year=parseInt(document.getElementById('teamYear').value);
  const projectId=document.getElementById('teamProject').value;
  const el=document.getElementById('teamTableContent');
  el.innerHTML='<div class="loading"><span class="spinner"></span> Đang tải...</div>';

  // Chu kỳ công: 26 tháng trước → 25 tháng này
  const prevMonth=month===1?12:month-1, prevYear=month===1?year-1:year;
  const startDate=`${prevYear}-${String(prevMonth).padStart(2,'0')}-26`;
  const endDate=`${year}-${String(month).padStart(2,'0')}-25`;

  // Build dateList
  const dateList=[];
  for(let d=26;d<=31;d++){const dt=new Date(prevYear,prevMonth-1,d);if(dt.getMonth()===prevMonth-1)dateList.push(dt);}
  for(let d=1;d<=25;d++){dateList.push(new Date(year,month-1,d));}

  try {
    // Query attendance records for this period + project
    let attUrl=`attendance?select=user_id,project_id,check_date,check_time,check_out,status,is_adjusted,note,distance_m&check_date=gte.${startDate}&check_date=lte.${endDate}&order=check_date.asc,check_time.asc&limit=10000`;
    if(projectId) attUrl+=`&project_id=eq.${projectId}`;

    // Query ALL active users (not filtered by project_id)
    // We'll determine who to show based on actual attendance data
    let userUrl='users?is_active=eq.true&order=full_name&limit=500';

    // For site_admin without project filter: limit to their project
    if(!projectId && STATE.currentUser.role==='site_admin' && STATE.currentUser.project_id) {
      attUrl+=`&project_id=eq.${STATE.currentUser.project_id}`;
    }

    // Lấy attendance với header Range để bypass Supabase row limit
    const attHeaders = { 'Range-Unit': 'items', 'Range': '0-9999' };
    const [allUsers, attRows] = await Promise.all([
      sbFetch(userUrl),
      sbFetch(attUrl, { headers: attHeaders })
    ]);

    // Group attendance by user
    const attByUser={};
    attRows.forEach(r=>{
      if(!attByUser[r.user_id]) attByUser[r.user_id]={};
      attByUser[r.user_id][r.check_date]=r;
    });

    // Determine which users to show:
    // If project selected: show users who ACTUALLY checked in at that project
    // OR users whose fixed project matches (even if 0 attendance)
    let users;
    if(projectId) {
      // Get user_ids that have attendance at this project in this period
      const activeUserIds = new Set(attRows.map(r=>r.user_id));

      // Also include fixed-project users assigned to this project
      const fixedUsers = allUsers.filter(u =>
        u.project_id === projectId && (u.project_scope==='fixed' || !u.project_scope)
      );
      fixedUsers.forEach(u => activeUserIds.add(u.id));

      // Build final user list preserving order
      users = allUsers.filter(u => activeUserIds.has(u.id));
    } else {
      // No project filter: show all active users
      users = allUsers;
    }

    if(!users.length){
      el.innerHTML='<div class="empty-state"><div class="empty-icon">👥</div>Không có nhân sự nào trong kỳ này</div>';
      return;
    }

    STATE.lastTeamData={users,attByUser,month,year,dateList,projectId};
    renderTeamTable(users,attByUser,dateList,el,month,year);
  } catch(e){el.innerHTML='<div class="empty-state">❌ '+e.message+'</div>';}
}

function renderTeamTable(users,attByUser,dateList,el,month,year) {
  const prevMonth=month===1?12:month-1, prevYear=month===1?year-1:year;
  const periodLabel=`Chu kỳ: 26/${String(prevMonth).padStart(2,'0')}/${prevYear} → 25/${String(month).padStart(2,'0')}/${year} — Tổng ${dateList.length} ngày`;

  // Sticky styles
  const stickyName  = `position:sticky;left:0;z-index:2;background:white;white-space:nowrap;min-width:150px;max-width:180px;`;
  const stickyTotal = `position:sticky;left:150px;z-index:2;background:white;min-width:56px;text-align:center;`;
  const stickyHead  = `position:sticky;top:0;z-index:3;background:var(--gray1);`;
  const stickyCornerName  = stickyName  + stickyHead;
  const stickyCornerTotal = stickyTotal + stickyHead;

  const dayHeaders = dateList.map(dt=>{
    const d = dt.getDay(); // 0=Sun
    const isWe = d===0;
    const label = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
    const weekday = ['CN','T2','T3','T4','T5','T6','T7'][d];
    return `<th style="${stickyHead}text-align:center;font-size:10px;white-space:nowrap;min-width:38px;padding:4px 2px;${isWe?'color:var(--amber)':''}">
      <div>${label}</div><div style="color:var(--gray5);font-size:9px">${weekday}</div>
    </th>`;
  }).join('');

  const tableRows = users.map((u,ri)=>{
    const att = attByUser[u.id]||{};
    let total = 0;
    const rowBg = ri%2===0 ? 'white' : 'var(--gray1)';
    const cells = dateList.map(dt=>{
      const dateStr = localDateStr(dt);
      const r = att[dateStr];
      if(r?.status==='present'||r?.status==='leave') total++;
      let cell = '';
      if (r) {
        if (r.status === 'present' || r.status === 'leave') {
          // Kiểm tra bù công
          const isBuCong = r.is_adjusted && (r.note||'').includes('[Bù công CHT duyệt]') && !r.distance_m;
          if (isBuCong) {
            cell = `<div style="color:var(--amber);font-size:10px;font-weight:700;line-height:1.4;text-align:center">📋<br>Bù<br>công</div>`;
          } else {
            const tin = new Date(r.check_time);
            const tinStr = `${tin.getHours()}:${String(tin.getMinutes()).padStart(2,'0')}`;
            const toutStr = r.check_out ? (() => {
              const t = new Date(r.check_out);
              return `${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;
            })() : '';
            cell = `<div style="color:var(--green);font-size:10px;font-weight:600;line-height:1.3">${tinStr}</div>`
                 + (toutStr ? `<div style="color:var(--blue);font-size:10px;line-height:1.3">${toutStr}</div>` : '<div style="color:var(--gray5);font-size:9px">-</div>');
          }
        } else if (r.status === 'absent') {
          cell = '<span style="color:var(--red);font-size:11px">❌</span>';
        } else {
          cell = '<span style="color:var(--blue);font-size:11px">🏖</span>';
        }
      }
      return `<td style="text-align:center;font-size:10px;padding:3px 2px;border-bottom:1px solid var(--gray2);min-width:42px">${cell}</td>`;
    }).join('');
    return `<tr>
      <td style="${stickyName}background:${rowBg};padding:8px 12px;font-weight:500;color:var(--gray8);border-bottom:1px solid var(--gray2);overflow:hidden;text-overflow:ellipsis">${u.full_name}</td>
      <td style="${stickyTotal}background:${rowBg};padding:8px 4px;font-family:monospace;font-weight:700;color:var(--amber);font-size:13px;border-bottom:1px solid var(--gray2)">${total}</td>
      ${cells}
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div style="padding:10px 14px;font-size:11px;color:var(--gray5);font-style:italic;border-bottom:1px solid var(--gray2);position:sticky;top:0;z-index:4;background:white">
      📅 ${periodLabel}
    </div>
    <table style="border-collapse:collapse;width:max-content;min-width:100%">
      <thead><tr>
        <th style="${stickyCornerName}padding:8px 12px;font-size:12px;font-weight:600;color:var(--gray5);text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid var(--gray2)">Họ tên</th>
        <th style="${stickyCornerTotal}padding:8px 4px;font-size:12px;font-weight:600;color:var(--gray5);text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid var(--gray2)">Tổng</th>
        ${dayHeaders}
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>`;
}

// ── EXPORT EXCEL ──
