// A minimal GLB/glTF 2.0 loader, written for Great Blox Heist in this
// recorded session. It loads exactly what the game's sixteen .glb files
// use — nothing more — straight from the format's own rules, with no
// downloaded code:
//   - a GLB file is a 12-byte header (magic 'glTF', version 2, total
//     length) followed by a JSON chunk and a binary (BIN) chunk, all
//     little-endian;
//   - the JSON chunk describes scenes, nodes (a 4x4 column-major matrix
//     or translation/rotation/scale), meshes (triangle primitives with
//     POSITION, NORMAL and TEXCOORD_0 attributes and a uint16 index),
//     materials (PBR metal/rough with a base colour factor or an
//     embedded PNG texture, an emissive factor, an alpha mode) and
//     embedded images;
//   - nodes build a THREE.Group tree and meshes become THREE.Mesh
//     objects with MeshStandardMaterial, so the game's cloning,
//     tinting, shadows and light-bar code keeps working unchanged.
// Only the vendored three.js (window.THREE) is used. Loading is async:
// loadGLB(url) resolves to the scene root once every embedded texture
// image has decoded, so the caller can await it like any other load.

const THREE = window.THREE;

// GLB chunk type ids ('JSON' and 'BIN\0' as little-endian words).
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

// glTF accessor component types, by their numeric id.
const COMPONENT = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const TYPE_COUNT = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16,
};

// glTF sampler enums to three.js constants.
const FILTER = {
  9728: THREE.NearestFilter,
  9729: THREE.LinearFilter,
  9984: THREE.NearestMipmapNearestFilter,
  9985: THREE.LinearMipmapNearestFilter,
  9986: THREE.NearestMipmapLinearFilter,
  9987: THREE.LinearMipmapLinearFilter,
};
const WRAP = {
  33071: THREE.ClampToEdgeWrapping,
  33648: THREE.MirroredRepeatWrapping,
  10497: THREE.RepeatWrapping,
};

