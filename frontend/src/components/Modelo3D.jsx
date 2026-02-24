/**
 * @deprecated Sustituido por Render3DCanvas (motor Smart Render). Se mantiene solo como referencia.
 */
import React, { useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Environment } from '@react-three/drei';
import { EffectComposer, SMAA, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

const WALL_COLORS = {
  cemento:  { color: '#232323', roughness: 0.92 },
  ladrillo: { color: '#7A3030', roughness: 1.00 },
  madera:   { color: '#3A2218', roughness: 0.75 },
  blanco:   { color: '#f5f5f7', roughness: 0.55 },
};

const MATERIAL_BASE = {
  acrilico:  { r: 0.1,  m: 0.0, transmission: 0.95, ior: 1.45, thickness: 0.5 },
  aluminio:  { r: 0.35, m: 1.0, transmission: 0.0 },
  vinil:     { r: 0.8,  m: 0.0, transmission: 0.0 },
};

function ShapeMesh({ s, lightsOn, profCanto, imageUrl, imageWidth, imageHeight }) {
  const isVinil    = s.type === 'rotulo';
  const isCaja     = s.type === 'caja';
  const isAluminio = s.mat  === 'aluminio';
  const isImpreso  = s.mat  === 'impreso';
  const canEmitLight = isCaja || s.type === 'letra3d';

  // Escala real del cotizador: profCanto en m; depth adaptado a anchoM/altoM
  const depth  = isVinil ? 0.002 : (isCaja ? 0.15 : parseFloat(profCanto) || 0.08);
  const zPos   = isVinil ? 0.001 : 0;
  const matDef = (isImpreso ? MATERIAL_BASE['acrilico'] : MATERIAL_BASE[s.mat]) ?? MATERIAL_BASE['acrilico'];

  const texture = useMemo(() => {
    if (!isImpreso || !imageUrl) return null;
    const tex = new THREE.TextureLoader().load(imageUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [isImpreso, imageUrl]);

  const geometry = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(s.shape, {
      depth,
      bevelEnabled:    !isVinil,
      bevelThickness:  0.004,
      bevelSize:       0.004,
      bevelSegments:   4,
      curveSegments:   96,
    });
    if (isImpreso && imageWidth > 0 && imageHeight > 0 && geo.attributes.position && geo.attributes.uv) {
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let j = 0; j < uv.count; j++) {
        const x = pos.getX(j);
        const y = pos.getY(j);
        uv.setXY(j, x / imageWidth, 1.0 - (y / imageHeight));
      }
      uv.needsUpdate = true;
    }
    geo.computeBoundingBox();
    return geo;
  }, [s.shape, depth, isVinil, isImpreso, imageWidth, imageHeight]);

  const lightCenter = useMemo(() => {
    const center = new THREE.Vector3();
    if (geometry.boundingBox) geometry.boundingBox.getCenter(center);
    return center;
  }, [geometry]);

  const lightZ = useMemo(() => zPos - depth - 0.05, [zPos, depth]);
  const lightDistance = useMemo(() => Math.max(0.5, 2 * depth), [depth]);

  const mainMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color:              isImpreso ? '#ffffff' : s.col,
    map:                (isImpreso && texture) ? texture : undefined,
    roughness:          matDef.r,
    metalness:          matDef.m,
    transmission:       (isCaja && lightsOn) ? (matDef.transmission ?? 0) : 0.0,
    ior:                matDef.ior ?? 1.5,
    thickness:          matDef.thickness ?? 0.0,
    emissive:           (canEmitLight && !isAluminio) ? (isImpreso ? '#ffffff' : s.col) : '#000000',
    emissiveMap:        isImpreso ? texture : null,
    emissiveIntensity:  (lightsOn && canEmitLight && !isAluminio) ? (isImpreso ? 0.8 : 0.6) : 0.0,
    side:               THREE.DoubleSide,
    polygonOffset:      isVinil,
    polygonOffsetFactor: isVinil ? -60 : 0,
    polygonOffsetUnits:  isVinil ? -120 : 0,
    transparent:        (isCaja && lightsOn) && (matDef.transmission ?? 0) > 0,
  }), [s.col, s.mat, isCaja, isVinil, isImpreso, texture, matDef, lightsOn, canEmitLight, isAluminio]);

  const sideMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color:             s.col,
    roughness:         0.6,
    metalness:         isAluminio ? 1.0 : 0.1,
    emissive:          (canEmitLight && !isAluminio) ? s.col : '#000000',
    emissiveIntensity: (lightsOn && canEmitLight && !isAluminio) ? 0.1 : 0.0,
  }), [s.col, canEmitLight, lightsOn, isAluminio]);

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
          distance={lightDistance}
          decay={2}
          position={[lightCenter.x, lightCenter.y, lightZ]}
          castShadow
        />
      )}
    </group>
  );
}

