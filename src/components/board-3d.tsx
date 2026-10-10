"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { pieceInstances } from "@/services/games/pieces";
import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import * as THREE from "three";
import { chessMaterials } from "./chess-materials";
function updateZoom(camera: THREE.Camera, zoom: number) {
  if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }
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
  assets: ReturnType<typeof chessMaterials>;
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
      dispose={null}
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
        <mesh
          position={[0, 0.69, 0]}
          scale={0.175}
          material={material}
          castShadow
        >
          <primitive object={assets.sphere} attach="geometry" />
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
          <mesh
            position={[0.025, 0.79, 0.145]}
            scale={0.022}
            material={assets.accent}
          >
            <primitive object={assets.sphere} attach="geometry" />
          </mesh>
        </group>
      )}
      {type === "b" &&
        assets.bishop.map((geometry, i) => (
          <mesh
            key={i}
            geometry={geometry}
            position={[0, 0.73, 0]}
            material={material}
            castShadow
          />
        ))}
      {type === "r" &&
        Array.from({ length: 6 }, (_, i) => (
          <mesh
            key={i}
            geometry={assets.rook}
            position={[0, 0.78, 0]}
            rotation={[0, (i * Math.PI) / 3, 0]}
            material={material}
            castShadow
          />
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
            material={material}
            scale={0.044}
            castShadow
          >
            <primitive object={assets.sphere} attach="geometry" />
          </mesh>
        ))}
      {type === "q" && (
        <mesh
          geometry={assets.sphere}
          position={[0, 1.01, 0]}
          scale={0.065}
          material={material}
          castShadow
        />
      )}
      {type === "k" && (
        <mesh
          geometry={assets.cross}
          position={[0, 0.91, 0]}
          material={material}
          castShadow
        />
      )}
      <mesh
        geometry={assets.ring}
        position={[0, 0.065, 0]}
        material={assets.accent}
      />
    </group>
  );
}
function Scene(props: Props) {
  const assets = useMemo(
    () => chessMaterials(props.graphics),
    [props.graphics],
  );
  useEffect(() => () => assets.dispose(), [assets]);
  const { camera, invalidate, size } = useThree();
  const fitZoom =
    Math.min(size.width, size.height) * (props.top ? 0.096 : 0.078);
  useEffect(() => {
    const side = props.flipped ? -1 : 1;
    camera.position.set(
      props.top ? 0 : side * 9,
      props.top ? 16 : 12,
      props.top ? side * 0.001 : side * 10,
    );
    updateZoom(camera, fitZoom);
    camera.lookAt(0, 0.3, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, props.top, props.flipped, fitZoom]);
  const chess = new Chess(props.fen),
    reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <>
      <color attach="background" args={["#171e20"]} />
      <fog attach="fog" args={["#171e20", 28, 65]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#e7edf2", "#695242", 0.8]} />
      {props.graphics !== "low" && (
        <Environment
          environmentIntensity={0.65}
          resolution={props.graphics === "high" ? 256 : 128}
          frames={1}
        >
          <Lightformer
            form="rect"
            position={[-4, 6, 2]}
            target={[0, 0, 0]}
            scale={[5, 7, 1]}
            intensity={3}
            color="#fff2df"
          />
          <Lightformer
            form="rect"
            position={[5, 3, -3]}
            target={[0, 0, 0]}
            scale={[3, 6, 1]}
            intensity={2}
            color="#dce9ff"
          />
          <Lightformer
            form="rect"
            position={[0, 7, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[4, 4, 1]}
            intensity={1.5}
          />
        </Environment>
      )}
      <directionalLight
        position={[-3, 9, 5]}
        intensity={1.8}
        color="#fff1dc"
        castShadow={props.graphics !== "low"}
        shadow-mapSize={[
          props.graphics === "high" ? 2048 : 1024,
          props.graphics === "high" ? 2048 : 1024,
        ]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-radius={3}
        shadow-blurSamples={8}
      />
      <directionalLight position={[5, 5, -6]} intensity={1.3} color="#dbe7ff" />
      <group>
        <RoundedBox
          args={[8.8, 0.42, 8.8]}
          radius={0.09}
          smoothness={4}
          position={[0, -0.12, 0]}
          material={assets.frame}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[8.85, 0.035, 8.85]}
          radius={0.015}
          smoothness={2}
          position={[0, -0.3, 0]}
          material={assets.accent}
        />
        <RoundedBox
          args={[8.7, 0.08, 8.7]}
          radius={0.03}
          smoothness={2}
          position={[0, -0.36, 0]}
          material={assets.frame}
          castShadow
        />
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
                <primitive
                  object={
                    chosen
                      ? assets.selected
                      : (file + rank) % 2
                        ? assets.lightTile
                        : assets.darkTile
                  }
                  attach="material"
                  dispose={null}
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
        {assets.labels.map((geometry, i) => (
          <mesh
            key={`label-${i}`}
            geometry={geometry}
            material={assets.labelMaterial}
            dispose={null}
            position={
              i < 8 ? [i - 3.5, 0.096, 4.2] : [-4.2, 0.096, 3.5 - (i - 8)]
            }
            rotation={[-Math.PI / 2, 0, i < 8 ? 0 : -Math.PI / 2]}
          />
        ))}
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
        position={[0, -0.43, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#080d10" roughness={0.86} />
      </mesh>
      <OrbitControls
        makeDefault
        enablePan={false}
        minZoom={fitZoom * 0.7}
        maxZoom={fitZoom * 2.2}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2.5}
        target={[0, 0.3, 0]}
      />
    </>
  );
}
export default function Board3D(props: Props) {
  return (
    <Canvas
      aria-label="Tabuleiro 3D interativo; arraste para orbitar, role para aproximar"
      shadows={props.graphics === "low" ? false : "variance"}
      orthographic
      frameloop="demand"
      dpr={[
        1,
        props.graphics === "low" ? 1 : props.graphics === "medium" ? 1.5 : 2,
      ]}
      camera={{ position: [9, 12, 10], zoom: 50, near: 0.1, far: 100 }}
      gl={{
        antialias: props.graphics !== "low",
        powerPreference: "low-power",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
