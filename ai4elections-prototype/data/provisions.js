/*
 * AIVD provisions corpus — SAMPLE PLACEHOLDERS (NOT OFFICIAL TEXT)
 *
 * Every entry below is an unverified plain-language summary written so the
 * prototype can be exercised end to end. None of it is the wording of the
 * Electoral Act 2026, and section numbers are deliberately left blank
 * (except the 47(3) slot reserved for the conflict-panel demo).
 *
 * Replace this file by running:
 *   python3 scripts/ingest_act.py path/to/Electoral-Act-2026.pdf
 * The generated file sets verified: true and records the PDF's SHA-256.
 *
 * Fields
 *   id            stable id (ingest produces "s<section>-<subsection>")
 *   section       section number as a string, or null if unknown
 *   subsection    subsection number as a string, or null
 *   part          Part heading, if known
 *   title         marginal note / section heading
 *   text          provision text (official wording after ingest)
 *   summary_en    optional reviewed plain-English summary shown as the answer
 *   summary_pcm   optional reviewed Pidgin summary (needs native-speaker review)
 *   keywords      extra retrieval terms
 *   topic         topic tag used by the test set
 *   page          PDF page number (after ingest)
 *   verified      true only when text came from the official PDF
 */
var AIVD_META = {
  actName: 'Electoral Act 2026',
  corpus: 'sample',
  verified: false,
  source: null,
  generatedAt: null
};

