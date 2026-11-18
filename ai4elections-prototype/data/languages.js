/*
 * AIVD languages: names, review status, interface text, and the vocabulary the
 * engine uses to understand questions asked in each language.
 *
 * STATUS
 *   reviewed  checked by a native speaker
 *   draft     written by the AIVD team / AI and awaiting native-speaker review;
 *             the app shows a notice while a language is a draft
 *   pending   no translation yet; the app falls back to English and says so
 *
 * The quoted legal text always stays in the official English wording.
 * To review translations: run `node scripts/translations_sheet.js` and send the
 * CSV it writes to native speakers; copy their corrections back here and set
 * status to 'reviewed'.
 *
 * All matching is done on text with accents removed (ẹ→e, ọ→o, ṣ→s, ụ→u, ị→i,
 * ɗ→d, ƙ→k, ɓ→b), so keys below are plain ASCII and people can type with or
 * without diacritics.
 */
var AIVD_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', status: 'reviewed' },
  { code: 'pcm', name: 'Nigerian Pidgin', native: 'Pidgin', status: 'draft' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá', status: 'draft' },
  { code: 'ig', name: 'Igbo', native: 'Igbo', status: 'draft' },
  { code: 'ha', name: 'Hausa', native: 'Hausa', status: 'draft' },
  { code: 'tiv', name: 'Tiv', native: 'Tiv', status: 'pending' }
];

