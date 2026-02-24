import React, { useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';

/** Escala del grupo 3D: metros (imageWidth &lt; 50) → [1,-1,1], píxeles → [0.02,-0.02,0.02]. Exportado para tests. */
export function getScaleForRender(imageWidth) {
  return imageWidth > 0 && imageWidth < 50 ? [1, -1, 1] : [0.02, -0.02, 0.02];
}
import { OrbitControls, Center, Environment } from '@react-three/drei';
import { EffectComposer, SMAA, Vignette, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

const MATERIAL_BASE = {
  acrilico: { r: 0.1, m: 0.0, transmission: 0.95, ior: 1.45, thickness: 0.5 },
  aluminio: { r: 0.35, m: 1.0, transmission: 0.0 },
  vinil: { r: 0.8, m: 0.0, transmission: 0.0 },
  impreso: { r: 0.2, m: 0.0, transmission: 0.6, thickness: 0.2 },
};

function ShapeMesh({ s, imageWidth, imageHeight, texture, lightsOn }) {
  const isVinil = s.type === 'rotulo';
  const isCaja = s.type === 'caja';
  const isImpreso = (s.mat || '').toLowerCase() === 'impreso';
  const isAluminio = (s.mat || '').toLowerCase() === 'aluminio';
  const canEmitLight = isCaja || s.type === 'letra3d';
  const col = typeof s.col === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(s.col) ? s.col : '#ffffff';

  // SVG en metros (imageWidth < 50) → profundidades en m; si no, unidades píxel (Smart Render nativo).
  const useMeters = imageWidth > 0 && imageWidth < 50;
  const depth = useMeters
    ? (isVinil ? 0.002 : isCaja ? 0.008 : 0.025)
    : (isVinil ? 0.2 : isCaja ? 8 : 25);
  const zPos = isVinil ? (useMeters ? 0.0087 : 8.7) : 0;
  const bevelThickness = useMeters ? 0.0004 : 0.4;
  const bevelSize = useMeters ? 0.0004 : 0.4;
  const matDef = MATERIAL_BASE[isImpreso ? 'acrilico' : s.mat] || MATERIAL_BASE.acrilico;

  const curveSegments = 128;
  const geometry = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(s.shape, {
      depth,
      bevelEnabled: !isVinil,
      bevelThickness,
      bevelSize,
      bevelSegments: 5,
      curveSegments,
    });
    // UV impreso: igual que Smart Render — aplicar a TODOS los vértices: u = x/imageWidth, v = 1 - y/imageHeight.
    if (isImpreso && imageWidth > 0 && imageHeight > 0 && geo.attributes.position && geo.attributes.uv) {
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      const iw = Number(imageWidth) || 1;
      const ih = Number(imageHeight) || 1;
      for (let j = 0; j < uv.count; j++) {
        const x = pos.getX(j);
        const y = pos.getY(j);
        uv.setXY(j, x / iw, 1.0 - y / ih);
      }
      uv.needsUpdate = true;
    }
    return geo;
  }, [s.shape, depth, isVinil, isImpreso, imageWidth, imageHeight, bevelThickness, bevelSize]);

  const mainMaterial = useMemo(
    () => {
      const emissiveVal = canEmitLight && !isAluminio ? (isImpreso ? '#ffffff' : col) : '#000';
      const emissiveIntensityWhenOn = lightsOn && canEmitLight && !isAluminio ? (isImpreso ? 0.6 : 0.45) : 0;
      const subtleEmissiveWhenOff = !lightsOn && canEmitLight && !isAluminio ? 0.12 : 0;
      return new THREE.MeshPhysicalMaterial({
        color: isImpreso ? '#ffffff' : col,
        map: isImpreso ? texture : null,
        roughness: lightsOn ? matDef.r : Math.min(0.5, matDef.r + 0.15),
        metalness: matDef.m,
        transmission: isCaja && lightsOn ? matDef.transmission : 0.0,
        opacity: 1.0,
        ior: matDef.ior || 1.5,
        thickness: matDef.thickness || 0.0,
        emissive: emissiveVal,
        emissiveMap: isImpreso ? texture : null,
        emissiveIntensity: emissiveIntensityWhenOn || subtleEmissiveWhenOff,
        side: THREE.DoubleSide,
        polygonOffset: isVinil,
        polygonOffsetFactor: isVinil ? -60 : 0,
        polygonOffsetUnits: isVinil ? -120 : 0,
        transparent: isCaja && lightsOn && matDef.transmission > 0,
      });
    },
    [isImpreso, texture, col, s.mat, isCaja, isVinil, matDef, lightsOn, canEmitLight, isAluminio]
  );

  const sideMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: col,
        roughness: 0.6,
        metalness: isAluminio ? 1.0 : 0.1,
        emissive: canEmitLight && !isAluminio ? col : '#000',
        emissiveIntensity: lightsOn && canEmitLight && !isAluminio ? 0.1 : 0.0,
      }),
    [col, canEmitLight, lightsOn, isAluminio]
  );

  return (
    <group>
      <mesh
        position={[0, 0, zPos]}
        renderOrder={isVinil ? 999 : 1}
        geometry={geometry}
        material={isImpreso ? [mainMaterial, sideMaterial] : mainMaterial}
        castShadow
        receiveShadow
      />
      {isAluminio && lightsOn && (
        <pointLight
          color="#ffffff"
          intensity={2.5}
          distance={15}
          decay={2}
          position={[0, 0, zPos - (useMeters ? 0.01 : 1)]}
          castShadow
        />
      )}
    </group>
  );
}

