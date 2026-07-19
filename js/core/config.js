// ============================================================
// VELA_CHAMCONG — config.js
// Supabase init, STATE global, constants
// ============================================================

const CFG = {
  SUPABASE_URL: 'https://ynffvkuwdrfqlmpemhes.supabase.co',
  SUPABASE_KEY: 'sb_publishable_TPB6sZUqz5z6549RU8hKhQ_F83ref0J',
  SB2_URL:      'https://gqelblpdujdqdddisjei.supabase.co',   // Tiến Độ (quân số)
  SB2_KEY:      'sb_publishable_ze2HoQt8kAzb0WSkZqSbdA_qupIyCmu',
  GOOGLE_CLIENT_ID: '775858800222-r25d91n7qa5454aqhb2ni6q77kds2hns.apps.googleusercontent.com',
  APP_URL:      'https://velae-c.github.io/VELA_CHAMCONG/',
  LOGO_URL:     'https://raw.githubusercontent.com/VelaE-C/VELA_CHAMCONG/refs/heads/main/LOGO%20VELA.png',
};

// Global state — single source of truth
const STATE = {
  session:        null,
  currentUser:    null,
  projects:       [],
  users:          [],
  checkedInToday: false,
  todayAttId:     null,
  mode:           'checkin',  // 'checkin' | 'checkout'
  lastAttData:    null,
  lastTeamData:   null,
};

// Pay period: 26th prev month → 25th current month
const PAY_PERIOD = {
  getRange(year, month) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const start = `${prevYear}-${String(prevMonth).padStart(2,'0')}-26`;
    const end   = `${year}-${String(month).padStart(2,'0')}-25`;
    return { start, end, prevMonth, prevYear };
  },
  getDateList(year, month) {
    const { prevMonth, prevYear } = this.getRange(year, month);
    const dates = [];
    for (let d = 26; d <= 31; d++) {
      const dt = new Date(prevYear, prevMonth - 1, d);
      if (dt.getMonth() === prevMonth - 1) dates.push(dt);
    }
    for (let d = 1; d <= 25; d++) {
      dates.push(new Date(year, month - 1, d));
    }
    return dates;
  }
};

const DAYS_VI   = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
const DAYS_SHORT = ['CN','T2','T3','T4','T5','T6','T7'];
const MONTHS_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                   'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const STATUS_LABEL = {
  present: '✅ Có mặt', absent: '❌ Vắng',
  leave:   '🏖 Nghỉ phép', holiday: '🎌 Nghỉ lễ'
};
const STATUS_BADGE = {
  present: 'badge-green', absent: 'badge-red',
  leave: 'badge-blue', holiday: 'badge-amber'
};
const DOC_TYPE_LABEL = {
  cv:          '👤 CV Công việc',
  contract:    '📋 Hợp đồng lao động',
  id_card:     '🪪 CCCD / CMND',
  certificate: '🎓 Bằng cấp / Chứng chỉ',
  health:      '🏥 Khám sức khỏe',
  other:       '📄 Khác'
};
