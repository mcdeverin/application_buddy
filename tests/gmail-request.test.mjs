import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), output=mkdtempSync(join(tmpdir(),'gmail-request-test-'));
try {
 execFileSync(process.execPath,[require.resolve('typescript/lib/tsc.js'),'src/lib/gmail-request.ts','--target','es2020','--module','commonjs','--outDir',output,'--skipLibCheck']);
 const {GmailError,readGmail,readGmailPage,readOptionalGmail,readWithRefresh}=require(join(output,'gmail-request.js'));
 const response=(status,reason='',headers={})=>new Response(JSON.stringify(status===200?{messages:[{id:'one'}]}:{error:{errors:[{reason}],message:'PRIVATE EMAIL OR TOKEN'}}),{status,headers});
 let n=0, delays=[];
 const result=await readGmail('messages?q=application','private-token',async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer private-token');assert.equal(options.cache,'no-store');return response(200);});assert.equal(result.messages.length,1);
 let reset=0;const params=new URLSearchParams({q:'after:123 interview',pageToken:'expired'});
 await readGmailPage(params,async path=>{n++;if(n===1)throw new GmailError(400,'invalidArgument','list emails');assert.equal(new URLSearchParams(path.split('?')[1]).get('q'),'after:123 interview');assert.ok(!path.includes('pageToken'));return {messages:[]};},async()=>{reset++;});assert.equal(n,2);assert.equal(reset,1);
 await assert.rejects(readGmailPage(new URLSearchParams({q:'bad'}),async()=>{throw new GmailError(400,'badRequest','list emails');},async()=>{throw Error('should not reset');}),/HTTP 400/);
 n=0;reset=0;await readWithRefresh(async()=>{if(++n===1)throw new GmailError(401,'authError','read an email');return {ok:true};},async()=>{reset++;});assert.equal(n,2);assert.equal(reset,1);
 n=0;await assert.rejects(readWithRefresh(async()=>{n++;throw new GmailError(401,'authError','read an email');},async()=>{}),/Reconnect/);assert.equal(n,2);
 n=0;await assert.rejects(readGmail('messages?q=test','token',async()=>{n++;return response(403,'insufficientPermissions');},async()=>{}),/HTTP 403: insufficientPermissions/);assert.equal(n,1);
 n=0;delays=[];await readGmail('messages?q=test','token',async()=>++n<3?response(403,'userRateLimitExceeded'):response(200),async ms=>{delays.push(ms);});assert.deepEqual(delays,[1000,2000]);assert.equal(n,3);
 n=0;delays=[];await readGmail('messages?q=test','token',async()=>++n===1?response(429,'rateLimitExceeded',{'retry-after':'2'}):response(200),async ms=>{delays.push(ms);});assert.deepEqual(delays,[2000]);
 n=0;await assert.rejects(readGmail('messages/one','token',async()=>{n++;return response(503,'backendError');},async()=>{}),/read an email.*HTTP 503/);assert.equal(n,3);
 assert.equal(await readOptionalGmail(async()=>{throw new GmailError(404,'notFound','read an email');}),null);
 await assert.rejects(readOptionalGmail(async()=>{throw new GmailError(403,'forbidden','read an email');}),/HTTP 403/);
 n=0;await assert.rejects(readGmail('threads/one','token',async()=>{n++;throw Error('sensitive network details');},async()=>{}),error=>!error.message.includes('sensitive')&&/connection timed out/.test(error.message));assert.equal(n,3);
 await assert.rejects(readGmail('messages?q=test','token',async()=>response(400,'secret-account-data'),async()=>{}),error=>!error.message.includes('secret-account-data')&&!error.message.includes('PRIVATE'));
 n=0;await assert.rejects(readGmailPage(new URLSearchParams({pageToken:'expired'}),async()=>{n++;throw new GmailError(400,'invalidArgument','list emails');},async()=>{throw Error('save failed');}),/save failed/);assert.equal(n,1);
 console.log('14 Gmail recovery checks passed (cursor, refresh, backoff, missing messages and error privacy)');
} finally {rmSync(output,{recursive:true,force:true});}
