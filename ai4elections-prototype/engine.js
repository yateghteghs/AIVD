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
    ' law laws talk talks electoral act broda sista someone somebody person people inec suppose' +
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
    buy: ['buy', 'inducement', 'bribe', 'corruptly', 'induce'], buying: ['buy', 'inducement', 'bribe', 'corruptly', 'induce'],
    box: ['box', 'material', 'materials'], boxes: ['box', 'material', 'materials'], bribe: ['bribe', 'inducement'],
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
    phone: ['phone', 'telephone', 'device', 'electronic'], phones: ['phone', 'telephone', 'device', 'electronic'],
    snap: ['photograph', 'picture'], photo: ['photograph', 'picture'], photos: ['photograph', 'picture'],
    picture: ['photograph', 'picture'], selfie: ['photograph', 'picture'],
    secret: ['secrecy', 'secret'], secrecy: ['secrecy', 'secret'],
    accredit: ['accreditation'], accreditation: ['accreditation'],
    see: ['visually', 'impaired'], help: ['assist'], sell: ['inducement', 'buy'], selling: ['inducement', 'buy'],
    time: ['hour', 'date'], start: ['commence', 'begin', 'open'], starts: ['commence', 'begin', 'open'],
    begin: ['commence', 'start'], end: ['close'], ends: ['close'], finish: ['close'], close: ['close'], gun: ['weapon', 'offensive'], guns: ['weapon', 'offensive'], knife: ['weapon', 'offensive'],
    cutlass: ['weapon', 'offensive'], machete: ['weapon', 'offensive'], weapon: ['weapon', 'offensive'],
    punishment: ['liable', 'conviction', 'fine', 'imprisonment', 'offence'], penalty: ['liable', 'conviction', 'fine', 'imprisonment', 'offence'],
    punish: ['liable', 'conviction', 'offence'], jail: ['imprisonment'], prison: ['imprisonment'],
    snatch: ['snatch', 'destroy', 'materials'], snatching: ['snatch', 'destroy', 'materials'],
    shirt: ['dress', 'wear', 'badge', 'symbol'], tshirt: ['dress', 'wear', 'badge', 'symbol'], cap: ['dress', 'wear', 'badge', 'symbol'],
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

  // Light stemmer: strip one common suffix, then cap at 6 characters so that
  // accredit/accredited/accreditation and register/registered/registration
  // land on the same stem. Short words (vote, poll, card) are left alone.
  // Words whose 6-letter stems would collide with unrelated words.
  var STEM_EXCEPTIONS = { displaced: 'displc', displacement: 'displc', displace: 'displc', idp: 'displc', idps: 'displc',
    bribery: 'brib', bribes: 'brib', induce: 'induce', induced: 'induce', inducement: 'induce' };

  function stem(w) {
    if (STEM_EXCEPTIONS[w]) return STEM_EXCEPTIONS[w];
    if (w.length <= 4 || /^\d+$/.test(w)) return w;
    var m = w.match(/^(.{3,}?)(ations|ation|ings|ing|ies|ers|er|ed|es|s|e)$/);
    var base = m ? m[1] : w;
    return base.length > 6 ? base.slice(0, 6) : base;
  }

  function tokenize(s) {
    return normalize(s)
      .replace(/[()'-]/g, ' ')
      .split(' ')
      .filter(function (w) { return w && !STOPWORDS.has(w); });
  }

  function expand(tokens, isQuery) {
    var out = [];
    tokens.forEach(function (t) {
      out.push(t);
      (LEXICON[t] || []).forEach(function (x) { out.push(x); });
      // A bare small number in a voter question is almost always an age ("I am 17").
      if (isQuery && /^\d{1,2}$/.test(t)) out.push('age', 'years', 'attained');
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

  function search(index, query, k, vocabulary) {
    var qTerms = Array.from(new Set(expand(tokenize(query), true)));
    var baseTerms = Array.from(new Set(tokenize(query).map(stem)));
    var k1 = 1.4, b = 0.75;
    // A content word that appears nowhere in the corpus (and has no synonym that does)
    // usually means the question is about something the documents don't cover, so it
    // counts double against coverage.
    var vocab = vocabulary || index.df;
    var denom = baseTerms.reduce(function (n, t) {
      var variants = [t].concat((LEXICON[t] || []).map(stem));
      var known = /^\d+$/.test(t) || variants.some(function (v) { return vocab[v]; });
      return n + (known || t.length < 5 ? 1 : 2);
    }, 0);
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
        if (/^\d{1,2}$/.test(t)) variants = variants.concat(['age', 'years', 'attained'].map(stem));
        if (variants.some(function (v) { return d.tf[v]; })) matchedBase++;
      });
      return { p: d.p, score: score, coverage: denom ? matchedBase / denom : 0 };
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
    var T = Object.assign({ minScore: 2.2, minCoverage: 0.6, relatedMinCoverage: 0.4, relatedRatio: 0.6, maxCitations: 3 }, opts.thresholds || {});
    var index = buildIndex(provisions);
    var M = rules.messages;

    var byId = Object.create(null);
    provisions.forEach(function (p) { byId[p.id] = p; });

    // INEC guidance (optional): supporting documents, ranked below the Act.
    var G = opts.guidance || { documents: [], guidelines: [] };
    var docsById = Object.create(null);
    (G.documents || []).forEach(function (d) { docsById[d.id] = d; });
    var guidance = (G.guidelines || []).filter(function (g) { return docsById[g.docId]; });
    var gById = Object.create(null);
    guidance.forEach(function (g) { gById[g.id] = g; });
    var gIndex = guidance.length ? buildIndex(guidance) : null;
    var vocab = Object.assign(Object.create(null), index.df, gIndex ? gIndex.df : {});

    // Fill Act-sourced conflict text from the corpus, so the panel always
    // shows the same wording that the citations show.
    function resolveConflict(c) {
      var sources = c.sources.map(function (s) {
        var p = s.provisionId && byId[s.provisionId];
        if (p) return Object.assign({}, s, { text: p.text, page: p.page || null, verified: !!p.verified });
        var g = s.guidanceId && gById[s.guidanceId];
        if (g) {
          var d = docsById[g.docId];
          return Object.assign({}, s, { text: g.text, page: g.page || null, verified: !!g.verified, ocr: !!g.ocr,
            proofread: g.proofread || null, url: d.url, status: d.status });
        }
        return Object.assign({ verified: false }, s);
      });
      return Object.assign({}, c, { sources: sources });
    }

    function sectionReference(q) {
      var out = [];
      var re = /\b(?:section|sect\.?|sec\.?|s\.)\s*(\d{1,3}[a-z]?)\s*(?:\(\s*(\d{1,2})\s*\))?/gi, m;
      while ((m = re.exec(q))) {
        var sec = m[1].toUpperCase(), sub = m[2];
        var hits = provisions.filter(function (p) {
          return String(p.section || '').toUpperCase() === sec && (!sub || p.subsection === sub);
        });
        hits.slice(0, sub ? 1 : 2).forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); });
      }
      return out;
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

      var r = search(index, q, 5, vocab);
      var debug = r.hits.map(function (h) { return { id: h.p.id, score: +h.score.toFixed(3), coverage: +h.coverage.toFixed(2) }; });
      function cite(p) {
        return {
          id: p.id,
          label: citationLabel(p, actName),
          title: p.title,
          excerpt: excerpt(p.text, r.queryTerms),
          page: p.page || null,
          verified: !!p.verified
        };
      }

      function citeGuidance(h) {
        var g = h.p, d = docsById[g.docId];
        return {
          id: g.id,
          label: d.short + ', ' + g.ref,
          title: g.title,
          excerpt: excerpt(g.text, r.queryTerms),
          page: g.page || null,
          url: d.url + (g.page ? '#page=' + g.page : ''),
          docTitle: d.title,
          year: d.year,
          basis: d.basis,
          status: d.status,
          note: d.note || null,
          ocr: !!g.ocr,
          proofread: g.proofread || null,
          verified: !!g.verified
        };
      }
      // Guidance hits: current documents first, then by score. Strong = same bar as the Act.
      var gr = gIndex ? search(gIndex, q, 8, vocab) : { hits: [] };
      var gStrong = gr.hits.filter(function (h) { return h.score >= T.minScore && h.coverage >= T.minCoverage; });
      var gCurrent = gStrong.filter(function (h) { return docsById[h.p.docId].status === 'current'; });
      var gDated = gStrong.filter(function (h) { return docsById[h.p.docId].status !== 'current'; });
      var guidanceCites = gCurrent.slice(0, 2).concat(gDated.slice(0, 1)).map(citeGuidance);
      debug = debug.concat(gr.hits.slice(0, 3).map(function (h) { return { id: h.p.id, score: +h.score.toFixed(3), coverage: +h.coverage.toFixed(2) }; }));

      function conflictsFor(ids) {
        return (rules.conflicts || []).filter(function (c) {
          return c.triggers.some(function (t) { return ids.has(t); });
        }).map(resolveConflict);
      }

      // A question that names a section ("section 47(3)", "s. 12") gets that provision first.
      var named = sectionReference(q);
      var top = r.hits[0];
      var chosen;
      if (named.length) {
        chosen = named.map(function (p) { return { p: p }; }).concat(
          r.hits.filter(function (h) { return h.coverage >= T.minCoverage && named.indexOf(h.p) < 0; }).slice(0, 1)
        ).slice(0, T.maxCitations);
      } else if (!top || top.score < T.minScore || top.coverage < T.minCoverage) {
        // The Act doesn't settle it. Current INEC guidance may; dated guidance never does on its own.
        if (gCurrent.length) {
          var gc = gCurrent.slice(0, 2).map(citeGuidance);
          return Object.assign(base, {
            type: 'answer',
            basis: 'guidance',
            text: (M.guidanceLead[lang] || M.guidanceLead.en).replace('{label}', gc[0].label),
            caveat: M.guidanceCaveat[lang],
            citations: [],
            guidance: gc,
            conflicts: conflictsFor(new Set(gc.map(function (c) { return c.id; }))),
            unverified: gc.some(function (c) { return !c.verified; }),
            debug: debug
          });
        }
        // Weaker matches are offered as reading, never as the answer.
        var related = r.hits.filter(function (h) { return h.score >= T.minScore && h.coverage >= T.relatedMinCoverage; })
          .slice(0, 2).map(function (h) { return cite(h.p); })
          .concat(guidanceCites.slice(0, 1));
        return Object.assign(base, { type: 'not_covered', reason: 'low_confidence', text: M.notCovered[lang], related: related, debug: debug });
      } else {
        chosen = r.hits.filter(function (h, i) {
          return i === 0 || (h.score >= top.score * T.relatedRatio && h.coverage >= T.minCoverage);
        }).slice(0, T.maxCitations);
      }

      var citations = chosen.map(function (h) { return cite(h.p); });

      var lead = chosen[0].p;
      var summary = (lang === 'pcm' ? lead.summary_pcm : lead.summary_en) || null;
      var text;
      if (summary) {
        text = summary;
      } else {
        text = (lang === 'pcm' ? M.extractiveLead.pcm : M.extractiveLead.en).replace('{label}', citations[0].label);
      }

      var ids = new Set(citations.map(function (c) { return c.id; }).concat(guidanceCites.map(function (c) { return c.id; })));

      return Object.assign(base, {
        type: 'answer',
        basis: 'act',
        text: text,
        caveat: M.caveat[lang],
        citations: citations,
        guidance: guidanceCites,
        conflicts: conflictsFor(ids),
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
      citations: (result.citations || []).concat(result.guidance || []).map(function (c) { return c.label; }),
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
