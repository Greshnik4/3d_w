import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

/* ───────── helpers ───────── */
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h &= h; }
  return Math.abs(h);
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function smoothstep(t: number) { return t * t * (3 - 2 * t); }

/* ───────── object generators ───────── */
type TriData = { pos: number[]; col: number[] };

function pushTri(p: number[], c: number[], x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, x3: number, y3: number, z3: number, r: number, g: number, b: number) {
  p.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
  c.push(r, g, b, r, g, b, r, g, b);
}

function pushQuad(p: number[], c: number[], x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, x3: number, y3: number, z3: number, x4: number, y4: number, z4: number, r: number, g: number, b: number) {
  pushTri(p, c, x1, y1, z1, x2, y2, z2, x3, y3, z3, r, g, b);
  pushTri(p, c, x1, y1, z1, x3, y3, z3, x4, y4, z4, r, g, b);
}

function genTree(rng: () => number): TriData {
  const p: number[] = [], c: number[] = [];
  const h = 1.8 + rng() * 1.0;
  const tr = 0.12;
  const seg = 5;
  const br = 0.35 + rng() * 0.1, bg = 0.22, bb = 0.08;
  for (let i = 0; i < seg; i++) {
    const a1 = (i / seg) * Math.PI * 2, a2 = ((i + 1) / seg) * Math.PI * 2;
    const x1 = Math.cos(a1) * tr, z1 = Math.sin(a1) * tr;
    const x2 = Math.cos(a2) * tr, z2 = Math.sin(a2) * tr;
    pushQuad(p, c, x1, 0, z1, x2, 0, z2, x2, h, z2, x1, h, z1, br, bg, bb);
  }
  // crown - layered cones
  const layers = 2 + Math.floor(rng() * 2);
  for (let l = 0; l < layers; l++) {
    const cy = h * 0.5 + l * 0.6;
    const cr = 1.0 - l * 0.25 + rng() * 0.2;
    const ch = 0.9 + rng() * 0.3;
    const cSeg = 7;
    const gr = 0.1 + rng() * 0.15, gg = 0.45 + rng() * 0.35, gb = 0.08 + rng() * 0.1;
    for (let i = 0; i < cSeg; i++) {
      const a1 = (i / cSeg) * Math.PI * 2, a2 = ((i + 1) / cSeg) * Math.PI * 2;
      pushTri(p, c, 0, cy + ch, 0, Math.cos(a1) * cr, cy, Math.sin(a1) * cr, Math.cos(a2) * cr, cy, Math.sin(a2) * cr, gr, gg, gb);
    }
  }
  return { pos: p, col: c };
}

