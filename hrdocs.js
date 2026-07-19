// VELA_CHAMCONG — hrdocs.js
// Hồ sơ PDF nhân sự (Supabase Storage)

// ── HR DOCUMENTS ──
let currentHRUserId = null;

const DOC_TYPE_LABEL = {
  cv: '👤 CV Công việc',
  contract: '📋 Hợp đồng lao động',
  id_card: '🪪 CCCD / CMND',
  certificate: '🎓 Bằng cấp / Chứng chỉ',
  health: '🏥 Khám sức khỏe',
  other: '📄 Khác'
};

function openHRDocs(userId, userName) {
  currentHRUserId = userId;
  document.getElementById('hrDocSection').style.display = 'block';
  document.getElementById('hrDocUserName').textContent = `👤 ${userName}`;
  document.getElementById('hrDocSection').scrollIntoView({ behavior: 'smooth' });
  clearDocForm();
  loadHRDocs(userId);
}

function closeHRDocs() {
  document.getElementById('hrDocSection').style.display = 'none';
  currentHRUserId = null;
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) showFileInfo(file);
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').style.borderColor = 'var(--gray2)';
  document.getElementById('dropZone').style.background = '';
  const file = e.dataTransfer.files[0];
  if (file) {
    document.getElementById('docFile').files = e.dataTransfer.files;
    showFileInfo(file);
  }
}

function showFileInfo(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('⚠️ Chỉ chấp nhận file PDF');
    return;
  }
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  const info = document.getElementById('docFileInfo');
  info.style.display = 'block';
  info.innerHTML = `✅ <strong>${file.name}</strong> — ${sizeMB} MB`;
}

async function uploadDoc() {
  if (!currentHRUserId) return;
  const file = document.getElementById('docFile').files[0];
  if (!file) { showToast('⚠️ Chọn file PDF trước'); return; }
  const docType = document.getElementById('docType').value;
  const note = document.getElementById('docNote').value.trim();

  const btn = document.getElementById('docUploadBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang tải lên...';

  try {
    await uploadHRDoc(currentHRUserId, file, docType, note);
    showToast('✅ Đã tải lên thành công');
    clearDocForm();
    await loadHRDocs(currentHRUserId);
  } catch(e) {
    showToast('❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '⬆️ Tải lên';
  }
}

function clearDocForm() {
  document.getElementById('docFile').value = '';
  document.getElementById('docNote').value = '';
  document.getElementById('docFileInfo').style.display = 'none';
  document.getElementById('docType').value = 'contract';
}

async function loadHRDocs(userId) {
  const el = document.getElementById('docList');
  el.innerHTML = '<div class="loading"><span class="spinner"></span> Đang tải...</div>';
  try {
    const docs = await sbFetch(`hr_documents?user_id=eq.${userId}&order=created_at.desc`);
    if (!docs.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div>Chưa có hồ sơ nào</div>';
      return;
    }
    el.innerHTML = `<div class="att-table-wrap"><table>
      <thead><tr>
        <th>Loại hồ sơ</th><th>Tên file</th><th>Dung lượng</th>
        <th>Ghi chú</th><th>Ngày tải</th><th></th>
      </tr></thead>
      <tbody>${docs.map((d,i) => {
        const sizeMB = d.file_size ? (d.file_size/1024/1024).toFixed(2)+' MB' : '—';
        const date = new Date(d.created_at);
        const dateStr = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
        const bg = i%2===0?'':'background:rgba(255,255,255,.02)';
        return `<tr style="${bg}">
          <td><span style="font-size:12px">${DOC_TYPE_LABEL[d.doc_type]||d.doc_type}</span></td>
          <td style="font-size:13px;color:var(--gray8);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
              title="${d.file_name}">${d.file_name}</td>
          <td style="font-size:12px;color:var(--gray5)">${sizeMB}</td>
          <td style="font-size:12px;color:var(--gray7)">${d.note||'—'}</td>
          <td style="font-size:12px;color:var(--gray5);white-space:nowrap">${dateStr}</td>
          <td style="display:flex;gap:6px">
            <button class="btn-edit-sm" onclick="viewDoc('${d.file_path}')" title="Xem PDF">👁</button>
            <button class="btn-icon-sm" onclick="deleteDoc('${d.id}','${d.file_path}','${d.file_name.replace(/'/g,'')}')" title="Xóa">🗑</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  } catch(e) {
    el.innerHTML = '<div class="empty-state">❌ ' + e.message + '</div>';
  }
}

async function viewDoc(filePath) {
  try {
    showToast('⏳ Đang tạo link...');
    const url = await getSignedUrl(filePath);
    // Try window.open first, fallback to anchor click
    const w = window.open(url, '_blank');
    if (!w) {
      // Popup blocked - use anchor
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
    }
  } catch(e) {
    showToast('❌ ' + e.message);
    console.error('viewDoc error:', e);
  }
}

async function deleteDoc(docId, filePath, fileName) {
  if (!confirm(`Xóa file "${fileName}"?

Hành động này không thể hoàn tác.`)) return;
  try {
    await deleteHRDoc(docId, filePath);
    showToast('✅ Đã xóa file');
    await loadHRDocs(currentHRUserId);
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}

