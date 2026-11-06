"""Reopen the delivery and verify packed textures and render artifacts."""
import bpy, json
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'charging-station-realistic.blend'))
images=[]
for im in bpy.data.images:
    if im.source not in {'FILE','GENERATED'}: continue
    assert im.packed_file, 'Unpacked texture: '+im.name
    assert min(im.size)>0, 'Empty texture: '+im.name
    images.append({'name':im.name,'size':list(im.size),'packed':bool(im.packed_file)})
for name in ['01-station-daylight.png','02-charger-detail.png']:
    assert (OUT/'renders'/name).stat().st_size>10000
assert bpy.context.scene.camera
assert len(images)>=4
(OUT/'validation.json').write_text(json.dumps({'passed':True,'images':images,'camera':bpy.context.scene.camera.name,'engine':bpy.context.scene.render.engine},indent=2),encoding='utf-8')
print('PASS: packed Blender assets and two renders')
