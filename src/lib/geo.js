// --- NUTS : point dans polygone ---
export function inRing(x,y,r){let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)ins=!ins;}return ins;}
// libellé Eurostat nettoyé : espaces de début/fin et doubles espaces retirés, espace autour des « / » supprimé
export const cleanName=s=>String(s??'').replace(/\s+/g,' ').replace(/\s*\/\s*/g,'/').trim();
export function prepNuts(features){
  return features.filter(f=>f.geometry).map(f=>{const g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;const b=[180,90,-180,-90];
    for(const p of polys)for(const [x,y] of p[0]){if(x<b[0])b[0]=x;if(y<b[1])b[1]=y;if(x>b[2])b[2]=x;if(y>b[3])b[3]=y;}
    return {id:f.properties.NUTS_ID,name:cleanName(f.properties.NAME_LATN),polys,b};});
}
// distance (km) d'un point à un anneau, projection équirectangulaire locale
export function distRingKm(lon,lat,ring){
  const k=Math.cos(lat*Math.PI/180),R=111.32;let best=Infinity;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const ax=(ring[j][0]-lon)*k*R,ay=(ring[j][1]-lat)*R,bx=(ring[i][0]-lon)*k*R,by=(ring[i][1]-lat)*R;
    const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;let t=L?-(ax*dx+ay*dy)/L:0;t=Math.max(0,Math.min(1,t));
    const px=ax+t*dx,py=ay+t*dy,d=px*px+py*py;if(d<best)best=d;}
  return Math.sqrt(best);
}
// maxKm=0 : uniquement si le point est dans un polygone ; sinon zone la plus proche à moins de maxKm
export function findNuts(nuts,lon,lat,maxKm=0){
  for(const f of nuts){const b=f.b;if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue;
    for(const p of f.polys)if(inRing(lon,lat,p[0])&&!p.slice(1).some(h=>inRing(lon,lat,h)))return {id:f.id,exact:true,v:f.v,km:0};}
  if(!(maxKm>0))return null;
  const dLat=maxKm/111.32,dLon=dLat/Math.max(.05,Math.cos(lat*Math.PI/180));let best=null,bd=Infinity;
  for(const f of nuts){const b=f.b;if(lon<b[0]-dLon||lon>b[2]+dLon||lat<b[1]-dLat||lat>b[3]+dLat)continue;
    for(const p of f.polys)for(const ring of p){const d=distRingKm(lon,lat,ring);if(d<bd){bd=d;best=f;}}}
  return best&&bd<=maxKm?{id:best.id,exact:false,v:best.v,km:Math.round(bd*100)/100}:null;
}
