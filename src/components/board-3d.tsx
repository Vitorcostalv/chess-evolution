"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { pieceInstances } from "@/services/games/pieces";
import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import * as THREE from "three";
const profiles: Record<PieceSymbol, [number, number][]> = {
  p: [
    [0.25, 0],
    [0.28, 0.06],
    [0.22, 0.13],
    [0.13, 0.2],
    [0.11, 0.46],
    [0.19, 0.5],
    [0.18, 0.55],
    [0.1, 0.58],
  ],
  r: [
    [0.28, 0],
    [0.3, 0.08],
    [0.23, 0.15],
    [0.16, 0.25],
    [0.16, 0.57],
    [0.25, 0.62],
    [0.25, 0.73],
  ],
  n: [
    [0.28, 0],
    [0.3, 0.08],
    [0.22, 0.17],
    [0.16, 0.24],
  ],
  b: [
    [0.28, 0],
    [0.3, 0.07],
    [0.22, 0.16],
    [0.12, 0.3],
    [0.1, 0.58],
    [0.21, 0.64],
    [0.1, 0.71],
  ],
  q: [
    [0.3, 0],
    [0.32, 0.08],
    [0.24, 0.18],
    [0.12, 0.3],
    [0.14, 0.68],
    [0.22, 0.76],
    [0.24, 0.84],
    [0.18, 0.87],
  ],
  k: [
    [0.3, 0],
    [0.32, 0.08],
    [0.25, 0.18],
    [0.14, 0.33],
    [0.15, 0.72],
    [0.24, 0.79],
    [0.19, 0.85],
  ],
};
function resources(segments: number) {
  const geometries = Object.fromEntries(
    Object.entries(profiles).map(([type, points]) => [
      type,
      new THREE.LatheGeometry(
        points.map(([x, y]) => new THREE.Vector2(x, y)),
        segments,
      ),
    ]),
  ) as Record<PieceSymbol, THREE.LatheGeometry>;
  const shape = new THREE.Shape();
  shape.moveTo(-0.2, 0);
  shape.lineTo(-0.16, 0.5);
  shape.lineTo(-0.05, 0.76);
  shape.lineTo(0.05, 0.7);
  shape.lineTo(0.14, 0.5);
  shape.lineTo(0.3, 0.35);
  shape.lineTo(0.29, 0.24);
  shape.lineTo(0.12, 0.23);
  shape.lineTo(0.02, 0.31);
  shape.lineTo(0.02, 0.08);
  shape.closePath();
  const knight = new THREE.ExtrudeGeometry(shape, {
    depth: 0.19,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  knight.translate(0, 0, -0.095);
  return {
    geometries,
    knight,
    white: new THREE.MeshStandardMaterial({
      color: "#e4dccb",
      roughness: 0.34,
      metalness: 0.08,
    }),
    black: new THREE.MeshStandardMaterial({
      color: "#262f32",
      roughness: 0.3,
      metalness: 0.42,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: "#b19770",
      roughness: 0.3,
      metalness: 0.65,
    }),
  };
}
type Props = {
  initialFen: string;
  pgn: string;
  fen: string;
  selected: Square | null;
  legal: Square[];
  onSelect: (square: Square) => void;
  flipped: boolean;
  top: boolean;
  graphics: "low" | "medium" | "high";
};
function Piece({
  type,
  color,
  x,
  z,
  assets,
  reduce,
  onSelect,
}: {
  type: PieceSymbol;
  color: Color;
  x: number;
  z: number;
  assets: ReturnType<typeof resources>;
  reduce: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<THREE.Group>(null),
    material = color === "w" ? assets.white : assets.black;
  const invalidate = useThree((s) => s.invalidate);
  const [origin] = useState<[number, number, number]>(() => [x, 0.12, z]);
  const target = useMemo(() => new THREE.Vector3(x, 0.12, z), [x, z]);
  useEffect(() => invalidate(), [invalidate, x, z]);
  useFrame((_, delta) => {
    if (!ref.current) return;
    if (reduce) ref.current.position.copy(target);
    else
      ref.current.position.lerp(
        target,
        1 - Math.exp(-Math.min(delta, 0.05) * 12),
      );
    if (ref.current.position.distanceTo(target) > 0.001) invalidate();
  });
  return (
    <group
      ref={ref}
      position={origin}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh
        geometry={assets.geometries[type]}
        material={material}
        castShadow
        receiveShadow
      />
      {type === "p" && (
        <mesh position={[0, 0.67, 0]} material={material} castShadow>
          <sphereGeometry args={[0.18, 20, 12]} />
        </mesh>
      )}
      {type === "n" && (
        <group rotation={[0, color === "w" ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <mesh
            geometry={assets.knight}
            position={[0, 0.23, 0]}
            material={material}
            castShadow
          />
          <mesh position={[-0.055, 0.76, 0.11]} material={assets.accent}>
            <sphereGeometry args={[0.023, 8, 6]} />
          </mesh>
        </group>
      )}
      {type === "b" && (
        <mesh
          position={[0, 0.8, 0]}
          scale={[0.65, 1, 0.65]}
          rotation={[0, 0, -0.18]}
          material={material}
          castShadow
        >
          <sphereGeometry args={[0.18, 16, 12]} />
        </mesh>
      )}
      {type === "r" &&
        Array.from({ length: 6 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i * Math.PI) / 3) * 0.19,
              0.78,
              Math.sin((i * Math.PI) / 3) * 0.19,
            ]}
            rotation={[0, (-i * Math.PI) / 3, 0]}
            material={material}
            castShadow
          >
            <boxGeometry args={[0.14, 0.16, 0.12]} />
          </mesh>
        ))}
      {type === "q" &&
        Array.from({ length: 8 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i * Math.PI) / 4) * 0.19,
              0.93,
              Math.sin((i * Math.PI) / 4) * 0.19,
            ]}
            material={assets.accent}
            castShadow
          >
            <sphereGeometry args={[0.055, 10, 8]} />
          </mesh>
        ))}
      {type === "k" && (
        <group position={[0, 1.02, 0]}>
          <mesh material={material} castShadow>
            <boxGeometry args={[0.085, 0.36, 0.085]} />
          </mesh>
          <mesh material={material} castShadow>
            <boxGeometry args={[0.25, 0.08, 0.085]} />
          </mesh>
        </group>
      )}
      <mesh position={[0, 0.09, 0]} material={assets.accent}>
        <torusGeometry args={[0.265, 0.012, 6, 24]} />
      </mesh>
    </group>
  );
}
function Scene(props: Props) {
  const assets = useMemo(
    () => resources(props.graphics === "low" ? 16 : 32),
    [props.graphics],
  );
  useEffect(
    () => () => {
      Object.values(assets.geometries).forEach((g) => g.dispose());
      assets.knight.dispose();
      assets.white.dispose();
      assets.black.dispose();
      assets.accent.dispose();
    },
    [assets],
  );
  const { camera, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(
      props.top ? 0.001 : props.flipped ? -9 : 9,
      props.top ? 13 : 10,
      props.top ? 0 : props.flipped ? -9 : 9,
    );
    camera.lookAt(0, 0, 0);
    invalidate();
  }, [camera, invalidate, props.top, props.flipped]);
  const chess = new Chess(props.fen),
    reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <>
      <color attach="background" args={["#14191b"]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#ebe6db", "#302a24", 1.25]} />
      <directionalLight
        position={[-5, 10, -4]}
        intensity={2.6}
        castShadow={props.graphics !== "low"}
        shadow-mapSize={[
          props.graphics === "high" ? 2048 : 1024,
          props.graphics === "high" ? 2048 : 1024,
        ]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[6, 3, 6]} intensity={0.8} color="#cbb18a" />
      <group>
        <mesh position={[0, -0.2, 0]} receiveShadow>
          <boxGeometry args={[8.7, 0.55, 8.7]} />
          <meshStandardMaterial color="#372c24" roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.43, 0]}>
          <boxGeometry args={[9, 0.15, 9]} />
          <meshStandardMaterial
            color="#a58b62"
            metalness={0.55}
            roughness={0.3}
          />
        </mesh>
        {Array.from({ length: 64 }, (_, i) => {
          const file = i % 8,
            rank = 8 - Math.floor(i / 8),
            square = `${"abcdefgh"[file]}${rank}` as Square,
            p = chess.get(square),
            x = file - 3.5,
            z = 3.5 - (rank - 1),
            chosen = props.selected === square,
            legal = props.legal.includes(square);
          return (
            <group
              key={square}
              onClick={(e) => {
                e.stopPropagation();
                props.onSelect(square);
              }}
            >
              <mesh position={[x, 0.045, z]} receiveShadow>
                <boxGeometry args={[1, 0.1, 1]} />
                <meshStandardMaterial
                  color={
                    chosen
                      ? "#af9868"
                      : (file + rank) % 2
                        ? "#ad9a7c"
                        : "#52615c"
                  }
                  roughness={0.78}
                />
              </mesh>
              {legal && (
                <mesh position={[x, 0.104, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[p ? 0.34 : 0.07, p ? 0.4 : 0.13, 24]} />
                  <meshBasicMaterial
                    color="#e8d8ac"
                    transparent
                    opacity={0.8}
                  />
                </mesh>
              )}
            </group>
          );
        })}
        {pieceInstances(props.initialFen, props.pgn).map((p) => (
          <Piece
            key={p.id}
            type={p.type}
            color={p.color}
            x={"abcdefgh".indexOf(p.square[0]) - 3.5}
            z={4.5 - Number(p.square[1])}
            assets={assets}
            reduce={reduce}
            onSelect={() => props.onSelect(p.square)}
          />
        ))}
      </group>
      <mesh
        position={[0, -0.6, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#14191b" roughness={0.95} />
      </mesh>
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={9}
        maxDistance={19}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2.5}
        target={[0, 0, 0]}
      />
    </>
  );
}
export default function Board3D(props: Props) {
  return (
    <Canvas
      aria-label="Tabuleiro 3D interativo; arraste para orbitar, role para aproximar"
      shadows={props.graphics !== "low"}
      frameloop="demand"
      dpr={[
        1,
        props.graphics === "low" ? 1 : props.graphics === "medium" ? 1.5 : 2,
      ]}
      camera={{ position: [9, 10, 9], fov: 40 }}
      gl={{ antialias: props.graphics !== "low", powerPreference: "low-power" }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