function genHouse(rng: () => number): TriData {
  const p: number[] = [], c: number[] = [];
  const w = 2 + rng(), h = 1.5 + rng() * 0.5, d = 2 + rng();
  const wr = 0.85 + rng() * 0.1, wg = 0.78 + rng() * 0.1, wb = 0.65;
  // walls
  pushQuad(p, c, -w/2, 0, d/2, w/2, 0, d/2, w/2, h, d/2, -w/2, h, d/2, wr, wg, wb);
  pushQuad(p, c, w/2, 0, -d/2, -w/2, 0, -d/2, -w/2, h, -d/2, w/2, h, -d/2, wr * 0.9, wg * 0.9, wb * 0.9);
  pushQuad(p, c, -w/2, 0, -d/2, -w/2, 0, d/2, -w/2, h, d/2, -w/2, h, -d/2, wr * 0.95, wg * 0.95, wb * 0.95);
  pushQuad(p, c, w/2, 0, d/2, w/2, 0, -d/2, w/2, h, -d/2, w/2, h, d/2, wr * 0.95, wg * 0.95, wb * 0.95);
  // roof
  const rr = 0.55 + rng() * 0.25, rg = 0.18, rb = 0.08;
  const rh = 1.0;
  pushTri(p, c, -w/2 - 0.3, h, d/2 + 0.3, w/2 + 0.3, h, d/2 + 0.3, 0, h + rh, 0, rr, rg, rb);
  pushTri(p, c, w/2 + 0.3, h, -d/2 - 0.3, -w/2 - 0.3, h, -d/2 - 0.3, 0, h + rh, 0, rr * 0.9, rg, rb);
  pushQuad(p, c, -w/2 - 0.3, h, -d/2 - 0.3, -w/2 - 0.3, h, d/2 + 0.3, 0, h + rh, 0, 0, h + rh, 0, rr * 0.85, rg, rb);
  pushQuad(p, c, w/2 + 0.3, h, d/2 + 0.3, w/2 + 0.3, h, -d/2 - 0.3, 0, h + rh, 0, 0, h + rh, 0, rr * 0.85, rg, rb);
  // door
  pushQuad(p, c, -0.3, 0, d/2 + 0.01, 0.3, 0, d/2 + 0.01, 0.3, 1.0, d/2 + 0.01, -0.3, 1.0, d/2 + 0.01, 0.35, 0.2, 0.1);
  // window
  pushQuad(p, c, w/4, h * 0.5, d/2 + 0.01, w/4 + 0.4, h * 0.5, d/2 + 0.01, w/4 + 0.4, h * 0.5 + 0.4, d/2 + 0.01, w/4, h * 0.5 + 0.4, d/2 + 0.01, 0.6, 0.8, 0.95);
  return { pos: p, col: c };
}

function genAnimal(rng: () => number): TriData {
  const p: number[] = [], c: number[] = [];
  const bw = 0.35, bh = 0.3, bl = 0.7;
  const legH = 0.4;
  const bodyR = 0.5 + rng() * 0.3, bodyG = 0.35 + rng() * 0.2, bodyB = 0.15 + rng() * 0.15;
  const by = legH + bh / 2;
  // body box
  pushQuad(p, c, -bw/2, by - bh/2, bl/2, bw/2, by - bh/2, bl/2, bw/2, by + bh/2, bl/2, -bw/2, by + bh/2, bl/2, bodyR, bodyG, bodyB);
  pushQuad(p, c, bw/2, by - bh/2, -bl/2, -bw/2, by - bh/2, -bl/2, -bw/2, by + bh/2, -bl/2, bw/2, by + bh/2, -bl/2, bodyR, bodyG, bodyB);
  pushQuad(p, c, -bw/2, by + bh/2, -bl/2, -bw/2, by + bh/2, bl/2, bw/2, by + bh/2, bl/2, bw/2, by + bh/2, -bl/2, bodyR * 1.05, bodyG * 1.05, bodyB * 1.05);
  // legs
  const lr = 0.04;
  const legR = bodyR * 0.7, legG = bodyG * 0.7, legB = bodyB * 0.7;
  const legPositions: [number, number][] = [[-bw/3, bl/3], [bw/3, bl/3], [-bw/3, -bl/3], [bw/3, -bl/3]];
  for (const [lx, lz] of legPositions) {
    pushQuad(p, c, lx - lr, 0, lz - lr, lx + lr, 0, lz - lr, lx + lr, legH, lz + lr, lx - lr, legH, lz + lr, legR, legG, legB);
    pushQuad(p, c, lx + lr, 0, lz - lr, lx - lr, 0, lz - lr, lx - lr, legH, lz - lr, lx + lr, legH, lz - lr, legR, legG, legB);
  }
  // head
  const hs = 0.18;
  const hx = 0, hy = by + 0.05, hz = bl/2 + hs;
  pushQuad(p, c, hx - hs/2, hy - hs/2, hz - hs/2, hx + hs/2, hy - hs/2, hz - hs/2, hx + hs/2, hy + hs/2, hz + hs/2, hx - hs/2, hy + hs/2, hz + hs/2, bodyR * 0.9, bodyG * 0.9, bodyB * 0.9);
  pushQuad(p, c, hx + hs/2, hy - hs/2, hz - hs/2, hx - hs/2, hy - hs/2, hz - hs/2, hx - hs/2, hy + hs/2, hz + hs/2, hx + hs/2, hy + hs/2, hz + hs/2, bodyR * 0.85, bodyG * 0.85, bodyB * 0.85);
  // ears
  pushTri(p, c, hx - 0.06, hy + hs/2, hz, hx + 0.06, hy + hs/2, hz, 0, hy + hs/2 + 0.1, hz, bodyR * 0.8, bodyG * 0.8, bodyB * 0.8);
  return { pos: p, col: c };
}