function Render3DContent({ svgString, imageSrc, imageWidth, imageHeight, lightsOn }) {
  const textureRef = useRef(null);
  // Igual que Smart Render: devolver la textura de inmediato para que el material la use; la imagen se aplica al cargar.
  const texture = useMemo(() => {
    if (!imageSrc) {
      if (textureRef.current) textureRef.current.dispose();
      textureRef.current = null;
      return null;
    }
    if (textureRef.current) textureRef.current.dispose();
    const tex = new THREE.TextureLoader().load(
      imageSrc,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.flipY = false;
      }
    );
    textureRef.current = tex;
    return tex;
  }, [imageSrc]);
  useEffect(() => () => {
    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }
  }, []);

  const shapes = useMemo(() => {
    if (!svgString) return [];
    try {
      const svgData = new SVGLoader().parse(svgString);
      return svgData.paths.flatMap((path) => {
        const node = path.userData?.node;
        const type = (node?.getAttribute?.('data-type') || 'letra3d').trim() || 'letra3d';
        const mat = (node?.getAttribute?.('data-mat') || 'acrilico').trim() || 'acrilico';
        const col = (node?.getAttribute?.('data-col') || '#ffffff').trim() || '#ffffff';
        return path.toShapes(true).map((shape) => ({ shape, type, mat, col }));
      });
    } catch {
      return [];
    }
  }, [svgString]);

  // SVG from DisproOS backend is in meters (viewBox iw x ih); use 1:1 scale. Smart Render pixel SVG would use 0.02.
  const scale = getScaleForRender(imageWidth);
  return (
    <group scale={scale}>
      {shapes.map((s, i) => (
        <ShapeMesh
          key={i}
          s={s}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          texture={texture}
          lightsOn={lightsOn}
        />
      ))}
    </group>
  );
}

export function Render3DCanvas({
  svgString,
  imageSrc,
  imageWidth,
  imageHeight,
  lightsOn,
  isDarkMode,
}) {
  const imgW = imageWidth || 1;
  const imgH = imageHeight || 1;

  return (
    <div
      className={`w-full h-full rounded-[2rem] overflow-hidden border transition-colors ${
        isDarkMode ? 'bg-[var(--color-dispro-panel)] border-white/10' : 'bg-white border-black/10'
      }`}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 40 }}
        shadows
        gl={{ antialias: false }}
        dpr={typeof window !== 'undefined' ? window.devicePixelRatio : 1}
      >
        <Environment preset="night" blur={0.8} background={false} />
        <ambientLight intensity={lightsOn ? 0.05 : 0.55} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={lightsOn ? 0.2 : 1.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        {!lightsOn && (
          <directionalLight position={[-3, 5, 5]} intensity={0.4} />
        )}
        <Suspense fallback={null}>
          <Center>
            <Render3DContent
              svgString={svgString}
              imageSrc={imageSrc}
              imageWidth={imgW}
              imageHeight={imgH}
              lightsOn={lightsOn}
            />
          </Center>
          <mesh position={[0, 0, -3]} receiveShadow>
            <planeGeometry args={[80, 80]} />
            <meshStandardMaterial
              color={isDarkMode ? '#303030' : '#505050'}
              roughness={0.9}
              metalness={0.2}
            />
          </mesh>
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.5}
        />
        <EffectComposer multisampling={0}>
          <SMAA preset={SMAA.PRESET_HIGH} />
          <Bloom
            intensity={lightsOn ? 0.6 : 0}
            luminanceThreshold={0.92}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.1} darkness={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
