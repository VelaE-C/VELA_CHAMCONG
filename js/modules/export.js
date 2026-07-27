// VELA_CHAMCONG — export.js
// Xuất Excel cá nhân + nhóm (ExcelJS)

// ── EXPORT EXCEL CÁ NHÂN ──
async function exportMyExcel() {
  if(!STATE.lastAttData){showToast('⚠️ Xem bảng công trước');return;}
  showToast('⏳ Đang tạo file Excel...');
  const {rows,month,year,user}=STATE.lastAttData;
  const prevMonth=month===1?12:month-1, prevYear=month===1?year-1:year;
  const dateList=[];
  for(let d=26;d<=31;d++){const dt=new Date(prevYear,prevMonth-1,d);if(dt.getMonth()===prevMonth-1)dateList.push(dt);}
  for(let d=1;d<=25;d++){dateList.push(new Date(year,month-1,d));}
  const byDate={};rows.forEach(r=>byDate[r.check_date]=r);

  const NAVY='0D2137',ORANGE='F5A623',WHITE='FFFFFF',GREY='F5F7FA';
  const GREEN='27C47A',GREEN2='E8F8F1',RED='E85555',RED2='FDE8E8';
  const BLUE2='E8F1FD',TEXT='1A2B3C',LGREY='EAF0F6';
  const statusLabel={present:'✅ Có mặt',absent:'❌ Vắng',leave:'🏖 Nghỉ phép',holiday:'🎌 Nghỉ lễ'};
  const statusColor={present:GREEN,absent:RED,leave:'4A9EFF',holiday:ORANGE};
  const statusBg={present:GREEN2,absent:RED2,leave:BLUE2,holiday:'FFF3DC'};

  function hFill(h){return {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+h}};}
  function hBorder(){const s={style:'thin',color:{argb:'FFC5CDD8'}};return {left:s,right:s,top:s,bottom:s};}
  function hFont(bold,color,size){return {name:'Arial',bold:!!bold,color:{argb:'FF'+(color||TEXT)},size:size||10};}

  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('Tháng '+month+'.'+year);
  ws.columns=[{width:12},{width:11},{width:16},{width:13},{width:13},{width:14},{width:14},{width:4},{width:20}];

  // R1 - Logo
  ws.mergeCells('A1:I1'); ws.getRow(1).height=36;
  Object.assign(ws.getCell('A1'),{value:'VELA E&C',font:hFont(true,ORANGE,16),fill:hFill(NAVY),alignment:{horizontal:'left',vertical:'middle'}});

  // R2 - Title
  ws.mergeCells('A2:I2'); ws.getRow(2).height=28;
  Object.assign(ws.getCell('A2'),{
    value:'BẢNG CHẤM CÔNG THÁNG '+String(month).padStart(2,'0')+'/'+year+'  (26/'+String(prevMonth).padStart(2,'0')+'/'+prevYear+' – 25/'+String(month).padStart(2,'0')+'/'+year+')',
    font:hFont(true,WHITE,12),fill:hFill(NAVY),alignment:{horizontal:'center',vertical:'middle'}
  });

  // R3 - Sub
  ws.mergeCells('A3:I3'); ws.getRow(3).height=20;
  const proj0=STATE.currentUser.project_id?STATE.projects.find(p=>p.id===STATE.currentUser.project_id):null;
  Object.assign(ws.getCell('A3'),{
    value:'Phát hành: Lê Trần Anh Toàn – Vela E&C – 0978.635.450',
    font:{name:'Arial',italic:true,color:{argb:'FF5A7A96'},size:9},
    fill:hFill(LGREY),alignment:{horizontal:'center',vertical:'middle'}
  });

  ws.getRow(4).height=8;

  // R5 - Employee info
  ws.getRow(5).height=22;
  [['A','Nhân viên:','5A7A96'],['B',user.full_name,TEXT],['D','Mã NV:','5A7A96'],['E',user.employee_code||'—',TEXT],['G','Dự án:','5A7A96'],['H',proj0?proj0.name:'—',TEXT]]
  .forEach(([col,val,color])=>{Object.assign(ws.getCell(col+'5'),{value:val,font:hFont(null,color,10),alignment:{horizontal:'left',vertical:'middle'}});});

  ws.getRow(6).height=8;

  // R7 - Headers
  ws.getRow(7).height=24;
  ['Ngày','Thứ','Trạng thái','Check In','Check Out','Khoảng cách','Dự án','','Ghi chú'].forEach((h,i)=>{
    if(!h) return;
    const c=ws.getCell(7,i+1);
    c.value=h; c.font=hFont(true,WHITE,10); c.fill=hFill(NAVY);
    c.alignment={horizontal:'center',vertical:'middle'}; c.border=hBorder();
  });

  // Data
  let present=0,absent=0,leave=0;
  dateList.forEach((dt,idx)=>{
    const dateStr=localDateStr(dt), rec=byDate[dateStr], rn=idx+8;
    ws.getRow(rn).height=20;
    const bg=rec?(statusBg[rec.status]||WHITE):(idx%2===0?WHITE:GREY);
    const ct=rec?new Date(rec.check_time):null;
    const projRec=rec?STATE.projects.find(p=>p.id===rec.project_id):null;
    if(rec?.status==='present')present++;
    else if(rec?.status==='absent')absent++;
    else if(rec?.status==='leave')leave++;
    const cout = rec?.check_out ? new Date(rec.check_out) : null;
    [String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0'),
     DAYS_VI[dt.getDay()],
     rec?(STATUS_LABEL[rec.status]||''):'',
     ct?ct.getHours()+':'+String(ct.getMinutes()).padStart(2,'0'):'',
     cout?cout.getHours()+':'+String(cout.getMinutes()).padStart(2,'0'):'',
     rec?.distance_m?rec.distance_m+'m':'',
     projRec?projRec.code:'','',''
    ].forEach((v,i)=>{
      const c=ws.getCell(rn,i+1);
      c.value=v; c.fill=hFill(bg); c.border=hBorder();
      c.alignment={horizontal:i===7?'left':'center',vertical:'middle'};
      if(i===2&&rec) c.font={name:'Arial',bold:true,color:{argb:'FF'+(STATUS_BADGE[rec.status]||TEXT)},size:10};
      else if(i===3&&ct) c.font={name:'Arial',bold:true,color:{argb:'FF'+GREEN},size:10};
      else if(i===4&&cout) c.font={name:'Arial',bold:true,color:{argb:'FF4A9EFF'},size:10};
      else c.font=hFont(false,TEXT,10);
    });
  });

  // Spacer + Summary
  const spR=dateList.length+8; ws.getRow(spR).height=8;
  const sumR=spR+1; ws.getRow(sumR).height=28;
  ws.mergeCells('A'+sumR+':B'+sumR);
  Object.assign(ws.getCell('A'+sumR),{value:'TỔNG KẾT',font:hFont(true,WHITE,10),fill:hFill(NAVY),alignment:{horizontal:'center',vertical:'middle'}});
  [['C','✅ Ngày công',present,GREEN2,GREEN],['D','❌ Vắng mặt',absent,RED2,RED],
   ['E','🏖 Nghỉ phép',leave,BLUE2,'4A9EFF'],['F','📋 Tổng ngày',dateList.length,LGREY,NAVY]]
  .forEach(([col,label,val,bg,tc])=>{
    const c=ws.getCell(col+sumR);
    c.value=label+': '+val; c.font={name:'Arial',bold:true,color:{argb:'FF'+tc},size:10};
    c.fill=hFill(bg); c.alignment={horizontal:'center',vertical:'middle'}; c.border=hBorder();
  });

  ws.views=[{state:'frozen',ySplit:7,xSplit:0}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='BangCong_'+user.full_name.replace(/ /g,'_')+'_T'+month+'_'+year+'.xlsx';
  a.click(); showToast('✅ Đã xuất Excel!');
}

