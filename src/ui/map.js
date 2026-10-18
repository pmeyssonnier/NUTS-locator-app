import {findNuts, prepNuts} from '../lib/geo.js';
import {mapKeyAction} from '../lib/keys.js';
import {merc, pinchZoom, tileScale, unmerc} from '../lib/mapmath.js';
import {MARKER_PTS, MARKERS, markerStyle, markerSvg} from '../lib/markers.js';
import {esc, isNum} from '../lib/util.js';
import {$, announce, coarse, download, setStatus, smooth} from './dom.js';
import {addUK, gisco, loadNuts} from './nuts.js';
import {rowHtml} from './rows.js';
import {lkey, S, view} from './state.js';
import {prefGet, prefSet} from './storage.js';

let H={};   // actions fournies par l'orchestration : select(r,fly), clear(), step(dir), render(), go(i)
const MAP={lon:10,lat:51,z:4,W:0,H:0,dpr:1,tiles:new Map(),raf:0,drag:null,pop:null,selZone:null,lastWheel:0};
const cv=$('#map'),ctx=cv.getContext('2d');
const BASES={
  osm:{url:(z,x,y)=>`https://tile.openstreetmap.org/${z}/${x}/${y}.png`,attr:'© OpenStreetMap contributors'},
  voyager:{url:(z,x,y)=>{const k=$('#cartoKey').value.trim();return `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`+(k?'?key='+encodeURIComponent(k):'');},attr:'© OpenStreetMap contributors © CARTO'},
  custom:{url:(z,x,y)=>{const t=$('#tileUrl').value.trim();return t?t.replace('{z}',z).replace('{x}',x).replace('{y}',y).replace('{s}','abc'[(x+y)%3]):'';},attr:'Fond personnalisé'},
  none:{attr:''}};
function baseUI(){const b=$('#base').value;$('#lblKey').hidden=b!=='voyager';$('#lblUrl').hidden=b!=='custom';
  if(b==='voyager'&&!$('#cartoKey').value.trim())setStatus('CARTO exige une clé gratuite (carto.com/basemaps/apikey) : sans clé, les tuiles portent un filigrane.');}
function markerPath(x,y,rad,shape){
  ctx.beginPath();const p=MARKER_PTS[shape];
  if(!p){ctx.arc(x,y,rad,0,7);return;}
  p.forEach(([px,py],i)=>{const X=x+px*rad,Y=y+py*rad;i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);});ctx.closePath();
}
const scale=()=>256*2**MAP.z;
const center=()=>merc(MAP.lon,MAP.lat);
function setCenter(lon,lat){MAP.lon=((lon+540)%360)-180;MAP.lat=Math.max(-85,Math.min(85,lat));}
function toScr(mx,my){const s=scale(),c=center();return [(mx-c[0])*s+MAP.W/2,(my-c[1])*s+MAP.H/2];}
function toMerc(sx,sy){const s=scale(),c=center();return [c[0]+(sx-MAP.W/2)/s,c[1]+(sy-MAP.H/2)/s];}
export function draw(){if(!MAP.raf)MAP.raf=requestAnimationFrame(paint);}
export function resize(){const r=cv.getBoundingClientRect();if(!r.width)return;MAP.dpr=window.devicePixelRatio||1;MAP.W=r.width;MAP.H=r.height;
  cv.width=Math.round(r.width*MAP.dpr);cv.height=Math.round(r.height*MAP.dpr);draw();}
