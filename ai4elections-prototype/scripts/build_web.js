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
const files = ['index.html', 'admin.html', 'privacy.html', 'terms.html', 'engine.js', 'data/provisions.js', 'data/rules.js', 'data/guidelines.js', 'data/languages.js'];

fs.rmSync(out, { recursive: true, force: true });
for (const f of files) {
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.copyFileSync(path.join(app, f), path.join(out, f));
}

let url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
let key = (process.env.SUPABASE_ANON_KEY || '').trim();

// Be forgiving about how values were pasted: labels like "A = ", quotes, spaces,
// or a trailing path such as /rest/v1/. Keep only the part we need.
const urlMatch = url.match(/(?:https?:\/\/)?([a-z0-9-]+\.supabase\.(?:co|in))/i);
if (urlMatch) url = 'https://' + urlMatch[1].toLowerCase();
if (!/sb_secret_/.test(key)) {
  const keyMatch = key.match(/sb_publishable_[A-Za-z0-9_-]+/) || key.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (keyMatch) key = keyMatch[0];
}

// Safety checks: this file is served to every visitor, so never publish a secret key.
function jwtRole(k) {
  try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role; } catch (e) { return null; }
}
// Which code is live: the git commit Vercel built (VERCEL_GIT_COMMIT_SHA), plus the build time.
const build = ((process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'local') + ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const problems = [];
// Short codes (never values) written into config.js so the site can explain itself.
const codes = [];
if (!process.env.SUPABASE_URL) codes.push('url_missing');
if (!process.env.SUPABASE_ANON_KEY) codes.push('key_missing');
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$|^https:\/\/[a-z0-9.-]+$/i.test(url)) {
  codes.push(/^sb_/.test(url) ? 'url_is_a_key' : 'url_not_address');
  problems.push('SUPABASE_URL must be your project address, like https://abcdefgh.supabase.co (got something that is not a URL).');
}
if (/sb_secret_/.test(key) || /sb_secret_/.test(url) || jwtRole(key) === 'service_role') {
  codes.push('key_is_secret');
  problems.push('SUPABASE_ANON_KEY is a SECRET key. Use the publishable key (sb_publishable_...) or the legacy anon key instead, and revoke the secret key in Supabase.');
}
if (key && !/^sb_publishable_/.test(key) && jwtRole(key) !== 'anon') {
  if (!codes.includes('key_is_secret')) codes.push(/^https?:/.test(key) ? 'key_is_url' : 'key_not_publishable');
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
  'window.AIVD_CONFIG = ' + JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key, configProblems: codes, build: build }, null, 2) + ';\n');

const { meta } = require(path.join(app, 'data', 'provisions.js'));
console.log(`Built ${files.length + 1} files into dist/ · corpus: ${meta.corpus}${meta.verified ? ' (verified)' : ' (SAMPLE)'} · shared review queue: ${url && key ? 'on' : 'off'}`);