// ── EXPORT EXCEL NHÓM ──
async function exportTeamExcel() {
  if(!STATE.lastTeamData){showToast('⚠️ Xem bảng công nhóm trước');return;}
  showToast('⏳ Đang tạo file Excel...');
  const {users,attByUser,month,year}=STATE.lastTeamData;
  const prevMonth=month===1?12:month-1, prevYear=month===1?year-1:year;
  const dateList=[];
  for(let d=26;d<=31;d++){const dt=new Date(prevYear,prevMonth-1,d);if(dt.getMonth()===prevMonth-1)dateList.push(dt);}
  for(let d=1;d<=25;d++){dateList.push(new Date(year,month-1,d));}
  const proj=STATE.lastTeamData.projectId?STATE.projects.find(p=>p.id===STATE.lastTeamData.projectId):null;

  const NAVY='0D2137',ORANGE='F5A623',WHITE='FFFFFF',GREY='F5F7FA';
  const GREEN='27C47A',GREEN2='E8F8F1',RED='E85555',RED2='FDE8E8';
  const BLUE2='E8F1FD',TEXT='1A2B3C',LGREY='EAF0F6',ORANGE2='FFF3DC';

  function hFill(h){return {type:'pattern',pattern:'solid',fgColor:{argb:'FF'+h}};}
  function hBorder(){const s={style:'thin',color:{argb:'FFC5CDD8'}};return {left:s,right:s,top:s,bottom:s};}

  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet('T'+month+'.'+year);
  ws.columns=[{width:24},{width:12},...dateList.map(()=>({width:12}))];

  // R1
  ws.mergeCells(1,1,1,dateList.length+2); ws.getRow(1).height=32;
  Object.assign(ws.getCell('A1'),{
    value:'VELA E&C  –  BẢNG CHẤM CÔNG NHÓM THÁNG '+String(month).padStart(2,'0')+'/'+year+'  (26/'+String(prevMonth).padStart(2,'0')+'/'+prevYear+' – 25/'+String(month).padStart(2,'0')+'/'+year+')'+(proj?' — '+proj.name:' — TẤT CẢ DỰ ÁN'),
    font:{name:'Arial',bold:true,color:{argb:'FF'+WHITE},size:12},
    fill:hFill(NAVY),alignment:{horizontal:'center',vertical:'middle'}
  });

  // R2
  ws.mergeCells(2,1,2,dateList.length+2); ws.getRow(2).height=18;
  Object.assign(ws.getCell('A2'),{
    value:'Phát hành: Lê Trần Anh Toàn – Vela E&C – 0978.635.450',
    font:{name:'Arial',italic:true,color:{argb:'FF5A7A96'},size:9},
    fill:hFill(LGREY),alignment:{horizontal:'center',vertical:'middle'}
  });
  ws.getRow(3).height=8;

  // R4 Headers
  ws.getRow(4).height=32;
  ['Họ tên','Tổng công'].forEach((h,i)=>{
    const c=ws.getCell(4,i+1);
    c.value=h; c.font={name:'Arial',bold:true,color:{argb:'FF'+WHITE},size:10};
    c.fill=hFill(NAVY); c.alignment={horizontal:'center',vertical:'middle'}; c.border=hBorder();
  });
  const DAYS_VI2=['CN','T2','T3','T4','T5','T6','T7'];
  dateList.forEach((dt,i)=>{
    const c=ws.getCell(4,i+3);
    const isSun = dt.getDay()===0;
    c.value=String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0')+'\n'+DAYS_VI2[dt.getDay()];
    c.font={name:'Arial',bold:true,color:{argb:'FF'+(isSun?ORANGE:WHITE)},size:8};
    c.fill=hFill(NAVY); c.alignment={horizontal:'center',vertical:'middle',wrapText:true}; c.border=hBorder();
  });

  // Data
  users.forEach((u,ri)=>{
    const rn=ri+5, bg=ri%2===0?WHITE:GREY;
    ws.getRow(rn).height=22;
    const att=attByUser[u.id]||{}; let total=0;
    Object.assign(ws.getCell(rn,1),{value:u.full_name,font:{name:'Arial',bold:true,color:{argb:'FF'+TEXT},size:10},fill:hFill(bg),alignment:{horizontal:'left',vertical:'middle'},border:hBorder()});
    ws.getRow(rn).height=28;
    dateList.forEach((dt,i)=>{
      const rec=att[localDateStr(dt)];
      const c=ws.getCell(rn,i+3);
      c.border=hBorder();
      if(rec?.status==='present'||rec?.status==='leave'){
        const isBuCong = rec.is_adjusted && (rec.note||'').includes('[Bù công CHT duyệt]') && !rec.distance_m;
        if (isBuCong) {
          c.value='📋 Bù công';
          c.fill=hFill(ORANGE2);
          c.font={name:'Arial',size:8,bold:true,color:{argb:'FF'+ORANGE}};
          c.alignment={horizontal:'center',vertical:'middle'};
        } else {
          const tin=new Date(rec.check_time);
          const tinStr=tin.getHours()+':'+String(tin.getMinutes()).padStart(2,'0');
          const tout=rec.check_out?new Date(rec.check_out):null;
          const toutStr=tout?tout.getHours()+':'+String(tout.getMinutes()).padStart(2,'0'):'—';
          c.value=tinStr+'\n'+toutStr;
          c.fill=hFill(rec.status==='leave'?BLUE2:GREEN2);
          c.font={name:'Arial',size:8,color:{argb:'FF'+TEXT}};
          c.alignment={horizontal:'center',vertical:'middle',wrapText:true};
        }
        total++;
      } else if(rec?.status==='absent'){
        c.value='Vắng'; c.fill=hFill(RED2);
        c.font={name:'Arial',bold:true,color:{argb:'FF'+RED},size:8};
        c.alignment={horizontal:'center',vertical:'middle'};
      } else {
        c.value=''; c.fill=hFill(bg);
        c.alignment={horizontal:'center',vertical:'middle'};
      }
    });
    Object.assign(ws.getCell(rn,2),{value:total,font:{name:'Arial',bold:true,color:{argb:'FF'+ORANGE},size:12},fill:hFill(ORANGE2),alignment:{horizontal:'center',vertical:'middle'},border:hBorder()});
  });

  ws.views=[{state:'frozen',ySplit:4,xSplit:2}];
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='BangCong_Nhom_T'+month+'_'+year+(proj?'_'+proj.code:'')+'.xlsx';
  a.click(); showToast('✅ Đã xuất Excel!');
}
