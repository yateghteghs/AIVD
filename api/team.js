/*
 * AIVD Review Desk: team management (Vercel serverless function at /api/team).
 *
 * Only super admins may call it. The browser sends the signed-in reviewer's
 * access token; this function checks it with Supabase, confirms the caller is a
 * super admin, and only then uses the Supabase SECRET key, which lives in a
 * server-only Vercel environment variable (SUPABASE_SECRET_KEY) and is never
 * sent to browsers.
 *
 *   GET  /api/team                                   -> { me, members: [...] }
 *   POST /api/team { action: "invite", email, role } -> invites by email and adds to the team
 *   POST /api/team { action: "role", user_id, role } -> changes a member's role
 *   POST /api/team { action: "remove", user_id }     -> removes a member's dashboard access
 */
'use strict';

const ROLES = ['reviewer', 'super_admin'];

function supabaseUrl() {
  const raw = String(process.env.SUPABASE_URL || '').trim();
  const m = raw.match(/(?:https?:\/\/)?([a-z0-9-]+\.supabase\.(?:co|in))/i);
  if (m) return 'https://' + m[1].toLowerCase();
  return raw.replace(/\/+$/, ''); // e.g. a local test server
}

function secretKey() {
  const raw = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const m = raw.match(/sb_secret_[A-Za-z0-9_-]+/) || raw.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return m ? m[0] : '';
}

function adminHeaders(key, extra) {
  const h = Object.assign({ apikey: key, 'Content-Type': 'application/json' }, extra || {});
  // Legacy service_role JWTs also go in Authorization; new sb_secret_ keys go in apikey only.
  if (/^eyJ/.test(key)) h.Authorization = 'Bearer ' + key;
  return h;
}

async function sb(base, key, path, opts) {
  opts = opts || {};
  const res = await fetch(base + path, {
    method: opts.method || 'GET',
    headers: adminHeaders(key, opts.headers),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}

async function listMembers(base, key) {
  const r = await sb(base, key, '/rest/v1/reviewers?select=user_id,email,role,added_at,invited_by&order=added_at.asc');
  if (!r.ok) throw new Error('Could not read the team list. Has supabase/003_team.sql been run?');
  return r.data;
}

module.exports = async function handler(req, res) {
  const base = supabaseUrl();
  const key = secretKey();
  if (!base || !key) {
    return send(res, 503, { error: 'Team management is not set up yet. Add SUPABASE_SECRET_KEY (server-only) in Vercel and redeploy.', code: 'not_configured' });
  }
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  // 1. Who is calling? Verify the reviewer's access token with Supabase.
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return send(res, 401, { error: 'Not signed in.' });
  const who = await fetch(base + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } });
  if (!who.ok) return send(res, 401, { error: 'Your session has expired. Sign in again.' });
  const user = await who.json();

  // 2. Is the caller a super admin?
  const meRow = await sb(base, key, '/rest/v1/reviewers?select=user_id,email,role&user_id=eq.' + encodeURIComponent(user.id));
  const me = meRow.ok && meRow.data && meRow.data[0];
  if (!me || me.role !== 'super_admin') return send(res, 403, { error: 'Only super admins can manage the team.' });

  try {
    if (req.method === 'GET') {
      return send(res, 200, { me: { user_id: me.user_id, email: me.email, role: me.role }, members: await listMembers(base, key) });
    }

    const body = await readBody(req);
    const action = body.action;

    if (action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase();
      const role = ROLES.includes(body.role) ? body.role : 'reviewer';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return send(res, 400, { error: 'Enter a valid email address.' });

      // Existing account? Otherwise send a Supabase invite email, which creates it.
      let found = await sb(base, key, '/rest/v1/rpc/user_id_by_email', { method: 'POST', body: { p_email: email } });
      let userId = found.ok ? found.data : null;
      let invited = false;
      if (!userId) {
        const origin = String(req.headers['x-forwarded-proto'] || 'https') + '://' + String(req.headers['x-forwarded-host'] || req.headers.host || '');
        const inv = await sb(base, key, '/auth/v1/invite?redirect_to=' + encodeURIComponent(origin + '/admin'), { method: 'POST', body: { email } });
        if (!inv.ok) {
          const msg = (inv.data && (inv.data.msg || inv.data.message || inv.data.error_description)) || 'Supabase could not send the invite.';
          return send(res, 502, { error: 'Invite failed: ' + msg + ' (If emails are limited, set up SMTP in Supabase → Authentication → Emails.)' });
        }
        userId = inv.data && (inv.data.id || (inv.data.user && inv.data.user.id));
        if (!userId) {
          found = await sb(base, key, '/rest/v1/rpc/user_id_by_email', { method: 'POST', body: { p_email: email } });
          userId = found.ok ? found.data : null;
        }
        invited = true;
      }
      if (!userId) return send(res, 502, { error: 'The invite was sent but the account could not be found. Try again in a minute.' });

      const up = await sb(base, key, '/rest/v1/reviewers?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: { user_id: userId, email, role, invited_by: me.email }
      });
      if (!up.ok) return send(res, 500, { error: 'Could not add to the team list.' });
      return send(res, 200, {
        ok: true,
        message: invited
          ? 'Invite sent to ' + email + '. They can sign in at /admin after accepting it.'
          : email + ' already had an account and has been added to the team. They can sign in at /admin.',
        members: await listMembers(base, key)
      });
    }

    if (action === 'role' || action === 'remove') {
      const userId = String(body.user_id || '');
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return send(res, 400, { error: 'Unknown team member.' });
      const members = await listMembers(base, key);
      const target = members.find((m) => m.user_id === userId);
      if (!target) return send(res, 404, { error: 'That person is not on the team.' });
      const supers = members.filter((m) => m.role === 'super_admin');

      if (action === 'role') {
        const role = body.role;
        if (!ROLES.includes(role)) return send(res, 400, { error: 'Unknown role.' });
        if (target.role === 'super_admin' && role !== 'super_admin' && supers.length <= 1) {
          return send(res, 400, { error: 'There must always be at least one super admin.' });
        }
        const r = await sb(base, key, '/rest/v1/reviewers?user_id=eq.' + userId, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { role } });
        if (!r.ok) return send(res, 500, { error: 'Could not change the role.' });
        return send(res, 200, { ok: true, message: target.email + ' is now ' + (role === 'super_admin' ? 'a super admin.' : 'a reviewer.'), members: await listMembers(base, key) });
      }

      if (userId === me.user_id) return send(res, 400, { error: 'You can\'t remove yourself. Ask another super admin.' });
      if (target.role === 'super_admin' && supers.length <= 1) return send(res, 400, { error: 'There must always be at least one super admin.' });
      const r = await sb(base, key, '/rest/v1/reviewers?user_id=eq.' + userId, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      if (!r.ok) return send(res, 500, { error: 'Could not remove the member.' });
      return send(res, 200, { ok: true, message: target.email + ' no longer has access to the Review Desk.', members: await listMembers(base, key) });
    }

    return send(res, 400, { error: 'Unknown action.' });
  } catch (err) {
    return send(res, 500, { error: err.message || 'Something went wrong.' });
  }
};
