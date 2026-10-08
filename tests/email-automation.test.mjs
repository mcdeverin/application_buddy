import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), output=mkdtempSync(join(tmpdir(),'application-buddy-test-'));
try {
 execFileSync(process.execPath,[require.resolve('typescript/lib/tsc.js'),'src/lib/email-automation.ts','--target','es2020','--module','commonjs','--outDir',output,'--skipLibCheck']);
 const {emailDecision:f}=require(join(output,'email-automation.js'));
 const apps=[{id:'one',company:'Best Egg',role:'Associate Product Operations Manager'}];
 const email=(subject,excerpt,sender='hr@company.com')=>({subject,excerpt,sender,reason:'',suggested_status:'Applied',suggested_company:'',suggested_role:''});
 let d=f(email('Thank you for your application to Huckleberry Labs','Thank you for applying to Huckleberry Labs for the Creative Operations Manager (Remote, Contract) role.'),[]);assert.equal(d.company,'Huckleberry Labs');assert.equal(d.role,'Creative Operations Manager (Remote, Contract)');assert.equal(d.status,'Applied');assert.equal(d.canApply,true);
 d=f(email('Schedule Availability Request','Move you to the next stage in interviewing for the Associate Product Operations Manager role open with Best Egg. Please provide some days and times.','hr@bestegg.com'),apps);assert.equal(d.target.id,'one');assert.equal(d.task,'Send interview availability');assert.equal(d.status,'Interview');
 d=f(email('Schedule Availability Request','Move you to the next stage in interviewing for the Associate Product Operations Manager role open with Best Egg. Please provide some days and times.','hr@bestegg.com'),[]);assert.equal(d.company,'Best Egg');assert.equal(d.canApply,true);
 d=f(email('Re: Interview','Thanks for meeting with us for the role at Best Egg.','hr@bestegg.com'),apps,['one']);assert.equal(d.status,null);assert.equal(d.target.id,'one');
 d=f({...email('Re: Hello','Thank you, sounds good.'),reason:'Verified application thread: An interview request.'},apps,['one']);assert.equal(d.canApply,true);assert.equal(d.status,null);
 d=f(email('Your application to Best Egg','Your application is under review for the Associate Product Operations Manager role.'),[...apps,{id:'two',company:'Best Egg',role:apps[0].role}]);assert.equal(d.canApply,false);
 d=f(email('Your application to Best Egg','Thank you for applying for the Product Operations Manager role.'),apps);assert.equal(d.canApply,false);
 assert.equal(f(email('Last Looks job listings','Send your resume. Interviews next week.','list@lastlooks.com'),apps),null);
 d=f(email('American Express Video Interview','We are pleased to confirm your interview for the Portfolio Analyst position at American Express.'),[]);assert.equal(d.canApply,true);assert.equal(d.company,'American Express');assert.equal(d.status,'Interview');
 console.log('9 automatic matching and stage checks passed');
} finally {rmSync(output,{recursive:true,force:true});}
