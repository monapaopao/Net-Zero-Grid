'use strict';
const fs = require('node:fs');
const path = require('node:path');

module.exports = function pack() {
  const assets = path.resolve(__dirname, '..');
  const encode = name => fs.readFileSync(path.join(assets, 'textures', name)).toString('base64');
  const report = JSON.parse(fs.readFileSync(path.join(assets, 'build-report.json'), 'utf8'));
  const payload = { hdr: encode('daylight.hdr'), indirect: encode('daylight_indirect.png'),
    ao: encode('static_occlusion.png'), sun: report.sunDirectionBlender,
    irradianceScale: report.baked.daylight_indirect.radianceScale };
  return ['window.NZ_PHOTO_PACK = ' + JSON.stringify(payload) + ';',
    fs.readFileSync(path.join(__dirname, 'performance.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'photo-assets.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'photo-render.js'), 'utf8')];
};
