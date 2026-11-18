#!/usr/bin/env node
/* Sanity checks on the generated corpora (data/provisions.js, data/guidelines.js). */
'use strict';
const { meta, provisions } = require('../data/provisions');
const rules = require('../data/rules');
let G = null;
try { G = require('../data/guidelines'); } catch (e) { /* optional */ }

const checks = [];
const check = (name, ok) => checks.push([name, !!ok]);
const byId = Object.fromEntries(provisions.map((p) => [p.id, p]));

check('Act corpus is the verified official text', meta.verified && meta.corpus === 'official');
check('Act sections 1..N with no gaps', (() => {
  const nums = [...new Set(provisions.map((p) => parseInt(p.section, 10)))].sort((a, b) => a - b);
  return nums.length && nums.every((n, i) => n === i + 1);
})());
check('s.47(3) present and about BVAS failure', byId['s47-3'] && /Bimodal Voter Accreditation System/.test(byId['s47-3'].text));
check('no Act record starts mid-sentence', !provisions.some((p) => /^[a-z]/.test(p.text)));
check('every Act record has a title', provisions.every((p) => p.title && !/^Section \d/.test(p.title)));

if (G) {
  const docs = Object.fromEntries(G.documents.map((d) => [d.id, d]));
  const reg = G.guidelines.filter((g) => g.docId === 'reg2026');
  const nums = new Set(reg.map((g) => parseInt(g.ref.replace(/\D+/, ''), 10)));
  check('Regulations 2026: paragraphs 1..117 all present', Array.from({ length: 117 }, (_, i) => i + 1).every((n) => nums.has(n)));
  check('Regulations para. 26 is the BVAS malfunction rule', /sustained malfunction/i.test((G.guidelines.find((g) => g.id === 'reg2026-26') || {}).text || ''));
  check('every guidance record points to a known document', G.guidelines.every((g) => docs[g.docId]));
  check('dated documents are marked dated', ['etc', 'ep2023', 'supp2023', 'idp2022'].every((id) => !docs[id] || docs[id].status === 'dated'));
  check('OCR records are not marked verified unless proofread', G.guidelines.every((g) => !g.ocr || !g.verified || g.proofread));
  const ids = new Set(provisions.map((p) => p.id).concat(G.guidelines.map((g) => g.id)));
  check('conflict sources resolve to real records', rules.conflicts.every((c) => c.sources.every((s) => ids.has(s.provisionId || s.guidanceId))));
}

checks.forEach(([n, ok]) => console.log((ok ? 'PASS  ' : 'FAIL  ') + n));
const failed = checks.filter(([, ok]) => !ok).length;
console.log(`\nCorpus checks: ${checks.length - failed}/${checks.length}`);
process.exit(failed ? 1 : 0);
