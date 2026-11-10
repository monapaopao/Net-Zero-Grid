"""Portable material batches plus shared vehicle prototypes for the browser."""
from collections import defaultdict
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

OUT = Path(__file__).resolve().parent
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

target = OUT / 'web/charging-station.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
                          export_yup=True, export_animations=False, export_image_quality=88)
report = {'batches': len(batches), 'triangles': triangles, 'bytes': target.stat().st_size,
          'mounts': sorted({mount for mount, _ in batches}),
          'maps': {'lightMap': 'daylight_indirect.png', 'aoMap': 'static_occlusion.png', 'uvChannel': 1}}
(OUT / 'web/export-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
print(report)
