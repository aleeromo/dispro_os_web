import { useState, useMemo } from 'react';
import { getAnchosRollo } from '../constants/materials.js';

export function useMaterialParams() {
  const [modo, setModo] = useState('ROLLO');
  const [materialCara, setMaterialCara] = useState('Lona');
  const [aluminioTipo, setAluminioTipo] = useState('Plata');
  const [colorMate, setColorMate] = useState('#ffffff');
  const [materialCanto, setMaterialCanto] = useState('Aluminio');
  const [profCanto, setProfCanto] = useState('0.06');
  const [ancho, setAncho] = useState('1.00');
  const [alto, setAlto] = useState('1.00');
  const [conLuz, setConLuz] = useState(true);
  const [anchoRollo, setAnchoRollo] = useState('1.20');
  const [wallTexture, setWallTexture] = useState('blanco');

  const anchosDisponibles = useMemo(() => getAnchosRollo(materialCara), [materialCara]);

  return {
    modo, setModo,
    materialCara, setMaterialCara,
    aluminioTipo, setAluminioTipo,
    colorMate, setColorMate,
    materialCanto, setMaterialCanto,
    profCanto, setProfCanto,
    ancho, setAncho,
    alto, setAlto,
    conLuz, setConLuz,
    anchoRollo, setAnchoRollo,
    wallTexture,
    anchosDisponibles,
    getAnchosRollo,
  };
}
