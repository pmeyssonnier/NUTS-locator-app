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
