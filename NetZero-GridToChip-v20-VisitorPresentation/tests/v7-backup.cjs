'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'../../NetZero-GridToChip-v7-TerrainRenewables'),manifest=path.join(__dirname,'v7-backup-manifest.json');
function scan(dir,result={}){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file,result);else result[path.relative(root,file).replace(/\\/g,'/')]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}return result;}
const current=scan(root);
if(process.argv.includes('--capture')){if(fs.existsSync(manifest))throw Error('Backup manifest already exists');fs.writeFileSync(manifest,JSON.stringify(current,null,2));console.log('Captured v7: '+Object.keys(current).length+' files');}
else{const previous=JSON.parse(fs.readFileSync(manifest,'utf8')),keys=new Set([...Object.keys(previous),...Object.keys(current)]),changes=[...keys].filter(k=>previous[k]!==current[k]);fs.writeFileSync(path.join(__dirname,'v7-backup-verification.json'),JSON.stringify({files:Object.keys(previous).length,changes,passed:changes.length===0},null,2));console.log('v7 backup: '+keys.size+' files, '+changes.length+' changes');if(changes.length)process.exitCode=1;}
