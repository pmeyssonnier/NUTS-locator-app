'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('./lib');

const sq=(lon,lat,d)=>[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]];
const feat=(id,type,coordinates)=>({type:'Feature',properties:{NUTS_ID:id,NAME_LATN:id},geometry:{type,coordinates}});
const km=lat=>1/(111.32*Math.cos(lat*Math.PI/180));
// BE100 : carré avec un trou ; BE241 : deux îlots
const N=L.prepNuts([
  feat('BE100','Polygon',[sq(4.35,50.85,0.1),sq(4.35,50.85,0.025)]),
  feat('BE241','MultiPolygon',[[sq(5.0,50.85,0.05)],[sq(5.3,50.85,0.05)]])
]);

test('prepNuts : ignore les entités sans géométrie, calcule l\'emprise',()=>{
  const r=L.prepNuts([{type:'Feature',properties:{NUTS_ID:'XX',NAME_LATN:'x'},geometry:null},feat('BE100','Polygon',[sq(4.35,50.85,0.1)])]);
  assert.equal(r.length,1);assert.equal(r[0].id,'BE100');
  assert.deepEqual(r[0].b.map(v=>+v.toFixed(2)),[4.25,50.75,4.45,50.95]);
});

test('inRing : point dans / hors d\'un anneau',()=>{
  const ring=sq(0,0,1);
  assert.equal(L.inRing(0,0,ring),true);assert.equal(L.inRing(2,0,ring),false);assert.equal(L.inRing(0,-2,ring),false);
});

test('findNuts : point dans le polygone, dans un trou, multipolygone',()=>{
  assert.equal(L.findNuts(N,4.30,50.80).id,'BE100');
  assert.equal(L.findNuts(N,4.30,50.80).exact,true);
  assert.equal(L.findNuts(N,4.35,50.85),null);                     // dans le trou, sans tolérance
  assert.equal(L.findNuts(N,5.3,50.85).id,'BE241');                 // 2e partie du multipolygone
  assert.equal(L.findNuts(N,9,40),null);
});

test('findNuts : tolérance en km autour des contours',()=>{
  const k=km(50.85);
  const p=L.findNuts(N,4.45+0.5*k,50.85,3);
  assert.equal(p.id,'BE100');assert.equal(p.exact,false);assert.ok(Math.abs(p.km-0.5)<0.05,`km=${p.km}`);
  assert.ok(L.findNuts(N,4.45+2.9*k,50.85,3).km<3);
  assert.equal(L.findNuts(N,4.45+3.1*k,50.85,3),null);
  assert.equal(L.findNuts(N,4.45+0.5*k,50.85,0),null);              // tolérance 0 : aucun rattachement forcé
});

test('findNuts : le point dans un trou est rattaché au bord le plus proche avec une tolérance',()=>{
  const r=L.findNuts(N,4.35,50.85,5);
  assert.equal(r.id,'BE100');assert.equal(r.exact,false);assert.ok(r.km>0&&r.km<5);
});

test('distRingKm : distance à un anneau',()=>{
  const ring=sq(0,0,1);
  assert.ok(Math.abs(L.distRingKm(0,2,ring)-111.32)<1,'1° de latitude ≈ 111 km');
  assert.ok(L.distRingKm(1,0,ring)<0.01,'point sur le bord');
});