function genRock(rng: () => number): TriData {
  const p: number[] = [], c: number[] = [];
  const r = 0.4 + rng() * 0.5;
  const n = 10 + Math.floor(rng() * 6);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / n);
    const th = Math.PI * (1 + Math.sqrt(5)) * i + rng() * 0.5;
    const rr = r * (0.6 + rng() * 0.8);
    pts.push([Math.sin(phi) * Math.cos(th) * rr, Math.abs(Math.cos(phi) * rr * 0.5) + r * 0.2, Math.sin(phi) * Math.sin(th) * rr]);
  }
  const gr = 0.4 + rng() * 0.2, gg = 0.38 + rng() * 0.15, gb = 0.33 + rng() * 0.12;
  for (let i = 1; i < pts.length - 1; i++) {
    pushTri(p, c, pts[0][0], pts[0][1], pts[0][2], pts[i][0], pts[i][1], pts[i][2], pts[i+1][0], pts[i+1][1], pts[i+1][2], gr + (rng() - 0.5) * 0.1, gg + (rng() - 0.5) * 0.08, gb + (rng() - 0.5) * 0.06);
  }
  return { pos: p, col: c };
}

function genPerson(rng: () => number): TriData {
  const p: number[] = [], c: number[] = [];
  const skR = 0.92, skG = 0.77, skB = 0.62;
  const shR = 0.15 + rng() * 0.6, shG = 0.2 + rng() * 0.5, shB = 0.4 + rng() * 0.5;
  const paR = 0.15 + rng() * 0.15, paG = 0.15 + rng() * 0.15, paB = 0.3 + rng() * 0.3;
  // head
  const hr = 0.12;
  for (let i = 0; i < 6; i++) {
    const a1 = (i / 6) * Math.PI * 2, a2 = ((i + 1) / 6) * Math.PI * 2;
    pushTri(p, c, 0, 1.65 + hr, 0, Math.cos(a1) * hr, 1.65, Math.sin(a1) * hr, Math.cos(a2) * hr, 1.65, Math.sin(a2) * hr, skR, skG, skB);
    pushTri(p, c, 0, 1.65 - hr, 0, Math.cos(a2) * hr, 1.65, Math.sin(a2) * hr, Math.cos(a1) * hr, 1.65, Math.sin(a1) * hr, skR, skG, skB);
  }
  // torso
  const tw = 0.18, th = 0.5;
  pushQuad(p, c, -tw, 1.0, -0.06, tw, 1.0, -0.06, tw, 1.0 + th, 0.06, -tw, 1.0 + th, 0.06, shR, shG, shB);
  pushQuad(p, c, tw, 1.0, -0.06, -tw, 1.0, -0.06, -tw, 1.0 + th, -0.06, tw, 1.0 + th, -0.06, shR, shG, shB);
  pushQuad(p, c, -tw, 1.0, -0.06, -tw, 1.0, 0.06, -tw, 1.0 + th, 0.06, -tw, 1.0 + th, -0.06, shR, shG, shB);
  pushQuad(p, c, tw, 1.0, 0.06, tw, 1.0, -0.06, tw, 1.0 + th, -0.06, tw, 1.0 + th, 0.06, shR, shG, shB);
  // legs
  for (const s of [-1, 1]) {
    const lx = s * 0.08;
    pushQuad(p, c, lx - 0.05, 0, -0.04, lx + 0.05, 0, -0.04, lx + 0.05, 1.0, 0.04, lx - 0.05, 1.0, 0.04, paR, paG, paB);
    pushQuad(p, c, lx + 0.05, 0, -0.04, lx - 0.05, 0, -0.04, lx - 0.05, 1.0, -0.04, lx + 0.05, 1.0, -0.04, paR, paG, paB);
  }
  // arms
  for (const s of [-1, 1]) {
    const ax = s * 0.28;
    pushQuad(p, c, ax - 0.04, 1.0, -0.03, ax + 0.04, 1.0, -0.03, ax + 0.04, 1.45, 0.03, ax - 0.04, 1.45, 0.03, shR, shG, shB);
  }
  return { pos: p, col: c };
}

