'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('./lib');

test('markerStyle : une forme et une couleur par statut',()=>{
  assert.deepEqual([L.markerStyle('OK').shape,L.markerStyle('OK').color],['circle','#12805c']);
  assert.deepEqual([L.markerStyle('A_VERIFIER').shape,L.markerStyle('A_VERIFIER').color],['triangle','#ca8a04']);
  assert.deepEqual([L.markerStyle('NUTS_PROCHE').shape,L.markerStyle('NUTS_PROCHE').color],['diamond','#d97706']);
});

test('markerStyle : statuts d\'erreur, inconnus ou absents → carré rouge',()=>{
  for(const s of ['PAYS_INCOHERENT','HORS_NUTS','ECHEC_GEOCODAGE','ERREUR','','XYZ',undefined,null]){
    assert.deepEqual([L.markerStyle(s).shape,L.markerStyle(s).color],['square','#c0262d'],String(s));
  }
});

test('MARKERS : formes toutes différentes (la forme suffit sans la couleur) et statuts jamais en double',()=>{
  const shapes=L.MARKERS.map(m=>m.shape);
  assert.equal(new Set(shapes).size,shapes.length);
  const statuts=L.MARKERS.flatMap(m=>m.statuts);
  assert.equal(new Set(statuts).size,statuts.length);
  assert.deepEqual(L.MARKERS[L.MARKERS.length-1].statuts,[]);                  // entrée par défaut en dernier
  assert.equal(new Set(L.MARKERS.map(m=>m.color)).size,L.MARKERS.length);      // couleurs distinctes aussi
});

test('MARKER_PTS : sommets de chaque forme polygonale, centrés',()=>{
  assert.deepEqual(Object.keys(L.MARKER_PTS).sort(),['diamond','square','triangle']);
  assert.equal(L.MARKER_PTS.triangle.length,3);assert.equal(L.MARKER_PTS.diamond.length,4);assert.equal(L.MARKER_PTS.square.length,4);
  for(const [shape,pts] of Object.entries(L.MARKER_PTS)){
    const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
    assert.ok(Math.abs(cx)<0.01,`${shape} centré en x`);
    assert.ok(Math.abs(cy)<0.3,`${shape} approximativement centré en y (${cy.toFixed(2)})`);   // le triangle est centré sur sa hauteur, pas son centre de gravité
    for(const [x,y] of pts)assert.ok(Math.hypot(x,y)<=1.8,`${shape} reste proche du rayon`);
  }
});

test('markerSvg : cercle ou polygone, couleur, décoratif',()=>{
  const c=L.markerSvg(L.markerStyle('OK'));
  assert.match(c,/<circle cx="7" cy="7" r="5" fill="#12805c"/);assert.match(c,/aria-hidden="true"/);assert.doesNotMatch(c,/<polygon/);
  const t=L.markerSvg(L.markerStyle('A_VERIFIER'));
  assert.match(t,/<polygon points="[\d., -]+" fill="#ca8a04"/);assert.equal(t.match(/points="([^"]+)"/)[1].split(' ').length,3);
  assert.equal(L.markerSvg(L.markerStyle('NUTS_PROCHE')).match(/points="([^"]+)"/)[1].split(' ').length,4);
  assert.match(L.markerSvg(L.markerStyle('HORS_NUTS'),20,8),/width="20" height="20" viewBox="0 0 20 20"/);
});

test('markerSvg : les coordonnées restent dans la pastille',()=>{
  for(const m of L.MARKERS){
    const pts=(L.markerSvg(m).match(/points="([^"]+)"/)||[,''])[1].split(' ').filter(Boolean).flatMap(p=>p.split(',').map(Number));
    for(const v of pts)assert.ok(v>=0&&v<=14,`${m.shape} : ${v} dans [0,14]`);
  }
});
