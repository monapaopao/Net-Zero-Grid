'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tools = path.join(root, 'tmp/three-r187-tools');
const revision = Number(process.argv[2] || 187);
if (![157, 167, 177, 187].includes(revision)) throw new Error('Expected r157, r167, r177 or r187.');
const pkg = path.resolve(process.argv[3] || path.join(tools, 'r' + revision, 'package'));
const esbuild = process.env.ESBUILD || path.join(tools, 'esbuild/package/esbuild.exe');
const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
if (manifest.name !== 'three' || manifest.version !== '0.' + revision + '.0') throw new Error('Three.js package version mismatch.');
const temp = path.join(tools, 'bundle-r' + revision);
fs.mkdirSync(temp, { recursive: true });
const source = path.join(temp, 'entry.mjs');
const modulePath = path.join(pkg, 'build/three.module.js');
fs.writeFileSync(source, [
  'import * as three from ' + JSON.stringify(modulePath.replace(/\\/g, '/')) + ';',
  'import { OrbitControls } from ' + JSON.stringify(path.join(pkg, 'examples/jsm/controls/OrbitControls.js').replace(/\\/g, '/')) + ';',
  'globalThis.THREE = { ...three, OrbitControls };'
].join('\n'));
const output = revision === 187 ? path.join(__dirname, 'vendor') : temp;
fs.mkdirSync(output, { recursive: true });
const bundle = path.join(output, 'three-r' + revision + '.js');
const result = spawnSync(esbuild, [source, '--bundle', '--format=iife', '--minify', '--legal-comments=inline',
  '--alias:three=' + modulePath, '--outfile=' + bundle], { stdio: 'inherit', windowsHide: true });
if (result.status !== 0) throw result.error || new Error('esbuild failed');
if (revision === 187) fs.copyFileSync(path.join(pkg, 'LICENSE'), path.join(output, 'THREE-LICENSE.txt'));