function genFlower(rng: () => number): TriData {
  const p: number[] = [], c: number[] = [];
  // stem
  pushQuad(p, c, -0.02, 0, 0, 0.02, 0, 0, 0.02, 0.4, 0, -0.02, 0.4, 0, 0.15, 0.5, 0.1);
  // petals
  const petalR = 0.12 + rng() * 0.08;
  const ptR = 0.8 + rng() * 0.2, ptG = 0.2 + rng() * 0.6, ptB = 0.3 + rng() * 0.5;
  const nPetals = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < nPetals; i++) {
    const a = (i / nPetals) * Math.PI * 2;
    const px = Math.cos(a) * petalR;
    const pz = Math.sin(a) * petalR;
    const a2 = ((i + 0.5) / nPetals) * Math.PI * 2;
    const px2 = Math.cos(a2) * petalR * 0.5;
    const pz2 = Math.sin(a2) * petalR * 0.5;
    pushTri(p, c, 0, 0.45, 0, px, 0.4, pz, px2, 0.48, pz2, ptR, ptG, ptB);
  }
  // center
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const a2 = ((i + 1) / 4) * Math.PI * 2;
    pushTri(p, c, 0, 0.45, 0, Math.cos(a) * 0.05, 0.42, Math.sin(a) * 0.05, Math.cos(a2) * 0.05, 0.42, Math.sin(a2) * 0.05, 1.0, 0.85, 0.1);
  }
  return { pos: p, col: c };
}

/* ───────── constants ───────── */
const WORLD_R = 50;
const CELL = 7;
const VIEW_DIST = 28;
const MAX_OBJECTS = 180;

/* ───────── types ───────── */
interface PolyObj {
  mesh: THREE.Mesh;
  homePos: Float32Array;
  objPos: Float32Array;
  offset: THREE.Vector3;
  blend: number;
  targetBlend: number;
  active: boolean;
  cellKey: string;
  typeName: string;
}

interface Cell {
  key: string;
  cx: number;
  cz: number;
  obj: PolyObj | null;
}

