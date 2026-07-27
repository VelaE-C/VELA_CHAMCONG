// VELA_CHAMCONG — users.js
// Nhân sự, phân quyền, modal chỉnh sửa, filter/sort

// ── USERS ──
async function loadUsers() {
  try {
    let url = 'users?is_active=eq.true&order=full_name';
    if (STATE.currentUser.role==='site_admin' && STATE.currentUser.project_id)
      url += `&project_id=eq.${STATE.currentUser.project_id}`;
    STATE.users = await sbFetch(url);
    renderUserList();
  } catch(e) { console.error(e); }
}

// ── USER LIST FILTER + SORT ──
let userSortCol = 'full_name';
let userSortDir = 1; // 1=asc, -1=desc

function populateFilterProjectSelect() {
  const el = document.getElementById('filterProject'); if(!el) return;
  const val = el.value;
  el.innerHTML = '<option value="">Tất cả dự án</option>';
  STATE.projects.forEach(p => el.innerHTML += `<option value="${p.id}">${p.code} — ${p.name}</option>`);
  el.value = val;
}

function filterUsers() {
  const name = (document.getElementById('filterName')?.value||'').toLowerCase().trim();
  const projectId = document.getElementById('filterProject')?.value||'';
  const role = document.getElementById('filterRole')?.value||'';
  let filtered = STATE.users.filter(u => {
    const matchName = !name ||
      u.full_name.toLowerCase().includes(name) ||
      (u.email||'').toLowerCase().includes(name) ||
      (u.employee_code||'').toLowerCase().includes(name);
    const matchProject = !projectId || u.project_id===projectId ||
      u.project_scope==='all' ||
      (u.allowed_projects&&u.allowed_projects.includes(projectId));
    const matchRole = !role || u.role===role;
    return matchName && matchProject && matchRole;
  });
  // Sort
  filtered.sort((a,b) => {
    let va = a[userSortCol]||'', vb = b[userSortCol]||'';
    if(typeof va==='string') va=va.toLowerCase();
    if(typeof vb==='string') vb=vb.toLowerCase();
    return va<vb ? -userSortDir : va>vb ? userSortDir : 0;
  });
  const countEl = document.getElementById('filterCount');
  if(countEl) countEl.textContent = filtered.length===STATE.users.length
    ? `Tổng: ${STATE.users.length} nhân sự`
    : `Hiển thị ${filtered.length} / ${STATE.users.length} nhân sự`;
  renderUserListData(filtered);
}

function sortUserBy(col) {
  if(userSortCol===col) userSortDir*=-1; else { userSortCol=col; userSortDir=1; }
  filterUsers();
}

