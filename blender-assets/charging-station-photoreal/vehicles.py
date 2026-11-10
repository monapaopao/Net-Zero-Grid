"""Editable generic EV prototypes with wheel arches and layered glazing."""
import math

import bpy
from mathutils import Vector

from geometry import box, cylinder, mesh_object, tube
from materials import material

SPECS = {
    'model3': (1.848, 4.72, 1.442, 2.875, .33),
    'yu7': (1.996, 5.0, 1.61, 3.0, .37),
    'li': (2.0, 5.22, 1.80, 3.1, .40),
    'ice': (1.85, 4.7, 1.48, 2.8, .34),
    'bus': (2.55, 11.8, 3.4, 5.8, .49)
}


def loft(name, rings, material, collection):
    """Each ring supplies y, half width, lower and upper body heights."""
    vertices = []
    count = 24
    for y, width, bottom, top in rings:
        for index in range(count):
            angle = math.tau * index / count
            # Rounded rectangle cross section, with a crowned bonnet.
            x = math.copysign(abs(math.cos(angle)) ** .40, math.cos(angle)) * width
            z = (top + bottom) / 2 + math.copysign(abs(math.sin(angle)) ** .45, math.sin(angle)) * (top - bottom) / 2
            vertices.append((x, y, z))
    faces = [tuple(reversed(range(count))), tuple(range((len(rings) - 1) * count, len(rings) * count))]
    for ring in range(len(rings) - 1):
        for index in range(count):
            other = (index + 1) % count
            faces.append((ring * count + index, ring * count + other, (ring + 1) * count + other, (ring + 1) * count + index))
    obj = mesh_object(name, vertices, faces, material, collection)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    smooth = obj.modifiers.new('Coachwork subdivision', 'SUBSURF')
    smooth.levels = 2
    smooth.render_levels = 2
    return obj


