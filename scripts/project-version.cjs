'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
function version(){const meta=read('project-version.json');assert(/^\d+\.\d+\.\d+$/.test(meta.version));assert.equal(meta.version,read('package.json').version,'Project and package versions differ');return meta;}
function patch(page){
 const meta=version();
 page=page.replace(/<title>([^<]*)<\/title>/,(_,title)=>'<title>'+title.replace('· v20','· v'+meta.version)+'</title>');
 page=page.replace('</head>','<script>window.NZ_PROJECT_VERSION=Object.freeze('+JSON.stringify(meta)+');</script>\n</head>');
 const anchor='exportedAtSimTime: S.simTime,';
 assert.equal(page.split(anchor).length,2);
 page=page.replace(anchor,'projectVersion: window.NZ_PROJECT_VERSION.version,\n      projectRelease: window.NZ_PROJECT_VERSION.name,\n      '+anchor);
 page=page.replace('window.NZ_GPU.ready = true;',`window.NZ_GPU.ready = true;
    const stamp=document.createElement('span');stamp.id='projectVersion';stamp.textContent='v'+NZ_PROJECT_VERSION.version;stamp.title=NZ_PROJECT_VERSION.name;stamp.style.cssText='font-size:11px;color:#526b70;margin-left:8px';document.querySelector('.brand-caption').append(stamp);`);
 return page;
}
function docs(){const m=version();fs.writeFileSync(path.join(root,'CURRENT-VERSION.md'),`# 当前项目版本\n\nv${m.version} · ${m.name}\n\n发布日期：${m.date}（Asia/Shanghai）\n\n项目版本：${m.version}；业务模型基线：${m.modelBaseline}；原生视觉基线：${m.visualBaseline}。\n\n园区引擎 Three.js r187；楼内独立应用 Three.js r180。引擎和模型版本不随项目发布号自动变更。\n`);
 const file=path.join(root,'index.html');let entry=fs.readFileSync(file,'utf8');entry=entry.replace(/<title>[^<]*<\/title>/,`<title>Net-Zero Grid v${m.version} · ${m.name}</title>`);fs.writeFileSync(file,entry);
}
function check(){const m=version(),html=fs.readFileSync(path.join(root,'visual-upgrade/webgpu/dist/多园区-v20-r187-WebGPU.html'),'utf8');assert(html.includes('· v'+m.version));assert(html.includes('"version":"'+m.version+'"'));assert(fs.readFileSync(path.join(root,'CURRENT-VERSION.md'),'utf8').includes('v'+m.version));assert(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('v'+m.version));console.log('PASS project version consistency: v'+m.version);}
module.exports={version,patch,docs,check};
if(require.main===module){
 const [action,next,name]=process.argv.slice(2);
 if(action==='set'){assert(/^\d+\.\d+\.\d+$/.test(next));const m=read('project-version.json'),pkg=read('package.json');m.version=pkg.version=next;if(name)m.name=name;fs.writeFileSync(path.join(root,'project-version.json'),JSON.stringify(m,null,2)+'\n');fs.writeFileSync(path.join(root,'package.json'),JSON.stringify(pkg,null,2)+'\n');docs();}
 else if(action==='check')check();else docs();
}
