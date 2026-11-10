"""Build and bake the complete second-pass station in a separate Blender file."""
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT))
from geometry import box, cylinder, mesh_object, text, tube
from materials import coated_material, image_node, linear_color, make_floor, material
from vehicles import SPECS, build_vehicle

bpy.ops.wm.open_mainfile(filepath=str(OUT / 'source/station-previous.blend'))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
layout = json.loads((OUT / 'source/layout.json').read_text(encoding='utf-8'))
details = bpy.data.collections.new('Architectural detail additions')
scene.collection.children.link(details)
details['station_mount'] = 'station'

# Replace ground finishes with one metre-scaled, authored material atlas.
for obj in list(scene.objects):
    remove = obj.name.startswith(('Site surrounding pavement', 'Central drive aisle', 'Raised parking slab',
                                  'Concrete expansion joint', 'Long bus bay', 'Connector grip', 'Stainless fastener'))
    remove |= obj.name.startswith('Bay ') and not obj.name.startswith(('Bay line', 'Bay stop line'))
    remove |= 'charging cable' in obj.name
    if remove:
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    if obj.name.startswith(('Lane arrow', 'Bay line', 'Bay stop line')):
        obj.location.z = .187
        obj.scale.z *= .04

floor_material = make_floor()
floor = box('Surface atlas · forecourt', (0, 0, .175), (40, 34.62, .02), floor_material, details)
bus_floor = box('Surface atlas · bus bay', (-12, -9, .1945), (11.8, 3.5, .016), floor_material, details)
white = coated_material('Ceramic white equipment coating', 'D4D4CE')
steel = coated_material('Graphite powder coated steel', '39454B', .18)
aluminium = material('Satin anodized aluminium', 'A5ADB2', .32, .82)
rubber = material('Weather sealed joints', '202326', .88)
glass = material('Smoked safety glazing', '233D47', .12, .08, .8)
concrete = material('Formed concrete curb', '95948C', .88)
led = material('Equipment display lettering', 'ADDBC9', .5)
led.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value = linear_color('ADDBC9')
led.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value = .35

replace = {
    'Warm white enclosure': white, 'Green grey powder coat': steel,
    '01 · Powder coated green-grey steel': steel, '02 · Anodized aluminium': aluminium,
    'Graphite polymer': rubber, 'Interface glass': glass, '03 · Concrete pedestal': concrete,
    'Interface markings': led, 'Precast apron': concrete
}
for obj in list(scene.objects):
    if obj.type not in {'MESH', 'FONT', 'CURVE'}:
        continue
    for slot in obj.material_slots:
        if slot.material and slot.material.name in replace:
            slot.material = replace[slot.material.name]
    if obj.type == 'MESH':
        for modifier in obj.modifiers:
            if modifier.type == 'BEVEL':
                modifier.segments = 3

# Add real panel seams, door hardware, base seals and labelled service fronts.
for obj in list(scene.objects):
    if ' · chassis' not in obj.name:
        continue
    x, y, _ = obj.location
    sign = -1 if obj.name.startswith('N') else 1
    front = y + sign * .31
    box('Dispenser door perimeter gasket', (x, y + sign * .267, 1.26), (.545, .012, 1.90), rubber, details, .016)
    box('Dispenser service door', (x, y + sign * .28, 1.26), (.51, .015, 1.86), white, details, .014)
    box('Display hood', (x, y + sign * .30, 2.07), (.45, .12, .025), steel, details, .009)
    box('Emergency stop surround', (x + .17, front, 1.48), (.075, .018, .075), rubber, details, .012)
    button = cylinder('Emergency stop', (x + .17, front + sign * .02, 1.48), .026, .024,
                      material('Emergency red', '9E2524', .45), details, (0, sign, 0), 16)
    for dx in [-.22, .22]:
        for z in [.43, 2.02]:
            cylinder('Recessed service screw', (x + dx, y + sign * .294, z), .008, .006, aluminium, details, (0, sign, 0), 12)
    text('Dispenser service caption', 'DC  /  READY', (x, y + sign * .305, 1.67), .039, led, details,
         (math.pi / 2, 0, 0 if sign < 0 else math.pi))

for obj in list(scene.objects):
    if ' · front' in obj.name or ' · display' in obj.name:
        # Keep the existing identity screen in front of the new service skin.
        if ' · display' in obj.name:
            obj.location.y += (-.018 if obj.name.startswith('N') else .018)
    if obj.type == 'FONT' and obj.name[:1] in ['N', 'S'] and len(obj.name.split('.')[0]) == 3:
        obj.location.y += (-.018 if obj.name.startswith('N') else .018)

