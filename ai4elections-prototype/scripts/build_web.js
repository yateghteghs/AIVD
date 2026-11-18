#!/usr/bin/env node
/*
 * Builds the deployable site into ../dist (used by Vercel; see /vercel.json).
 * Copies only what the browser needs and writes config.js from env vars:
 *   SUPABASE_URL, SUPABASE_ANON_KEY  (optional; enable the shared review queue)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const app = path.join(__dirname, '..');
const out = path.join(app, '..', 'dist');
const files = ['index.html', 'admin.html', 'privacy.html', 'terms.html', 'engine.js', 'data/provisions.js', 'data/rules.js', 'data/guidelines.js'];

fs.rmSync(out, { recursive: true, force: true });
for (const f of files) {
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.copyFileSync(path.join(app, f), path.join(out, f));
}

let url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
let key = (process.env.SUPABASE_ANON_KEY || '').trim();

// Safety checks: this file is served to every visitor, so never publish a secret key.
function jwtRole(k) {
  try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role; } catch (e) { return null; }
}
const problems = [];
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$|^https:\/\/[a-z0-9.-]+$/i.test(url)) {
  problems.push('SUPABASE_URL must be your project address, like https://abcdefgh.supabase.co (got something that is not a URL).');
}
if (/^sb_secret_/.test(key) || /^sb_secret_/.test(url) || jwtRole(key) === 'service_role') {
  problems.push('SUPABASE_ANON_KEY is a SECRET key. Use the publishable key (sb_publishable_...) or the legacy anon key instead, and revoke the secret key in Supabase.');
}
if (key && !/^sb_publishable_/.test(key) && jwtRole(key) !== 'anon') {
  problems.push('SUPABASE_ANON_KEY must be the publishable key (sb_publishable_...) or the legacy anon key.');
}
if (problems.length) {
  console.warn('\n*** Supabase settings rejected; shared features are OFF for this build ***');
  problems.forEach((p) => console.warn(' - ' + p));
  console.warn('');
  url = ''; key = '';
}
fs.writeFileSync(path.join(out, 'config.js'),
  '/* Generated at build time by scripts/build_web.js */\n' +
  'window.AIVD_CONFIG = ' + JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key }, null, 2) + ';\n');

const { meta } = require(path.join(app, 'data', 'provisions.js'));
console.log(`Built ${files.length + 1} files into dist/ · corpus: ${meta.corpus}${meta.verified ? ' (verified)' : ' (SAMPLE)'} · shared review queue: ${url && key ? 'on' : 'off'}`);
