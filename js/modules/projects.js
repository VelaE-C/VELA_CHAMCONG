// VELA_CHAMCONG — projects.js
// Quản lý dự án + GPS coordinates

// ── PROJECTS ──
async function loadProjects() {
  try {
    let url = 'projects?is_active=eq.true&order=name';
    if (STATE.currentUser.role === 'site_admin' && STATE.currentUser.project_id)
      url = `projects?id=eq.${STATE.currentUser.project_id}`;
    STATE.projects = await sbFetch(url);
    populateProjectSelects();
    renderProjectList();
  } catch(e) { console.error(e); }
}

function populateProjectSelects() {
  populateAllowedProjectsSelect();
  ['projectSelect','teamProject','hrProject'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const val = el.value;
    const isTeam = id === 'teamProject';
    el.innerHTML = isTeam ? '<option value="">-- Tất cả dự án --</option>' : '<option value="">-- Chọn dự án --</option>';
    STATE.projects.forEach(p => el.innerHTML += `<option value="${p.id}">${p.code} — ${p.name}</option>`);
    el.value = val;
  });
  // Project scope applied automatically in getAccessibleProjects() during checkin
}

function renderProjectList() {
  const el = document.getElementById('projectList'); if (!el) return;
  if (!STATE.projects.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🗂</div>Chưa có dự án nào</div>';
    return;
  }
  el.innerHTML = STATE.projects.map((p,i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;
      background:${i%2===0?'white':'var(--gray1)'};border:1px solid var(--gray2);
      border-radius:8px;margin-bottom:8px">
      <span class="badge badge-navy" style="font-size:11px;flex-shrink:0">${p.code}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--gray8)">${p.name}</div>
        <div style="font-size:11px;color:var(--gray5);margin-top:2px">
          📍 ${p.address||'—'} &nbsp;·&nbsp; ${p.lat?.toFixed(4)}, ${p.lng?.toFixed(4)}
        </div>
      </div>
      <span style="font-size:12px;color:var(--gray5);font-family:monospace;flex-shrink:0">R:${p.radius_m}m</span>
      <button onclick="editProject('${p.id}')" class="btn btn-secondary btn-sm btn-icon" title="Sửa">✏️</button>
      <button onclick="deleteProject('${p.id}','${p.name}')" class="btn btn-danger btn-sm btn-icon" title="Xóa">🗑</button>
    </div>`).join('');
}

async function saveProject() {
  const editId = document.getElementById('editProjectId').value;
  const code = document.getElementById('pjCode').value.trim();
  const name = document.getElementById('pjName').value.trim();
  const addr = document.getElementById('pjAddr').value.trim();
  const lat = parseFloat(document.getElementById('pjLat').value);
  const lng = parseFloat(document.getElementById('pjLng').value);
  const radius = parseInt(document.getElementById('pjRadius').value) || 250;
  if (!code||!name||isNaN(lat)||isNaN(lng)) { showToast('⚠️ Điền đầy đủ mã, tên, tọa độ'); return; }
  try {
    if (editId) {
      await sbFetch(`projects?id=eq.${editId}`, { method:'PATCH', body: JSON.stringify({code,name,address:addr,lat,lng,radius_m:radius}) });
      showToast('✅ Đã cập nhật dự án '+name);
    } else {
      await sbFetch('projects', { method:'POST', body: JSON.stringify({code,name,address:addr,lat,lng,radius_m:radius}) });
      showToast('✅ Đã thêm dự án '+name);
    }
    cancelEditProject();
    await loadProjects();
  } catch(e) { showToast('❌ '+e.message); }
}

function editProject(id) {
  const p = STATE.projects.find(x => x.id === id); if (!p) return;
  document.getElementById('editProjectId').value = p.id;
  document.getElementById('pjCode').value = p.code;
  document.getElementById('pjName').value = p.name;
  document.getElementById('pjAddr').value = p.address || '';
  document.getElementById('pjLat').value = p.lat;
  document.getElementById('pjLng').value = p.lng;
  document.getElementById('pjRadius').value = p.radius_m;
  document.getElementById('projectFormTitle').textContent = 'Chỉnh sửa dự án';
  const _bce = document.getElementById('btnCancelEdit'); if(_bce) _bce.style.display = 'inline-block';
  window.scrollTo({top:0,behavior:'smooth'});
}

function cancelEditProject() {
  document.getElementById('editProjectId').value = '';
  ['pjCode','pjName','pjAddr','pjLat','pjLng'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pjRadius').value = 250;
  document.getElementById('projectFormTitle').textContent = 'Thêm dự án mới';
  const _bce2 = document.getElementById('btnCancelEdit'); if(_bce2) _bce2.style.display = 'none';
}

async function deleteProject(id, name) {
  if (!confirm(`Xóa dự án "${name}"?`)) return;
  try {
    await sbFetch(`projects?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({is_active:false}) });
    showToast('✅ Đã xóa dự án '+name);
    await loadProjects();
  } catch(e) { showToast('❌ '+e.message); }
}

function getCurrentLocation() {
  if (!navigator.geolocation) { showToast('⚠️ Trình duyệt không hỗ trợ GPS'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('pjLat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('pjLng').value = pos.coords.longitude.toFixed(6);
    showToast('📍 Đã lấy vị trí hiện tại');
  }, () => showToast('❌ Không lấy được vị trí'));
}


function toggleAddProjectForm() {
  const body = document.getElementById('addProjectFormBody');
  const btn = document.getElementById('addProjectBtn');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '+ Thêm mới' : '− Đóng';
}
