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
        /\breport\w*\b/
      ],
      patterns: [
        /\b(how|ways?|help me|teach me|show me|best way|tips?|steps?|plan)\b.{0,40}\b(rig\w*|buy (the |some |more )?votes?|buying votes|bribe (voters?|officials?|inec|presiding|police|agents?)|stuff\w* (the )?ballot|ballot stuffing|snatch\w* (the )?ballot|snatch\w* (the )?box|thumbprint\w* (the )?ballot|falsif\w*|fake (the )?results?|alter (the )?results?|change (the )?results?|hack\w*|intimidat\w*|scare (voters|people)|stop (people|voters) from voting|suppress\w* (the )?(vote|voters|turnout)|vote (twice|more than once|multiple times|two times)|double vot\w*|register (twice|more than once|two times)|impersonat\w*|sell my vote)\b/,
        /\b(write|create|generate|draft|make|compose|design)\b.{0,40}\b(fake news|propaganda|rumou?rs?|false (story|claims?|messages?|news|info\w*)|disinformation|misinformation|deep ?fakes?|smear)\b/,
        /\bhow (i|we|person|my people|dem) (fit|go|wan|can)\b.{0,30}\b(rig\w*|buy vote|buy votes|share money|thumbprint|snatch|change (di |the )?result|vote two times|vote twice|scatter)\b/,
        /\b(where|how)\b.{0,20}\bsell (my |our )?votes?\b/
      ],
      message: {
        en: "I can't help with that. AI Voter Desk does not assist with rigging, vote buying, intimidation, fake results or misinformation. If you have seen an electoral offence, you can report it to INEC or the police through their official channels.",
        pcm: 'I no fit help with dat one. AI Voter Desk no dey help person rig election, buy vote, threaten people, fake result or spread lie. If you see electoral offence, report am give INEC or police through dia official channel.'
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
        /\b(is|na) (the )?(apc|pdp|lp|nnpp|apga|adc|labour party|labour)\b.{0,20}\b(good|better|best|bad|worse)\b/
      ],
      message: {
        en: "I can't tell you who to vote for. That choice is yours. I can explain how voting works under the Electoral Act: registration, accreditation, your rights at the polling unit, and offences.",
        pcm: 'I no fit tell you who to vote. Na your own choice be dat. But I fit explain how voting dey work for Electoral Act — registration, accreditation, your rights for polling unit, and offences.'
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
        /\bwho (dey|is) lead\w*\b/
      ],
      message: {
        en: "I don't make election predictions or comment on who is likely to win. INEC declares official results. I can explain how results are counted, collated and announced under the Act.",
        pcm: 'I no dey predict election or talk who go win. Na INEC dey announce official result. I fit explain how dem dey count, collate and announce result for di Act.'
      }
    }
  ],

  conflicts: [
    {
      id: 'conflict-s47-3',
      triggers: ['s47-3'],
      title: 'Section 47(3): accreditation device failure',
      question: 'If the accreditation device fails at a polling unit and is not replaced, what happens, and when?',
      verified: false,
      sources: [
        {
          rank: 1,
          label: 'Electoral Act 2026, s. 47(3)',
          kind: 'Act of the National Assembly',
          provisionId: 's47-3', // text is filled from the provisions corpus at answer time
          text: '[PLACEHOLDER] Official wording to be loaded from the Act via the ingest script.'
        },
        {
          rank: 2,
          label: 'INEC Regulations and Guidelines for the Conduct of Elections (edition and clause to confirm)',
          kind: 'Subsidiary rules made by INEC',
          text: '[PLACEHOLDER] The relevant clause on BVAS failure, replacement and rescheduling. Confirm the edition currently in force and quote it word for word.'
        }
      ],
      tension: '[TO VERIFY] Where the Act and the Regulations differ on the trigger, the timeline or the consequence (for example cancellation and rescheduling of the poll in that unit), they can give voters different answers.',
      resolution: 'The Act is the controlling authority. Regulations and guidelines issued by INEC apply only to the extent that they are consistent with the Act. AI Voter Desk shows both sources, treats the Act as controlling, and does not rule on what happened at any specific polling unit; that is for INEC and, if disputed, the election tribunal.',
      resolution_pcm: 'Na di Act get final say. INEC regulations and guidelines dey work only if dem agree with di Act. AI Voter Desk go show you both, take di Act as di main one, but e no go judge wetin happen for any particular polling unit — na INEC and tribunal get dat work.'
    }
  ],

  messages: {
    notCovered: {
      en: "Not covered. The provisions loaded into AI Voter Desk don't clearly settle this question, so I won't guess. Please check with your local INEC office or INEC's official channels, or rephrase the question around a specific part of the electoral process.",
      pcm: 'E no dey cover am. Di sections wey dey inside AI Voter Desk no clear-clear answer dis question, so I no go guess. Abeg check with INEC office wey dey near you or INEC official channel, or ask am another way about one part of di election process.'
    },
    empty: {
      en: 'Please type a question about voting or the Electoral Act.',
      pcm: 'Abeg type your question about voting or di Electoral Act.'
    },
    extractiveLead: {
      en: 'The most relevant provision is {label}. Its wording is quoted below.',
      pcm: 'Di section wey near dis question pass na {label}. Di official wording dey below (for English).'
    },
    caveat: {
      en: 'This is general information from the Electoral Act, not legal advice.',
      pcm: 'Dis na general information from Electoral Act, e no be legal advice.'
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIVD_RULES;
}
