#!/usr/bin/env node
/*
 * Writes translations.csv: every piece of interface and answer text, one row per
 * phrase, one column per language, so native speakers can review and fill gaps
 * in a spreadsheet (Excel, Google Sheets).
 *
 *   node scripts/translations_sheet.js            -> translations.csv
 *   node scripts/translations_sheet.js out.csv
 *
 * Empty cells are untranslated (the app shows English there). After review, copy
 * corrections back into data/languages.js (interface), data/rules.js (answer
 * messages) or index.html (English/Pidgin interface), and set the language's
 * status to 'reviewed' in data/languages.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const L = require(path.join(root, 'data', 'languages.js'));
const rules = require(path.join(root, 'data', 'rules.js'));

// English and Pidgin interface text live in index.html (var UI = {...};)
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const uiSrc = html.slice(html.indexOf('var UI = {') + 'var UI = '.length);
const UI = Function('return ' + uiSrc.slice(0, uiSrc.indexOf('\n  };') + 4))();
Object.assign(UI, L.ui);

const codes = L.languages.map((l) => l.code);
const rows = [];
const flat = (v) => (Array.isArray(v) ? v.join(' | ') : v == null ? '' : String(v));

Object.keys(UI.en).filter((k) => typeof UI.en[k] !== 'object' || Array.isArray(UI.en[k])).forEach((k) => {
  rows.push(['interface', k].concat(codes.map((c) => flat((UI[c] || {})[k]))));
});
['draftTag', 'draftNotice', 'language'].forEach((k) => {
  if (!UI.en[k]) rows.push(['interface', k].concat(codes.map((c) => flat((UI[c] || {})[k]))));
});
Object.keys(rules.messages).forEach((k) => {
  rows.push(['answer message', k].concat(codes.map((c) => flat(rules.messages[k][c]))));
});
rules.guardrails.forEach((g) => {
  rows.push(['refusal message', g.id].concat(codes.map((c) => flat(g.message[c]))));
});
rules.conflicts.forEach((c) => {
  rows.push(['conflict panel', c.id + '.resolution'].concat(codes.map((x) => flat(x === 'en' ? c.resolution : c['resolution_' + x]))));
  rows.push(['conflict panel', c.id + '.tension'].concat(codes.map((x) => flat(x === 'en' ? c.tension : c['tension_' + x]))));
});

const header = ['area', 'key'].concat(L.languages.map((l) => l.native + ' (' + l.code + ', ' + l.status + ')'));
const cell = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
const csv = '﻿' + [header].concat(rows).map((r) => r.map(cell).join(',')).join('\n') + '\n';
const out = process.argv[2] || path.join(root, 'translations.csv');
fs.writeFileSync(out, csv);

const missing = {};
codes.forEach((c, i) => { missing[c] = rows.filter((r) => !r[2 + i]).length; });
console.log('Wrote ' + out + ': ' + rows.length + ' phrases. Untranslated per language: ' +
  codes.map((c) => c + '=' + missing[c]).join(', '));