function clearFilterUsers() {
  ['filterName','filterProject','filterRole'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  filterUsers();
}

function renderUserList() {
  populateFilterProjectSelect();
  filterUsers();
}

function renderUserListData(users) {
  const el = document.getElementById('userList'); if (!el) return;
  if (!users.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div>Không tìm thấy nhân sự nào</div>';
    return;
  }
  const roleMap   = { superadmin:'🔑 Super Admin', site_admin:'🛡 Admin CT', employee:'👷 Nhân viên' };
  const roleBadge = { superadmin:'badge-navy', site_admin:'badge-blue', employee:'badge-green' };
  const arrow = col => col===userSortCol ? (userSortDir===1?' ↑':' ↓') : '';

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:80px 1fr 120px 150px 110px 80px;gap:4px;
      padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
      color:var(--gray5);border-bottom:2px solid var(--gray2);cursor:pointer;user-select:none">
      <div onclick="sortUserBy('employee_code')">Mã NV${arrow('employee_code')}</div>
      <div onclick="sortUserBy('full_name')">Họ tên${arrow('full_name')}</div>
      <div onclick="sortUserBy('position')">Chức vụ${arrow('position')}</div>
      <div>Dự án</div>
      <div onclick="sortUserBy('role')">Quyền${arrow('role')}</div>
      <div></div>
    </div>
    ${users.map((u,i) => {
      const proj = STATE.projects.find(p => p.id === u.project_id);
      const projLabel = u.project_scope==='all'
        ? '<span class="badge badge-blue">🌐 Tất cả</span>'
        : u.project_scope==='multi'
          ? '<span class="badge badge-amber">🗂 '+((u.allowed_projects||[]).length)+' dự án</span>'
          : (proj ? proj.code : '—');
      const bg = i%2===0 ? 'white' : 'var(--gray1)';
      return `<div style="display:grid;grid-template-columns:80px 1fr 120px 150px 110px 80px;gap:4px;
        padding:10px 12px;background:${bg};align-items:center;border-bottom:1px solid var(--gray2)">
        <div style="font-family:monospace;font-size:12px;font-weight:700;color:var(--amber)">${u.employee_code||'—'}</div>
        <div style="font-weight:600;color:var(--gray8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.full_name}</div>
        <div style="font-size:12px;color:var(--gray7)">${u.position||'—'}</div>
        <div style="font-size:12px">${projLabel}</div>
        <div><span class="badge ${roleBadge[u.role]||'badge-gray'}" style="font-size:11px">${roleMap[u.role]||u.role}</span></div>
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button onclick="openEditUserModal('${u.id}')" class="btn btn-secondary btn-sm btn-icon" title="Sửa & Hồ sơ">✏️</button>
          <button onclick="deactivateUser('${u.id}','${u.full_name}')" class="btn btn-secondary btn-sm btn-icon" title="Xóa">🗑</button>
        </div>
      </div>`;
    }).join('')}
  `;
}

// ── ADD USER FORM TOGGLE ──
function toggleAddUserForm() {
  const body = document.getElementById('addUserFormBody');
  const btn  = document.getElementById('addUserToggleBtn');
  if (!body || !btn) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '+ Thêm mới' : '− Đóng';
  btn.style.background = isOpen ? '' : 'var(--gray2)';
  btn.style.color      = isOpen ? '' : 'var(--gray7)';
}

// ── EDIT USER MODAL ──
function openEditUserModal(userId) {
  const u = STATE.users.find(x => x.id === userId);
  if (!u) return;

  document.getElementById('editModalSubtitle').textContent = `${u.full_name} — ${u.employee_code || u.email}`;
  document.getElementById('editName').value = u.full_name || '';
  document.getElementById('editCode').value = u.employee_code || '';
  document.getElementById('editEmail').value = u.email || '';
  document.getElementById('editPhone').value = u.phone || '';
  document.getElementById('editPosition').value = u.position || '';
  document.getElementById('editRole').value = u.role || 'employee';
  document.getElementById('editScope').value = u.project_scope || 'fixed';
  document.getElementById('editJoinDate').value = u.join_date || '';

  // Populate project dropdowns
  const projSel = document.getElementById('editProject');
  projSel.innerHTML = '<option value="">-- Chọn dự án --</option>';
  const multiSel = document.getElementById('editAllowedProjects');
  multiSel.innerHTML = '';
  STATE.projects.forEach(p => {
    projSel.innerHTML += `<option value="${p.id}">${p.code} — ${p.name}</option>`;
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = `${p.code} — ${p.name}`;
    if (u.allowed_projects?.includes(p.id)) opt.selected = true;
    multiSel.appendChild(opt);
  });
  projSel.value = u.project_id || '';

  onEditScopeChange();

  // Store editing user id
  document.getElementById('editUserModal').dataset.userId = userId;
  document.getElementById('deactivateBtn').textContent = u.is_active ? 'Vô hiệu hóa' : '✅ Kích hoạt lại';

  // Phân quyền: ẩn role superadmin nếu người dùng không phải superadmin
  const roleSelEdit = document.getElementById('editRole');
  if (roleSelEdit) {
    // Reset options
    roleSelEdit.innerHTML = `
      <option value="employee">👷 Nhân viên</option>
      <option value="cht">🏗 CHT (Chỉ huy trưởng)</option>
      <option value="site_admin">🛡 Admin công trình</option>
      ${STATE.currentUser?.role === 'superadmin' ? '<option value="superadmin">🔑 Super Admin</option>' : ''}
    `;
    roleSelEdit.value = u.role || 'employee';
  }

  document.getElementById('editUserModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
  // Load PDF docs
  loadModalDocs(userId);
}

function closeEditUserModal() {
  document.getElementById('editUserModal').style.display = 'none';
  document.body.style.overflow = '';
}

function onEditScopeChange() {
  const scope = document.getElementById('editScope').value;
  document.getElementById('editFixedProjectRow').style.display = scope === 'fixed' ? 'block' : 'none';
  document.getElementById('editMultiProjectRow').style.display = scope === 'multi' ? 'block' : 'none';
}

async function saveEditUser() {
  const userId = document.getElementById('editUserModal').dataset.userId;
  const scope = document.getElementById('editScope').value;
  const multiSel = document.getElementById('editAllowedProjects');
  const allowedProjects = scope === 'multi'
    ? Array.from(multiSel.selectedOptions).map(o => o.value)
    : null;

  const body = {
    full_name: document.getElementById('editName').value.trim(),
    employee_code: document.getElementById('editCode').value.trim() || null,
    email: document.getElementById('editEmail').value.trim(),
    phone: document.getElementById('editPhone').value.trim() || null,
    position: document.getElementById('editPosition').value.trim() || null,
    role: document.getElementById('editRole').value,
    project_scope: scope,
    project_id: scope === 'fixed' ? (document.getElementById('editProject').value || null) : null,
    allowed_projects: allowedProjects,
    join_date: document.getElementById('editJoinDate').value || null
  };

  if (!body.full_name) { showToast('⚠️ Cần có họ tên'); return; }

  try {
    await sbFetch(`users?id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
    showToast('✅ Đã cập nhật ' + body.full_name);
    closeEditUserModal();
    await loadUsers();
  } catch(e) { showToast('❌ ' + e.message); }
}

function onModalFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('⚠️ Chỉ chấp nhận file PDF'); return;
  }
  const sizeMB = (file.size/1024/1024).toFixed(2);
  const info = document.getElementById('modalFileInfo');
  info.style.display = 'block';
  info.innerHTML = `✅ <strong>${file.name}</strong> — ${sizeMB} MB`;
}

async function uploadModalDoc() {
  const userId = document.getElementById('editUserModal').dataset.userId;
  if (!userId) return;
  const file = document.getElementById('modalDocFile').files[0];
  if (!file) { showToast('⚠️ Chọn file PDF trước'); return; }
  const docType = document.getElementById('modalDocType').value;
  const note = document.getElementById('modalDocNote').value.trim();
  const btn = document.getElementById('modalUploadBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang tải...';
  try {
    await uploadHRDoc(userId, file, docType, note);
    showToast('✅ Đã tải lên thành công');
    document.getElementById('modalDocFile').value = '';
    document.getElementById('modalDocNote').value = '';
    document.getElementById('modalFileInfo').style.display = 'none';
    await loadModalDocs(userId);
  } catch(e) { showToast('❌ ' + e.message); }
  finally { btn.disabled = false; btn.textContent = '⬆️ Tải lên'; }
}

async function loadModalDocs(userId) {
  const el = document.getElementById('modalDocList'); if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--gray5);font-size:13px"><span class="spinner"></span> Đang tải...</div>';
  try {
    const docs = await sbFetch(`hr_documents?user_id=eq.${userId}&order=created_at.desc`);
    if (!docs.length) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gray5);font-size:13px">📂 Chưa có hồ sơ nào</div>';
      return;
    }
    const DOC_LABEL = { cv:'👤 CV', contract:'📋 HĐ lao động', id_card:'🪪 CCCD', certificate:'🎓 Bằng cấp', health:'🏥 Sức khỏe', other:'📄 Khác' };
    el.innerHTML = docs.map(d => {
      const sizeMB = d.file_size ? (d.file_size/1024/1024).toFixed(1)+'MB' : '';
      const date = new Date(d.created_at);
      const dateStr = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--gray1);border:1px solid var(--gray2);border-radius:8px;margin-bottom:8px">
        <div style="font-size:11px;color:var(--amber);background:rgba(245,166,35,.1);border-radius:5px;padding:3px 8px;white-space:nowrap">${DOC_LABEL[d.doc_type]||d.doc_type}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--gray8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${d.file_name}">${d.file_name}</div>
          <div style="font-size:11px;color:var(--gray5);margin-top:2px">${d.note||''} ${sizeMB} · ${dateStr}</div>
        </div>
        <button onclick="viewDoc('${d.file_path}')"
          style="background:rgba(74,158,255,.1);border:1px solid rgba(74,158,255,.2);border-radius:6px;padding:5px 10px;color:var(--blue);font-size:12px;cursor:pointer">👁 Xem</button>
        <button onclick="deleteModalDoc('${d.id}','${d.file_path}','${d.file_name.replace(/'/g,'').replace(/"/g,'')}')"
          style="background:rgba(232,85,85,.1);border:1px solid rgba(232,85,85,.2);border-radius:6px;padding:5px 10px;color:var(--red);font-size:12px;cursor:pointer">🗑</button>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red);font-size:13px;padding:12px">❌ ${e.message}</div>`;
  }
}

async function deleteModalDoc(docId, filePath, fileName) {
  if (!confirm(`Xóa file "${fileName}"?`)) return;
  try {
    await deleteHRDoc(docId, filePath);
    showToast('✅ Đã xóa file');
    const userId = document.getElementById('editUserModal').dataset.userId;
    await loadModalDocs(userId);
  } catch(e) { showToast('❌ ' + e.message); }
}

async function confirmDeactivate() {
  const userId = document.getElementById('editUserModal').dataset.userId;
  const u = STATE.users.find(x => x.id === userId);
  if (!u) return;
  const newStatus = !u.is_active;
  const action = newStatus ? 'kích hoạt lại' : 'vô hiệu hóa';
  if (!confirm(`${action.charAt(0).toUpperCase()+action.slice(1)} tài khoản "${u.full_name}"?`)) return;
  try {
    await sbFetch(`users?id=eq.${userId}`, { method: 'PATCH', body: JSON.stringify({ is_active: newStatus }) });
    showToast(`✅ Đã ${action} ${u.full_name}`);
    closeEditUserModal();
    await loadUsers();
  } catch(e) { showToast('❌ ' + e.message); }
}