/* ───────── main component ───────── */
function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  const init = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    /* renderer */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    /* scene */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x78b8e0);
    scene.fog = new THREE.FogExp2(0x88c4e8, 0.012);

    /* camera */
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);

    /* lights */
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
    sun.position.set(20, 40, 15);
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x446633, 0.4);
    scene.add(hemi);

    /* world sphere (inside-out) */
    const sphereGeo = new THREE.IcosahedronGeometry(WORLD_R, 5);
    const sPos = sphereGeo.attributes.position;
    const sCol = new Float32Array(sPos.count * 3);
    for (let i = 0; i < sPos.count; i++) {
      const y = sPos.getY(i);
      const ny = (y / WORLD_R + 1) / 2; // 0 bottom, 1 top
      if (ny > 0.55) {
        // sky
        const t = (ny - 0.55) / 0.45;
        sCol[i * 3] = lerp(0.55, 0.35, t);
        sCol[i * 3 + 1] = lerp(0.75, 0.55, t);
        sCol[i * 3 + 2] = lerp(0.95, 0.95, t);
      } else if (ny > 0.48) {
        // horizon glow
        sCol[i * 3] = 0.75; sCol[i * 3 + 1] = 0.88; sCol[i * 3 + 2] = 0.7;
      } else {
        // ground
        const t = ny / 0.48;
        sCol[i * 3] = lerp(0.18, 0.3, t);
        sCol[i * 3 + 1] = lerp(0.35, 0.55, t);
        sCol[i * 3 + 2] = lerp(0.1, 0.15, t);
      }
    }
    sphereGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    const sphereMat = new THREE.MeshLambertMaterial({ side: THREE.BackSide, vertexColors: true });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    /* ground disc */
    const groundGeo = new THREE.CircleGeometry(WORLD_R * 0.92, 64);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    /* sun - bright sphere near top of world */
    const sunGeo = new THREE.SphereGeometry(3, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(15, WORLD_R * 0.85, -10);
    scene.add(sunMesh);
    // sun glow
    const glowGeo = new THREE.SphereGeometry(5, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.3 });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.copy(sunMesh.position);
    scene.add(glowMesh);

    // clouds will be added after seed declaration

    /* state */
    const playerPos = new THREE.Vector3(0, 1.7, 0);
    let yaw = 0, pitch = 0;
    const keys = new Set<string>();
    let isLocked = false;
    const seed = Math.floor(Math.random() * 999999);

    /* clouds - white patches on upper sphere */
    const cloudGroup = new THREE.Group();
    const cloudRng = seededRandom(seed + 42);
    for (let i = 0; i < 20; i++) {
      const cTheta = cloudRng() * Math.PI * 2;
      const cPhi = Math.acos(0.3 + cloudRng() * 0.5);
      const cr = WORLD_R - 2;
      const ccx = Math.sin(cPhi) * Math.cos(cTheta) * cr;
      const ccy = Math.cos(cPhi) * cr;
      const ccz = Math.sin(cPhi) * Math.sin(cTheta) * cr;
      const cloudSize = 2 + cloudRng() * 4;
      const cloudGeo = new THREE.PlaneGeometry(cloudSize, cloudSize * 0.5);
      const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 + cloudRng() * 0.3, side: THREE.DoubleSide });
      const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      cloudMesh.position.set(ccx, ccy, ccz);
      cloudMesh.lookAt(0, 0, 0);
      cloudGroup.add(cloudMesh);
    }
    scene.add(cloudGroup);

    const cells = new Map<string, Cell>();
    const polyPool: PolyObj[] = [];
    const clock = new THREE.Clock();

    /* create polygon pool */
    const generators: ((rng: () => number) => TriData)[] = [genTree, genHouse, genAnimal, genRock, genPerson, genFlower, genTree, genRock, genTree, genFlower];
    const typeNames = ['tree', 'house', 'animal', 'rock', 'person', 'flower', 'tree', 'rock', 'tree', 'flower'];

    for (let i = 0; i < MAX_OBJECTS; i++) {
      const gi = i % generators.length;
      const rng = seededRandom(seed + i * 137);
      const data = generators[gi](rng);
      const nv = data.pos.length / 3;
      if (nv < 3) continue;

      const geo = new THREE.BufferGeometry();
      const posArr = new Float32Array(data.pos);
      const colArr = new Float32Array(data.pos.length);
      for (let j = 0; j < data.col.length && j < colArr.length; j++) colArr[j] = data.col[j];
      for (let j = data.col.length; j < colArr.length; j++) colArr[j] = 0.5;

      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: new THREE.Color(0, 0, 0), transparent: true, opacity: 1.0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);

      // home positions on sphere surface
      const homePos = new Float32Array(data.pos.length);
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const sr = WORLD_R - 1;
      const cx = Math.sin(phi) * Math.cos(theta) * sr;
      const cy = Math.cos(phi) * sr;
      const cz = Math.sin(phi) * Math.sin(theta) * sr;
      const normal = new THREE.Vector3(cx, cy, cz).normalize();
      const upVec = Math.abs(normal.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const rightVec = new THREE.Vector3().crossVectors(upVec, normal).normalize();
      const fwdVec = new THREE.Vector3().crossVectors(normal, rightVec).normalize();
      const patchR = 1.2 + rng() * 0.8;
      for (let v = 0; v < nv; v++) {
        const lx = (rng() - 0.5) * patchR * 2;
        const ly = (rng() - 0.5) * patchR * 2;
        homePos[v * 3] = cx + rightVec.x * lx + fwdVec.x * ly;
        homePos[v * 3 + 1] = cy + rightVec.y * lx + fwdVec.y * ly;
        homePos[v * 3 + 2] = cz + rightVec.z * lx + fwdVec.z * ly;
      }

      // Set initial positions to home (on sphere)
      const initPosAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const initArr = initPosAttr.array as Float32Array;
      for (let j = 0; j < initArr.length; j++) initArr[j] = homePos[j];
      initPosAttr.needsUpdate = true;

      polyPool.push({
        mesh,
        homePos,
        objPos: new Float32Array(data.pos),
        offset: new THREE.Vector3(cx, cy, cz),
        blend: 0,
        targetBlend: 0,
        active: false,
        cellKey: '',
        typeName: typeNames[gi],
      });
    }

    /* cell management */
    function cellKey(x: number, z: number) { return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`; }

    function getCellType(key: string): string {
      const r = seededRandom(hashCode(key + seed));
      const types = ['tree', 'tree', 'tree', 'rock', 'house', 'animal', 'person', 'flower', 'tree', 'flower', 'rock', 'tree', 'animal', 'tree'];
      return types[Math.floor(r() * types.length)];
    }

    function updateCells() {
      const pcx = Math.floor(playerPos.x / CELL);
      const pcz = Math.floor(playerPos.z / CELL);
      const vr = Math.ceil(VIEW_DIST / CELL);
      const activeKeys = new Set<string>();

      for (let dx = -vr; dx <= vr; dx++) {
        for (let dz = -vr; dz <= vr; dz++) {
          const dist = Math.sqrt(dx * dx + dz * dz) * CELL;
          if (dist > VIEW_DIST) continue;
          const cx = (pcx + dx) * CELL + CELL / 2;
          const cz = (pcz + dz) * CELL + CELL / 2;
          const k = cellKey(cx, cz);
          activeKeys.add(k);

          if (!cells.has(k)) {
            const objType = getCellType(k);
            const cell: Cell = { key: k, cx, cz, obj: null };

            // find matching polygon
            const avail = polyPool.find(p => !p.active && p.typeName === objType);
            if (avail) {
              avail.active = true;
              avail.targetBlend = 1;
              avail.cellKey = k;
              const cellRng = seededRandom(hashCode(k + seed + 'offset'));
              const ox = (cellRng() - 0.5) * CELL * 0.5;
              const oz = (cellRng() - 0.5) * CELL * 0.5;
              avail.offset.set(cx + ox, 0, cz + oz);
              cell.obj = avail;
            }
            cells.set(k, cell);
          }
        }
      }

      // deactivate far cells
      for (const [k, cell] of cells) {
        if (!activeKeys.has(k)) {
          if (cell.obj) {
            cell.obj.targetBlend = 0;
            cell.obj.active = false;
            cell.obj = null;
          }
          cells.delete(k);
        }
      }
    }

    /* input */
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked) return;
      yaw -= e.movementX * 0.002;
      pitch -= e.movementY * 0.002;
      pitch = Math.max(-1.4, Math.min(1.4, pitch));
    };
    const onClick = () => renderer.domElement.requestPointerLock();
    const onPLChange = () => { isLocked = document.pointerLockElement === renderer.domElement; };
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onPLChange);
    window.addEventListener('resize', onResize);

    /* animation */
    let raf: number;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      // movement
      const speed = 7;
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const rgt = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const mv = new THREE.Vector3();
      if (keys.has('KeyW') || keys.has('ArrowUp')) mv.add(fwd);
      if (keys.has('KeyS') || keys.has('ArrowDown')) mv.sub(fwd);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mv.sub(rgt);
      if (keys.has('KeyD') || keys.has('ArrowRight')) mv.add(rgt);
      if (mv.lengthSq() > 0) { mv.normalize().multiplyScalar(speed * dt); playerPos.add(mv); }

      // constrain to sphere
      const d = playerPos.length();
      if (d > WORLD_R - 4) playerPos.normalize().multiplyScalar(WORLD_R - 4);
      playerPos.y = 1.7;

      // camera
      camera.position.copy(playerPos);
      const look = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
      );
      camera.lookAt(playerPos.clone().add(look));

      // cells
      updateCells();

      // animate clouds slowly
      cloudGroup.rotation.y += dt * 0.01;

      // animate polygons
      const blendSpeed = 3;
      for (const poly of polyPool) {
        if (Math.abs(poly.blend - poly.targetBlend) > 0.001) {
          poly.blend += (poly.targetBlend - poly.blend) * blendSpeed * dt * 4;
          poly.blend = Math.max(0, Math.min(1, poly.blend));
        }

        // All polygons visible - on sphere or forming objects
        poly.mesh.visible = true;

        // Only update geometry when actively blending
        const isAnimating = Math.abs(poly.blend - poly.targetBlend) > 0.001;
        if (!isAnimating && poly.blend === 0) {
          // Ensure material is normal when resting
          const mat = poly.mesh.material as THREE.MeshLambertMaterial;
          if (mat.emissive && mat.emissive.r > 0) {
            mat.emissive.setRGB(0, 0, 0);
          }
          continue;
        }
        
        // Glow and transparency effect during transition
        const mat = poly.mesh.material as THREE.MeshLambertMaterial;
        if (isAnimating && poly.blend > 0.02 && poly.blend < 0.98) {
          const glowIntensity = Math.sin(poly.blend * Math.PI) * 0.4;
          mat.emissive.setRGB(glowIntensity, glowIntensity * 0.8, glowIntensity * 0.3);
          // Slight transparency during mid-transition for ethereal effect
          mat.opacity = 0.7 + Math.sin(poly.blend * Math.PI) * 0.3;
        } else {
          mat.emissive.setRGB(0, 0, 0);
          mat.opacity = 1.0;
        }

        const t = smoothstep(poly.blend);
        const posAttr = poly.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const nv = arr.length / 3;

        for (let v = 0; v < nv; v++) {
          const idx = v * 3;
          arr[idx] = lerp(poly.homePos[idx], poly.objPos[idx] + poly.offset.x, t);
          arr[idx + 1] = lerp(poly.homePos[idx + 1], poly.objPos[idx + 1] + poly.offset.y, t);
          arr[idx + 2] = lerp(poly.homePos[idx + 2], poly.objPos[idx + 2] + poly.offset.z, t);
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onPLChange);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, [init]);

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      <div ref={containerRef} className="w-full h-full" />
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-2 h-2 border border-white/60 rounded-full" />
      </div>
      {/* HUD */}
      <div className="absolute top-4 left-4 text-white/90 bg-black/50 backdrop-blur-sm px-5 py-4 rounded-xl font-mono text-sm select-none pointer-events-none border border-white/10">
        <h1 className="text-xl font-bold mb-2 flex items-center gap-2">🌍 Polygon World</h1>
        <p className="text-xs opacity-90 mb-1">🖱️ Click to enter • <span className="text-emerald-300">WASD</span> to move • <span className="text-emerald-300">Mouse</span> to look</p>
        <p className="text-xs opacity-50 mt-2 italic">A world made from one closed surface</p>
        <p className="text-xs opacity-50">Polygons flow from the sphere to build everything you see</p>
      </div>
      {/* Bottom info */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full font-mono text-xs select-none pointer-events-none">
        <span>🔵 You are inside a sphere • 🟢 Everything is made of the same polygons</span>
      </div>
    </div>
  );
}

export default App;
