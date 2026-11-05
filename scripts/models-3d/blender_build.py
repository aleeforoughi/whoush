# Blender half of the Whoush 3D model pipeline (scripts/models-3d/README.md).
# Takes a fused model (fuse.mjs output: one continuous surface per material, y up, source units), and in Blender:
# re-centres it (standing on the ground, centred on x/z, front toward +z in glTF), decimates it, gives it the pack's matte materials
# (clay, hair, glass, dark, tail), rigs the people with a humanoid armature and automatic (bone heat) weights, then writes
# public/visuals/3d/<id>.glb and a .blend source next to the fused input.
#   Blender -b --factory-startup --python scripts/models-3d/blender_build.py -- <id> <fused.json> <out.glb> [<out.blend>]
import bpy, bmesh, json, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
model_id, src_path, out_glb = argv[0], argv[1], argv[2]
out_blend = argv[3] if len(argv) > 3 else None
here = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(here, 'models.json')))[model_id]
src = json.load(open(src_path))
unit = CFG['unit']

# The pack's look: a matte, slightly warm white clay and a soft cool grey hair (lib/scene3d.ts SCENE_COLORS for the rest).
MATERIALS = {
    'clay': ((0.89, 0.886, 0.878), 0.82),
    'hair': ((0.56, 0.57, 0.6), 0.78),
    'glass': ((0.74, 0.76, 0.8), 0.25),  # the pack's pale grey glass
    'dark': ((0.169, 0.176, 0.192), 0.7),
    'tail': ((0.769, 0.271, 0.247), 0.5),
}
def srgb_to_linear(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups

# bounds in source space (y up)
mn = [1e9] * 3; mx = [-1e9] * 3
for p in src['parts']:
    v = p['vertices']
    for i in range(0, len(v), 3):
        for k in range(3):
            mn[k] = min(mn[k], v[i + k]); mx[k] = max(mx[k], v[i + k])
shift = [-(mn[0] + mx[0]) / 2, -mn[1], -(mn[2] + mx[2]) / 2]

def to_blender(x, y, z):
    # three/glTF (x, y up, z toward the viewer) → Blender (x, -z, y up); the glTF exporter converts back
    return Vector(((x + shift[0]) * unit, -(z + shift[2]) * unit, (y + shift[1]) * unit))

def material(name):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    if not m.node_tree: m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    col, rough = MATERIALS[name]
    bsdf.inputs['Base Color'].default_value = (*srgb_to_linear(col), 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = 0
    m.use_backface_culling = not CFG.get('doubleSided', False)
    return m

SK = CFG.get('skeleton')
def part_weights(p):
    """Each vertex follows the bone of the part it grew from (fuse.mjs labels); across each joint the weight blends smoothly
    into the parent, and right around a child's joint it shares with the child. Unlike bone heat, a torso side that touches
    the arm stays on the torso."""
    B = SK['bones']
    J = {n: Vector(b['at']) for n, b in B.items()}
    kids = {n: [c for c, b in B.items() if b.get('parent') == n and not b.get('end')] for n in B}
    def tail(n):
        ks = [c for c, b in B.items() if b.get('parent') == n]
        for c in ['spine', 'chest', 'neck', 'head', 'headEnd']:
            if c in ks: return J[c]
        for c in ks:
            if B[c].get('end'): return J[c]
        return J[ks[0]] if ks else J[n] + Vector((0, 10, 0))
    D = {n: (tail(n) - J[n]).normalized() for n in B if not B[n].get('end')}
    sm = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(min(1, max(0, (x - a) / (b - a))))
    def bone_of(label, y):
        m = SK['parts'][label]
        if isinstance(m, str): return m
        for bone, below in m:
            if y < below: return bone
        return m[-1][0]
    v, labels, out = p['vertices'], p.get('labels'), []
    for i in range(len(v) // 3):
        co = Vector((v[i * 3], v[i * 3 + 1], v[i * 3 + 2]))
        b = bone_of(labels[i] if labels else p['part'], co.y); w = {b: 1.0}
        pb = B[b].get('parent')
        if pb:
            R = B[b]['blend']; t = sm(-R, R, (co - J[b]).dot(D[b])); w[b] = t; w[pb] = w.get(pb, 0) + 1 - t
        for c in kids[b]:
            rel = co - J[c]; along = rel.dot(D[c]); perp = (rel - D[c] * along).length
            if perp > B[c]['reach']: continue
            t = 0.5 * math.exp(-(along / B[c]['blend']) ** 2); amt = w[b] * t; w[b] -= amt; w[c] = w.get(c, 0) + amt
        out.append(w)
    return out

objects = []
mat_tris = {}
for p in src['parts']: mat_tris[p['material']] = mat_tris.get(p['material'], 0) + len(p.get('indices') or p['vertices']) // 3
for p in src['parts']:
    v, idx = p['vertices'], p.get('indices') or list(range(len(p['vertices']) // 3))
    me = bpy.data.meshes.new(f"{model_id}_{p['part']}_{p['material']}")
    verts = [to_blender(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v), 3)]
    faces = [(idx[t], idx[t + 1], idx[t + 2]) for t in range(0, len(idx), 3)]
    me.from_pydata(verts, [], faces); me.validate(); me.update()
    ob = bpy.data.objects.new(me.name, me); bpy.context.collection.objects.link(ob)
    me.materials.append(material(p['material']))
    if SK:
        groups = {}
        for i, w in enumerate(part_weights(p)):
            for n, x in w.items():
                if x > 1e-4: (groups.get(n) or groups.setdefault(n, ob.vertex_groups.new(name=n))).add([i], x, 'REPLACE')
    # consistent outward normals, then decimate to the triangle budget
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges)  # the zero-area triangles at the lofts' poles
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if CFG.get('quads'):
        # the lofts are quad grids, triangulated by Spline: join them back into quads (clean rings for editing and subdivision)
        bmesh.ops.join_triangles(bm, faces=bm.faces, angle_face_threshold=math.radians(40), angle_shape_threshold=math.radians(40))
    bm.to_mesh(me); bm.free()
    target = CFG.get('triangles', {}).get(p['material'], CFG.get('triangles', {}).get('default'))
    # the material's triangle budget is shared by its pieces in proportion to their size
    if target and mat_tris[p['material']] > target:
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new('decimate', 'DECIMATE'); mod.ratio = target / mat_tris[p['material']]
        bpy.ops.object.modifier_apply(modifier=mod.name)
    me.validate(); me.update()
    for poly in me.polygons: poly.use_smooth = True
    objects.append((ob, p))

if 'skeleton' in CFG:
    S = CFG['skeleton']; bones = S['bones']
    arm_data = bpy.data.armatures.new(model_id + '_skeleton')
    rig = bpy.data.objects.new(model_id + '_rig', arm_data); bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
    pos = {n: to_blender(*b['at']) for n, b in bones.items()}
    children = {n: [c for c, b in bones.items() if b.get('parent') == n] for n in bones}
    prefer = ['spine', 'chest', 'neck', 'head', 'headEnd']
    eb = {}
    for n, b in bones.items():
        if b.get('end'): continue
        e = arm_data.edit_bones.new(n); e.head = pos[n]
        kids = children[n]
        tail = next((c for c in prefer if c in kids), None) or next((c for c in kids if bones[c].get('end')), None) or (kids[0] if kids else None)
        e.tail = pos[tail] if tail else pos[n] + Vector((0, 0, 0.05))
        eb[n] = e
    for n, e in eb.items():
        par = bones[n].get('parent')
        if par in eb: e.parent = eb[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob, p in objects:
        bpy.ops.object.select_all(action='DESELECT')
        mod = ob.modifiers.new('skin', 'ARMATURE'); mod.object = rig; ob.parent = rig
        # bone heat can leave a vertex unweighted: give those to the nearest bone
        groups = {g.index: g.name for g in ob.vertex_groups}
        unweighted = [v.index for v in ob.data.vertices if not any(g.weight > 1e-4 for g in v.groups)]
        if unweighted:
            segs = [(n, rig.matrix_world @ arm_data.bones[n].head_local, rig.matrix_world @ arm_data.bones[n].tail_local) for n in eb]
            for vi in unweighted:
                co = ob.matrix_world @ ob.data.vertices[vi].co
                def d(s):
                    a, b = s[1], s[2]; ab = b - a; t = max(0, min(1, (co - a).dot(ab) / max(ab.length_squared, 1e-9))); return (a + ab * t - co).length
                best = min(segs, key=d)[0]
                (ob.vertex_groups.get(best) or ob.vertex_groups.new(name=best)).add([vi], 1.0, 'REPLACE')
            print(f'{model_id}: {len(unweighted)} vertices had no bone heat weight; assigned to the nearest bone')

if out_blend:
    os.makedirs(os.path.dirname(os.path.abspath(out_blend)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out_blend), compress=True)
os.makedirs(os.path.dirname(out_glb), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_yup=True, export_apply=False, export_skins=True,
                          export_animations=False, export_morph=False, export_materials='EXPORT', export_extras=False)
tris = sum(len(ob.data.polygons) for ob, _ in objects)
print(f'{model_id}.glb written: {os.path.getsize(out_glb) // 1024} KB, {tris} triangles')
