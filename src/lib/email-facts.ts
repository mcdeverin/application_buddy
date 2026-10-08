import { classifyApplicationEmail } from './email-filter';
export function decodeEmailText(value: string) {
  const entities: Record<string,string> = {nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—'};
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(match,key:string)=>{
    if (key[0]==='#') { const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return code>=0 && code<=0x10ffff?String.fromCodePoint(code):match; }
    return entities[key.toLowerCase()]??match;
  }).replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\r/g,'');
}
export function messageContent(body: string) {
  return decodeEmailText(body).split(/\nOn [^\n]+wrote:|\nFrom:|unsubscribe|NOTICE:|Disclaimer|confidentiality notice/i)[0];
}
export function cleanRole(value: string) {
  return decodeEmailText(value).trim().replace(/^(?:your application (?:to|for) |thank you for applying for |the |our |an? |position of |the position of )+/i,'')
    .split(/\s+(?:role|position|opening|opportunity|job)\b|\s+(?:and (?:we|will|follow|are)|was submitted|is on the way|we will|we'll|but please|at our|at the company)\b/i)[0]
    .replace(/[,.;!]+$/,'').trim();
}
export function validRole(value: string) {
  const role=cleanRole(value);
  return role.length>=3 && role.length<=150 && !/^(?:the|a job|position|individual|unique skills|best possible|don['’]t|posting)\b/i.test(role)
    && !/\b(?:we|you|your|they|whom|will|happy|delighted|submitted|qualifications|discouraged)\b/i.test(role)
    && /\b(?:chief|manager|analyst|specialist|associate|assistant|director|coordinator|engineer|developer|designer|researcher|owner|support|lead|officer|operations|consultant|strategist|producer|editor|recruiter|administrator|scientist|buyer|planner|executive|intern|technician|accountant|representative|agent|supervisor|counsel|president)\b/i.test(role);
}
export function cleanCompany(value: string) {
  return decodeEmailText(value).trim().replace(/^\[|\]$/g,'').replace(/^(?:our pack at|the team at)\s+/i,'')
    .split(/\s+(?:for (?:the|a|an)|and |we |will |but |position |role |[-–|] )/i)[0].replace(/[.!]+$/,'').trim();
}
export function validCompany(value: string) {
  const company=cleanCompany(value);
  return company.length>=2 && company.length<=100 && !/^(?:the |our |us$|you|your |an? |position|senior associate$|dream team)/i.test(company)
    && !/\b(?:contributing|entertain|finishing|submitted|application|discouraged|will contact|qualifications|we are)\b/i.test(company)
    && !validRole(company);
}
export function extractEmailIdentity(subject: string, body: string, sender='') {
  const heading=decodeEmailText(subject).replace(/^(?:(?:re|fw|fwd):\s*)+/gi,'').trim();
  const content=messageContent(body), text=`${heading}\n${content}`;
  const companyCandidates=[
    text.match(/(?:application (?:to|at)|applying to|interest in joining)\s+([^\n.!]{2,120})/i)?.[1],
    text.match(/(?:role|position|opening)\s+(?:open\s+)?(?:with|at)\s+([^\n.!]{2,100})/i)?.[1],
    heading.match(/\bat\s+([^\n.!]{2,100})$/i)?.[1],
  ];
  const roleCandidates=[
    text.match(/(?:position of|role of|position:)\s*([^\n.!]{3,180})/i)?.[1],
    text.match(/(?:for (?:the|our)|for an?|application for(?: the)?)\s+([^\n.!]{3,180}?)(?:\s+(?:role|position|opening|job)\b|[\n.!]|$)/i)?.[1],
    heading.match(/^(.+?)\s+at\s+.+$/i)?.[1],
    heading.match(/^[^:]{2,80}:\s*(.+)$/)?.[1],
    heading.match(/(?:application|applying|interest)[^\n]{0,50}?\s[-–|]\s(.+)$/i)?.[1],
  ];
  const splitHeading=heading.match(/^([^:]{2,80}):\s*(.+)$/);
  if(splitHeading && validRole(splitHeading[2])) companyCandidates.push(splitHeading[1]);
  // Corporate mail is useful evidence; generic ATS domains never imply an employer.
  const domain=sender.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
  const known:Record<string,string>={'aexp.com':'American Express','americanexpress.com':'American Express','petsmart.com':'PetSmart','netflix.com':'Netflix','google.com':'Google','lyrahealth.com':'Lyra Health','rippling.com':'Rippling','huckleberry-labs.com':'Huckleberry Labs','bestegg.com':'Best Egg','nielseniq.com':'NielsenIQ'};
  if(domain && known[domain]) companyCandidates.push(known[domain]);
  const display=sender.match(/^\s*([^<]+)\s*</)?.[1]?.trim().replace(/\s+(?:hiring team|talent acquisition|recruiting|recruitment|careers|human resources|team|jobs|notifications).*$/i,'');
  // Sender names are only employer evidence when also named in the actual message.
  if(display && domain && domain.replace(/^(?:mail|jobs|careers)\./,'').split('.')[0].replace(/[^a-z0-9]/g,'')===display.toLowerCase().replace(/[^a-z0-9]/g,'') && content.toLowerCase().includes(display.toLowerCase())) companyCandidates.push(display);
  const role=roleCandidates.filter((v):v is string=>!!v).map(cleanRole).find(validRole)??'';
  const company=companyCandidates.filter((v):v is string=>!!v).map(cleanCompany).find(validCompany)??'';
  return {company,role};
}
export function emailStage(subject: string, body: string, sender: string): string|null {
  const content=messageContent(body), text=`${decodeEmailText(subject)}\n${content}`;
  const evidence=classifyApplicationEmail(decodeEmailText(subject),content,sender);
  if(!evidence) return null;
  if(evidence.kind==='confirmation') return 'Applied';
  if(evidence.kind==='offer') return 'Offer';
  if(/not (?:be )?(?:moving|proceeding) (?:forward|ahead)|(?:selected|chosen|pursuing|proceeding with|moving forward with) (?:other|another) candidates?|not (?:been )?selected|regret to inform|decided (?:not to|to (?:pursue|move forward with) other)|unfortunately[\s\S]{0,150}(?:application|role|position|move forward)/i.test(text)) return 'Rejected';
  if(evidence.kind==='interview' && /final (?:round|interview)/i.test(text)) return 'Final';
  if(evidence.kind==='interview' && /(?:schedule|confirm|invite|availability|interviewing|next (?:stage|round)|interview details)/i.test(text)) return 'Interview';
  if(/your application[\s\S]{0,30}(?:under review|being reviewed)/i.test(text)) return 'Screening';
  return null;
}
