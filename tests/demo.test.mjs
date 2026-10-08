import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),output=mkdtempSync(join(tmpdir(),'application-buddy-demo-test-'));
try {
 execFileSync(process.execPath,[require.resolve('typescript/lib/tsc.js'),'src/lib/demo-session.ts','src/lib/demo-data.ts','--target','es2020','--module','commonjs','--outDir',output,'--skipLibCheck']);
 const session=require(join(output,'demo-session.js')),demo=require(join(output,'demo-data.js'));const code='test-demo-code-not-for-deployment',now=new Date('2026-10-08T22:00:00Z');
 assert.equal(session.validDemoCode(code,code),true);assert.equal(session.validDemoCode('wrong',code),false);assert.equal(session.validDemoCode('',undefined),false);assert.equal(session.validDemoCode('short','short'),false);
 const cookie=session.createDemoSession(code,now.getTime());assert.equal(session.validDemoSession(cookie,code,now.getTime()),true);assert.equal(session.validDemoSession(cookie,code,now.getTime()+session.demoSessionSeconds*1000),false);assert.equal(session.validDemoSession(cookie,'changed-secret-code',now.getTime()),false);assert.equal(session.validDemoSession(cookie+'modified',code,now.getTime()),false);assert.equal(session.validDemoSession('not.a.session',code),false);assert.equal(session.validDemoSession(undefined,code),false);
 const original=demo.createDemoData(now);assert.equal(original.applications.length,8);assert.equal(original.interviews.length,3);assert.equal(original.tasks.filter(t=>!t.completed).length,4);assert.ok(original.interviews.every(i=>new Date(i.at)>now));assert.ok(original.interviews.every(i=>![0,6].includes(new Date(i.at).getUTCDay())));
 const friday=demo.createDemoData(new Date('2026-10-09T22:00:00Z'));assert.equal(new Date(friday.interviews[0].at).getUTCDay(),1);
 const confirmed=demo.completeDemoTask(original,'confirm-northstar',now.toISOString(),'Custom sample reply');assert.equal(confirmed.interviews[0].confirmed,true);assert.equal(confirmed.tasks.find(t=>t.id==='confirm-northstar').completed,true);assert.ok(confirmed.applications[0].timeline.at(-1).detail.includes('Custom sample reply'));assert.equal(original.interviews[0].confirmed,false);assert.equal(demo.completeDemoTask(confirmed,'confirm-northstar'),confirmed);assert.equal(demo.completeDemoTask(original,'unknown'),original);
 const reply=demo.completeDemoTask(original,'reply-lumen');assert.equal(reply.tasks.find(t=>t.id==='reply-lumen').completed,true);assert.equal(reply.applications.find(a=>a.id==='lumen').stage,'Screening');
 const receipt=demo.simulateDemoEmail(original);assert.equal(receipt.applications.length,9);assert.equal(receipt.applications[0].stage,'Applied');assert.equal(original.applications.length,8);
 const invite=demo.simulateDemoEmail(receipt);assert.equal(invite.interviews.length,4);assert.equal(invite.applications.find(a=>a.id==='fable').stage,'Interview');assert.ok(invite.tasks.find(t=>t.id==='confirm-fable'));assert.equal(demo.simulateDemoEmail(invite),invite);
 assert.ok(original.emails.every(e=>e.from.includes('.example>')));assert.ok(invite.interviews.every(i=>new Date(i.at)>now));
 const evening=demo.createDemoData(new Date('2026-10-09T01:00:00Z'));assert.equal(evening.interviews[0].at.slice(0,10),'2026-10-09');
 console.log('34 demo checks passed (access code, session expiry, fictional data, dates, confirmations and simulated email updates)');
} finally {rmSync(output,{recursive:true,force:true});}
