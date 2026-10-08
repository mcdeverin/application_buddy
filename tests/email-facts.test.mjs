import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), output=mkdtempSync(join(tmpdir(),'email-facts-test-'));
try {
 execFileSync(process.execPath,[require.resolve('typescript/lib/tsc.js'),'src/lib/email-facts.ts','--target','es2020','--module','commonjs','--outDir',output,'--skipLibCheck']);
 const {cleanRole,validRole,validCompany,extractEmailIdentity,emailStage,decodeEmailText}=require(join(output,'email-facts.js'));
 const titles=[['Implementation Specialist, IT and will review it promptly','Implementation Specialist, IT'],['Strategy & Operations Associate job was submitted successfully','Strategy & Operations Associate'],['Business Operations, and we are delighted that you would consider joining our team','Business Operations'],['Product Owner- Research Administration (SaaS) job was submitted successfully','Product Owner- Research Administration (SaaS)'],['Training Operations Associate II and follow up if your qualifications match our needs for the opportunity','Training Operations Associate II'],['Assistant Merchandise Planner, and are delighted that you would consider joining our team','Assistant Merchandise Planner'],['Senior Product Analyst opportunity','Senior Product Analyst']];
 for(const [raw,expected]of titles)assert.equal(cleanRole(raw),expected);
 for(const bad of ['position we will contact you soon','a job','unique skills deemed necessary for each','best possible interview experience','individual or entity to whom they are addressed','posting, but please don’t be discouraged','the',"Don't see a"])assert.equal(validRole(bad),false,bad);
 for(const bad of ['the Dream Team and contributing to our mission to entertain the world','Senior Associate','Manager-Digital Product Operations','the Sr'])assert.equal(validCompany(bad),false,bad);
 assert.equal(validCompany('our pack at PetSmart and finishing your application'),true);
 let d=extractEmailIdentity('Your application to Associate Client Manager at NielsenIQ','Thank you for applying for our&nbsp;Associate Client Manager&nbsp;role and we&#39;re happy that you want to join the team.','jobs@nielseniq.com');assert.equal(d.company,'NielsenIQ');assert.equal(d.role,'Associate Client Manager');
 d=extractEmailIdentity('Rolling Stone: Account Manager','Thank you for your application.');assert.equal(d.company,'Rolling Stone');assert.equal(d.role,'Account Manager');
 d=extractEmailIdentity('Your application to Manager-Digital Product Operations','We received your application for the position of Manager-Digital Product Operations - 26009175.','jobs@aexp.com');assert.equal(d.company,'American Express');assert.equal(d.role,'Manager-Digital Product Operations - 26009175');
 assert.equal(emailStage('Application received','Thank you for your application for the Pricing Analyst role. If selected for an interview we will contact you to arrange an interview.','jobs@company.com'),'Applied');
 assert.equal(emailStage('Next Steps with Sound Ventures','Thank you for your application for the Chief of Staff role. Please schedule your interview within the next 7 days.','jobs@ashbyhq.com'),'Interview');
 assert.equal(decodeEmailText('​NielsenIQ​ &amp; we&#39;re&nbsp;happy'),'NielsenIQ & we\'re happy');
 assert.equal(extractEmailIdentity('Interview request','Please schedule an interview for the Product Manager role. Regards, Christina Newman.','Christina Newman <christina@recruiting-agency.com>').company,'');
 assert.equal(emailStage('Your application to Best Egg','We have selected another candidate for the Product Operations Manager role.','hr@bestegg.com'),'Rejected');
 assert.equal(validRole('Chief of Staff'),true);
 console.log('29 identity and boilerplate regression cases passed');
} finally {rmSync(output,{recursive:true,force:true});}
