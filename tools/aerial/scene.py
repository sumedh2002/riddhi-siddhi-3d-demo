# usage: blender -b -P scene.py -- <outdir> <frames> <width> <samples> [only_frame]
import bpy, bmesh, math, sys, os, json, random, time, addon_utils
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; OUT = a[0]; N = int(a[1]); W = int(a[2]); SAMPLES = int(a[3]); ONLY = int(a[4]) if len(a) > 4 else -1
D = os.path.dirname(os.path.abspath(__file__)); t0 = time.time(); random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=D + '/building.glb')
info = json.load(open(D + '/scene.json'))
sc = bpy.context.scene
def pm(name, col, rough=0.8, metal=0.0, alpha=1.0, bump=0.0, scale=6.0, var=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial'); p = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(p.outputs[0], o.inputs[0])
    p.inputs['Base Color'].default_value = (*col, 1); p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal; p.inputs['Alpha'].default_value = alpha
    if bump or var:
        g = nt.nodes.new('ShaderNodeNewGeometry'); n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 6
        nt.links.new(g.outputs['Position'], n.inputs['Vector'])
        if var:
            r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = (*[c * (1 - var) for c in col], 1); r.color_ramp.elements[1].color = (*[min(1, c * (1 + var)) for c in col], 1)
            r.color_ramp.elements[0].position = 0.3; r.color_ramp.elements[1].position = 0.7; nt.links.new(n.outputs['Fac'], r.inputs[0]); nt.links.new(r.outputs[0], p.inputs['Base Color'])
        if bump:
            b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump; nt.links.new(n.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    return m
# our building + site
pm('m_efe3c9', (0.80, 0.72, 0.55), 0.85, bump=0.08, scale=40, var=0.05)      # plaster walls
pm('m_fbf8f1', (0.90, 0.88, 0.83), 0.6)                                       # white mouldings
pm('m_ffffff', (0.92, 0.92, 0.92), 0.4)                                       # window frames
pm('m_4f7697', (0.30, 0.42, 0.52), 0.03, metal=1.0)                           # glazing reflects the sky
pm('m_cfe2ee_t', (0.75, 0.88, 0.92), 0.02, alpha=0.28)                        # glass balcony railing
pm('m_c3cab9', (0.20, 0.30, 0.10), 1.0, bump=0.3, scale=0.5, var=0.45)        # open land: grass
pm('m_7fa866', (0.13, 0.32, 0.07), 1.0, bump=0.3, scale=3, var=0.3); pm('m_6f9a57', (0.11, 0.28, 0.06), 1.0, bump=0.3, scale=3, var=0.3)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.data.materials and o.data.materials[0] and o.data.materials[0].name in ('m_55595f', 'm_e9e6df'): bpy.data.objects.remove(o)
def box(x0, y0, x1, y1, z0, z1, m, name='b'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); o = bpy.context.object; o.scale = (x1 - x0, y1 - y0, z1 - z0); o.name = name; o.data.materials.append(m); return o
# ground to the horizon, roads, footpaths
box(-3000, -3000, 3000, 3000, -1, -0.03, bpy.data.materials['m_c3cab9'], 'land')
asph = pm('asphalt', (0.045, 0.047, 0.05), 0.8, bump=0.15, scale=30, var=0.15); path = pm('footpath', (0.55, 0.53, 0.49), 0.9, bump=0.1, scale=20, var=0.08); white = pm('paint', (0.85, 0.85, 0.82), 0.6)
RX = [(-22.85, 11), (33, 9), (-96, 9), (102, 9), (-175, 9), (180, 9)]; RY = [(-43, 9), (43, 9), (-132, 9), (132, 9), (-222, 9), (222, 9)]
for yc, w in RX:
    box(-1500, yc - w / 2 - 2.2, 1500, yc + w / 2 + 2.2, 0, 0.14, path); box(-1500, yc - w / 2, 1500, yc + w / 2, 0, 0.16, asph)
for xc, w in RY:
    box(xc - w / 2 - 2.2, -1500, xc + w / 2 + 2.2, 1500, 0, 0.14, path); box(xc - w / 2, -1500, xc + w / 2, 1500, 0, 0.165, asph)
for xx in range(-400, 400, 7): box(xx, -22.95, xx + 3.2, -22.75, 0.16, 0.172, white)
# made-up neighbouring buildings (indicative): facade grid from a brick texture, roofs plain
def bmat(i, col):
    m = bpy.data.materials.new('nb%d' % i); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeNewGeometry'); sx = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Position'], sx.inputs[0])
    ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'ADD'; nt.links.new(sx.outputs['X'], ad.inputs[0]); nt.links.new(sx.outputs['Y'], ad.inputs[1])
    cb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(ad.outputs[0], cb.inputs['X']); nt.links.new(sx.outputs['Z'], cb.inputs['Y'])
    br = nt.nodes.new('ShaderNodeTexBrick'); br.offset = 0; br.inputs['Scale'].default_value = 1; br.inputs['Mortar Size'].default_value = 0.85; br.inputs['Brick Width'].default_value = 3.1; br.inputs['Row Height'].default_value = 3.0
    br.inputs['Color1'].default_value = (0, 0, 0, 1); br.inputs['Color2'].default_value = (0, 0, 0, 1); br.inputs['Mortar'].default_value = (1, 1, 1, 1); nt.links.new(cb.outputs[0], br.inputs['Vector'])
    g = nt.nodes.new('ShaderNodeNewGeometry'); sn = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(g.outputs['Normal'], sn.inputs[0])
    up = nt.nodes.new('ShaderNodeMath'); up.operation = 'GREATER_THAN'; up.inputs[1].default_value = 0.5; nt.links.new(sn.outputs['Z'], up.inputs[0])
    wall = nt.nodes.new('ShaderNodeMath'); wall.operation = 'MAXIMUM'; nt.links.new(br.outputs['Color'], wall.inputs[0]); nt.links.new(up.outputs[0], wall.inputs[1])
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.inputs[1].default_value = (0.22, 0.32, 0.42, 1); mix.inputs[2].default_value = (*col, 1); nt.links.new(wall.outputs[0], mix.inputs[0]); nt.links.new(mix.outputs[0], p.inputs['Base Color'])
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1; nt.links.new(wall.outputs[0], inv.inputs[1]); nt.links.new(inv.outputs[0], p.inputs['Metallic'])
    rg = nt.nodes.new('ShaderNodeMapRange'); rg.inputs['To Min'].default_value = 0.05; rg.inputs['To Max'].default_value = 0.85; nt.links.new(wall.outputs[0], rg.inputs[0]); nt.links.new(rg.outputs[0], p.inputs['Roughness']); return m
