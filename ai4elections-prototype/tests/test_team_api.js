#!/usr/bin/env node
/*
 * Tests api/team.js (the Vercel function behind the Review Desk Team panel)
 * against a small in-memory fake of the Supabase endpoints it uses.
 */
'use strict';
const http = require('http');
const path = require('path');

const SECRET = 'sb_secret_TESTONLY';
const users = { 'tok-super': { id: '11111111-1111-1111-1111-111111111111', email: 'boss@example.org' },
                'tok-rev': { id: '22222222-2222-2222-2222-222222222222', email: 'rev@example.org' },
                'tok-out': { id: '33333333-3333-3333-3333-333333333333', email: 'outsider@example.org' } };
const authUsers = Object.values(users).map((u) => ({ ...u }));
let reviewers = [
  { user_id: users['tok-super'].id, email: 'boss@example.org', role: 'super_admin', added_at: '2026-11-01T00:00:00Z', invited_by: null },
  { user_id: users['tok-rev'].id, email: 'rev@example.org', role: 'reviewer', added_at: '2026-11-02T00:00:00Z', invited_by: 'boss@example.org' }
];
const invites = [];

const fake = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  let body = '';
  for await (const c of req) body += c;
  const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
  const isAdmin = req.headers.apikey === SECRET;
  if (u.pathname === '/auth/v1/user') {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    return users[t] ? json(200, users[t]) : json(401, { msg: 'invalid token' });
  }
  if (!isAdmin) return json(401, { msg: 'secret key required' });
  if (u.pathname === '/rest/v1/rpc/user_id_by_email') {
    const e = JSON.parse(body).p_email.toLowerCase();
    const f = authUsers.find((x) => x.email === e);
    return json(200, f ? f.id : null);
  }
  if (u.pathname === '/auth/v1/invite') {
    const e = JSON.parse(body).email;
    const nu = { id: '44444444-4444-4444-4444-44444444444' + (authUsers.length), email: e };
    authUsers.push(nu); invites.push({ email: e, redirect: u.searchParams.get('redirect_to') });
    return json(200, nu);
  }
  if (u.pathname === '/rest/v1/reviewers') {
    const eq = (u.searchParams.get('user_id') || '').replace('eq.', '');
    if (req.method === 'GET') return json(200, eq ? reviewers.filter((r) => r.user_id === eq) : reviewers);
    if (req.method === 'POST') {
      const row = JSON.parse(body); const i = reviewers.findIndex((r) => r.user_id === row.user_id);
      if (i >= 0) reviewers[i] = { ...reviewers[i], ...row }; else reviewers.push({ added_at: new Date().toISOString(), ...row });
      return json(201);
    }
    if (req.method === 'PATCH') { reviewers = reviewers.map((r) => (r.user_id === eq ? { ...r, ...JSON.parse(body) } : r)); return json(204); }
    if (req.method === 'DELETE') { reviewers = reviewers.filter((r) => r.user_id !== eq); return json(204); }
  }
  json(404, {});
});

function call(handler, method, token, body) {
  return new Promise((resolve) => {
    const req = { method, headers: { host: 'aivd.test', 'x-forwarded-proto': 'https', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body };
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(s) }); } };
    handler(req, res);
  });
}

(async () => {
  await new Promise((r) => fake.listen(0, r));
  const checks = [];
  const check = (name, ok, extra) => checks.push([name, !!ok, extra]);

  // Not configured
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'http://127.0.0.1:' + fake.address().port;
  const handler = require(path.join(__dirname, '..', '..', 'api', 'team.js'));
  let r = await call(handler, 'GET', 'tok-super');
  check('without SUPABASE_SECRET_KEY it reports "not set up" (503)', r.status === 503 && r.body.code === 'not_configured');

  process.env.SUPABASE_SECRET_KEY = 'label = ' + SECRET; // pasted with a label: still understood
  r = await call(handler, 'GET', null);
  check('no sign-in -> 401', r.status === 401);
  r = await call(handler, 'GET', 'tok-bogus');
  check('expired/invalid token -> 401', r.status === 401);
  r = await call(handler, 'GET', 'tok-out');
  check('signed-in non-member -> 403', r.status === 403);
  r = await call(handler, 'GET', 'tok-rev');
  check('ordinary reviewer -> 403', r.status === 403);
  r = await call(handler, 'POST', 'tok-rev', { action: 'role', user_id: users['tok-rev'].id, role: 'super_admin' });
  check('reviewer cannot promote themselves', r.status === 403);

  r = await call(handler, 'GET', 'tok-super');
  check('super admin can list the team', r.status === 200 && r.body.members.length === 2 && r.body.me.role === 'super_admin');

  r = await call(handler, 'POST', 'tok-super', { action: 'invite', email: 'not-an-email', role: 'reviewer' });
  check('invalid email rejected', r.status === 400);
  r = await call(handler, 'POST', 'tok-super', { action: 'invite', email: 'New.Person@Example.org', role: 'reviewer' });
  check('invite new person sends a Supabase invite', r.status === 200 && invites.length === 1 && invites[0].email === 'new.person@example.org', r.body.message);
  check('invite redirects to /admin on this site', invites[0] && invites[0].redirect === 'https://aivd.test/admin');
  check('new person added to the team as reviewer', reviewers.some((x) => x.email === 'new.person@example.org' && x.role === 'reviewer' && x.invited_by === 'boss@example.org'));
  r = await call(handler, 'POST', 'tok-super', { action: 'invite', email: 'outsider@example.org', role: 'super_admin' });
  check('existing account is added without a new invite', r.status === 200 && invites.length === 1 && reviewers.some((x) => x.email === 'outsider@example.org' && x.role === 'super_admin'));

  r = await call(handler, 'POST', 'tok-super', { action: 'role', user_id: users['tok-rev'].id, role: 'emperor' });
  check('unknown role rejected', r.status === 400);
  r = await call(handler, 'POST', 'tok-super', { action: 'role', user_id: users['tok-rev'].id, role: 'super_admin' });
  check('super admin can promote a reviewer', r.status === 200 && reviewers.find((x) => x.user_id === users['tok-rev'].id).role === 'super_admin');

  r = await call(handler, 'POST', 'tok-super', { action: 'remove', user_id: users['tok-super'].id });
  check('super admin cannot remove themselves', r.status === 400);
  r = await call(handler, 'POST', 'tok-super', { action: 'remove', user_id: users['tok-out'].id });
  check('super admin can remove a member', r.status === 200 && !reviewers.some((x) => x.user_id === users['tok-out'].id));

  // last-super-admin protection: demote others so only boss remains super admin
  reviewers = reviewers.map((x) => (x.user_id === users['tok-super'].id ? x : { ...x, role: 'reviewer' }));
  r = await call(handler, 'POST', 'tok-super', { action: 'role', user_id: users['tok-super'].id, role: 'reviewer' });
  check('the last super admin cannot be demoted', r.status === 400);

  r = await call(handler, 'DELETE', 'tok-super');
  check('other HTTP methods rejected', r.status === 405);
  r = await call(handler, 'GET', 'tok-super');
  check('responses are never cached', r.headers['Cache-Control'] === 'no-store');

  fake.close();
  checks.forEach(([n, ok, extra]) => console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (ok || !extra ? '' : '  (' + extra + ')')));
  const failed = checks.filter(([, ok]) => !ok).length;
  console.log(`\nTeam API checks: ${checks.length - failed}/${checks.length}`);
  process.exit(failed ? 1 : 0);
})();
