/* Analytic plan checks for the native meshes. This is not the Anatomy SVG audit. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const root=path.join(__dirname,'..'),file=path.join(root,'src/wind-anatomy.js'),source=fs.readFileSync(file,'utf8'),context={window:{}};
vm.createContext(context);vm.runInContext(source,context);const a=context.window.NZ_WIND_ANATOMY,report=a.validate();
for(const [name,ok]of Object.entries(report.checks)){assert(ok,name);console.log('PASS '+name);}
assert(Number.isFinite(report.minimumClearance)&&report.minimumClearance>0,'Finite positive cable clearance');
report.sourceSHA256=crypto.createHash('sha256').update(source).digest('hex');report.generatedAt=new Date().toISOString();
fs.writeFileSync(path.join(root,'evidence/v17-wind-anatomy-geometry.json'),JSON.stringify(report,null,2));console.log('Native parts:',report.partCount,'Checks:',Object.keys(report.checks).length);
