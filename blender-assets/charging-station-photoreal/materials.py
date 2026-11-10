"""Deterministic, metre-scaled PBR maps for the station."""
from pathlib import Path

import bpy
import numpy as np

OUT = Path(__file__).resolve().parent
RNG = np.random.default_rng(20261110)


def save_image(name, values, data=False):
    height, width = values.shape[:2]
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    if data:
        image.colorspace_settings.name = 'Non-Color'
    pixels = np.ones((height, width, 4), dtype=np.float32)
    pixels[:, :, :3] = values[:, :, None] if values.ndim == 2 else values
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(OUT / 'textures' / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def smooth_noise(size, cells):
    values = RNG.random((cells, cells)).astype(np.float32)
    axis = np.linspace(0, cells, size, endpoint=False)
    indices = np.floor(axis).astype(int)
    weight = axis - indices
    weight = weight * weight * (3 - 2 * weight)
    a = values[indices[:, None] % cells, indices[None, :] % cells]
    b = values[indices[:, None] % cells, (indices[None, :] + 1) % cells]
    c = values[(indices[:, None] + 1) % cells, indices[None, :] % cells]
    d = values[(indices[:, None] + 1) % cells, (indices[None, :] + 1) % cells]
    return (a * (1 - weight) + b * weight) * (1 - weight[:, None]) + (c * (1 - weight) + d * weight) * weight[:, None]


def srgb(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4))


def linear_color(hex_color):
    return tuple(value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4 for value in srgb(hex_color)) + (1,)


def material(name, color, roughness=.5, metallic=0, coat=0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = linear_color(color)
    result.use_nodes = True
    surface = result.node_tree.nodes.get('Principled BSDF')
    surface.inputs['Base Color'].default_value = linear_color(color)
    surface.inputs['Roughness'].default_value = roughness
    surface.inputs['Metallic'].default_value = metallic
    surface.inputs['Coat Weight'].default_value = coat
    surface.inputs['Coat Roughness'].default_value = .16
    return result


def image_node(mat, image, socket):
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    mat.node_tree.links.new(node.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs[socket])
    return node


def normal_map(name, heights, amount):
    dx = (np.roll(heights, -1, 1) - np.roll(heights, 1, 1)) * amount
    dy = (np.roll(heights, -1, 0) - np.roll(heights, 1, 0)) * amount
    normals = np.stack((-dx, -dy, np.ones_like(dx)), axis=2)
    normals /= np.linalg.norm(normals, axis=2, keepdims=True)
    return save_image(name, normals * .5 + .5, True)


def connect_normal(mat, image):
    tree = mat.node_tree
    texture = tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    normal = tree.nodes.new('ShaderNodeNormalMap')
    tree.links.new(texture.outputs['Color'], normal.inputs['Color'])
    tree.links.new(normal.outputs[0], tree.nodes.get('Principled BSDF').inputs['Normal'])


def make_floor():
    size = 2048
    x, y = np.meshgrid(np.linspace(-20, 20, size), np.linspace(-17.31, 17.31, size))
    fine = RNG.random((size, size)).astype(np.float32)
    broad = smooth_noise(size, 17)
    stone = smooth_noise(size, 320)
    color = np.empty((size, size, 3), np.float32)
    color[:] = srgb('97958C')
    color *= (.96 + .055 * broad + .045 * (fine - .5))[:, :, None]
    aisle = np.abs(y) < 3
    color[aisle] = np.array(srgb('4A4D4C')) * (.91 + .12 * stone[aisle, None])
    painted = np.zeros((size, size), bool)
    wheelwear = np.zeros((size, size), np.float32)
    for row, cy in enumerate([9, -9]):
        for index in range(12):
            if row == 1 and index < 4:
                continue
            cx = -16.5 + index * 3
            bay = (np.abs(x - cx) < 1.375) & (np.abs(y - cy) < 3.5)
            painted |= bay
            tracks = np.exp(-((x - cx - .73) / .13) ** 2) + np.exp(-((x - cx + .73) / .13) ** 2)
            wheelwear += tracks * np.exp(-((y - cy) / 3.0) ** 4) * (.3 + .7 * broad)
    bus = (np.abs(x + 12) < 5.9) & (np.abs(y + 9) < 1.75)
    painted |= bus
    color[painted] = np.array(srgb('39786A')) * (.88 + .16 * broad[painted, None])
    color *= (1 - np.clip(wheelwear * .17, 0, .23))[:, :, None]
    # Slab joints and dirt follow construction and drainage, rather than random spots.
    joints = np.minimum(np.mod(x + 20, 5), 5 - np.mod(x + 20, 5)) < .011
    joints |= np.minimum(np.mod(y + 17, 5), 5 - np.mod(y + 17, 5)) < .011
    color[joints & ~painted & ~aisle] *= .65
    edge_dirt = np.exp(-((np.abs(y) - 15.4) / .32) ** 2) * broad
    color *= (1 - edge_dirt * .19)[:, :, None]
    heights = .30 * fine + .3 * stone + .1 * broad
    heights[aisle] = .6 * fine[aisle] + .4 * stone[aisle]
    roughness = np.clip(.72 + .14 * fine + .06 * broad, 0, 1)
    roughness[painted] = .69 + .15 * fine[painted]
    floor = material('Site apron · metre-scaled weathering', '97958C', .85)
    image_node(floor, save_image('station_floor_color', np.clip(color, 0, 1)), 'Base Color')
    image_node(floor, save_image('station_floor_roughness', roughness[::2, ::2], True), 'Roughness')
    connect_normal(floor, normal_map('station_floor_normal', heights[::2, ::2], .48))
    return floor


def coated_material(name, color, metallic=.08):
    result = material(name, color, .42, metallic, .16)
    roughness = bpy.data.images.get('coating_roughness')
    normals = bpy.data.images.get('coating_normal')
    if not roughness:
        fine = RNG.random((512, 512)).astype(np.float32)
        roughness = save_image('coating_roughness', .37 + fine * .13, True)
        normals = normal_map('coating_normal', fine, .08)
    image_node(result, roughness, 'Roughness')
    connect_normal(result, normals)
    return result