function ExtrudedSign({ svgData, lightsOn, profCanto, imageUrl, imageWidth, imageHeight }) {
  const shapes = useMemo(() => {
    if (!svgData) return [];
    try {
      const svgDoc = new SVGLoader().parse(svgData);
      return svgDoc.paths.flatMap(path => {
        const node = path.userData?.node;
        const type = node?.getAttribute('data-type') ?? 'letra3d';
        const mat  = node?.getAttribute('data-mat')  ?? 'acrilico';
        const col  = node?.getAttribute('data-col')  ?? '#ffffff';
        return path.toShapes(true).map(shape => ({ shape, type, mat, col }));
      });
    } catch {
      return [];
    }
  }, [svgData]);

  if (shapes.length === 0) return null;

  return (
    <group scale={[1, -1, 1]}>
      {shapes.map((s, i) => (
        <ShapeMesh
          key={i}
          s={s}
          lightsOn={lightsOn}
          profCanto={profCanto}
          imageUrl={imageUrl}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />
      ))}
    </group>
  );
}

function SignModel({
  anchoM,
  altoM,
  urlImagen,
  depth,
  isAcrilico,
  aluminioTipo,
  colorMate,
  materialCanto,
  showLeds,
  isDarkMode,
  wallTexture,
  isMontaje,
}) {
  const logoTexture = useMemo(() => {
    if (!urlImagen) return null;
    const tex = new THREE.TextureLoader().load(urlImagen);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [urlImagen]);

  const cantoColor = useMemo(() => {
    if (!isAcrilico) {
      if (aluminioTipo === 'Dorado') return '#C9A220';
      if (aluminioTipo === 'Rosa')   return '#D48A90';
      if (aluminioTipo === 'Mate')   return colorMate || '#888888';
      return '#C4C4C4';
    }
    if (materialCanto === 'Aluminio Dorado') return '#C9A220';
    if (materialCanto === 'Aluminio Negro')  return '#0d0d0d';
    return '#C4C4C4';
  }, [isAcrilico, aluminioTipo, colorMate, materialCanto]);

  const { geometry, materials } = useMemo(() => {
    const geo = new THREE.BoxGeometry(anchoM, altoM, depth);

    const cantoMat = isAcrilico
      ? new THREE.MeshPhysicalMaterial({
          color: '#ddeeff',
          roughness: 0.15,
          metalness: 0,
          transmission: 0.40,
          thickness: depth,
          ior: 1.49,
          emissive: showLeds ? '#ffffff' : '#000000',
          emissiveIntensity: showLeds ? 0.08 : 0,
        })
      : new THREE.MeshPhysicalMaterial({
          color: cantoColor,
          roughness: aluminioTipo === 'Mate' ? 0.78 : 0.12,
          metalness: aluminioTipo === 'Mate' ? 0.5 : 1.0,
          clearcoat: aluminioTipo === 'Mate' ? 0.2 : 0.85,
          clearcoatRoughness: 0.05,
        });

    const frontBase = isAcrilico
      ? { roughness: 0.06, metalness: 0, clearcoat: 0.95, clearcoatRoughness: 0.04,
          transmission: logoTexture ? 0.08 : 0.35, thickness: depth, ior: 1.49 }
      : { roughness: 0.18, metalness: 0.02, clearcoat: 0.45, clearcoatRoughness: 0.06 };

    const frontMat = new THREE.MeshPhysicalMaterial({
      ...frontBase,
      map: logoTexture || undefined,
      color: logoTexture ? '#ffffff' : (isAcrilico ? '#cce4ff' : cantoColor),
      transparent: Boolean(logoTexture),
    });

    if (showLeds && logoTexture) {
      frontMat.emissiveMap = logoTexture;
      frontMat.emissive = new THREE.Color('#ffffff');
      frontMat.emissiveIntensity = isAcrilico ? 1.6 : 0.55;
    }

    const backMat = new THREE.MeshStandardMaterial({
      color: '#1a1a1a',
      roughness: 0.75,
      metalness: 0.35,
    });

    return {
      geometry: geo,
      materials: [cantoMat, cantoMat, cantoMat, cantoMat, frontMat, backMat],
    };
  }, [anchoM, altoM, depth, isAcrilico, aluminioTipo, colorMate, materialCanto, cantoColor, logoTexture, showLeds]);

  const wc = WALL_COLORS[wallTexture] ?? (isDarkMode ? WALL_COLORS.cemento : WALL_COLORS.blanco);

  return (
    <>
      {!isMontaje && (
        <color attach="background" args={[isDarkMode ? '#0a0a0c' : '#f0f0f2']} />
      )}
      {!isMontaje && (
        <mesh position={[0, 0, -depth - 0.25]}>
          <planeGeometry args={[Math.max(14, anchoM * 3.5), Math.max(8, altoM * 3.5)]} />
          <meshStandardMaterial color={wc.color} roughness={wc.roughness} metalness={0} />
        </mesh>
      )}
      <Center>
        <mesh geometry={geometry} material={materials} />
      </Center>
    </>
  );
}

export function Modelo3D({
  urlImagenProcesada,
  svgData,
  materialCara,
  materialCanto,
  aluminioTipo,
  colorMate,
  showLeds,
  imgW,
  imgH,
  wallTexture,
  isMontaje,
  isDarkMode,
  profCanto = '0.08',
}) {
  const depth      = Math.max(0.04, parseFloat(profCanto) || 0.08);
  const anchoM     = Math.max(0.1, imgW  || 8.0);
  const altoM      = Math.max(0.1, imgH  || 2.4);
  const isAcrilico = materialCara === 'Acrílico';
  const camZ       = anchoM * 0.75 + 1.5;
  const hasSvg     = typeof svgData === 'string' && svgData.includes('<path');

  return (
    <Canvas
      camera={{ position: [0, 0, camZ], fov: 42 }}
      shadows
      gl={{
        preserveDrawingBuffer: true,
        alpha: true,
        antialias: !hasSvg, 
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: isAcrilico ? 1.1 : 1.0,
      }}
    >
      <Environment
        preset={isAcrilico ? 'apartment' : 'studio'}
        environmentIntensity={isAcrilico ? 0.65 : 0.95}
        background={false}
      />

      <OrbitControls enableDamping dampingFactor={0.08} />

      <ambientLight intensity={hasSvg ? (showLeds ? 0.05 : 0.3) : 0.45} />
      <directionalLight
        position={[3, 6, 8]}
        intensity={hasSvg ? (showLeds ? 0.2 : 1.0) : (isAcrilico ? 1.2 : 1.7)}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-5, 4, 3]} intensity={0.55} />
      <directionalLight position={[0, -3, -4]} intensity={0.30} />
      <pointLight position={[0, 8, 5]} intensity={isAcrilico ? 0.5 : 1.1} decay={2} />

      {showLeds && !hasSvg && (
        <pointLight
          color="#fff8e7"
          intensity={isAcrilico ? 5.0 : 3.5}
          distance={anchoM * 0.9}
          decay={2}
          position={[0, 0, -depth * 0.4]}
        />
      )}

      {hasSvg ? (
        <Suspense fallback={null}>
          <mesh position={[0, 0, -3]} receiveShadow>
            <planeGeometry args={[80, 80]} />
            <meshStandardMaterial
              color={isDarkMode ? '#1a1a1f' : '#505050'}
              roughness={0.9}
              metalness={0.2}
            />
          </mesh>
          <Center>
            <ExtrudedSign
              svgData={svgData}
              lightsOn={showLeds}
              profCanto={profCanto}
              imageUrl={urlImagenProcesada}
              imageWidth={anchoM}
              imageHeight={altoM}
            />
          </Center>
          <EffectComposer multisampling={0}>
            <SMAA />
            <Bloom
              intensity={showLeds ? 1.0 : 0}
              luminanceThreshold={0.85}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.1} darkness={0.6} />
          </EffectComposer>
        </Suspense>
      ) : (
        <SignModel
          anchoM={anchoM}
          altoM={altoM}
          urlImagen={urlImagenProcesada}
          depth={depth}
          isAcrilico={isAcrilico}
          aluminioTipo={aluminioTipo}
          colorMate={colorMate}
          materialCanto={materialCanto}
          showLeds={showLeds}
          isDarkMode={isDarkMode}
          wallTexture={wallTexture}
          isMontaje={isMontaje}
        />
      )}
    </Canvas>
  );
}