// Interface text. Missing keys fall back to English. (en and pcm live in index.html.)
var AIVD_UI_STRINGS = {
  yo: {
    askLabel: 'Béèrè nípa ìdìbò àti Òfin Ìdìbò (Electoral Act)',
    placeholder: 'àpẹẹrẹ: Ṣé ẹlòmíràn lè gba káàdì ìdìbò (PVC) mi fún mi?',
    hint: 'Àwọn ìdáhùn máa ń tọ́ka sí Òfin náà. A kì í sọ ẹni tí o yẹ kí o dìbò fún, a kì í sì sọ àsọtẹ́lẹ̀.',
    ask: 'Béèrè', queue: 'Àkójọ àyẹ̀wò', queueTitle: 'Àwọn ìdáhùn tí a fi àmì sí fún àyẹ̀wò',
    close: 'Padé', clear: 'Pa gbogbo rẹ̀ rẹ́', export: 'Gbé jáde (JSON)',
    answer: 'Ìdáhùn', not_covered: 'Kò sí nínú rẹ̀', refused: 'Mi ò lè ràn ọ́ lọ́wọ́ lórí èyí', unverified: 'A kò tíì ṣàyẹ̀wò ọ̀rọ̀ yìí',
    sources: 'Orísun', conflict: 'Ìtakora òfin', tension: 'Ibi tí wọ́n ti lè yàtọ̀',
    resolution: 'Bí AIVD ṣe yanjú rẹ̀', controlling: 'Aláṣẹ pàtàkì', subsidiary: 'Lábẹ́ Òfin náà',
    flag: 'Fi àmì sí i fún àyẹ̀wò', flagged: 'O ti fi àmì sí i (ó wà nínú ẹ̀rọ yìí nìkan)', flaggedShared: 'A ti fi ránṣẹ́ sí ẹgbẹ́ àyẹ̀wò',
    reason: 'Kí ló ṣe àṣìṣe?', note: 'Àkíyèsí (tí o bá fẹ́)', submit: 'Fi ránṣẹ́', cancel: 'Fagilé',
    reasons: ['Ìtọ́kasí kò tọ́ tàbí kò sí', 'Ìdáhùn kò tọ́ tàbí kò yé', 'Ó yẹ kí ó kọ̀', 'Kò yẹ kí ó kọ̀', 'Ìṣòro ìtumọ̀ èdè', 'Òmíràn'],
    empty: 'Kò sí àmì kankan síbẹ̀.', page: 'ojú-ìwé',
    inecGuidance: 'Ìtọ́sọ́nà INEC', fromGuidance: 'Láti inú ìtọ́sọ́nà INEC', related: 'Ohun tí o lè kà (kò yanjú ìbéèrè náà)',
    dated: 'Ìwé àtijọ́: wọ́n kọ ọ́ fún {basis}', ocr: 'Ọ̀rọ̀ tí a ṣe sikaanu, a kò tíì ṣàtúnyẹ̀wò rẹ̀', ocrChecked: 'Ọ̀rọ̀ tí a ṣe sikaanu, a ti fi wé ojú-ìwé náà',
    openPdf: 'Ṣí ojú-ìwé PDF', analysisUnreviewed: 'Agbẹjọ́rò kò tíì ṣàyẹ̀wò àlàyé yìí', current: 'Ti lọ́wọ́lọ́wọ́',
    helpful: 'Ṣé èyí ràn ọ́ lọ́wọ́?', yes: 'Bẹ́ẹ̀ni', no: 'Bẹ́ẹ̀kọ́', thanksUp: 'Ẹ ṣé!', thanksDown: 'Ẹ ṣé. Sọ fún wa ohun tí kò tọ́ nísàlẹ̀ (tí o bá fẹ́).',
    privacy: 'A máa ń tọ́jú àwọn ìbéèrè láìsí orúkọ ẹnikẹ́ni láti mú AI Voter Desk dára sí i. Jọ̀wọ́ má ṣe kọ orúkọ, nọ́mbà fóònù tàbí àlàyé ara ẹni míì.',
    privacyMore: 'Bí a ṣe ń ṣe àbójútó ìbéèrè', privacyLink: 'Ìkéde àṣírí', termsLink: 'Àwọn òfin ìlò', reviewerLink: 'Ìwọlé olùṣàyẹ̀wò',
    draftTag: 'Ìtumọ̀ àkọ́kọ́',
    auto: 'Ṣàwárí fúnra rẹ̀',
    language: 'Èdè', draftNotice: 'Ìtumọ̀ àkọ́kọ́ ni èyí; àwọn tó ń sọ Yorùbá ń ṣàyẹ̀wò rẹ̀. Ọ̀rọ̀ òfin tí a fà yọ wà ní èdè Gẹ̀ẹ́sì.'
  },
  ig: {
    askLabel: 'Jụọ ajụjụ gbasara ịtụ vootu na Iwu Ntuli Aka (Electoral Act)',
    placeholder: 'dịka: Onye ọzọ ọ nwere ike ịnara kaadị ntuli aka (PVC) m n\'aka m?',
    hint: 'Azịza na-egosi akụkụ Iwu ahụ. Anyị anaghị agwa mmadụ onye ọ ga-atụrụ vootu, anyị anaghịkwa ebu amụma.',
    ask: 'Jụọ', queue: 'Ndepụta nyocha', queueTitle: 'Azịza e debere maka nyocha',
    close: 'Mechie', clear: 'Hichapụ ha niile', export: 'Bupụta (JSON)',
    answer: 'Azịza', not_covered: 'Ọ dịghị n\'ime ya', refused: 'Enweghị m ike inyere gị aka n\'ihe a', unverified: 'A nyochabeghị ederede a',
    sources: 'Ebe o si', conflict: 'Esemokwu iwu', tension: 'Ebe ha nwere ike ịdị iche',
    resolution: 'Otú AIVD si edozi ya', controlling: 'Ikike kachasị', subsidiary: 'N\'okpuru Iwu ahụ',
    flag: 'Debe ya maka nyocha', flagged: 'Ị debere ya (ọ dị naanị na ngwaọrụ a)', flaggedShared: 'Ezigara ya ndị otu nyocha',
    reason: 'Gịnị bụ nsogbu?', note: 'Ndetu (ọ bụrụ na ịchọrọ)', submit: 'Zipu', cancel: 'Kagbuo',
    reasons: ['Ntụaka ezighi ezi ma ọ bụ ọ nweghị', 'Azịza ezighi ezi ma ọ bụ ọ doghị anya', 'O kwesịrị ịjụ', 'O ekwesịghị ịjụ', 'Nsogbu ntụgharị asụsụ', 'Ihe ọzọ'],
    empty: 'Enwebeghị ihe e debere maka nyocha.', page: 'peeji',
    inecGuidance: 'Ntuziaka INEC', fromGuidance: 'Site na ntuziaka INEC', related: 'Ihe ị nwere ike ịgụ (ọ zaghị ajụjụ ahụ)',
    dated: 'Akwụkwọ ochie: e dere ya maka {basis}', ocr: 'Ederede e si na skaan nweta, a gụghachibeghị ya', ocrChecked: 'Ederede e si na skaan nweta, e jirila peeji ahụ tụnyere ya',
    openPdf: 'Mepee peeji PDF', analysisUnreviewed: 'Onye ọka iwu enyochabeghị nkọwa a', current: 'Nke ugbu a',
    helpful: 'Nke a ọ baara gị uru?', yes: 'Ee', no: 'Mba', thanksUp: 'Daalụ!', thanksDown: 'Daalụ. Gwa anyị ihe na-adịghị mma n\'okpuru (ọ bụrụ na ịchọrọ).',
    privacy: 'Anyị na-edebe ajụjụ n\'enweghị aha onye jụrụ ya iji mee ka AI Voter Desk ka mma. Biko edela aha gị, nọmba ekwentị gị ma ọ bụ ozi nkeonwe ọzọ.',
    privacyMore: 'Otú anyị si ejikwa ajụjụ', privacyLink: 'Ọkwa nzuzo', termsLink: 'Usoro ojiji', reviewerLink: 'Nbanye ndị nyocha',
    draftTag: 'Ntụgharị mbụ',
    auto: 'Chọpụta onwe ya',
    language: 'Asụsụ', draftNotice: 'Nke a bụ ntụgharị mbụ; ndị na-asụ Igbo na-enyocha ya. Ederede iwu e hotara dị n\'asụsụ Bekee.'
  },
  ha: {
    askLabel: 'Yi tambaya game da zaɓe da Dokar Zaɓe (Electoral Act)',
    placeholder: 'misali: Wani zai iya karɓar katin zaɓe na (PVC) a madadina?',
    hint: 'Amsoshi suna nuna sashen Dokar. Ba ma faɗa wa kowa wanda zai zaɓa, kuma ba ma hasashe.',
    ask: 'Tambaya', queue: 'Jerin bita', queueTitle: 'Amsoshin da aka yi wa alama don bita',
    close: 'Rufe', clear: 'Share duka', export: 'Fitar (JSON)',
    answer: 'Amsa', not_covered: 'Ba a rufe wannan ba', refused: 'Ba zan iya taimakawa da wannan ba', unverified: 'Ba a tantance rubutun ba tukuna',
    sources: 'Majiya', conflict: 'Saɓani tsakanin dokoki', tension: 'Inda za su iya bambanta',
    resolution: 'Yadda AIVD ke warware shi', controlling: 'Babbar hukuma', subsidiary: 'A ƙarƙashin Dokar',
    flag: 'Yi alama don bita', flagged: 'An yi alama (yana cikin wannan na\'urar kawai)', flaggedShared: 'An aika wa ƙungiyar bita',
    reason: 'Me ke da kuskure?', note: 'Bayani (idan kana so)', submit: 'Aika', cancel: 'Soke',
    reasons: ['Ambaton doka ba daidai ba ne ko babu', 'Amsa ba daidai ba ce ko ba ta fito fili ba', 'Ya kamata ya ƙi', 'Bai kamata ya ƙi ba', 'Matsalar fassara', 'Wani abu dabam'],
    empty: 'Babu alama tukuna.', page: 'shafi',
    inecGuidance: 'Jagorar INEC', fromGuidance: 'Daga jagorar INEC', related: 'Abin da za ka iya karantawa (bai warware tambayar ba)',
    dated: 'Tsohuwar takarda: an rubuta ta don {basis}', ocr: 'Rubutun da na\'ura ta karanta, ba a sake dubawa ba tukuna', ocrChecked: 'Rubutun da na\'ura ta karanta, an kwatanta shi da shafin',
    openPdf: 'Buɗe shafin PDF', analysisUnreviewed: 'Lauya bai duba wannan bayanin ba tukuna', current: 'Na yanzu',
    helpful: 'Wannan ya taimaka?', yes: 'Ee', no: 'A\'a', thanksUp: 'Na gode!', thanksDown: 'Na gode. Faɗa mana abin da ba daidai ba a ƙasa (idan kana so).',
    privacy: 'Muna adana tambayoyi ba tare da sunan kowa ba don inganta AI Voter Desk. Don Allah kada ka rubuta suna, lambar waya ko wani bayanin kanka.',
    privacyMore: 'Yadda muke kula da tambayoyi', privacyLink: 'Sanarwar sirri', termsLink: 'Sharuɗɗan amfani', reviewerLink: 'Shiga na masu bita',
    draftTag: 'Fassarar farko',
    auto: 'Gano kai tsaye',
    language: 'Harshe', draftNotice: 'Wannan fassarar farko ce; masu magana da Hausa suna duba ta. Rubutun dokar da aka kawo yana cikin Turanci.'
  },
  tiv: {
    // Pending: a Tiv speaker should provide these. Until then the interface shows English.
    pendingNotice: 'Tiv translation is being prepared with Tiv speakers. Text is shown in English for now; you can still ask your question in English or Tiv.'
  }
};

