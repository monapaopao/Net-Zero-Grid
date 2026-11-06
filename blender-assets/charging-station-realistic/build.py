"""Independent textured charging-station study. Run with Blender --background --python."""
import bpy, math, json
import numpy as np
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
(OUT/'textures').mkdir(exist_ok=True)
(OUT/'renders').mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/station-structure.blend'))
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
original_materials=[m.name for m in bpy.data.materials]
rng=np.random.default_rng(20)
def image(name, values, noncolor=False):
    h,w=values.shape[:2]
    im=bpy.data.images.new(name,width=w,height=h,alpha=True)
    rgba=np.ones((h,w,4),dtype=np.float32)
    rgba[:,:,:3]=values[:,:,None] if values.ndim==2 else values
    if noncolor: im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw=str(OUT/'textures'/(name+'.png')); im.file_format='PNG'; im.save(); im.pack()
    return im
n=512
fine=rng.random((n,n)).astype(np.float32)
coarse=rng.random((32,32)).repeat(16,0).repeat(16,1)
# Smooth coarse aggregate without external image dependencies.
for _ in range(12): coarse=(coarse+np.roll(coarse,1,0)+np.roll(coarse,-1,0)+np.roll(coarse,1,1)+np.roll(coarse,-1,1))/5
aggregate=np.clip(.55+.07*(coarse-.5)+.035*(fine-.5),0,1)
concrete_color=image('concrete_basecolor',np.stack([aggregate*1.02,aggregate,aggregate*.94],axis=2))
height=image('concrete_height',fine*.4+coarse*.6,True)
rough=image('surface_roughness',np.clip(.72+fine*.19,0,1),True)
paint=image('paint_micrograin',np.clip(.5+(fine-.5)*.16,0,1),True)
def texture_nodes(mat, base=None, scale=1, strength=.16):
    mat.use_nodes=True; nt=mat.node_tree; p=nt.nodes.get('Principled BSDF')
    tc=nt.nodes.new('ShaderNodeTexCoord'); mapping=nt.nodes.new('ShaderNodeVectorMath'); mapping.operation='SCALE'; mapping.inputs[3].default_value=scale
    nt.links.new(tc.outputs['Object'],mapping.inputs[0])
    def tex(im):
        t=nt.nodes.new('ShaderNodeTexImage');t.image=im;t.projection='BOX';t.projection_blend=.15
        nt.links.new(mapping.outputs[0],t.inputs['Vector']);return t
    if base: nt.links.new(tex(base).outputs['Color'],p.inputs['Base Color'])
    nt.links.new(tex(rough).outputs['Color'],p.inputs['Roughness'])
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.004 if base else .002
    nt.links.new(tex(height if base else paint).outputs['Color'],bump.inputs['Height']);nt.links.new(bump.outputs[0],p.inputs['Normal'])
for m in list(bpy.data.materials):
    if not m.use_nodes: continue
    p=m.node_tree.nodes.get('Principled BSDF')
    if not p: continue
    name=m.name.lower()
    if any(x in name for x in ['apron','concrete','aisle']): texture_nodes(m,concrete_color,.8,.26)
    elif any(x in name for x in ['white','powder','steel','enclosure','coating','rail','frame']): texture_nodes(m,None,3,.15)
    if 'glass' in name or 'solar' in name or 'photovoltaic' in name:
        p.inputs['Roughness'].default_value=.19;p.inputs['Coat Weight'].default_value=.45
    if 'interface glass' in name:
        p.inputs['Base Color'].default_value=(.009,.025,.032,1)
    if 'markings' in name: p.inputs['Emission Strength'].default_value=1.2
# Non-destructive bevels give physical edges highlights.
for obj in list(scene.objects):
    if obj.type=='MESH' and len(obj.data.vertices)==8:
        bevel=obj.modifiers.new('Manufactured edge radius','BEVEL');bevel.width=min(.025,min(obj.dimensions)*.16);bevel.segments=3
        bevel.limit_method='ANGLE'
        normal=obj.modifiers.new('Face weighted normals','WEIGHTED_NORMAL')
def mat(name,color,metal=0,roughness=.5):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=roughness
    return m
