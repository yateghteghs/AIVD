/*
 * AIVD rules: guardrails, rule-conflict records and response messages.
 *
 * Guardrails are checked in order before retrieval. Each has:
 *   patterns  regexes (run on lower-cased, punctuation-stripped text) that trigger a refusal
 *   allow     regexes for informational phrasings that must NOT be refused,
 *             e.g. "is vote buying an offence?" is a legal question, not a request to buy votes
 *
 * Conflicts power the Section 47(3) rule-conflict panel. Source texts are
 * PLACEHOLDERS until checked against the official Act and the current INEC
 * Regulations and Guidelines; verified must stay false until then.
 */
var AIVD_RULES = {
  guardrails: [
    {
      id: 'manipulation',
      label: 'Election manipulation',
      allow: [
        /\b(is|are|it|na|if)\b.{0,40}\b(offen[cs]e|crime|illegal|legal|lawful|allowed|punish\w*|penalty|against the law|jail|prison)\b/,
        /\b(what|wetin)\b.{0,40}\b(penalty|punishment|happen\w*|sanction)\b/,
        /\breport\w*\b/,
        /\b(se|shin|o bu)\b.{0,40}\b(ese|laifi|mpu)\b/
      ],
      patterns: [
        /\b(how|ways?|help me|teach me|show me|best way|tips?|steps?|plan)\b.{0,40}\b(rig\w*|buy (the |some |more )?votes?|buying votes|bribe (voters?|officials?|inec|presiding|police|agents?)|stuff\w* (the )?ballot|ballot stuffing|snatch\w* (the )?ballot|snatch\w* (the )?box|thumbprint\w* (the )?ballot|falsif\w*|fake (the )?results?|alter (the )?results?|change (the )?results?|hack\w*|intimidat\w*|scare (voters|people)|stop (people|voters) from voting|suppress\w* (the )?(vote|voters|turnout)|vote (twice|more than once|multiple times|two times)|double vot\w*|register (twice|more than once|two times)|impersonat\w*|sell my vote)\b/,
        /\b(write|create|generate|draft|make|compose|design)\b.{0,40}\b(fake news|propaganda|rumou?rs?|false (story|claims?|messages?|news|info\w*)|disinformation|misinformation|deep ?fakes?|smear)\b/,
        /\bhow (i|we|person|my people|dem) (fit|go|wan|can)\b.{0,30}\b(rig\w*|buy vote|buy votes|share money|thumbprint|snatch|change (di |the )?result|vote two times|vote twice|scatter)\b/,
        /\b(where|how)\b.{0,20}\bsell (my |our )?votes?\b/,
        // Yoruba / Hausa / Igbo (accent-free): "how do I rig / buy votes / change results"
        /\b(bawo|ona|ba wo)\b.{0,40}\b(ra ibo|ra idibo|ji ibo|yi esi pada|magomago|se magomago)\b/,
        /\b(yaya|ta yaya|ina)\b.{0,40}\b(sayi? kuri|sayen kuri|saya kuri|magudi|murde zabe|canza sakamako)\b/,
        /\b(kedu|otu)\b.{0,40}\b(zuo vootu|zuta vootu|izu vootu|zuo votu|ohi ntuli|gbanwee nsonaazu|megharia nsonaazu)\b/
      ],
      message: {
        en: "I can't help with that. AI Voter Desk does not assist with rigging, vote buying, intimidation, fake results or misinformation. If you have seen an electoral offence, you can report it to INEC or the police through their official channels.",
        pcm: 'I no fit help with dat one. AI Voter Desk no dey help person rig election, buy vote, threaten people, fake result or spread lie. If you see electoral offence, report am give INEC or police through dia official channel.',
        yo: 'Mi ò lè ràn ọ́ lọ́wọ́ lórí èyí. AI Voter Desk kì í ṣèrànwọ́ fún màgòmágó ìdìbò, rírà ìbò, ìdẹ́rùbà, èsì èké tàbí ìròyìn irọ́. Tí o bá rí ẹ̀ṣẹ̀ ìdìbò, o lè fi tó INEC tàbí ọlọ́pàá létí nípasẹ̀ àwọn ìkànnì wọn.',
        ig: 'Enweghị m ike inyere gị aka n\'ihe a. AI Voter Desk anaghị enyere aka na izu ohi ntuli aka, ịzụ vootu, iyi egwu, nsonaazụ adịgboroja ma ọ bụ ịgbasa ụgha. Ọ bụrụ na ịhụ mpụ ntuli aka, ị nwere ike ịkọrọ INEC ma ọ bụ ndị uwe ojii site n\'ụzọ ozi ha.',
        ha: 'Ba zan iya taimakawa da wannan ba. AI Voter Desk ba ya taimakawa wajen maguɗin zaɓe, sayen ƙuri\'a, tsoratarwa, sakamako na ƙarya ko yaɗa labaran ƙarya. Idan ka ga laifin zaɓe, za ka iya kai rahoto ga INEC ko \'yan sanda ta hanyoyin sadarwarsu na hukuma.'
      }
    },
    {
      id: 'voting_advice',
      label: 'Voting advice',
      allow: [],
      patterns: [
        /\b(who|which (party|candidate|one))\b.{0,30}\b(should|shld|to|must) (i|we|my family|people) vote\b/,
        /\bshould (i|we) vote (for|apc|pdp|lp|labour|nnpp|apga|adc)\b/,
        /\b(best|better|good|right) (candidate|party|choice) (to vote|for me|for us)\b/,
        /\b(which|who)\b.{0,20}\b(best|better) (candidate|party)\b/,
        /\b(who|which party)\b.{0,20}\b(i|we) (go|fit|suppose|wan) vote\b/,
        /\brecommend\w*\b.{0,20}\b(candidate|party)\b/,
        /\btell me (who|which party) to vote\b/,
        /\bvote for who\b/,
        /\b(is|na) (the )?(apc|pdp|lp|nnpp|apga|adc|labour party|labour)\b.{0,20}\b(good|better|best|bad|worse)\b/,
        // Yoruba: "who should I vote for"; Hausa: "who should I vote for / which party"; Igbo: "who should I vote for"
        /\b(ki n|ki emi|ki a|ki a ma|ki n ma)\s+dibo\s+fun\b/, /\bdibo fun ta\b/, /\begbe (oselu )?wo ni\b.{0,20}\bdibo\b/,
        /\bwa(ne|ce)?\b.{0,25}\b(zan|zamu|ya kamata in|ya kamata mu)\s+zab/, /\b(jam'?iyy?a|dan takara)\b.{0,30}\b(zan|in|mu|zamu)\s+zab/,
        /\bonye\b.{0,25}\b(m|anyi)\s+ga.?a?tu/, /\bonye ka m\b.{0,25}\b(tu|votu|vootu)/, /\bndi otu\b.{0,25}\b(m|anyi) ga.?a?tu/
      ],
      message: {
        en: "I can't tell you who to vote for. That choice is yours. I can explain how voting works under the Electoral Act: registration, accreditation, your rights at the polling unit, and offences.",
        pcm: 'I no fit tell you who to vote. Na your own choice be dat. But I fit explain how voting dey work for Electoral Act — registration, accreditation, your rights for polling unit, and offences.',
        yo: 'Mi ò lè sọ ẹni tí o yẹ kí o dìbò fún. Ìpinnu rẹ ni. Mo lè ṣàlàyé bí ìdìbò ṣe ń lọ lábẹ́ Òfin Ìdìbò: ìforúkọsílẹ̀, ìfọwọ́sí olùdìbò, ẹ̀tọ́ rẹ ní ibùdó ìdìbò, àti àwọn ẹ̀ṣẹ̀.',
        ig: 'Enweghị m ike ịgwa gị onye ị ga-atụrụ vootu. Nhọrọ ahụ bụ nke gị. Enwere m ike ịkọwa otú ntuli aka si arụ ọrụ n\'okpuru Iwu Ntuli Aka: ndebanye aha, nnabata ndị ntuli aka, ikike gị n\'ebe ntuli aka, na mpụ.',
        ha: 'Ba zan iya faɗa maka wanda za ka zaɓa ba. Zaɓin naka ne. Zan iya bayyana yadda zaɓe ke gudana a ƙarƙashin Dokar Zaɓe: rajista, tantancewa, haƙƙinka a rumfar zaɓe, da laifuffuka.'
      }
    },
    {
      id: 'prediction',
      label: 'Election prediction',
      allow: [],
      patterns: [
        /\bwho (will|go|is going to|gonna|fit) win\b/,
        /\bpredict\w*\b/,
        /\b(chances? of winning|likely to win|projected winner|polls? (show|say))\b/,
        /\b(forecast\w*|odds)\b.{0,40}\b(election|win\w*|result|race|poll|candidate|party|governorship|presidency)\b/,
        /\bwhich (party|candidate) (will|go|fit) win\b/,
        /\bwill \w+( \w+)? win\b/,
        /\bwho (dey|is) lead\w*\b/,
        // Yoruba: "who will win"; Hausa: "who/which party will win", "predict"; Igbo: "who will win"
        /\b(tani|ta ni|egbe wo|egbe oselu wo)\b.{0,30}\b(yoo|maa|yio|o maa|ma)\s+(wole|bori|gbegba|gba ijoba)\b/,
        /\bwa(ne|ce)?\b.{0,30}\b(zai|za ta|za su|zasu)\s+ci\b/, /\bhasashe\b/,
        /\bonye\b.{0,30}\bga.?emeri\b/, /\bndi otu\b.{0,30}\bga.?emeri\b/
      ],
      message: {
        en: "I don't make election predictions or comment on who is likely to win. INEC declares official results. I can explain how results are counted, collated and announced under the Act.",
        pcm: 'I no dey predict election or talk who go win. Na INEC dey announce official result. I fit explain how dem dey count, collate and announce result for di Act.',
        yo: 'Mi kì í sọ àsọtẹ́lẹ̀ ìdìbò tàbí ẹni tó lè borí. INEC ló ń kéde èsì ìdìbò. Mo lè ṣàlàyé bí wọ́n ṣe ń ka ìbò, tí wọ́n ń kó èsì jọ, tí wọ́n sì ń kéde rẹ̀ lábẹ́ Òfin náà.',
        ig: 'Anaghị m ebu amụma ntuli aka ma ọ bụ ikwu onye ga-emeri. INEC na-ekwupụta nsonaazụ gọọmentị. Enwere m ike ịkọwa otú e si agụ vootu, chịkọta ma kwupụta nsonaazụ n\'okpuru Iwu ahụ.',
        ha: 'Ba na yin hasashen zaɓe ko faɗin wanda zai iya cin nasara. INEC ce ke sanar da sakamakon hukuma. Zan iya bayyana yadda ake ƙirga ƙuri\'u, tattara su da sanar da sakamako a ƙarƙashin Dokar.'
      }
    }
  ],

  conflicts: [
    {
      id: 'conflict-s47-3',
      triggers: ['s47-3', 'reg2026-26', 'reg2026-65', 'reg2026-66'],
      title: 'Section 47(3): BVAS failure at a polling unit',
      question: 'If the BVAS fails at a polling unit and is not replaced, is the election cancelled or does voting continue, when, and does it depend on the overall result?',
      // Source texts are pulled live from the corpora (provisionId / guidanceId).
      // The tension below is AIVD's reading of those texts and needs legal review.
      reviewed: false,
      sources: [
        {
          rank: 1,
          label: 'Electoral Act 2026, s. 47(3)',
          kind: 'Act of the National Assembly',
          provisionId: 's47-3',
          text: ''
        },
        {
          rank: 2,
          label: 'INEC Regulations and Guidelines 2026, para. 26(b)',
          kind: 'Regulations made by INEC under the Act',
          guidanceId: 'reg2026-26',
          text: ''
        },
        {
          rank: 2,
          label: 'INEC Regulations and Guidelines 2026, para. 65',
          kind: 'Regulations made by INEC under the Act',
          guidanceId: 'reg2026-65',
          text: ''
        },
        {
          rank: 2,
          label: 'INEC Regulations and Guidelines 2026, para. 66',
          kind: 'Regulations made by INEC under the Act',
          guidanceId: 'reg2026-66',
          text: ''
        }
      ],
      tension: 'The Act says the election in the unit "shall be cancelled" and a new one scheduled within 24 hours, but only "if the Commission is satisfied" that the unit could substantially affect the overall result. Para. 26(b) of the Regulations instead tells the Presiding Officer that, if no replacement BVAS arrives by 2:30pm, accreditation and voting "shall continue the following day", and it does not mention the "substantially affect" test. Para. 65 aligns with the Act (new election within 24 hours, no return until it holds), and para. 66 applies the test through the margin of lead: a return can be made if the PVCs collected in the affected units are fewer than the leading margin. So a voter can be told "voting continues tomorrow" at the polling unit, while the Act speaks of cancellation and a conditional fresh election.',
      tension_pcm: 'Di Act talk say if BVAS spoil and dem no replace am, dem go cancel di election for dat unit and do new one inside 24 hours — but only if INEC see say di unit fit change di overall result. Para. 26(b) for di Regulations talk say if new BVAS no reach by 2:30pm, accreditation and voting go continue di next day, and e no mention dat condition. Para. 65 follow di Act (new election inside 24 hours), and para. 66 use margin of lead: if di PVCs wey dem collect for di affected units no reach di margin wey di leader take lead, dem fit still declare result.',
      resolution: 'The Act is the controlling authority: INEC makes the Regulations under the Act, and they apply only to the extent that they are consistent with it. AI Voter Desk shows all three texts, treats s. 47(3) as controlling, and does not decide what happened at any particular polling unit; that is for INEC and, if disputed, the election tribunal.',
      resolution_pcm: 'Na di Act get final say. INEC make di Regulations under di Act, so dem dey work only if dem agree with di Act. AI Voter Desk go show you all three, take s. 47(3) as di main one, but e no go judge wetin happen for any particular polling unit — na INEC and tribunal get dat work.'
    }
  ],

  messages: {
    notCovered: {
      en: "Not covered. The provisions loaded into AI Voter Desk don't clearly settle this question, so I won't guess. Please check with your local INEC office or INEC's official channels, or rephrase the question around a specific part of the electoral process.",
      pcm: 'E no dey cover am. Di sections wey dey inside AI Voter Desk no clear-clear answer dis question, so I no go guess. Abeg check with INEC office wey dey near you or INEC official channel, or ask am another way about one part of di election process.',
      yo: 'Kò sí nínú rẹ̀. Àwọn apá òfin tó wà nínú AI Voter Desk kò dáhùn ìbéèrè yìí ní kedere, nítorí náà mi ò ní fojú díwọ̀n. Jọ̀wọ́ kàn sí ọ́fíìsì INEC tó sún mọ́ ọ tàbí àwọn ìkànnì INEC, tàbí béèrè ní ọ̀nà míì nípa apá kan pàtó nínú ètò ìdìbò.',
      ig: 'Ọ dịghị n\'ime ya. Akụkụ iwu dị n\'ime AI Voter Desk azaghị ajụjụ a nke ọma, ya mere agaghị m akọ nkọ. Biko jụọ ụlọ ọrụ INEC dị nso gị ma ọ bụ ụzọ ozi INEC, ma ọ bụ jụọ ajụjụ ahụ n\'ụzọ ọzọ gbasara otu akụkụ nke usoro ntuli aka.',
      ha: 'Ba a rufe wannan ba. Sassan dokar da ke cikin AI Voter Desk ba su amsa wannan tambayar a fili ba, don haka ba zan yi tsammani ba. Don Allah ka tuntuɓi ofishin INEC mafi kusa ko hanyoyin sadarwa na INEC, ko ka sake yin tambayar game da wani takamaiman ɓangare na tsarin zaɓe.'
    },
    empty: {
      en: 'Please type a question about voting or the Electoral Act.',
      pcm: 'Abeg type your question about voting or di Electoral Act.',
      yo: 'Jọ̀wọ́ kọ ìbéèrè kan nípa ìdìbò tàbí Òfin Ìdìbò.',
      ig: 'Biko dee ajụjụ gbasara ịtụ vootu ma ọ bụ Iwu Ntuli Aka.',
      ha: 'Don Allah ka rubuta tambaya game da zaɓe ko Dokar Zaɓe.'
    },
    extractiveLead: {
      en: 'The most relevant provision is {label}. Its wording is quoted below.',
      pcm: 'Di section wey near dis question pass na {label}. Di official wording dey below (for English).',
      yo: 'Apá òfin tó bá ìbéèrè yìí mu jùlọ ni {label}. Ọ̀rọ̀ rẹ̀ wà nísàlẹ̀ (ní èdè Gẹ̀ẹ́sì).',
      ig: 'Akụkụ iwu kacha metụta ajụjụ a bụ {label}. Okwu ya dị n\'okpuru (n\'asụsụ Bekee).',
      ha: 'Sashen dokar da ya fi dacewa da wannan tambayar shi ne {label}. Kalmominsa suna ƙasa (da Turanci).'
    },
    guidanceLead: {
      en: 'The Electoral Act does not directly settle this, but INEC\'s guidance does: see {label}, quoted below.',
      pcm: 'Di Electoral Act no talk am direct, but INEC guidance talk am: check {label} wey dey below (for English).',
      yo: 'Òfin Ìdìbò kò sọ nípa èyí tààrà, ṣùgbọ́n ìtọ́sọ́nà INEC sọ ọ́: wo {label} nísàlẹ̀ (ní èdè Gẹ̀ẹ́sì).',
      ig: 'Iwu Ntuli Aka ekwughị maka nke a ozugbo, mana ntuziaka INEC kwuru ya: lee {label} n\'okpuru (n\'asụsụ Bekee).',
      ha: 'Dokar Zaɓe ba ta faɗi wannan kai tsaye ba, amma jagorar INEC ta faɗa: duba {label} a ƙasa (da Turanci).'
    },
    guidanceCaveat: {
      en: 'This comes from INEC guidance made under the Act, not from the Act itself. It is general information, not legal advice.',
      pcm: 'Dis one come from INEC guidance wey dem make under di Act, e no be di Act itself. Na general information, e no be legal advice.',
      yo: 'Èyí wá láti inú ìtọ́sọ́nà INEC tí wọ́n ṣe lábẹ́ Òfin náà, kì í ṣe láti inú Òfin fúnra rẹ̀. Àlàyé gbogbogbò ni, kì í ṣe ìmọ̀ràn òfin.',
      ig: 'Nke a si na ntuziaka INEC e mere n\'okpuru Iwu ahụ, ọ bụghị site n\'Iwu n\'onwe ya. Ọ bụ ozi izugbe, ọ bụghị ndụmọdụ iwu.',
      ha: 'Wannan ya fito ne daga jagorar INEC da aka yi a ƙarƙashin Dokar, ba daga Dokar kanta ba. Bayani ne na gaba ɗaya, ba shawarar lauya ba.'
    },
    caveat: {
      en: 'This is general information from the Electoral Act, not legal advice.',
      pcm: 'Dis na general information from Electoral Act, e no be legal advice.',
      yo: 'Àlàyé gbogbogbò láti inú Òfin Ìdìbò ni èyí, kì í ṣe ìmọ̀ràn òfin.',
      ig: 'Nke a bụ ozi izugbe sitere n\'Iwu Ntuli Aka, ọ bụghị ndụmọdụ iwu.',
      ha: 'Wannan bayani ne na gaba ɗaya daga Dokar Zaɓe, ba shawarar lauya ba.'
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIVD_RULES;
}