// Vocabulary for understanding questions (accent-free, lower case).
var AIVD_LANGUAGE_PACK = {
  // [pattern, weight] per language; a language needs a score of 2+ to be detected.
  markers: {
    yo: [[/\bidibo\b/, 2], [/\bdibo\b/, 2], [/\bbawo\b/, 2], [/\bkini\b/, 2], [/\bki ni\b/, 2], [/\bnibo\b/, 2], [/\bta ni\b/, 2], [/\btani\b/, 2],
         [/\bse mo\b/, 1], [/\bse\b/, 1], [/\bese\b/, 1], [/\bibo\b/, 1], [/\blati\b/, 1], [/\bmo le\b/, 1], [/\bawon\b/, 1], [/\beyi\b/, 1], [/\bmeloo\b/, 2], [/\bgbodo\b/, 2], [/\byoo\b/, 1], [/\bninu\b/, 1], [/\bkaadi\b/, 1]],
    ha: [[/\bzabe\b/, 2], [/\bzaben\b/, 2], [/\bzaba\b/, 2], [/\bkuri'?a\b/, 2], [/\byaya\b/, 2], [/\bshin\b/, 2], [/\bwane\b/, 2], [/\bwace\b/, 2],
         [/\bdon allah\b/, 2], [/\brumfar?\b/, 2], [/\bdokar\b/, 2], [/\bkatin\b/, 1], [/\bzan\b/, 1], [/\bzai\b/, 1], [/\bidan\b/, 1], [/\bnawa\b/, 2], [/\bshekara\b/, 1]],
    ig: [[/\bkedu\b/, 2], [/\bgini\b/, 2], [/\bntuli\b/, 2], [/\bv[o]{1,2}tu\b/, 2], [/\bebee\b/, 2], [/\bonye\b/, 2], [/\bnwere ike\b/, 2], [/\bbiko\b/, 2],
         [/\bga-/, 1], [/\bka m\b/, 1], [/\bnke\b/, 1], [/\bole\b/, 1], [/\bafo\b/, 1], [/\bihe\b/, 1]]
  },
  // Function words with no topical meaning.
  stopwords: (
    // Yoruba
    'se mo mi ni ti o a e ki bi fun si ninu lati ati tabi won awon eyi yi naa le je ko kini bawo nibo nigba wo re ta tani ' +
    'meloo gbodo to n emi yoo yio maa ba lo wa ' +
    // Hausa
    'shin ne ce da na ta ya za zan zai zamu ina me wane wace yaya idan ko ga don allah kada iya wani wata su mu ka ki sun ' +
    'nawa ake bukata kafin yi faru kenan akwai cikin wanda wadda haka ' +
    // Igbo
    'kedu gini ka m ma bu nke i nwere ike biko onye ebee mgbe maka ya ha anyi gi di ihe ole ga adi tupu otu ' +
    // Tiv (common function words; a Tiv speaker should extend this)
    'u ka nyi er nan sha shin ken ga'
  ).split(/\s+/),
  // Native words -> English terms found in the Act and guidance.
  lexicon: {
    // Yoruba
    idibo: ['election', 'vote'], dibo: ['vote'], ibo: ['vote'], kaadi: ['card'], forukosile: ['register', 'registration'],
    iforukosile: ['register', 'registration'], odun: ['age', 'years'], owo: ['money', 'inducement'], ra: ['buy', 'inducement'],
    rira: ['buy', 'inducement'], ero: ['device', 'bvas'], esi: ['result'], ibudo: ['polling', 'unit'], ese: ['offence'],
    ijiya: ['penalty', 'liable', 'conviction'], afoju: ['visually', 'impaired', 'disability'], alaabo: ['disability'],
    ipolongo: ['campaign'], ejo: ['court', 'petition', 'tribunal'], foonu: ['phone', 'telephone'], aworan: ['photograph', 'picture'],
    baje: ['fail', 'malfunction'], magomago: ['rig', 'malpractice'],
    // Hausa
    zabe: ['election', 'vote'], zaben: ['election', 'vote'], zaba: ['vote'], kuri: ['vote', 'ballot'], kuria: ['vote', 'ballot'],
    katin: ['card'], kati: ['card'], rajista: ['register', 'registration'], shekara: ['age', 'years'], shekaru: ['age', 'years'],
    kudi: ['money', 'inducement'], saye: ['buy', 'inducement'], sayen: ['buy', 'inducement'], saya: ['buy', 'inducement'],
    sayar: ['sell', 'inducement'], naura: ['device', 'bvas'], naurar: ['device', 'bvas'], urar: ['device', 'bvas'], sakamako: ['result'], rumfa: ['polling', 'unit'], rumfar: ['polling', 'unit'],
    laifi: ['offence'], hukunci: ['penalty', 'liable', 'conviction'], makaho: ['visually', 'impaired', 'disability'],
    nakasa: ['disability'], yakin: ['campaign'], kotu: ['court', 'petition'], waya: ['phone', 'telephone'], hoto: ['photograph', 'picture'],
    lalace: ['fail', 'malfunction'], tantancewa: ['accreditation'], magudi: ['rig', 'malpractice'],
    // Igbo
    ntuli: ['election', 'vote'], vootu: ['vote'], votu: ['vote'], tuo: ['vote'], debanye: ['register', 'registration'],
    ndebanye: ['register', 'registration'], afo: ['age', 'years'], ego: ['money', 'inducement'], zuo: ['buy', 'inducement'],
    igwe: ['device', 'bvas'], nsonaazu: ['result'], mpu: ['offence'], ntaramahuhu: ['penalty', 'liable', 'conviction'],
    kpuru: ['visually', 'impaired', 'disability'], nkwaru: ['disability'], mkposa: ['campaign'], ikpe: ['court', 'petition'],
    ekwenti: ['phone', 'telephone'], foto: ['photograph', 'picture'], mebiri: ['fail', 'malfunction']
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { languages: AIVD_LANGUAGES, ui: AIVD_UI_STRINGS, pack: AIVD_LANGUAGE_PACK };
}