def build_vehicle(kind, scene):
    width, length, height, wheelbase, radius = SPECS[kind]
    collection = bpy.data.collections.new('Vehicle prototype · ' + kind)
    scene.collection.children.link(collection)
    collection['station_mount'] = 'vehicle-' + kind
    paint = material('Vehicle paint · ' + kind, 'B8BDC0', .23, .28, .85)
    glass = material('Vehicle laminated glazing · ' + kind, '18242D', .10, .08, .9)
    rubber = material('Vehicle rubber · ' + kind, '17191B', .88)
    trim = material('Vehicle dark trim · ' + kind, '24272B', .46, .08)
    alloy = material('Vehicle machined wheel · ' + kind, 'ADB3B6', .24, .92)
    disc = material('Vehicle brake disc · ' + kind, '555A5C', .44, .88)
    lamp = material('Vehicle lamp lens · ' + kind, 'E1ECEF', .13, .12, .8)
    red = material('Vehicle tail lens · ' + kind, 'A01916', .21, .16, .7)
    for mat, strength in [(lamp, .18), (red, .12)]:
        surface = mat.node_tree.nodes.get('Principled BSDF')
        surface.inputs['Emission Color'].default_value = surface.inputs['Base Color'].default_value
        surface.inputs['Emission Strength'].default_value = strength
    half = width / 2
    nose = -length / 2
    rear = length / 2
    if kind == 'bus':
        body = box('Bus coachwork', (0, 0, 1.63), (width, length, 2.85), paint, collection, .16)
        box('Bus continuous side glazing', (0, .1, 2.25), (width + .012, length * .91, 1.16), glass, collection, .12)
        box('Bus front windscreen', (0, nose - .008, 2.2), (width * .88, .035, 1.45), glass, collection, .12)
        box('Bus roof', (0, 0, 3.18), (width * .95, length * .96, .16), paint, collection, .08)
        box('Bus rooftop air conditioning', (0, .5, 3.4), (1.5, 3.2, .35), trim, collection, .10)
        for y in [-4, -2.3, -.6, 1.1, 2.8, 4.5]:
            for side in [-1, 1]:
                box('Bus glazing mullion', (side * (half + .012), y, 2.25), (.027, .07, 1.2), trim, collection, .012)
        for y in [-3.4, 2.8]:
            box('Bus passenger door', (half + .025, y, 1.5), (.045, 1.15, 2.3), glass, collection, .03)
            box('Bus door split', (half + .05, y, 1.5), (.02, .045, 2.2), trim, collection)
    else:
        body_top = .88 if kind in ['model3', 'ice'] else 1.02
        rings = [
            (nose, half * .68, .42, body_top * .73),
            (nose + .13, half * .91, .31, body_top * .86),
            (nose + .45, half * .98, .29, body_top * .97),
            (-wheelbase / 2, half, .29, body_top),
            (-.45, half, .30, body_top),
            (.5, half, .30, body_top),
            (wheelbase / 2, half * .99, .30, body_top),
            (rear - .24, half * .94, .32, body_top * .94),
            (rear - .08, half * .83, .41, body_top * .88),
            (rear, half * .78, .44, body_top * .85)
        ]
        body = loft('Sculpted coachwork', rings, paint, collection)
        # Wheel openings are real geometry, allowing tyres to sit under the arches.
        for y in [-wheelbase / 2, wheelbase / 2]:
            cutter = cylinder('Wheel arch cutter', (0, y, radius), radius * 1.10, width + .6, trim, collection, (1, 0, 0), 48)
            modifier = body.modifiers.new('Wheel arch', 'BOOLEAN')
            modifier.operation = 'DIFFERENCE'
            modifier.object = cutter
            cutter.hide_render = True
            cutter.hide_set(True)
            cutter['export_skip'] = True
        cabin = loft('Glazed passenger cell', [
            (-length * .29, half * .80, body_top - .03, body_top + .04),
            (-length * .14, half * .76, body_top - .03, height * .95),
            (-length * .04, half * .77, body_top - .03, height),
            (length * .17, half * .78, body_top - .03, height * .97),
            (length * .32, half * .84, body_top - .03, body_top + .04)
        ], glass, collection)
        roof = loft('Painted roof cap', [
            (-length * .14, half * .64, height * .945, height * .96),
            (-length * .04, half * .67, height * .989, height * 1.004),
            (length * .17, half * .66, height * .962, height * .978)
        ], paint if kind == 'li' else glass, collection)
        for side in [-1, 1]:
            box('Rocker panel', (side * (half - .025), 0, .36), (.06, length * .73, .11), trim, collection, .025)
            for y in [-.45, .82]:
                box('Flush door handle', (side * (half + .012), y, body_top - .10), (.025, .18, .035), alloy, collection, .012)
            for y in [-length * .29, .08, length * .32]:
                tube('Coachwork panel seam', [(side * half, y, .48), (side * (half + .003), y, .69),
                                              (side * half * .99, y, body_top - .04)], .004, trim, collection)
            for base_y, top_y in [(-length * .29, -length * .14), (.08, .08), (length * .32, length * .17)]:
                tube('Window pillar', [(side * half * .84, base_y, body_top),
                                      (side * half * .76, top_y, height * .96)], .027, paint if base_y != .08 else trim, collection)
            mirror = box('Mirror housing', (side * (half + .12), -length * .22, body_top + .12), (.28, .22, .12), paint, collection, .055)
            box('Mirror reflective face', (side * (half + .12), -length * .22 + .112, body_top + .12), (.22, .012, .07), alloy, collection, .02)
        for side in [-1, 1]:
            headlamp = box('Slim headlamp', (side * width * .30, nose + .055, .68), (width * .25, .07, .075), lamp, collection, .025)
            headlamp.rotation_euler.z = -side * .13
            box('Rear lamp', (side * width * .29, rear - .025, .78), (width * .26, .06, .07), red, collection, .02)
        box('Front lower intake', (0, nose + .045, .43), (width * .64, .06, .10), trim, collection, .035)
        box('Rear lower diffuser', (0, rear - .055, .37), (width * .73, .08, .10), trim, collection, .025)
        tube('Windscreen wiper', [(-.48, -length * .285, body_top + .06), (.45, -length * .27, body_top + .07)], .008, trim, collection)

    for y in [-wheelbase / 2, wheelbase / 2]:
        for side in [-1, 1]:
            x = side * (half - .095)
            cylinder('Tyre carcass', (x, y, radius), radius, .22, rubber, collection, (1, 0, 0), 48)
            cylinder('Ventilated brake disc', (x + side * .115, y, radius), radius * .72, .014, disc, collection, (1, 0, 0), 48)
            cylinder('Wheel centre', (x + side * .145, y, radius), radius * .18, .024, alloy, collection, (1, 0, 0), 24)
            for spoke in range(10):
                angle = spoke * math.tau / 10
                a = (x + side * .15, y + math.cos(angle) * radius * .16, radius + math.sin(angle) * radius * .16)
                b = (x + side * .15, y + math.cos(angle + .12) * radius * .73, radius + math.sin(angle + .12) * radius * .73)
                tube('Alloy wheel spoke', [a, b], .016, alloy, collection)
            for band in [-.07, -.025, .025, .07]:
                points = [(x + band, y + math.cos(i * math.tau / 32) * radius * 1.002,
                           radius + math.sin(i * math.tau / 32) * radius * 1.002) for i in range(33)]
                tube('Tyre circumferential groove', points, .005, trim, collection)
            points = [(x + side * .135, y + math.cos(i * math.tau / 32) * radius * .81,
                       radius + math.sin(i * math.tau / 32) * radius * .81) for i in range(33)]
            tube('Rim lip', points, .012, alloy, collection)
    if kind != 'ice':
        port_y = length / 2 * .65
        port_z = 1.12 if kind == 'bus' else .83
        box('Charging port surround', (-half - .025, port_y, port_z), (.035, .22, .18), trim, collection, .015)
    return collection