function mercFeat(f){
  if(!f.m){f.m=f.polys.map(p=>p.map(ring=>{const a=new Float64Array(ring.length*2);ring.forEach(([x,y],i)=>{const m=merc(x,y);a[2*i]=m[0];a[2*i+1]=m[1];});return a;}));
    const a=merc(f.b[0],f.b[3]),b=merc(f.b[2],f.b[1]);f.mb=[a[0],a[1],b[0],b[1]];}
  return f.m;
}
function countBy(l,rows){const m=new Map();for(const r of rows){const k=r['NUTS'+l];if(k)m.set(k,(m.get(k)||0)+1);}return m;}
function paint(){
  MAP.raf=0;const {W,H,dpr}=MAP;if(!W)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=getComputedStyle($('#mapwrap')).backgroundColor;ctx.fillRect(0,0,W,H);
  const bk=$('#base').value,base=BASES[bk],s=scale(),c=center(),rows=view().rows;
  if(!MAP.noTiles&&base.url&&base.url(0,0,0)){const {zt,ts}=tileScale(MAP.z),n=2**zt,x0=Math.floor((c[0]*s-W/2)/ts),x1=Math.floor((c[0]*s+W/2)/ts),
      y0=Math.max(0,Math.floor((c[1]*s-H/2)/ts)),y1=Math.min(n-1,Math.floor((c[1]*s+H/2)/ts));
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      const wx=((tx%n)+n)%n,key=base.url(zt,wx,ty);let img=MAP.tiles.get(key);
      if(!img){img=new Image();img.crossOrigin='anonymous';img.onload=draw;
        img.onerror=()=>{MAP.tileErr=(MAP.tileErr||0)+1;if(MAP.tileErr===1||MAP.tileErr%25===0)setStatus(`Fond de carte : ${MAP.tileErr} tuile(s) refusée(s) — serveur sans en-tête CORS, clé manquante ou hors ligne. Contours, points et export PNG restent disponibles, sans fond.`,true);};
        img.src=key;MAP.tiles.set(key,img);
        if(MAP.tiles.size>800)MAP.tiles.delete(MAP.tiles.keys().next().value);}
      if(img.complete&&img.naturalWidth){const px=Math.round(tx*ts-c[0]*s+W/2),py=Math.round(ty*ts-c[1]*s+H/2);ctx.drawImage(img,px,py,Math.round((tx+1)*ts-c[0]*s+W/2)-px,Math.round((ty+1)*ts-c[1]*s+H/2)-py);}
    }}
  const lvl=+$('#lvl').value,feats=lvl&&S.levels[lkey(lvl,$('#res').value)];
  if(feats){
    const cnt=countBy(lvl,rows),max=Math.max(1,...cnt.values()),only=$('#onlyWith').checked,choro=$('#choro').checked;
    ctx.lineJoin='round';
    for(const f of feats){
      const k=cnt.get(f.id)||0;if(only&&!k)continue;mercFeat(f);const b=f.mb;
      if((b[2]-c[0])*s+W/2<0||(b[0]-c[0])*s+W/2>W||(b[3]-c[1])*s+H/2<0||(b[1]-c[1])*s+H/2>H)continue;
      ctx.beginPath();
      for(const p of f.m)for(const a of p){for(let i=0;i<a.length;i+=2){const x=(a[i]-c[0])*s+W/2,y=(a[i+1]-c[1])*s+H/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
      ctx.fillStyle=choro&&k?`rgba(31,94,255,${(0.12+0.5*k/max).toFixed(3)})`:'rgba(31,94,255,.04)';ctx.fill('evenodd');
      ctx.lineWidth=f.id===MAP.selZone?3:lvl===3?1:1.6;ctx.strokeStyle=f.id===MAP.selZone?'#ff7a00':'rgba(31,60,160,.8)';ctx.stroke();
    }
  }
  for(const r of rows){if(!isNum(r.lat)||r===S.selRow)continue;dot(r,5.5,1.5);}
  if(S.selRow&&isNum(S.selRow.lat))dot(S.selRow,8,3);
  function dot(r,rad,lw){const m=merc(r.lon,r.lat),x=(m[0]-c[0])*s+W/2,y=(m[1]-c[1])*s+H/2;if(x<-10||y<-10||x>W+10||y>H+10)return;
    const st=markerStyle(r.statut);markerPath(x,y,rad,st.shape);ctx.fillStyle=st.color;ctx.fill();ctx.lineWidth=lw;ctx.lineJoin='round';ctx.strokeStyle='#fff';ctx.stroke();}
  $('#attrib').textContent=[base.attr,feats?'NUTS © EuroGeographics':''].filter(Boolean).join(' · ');
  positionPop();
}
function showPop(mx,my,html){MAP.pop={mx,my};const p=$('#pop');p.innerHTML=html;p.hidden=false;positionPop();}
function hidePop(){MAP.pop=null;$('#pop').hidden=true;}
function positionPop(){
  if(!MAP.pop)return;const [x,y]=toScr(MAP.pop.mx,MAP.pop.my),p=$('#pop');
  if(x<0||y<0||x>MAP.W||y>MAP.H){p.hidden=true;return;}p.hidden=false;
  p.style.left=Math.max(6,Math.min(MAP.W-p.offsetWidth-6,x+12))+'px';
  const top=y-p.offsetHeight-12;p.style.top=(top>6?top:Math.min(MAP.H-p.offsetHeight-6,y+12))+'px';
}
// sélection d'une ligne sur la carte : recentre (si fly) et affiche la fiche du point
export function focusRow(r,fly){
  MAP.selZone=null;
  if(isNum(r.lat)){if(fly){setCenter(r.lon,r.lat);MAP.z=Math.max(MAP.z,12);}const m=merc(r.lon,r.lat);showPop(m[0],m[1],rowHtml(r));}else hidePop();
}
export function clearMapSelection(){MAP.selZone=null;hidePop();}
export function focusMap(){cv.focus();}
export function scrollToMap(block){$('#mapwrap').scrollIntoView({behavior:smooth(),block});}
function onMapClick(sx,sy){
  let best=null,bd=(matchMedia('(pointer:coarse)').matches?26:10)**2;   // cible plus large au doigt
  for(const r of view().rows){if(!isNum(r.lat))continue;const [x,y]=toScr(...merc(r.lon,r.lat)),d=(x-sx)**2+(y-sy)**2;if(d<bd){bd=d;best=r;}}
  if(best){H.select(best,false);return;}
  const lvl=+$('#lvl').value,feats=lvl&&S.levels[lkey(lvl,$('#res').value)];
  if(feats){const [mx,my]=toMerc(sx,sy),[lon,lat]=unmerc(mx,my),n=findNuts(feats,lon,lat);
    if(n&&n.exact){const k=countBy(lvl,view().rows).get(n.id)||0;S.selRow=null;MAP.selZone=n.id;
      showPop(mx,my,`<b>${esc(n.id)} — ${esc(S.names?.[n.id]||'')}</b><span class="muted">NUTS ${lvl} · ${k} point(s)</span>`);H.render();return;}}
  H.clear();
}
function zoomAt(dz,sx,sy){
  const z=Math.max(2,Math.min(18,MAP.z+dz));if(z===MAP.z)return;
  const m=toMerc(sx,sy);MAP.z=z;const s=scale();setCenter(...unmerc(m[0]-(sx-MAP.W/2)/s,m[1]-(sy-MAP.H/2)/s));draw();
}
export function fit(){
  const pts=view().rows.filter(r=>isNum(r.lat)).map(r=>merc(r.lon,r.lat));
  if(!pts.length){setCenter(10,51);MAP.z=4;draw();return;}
  let [x0,y0]=pts[0],x1=x0,y1=y0;for(const [x,y] of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  let z=14;while(z>2&&((x1-x0)*256*2**z>MAP.W-80||(y1-y0)*256*2**z>MAP.H-80))z--;
  MAP.z=z;setCenter(...unmerc((x0+x1)/2,(y0+y1)/2));hidePop();draw();
}
// Pointeurs : un doigt/souris = déplacer ou toucher ; deux doigts = pincer pour zoomer (le point entre les doigts reste fixe)
const PTR=new Map();
function pinchGeom(){const [a,b]=[...PTR.values()],r=cv.getBoundingClientRect();return {d:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top};}
function endPointer(e){PTR.delete(e.pointerId);if(PTR.size<2)MAP.pinch=null;}
function setFull(on){
  MAP.full=on;$('#mapwrap').classList.toggle('full',on);document.body.classList.toggle('fs-open',on);
  for(const id of ['#fs','#fsBtn'])$(id).setAttribute('aria-pressed',String(on));
  $('#fs').textContent=on?'✕':'⛶';$('#fs').setAttribute('aria-label',on?'Quitter le plein écran':'Carte en plein écran');
  $('#fsBtn').textContent=on?'Quitter le plein écran':'Carte en plein écran';
  resize();announce(on?'Carte en plein écran':'Plein écran fermé');
  (on?cv:$('#fsBtn').offsetParent?$('#fsBtn'):$('#fs')).focus({preventScroll:true});
}
export async function ensureLevel(){
  const l=+$('#lvl').value,res=$('#res').value,key=lkey(l,res);
  if(!l||S.levels[key]){draw();return;}
  try{
    await loadNuts(res);
    if(!S.levels[key]){setStatus(`Téléchargement des contours NUTS ${l} (${res})…`);
      S.levels[key]=await addUK(prepNuts((await gisco(`NUTS_RG_${res}_2024_4326_LEVL_${l}.geojson`)).features),l,res);}
    if(!S.running)setStatus(`Contours NUTS ${l} chargés (${S.levels[key].length} zones).`);
  }catch(e){setStatus('Contours NUTS indisponibles : '+e.message,true);}
  draw();
}
// écouteurs de la carte (pointeurs, clavier, contrôles) ; la sélection passe par les actions de l'orchestration
export function initMap(h){
  H=h;
  $('#legendBody').innerHTML=MARKERS.map(m=>markerSvg(m)+' '+esc(m.label)).join('<br>')+'<br><span class="muted">Cliquez un point ou une zone</span>';
  cv.addEventListener('pointerdown',e=>{
    cv.setPointerCapture(e.pointerId);
    if(e.pointerType==='touch')PTR.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(PTR.size>=2){MAP.drag=null;const g=pinchGeom();MAP.pinch={z:MAP.z,d:g.d,m:toMerc(g.mx,g.my)};}
    else{MAP.drag={x:e.clientX,y:e.clientY,c:center(),moved:false};cv.classList.add('drag');}
  });
  cv.addEventListener('pointermove',e=>{
    if(PTR.has(e.pointerId))PTR.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(MAP.pinch&&PTR.size>=2){
      const g=pinchGeom();MAP.z=pinchZoom(MAP.pinch.z,MAP.pinch.d,g.d);const s=scale();
      setCenter(...unmerc(MAP.pinch.m[0]-(g.mx-MAP.W/2)/s,MAP.pinch.m[1]-(g.my-MAP.H/2)/s));draw();return;}
    const d=MAP.drag;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.moved&&Math.abs(dx)+Math.abs(dy)<(coarse()?10:4))return;d.moved=true;const s=scale();setCenter(...unmerc(d.c[0]-dx/s,d.c[1]-dy/s));draw();});
  cv.addEventListener('pointerup',e=>{endPointer(e);const d=MAP.drag;MAP.drag=null;cv.classList.remove('drag');
    if(d&&!d.moved){const r=cv.getBoundingClientRect();onMapClick(e.clientX-r.left,e.clientY-r.top);}});
  cv.addEventListener('pointercancel',e=>{endPointer(e);MAP.drag=null;cv.classList.remove('drag');});
  cv.addEventListener('wheel',e=>{e.preventDefault();if(Date.now()-MAP.lastWheel<180)return;MAP.lastWheel=Date.now();
    const r=cv.getBoundingClientRect();zoomAt(e.deltaY<0?1:-1,e.clientX-r.left,e.clientY-r.top);},{passive:false});
  cv.addEventListener('dblclick',e=>{const r=cv.getBoundingClientRect();zoomAt(1,e.clientX-r.left,e.clientY-r.top);});
  cv.addEventListener('keydown',e=>{
    const a=mapKeyAction(e);if(!a)return;e.preventDefault();
    if(a.pan){const s=scale(),c=center();setCenter(...unmerc(c[0]+a.pan[0]/s,c[1]+a.pan[1]/s));draw();}
    else if(a.zoom)zoomAt(a.zoom,MAP.W/2,MAP.H/2);
    else if(a.fit){fit();announce('Carte ajustée aux points');}
    else if(a.step)H.step(a.step);
    else if(a.close){if(MAP.full)return;H.clear();announce('Sélection fermée');}
  });
  $('#zin').onclick=()=>zoomAt(1,MAP.W/2,MAP.H/2);
  $('#zout').onclick=()=>zoomAt(-1,MAP.W/2,MAP.H/2);
  $('#fit').onclick=fit;
  for(const [id,k] of [['#base','base'],['#cartoKey','key'],['#tileUrl','url']]){$(id).addEventListener('change',()=>{MAP.tileErr=0;});const v=prefGet(k);if(v!==null&&(id!=='#base'||BASES[v]))$(id).value=v;
    $(id).addEventListener(id==='#base'?'change':'input',()=>{prefSet(k,$(id).value);if(id==='#base')baseUI();draw();});}
  baseUI();
  $('#lvl').onchange=()=>{MAP.selZone=null;hidePop();ensureLevel();};
  $('#res').onchange=()=>{if(+$('#lvl').value)ensureLevel();};
  $('#withUK').onchange=()=>{MAP.selZone=null;hidePop();if(+$('#lvl').value)ensureLevel();};
  $('#onlyWith').onchange=draw;$('#choro').onchange=draw;
  $('#png').onclick=()=>{
    const save=()=>cv.toBlob(b=>b?download(b,'carte_nuts.png'):setStatus('Export PNG impossible.',true),'image/png');
    try{save();}catch(e){
      MAP.noTiles=true;paint();
      try{save();setStatus('Fond de carte non exportable (CORS) : carte exportée avec contours et points, sans fond.');}
      catch(e2){setStatus('Export PNG impossible : '+e2.message,true);}
      MAP.noTiles=false;draw();
    }};
  new ResizeObserver(resize).observe($('#mapwrap'));
  $('#fs').onclick=()=>setFull(!MAP.full);$('#fsBtn').onclick=()=>setFull(!MAP.full);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&MAP.full)setFull(false);});
  $('#pop').addEventListener('click',e=>{
    const b=e.target.closest('[data-go]');if(!b)return;
    if(MAP.full)setFull(false);
    H.go(b.dataset.go);
  });
}
