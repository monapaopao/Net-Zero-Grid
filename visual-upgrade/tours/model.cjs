'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let source=fs.readFileSync(path.join(__dirname,'../../NetZero-GridToChip-v20-VisitorPresentation/src/reception-model.js'),'utf8');
source=source.replace("!cue.text.endsWith('。')","(cue.text&&!/[。！？]$/.test(cue.text))");
source=require('./refinement-build.cjs')('reception-model.js',source);
const box={module:{exports:{}},exports:{}};vm.runInNewContext(source,box);module.exports=box.module.exports;
