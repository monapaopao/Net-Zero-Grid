"""Mesh creation without context-dependent Blender operators."""
import math

import bpy
from mathutils import Vector


def mesh_object(name, vertices, faces, material, collection, bevel=0):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if bevel:
        modifier = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        normal = obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
    return obj


def box(name, location, dimensions, material, collection, bevel=0):
    x, y, z = [value / 2 for value in dimensions]
    vertices = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
                (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    obj = mesh_object(name, vertices, faces, material, collection, bevel)
    obj.location = location
    return obj


def tube(name, points, radius, material, collection):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    curve.resolution_u = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for knot, point in zip(spline.bezier_points, points):
        knot.co = point
        knot.handle_left_type = 'AUTO'
        knot.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    curve.materials.append(material)
    return obj


def cylinder(name, location, radius, depth, material, collection, axis=(0, 0, 1), segments=32):
    vertices = []
    for z in [-depth / 2, depth / 2]:
        for index in range(segments):
            angle = index * math.tau / segments
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
    faces = [tuple(reversed(range(segments))), tuple(range(segments, segments * 2))]
    faces += [(i, (i + 1) % segments, (i + 1) % segments + segments, i + segments) for i in range(segments)]
    obj = mesh_object(name, vertices, faces, material, collection)
    for polygon in obj.data.polygons[2:]:
        polygon.use_smooth = True
    obj.location = location
    obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(Vector(axis)).to_euler()
    return obj


def text(name, content, location, size, material, collection, rotation=(math.pi / 2, 0, 0)):
    font = bpy.data.curves.new(name, 'FONT')
    font.body = content
    font.size = size
    font.align_x = 'CENTER'
    font.materials.append(material)
    obj = bpy.data.objects.new(name, font)
    collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    return obj
