"""Portable material batches plus shared vehicle prototypes for the browser."""
from collections import defaultdict
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
import sys

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT))
from geometry import box, cylinder
from vehicles import SPECS
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'charging-station-photoreal.blend'))
scene = bpy.context.scene
source = list(scene.objects)
converted = {}
def prepare_material(original):
    if original.name in converted:
        return converted[original.name]
    result = original.copy()
    result.name = 'Web ' + original.name
    tree = result.node_tree
    surface = tree.nodes.get('Principled BSDF')
    scale = None
    for socket in ['Base Color', 'Roughness']:
        if not surface.inputs[socket].is_linked:
            continue
        tex = surface.inputs[socket].links[0].from_node
        if tex.type != 'TEX_IMAGE':
            continue
        if tex.projection == 'BOX':
            scale = tex.inputs['Vector'].links[0].from_node.inputs[3].default_value
            tree.links.remove(tex.inputs['Vector'].links[0])
            tex.projection = 'FLAT'
        if socket == 'Roughness':
            channels = tree.nodes.new('ShaderNodeSeparateColor')
            tree.links.new(tex.outputs['Color'], channels.inputs[0])
            tree.links.new(channels.outputs['Green'], surface.inputs['Roughness'])
    if 'coating' in original.name:
        scale = 3
    converted[original.name] = result, scale
    return result, scale


def projected_uv(point, normal, scale):
    axis = max(range(3), key=lambda index: abs(normal[index]))
    u, v = ((1, 2), (2, 0), (0, 1))[axis]
    return (point[u] * scale * (-1 if normal[axis] < 0 else 1), point[v] * scale)


for obj in source:
    if obj.type == 'MESH' and any('PV modules' in collection.name for collection in obj.users_collection):
        obj.modifiers.clear()
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
batches = defaultdict(lambda: {'vertices': [], 'faces': [], 'uv': [], 'normals': []})
triangles = 0
for obj in source:
    if obj.type not in {'MESH', 'CURVE', 'FONT'} or any(c.get('export_skip') for c in obj.users_collection):
        continue
    mount = next((c['station_mount'] for c in obj.users_collection if 'station_mount' in c), 'station')
    offset = next((Vector(c['prototype_offset']) for c in obj.users_collection if 'prototype_offset' in c), Vector())
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    world = evaluated.matrix_world
    normals_matrix = world.to_3x3().inverted_safe().transposed()
    positions = [world @ vertex.co - offset for vertex in mesh.vertices]
    source_uv = mesh.uv_layers.active
    for polygon in mesh.polygons:
        if not mesh.materials or not mesh.materials[polygon.material_index]:
            continue
        mat, scale = prepare_material(mesh.materials[polygon.material_index])
        batch = batches[mount, mat.name]
        start = len(batch['vertices'])
        batch['vertices'].extend(positions[index] for index in polygon.vertices)
        batch['faces'].append(tuple(range(start, len(batch['vertices']))))
        triangles += len(polygon.vertices) - 2
        for index in polygon.loop_indices:
            local = mesh.vertices[mesh.loops[index].vertex_index].co
            batch['uv'].append(projected_uv(local, polygon.normal, scale) if scale else
                               tuple(source_uv.data[index].uv) if source_uv else (local.x * 2, local.y * 2))
            batch['normals'].append((normals_matrix @ mesh.corner_normals[index].vector).normalized())
    evaluated.to_mesh_clear()

for obj in source:
    obj.select_set(False)
lod_report = {}
for (mount, name), data in batches.items():
    mesh = bpy.data.meshes.new(mount + '__' + name)
    mesh.from_pydata(data['vertices'], [], data['faces'])
    mesh.materials.append(bpy.data.materials[name])
    mesh.uv_layers.new(name='UVMap').uv.foreach_set('vector', np.asarray(data['uv'], np.float32).ravel())
    if 'Site apron' in name:
        mesh.uv_layers.new(name='LightmapUV').uv.foreach_set('vector', np.asarray(data['uv'], np.float32).ravel())
    mesh.polygons.foreach_set('use_smooth', [True] * len(data['faces']))
    mesh.normals_split_custom_set(data['normals'])
    mesh.update()
    obj = bpy.data.objects.new(mesh.name, mesh)
    scene.collection.objects.link(obj)
    obj.select_set(True)
    if mount.startswith('vehicle-'):
        middle = obj.copy()
        middle.data = mesh.copy()
        middle.name = mount + '-mid__' + name
        scene.collection.objects.link(middle)
        decimate = middle.modifiers.new('Medium distance coachwork', 'DECIMATE')
        decimate.ratio = .18
        decimate.use_collapse_triangulate = True
        middle.select_set(True)

# Far silhouettes omit subpixel hardware entirely instead of retaining tiny disconnected meshes.
for kind, (width, length, height, wheelbase, radius) in SPECS.items():
    col = bpy.data.collections.new('Runtime far vehicle ' + kind)
    scene.collection.children.link(col)
    paint = converted['Vehicle paint · ' + kind][0]
    glass = converted['Vehicle laminated glazing · ' + kind][0]
    rubber = converted['Vehicle rubber · ' + kind][0]
    if kind == 'bus':
        box('far body', (0, 0, 1.63), (width, length, 2.85), paint, col, .1)
        box('far glazing', (0, 0, 2.25), (width + .01, length * .88, 1.12), glass, col, .04)
    else:
        box('far body', (0, 0, .63), (width, length, .66), paint, col, .12)
        box('far glazing', (0, .16, (height + .86) / 2), (width * .8, length * .49, height - .86), glass, col, .10)
    for y in [-wheelbase / 2, wheelbase / 2]:
        for side in [-1, 1]:
            cylinder('far tyre', (side * (width / 2 - .08), y, radius), radius, .2, rubber, col, (1, 0, 0), 12)
    for item in col.objects:
        item.name = 'vehicle-' + kind + '-far__' + item.name
        item.select_set(True)

target = OUT / 'web/charging-station.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
                          export_yup=True, export_animations=False, export_image_quality=88, export_apply=True)
for item in scene.objects:
    if not item.select_get() or not item.name.startswith('vehicle-'):
        continue
    evaluated = item.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    level = 'far' if '-far__' in item.name else 'mid' if '-mid__' in item.name else 'near'
    lod_report[level] = lod_report.get(level, 0) + sum(len(p.vertices) - 2 for p in mesh.polygons)
    evaluated.to_mesh_clear()
container = target.read_bytes()
graph = json.loads(container[20:20 + int.from_bytes(container[12:16], 'little')])
primitives = [primitive for mesh in graph['meshes'] for primitive in mesh['primitives']]
report = {'batches': len(primitives), 'triangles': sum(graph['accessors'][p['indices']]['count'] // 3 for p in primitives),
          'nearOnlyTriangles': triangles, 'baseBatches': len(batches), 'vehicleLOD': lod_report, 'bytes': target.stat().st_size,
          'mounts': sorted({node['name'].split('__')[0] for node in graph['nodes'] if 'mesh' in node}),
          'maps': {'lightMap': 'daylight_indirect.png', 'aoMap': 'static_occlusion.png', 'uvChannel': 1}}
(OUT / 'web/export-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
print(report)
