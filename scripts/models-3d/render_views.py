# Renders a built model for checking against the asset pack (scripts/models-3d/README.md): the five reference views at 1024 px with a
# transparent background, wireframe close-ups, and a topology report (per mesh: vertices, triangles, non-manifold edges, loose parts).
#   Blender -b --factory-startup --python scripts/models-3d/render_views.py -- <model.glb> <out dir> [az:name,...] [closeups]
import bpy, bmesh, json, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
glb, out = argv[0], argv[1]
views = [v.split(':') for v in (argv[2] if len(argv) > 2 else '0:front,40:3q,90:side,135:3q-back,180:back').split(',')]
closeups = len(argv) > 3 and argv[3] == 'closeups'
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(glb))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.data.materials]
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.data.materials]: bpy.data.objects.remove(o)  # the importer's bone display shape

# topology report
report = {}
for o in meshes:
    bm = bmesh.new(); bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    nonman = sum(1 for e in bm.edges if not e.is_manifold)
    # loose parts (connected components)
    seen, parts = set(), 0
    for v in bm.verts:
        if v.index in seen: continue
        parts += 1; stack = [v]
        while stack:
            x = stack.pop()
            if x.index in seen: continue
            seen.add(x.index); stack.extend(e.other_vert(x) for e in x.link_edges)
    report[o.name] = {'vertices': len(bm.verts), 'triangles': tris, 'non_manifold_edges': nonman, 'parts': parts,
                      'materials': [m.name for m in o.data.materials], 'skinned': any(md.type == 'ARMATURE' for md in o.modifiers)}
    bm.free()
arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
report['_skeleton'] = [b.name for b in arms[0].data.bones] if arms else []
json.dump(report, open(os.path.join(out, 'topology.json'), 'w'), indent=1)

# bounds in Blender space (z up)
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
ctr = (mn + mx) / 2; size = mx - mn; R = max(size)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
sh = scene.display.shading
sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_cavity = False; sh.show_shadows = False
scene.render.film_transparent = True
scene.render.resolution_x = 1024; scene.render.resolution_y = 1024
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam

def shoot(az, el, target, scale, path):
    a, e = math.radians(az), math.radians(el)
    # glTF front (+z) is Blender -y; azimuth 0 looks at the front, 90 from the model's +x side
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = target + d * R * 4
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = scale; cam_data.clip_end = R * 10
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

for az, name in views:
    shoot(float(az), 0, ctr, max(size.z, size.x, size.y) * 1.02, os.path.join(out, f'view-{name}.png'))

if closeups:
    # wireframe overlay: a thin dark wire copy of every mesh
    wire = bpy.data.materials.new('wire'); wire.diffuse_color = (0.05, 0.05, 0.06, 1)
    for o in meshes:
        c = o.copy(); c.data = o.data.copy(); scene.collection.objects.link(c)
        m = c.modifiers.new('wire', 'WIREFRAME'); m.thickness = R * 0.0012; m.use_replace = True
        c.data.materials.clear(); c.data.materials.append(wire)
    H = size.z
    spots = {'neck': (0.80, 0, 0.22), 'shoulder': (0.72, 40, 0.24), 'hips': (0.43, 20, 0.26), 'hairline': (0.90, 30, 0.22), 'feet': (0.05, 30, 0.22)}
    for name, (h, az, sc) in spots.items():
        shoot(az, 8, Vector((ctr.x, ctr.y, mn.z + H * h)), H * sc, os.path.join(out, f'wire-{name}.png'))
print('rendered to', out)