var AIVD_PROVISIONS = [
  {
    id: 'sample-eligibility',
    section: null, subsection: null, part: null,
    title: 'Qualification to register as a voter',
    text: '[SAMPLE — NOT OFFICIAL TEXT] A Nigerian citizen who has attained the age of 18 years, is ordinarily resident, works or originates from the registration area, and presents himself or herself with proof of identity may register as a voter. A person shall register only once and at one registration centre.',
    summary_en: 'A Nigerian citizen aged 18 or above can register as a voter in the area where they live, work or come from, and may register only once.',
    summary_pcm: 'If you be Naija citizen wey don reach 18 years, you fit register as voter for di area wey you dey stay, work or come from. You fit register only one time.',
    keywords: ['register', 'eligible', 'qualify', 'age', '18', 'citizen', 'minimum age', 'registration'],
    topic: 'registration', page: null, verified: false
  },
  {
    id: 'sample-continuous-registration',
    section: null, subsection: null, part: null,
    title: 'Continuous voter registration',
    text: '[SAMPLE — NOT OFFICIAL TEXT] The Commission shall conduct continuous registration of voters at its offices and designated centres. Registration shall be suspended not later than a specified number of days before any general election to allow the preparation and display of the register.',
    summary_en: 'INEC runs continuous voter registration at its offices and designated centres, but registration stops for a period before a general election so the register can be prepared and displayed.',
    summary_pcm: 'INEC dey do voter registration steady for dia office and centres, but dem go stop am small time before general election so dem fit arrange and paste di register.',
    keywords: ['continuous', 'registration', 'where register', 'when register', 'deadline', 'suspend', 'office', 'cvr'],
    topic: 'registration', page: null, verified: false
  },
  {
    id: 'sample-transfer',
    section: null, subsection: null, part: null,
    title: 'Transfer of registration',
    text: '[SAMPLE — NOT OFFICIAL TEXT] A registered voter who changes residence may apply to the Commission for transfer of registration to the new constituency, presenting the voter card. Applications for transfer shall close a specified number of days before an election.',
    summary_en: 'If you move, you can apply to INEC to transfer your registration to your new area by presenting your voter card, before the transfer deadline ahead of an election.',
    summary_pcm: 'If you don move go another place, you fit apply make INEC transfer your registration go di new area. Carry your voter card go, and do am before di deadline.',
    keywords: ['transfer', 'move', 'relocate', 'new state', 'change polling unit', 'residence'],
    topic: 'transfer', page: null, verified: false
  },
  {
    id: 'sample-pvc',
    section: null, subsection: null, part: null,
    title: 'Permanent voter card collection',
    text: '[SAMPLE — NOT OFFICIAL TEXT] The Commission shall issue a permanent voter card to every registered voter. The card shall be collected in person by the registered voter at the designated collection centre on presentation of the temporary voter slip or other means of identification. No person shall collect a voter card on behalf of another.',
    summary_en: 'Your PVC must be collected in person at the designated INEC collection centre; nobody may collect it on your behalf.',
    summary_pcm: 'Na you yourself go collect your PVC for di INEC centre wey dem talk. Nobody fit collect am for you.',
    keywords: ['pvc', 'permanent voter card', 'collect', 'collection', 'voter card', 'proxy', 'someone else'],
    topic: 'pvc', page: null, verified: false
  },
  {
    id: 's47-3',
    section: '47', subsection: '3', part: null,
    title: 'Accreditation — failure of technological device',
    text: '[SAMPLE — NOT OFFICIAL TEXT] Placeholder for section 47(3). Expected subject: what happens where the technological device used for accreditation of voters (such as BVAS) fails to function at a polling unit and is not replaced. Insert the official wording from the Electoral Act 2026 via the ingest script before demo.',
    summary_en: 'Section 47(3) deals with what happens if the accreditation device (such as BVAS) fails at a polling unit and is not replaced. The official wording has not yet been loaded — check the citation and the conflict panel below.',
    summary_pcm: 'Section 47(3) talk about wetin go happen if di accreditation machine (like BVAS) spoil for polling unit and dem no replace am. We never load di official wording yet — check di citation and di conflict panel wey dey below.',
    keywords: ['bvas', 'accreditation', 'device', 'technological', 'fail', 'malfunction', 'card reader', 'cancel', 'polling unit', 'not working'],
    topic: 'accreditation', page: null, verified: false
  },
  {
    id: 'sample-accreditation',
    section: null, subsection: null, part: null,
    title: 'Accreditation of voters',
    text: '[SAMPLE — NOT OFFICIAL TEXT] A person intending to vote shall present himself or herself to the presiding officer at the polling unit in which the name is registered with a voter card. The presiding officer shall use a technological device prescribed by the Commission to verify, confirm or authenticate the particulars of the intending voter.',
    summary_en: 'To vote, you go to the polling unit where you registered with your voter card, and the presiding officer verifies you with the device INEC prescribes (for example BVAS).',
    summary_pcm: 'To vote, go di polling unit wey you register with your voter card. Di presiding officer go use di machine wey INEC approve (like BVAS) check say na you.',
    keywords: ['accreditation', 'polling unit', 'voter card', 'presiding officer', 'verify', 'bvas', 'how to vote', 'identify'],
    topic: 'accreditation', page: null, verified: false
  },
  {
    id: 'sample-secrecy',
    section: null, subsection: null, part: null,
    title: 'Secrecy of the ballot',
    text: '[SAMPLE — NOT OFFICIAL TEXT] Voting shall be by secret ballot. No voter shall show the marked ballot paper to any person, and no person shall use a phone or other device to photograph a marked ballot paper in the voting cubicle.',
    summary_en: 'Voting is by secret ballot: you must not show anyone your marked ballot or photograph it with your phone.',
    summary_pcm: 'Voting na secret. No show anybody your ballot paper wey you don mark, and no use phone snap am.',
    keywords: ['secret', 'secrecy', 'ballot', 'photograph', 'phone', 'show', 'cubicle', 'snap'],
    topic: 'secrecy', page: null, verified: false
  },
  {
    id: 'sample-disability',
    section: null, subsection: null, part: null,
    title: 'Assistance for voters with disabilities',
    text: '[SAMPLE — NOT OFFICIAL TEXT] A voter who is visually impaired or otherwise physically unable to vote without assistance may be accompanied into the polling unit by a person chosen by the voter, who shall not be a polling agent. The Commission shall take reasonable steps to provide suitable means of communication, such as braille ballot guides and magnifying glasses.',
    summary_en: 'A voter with a disability (for example visual impairment) may bring a person of their choice — not a polling agent — to help them vote, and INEC should provide aids such as braille guides.',
    summary_pcm: 'If you get disability (like if your eye no dey see well), you fit carry person wey you choose make e help you vote — but e no fit be party agent. INEC suppose provide tins like braille guide.',
    keywords: ['disability', 'blind', 'visually impaired', 'assist', 'help', 'pwd', 'braille', 'elderly'],
    topic: 'disability', page: null, verified: false
  },
  {
    id: 'sample-vote-buying',
    section: null, subsection: null, part: null,
    title: 'Offence of vote buying and inducement',
    text: '[SAMPLE — NOT OFFICIAL TEXT] A person who gives, offers or receives money, gift or any other inducement to influence a voter to vote or refrain from voting for any candidate commits an offence and is liable on conviction to a fine or imprisonment or both.',
    summary_en: 'Giving, offering or accepting money or gifts to influence how someone votes is an offence, for both the giver and the receiver, punishable by a fine, imprisonment or both.',
    summary_pcm: 'To give, offer or collect money or gift make person vote one way na offence — both di person wey give and di person wey collect. Dem fit fine you or put you for prison or both.',
    keywords: ['vote buying', 'buy votes', 'money', 'bribe', 'inducement', 'gift', 'offence', 'penalty', 'sell vote'],
    topic: 'offences', page: null, verified: false
  },
  {
    id: 'sample-campaign-period',
    section: null, subsection: null, part: null,
    title: 'Period of campaign',
    text: '[SAMPLE — NOT OFFICIAL TEXT] Campaigns for elections shall commence a specified number of days before polling day and end 24 hours before polling day. Campaigning on polling day, including at or near a polling unit, is prohibited.',
    summary_en: 'Campaigns may only run during the official campaign window and must stop 24 hours before polling day; campaigning on election day is not allowed.',
    summary_pcm: 'Campaign get time wey dem fit start and e must stop 24 hours before election day. Nobody suppose campaign on top election day.',
    keywords: ['campaign', 'campaigning', 'rally', 'start', 'end', 'stop', 'election day', 'polling day'],
    topic: 'campaign', page: null, verified: false
  },
  {
    id: 'sample-results',
    section: null, subsection: null, part: null,
    title: 'Counting, announcement and transmission of results',
    text: '[SAMPLE — NOT OFFICIAL TEXT] After the close of poll the presiding officer shall count the votes at the polling unit in the presence of polling agents and observers, record the result on the prescribed form, announce it, and transfer or transmit the result in the manner prescribed by the Commission.',
    summary_en: 'Votes are counted at the polling unit in front of agents and observers; the presiding officer records and announces the result, then transmits it as INEC prescribes.',
    summary_pcm: 'Dem go count di votes for di polling unit for di front of party agents and observers. Di presiding officer go write di result, announce am, then send am di way INEC talk.',
    keywords: ['result', 'results', 'count', 'counting', 'announce', 'transmit', 'transmission', 'irev', 'upload', 'form ec8a'],
    topic: 'results', page: null, verified: false
  },
  {
    id: 'sample-petition',
    section: null, subsection: null, part: null,
    title: 'Election petitions',
    text: '[SAMPLE — NOT OFFICIAL TEXT] An election may be questioned only by an election petition presented to the appropriate tribunal or court by a candidate or political party within the period prescribed after the declaration of results.',
    summary_en: 'An election result can only be challenged through an election petition filed by a candidate or party at the right tribunal or court, within a fixed time after results are declared.',
    summary_pcm: 'If person wan challenge election result, na only election petition e fit file for tribunal or court, and na candidate or party fit do am, inside di time wey law give after dem declare result.',
    keywords: ['petition', 'tribunal', 'court', 'challenge', 'dispute', 'contest result', 'appeal'],
    topic: 'petitions', page: null, verified: false
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { meta: AIVD_META, provisions: AIVD_PROVISIONS };
}
