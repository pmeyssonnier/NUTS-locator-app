'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('./lib');

test('tileScale : zoom entier → tuiles de 256 px',()=>{
  assert.deepEqual(L.tileScale(12),{zt:12,ts:256});assert.deepEqual(L.tileScale(4),{zt:4,ts:256});
});

test('tileScale : zoom fractionnaire → niveau entier le plus proche, tuile étirée ou réduite',()=>{
  const a=L.tileScale(12.4);assert.equal(a.zt,12);assert.ok(Math.abs(a.ts-256*2**0.4)<1e-9);
  const b=L.tileScale(12.6);assert.equal(b.zt,13);assert.ok(Math.abs(b.ts-256*2**-0.4)<1e-9);
  for(let z=2;z<=18;z+=0.137){const {ts}=L.tileScale(z);assert.ok(ts>=256/Math.SQRT2-1e-9&&ts<=256*Math.SQRT2+1e-9,`z=${z} ts=${ts}`);}   // jamais plus d'un facteur √2
});

test('tileScale : la taille d\'une tuile couvre bien le monde (n tuiles × ts = 256·2^z)',()=>{
  for(const z of [3,5.3,9.9,12.5,17.77]){const {zt,ts}=L.tileScale(z);assert.ok(Math.abs(2**zt*ts-256*2**z)<1e-6,String(z));}
});

test('tileScale : bornes du niveau de tuiles',()=>{
  assert.equal(L.tileScale(-3).zt,0);assert.equal(L.tileScale(25).zt,19);
});

test('pinchZoom : écarter les doigts zoome, les rapprocher dézoome',()=>{
  assert.ok(Math.abs(L.pinchZoom(10,100,200)-11)<1e-9);          // doigts 2× plus écartés → +1 niveau
  assert.ok(Math.abs(L.pinchZoom(10,100,50)-9)<1e-9);            // 2× plus proches → −1 niveau
  assert.ok(Math.abs(L.pinchZoom(10,100,400)-12)<1e-9);
  assert.equal(L.pinchZoom(10,100,100),10);                      // aucun mouvement
  assert.ok(Math.abs(L.pinchZoom(10,100,141.4213562)-10.5)<1e-6);
});

test('pinchZoom : bornes et valeurs dégénérées',()=>{
  assert.equal(L.pinchZoom(17,100,1000),18);assert.equal(L.pinchZoom(3,100,10),2);
  assert.equal(L.pinchZoom(10,100,1000,2,12),12);assert.equal(L.pinchZoom(10,100,1,5,18),5);
  assert.equal(L.pinchZoom(10,0,100),10);assert.equal(L.pinchZoom(10,100,0),10);assert.equal(L.pinchZoom(10,NaN,5),10);
  assert.equal(L.pinchZoom(25,0,0),18);                          // même un zoom de départ hors bornes est ramené dans les bornes
});

test('pinchZoom : enchaîner deux pincements équivaut à un seul (propriété logarithmique)',()=>{
  const z1=L.pinchZoom(8,100,160),z2=L.pinchZoom(z1,160,320);
  assert.ok(Math.abs(z2-L.pinchZoom(8,100,320))<1e-9);
});

test('cardsLimit : pagination de la liste de cartes',()=>{
  assert.equal(L.cardsLimit(60,0),60);assert.equal(L.cardsLimit(60,59),60);
  assert.equal(L.cardsLimit(60,60),60*2);assert.equal(L.cardsLimit(60,119),120);assert.equal(L.cardsLimit(60,120),180);
  assert.equal(L.cardsLimit(60,500),540);assert.equal(L.cardsLimit(30,45,30),60);
  assert.ok(L.cardsLimit(60,61)>61);                             // la ligne demandée est toujours incluse
});
