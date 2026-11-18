/*
 * AI Voter Desk (AIVD) — answer engine
 * Index Prima · AI4Elections prototype
 *
 * Extractive, citation-first question answering over the Electoral Act.
 * No LLM: every answer is built from provision text that ships with the app,
 * so every claim can be traced to a cited section.
 *
 * Works in the browser (window.AIVD) and in Node (require('./engine')).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AIVD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Text utilities
  // ---------------------------------------------------------------------------

  var STOPWORDS = new Set((
    // English
    'a an and are as at be been being but by can could did do does doing for from had has have ' +
    'how i if in into is it its me my of on or our please should so than that the their them then ' +
    'there these they this those to was we were what when where which who whom why will with would ' +
    'you your yours about any also am get got just let more must not now only other own same some ' +
    'such tell too very want know there\'s what\'s happen happens happening' +
    // Nigerian Pidgin function words
    ' law laws talk talks electoral act broda sista someone somebody person people' +
    ' abeg wetin dey na wey una dem don go fit make sabi say e im am oga madam sef o ehn abi ' +
    'wahala how far no be dis dat di for di wan wan im ya'
  ).split(/\s+/));

  // Pidgin / colloquial -> canonical English terms (query expansion only).
  var LEXICON = {
    pikin: ['child', 'minor'],
    cari: ['carry'], carry: ['carry', 'take'],
    pvc: ['permanent', 'voter', 'card'], card: ['card'],
    vote: ['vote', 'voting', 'voter'], votes: ['vote'], voting: ['vote', 'voting'],
    shine: ['register'],
    register: ['register', 'registration'], registration: ['registration', 'register'],
    collect: ['collect', 'collection'], collection: ['collection', 'collect'],
    money: ['money', 'inducement', 'gift'], owo: ['money', 'inducement'],
    buy: ['buy', 'inducement', 'bribe'], bribe: ['bribe', 'inducement'],
    result: ['result', 'results'], results: ['result', 'results'],
    count: ['count', 'counting'], counting: ['count', 'counting'],
    transmit: ['transmit', 'transmission', 'electronic'], upload: ['transmit', 'transmission', 'electronic'],
    bvas: ['bvas', 'accreditation', 'device', 'technological'],
    machine: ['device', 'technological', 'bvas'],
    spoil: ['fail', 'malfunction'], spoilt: ['fail', 'malfunction'], 'no work': ['fail'],
    fail: ['fail', 'malfunction'], fails: ['fail'], failed: ['fail'],
    cancel: ['cancel', 'cancelled'], cancelled: ['cancel'],
    rig: ['rig', 'falsify', 'malpractice'],
    campaign: ['campaign', 'campaigning'],
    blind: ['disability', 'visually', 'impaired', 'assist'],
    disabled: ['disability'], disability: ['disability'],
    old: ['age', 'years'], age: ['age', 'years'], years: ['age', 'years'],
    move: ['transfer'], relocate: ['transfer'], transfer: ['transfer'],
    court: ['petition', 'tribunal'], tribunal: ['tribunal', 'petition'], petition: ['petition', 'tribunal'],
    phone: ['phone', 'device', 'photograph'], snap: ['photograph'],
    secret: ['secrecy', 'secret'], secrecy: ['secrecy', 'secret'],
    accredit: ['accreditation'], accreditation: ['accreditation'],
    see: ['visually', 'impaired'], help: ['assist'], sell: ['inducement', 'buy'], selling: ['inducement', 'buy'],
    lost: ['replacement'], replace: ['replacement'], replacement: ['replacement']
  };

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^a-z0-9'()\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stem(w) {
    if (w.length <= 4) return w;
    return w
      .replace(/(ations|ation)$/, 'ate')
      .replace(/(ings|ing)$/, '')
      .replace(/(ies)$/, 'y')
      .replace(/(ed)$/, '')
      .replace(/(es|s)$/, '');
  }

  function tokenize(s) {
    return normalize(s)
      .replace(/[()'-]/g, ' ')
      .split(' ')
      .filter(function (w) { return w && !STOPWORDS.has(w); });
  }

  function expand(tokens) {
    var out = [];
    tokens.forEach(function (t) {
      out.push(t);
      (LEXICON[t] || []).forEach(function (x) { out.push(x); });
      // A bare small number in a voter question is almost always an age ("I am 17").
      if (/^\d{1,2}$/.test(t)) out.push('age', 'years');
    });
    return out.map(stem);
  }

  // ---------------------------------------------------------------------------
  // Language detection (English vs Nigerian Pidgin)
  // ---------------------------------------------------------------------------

  // [pattern, weight]. Strong markers rarely occur in English; weak ones do.
  var PIDGIN_MARKERS = [
    [/\bwetin\b/, 2], [/\bdey\b/, 2], [/\babeg\b/, 2], [/\buna\b/, 2], [/\bpikin\b/, 2],
    [/\bsabi\b/, 2], [/\bdi\b/, 2], [/\bwahala\b/, 2], [/\bshey\b/, 2], [/\bbroda\b/, 2],
    [/\bsista\b/, 2], [/\bdis\b/, 1], [/\bdat\b/, 1], [/\bna\b/, 1], [/\bwey\b/, 1],
    [/\bfit\b/, 1], [/\bdon\b/, 1], [/\bwan\b/, 1], [/\bdem\b/, 1], [/\bim\b/, 1],
    [/\bsef\b/, 1], [/\bcari\b/, 1], [/\bmake (i|e|we|dem|una|person)\b/, 1],
    [/\bhow (i|we|person) (go|fit)\b/, 1], [/\bno be\b/, 1], [/\bfor where\b/, 1],
    [/\b(go|fit|don) (win|vote|do|collect|happen|be|register|transfer)\b/, 1],
    [/\bperson (fit|go|collect|wan|suppose)\b/, 1], [/\bsuppose be\b/, 1],
    [/\bno fit\b/, 1], [/\b(help|tell|give|carry|show|take) am\b/, 1], [/\bwho go\b/, 1]
  ];

  function detectLanguage(q) {
    var n = normalize(q);
    var score = PIDGIN_MARKERS.reduce(function (c, m) { return c + (m[0].test(n) ? m[1] : 0); }, 0);
    return score >= 2 ? 'pcm' : 'en';
  }

  // ---------------------------------------------------------------------------
  // Retrieval (BM25 over provisions)
  // ---------------------------------------------------------------------------

  function buildIndex(provisions) {
    var docs = provisions.map(function (p) {
      var field = [p.title, p.title, p.text, (p.keywords || []).join(' '), (p.keywords || []).join(' ')].join(' ');
      var toks = expand(tokenize(field));
      var tf = Object.create(null);
      toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      return { p: p, tf: tf, len: toks.length };
    });
    var df = Object.create(null);
    docs.forEach(function (d) { Object.keys(d.tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); });
    var avgLen = docs.reduce(function (s, d) { return s + d.len; }, 0) / Math.max(1, docs.length);
    return { docs: docs, df: df, N: docs.length, avgLen: avgLen };
  }

  function search(index, query, k) {
    var qTerms = Array.from(new Set(expand(tokenize(query))));
    var baseTerms = Array.from(new Set(tokenize(query).map(stem)));
    var k1 = 1.4, b = 0.75;
    var scored = index.docs.map(function (d) {
      var score = 0, matchedBase = 0;
      qTerms.forEach(function (t) {
        var f = d.tf[t];
        if (!f) return;
        var idf = Math.log(1 + (index.N - index.df[t] + 0.5) / (index.df[t] + 0.5));
        score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / index.avgLen));
      });
      baseTerms.forEach(function (t) {
        var variants = [t].concat((LEXICON[t] || []).map(stem));
        if (variants.some(function (v) { return d.tf[v]; })) matchedBase++;
      });
      return { p: d.p, score: score, coverage: baseTerms.length ? matchedBase / baseTerms.length : 0 };
    });
    scored.sort(function (a, b2) { return b2.score - a.score; });
    return { hits: scored.slice(0, k || 3), queryTerms: baseTerms };
  }

  // ---------------------------------------------------------------------------
  // Guardrails
  // ---------------------------------------------------------------------------

  function checkGuardrails(rules, query) {
    var n = normalize(query);
    for (var i = 0; i < rules.guardrails.length; i++) {
      var g = rules.guardrails[i];
      // "allow" patterns are informational phrasings that must NOT be refused
      // (e.g. "is vote buying an offence?").
      if ((g.allow || []).some(function (re) { return re.test(n); })) continue;
      if (g.patterns.some(function (re) { return re.test(n); })) return g;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Answer composition
  // ---------------------------------------------------------------------------

  function citationLabel(p, actName) {
    if (!p.section) return actName + ' (section number to be confirmed)';
    return actName + ', s. ' + p.section + (p.subsection ? '(' + p.subsection + ')' : '');
  }

  function excerpt(text, queryTerms, maxLen) {
    maxLen = maxLen || 420;
    var sentences = String(text).split(/(?<=[.;:])\s+/);
    if (text.length <= maxLen) return text;
    // Pick the sentence window with the most query-term hits.
    var best = 0, bestScore = -1;
    sentences.forEach(function (s, i) {
      var toks = new Set(tokenize(s).map(stem));
      var sc = queryTerms.reduce(function (c, t) { return c + (toks.has(t) ? 1 : 0); }, 0);
      if (sc > bestScore) { bestScore = sc; best = i; }
    });
    var out = '';
    for (var j = best; j < sentences.length && (out + sentences[j]).length <= maxLen; j++) out += (out ? ' ' : '') + sentences[j];
    if (!out) out = sentences[best].slice(0, maxLen);
    return (best > 0 ? '… ' : '') + out + (out.length < text.length ? ' …' : '');
  }

  function createEngine(opts) {
    var provisions = opts.provisions;
    var rules = opts.rules;
    var meta = opts.meta || {};
    var actName = meta.actName || 'Electoral Act 2026';
    var T = Object.assign({ minScore: 2.2, minCoverage: 0.5, relatedRatio: 0.6, maxCitations: 3 }, opts.thresholds || {});
    var index = buildIndex(provisions);
    var M = rules.messages;

    var byId = Object.create(null);
    provisions.forEach(function (p) { byId[p.id] = p; });

    // Fill Act-sourced conflict text from the corpus, so the panel always
    // shows the same wording that the citations show.
    function resolveConflict(c) {
      var sources = c.sources.map(function (s) {
        var p = s.provisionId && byId[s.provisionId];
        if (!p) return Object.assign({ verified: false }, s);
        return Object.assign({}, s, { text: p.text, page: p.page || null, verified: !!p.verified });
      });
      return Object.assign({}, c, { sources: sources });
    }

    function ask(question, options) {
      options = options || {};
      var q = String(question || '').trim();
      var lang = options.lang && options.lang !== 'auto' ? options.lang : detectLanguage(q);
      var base = { question: q, lang: lang, citations: [], conflicts: [], unverified: false, askedAt: new Date().toISOString() };

      if (q.length < 3) {
        return Object.assign(base, { type: 'not_covered', reason: 'empty', text: M.empty[lang] });
      }

      var g = checkGuardrails(rules, q);
      if (g) {
        return Object.assign(base, { type: 'refused', reason: g.id, text: g.message[lang], guardrail: g.id });
      }

      var r = search(index, q, 5);
      var top = r.hits[0];
      var debug = r.hits.map(function (h) { return { id: h.p.id, score: +h.score.toFixed(3), coverage: +h.coverage.toFixed(2) }; });

      if (!top || top.score < T.minScore || top.coverage < T.minCoverage) {
        return Object.assign(base, { type: 'not_covered', reason: 'low_confidence', text: M.notCovered[lang], debug: debug });
      }

      var chosen = r.hits.filter(function (h, i) {
        return i === 0 || (h.score >= top.score * T.relatedRatio && h.coverage >= T.minCoverage);
      }).slice(0, T.maxCitations);

      var citations = chosen.map(function (h) {
        return {
          id: h.p.id,
          label: citationLabel(h.p, actName),
          title: h.p.title,
          excerpt: excerpt(h.p.text, r.queryTerms),
          page: h.p.page || null,
          verified: !!h.p.verified,
          score: +h.score.toFixed(3)
        };
      });

      var lead = chosen[0].p;
      var summary = (lang === 'pcm' ? lead.summary_pcm : lead.summary_en) || null;
      var text;
      if (summary) {
        text = summary;
      } else {
        text = (lang === 'pcm' ? M.extractiveLead.pcm : M.extractiveLead.en).replace('{label}', citations[0].label);
      }

      var ids = new Set(citations.map(function (c) { return c.id; }));
      var conflicts = (rules.conflicts || []).filter(function (c) {
        return c.triggers.some(function (t) { return ids.has(t); });
      }).map(resolveConflict);

      return Object.assign(base, {
        type: 'answer',
        text: text,
        caveat: M.caveat[lang],
        citations: citations,
        conflicts: conflicts,
        unverified: citations.some(function (c) { return !c.verified; }),
        debug: debug
      });
    }

    return { ask: ask, provisions: provisions, rules: rules, meta: meta, thresholds: T };
  }

  // ---------------------------------------------------------------------------
  // Flag-for-review record
  // ---------------------------------------------------------------------------

  function makeFlagRecord(result, note, reporter) {
    return {
      id: 'flag_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      flaggedAt: new Date().toISOString(),
      note: String(note || '').slice(0, 1000),
      reporter: reporter || null,
      question: result.question,
      lang: result.lang,
      type: result.type,
      reason: result.reason || null,
      answer: result.text,
      citations: (result.citations || []).map(function (c) { return c.label; }),
      status: 'open'
    };
  }

  return {
    createEngine: createEngine,
    detectLanguage: detectLanguage,
    makeFlagRecord: makeFlagRecord,
    _internals: { tokenize: tokenize, expand: expand, normalize: normalize, stem: stem }
  };
});
