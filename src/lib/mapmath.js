// --- Carte tactile et liste de cartes : zoom fractionnaire, pincement, pagination (pures, testées sous Node) ---
// niveau de tuiles entier le plus proche d'un zoom fractionnaire, et taille d'affichage (px) d'une tuile à ce zoom
export function tileScale(z){const zt=Math.max(0,Math.min(19,Math.round(z)));return {zt,ts:256*2**(z-zt)};}
// zoom après un pincement : d0 = écart initial des doigts, d1 = écart actuel (borné à [min,max])
export function pinchZoom(z0,d0,d1,min=2,max=18){
  if(!(d0>0)||!(d1>0))return Math.max(min,Math.min(max,z0));
  return Math.max(min,Math.min(max,z0+Math.log2(d1/d0)));
}
export const merc=(lon,lat)=>{const sl=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return [(lon+180)/360,0.5-Math.log((1+sl)/(1-sl))/(4*Math.PI)];};
export const unmerc=(x,y)=>[x*360-180,180/Math.PI*Math.atan(Math.sinh(Math.PI*(1-2*y)))];

// Nom du fichier PNG : carte_nuts_<code NUTS complet> (ex. carte_nuts_BE100), carte_nuts.png si aucun code n'est déterminé.
// Code retenu : zone sélectionnée sur la carte > ligne sélectionnée (au niveau affiché, NUTS 3 par défaut) > NUTS 3 commun à toutes les lignes affichées.
export function mapPngName(selZone, selRow, rows, level) {
  const ok = c => /^[A-Z]{2}[A-Z0-9]{0,3}$/.test(c || '') ? c : '';
  const lv = level >= 0 && level <= 3 ? level : 3;
  let code = ok(String(selZone ?? '').toUpperCase());
  if (!code && selRow) code = ok(String(selRow['NUTS' + lv] || selRow.NUTS3 || '').toUpperCase());
  if (!code) {
    const set = new Set((rows || []).map(r => String(r['NUTS' + lv] || r.NUTS3 || '').toUpperCase()).filter(Boolean));
    if (set.size === 1) code = ok([...set][0]);
  }
  return code ? `carte_nuts_${code}.png` : 'carte_nuts.png';
}
