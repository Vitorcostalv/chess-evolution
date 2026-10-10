import * as THREE from "three";
import type { PieceSymbol } from "chess.js";

// All studio assets are procedural: no remote textures, HDRs or model requests.
function grain(size: number, dark: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave = Math.sin(y * 0.55 + Math.sin(x * 0.023) * 3);
      const fine = Math.sin(y * 2.4 + x * 0.11);
      const variation = wave * 1.8 + fine * 0.7;
      const base = dark ? [86, 56, 37] : [211, 190, 151];
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        pixels.data[offset + channel] = base[channel] + variation;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function chessMaterials(quality: "low" | "medium" | "high") {
  const segments = quality === "high" ? 64 : quality === "medium" ? 48 : 24;
  const base: [number, number][] = [
    [0, 0],
    [0.24, 0],
    [0.28, 0.025],
    [0.29, 0.065],
    [0.28, 0.105],
    [0.24, 0.13],
    [0.235, 0.17],
    [0.21, 0.19],
  ];
  const stems: Record<PieceSymbol, [number, number][]> = {
    p: [
      [0.16, 0.24],
      [0.115, 0.35],
      [0.105, 0.46],
      [0.15, 0.49],
      [0.16, 0.52],
      [0.1, 0.55],
      [0, 0.55],
    ],
    n: [
      [0.16, 0.24],
      [0.14, 0.3],
      [0, 0.3],
    ],
    r: [
      [0.17, 0.25],
      [0.155, 0.56],
      [0.22, 0.6],
      [0.25, 0.64],
      [0.25, 0.73],
      [0.18, 0.73],
      [0.18, 0.65],
      [0, 0.65],
    ],
    b: [
      [0.16, 0.25],
      [0.105, 0.43],
      [0.095, 0.61],
      [0.19, 0.65],
      [0.19, 0.69],
      [0.12, 0.72],
      [0, 0.72],
    ],
    q: [
      [0.16, 0.25],
      [0.115, 0.44],
      [0.11, 0.7],
      [0.2, 0.75],
      [0.22, 0.79],
      [0.16, 0.83],
      [0.23, 0.94],
      [0.18, 0.97],
      [0, 0.87],
    ],
    k: [
      [0.17, 0.25],
      [0.125, 0.45],
      [0.12, 0.76],
      [0.22, 0.8],
      [0.22, 0.84],
      [0.14, 0.88],
      [0.135, 0.93],
      [0, 0.93],
    ],
  };
  const geometries = Object.fromEntries(
    Object.entries(stems).map(([type, stem]) => {
      const curve = new THREE.CatmullRomCurve3(
        [...base, ...stem].map(([x, y]) => new THREE.Vector3(x, y, 0)),
        false,
        "centripetal",
      );
      const points = curve
        .getPoints(quality === "low" ? 64 : 128)
        .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
      return [type, new THREE.LatheGeometry(points, segments)];
    }),
  ) as Record<PieceSymbol, THREE.LatheGeometry>;

  const horse = new THREE.Shape();
  horse.moveTo(-0.17, 0);
  horse.bezierCurveTo(-0.26, 0.3, -0.25, 0.52, -0.12, 0.64);
  horse.lineTo(-0.105, 0.79);
  horse.quadraticCurveTo(-0.065, 0.81, -0.035, 0.69);
  horse.quadraticCurveTo(0.1, 0.66, 0.14, 0.54);
  horse.quadraticCurveTo(0.17, 0.49, 0.31, 0.42);
  horse.quadraticCurveTo(0.35, 0.34, 0.29, 0.3);
  horse.lineTo(0.17, 0.3);
  horse.quadraticCurveTo(0.08, 0.32, 0.055, 0.4);
  horse.quadraticCurveTo(0, 0.23, 0.13, 0);
  horse.closePath();
  const extrude = (shape: THREE.Shape, depth: number, bevel: number) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: quality === "low" ? 2 : 5,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: segments / 2,
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  };
  const knight = extrude(horse, 0.19, 0.04);

  // Two curved leaves leave a real diagonal opening in the bishop's mitre.
  const leaf = new THREE.Shape();
  leaf.moveTo(-0.025, 0);
  leaf.bezierCurveTo(-0.24, 0.075, -0.18, 0.22, -0.02, 0.36);
  leaf.quadraticCurveTo(0.035, 0.27, 0.07, 0.22);
  leaf.lineTo(-0.025, 0.07);
  leaf.closePath();
  const otherLeaf = new THREE.Shape();
  otherLeaf.moveTo(0.015, 0);
  otherLeaf.bezierCurveTo(0.21, 0.035, 0.22, 0.14, 0.105, 0.23);
  otherLeaf.lineTo(0.015, 0.06);
  otherLeaf.closePath();
  const bishop = [extrude(leaf, 0.14, 0.018), extrude(otherLeaf, 0.14, 0.018)];

  const crown = new THREE.Shape();
  crown.absarc(0, 0, 0.25, 0, Math.PI * 0.21, false);
  crown.lineTo(
    Math.cos(Math.PI * 0.21) * 0.175,
    Math.sin(Math.PI * 0.21) * 0.175,
  );
  crown.absarc(0, 0, 0.175, Math.PI * 0.21, 0, true);
  crown.closePath();
  const rook = extrude(crown, 0.12, 0.009);
  rook.rotateX(-Math.PI / 2);

  const crossShape = new THREE.Shape();
  const crossPoints = [
    [-0.045, 0],
    [0.045, 0],
    [0.045, 0.14],
    [0.14, 0.14],
    [0.14, 0.22],
    [0.045, 0.22],
    [0.045, 0.34],
    [-0.045, 0.34],
    [-0.045, 0.22],
    [-0.14, 0.22],
    [-0.14, 0.14],
    [-0.045, 0.14],
  ];
  crossPoints.forEach(([x, y], i) =>
    i ? crossShape.lineTo(x, y) : crossShape.moveTo(x, y),
  );
  crossShape.closePath();
  const cross = extrude(crossShape, 0.075, 0.012);
  const sphere = new THREE.SphereGeometry(1, segments, segments / 2);
  const ring = new THREE.TorusGeometry(0.275, 0.008, 8, segments);
  ring.rotateX(Math.PI / 2);
  const lightWood = grain(quality === "low" ? 128 : 256, false);
  const darkWood = grain(quality === "low" ? 128 : 256, true);
  const white = new THREE.MeshPhysicalMaterial({
    color: "#e0ccb0",
    roughness: 0.26,
    metalness: 0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.24,
  });
  const black = new THREE.MeshPhysicalMaterial({
    color: "#30373a",
    roughness: 0.27,
    metalness: 0.06,
    clearcoat: 0.4,
    clearcoatRoughness: 0.23,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: "#ae8850",
    metalness: 0.65,
    roughness: 0.32,
  });
  const lightTile = new THREE.MeshStandardMaterial({
    map: lightWood,
    roughness: 0.62,
  });
  const darkTile = new THREE.MeshStandardMaterial({
    map: darkWood,
    roughness: 0.56,
  });
  const frame = new THREE.MeshStandardMaterial({
    map: darkWood,
    color: "#a79786",
    roughness: 0.4,
  });
  const selected = new THREE.MeshStandardMaterial({
    color: "#bda671",
    roughness: 0.5,
  });
  const atlas = document.createElement("canvas");
  atlas.width = 1024;
  atlas.height = 64;
  const ctx = atlas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.font = "36px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  [..."ABCDEFGH12345678"].forEach((glyph, i) =>
    ctx.fillText(glyph, i * 64 + 32, 34),
  );
  const labelTexture = new THREE.CanvasTexture(atlas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const labelMaterial = new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true,
    color: "#c4a576",
    depthWrite: false,
  });
  const labels = Array.from({ length: 16 }, (_, i) => {
    const geometry = new THREE.PlaneGeometry(0.3, 0.3);
    const uv = geometry.getAttribute("uv");
    for (let v = 0; v < uv.count; v++) uv.setX(v, (uv.getX(v) + i) / 16);
    return geometry;
  });
  return {
    geometries,
    knight,
    bishop,
    rook,
    cross,
    sphere,
    ring,
    white,
    black,
    accent,
    lightTile,
    darkTile,
    frame,
    selected,
    labels,
    labelMaterial,
    dispose() {
      [
        ...Object.values(geometries),
        knight,
        ...bishop,
        rook,
        cross,
        sphere,
        ring,
      ].forEach((g) => g.dispose());
      [white, black, accent, lightTile, darkTile, frame, selected].forEach(
        (m) => m.dispose(),
      );
      lightWood.dispose();
      darkWood.dispose();
      labels.forEach((g) => g.dispose());
      labelMaterial.dispose();
      labelTexture.dispose();
    },
  };
}
