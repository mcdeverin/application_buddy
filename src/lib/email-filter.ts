export const EMAIL_QUERY_REVISION = 2;
export const applicationEmailQuery = '{"your application" "thank you for applying" "thanks for applying" "you have applied" "you\'ve applied" "new application" "application received" "application status" "interview" "phone screen" "next steps" "meeting with us" "offer letter" "as discussed" "candidate update" "regarding your candidacy" "availability request" "interviewing"}';
export type EmailKind = 'confirmation' | 'update' | 'interview' | 'offer';
export type EmailEvidence = { kind: EmailKind; reason: string };

// Scope interpretation to the message content rather than legal/marketing footers.
function primaryText(value: string) {
  return value.split(/(?:unsubscribe|manage (?:your )?(?:email )?preferences|privacy policy|confidentiality notice|this (?:email|message) (?:and any attachments )?is (?:intended|confidential))/i)[0].slice(0, 12000);
}
export function classifyApplicationEmail(subject: string, body: string, sender: string): EmailEvidence | null {
  const heading = subject.replace(/^(?:(?:re|fw|fwd):\s*)+/gi, '').trim();
  const content = primaryText(body);
  const text = `${heading}\n${content}`;
  // Reject announcements even if they contain sample interview/application language.
  const digest = /last looks|job (?:alerts?|matches|recommendations)|(?:new|latest|recommended) (?:remote )?job (?:opportunities|openings|listings)|dream job|trending (?:bowl )?posts|jobs (?:for you|were erased)|auto apply is on|career newsletter|interview (?:tips|advice|guide|preparation tips)|how to (?:ace|prepare for) (?:an? )?interview/i;
  if (digest.test(heading)) return null;
  if (/(?:last[._-]?looks|digest\.fishbowlapp\.com|mail\.remotehunter\.com|mail\.beehiiv\.com|notifications\.creditkarma\.com|customerspark\.walmart\.com|withpower\.com|opinionsbysync\.com)/i.test(sender)) return null;
  const nonEmployment = /(?:loan|credit card|benefits|mortgage|rental|insurance|visa|grant|college|university admission) application|application (?:for|to) (?:benefits|a loan|credit)|social security|retirement benefits/i;
  if (nonEmployment.test(heading) || /(?:Benefits\.Application@ssa\.gov|citicards@|@(?:info\d*\.citi\.com|notifications\.creditkarma\.com))/i.test(sender)) return null;
  const jobContext = /(?:\b(?:role|position|candidate|candidacy|hiring|recruiter|recruiting|employment|job)\b|your application|application to|applying (?:to|for)|you['’]ve applied)/i.test(text) || /@(?:hire\.lever\.co|ashbyhq\.com|greenhouse\.io|myworkday\.com)>?$/i.test(sender.trim());
  const rejection = /not (?:be )?(?:moving|proceeding) (?:forward|ahead)|(?:decided|chosen) (?:not to|to pursue|to move forward with other)|not (?:been )?selected|(?:other|another) candidates?|unable to (?:offer|move forward)|regret to inform|unfortunately[\s\S]{0,180}(?:application|position|role|candidacy|proceed|move forward)/i;
  if (jobContext && rejection.test(text)) return { kind: 'update', reason: 'A hiring decision or rejection addressed to the candidate.' };
  if (/offer of employment|pleased to offer you|(?:your|attached|signed) (?:job )?offer letter|job offer for/i.test(text)) return { kind: 'offer', reason: 'An employment offer or offer letter.' };
  // A confirmation subject wins over generic "we may invite you to interview" boilerplate.
  if (/thank(?:s| you) for (?:your application|applying)|we (?:have )?received your application|application (?:has been |was )?(?:received|submitted)|you (?:have|successfully) applied|you['’]ve applied|new application/i.test(heading)) {
    if (!nonEmployment.test(text) && jobContext) return { kind: 'confirmation', reason: 'Confirmation that an employment application was submitted or received.' };
  }
  const interviewSubject = /\binterview\b|phone screen|recruiter screen|thank you for meeting with us/i.test(heading);
  const interviewRequest = /(?:next stage|next round)[\s\S]{0,60}interviewing|(?:provide|share|send)[\s\S]{0,55}days and times|(?:invite|inviting|schedule|scheduling|arrange|confirm|confirmed|reschedule|looking forward|join|meet|meeting)[\s\S]{0,100}(?:interview|phone screen)|(?:interview|phone screen)[\s\S]{0,100}(?:invite|schedule|confirm|availability|available|reschedule|zoom|teams|meet|round)|(?:share|send|provide|what is|let (?:me|us) know)[\s\S]{0,45}(?:your )?availability[\s\S]{0,100}(?:interview|screen|discuss (?:the|your) (?:role|application))/i.test(text);
  if ((interviewSubject || interviewRequest) && jobContext && !/interview (?:with|featuring) (?:a celebrity|the author)|(?:market research|paid research|clinical trial|online board)/i.test(text)) return { kind: 'interview', reason: 'An interview request, arrangement, or follow-up conversation.' };
  if (jobContext && /(?:your|the) application (?:is |has been |was )?(?:under review|being reviewed|reviewed|on hold)|(?:update|information|status|decision|next steps|regarding)[\s\S]{0,65}(?:your application|your candidacy)|your application to|regarding your candidacy/i.test(text)) return { kind: 'update', reason: 'An update about a specific employment application.' };
  if (jobContext && /thank(?:s| you) for (?:your application|applying)|we (?:have )?received your application|application (?:has been |was )?(?:received|submitted)/i.test(content) && !nonEmployment.test(text)) return { kind: 'confirmation', reason: 'The body confirms receipt of an employment application.' };
  // Personal recruiter threads can use a role-specific subject instead of "application".
  if (/^as discussed\b/i.test(heading) && /(?:analyst|manager|specialist|associate|engineer|director|coordinator)/i.test(heading) && /(?:send|submit|forward)[\s\S]{0,45}(?:your )?(?:resume|résumé)|(?:interview|your application|submit you|hiring (?:team|manager))/i.test(content)) return { kind: 'update', reason: 'A recruiter conversation about submitting your candidacy for a specific role.' };
  return null;
}