export async function loadGLB(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GLB load failed (${response.status}): ${url}`);
  const data = await response.arrayBuffer();
  const view = new DataView(data);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error(`not a GLB file: ${url}`);
  if (view.getUint32(4, true) !== 2) throw new Error(`unsupported glTF version in ${url}`);

  // First chunk: the JSON description.
  let offset = 12;
  const jsonLength = view.getUint32(offset, true);
  const jsonType = view.getUint32(offset + 4, true);
  if (jsonType !== JSON_CHUNK) throw new Error(`GLB has no JSON chunk: ${url}`);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, offset + 8, jsonLength)));
  offset += 8 + jsonLength;

  // Second chunk: the binary buffer (present in every file this game uses).
  let bin = null;
  if (offset < data.byteLength) {
    const binLength = view.getUint32(offset, true);
    const binType = view.getUint32(offset + 4, true);
    if (binType === BIN_CHUNK) bin = new Uint8Array(data, offset + 8, binLength);
  }

  // One accessor's data as a typed array. A bufferView's byteStride is
  // honoured (interleaved data is unpacked element by element); without
  // a stride the data is already packed and the array is a direct view
  // on the BIN chunk.
  function accessorArray(index) {
    if (!bin) throw new Error(`GLB has no binary chunk: ${url}`);
    const acc = json.accessors[index];
    const bv = json.bufferViews[acc.bufferView];
    const ArrayType = COMPONENT[acc.componentType];
    const itemSize = TYPE_COUNT[acc.type];
    const elementBytes = ArrayType.BYTES_PER_ELEMENT * itemSize;
    const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = bv.byteStride || elementBytes;
    if (stride === elementBytes && start % ArrayType.BYTES_PER_ELEMENT === 0) {
      return new ArrayType(bin.buffer, bin.byteOffset + start, acc.count * itemSize);
    }
    const out = new ArrayType(acc.count * itemSize);
    for (let i = 0; i < acc.count; i += 1) {
      const src = new ArrayType(bin.buffer, bin.byteOffset + start + i * stride, itemSize);
      out.set(src, i * itemSize);
    }
    return out;
  }

  // Embedded texture images, cached per texture index. The image bytes
  // live in the BIN chunk in these files; a URI image is fetched
  // relative to the .glb instead.
  const textureCache = new Map();
  async function loadTexture(texIndex) {
    if (textureCache.has(texIndex)) return textureCache.get(texIndex);
    const texDef = (json.textures || [])[texIndex];
    const imgDef = (json.images || [])[texDef.source];
    const sampler = (json.samplers || [])[texDef.sampler || 0] || {};
    let bytes;
    let mime = imgDef.mimeType || 'image/png';
    if (imgDef.bufferView !== undefined) {
      const bv = json.bufferViews[imgDef.bufferView];
      bytes = new Uint8Array(bin.buffer, bin.byteOffset + (bv.byteOffset || 0), bv.byteLength);
    } else if (imgDef.uri) {
      const res = await fetch(new URL(imgDef.uri, url).href);
      if (!res.ok) throw new Error(`texture image failed to load: ${imgDef.uri}`);
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      throw new Error(`texture image has no data: ${url}`);
    }
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const img = new Image();
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`texture image failed to decode in ${url}`));
    });
    img.src = objectUrl;
    await loaded;
    URL.revokeObjectURL(objectUrl);
    const texture = new THREE.Texture(img);
    texture.encoding = THREE.sRGBEncoding;
    // glTF textures are top-left origin; three.js flips by default, so
    // the flip is turned off here to keep the UVs upright.
    texture.flipY = false;
    if (sampler.magFilter !== undefined) texture.magFilter = FILTER[sampler.magFilter] ?? THREE.LinearFilter;
    if (sampler.minFilter !== undefined) texture.minFilter = FILTER[sampler.minFilter] ?? THREE.LinearMipmapLinearFilter;
    if (sampler.wrapS !== undefined) texture.wrapS = WRAP[sampler.wrapS] ?? THREE.ClampToEdgeWrapping;
    if (sampler.wrapT !== undefined) texture.wrapT = WRAP[sampler.wrapT] ?? THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    textureCache.set(texIndex, texture);
    return texture;
  }

  // One glTF material as a MeshStandardMaterial. Colour and emissive
  // factors are stored as written in the file, metalness and roughness
  // come from the PBR block, a base colour texture replaces the flat
  // colour's map, and BLEND makes the material transparent at the
  // factor's alpha.
  async function buildMaterial(matIndex) {
    const def = (json.materials || [])[matIndex] || {};
    const pbr = def.pbrMetallicRoughness || {};
    const mat = new THREE.MeshStandardMaterial();
    if (pbr.baseColorFactor) {
      const f = pbr.baseColorFactor;
      mat.color.setRGB(f[0], f[1], f[2]);
      mat.opacity = f.length > 3 ? f[3] : 1;
    }
    mat.metalness = pbr.metallicFactor !== undefined ? pbr.metallicFactor : 1;
    mat.roughness = pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1;
    if (pbr.baseColorTexture) {
      mat.map = await loadTexture(pbr.baseColorTexture.index);
    }
    if (def.emissiveFactor) {
      const e = def.emissiveFactor;
      mat.emissive.setRGB(e[0], e[1], e[2]);
    }
    if (def.alphaMode === 'BLEND') mat.transparent = true;
    else if (def.alphaMode === 'MASK') mat.alphaTest = def.alphaCutoff !== undefined ? def.alphaCutoff : 0.5;
    if (def.doubleSided) mat.side = THREE.DoubleSide;
    return mat;
  }

  const materials = [];
  for (let i = 0; i < (json.materials || []).length; i += 1) {
    materials.push(await buildMaterial(i));
  }
  const defaultMaterial = new THREE.MeshStandardMaterial();

  // One mesh: a triangle primitive becomes a Mesh; a mesh with several
  // primitives becomes a Group holding one Mesh each.
  function buildMesh(meshDef) {
    const parts = meshDef.primitives.map((prim) => {
      if (prim.mode !== undefined && prim.mode !== 4) {
        throw new Error(`unsupported primitive mode in ${url} (only triangles)`);
      }
      const geo = new THREE.BufferGeometry();
      for (const [attr, accIndex] of Object.entries(prim.attributes)) {
        const name = attr === 'TEXCOORD_0' ? 'uv' : attr.toLowerCase();
        if (name !== 'position' && name !== 'normal' && name !== 'uv') continue;
        const array = accessorArray(accIndex);
        geo.setAttribute(name, new THREE.BufferAttribute(array, TYPE_COUNT[json.accessors[accIndex].type]));
      }
      if (prim.indices !== undefined) {
        geo.setIndex(new THREE.BufferAttribute(accessorArray(prim.indices), 1));
      }
      const material = prim.material !== undefined ? materials[prim.material] : defaultMaterial;
      return new THREE.Mesh(geo, material);
    });
    if (parts.length === 1) return parts[0];
    const group = new THREE.Group();
    for (const part of parts) group.add(part);
    return group;
  }

  // One node: a mesh node, or a plain Object3D for a grouping node.
  // A matrix is decomposed into position/quaternion/scale (never kept
  // as a frozen matrix, so the game can move clones by position and
  // rotation as before); TRS is read directly.
  function buildNode(nodeIndex) {
    const def = json.nodes[nodeIndex];
    let obj;
    if (def.mesh !== undefined) {
      obj = buildMesh(json.meshes[def.mesh]);
    } else {
      obj = new THREE.Object3D();
    }
    if (def.matrix) {
      obj.matrix.fromArray(def.matrix);
      obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    } else {
      if (def.translation) obj.position.fromArray(def.translation);
      if (def.rotation) obj.quaternion.fromArray(def.rotation);
      if (def.scale) obj.scale.fromArray(def.scale);
    }
    if (def.name !== undefined) obj.name = def.name;
    for (const child of def.children || []) obj.add(buildNode(child));
    return obj;
  }

  const sceneDef = (json.scenes || [])[json.scene || 0] || { nodes: [] };
  const root = new THREE.Group();
  for (const nodeIndex of sceneDef.nodes || []) root.add(buildNode(nodeIndex));
  return root;
}
