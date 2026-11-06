"""Export the study as indexed batches per mount and material, with portable UV textures."""
from collections import defaultdict
import json
from pathlib import Path

import bpy
import numpy as np

OUT = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT.parent / 'charging-station-realistic.blend'))
scene = bpy.context.scene
source = list(scene.objects)
materials = {}


def normal_image(height, strength):
    name = height.name + ' · tangent normal'
    if name in bpy.data.images:
        return bpy.data.images[name]
    w, h = height.size
    rgba = np.empty(w * h * 4, np.float32)
    height.pixels.foreach_get(rgba)
    values = rgba.reshape(h, w, 4)[:, :, 0]
    dx = (np.roll(values, -1, 1) - np.roll(values, 1, 1)) * strength
    dy = (np.roll(values, -1, 0) - np.roll(values, 1, 0)) * strength
    normals = np.stack((-dx, -dy, np.ones_like(dx)), axis=2)
    normals /= np.linalg.norm(normals, axis=2, keepdims=True)
    pixels = np.ones((h, w, 4), np.float32)
    pixels[:, :, :3] = normals * .5 + .5
    image = bpy.data.images.new(name, width=w, height=h, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    return image


def web_material(original):
    if original.name in materials:
        return materials[original.name]
    mat = original.copy()
    mat.name = 'Web ' + original.name
    tree = mat.node_tree
    surface = tree.nodes.get('Principled BSDF')
    scale = None
    for socket in ['Base Color', 'Roughness']:
        for link in list(surface.inputs[socket].links):
            tex = link.from_node
            if tex.type != 'TEX_IMAGE' or tex.projection != 'BOX':
                continue
            mapping = tex.inputs['Vector'].links[0].from_node
            scale = mapping.inputs[3].default_value
            tree.links.remove(tex.inputs['Vector'].links[0])
            tex.projection = 'FLAT'
            # glTF stores the roughness factor in the green channel.
            if socket == 'Roughness':
                channels = tree.nodes.new('ShaderNodeSeparateColor')
                tree.links.new(tex.outputs['Color'], channels.inputs[0])
                tree.links.new(channels.outputs['Green'], surface.inputs['Roughness'])
    normal_input = surface.inputs['Normal']
    if normal_input.is_linked and normal_input.links[0].from_node.type == 'BUMP':
        bump = normal_input.links[0].from_node
        height = bump.inputs['Height'].links[0].from_node.image
        tex = tree.nodes.new('ShaderNodeTexImage')
        tex.image = normal_image(height, .65 if height.name == 'concrete_height' else .32)
        normal = tree.nodes.new('ShaderNodeNormalMap')
        tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
        tree.links.new(normal.outputs[0], normal_input)
    materials[original.name] = (mat, scale)
    return mat, scale


def planar_uv(position, normal, scale):
    axis = max(range(3), key=lambda index: abs(normal[index]))
    u, v = ((1, 2), (2, 0), (0, 1))[axis]
    return (position[u] * scale * (-1 if normal[axis] < 0 else 1), position[v] * scale)


# Keep large manufactured bevels. PV cell and drainage geometry use flat edges
# to avoid repeating sub-pixel bevels thousands of times across the site.
for obj in source:
    if obj.type != 'MESH':
        continue
    panel = any('PV modules' in collection.name for collection in obj.users_collection)
    if panel or min(obj.dimensions) < .06:
        obj.modifiers.clear()
    for modifier in obj.modifiers:
        if modifier.type == 'BEVEL':
            modifier.segments = 2
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
batches = defaultdict(lambda: ([], [], [], []))
triangle_count = 0
for obj in source:
    if obj.type not in {'MESH', 'FONT'} or obj.name.startswith('Site surrounding pavement'):
        continue
    mount = next((c['station_mount'] for c in obj.users_collection if 'station_mount' in c), 'station')
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    world = evaluated.matrix_world
    normal_matrix = world.to_3x3().inverted_safe().transposed()
    positions = [world @ vertex.co for vertex in mesh.vertices]
    source_uv = mesh.uv_layers.active
    for polygon in mesh.polygons:
        material, scale = web_material(mesh.materials[polygon.material_index])
        verts, faces, uvs, normals = batches[mount, material.name]
        start = len(verts)
        verts.extend(positions[i] for i in polygon.vertices)
        faces.append(tuple(range(start, len(verts))))
        triangle_count += len(polygon.vertices) - 2
        for index in polygon.loop_indices:
            loop = mesh.loops[index]
            local = mesh.vertices[loop.vertex_index].co
            uvs.append(planar_uv(local, polygon.normal, scale) if scale else
                       tuple(source_uv.data[index].uv) if source_uv else (0, 0))
            normals.append((normal_matrix @ mesh.corner_normals[index].vector).normalized())
    evaluated.to_mesh_clear()

for obj in source:
    obj.select_set(False)
for (mount, material), (verts, faces, uvs, normals) in batches.items():
    name = mount + '__' + material
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(bpy.data.materials[material])
    layer = mesh.uv_layers.new(name='UVMap')
    layer.uv.foreach_set('vector', np.asarray(uvs, np.float32).ravel())
    mesh.polygons.foreach_set('use_smooth', [True] * len(faces))
    mesh.normals_split_custom_set(normals)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.select_set(True)

target = OUT / 'charging-station.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
                          export_yup=True, export_animations=False)
report = {'mounts': sorted({mount for mount, _ in batches}), 'batches': len(batches),
          'triangles': triangle_count, 'bytes': target.stat().st_size}
(OUT / 'export-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
print(report)