# Independent lightmap UV channel uses the same site-space atlas for both floor pieces.
bpy.context.view_layer.update()
for obj in [floor, bus_floor]:
    for name in ['UVMap', 'LightmapUV']:
        layer = obj.data.uv_layers.new(name=name)
        for polygon in obj.data.polygons:
            for index in polygon.loop_indices:
                point = obj.matrix_world @ obj.data.vertices[obj.data.loops[index].vertex_index].co
                layer.data[index].uv = ((point.x + 20) / 40, (point.y + 17.31) / 34.62) if polygon.normal.z > .5 else (0, 0)
    obj.data.uv_layers.active_index = 0

# Procedural foliage replaces the coarse crowns only in the immediate station setting.
landscape = bpy.data.collections.new('Near-station planting')
scene.collection.children.link(landscape)
landscape['station_mount'] = 'landscape'
bark = material('Tree bark', '4D4030', .95)
leaves = [material('Leaf tone ' + str(i), color, .82) for i, color in enumerate(['425E35', '5A713F', '6D7F47', '354E32'])]
random = np.random.default_rng(41)
for tree_index, (x, y) in enumerate([(17, -8), (17, -19), (17, -31), (-23, -26)]):
    cylinder('Tree trunk', (x, y, 1.65), .10, 3.3, bark, landscape, segments=12)
    for branch in range(7):
        angle = branch * math.tau / 7 + tree_index
        end = Vector((x + math.cos(angle) * 1.0, y + math.sin(angle) * 1.0, 3.2 + (branch % 3) * .30))
        tube('Tree branch', [(x, y, 2.0), (x + math.cos(angle) * .45, y + math.sin(angle) * .45, 2.9), end], .035, bark, landscape)
    vertices, faces, indices = [], [], []
    for index in range(1100):
        azimuth = random.uniform(0, math.tau)
        z = random.uniform(-1, 1)
        radius = random.random() ** (1 / 3)
        radial = math.sqrt(1 - z * z)
        center = Vector((x + math.cos(azimuth) * radial * radius * 1.65,
                         y + math.sin(azimuth) * radial * radius * 1.65, 3.7 + z * radius * 1.35))
        a = Vector((math.cos(azimuth), math.sin(azimuth), random.uniform(-.7, .7))).normalized() * random.uniform(.08, .14)
        b = Vector((-math.sin(azimuth), math.cos(azimuth), .3)).normalized() * .04
        start = len(vertices)
        vertices.extend([center - a, center + b, center + a, center - b])
        faces.append((start, start + 1, start + 2, start + 3))
        indices.append(index % len(leaves))
    crown = mesh_object('Individual leaf crown', vertices, faces, leaves[0], landscape)
    for leaf in leaves[1:]:
        crown.data.materials.append(leaf)
    for polygon, index in zip(crown.data.polygons, indices):
        polygon.material_index = index
        polygon.use_smooth = True

# An unclipped, licensed outdoor environment supplies physically varied reflections.
world = bpy.data.worlds.new('Outdoor HDR environment')
world.use_nodes = True
scene.world = world
environment = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
environment.image = bpy.data.images.load(str(OUT / 'textures/daylight.hdr'))
environment.image.pack()
world.node_tree.links.new(environment.outputs['Color'], world.node_tree.nodes.get('Background').inputs['Color'])
world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 1.0
for obj in list(scene.objects):
    if obj.type == 'LIGHT':
        bpy.data.objects.remove(obj, do_unlink=True)
sun_data = bpy.data.lights.new('Calibrated directional sunlight', 'SUN')
sun_data.energy = 3.0
sun_data.angle = math.radians(1.5)
sun = bpy.data.objects.new('Calibrated directional sunlight', sun_data)
scene.collection.objects.link(sun)
hdr = environment.image
pixels = np.empty(hdr.size[0] * hdr.size[1] * 4, np.float32)
hdr.pixels.foreach_get(pixels)
luminance = pixels.reshape(hdr.size[1], hdr.size[0], 4)[:, :, :3].mean(axis=2)
row, column = np.unravel_index(luminance.argmax(), luminance.shape)
longitude = ((column + .5) / hdr.size[0] - .5) * math.tau
latitude = ((row + .5) / hdr.size[1] - .5) * math.pi
sun_direction = Vector((math.cos(latitude) * math.cos(longitude), math.cos(latitude) * math.sin(longitude), math.sin(latitude))).normalized()
sun.rotation_euler = (-sun_direction).to_track_quat('-Z', 'Y').to_euler()

scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
device = 'CPU'
try:
    preferences = bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type = 'OPTIX'
    preferences.get_devices()
    for candidate in preferences.devices:
        candidate.use = candidate.type == 'OPTIX'
    if any(candidate.type == 'OPTIX' for candidate in preferences.devices):
        scene.cycles.device = 'GPU'
        device = 'OPTIX'
except Exception:
    pass

bake_metadata = {}


