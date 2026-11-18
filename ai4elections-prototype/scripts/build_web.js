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
const files = ['index.html', 'engine.js', 'data/provisions.js', 'data/rules.js'];

fs.rmSync(out, { recursive: true, force: true });
for (const f of files) {
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.copyFileSync(path.join(app, f), path.join(out, f));
}

const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || '').trim();
fs.writeFileSync(path.join(out, 'config.js'),
  '/* Generated at build time by scripts/build_web.js */\n' +
  'window.AIVD_CONFIG = ' + JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key }, null, 2) + ';\n');

const { meta } = require(path.join(app, 'data', 'provisions.js'));
console.log(`Built ${files.length + 1} files into dist/ · corpus: ${meta.corpus}${meta.verified ? ' (verified)' : ' (SAMPLE)'} · shared review queue: ${url && key ? 'on' : 'off'}`);
