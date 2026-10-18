// --- Marqueurs de la carte : forme ET couleur selon le statut (la couleur seule ne suffit pas à tous les utilisateurs) ---
// Les formes se distinguent au contour : cercle, triangle, losange, carré. La dernière entrée sert de valeur par défaut.
export const MARKERS=[
  {statuts:['OK'],shape:'circle',color:'#12805c',label:'OK (confiance haute ou moyenne)'},
  {statuts:['A_VERIFIER'],shape:'triangle',color:'#ca8a04',label:'À vérifier (CP/ville, CP différent)'},
  {statuts:['NUTS_PROCHE'],shape:'diamond',color:'#d97706',label:'NUTS proche'},
  {statuts:[],shape:'square',color:'#c0262d',label:'Pays incohérent / hors NUTS / échec'}];
export const markerStyle=statut=>MARKERS.find(m=>m.statuts.includes(statut))||MARKERS[MARKERS.length-1];
// sommets (rapportés au rayon) des formes polygonales ; le cercle n'en a pas
export const MARKER_PTS={triangle:[[0,-1.35],[1.2,.9],[-1.2,.9]],diamond:[[0,-1.25],[1.25,0],[0,1.25],[-1.25,0]],square:[[-.9,-.9],[.9,-.9],[.9,.9],[-.9,.9]]};
// pastille SVG de la légende (décorative : le libellé suit)
export function markerSvg(m,size=14,r=5){
  const c=size/2,p=MARKER_PTS[m.shape];
  const shape=p?`<polygon points="${p.map(([x,y])=>(c+x*r).toFixed(1)+','+(c+y*r).toFixed(1)).join(' ')}"`:`<circle cx="${c}" cy="${c}" r="${r}"`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${shape} fill="${m.color}" stroke="#fff" stroke-width="1"/></svg>`;
}
