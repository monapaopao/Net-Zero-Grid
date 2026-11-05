'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),model=require('../src/sst-simulation.js'),R=require('../src/visitor-results.js');
const comparison=model.compare(),before=JSON.stringify(comparison),summary=R.sst(comparison),checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
check('threeSeparateResultsWithExplicitScope',()=>{assert.equal(summary.cards.length,3);assert.ok(summary.scope.includes('两小时代表支路'));assert.ok(summary.scope.includes('不外推全园区'));});
check('equipmentAndControlRemainDistinct',()=>{assert.ok(summary.cards[0].title.includes('A → B'));assert.ok(summary.cards[1].title.includes('B → C'));assert.ok(summary.cards[0].detail.includes('不是全园区节能率'));assert.ok(summary.cards[0].value.includes('0.320'));assert.ok(summary.cards[1].value.includes('2.8'));});
check('inventoryCurtailmentAndServiceAreNotHidden',()=>{const text=summary.cards[2].detail;assert.ok(text.includes('弃电增加'));assert.ok(text.includes('IT交付'));assert.ok(text.includes('充电交付'));assert.ok(text.includes('截止未交付'));assert.ok(text.includes('不能当作节能'));});
check('adverseResultsAreReportedAsIncrease',()=>{const worse=JSON.parse(before);worse.variants.sst.summary.conversionLossMWh=1;worse.variants.coordinated.summary.maxGridImportMW=9;const s=R.sst(worse);assert.ok(s.cards[0].detail.includes('增加'));assert.ok(s.cards[1].detail.includes('增加'));});
check('summaryDoesNotMutateModel',()=>assert.equal(JSON.stringify(comparison),before));
check('sstAndTokenSyntax',()=>{for(const file of ['sst-visit.js','visitor-results.js','token-meter.js'])new vm.Script(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{filename:file});});
fs.writeFileSync(path.join(__dirname,'../evidence/v20-visitor-results.json'),JSON.stringify({checks,summary},null,2));
