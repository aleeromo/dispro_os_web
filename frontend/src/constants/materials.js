export function getAnchosRollo(sustrato) {
  if (sustrato === 'Lona') return [{ val: '1.20', label: '1.20m' }, { val: '2.50', label: '2.50m' }, { val: '3.20', label: '3.20m' }];
  if (sustrato === 'Vinil') return [{ val: '1.27', label: '1.27m' }, { val: '1.52', label: '1.52m' }];
  if (sustrato === 'DTF UV') return [{ val: '0.30', label: '30 cms (Lineal)' }];
  if (sustrato === 'DTF Textil') return [{ val: '0.60', label: '60 cms (Lineal)' }];
  return [{ val: '1.20', label: '1.20m' }];
}