def bake_floor(name, bake_type):
    image = bpy.data.images.new(name, width=1024, height=1024, alpha=False, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    target = floor_material.node_tree.nodes.new('ShaderNodeTexImage')
    target.image = image
    floor_material.node_tree.nodes.active = target
    for obj in scene.objects:
        obj.select_set(False)
    floor.select_set(True)
    bpy.context.view_layer.objects.active = floor
    scene.render.bake.margin = 8
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    bpy.ops.object.bake(type=bake_type)
    pixels = np.empty(1024 * 1024 * 4, np.float32)
    image.pixels.foreach_get(pixels)
    values = pixels.reshape(1024, 1024, 4)
    for axis in [0, 1]:
        values = (np.roll(values, 2, axis) + 4 * np.roll(values, 1, axis) + 6 * values +
                  4 * np.roll(values, -1, axis) + np.roll(values, -2, axis)) / 16
    scale = max(float(np.percentile(values[:, :, :3], 99.9)), .02) if bake_type == 'DIFFUSE' else 1
    values[:, :, :3] = np.round(np.clip(values[:, :, :3] / scale, 0, 1) * 255) / 255
    values[:, :, 3] = 1
    image.pixels.foreach_set(values.ravel())
    bake_metadata[name] = {'radianceScale': scale, 'resolution': 1024, 'filter': 'separable 5-tap'}
    image.filepath_raw = str(OUT / 'textures' / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image

print('Baking daylight indirect illumination', flush=True)
bus_floor.hide_render = True
indirect = bake_floor('daylight_indirect', 'DIFFUSE')
print('Baking static contact occlusion', flush=True)
occlusion = bake_floor('static_occlusion', 'AO')
bus_floor.hide_render = False

# Freeze prototype meshes once, then share them across the source scene and GLB instances.
prototypes = {}
for kind in SPECS:
    collection = build_vehicle(kind, scene)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in list(collection.objects):
        if obj.get('export_skip'):
            continue
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated)
        replacement = bpy.data.objects.new(obj.name + ' evaluated', mesh)
        collection.objects.link(replacement)
        replacement.matrix_world = obj.matrix_world.copy()
        bpy.data.objects.remove(obj, do_unlink=True)
    for obj in list(collection.objects):
        if obj.get('export_skip'):
            bpy.data.objects.remove(obj, do_unlink=True)
    prototypes[kind] = collection

render_fleet = bpy.data.collections.new('Render-only located vehicles')
scene.collection.children.link(render_fleet)
render_fleet['export_skip'] = True
palette = ['F0F0EB', 'ADB4BA', '343D46', '325465', '516353']
for index, vehicle in enumerate(layout['fleet']['vehicles']):
    if vehicle['kind'] not in prototypes or vehicle['zone'] not in {'charging', 'parking'}:
        continue
    x, z, y = vehicle['p']
    transform = Matrix.Translation((x - 64, -(y - 98), z)) @ Matrix.Rotation(vehicle['heading'], 4, 'Z')
    for obj in prototypes[vehicle['kind']].objects:
        copy = bpy.data.objects.new(vehicle['id'] + ' ' + obj.name, obj.data)
        render_fleet.objects.link(copy)
        copy.matrix_world = transform @ obj.matrix_world
        for slot in copy.material_slots:
            if slot.material and slot.material.name.startswith('Vehicle paint'):
                paint = slot.material.copy()
                slot.link = 'OBJECT'
                paint.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = linear_color(palette[index % len(palette)])
                slot.material = paint
for index, collection in enumerate(prototypes.values()):
    offset = Vector((300 + 20 * index, 0, 0))
    collection['prototype_offset'] = list(offset)
    for obj in collection.objects:
        obj.location += offset

for route in layout['fleet']['routes']:
    tube('Render-only connected lead', [(p[0] - 64, -(p[2] - 98), p[1]) for p in route['points']], .032, rubber, render_fleet)

surrounding = material('Surrounding road asphalt', '505250', .93)
ground = box('Render-only surrounding ground', (0, 0, -.16), (2000, 2000, .2), surrounding, render_fleet)
scene.camera.data.clip_end = 2500
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = .60
scene.render.resolution_x = 1440
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'

shots = {
    'station': {'pos': [110, 28, 145], 'tgt': [55, 2, 99]},
    'entrance': {'pos': [91, 6.1, 114], 'tgt': [64, 2, 101]},
    'terminal': {'pos': [69, 3.5, 94], 'tgt': [65.5, 1.2, 84.7]}
}
for name, shot in shots.items():
    cam = scene.camera
    cam.location = (shot['pos'][0] - 64, -(shot['pos'][2] - 98), shot['pos'][1])
    target = Vector((shot['tgt'][0] - 64, -(shot['tgt'][2] - 98), shot['tgt'][1]))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 38
    scene.render.filepath = str(OUT / 'renders' / (name + '-day.png'))
    bpy.ops.render.render(write_still=True)

bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'charging-station-photoreal.blend'))
report = {'device': device, 'objects': len(scene.objects), 'vehiclePrototypes': list(prototypes),
          'shots': shots, 'sunDirectionBlender': list(sun_direction), 'baked': bake_metadata}
(OUT / 'build-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
