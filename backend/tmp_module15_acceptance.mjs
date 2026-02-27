const BASE_URL = 'http://localhost:3100';

function makeClient() {
  let cookie = '';
  let lastSetCookie = '';

  async function request(method, path, body, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (cookie) {
      headers.Cookie = cookie;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      lastSetCookie = setCookie;
      cookie = setCookie.split(';')[0];
    }

    const raw = await res.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    return { status: res.status, data, headers: res.headers, raw };
  }

  function getLastSetCookie() {
    return lastSetCookie;
  }

  return { request, getLastSetCookie };
}

function pass(name, ok, details = '') {
  return { name, ok, details };
}

function summarize(checks) {
  const failed = checks.filter((c) => !c.ok);
  return {
    ok: failed.length === 0,
    failed,
  };
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(baseIso, days) {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextWorkingDate(fromIso, startOffset = 0) {
  for (let i = startOffset; i < startOffset + 14; i += 1) {
    const candidate = shiftDate(fromIso, i);
    const weekday = new Date(candidate).getDay();
    if (weekday !== 0 && weekday !== 6) {
      return candidate;
    }
  }
  return fromIso;
}

function isoYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

async function main() {
  const anon = makeClient();
  const admin = makeClient();
  const user = makeClient();
  const userB = makeClient();

  const criteria = [];
  const c1Checks = [];
  const c8Checks = [];

  // Base auth/session setup
  const adminLogin = await admin.request('POST', '/api/auth/login', {
    email: 'admin@cleverlog.local',
    password: 'Admin1234!',
  });
  const userLogin = await user.request('POST', '/api/auth/login', {
    email: 'ivanov@cleverlog.local',
    password: 'User1234!',
  });
  const userBLogin = await userB.request('POST', '/api/auth/login', {
    email: 'petrova@cleverlog.local',
    password: 'User1234!',
  });

  if (adminLogin.status !== 200 || userLogin.status !== 200 || userBLogin.status !== 200) {
    console.error('FATAL: cannot login baseline accounts');
    process.exit(1);
  }

  const users = await admin.request('GET', '/api/users');
  const userAId = users.data.find((u) => u.email === 'ivanov@cleverlog.local')?.id;
  const userBId = users.data.find((u) => u.email === 'petrova@cleverlog.local')?.id;

  const projects = await user.request('GET', '/api/projects');
  const activeProjectId = projects.data.find((p) => p.status === 'active')?.id;

  const today = isoToday();
  const workLogDate = nextWorkingDate(today, 0);
  const absenceDate = nextWorkingDate(today, 1);
  const { year, month } = isoYearMonth();
  const ym = `${year}-${String(month).padStart(2, '0')}`;

  // Seed one work log and one absence for id-based routes
  const w1 = await user.request('POST', '/api/work-logs', {
    date: workLogDate,
    project_id: activeProjectId,
    duration: '2h',
    comment: 'acceptance-log-a',
    task_number: 'ACC-1',
  });
  const workLogId = w1.data?.id;

  const absenceCreate = await user.request('POST', '/api/absences', {
    type: 'day_off',
    date_from: absenceDate,
    date_to: absenceDate,
    comment: 'acceptance-absence-a',
  });
  const absenceId = absenceCreate.data?.created?.[0]?.id;

  const cfCreate = await admin.request('POST', '/api/custom-fields', {
    name: `ACC Field ${Date.now()}`,
    type: 'text',
  });
  const customFieldId = cfCreate.data?.id;

  // ---- Criterion 1: cover all matrix routes ----
  c1Checks.push(pass('health public', (await anon.request('GET', '/api/health')).status !== 401));
  c1Checks.push(pass('js-error public', (await anon.request('POST', '/api/log-js-error', { message: 'x' })).status === 200));
  c1Checks.push(pass('auth register public', (await anon.request('POST', '/api/auth/register', { token: 'bad', password: 'Aa1!aaaa' })).status !== 401));
  c1Checks.push(pass('auth login public', adminLogin.status === 200));
  c1Checks.push(pass('auth logout public', (await anon.request('POST', '/api/auth/logout')).status !== 401));
  c1Checks.push(pass('auth me protected', (await user.request('GET', '/api/auth/me')).status === 200));
  c1Checks.push(pass('change-password protected', (await user.request('POST', '/api/auth/change-password', { current_password: 'bad', new_password: 'New1234!' })).status !== 401));

  c1Checks.push(pass('users GET admin only', (await user.request('GET', '/api/users')).status === 403 && (await admin.request('GET', '/api/users')).status === 200));
  c1Checks.push(pass('users/:id GET admin only', (await user.request('GET', `/api/users/${userAId}`)).status === 403 && (await admin.request('GET', `/api/users/${userAId}`)).status === 200));
  c1Checks.push(pass('users POST admin only', (await user.request('POST', '/api/users', { first_name: 'x', last_name: 'y', email: `x${Date.now()}@x.local`, role: 'user' })).status === 403));
  c1Checks.push(pass('users/:id PATCH admin only', (await user.request('PATCH', `/api/users/${userAId}`, { position: 'Nope' })).status === 403));

  c1Checks.push(pass('projects GET user/admin', (await user.request('GET', '/api/projects')).status === 200 && (await admin.request('GET', '/api/projects')).status === 200));
  c1Checks.push(pass('projects POST admin only', (await user.request('POST', '/api/projects', { name: 'Nope' })).status === 403 && (await admin.request('POST', '/api/projects', { name: `ACC-P-${Date.now()}` })).status === 201));
  c1Checks.push(pass('projects/:id GET user/admin', (await user.request('GET', `/api/projects/${activeProjectId}`)).status === 200 && (await admin.request('GET', `/api/projects/${activeProjectId}`)).status === 200));
  c1Checks.push(pass('projects/:id PATCH admin only', (await user.request('PATCH', `/api/projects/${activeProjectId}`, { status: 'active' })).status === 403 && (await admin.request('PATCH', `/api/projects/${activeProjectId}`, { status: 'active' })).status === 200));

  c1Checks.push(pass('custom-fields admin only', (await user.request('GET', '/api/custom-fields')).status === 403 && (await admin.request('GET', '/api/custom-fields')).status === 200));
  c1Checks.push(pass('project custom-fields GET user/admin', (await user.request('GET', `/api/projects/${activeProjectId}/custom-fields`)).status === 200 && (await admin.request('GET', `/api/projects/${activeProjectId}/custom-fields`)).status === 200));
  c1Checks.push(pass('project custom-fields POST/PATCH/DELETE admin', (await user.request('POST', `/api/projects/${activeProjectId}/custom-fields`, { custom_field_id: customFieldId })).status === 403));
  const pcfCreate = await admin.request('POST', `/api/projects/${activeProjectId}/custom-fields`, { custom_field_id: customFieldId });
  c1Checks.push(pass('project custom-fields admin post works', pcfCreate.status === 201 || pcfCreate.status === 409));
  c1Checks.push(pass('project custom-fields admin patch works', (await admin.request('PATCH', `/api/projects/${activeProjectId}/custom-fields/${customFieldId}`, { is_enabled: true })).status === 200));
  c1Checks.push(pass('project custom-fields admin delete works', (await admin.request('DELETE', `/api/projects/${activeProjectId}/custom-fields/${customFieldId}`)).status === 200));

  c1Checks.push(pass('calendar month GET protected', (await user.request('GET', `/api/calendar/${year}/${month}`)).status === 200 && (await admin.request('GET', `/api/calendar/${year}/${month}`)).status === 200));
  c1Checks.push(pass('calendar day PATCH admin only', (await user.request('PATCH', `/api/calendar/days/${today}`, { day_type: 'working' })).status === 403 && (await admin.request('PATCH', `/api/calendar/days/${today}`, { day_type: 'working' })).status === 200));
  c1Checks.push(pass('calendar norm GET protected', (await user.request('GET', `/api/calendar/norm/${year}/${month}`)).status === 200));
  c1Checks.push(pass('calendar norm PUT admin only', (await user.request('PUT', `/api/calendar/norm/${year}/${month}`, { norm_hours: 168 })).status === 403 && (await admin.request('PUT', `/api/calendar/norm/${year}/${month}`, { norm_hours: 168 })).status === 200));

  c1Checks.push(pass('work-logs GET protected', (await user.request('GET', '/api/work-logs')).status === 200));
  c1Checks.push(pass('work-logs POST protected', w1.status === 201));
  c1Checks.push(pass('work-logs/:id PATCH/DELETE protected', (await user.request('PATCH', `/api/work-logs/${workLogId}`, { comment: 'acc update' })).status === 200 && (await user.request('DELETE', `/api/work-logs/${workLogId}`)).status === 200));

  c1Checks.push(pass('absences GET protected', (await user.request('GET', '/api/absences')).status === 200));
  c1Checks.push(pass('absences POST protected', absenceCreate.status === 201));
  c1Checks.push(pass('absences/:id PATCH/DELETE protected', (await user.request('PATCH', `/api/absences/${absenceId}`, { comment: 'acc upd' })).status === 200 && (await user.request('DELETE', `/api/absences/${absenceId}`)).status === 200));

  c1Checks.push(pass('month-closures status protected', (await user.request('GET', `/api/month-closures/status/${year}/${month}`)).status === 200));
  c1Checks.push(pass('month-closures admin routes', (await user.request('GET', '/api/month-closures')).status === 403 && (await admin.request('GET', '/api/month-closures')).status === 200 && (await admin.request('POST', '/api/month-closures', { year, month })).status !== 401 && (await admin.request('DELETE', `/api/month-closures/${year}/${month}`)).status !== 401));

  c1Checks.push(pass('reports user route', (await user.request('GET', '/api/reports/user')).status === 200));
  c1Checks.push(pass('reports project/monthly/unlogged admin only', (await user.request('GET', '/api/reports/project')).status === 403 && (await admin.request('GET', '/api/reports/project')).status === 200 && (await admin.request('GET', `/api/reports/monthly-summary?year=${year}&month=${month}`)).status === 200 && (await admin.request('GET', `/api/reports/unlogged?year=${year}&month=${month}`)).status === 200));
  c1Checks.push(pass('reports export routes', (await user.request('GET', '/api/reports/user/export')).status === 200 && (await user.request('GET', '/api/reports/project/export')).status === 403 && (await admin.request('GET', '/api/reports/project/export')).status === 200));

  c1Checks.push(pass('dashboard admin only', (await user.request('GET', '/api/dashboard')).status === 403 && (await admin.request('GET', '/api/dashboard')).status === 200));
  c1Checks.push(pass('dashboard/users admin only', (await user.request('GET', '/api/dashboard/users?type=unlogged')).status === 403 && (await admin.request('GET', '/api/dashboard/users?type=unlogged')).status === 200));
  c1Checks.push(pass('audit logs admin only', (await user.request('GET', '/api/audit-logs')).status === 403 && (await admin.request('GET', '/api/audit-logs')).status === 200 && (await admin.request('GET', '/api/audit-logs/export')).status === 200));
  c1Checks.push(pass('notifications admin only', (await user.request('GET', '/api/notifications/settings')).status === 403 && (await admin.request('GET', '/api/notifications/settings')).status === 200 && (await admin.request('PATCH', '/api/notifications/settings', { enabled: true })).status === 200 && (await admin.request('PATCH', `/api/notifications/users/${userAId}`, { enabled: true })).status === 200));

  const c1 = summarize(c1Checks);
  criteria.push({ id: 1, ok: c1.ok, details: c1.failed.map((f) => f.name).join('; ') });

  // ---- Criteria 2..6 from scenario runs ----
  const s2a = await user.request('POST', '/api/work-logs', {
    date: `${ym}-10`,
    project_id: activeProjectId,
    duration: '1h',
    comment: 'scenario2',
    task_number: 'SC2',
  });
  const s2b = await user.request('GET', '/api/reports/project');
  criteria.push({ id: 2, ok: s2a.status === 201 && s2b.status === 403, details: `worklog=${s2a.status}, project-report=${s2b.status}` });

  const s3a = await admin.request('POST', '/api/projects', { name: `SC3-${Date.now()}` });
  const s3b = await admin.request('GET', '/api/dashboard');
  criteria.push({ id: 3, ok: s3a.status === 201 && s3b.status === 200, details: `create-project=${s3a.status}, dashboard=${s3b.status}` });

  await admin.request('POST', '/api/month-closures', { year, month });
  const s4a = await user.request('POST', '/api/work-logs', {
    date: `${ym}-11`,
    project_id: activeProjectId,
    duration: '1h',
    comment: 'blocked',
    task_number: 'SC4-U',
  });
  const s4b = await admin.request('POST', '/api/work-logs', {
    date: `${ym}-11`,
    project_id: activeProjectId,
    duration: '1h',
    comment: 'admin allowed',
    task_number: 'SC4-A',
  });
  await admin.request('DELETE', `/api/month-closures/${year}/${month}`);
  criteria.push({ id: 4, ok: s4a.status === 403 && s4a.data?.code === 'MONTH_CLOSED' && s4b.status === 201, details: `user=${s4a.status}, admin=${s4b.status}` });

  await admin.request('PATCH', `/api/users/${userAId}`, { status: 'inactive' });
  const s5a = await user.request('GET', '/api/auth/me');
  const s5b = await user.request('POST', '/api/auth/login', {
    email: 'ivanov@cleverlog.local',
    password: 'User1234!',
  });
  const s5c = await admin.request('GET', `/api/work-logs?user_id=${userAId}`);
  criteria.push({ id: 5, ok: s5a.status === 401 && s5b.status === 403 && s5b.data?.code === 'ACCOUNT_INACTIVE' && s5c.status === 200, details: `me=${s5a.status}, login=${s5b.status}, admin-view=${s5c.status}` });
  await admin.request('PATCH', `/api/users/${userAId}`, { status: 'active' });
  await user.request('POST', '/api/auth/login', {
    email: 'ivanov@cleverlog.local',
    password: 'User1234!',
  });

  const aLog = await user.request('POST', '/api/work-logs', {
    date: `${ym}-12`,
    project_id: activeProjectId,
    duration: '1h',
    comment: 'iso a',
    task_number: 'ISO-A',
  });
  const aId = aLog.data?.id;
  const s6a = await userB.request('GET', '/api/work-logs');
  const s6b = await userB.request('PATCH', `/api/work-logs/${aId}`, { comment: 'hack' });
  const s6c = await userB.request('DELETE', `/api/work-logs/${aId}`);
  const bSeesA = Array.isArray(s6a.data?.data) ? s6a.data.data.some((x) => x.id === aId) : true;
  criteria.push({ id: 6, ok: s6a.status === 200 && !bSeesA && s6b.status === 403 && s6c.status === 403, details: `list=${s6a.status}, seesA=${bSeesA}, patch=${s6b.status}, del=${s6c.status}` });

  // ---- Criterion 7: errorHandler returns 500 JSON ----
  const bogusUuid = crypto.randomUUID();
  const errResp = await admin.request('POST', '/api/work-logs', {
    user_id: bogusUuid,
    date: `${ym}-13`,
    project_id: activeProjectId,
    duration: '1h',
    comment: 'force500',
    task_number: 'ERR-500',
  });
  const c7ok = errResp.status === 500 && typeof errResp.data === 'object' && errResp.data?.code === 'INTERNAL_ERROR';
  criteria.push({ id: 7, ok: c7ok, details: `status=${errResp.status}, code=${errResp.data?.code}` });

  // ---- Criterion 8: no unprotected admin write routes ----
  c8Checks.push(pass('POST /users', (await user.request('POST', '/api/users', { first_name: 'u', last_name: 'u', email: `x${Date.now()}@x.local`, role: 'user' })).status === 403));
  c8Checks.push(pass('PATCH /users/:id', (await user.request('PATCH', `/api/users/${userBId}`, { position: 'x' })).status === 403));
  c8Checks.push(pass('POST /projects', (await user.request('POST', '/api/projects', { name: 'x' })).status === 403));
  c8Checks.push(pass('PATCH /projects/:id', (await user.request('PATCH', `/api/projects/${activeProjectId}`, { status: 'active' })).status === 403));
  c8Checks.push(pass('POST /custom-fields', (await user.request('POST', '/api/custom-fields', { name: 'x', type: 'text' })).status === 403));
  c8Checks.push(pass('PATCH /calendar/days/:date', (await user.request('PATCH', `/api/calendar/days/${today}`, { day_type: 'working' })).status === 403));
  c8Checks.push(pass('PUT /calendar/norm/:y/:m', (await user.request('PUT', `/api/calendar/norm/${year}/${month}`, { norm_hours: 168 })).status === 403));
  c8Checks.push(pass('POST /month-closures', (await user.request('POST', '/api/month-closures', { year, month })).status === 403));
  c8Checks.push(pass('DELETE /month-closures/:y/:m', (await user.request('DELETE', `/api/month-closures/${year}/${month}`)).status === 403));
  c8Checks.push(pass('PATCH /notifications/settings', (await user.request('PATCH', '/api/notifications/settings', { enabled: false })).status === 403));
  c8Checks.push(pass('PATCH /notifications/users/:id', (await user.request('PATCH', `/api/notifications/users/${userBId}`, { enabled: false })).status === 403));
  const c8 = summarize(c8Checks);
  criteria.push({ id: 8, ok: c8.ok, details: c8.failed.map((f) => f.name).join('; ') });

  // ---- Criterion 9: CORS ----
  const corsAllowed = await anon.request('GET', '/api/health', undefined, { Origin: 'http://localhost:5173' });
  const corsBlocked = await anon.request('GET', '/api/health', undefined, { Origin: 'http://evil.local' });
  const allowHeaderAllowed = corsAllowed.headers.get('access-control-allow-origin');
  const allowHeaderBlocked = corsBlocked.headers.get('access-control-allow-origin');
  const c9ok = allowHeaderAllowed === 'http://localhost:5173' && allowHeaderBlocked !== 'http://evil.local';
  criteria.push({ id: 9, ok: c9ok, details: `allow=${allowHeaderAllowed}, blockHeader=${allowHeaderBlocked}` });

  // ---- Criterion 10: HttpOnly cookie ----
  const loginForCookie = await anon.request('POST', '/api/auth/login', {
    email: 'admin@cleverlog.local',
    password: 'Admin1234!',
  });
  const setCookie = anon.getLastSetCookie();
  const c10ok = loginForCookie.status === 200 && /HttpOnly/i.test(setCookie);
  criteria.push({ id: 10, ok: c10ok, details: `status=${loginForCookie.status}, set-cookie-has-httponly=${/HttpOnly/i.test(setCookie)}` });

  console.log(JSON.stringify({ criteria }, null, 2));
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