NB = [bmat(i, c) for i, c in enumerate([(0.78, 0.74, 0.66), (0.72, 0.76, 0.78), (0.82, 0.70, 0.58), (0.70, 0.72, 0.66), (0.84, 0.80, 0.72)])]
roofm = pm('nroof', (0.5, 0.49, 0.47), 0.9)
xs = sorted([c for c, w in RY]); ys = sorted([c for c, w in RX]); parks = []
for i in range(len(xs) - 1):
    for j in range(len(ys) - 1):
        x0, x1, y0, y1 = xs[i] + 9, xs[i + 1] - 9, ys[j] + 10, ys[j + 1] - 9
        if x0 < 0 < x1 and y0 < 0 < y1: continue                       # our own plot
        if random.random() < 0.28: parks.append((x0, y0, x1, y1)); continue
        k = 2 if (x1 - x0) > 60 and random.random() < 0.7 else 1; wd = (x1 - x0) / k
        for q in range(k):
            bx0 = x0 + q * wd + random.uniform(2, 6); bx1 = x0 + (q + 1) * wd - random.uniform(2, 6); by0 = y0 + random.uniform(2, 8); by1 = y1 - random.uniform(2, 8); h = random.choice([12, 15, 15, 18]) if math.hypot((bx0 + bx1) / 2, (by0 + by1) / 2) < 125 else random.choice([18, 21, 24, 24, 27, 30, 36])
            box(bx0, by0, bx1, by1, 0, h, random.choice(NB), 'nb'); box(bx0 - 0.3, by0 - 0.3, bx1 + 0.3, by1 + 0.3, h, h + 0.9, roofm); box(bx0 + 3, by0 + 3, bx0 + 9, by0 + 8, h + 0.9, h + 3.6, roofm)
