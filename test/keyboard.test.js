'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('./lib');

const K=(key,o={})=>({key,shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,...o});

test('mapKeyAction : flèches = déplacement, Maj = pas plus grand',()=>{
  assert.deepEqual(L.mapKeyAction(K('ArrowLeft')),{pan:[-80,0]});
  assert.deepEqual(L.mapKeyAction(K('ArrowRight')),{pan:[80,0]});
  assert.deepEqual(L.mapKeyAction(K('ArrowUp')),{pan:[0,-80]});
  assert.deepEqual(L.mapKeyAction(K('ArrowDown')),{pan:[0,80]});
  assert.deepEqual(L.mapKeyAction(K('ArrowRight',{shiftKey:true})),{pan:[240,0]});
});

test('mapKeyAction : zoom, ajustement, point suivant/précédent, fermeture',()=>{
  for(const k of ['+','=']){assert.deepEqual(L.mapKeyAction(K(k)),{zoom:1},k);}
  for(const k of ['-','_']){assert.deepEqual(L.mapKeyAction(K(k)),{zoom:-1},k);}
  assert.deepEqual(L.mapKeyAction(K('+',{shiftKey:true})),{zoom:1});             // « + » demande Maj sur un clavier AZERTY
  assert.deepEqual(L.mapKeyAction(K('0')),{fit:true});assert.deepEqual(L.mapKeyAction(K('Home')),{fit:true});
  assert.deepEqual(L.mapKeyAction(K('PageDown')),{step:1});assert.deepEqual(L.mapKeyAction(K('PageUp')),{step:-1});
  assert.deepEqual(L.mapKeyAction(K('Escape')),{close:true});
});

test('mapKeyAction : touches non gérées et raccourcis du navigateur laissés intacts',()=>{
  for(const k of ['Tab','Enter','a','F5','Shift'])assert.equal(L.mapKeyAction(K(k)),null,k);
  for(const m of ['ctrlKey','altKey','metaKey'])assert.equal(L.mapKeyAction(K('+',{[m]:true})),null,m);   // Ctrl +/− = zoom du navigateur
  assert.equal(L.mapKeyAction(K('ArrowLeft',{altKey:true})),null);                                            // Alt+← = page précédente
});

test('moveIndex : navigation dans le tableau, sans rebouclage',()=>{
  assert.equal(L.moveIndex('ArrowDown',0,5),1);assert.equal(L.moveIndex('ArrowDown',4,5),4);
  assert.equal(L.moveIndex('ArrowUp',3,5),2);assert.equal(L.moveIndex('ArrowUp',0,5),0);
  assert.equal(L.moveIndex('Home',3,5),0);assert.equal(L.moveIndex('End',1,5),4);
  assert.equal(L.moveIndex('PageDown',2,30),12);assert.equal(L.moveIndex('PageDown',25,30),29);
  assert.equal(L.moveIndex('PageUp',12,30),2);assert.equal(L.moveIndex('PageUp',3,30),0);
});

test('moveIndex : touche non gérée, liste vide, index hors limites',()=>{
  assert.equal(L.moveIndex('Tab',0,5),null);assert.equal(L.moveIndex('a',0,5),null);
  assert.equal(L.moveIndex('ArrowDown',0,0),null);assert.equal(L.moveIndex('End',0,0),null);
  assert.equal(L.moveIndex('ArrowDown',-1,5),1);assert.equal(L.moveIndex('ArrowUp',99,5),3);
});

test('stepIndex : point suivant / précédent avec rebouclage',()=>{
  assert.equal(L.stepIndex(0,3,1),1);assert.equal(L.stepIndex(2,3,1),0);       // rebouclage vers le début
  assert.equal(L.stepIndex(0,3,-1),2);assert.equal(L.stepIndex(1,3,-1),0);     // rebouclage vers la fin
  assert.equal(L.stepIndex(-1,3,1),0);assert.equal(L.stepIndex(-1,3,-1),2);    // rien de sélectionné
  assert.equal(L.stepIndex(0,1,1),0);assert.equal(L.stepIndex(0,0,1),-1);assert.equal(L.stepIndex(-1,0,-1),-1);
});
