'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
 try{
  const page=await browser.newPage();
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
  await page.goto(pathToFileURL(path.join(__dirname,'dist/多园区-v20-r187-WebGPU.html')).href);
  await page.waitForSelector('#webgpu-startup-error',{timeout:60000});
  const result=await page.evaluate(()=>({ready:NZ_GPU.ready,error:NZ_GPU.error,message:document.querySelector('#webgpu-startup-error').textContent,title:document.title}));
  assert(!result.ready&&result.error.includes('未启动 WebGL 回退展示'));assert(result.title.startsWith('[WebGPU 不可用]'));
  fs.writeFileSync(path.join(__dirname,'evidence/unavailable-check.json'),JSON.stringify(result,null,2)+'\n');
  console.log('PASS unavailable WebGPU displays an explicit error and never starts a fallback presentation');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