function onScopeChange() {
  const scope = document.getElementById('hrScope').value;
  document.getElementById('fixedProjectRow').style.display = scope === 'fixed' ? 'block' : 'none';
  document.getElementById('multiProjectRow').style.display = scope === 'multi' ? 'block' : 'none';
}

function populateAllowedProjectsSelect() {
  const el = document.getElementById('hrAllowedProjects'); if(!el) return;
  const vals = Array.from(el.selectedOptions).map(o=>o.value);
  el.innerHTML = STATE.projects.map(p => `<option value="${p.id}" ${vals.includes(p.id)?'selected':''}>${p.code} — ${p.name}</option>`).join('');
}

function editUser(id) {
  const u = STATE.users.find(x=>x.id===id); if(!u) return;
  document.getElementById('editUserId').value = u.id;
  document.getElementById('hrName').value = u.full_name;
  document.getElementById('hrCode').value = u.employee_code || '';
  document.getElementById('hrEmail').value = u.email || '';
  document.getElementById('hrPhone').value = u.phone || '';
  document.getElementById('hrPosition').value = u.position || '';
  document.getElementById('hrRole').value = u.role;
  document.getElementById('hrScope').value = u.project_scope || 'fixed';
  document.getElementById('hrProject').value = u.project_id || '';
  document.getElementById('hrJoinDate').value = u.join_date || '';
  onScopeChange();
  populateAllowedProjectsSelect();
  // Pre-select allowed projects
  if (u.allowed_projects) {
    const sel = document.getElementById('hrAllowedProjects');
    Array.from(sel.options).forEach(o => { o.selected = u.allowed_projects.includes(o.value); });
  }
  document.getElementById('btnSaveUser').textContent = 'Lưu thay đổi';
  document.getElementById('btnCancelUser').style.display = 'inline-block';
  document.querySelector('#tab-hrprofile .card-title').textContent = 'Chỉnh sửa nhân sự';
  window.scrollTo({top:0,behavior:'smooth'});
}

function cancelEditUser() {
  document.getElementById('editUserId').value = '';
  ['hrName','hrCode','hrEmail','hrPhone','hrPosition','hrJoinDate'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('hrRole').value = 'employee';
  document.getElementById('hrScope').value = 'fixed';
  document.getElementById('hrProject').value = '';
  onScopeChange();
  document.getElementById('btnSaveUser').textContent = 'Thêm nhân sự';
  document.getElementById('btnCancelUser').style.display = 'none';
  document.querySelector('#tab-hrprofile .card-title').textContent = 'Thêm nhân sự mới';
}

async function saveUser() {
  const editId = document.getElementById('editUserId').value;
  const scope = document.getElementById('hrScope').value;
  const allowedSel = document.getElementById('hrAllowedProjects');
  const allowedProjects = scope === 'multi'
    ? Array.from(allowedSel.selectedOptions).map(o=>o.value)
    : null;
  const body = {
    full_name: document.getElementById('hrName').value.trim(),
    employee_code: document.getElementById('hrCode').value.trim() || null,
    email: document.getElementById('hrEmail').value.trim(),
    phone: document.getElementById('hrPhone').value.trim() || null,
    position: document.getElementById('hrPosition').value.trim() || null,
    role: document.getElementById('hrRole').value,
    project_id: scope === 'fixed' ? (document.getElementById('hrProject').value || null) : null,
    project_scope: scope,
    allowed_projects: allowedProjects,
    join_date: document.getElementById('hrJoinDate').value || null,
    is_active: true
  };
  if (!body.full_name||!body.email) { showToast('⚠️ Cần có họ tên và email'); return; }
  if (scope==='multi' && (!allowedProjects||allowedProjects.length===0)) { showToast('⚠️ Chọn ít nhất 1 dự án'); return; }
  try {
    if (editId) {
      await sbFetch(`users?id=eq.${editId}`, { method:'PATCH', body: JSON.stringify(body) });
      showToast('✅ Đã cập nhật '+body.full_name);
    } else {
      const created = await sbFetch('users', { method:'POST', body: JSON.stringify(body) });
      showToast('✅ Đã thêm '+body.full_name);
      cancelEditUser();
      await loadUsers();
      // Tự mở modal để upload PDF ngay
      if (created && created[0]?.id) {
        setTimeout(() => openEditUserModal(created[0].id), 400);
      }
      return;
    }
    cancelEditUser();
    await loadUsers();
  } catch(e) { showToast('❌ '+e.message); }
}

async function deactivateUser(id, name) {
  if (!confirm(`Vô hiệu hóa nhân sự "${name}"?`)) return;
  try {
    await sbFetch(`users?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({is_active:false}) });
    showToast('✅ Đã vô hiệu hóa '+name);
    await loadUsers();
  } catch(e) { showToast('❌ '+e.message); }
}