rubber=mat('Cable EPDM rubber',(.012,.015,.018),0,.72)
seam=mat('Expansion joint elastomer',(.07,.075,.072),0,.93)
metal=mat('Brushed stainless fixings',(.33,.36,.38),.85,.28)
def cube(name,loc,dim,material,bevel=0):
    x,y,z=[d/2 for d in dim];mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    mesh.materials.append(material);o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.location=loc
    if bevel: b=o.modifiers.new('Edge radius','BEVEL');b.width=bevel;b.segments=3
    return o
def cable(name,points,radius,material):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=4
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for bp,pt in zip(s.bezier_points,points):bp.co=pt;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);c.materials.append(material);return o
# Each dispenser retains its original position; add hanging connector and bolts.
for o in list(scene.objects):
    if ' · chassis' not in o.name: continue
    x,y,z=o.location; face=-1 if o.name.startswith('N') else 1
    cable(o.name[:3]+' charging cable',[(x+.27,y+face*.29,1.55),(x+.63,y+face*.48,.9),(x+.72,y+face*.46,.45),(x+.39,y+face*.34,.39),(x+.17,y+face*.34,1.19)],.026,rubber)
    cube('Connector grip',(x+.17,y+face*.34,1.29),(.095,.12,.25),rubber,.025)
    for dx in [-.22,.22]:
        for zz in [.45,2.05]:
            cube('Stainless fastener',(x+dx,y+face*.27,zz),(.025,.012,.025),metal,.005)
# Subtle slab expansion joints and road drains.
for x in range(-18,20,6):cube('Concrete expansion joint',(x,0,.055),(.016,33,.005),seam)
for y in [-15.4,15.4]:
    cube('Drain channel',(0,y,.10),(37,.18,.035),seam)
    for i in range(185):cube('Drain grate',(i*.2-18.4,y,.123),(.035,.17,.018),metal)
groundmat=mat('Surrounding asphalt',(.11,.12,.12),0,.9);texture_nodes(groundmat,None,1,.3)
cube('Site surrounding pavement',(0,0,-.18),(2000,2000,.25),groundmat)
# A simple background curb provides a horizon without importing external assets.
curb=bpy.data.materials.get('Precast apron')
for y in [-17.2,17.2]:cube('Perimeter curb',(0,y,.15),(40,.22,.3),curb,.025)
world=bpy.data.worlds.new('Procedural daylight');scene.world=world;world.use_nodes=True
nt=world.node_tree;sky=nt.nodes.new('ShaderNodeTexSky');sky.sky_type='MULTIPLE_SCATTERING';sky.sun_elevation=math.radians(24);sky.sun_rotation=math.radians(135)
nt.links.new(sky.outputs[0],nt.nodes.get('Background').inputs[0]);nt.nodes.get('Background').inputs[1].default_value=.35
def light(name,loc,energy,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
light('Soft forecourt fill',(5,-12,11),2400,12)
camdata=bpy.data.cameras.new('Architectural camera');cam=bpy.data.objects.new('Architectural camera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.lens=40;camdata.clip_end=500
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
device='CPU'
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type=='OPTIX'
    if any(d.type=='OPTIX' for d in prefs.devices):scene.cycles.device='GPU';device='OPTIX'
except Exception:pass
scene.render.resolution_x=1440;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=-.7
def shot(name,position,target,lens):
    cam.location=position;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=lens
    scene.render.filepath=str(OUT/'renders'/name)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'charging-station-realistic.blend'))
    bpy.ops.render.render(write_still=True)
print('MATERIALS',original_materials,flush=True)
print('DEVICE',device,flush=True)
shot('01-station-daylight.png',(44,-53,28),(-4,0,2),42)
shot('02-charger-detail.png',(-10,8,2.5),(-13.5,14,1.2),47)
(OUT/'build-report.json').write_text(json.dumps({'device':device,'objects':len(scene.objects),'materials':len(bpy.data.materials),'textures':[p.name for p in (OUT/'textures').glob('*.png')],'renders':[p.name for p in (OUT/'renders').glob('*.png')]},indent=2),encoding='utf-8')