# distant hills (the Karnala side), for a real horizon
hill = pm('hill', (0.16, 0.24, 0.16), 1.0, bump=0.4, scale=0.02, var=0.3)
for ang, r, s, hh in [(20, 1100, 420, 150), (48, 1250, 520, 190), (75, 1050, 380, 120), (105, 1300, 560, 170), (200, 1500, 600, 130), (260, 1400, 500, 110)]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=(r * math.cos(math.radians(ang)), r * math.sin(math.radians(ang)), -10)); o = bpy.context.object; o.scale = (s, s * 0.8, hh); o.data.materials.append(hill); bpy.ops.object.shade_smooth()
# real trees (Sapling), instanced
addon_utils.enable('add_curve_sapling', default_set=True)
import add_curve_sapling as S
st = eval([l for l in open(os.path.join(os.path.dirname(S.__file__), 'presets', 'small_maple.py')) if l.strip().startswith('{')][0]); st.pop('limitImport', None)
before = set(bpy.data.objects)
bpy.ops.curve.tree_add(do_update=True, **{k: v for k, v in st.items() if k not in ('bevel', 'showLeaves', 'armAnim', 'useArm', 'makeMesh')}, bevel=True, showLeaves=True)
tcol = bpy.data.collections.new('TreeSrc'); leafm = pm('leaf', (0.07, 0.22, 0.035), 0.6, var=0.35, scale=1.5); barkm = pm('bark', (0.13, 0.09, 0.06), 0.9, bump=0.5, scale=15)
for o in [o for o in bpy.data.objects if o not in before]:
    for c in list(o.users_collection): c.objects.unlink(o)
    tcol.objects.link(o); o.data.materials.clear(); o.data.materials.append(leafm if o.type == 'MESH' else barkm)
def tree(x, y, z, s):
    e = bpy.data.objects.new('t', None); e.instance_type = 'COLLECTION'; e.instance_collection = tcol; e.location = (x, y, z); e.scale = (s, s, s * random.uniform(0.85, 1.1)); e.rotation_euler = (0, 0, random.uniform(0, 6.28)); sc.collection.objects.link(e)
for x, y, z, s in info['trees']: tree(x, y, z, 0.42 * s)
for x, y, z in info['palms']: tree(x, y, z, 0.6)
for yc, w in RX[:4]:
    for xx in range(-380, 380, 14):
        if abs(xx) < 30 and yc == -22.85: continue
        tree(xx + random.uniform(-2, 2), yc + (w / 2 + 1.2) * random.choice([-1, 1]), 0.1, random.uniform(0.5, 0.75))
for x0, y0, x1, y1 in parks:
    for _ in range(int((x1 - x0) * (y1 - y0) / 220)): tree(random.uniform(x0, x1), random.uniform(y0, y1), 0, random.uniform(0.5, 0.95))
# light, sky, render
w = bpy.data.worlds.new('Sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes['Background']
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_disc = False; sky.sun_elevation = math.radians(42); sky.sun_rotation = math.radians(215); sky.air_density = 1.0; sky.dust_density = 3.0; sky.ozone_density = 1.5
nt.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.22
sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 3.6; sun.angle = math.radians(2.0); sun.color = (1.0, 0.93, 0.82); so = bpy.data.objects.new('Sun', sun); sc.collection.objects.link(so)
so.rotation_euler = Vector((55, 62, -68)).normalized().to_track_quat('-Z', 'Y').to_euler()
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.05; sc.cycles.use_denoising = False
sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 2; sc.cycles.transparent_max_bounces = 6; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.render.resolution_x = W; sc.render.resolution_y = int(W * 0.625); sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 92; sc.render.use_persistent_data = True
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
sc.view_settings.exposure = -0.55
cam = bpy.data.cameras.new('Cam'); cam.sensor_fit = 'HORIZONTAL'; cam.angle = math.radians(38); cam.clip_start = 1; cam.clip_end = 6000; co = bpy.data.objects.new('Cam', cam); sc.collection.objects.link(co); sc.camera = co
print('SCENE built in %.0fs' % (time.time() - t0), flush=True)
for k in range(N):
    if k < ONLY: continue
    ang = math.radians(-112) - k * 2 * math.pi / N   # frame 0 = front-left, then round anticlockwise seen from above
    co.location = Vector((150 * math.cos(ang), 150 * math.sin(ang), 78)); co.rotation_euler = (Vector((0, 0, 7)) - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = '%s/f-%02d.jpg' % (OUT, k); t1 = time.time(); bpy.ops.render.render(write_still=True); print('FRAME %d in %.0fs' % (k, time.time() - t1), flush=True)
