#!/usr/bin/env node
/*
 * AIVD test runner.
 *   node tests/run.js                 run all cases
 *   node tests/run.js --verbose       show each answer
 *   node tests/run.js --only pcm      run cases whose id starts with "pcm"
 *   node tests/run.js --json out.json write machine-readable results
 * Exits 1 if any case fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const AIVD = require('../engine');
const { meta, provisions } = require('../data/provisions');
const rules = require('../data/rules');
let guidance = null;
try { guidance = require('../data/guidelines'); } catch (e) { /* optional */ }

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const suite = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
const engine = AIVD.createEngine({ provisions, rules, meta, guidance });
const byId = new Map(provisions.map((p) => [p.id, p]));

let cases = suite.cases;
if (val('--only')) cases = cases.filter((c) => c.id.startsWith(val('--only')));

const results = cases.map((c) => {
  const r = engine.ask(c.q);
  const e = c.expect;
  const problems = [];
  const types = [].concat(e.type);
  if (!types.includes(r.type)) problems.push(`type: expected ${types.join('|')}, got ${r.type}${r.reason ? ' (' + r.reason + ')' : ''}`);
  if (e.reason && r.reason !== e.reason) problems.push(`reason: expected ${e.reason}, got ${r.reason || '-'}`);
  if (c.lang && r.lang !== c.lang) problems.push(`lang: expected ${c.lang}, got ${r.lang}`);
  if (r.type === 'answer') {
    if (!r.citations.length && !(r.guidance || []).length) problems.push('answer has no citations');
    const top = byId.get(r.citations[0] && r.citations[0].id) || {};
    if (e.topic && !r.citations.some((x) => (byId.get(x.id) || {}).topic === e.topic)) problems.push(`topic: expected ${e.topic}, got ${top.topic || '-'} (${top.id})`);
    if (e.section && !r.citations.some((x) => (byId.get(x.id) || {}).section === e.section)) problems.push(`section: expected s.${e.section} among citations`);
  }
  if (e.conflict && !(r.conflicts && r.conflicts.length)) problems.push('expected rule-conflict panel');
  if (e.basis && r.basis !== e.basis) problems.push(`basis: expected ${e.basis}, got ${r.basis || '-'}`);
  if (e.guidance) {
    const ids = (r.guidance || []).map((g) => g.id);
    if (!e.guidance.some((pre) => ids.some((id) => id === pre || id.startsWith(pre + '-')))) problems.push(`guidance: expected one of ${e.guidance.join(', ')}, got ${ids.join(', ') || '-'}`);
  }
  return { id: c.id, q: c.q, pass: problems.length === 0, problems, got: { type: r.type, basis: r.basis || null, reason: r.reason || null, lang: r.lang, citations: r.citations.map((x) => x.id).concat((r.guidance || []).map((x) => x.id)), conflicts: r.conflicts.map((x) => x.id), text: r.text }, debug: r.debug };
});

const groups = {};
results.forEach((r) => {
  const g = r.id.split('-')[0];
  groups[g] = groups[g] || { pass: 0, total: 0 };
  groups[g].total++; if (r.pass) groups[g].pass++;
});

const label = { en: 'English answers', pcm: 'Pidgin answers', nc: 'Not covered', adv: 'Voting advice refusals', pred: 'Prediction refusals', man: 'Manipulation refusals' };
console.log(`\nAI Voter Desk evaluation · corpus: ${meta.corpus}${meta.verified ? ' (verified)' : ' (UNVERIFIED SAMPLE)'} · ${provisions.length} provisions · ${guidance ? guidance.guidelines.length + ' INEC guidance records' : 'no guidance'}\n`);
results.forEach((r) => {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id.padEnd(8)} ${r.q}`);
  if (!r.pass) r.problems.forEach((p) => console.log(`        - ${p}`));
  if (!r.pass || flag('--verbose')) console.log(`        > [${r.got.type}${r.got.reason ? ':' + r.got.reason : ''}] ${r.got.citations.join(', ')} ${JSON.stringify((r.debug || []).slice(0, 2))}`);
});
console.log('\nSummary');
Object.keys(groups).forEach((g) => console.log(`  ${(label[g] || g).padEnd(26)} ${groups[g].pass}/${groups[g].total}`));
const passed = results.filter((r) => r.pass).length;
console.log(`  ${'TOTAL'.padEnd(26)} ${passed}/${results.length}\n`);
if (!meta.verified) console.log('  Note: citations come from SAMPLE placeholders. Re-run after ingesting the official Act.\n');

if (val('--json')) fs.writeFileSync(val('--json'), JSON.stringify({ meta, ranAt: new Date().toISOString(), passed, total: results.length, results }, null, 2));
process.exit(passed === results.length ? 0 : 1);
