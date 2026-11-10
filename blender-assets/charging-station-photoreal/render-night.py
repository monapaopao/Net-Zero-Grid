"""Render the night preset without modifying the saved day source."""
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'charging-station-photoreal.blend'))
scene = bpy.context.scene
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .035
for obj in scene.objects:
    if obj.type == 'LIGHT':
        obj.data.energy = .04 if obj.data.type == 'SUN' else 0
for x in [-14, 0, 14]:
    for y in [-10, 10]:
        data = bpy.data.lights.new('Night canopy fixture', 'AREA')
        data.energy = 110
        data.shape = 'DISK'
        data.size = 2
        data.color = (.8, .88, 1)
        light = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(light)
        light.location = (x, y, 4.8)
for material in bpy.data.materials:
    if material.use_nodes and any(name in material.name for name in ['LED diffuser', 'Equipment display lettering']):
        surface = material.node_tree.nodes.get('Principled BSDF')
        if surface:
            surface.inputs['Emission Strength'].default_value = 2.5
scene.camera.location = (27, -16, 6.1)
scene.camera.rotation_euler = (Vector((0, -3, 2)) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera.data.lens = 38
scene.view_settings.exposure = 1.2
scene.render.filepath = str(OUT / 'renders/entrance-night.png')
bpy.ops.render.render(write_still=True)
