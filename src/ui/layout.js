import {$} from './dom.js';
import {render} from './render.js';
import {S} from './state.js';

export function initLayout(){
  matchMedia('(max-width:720px)').addEventListener('change',e=>{S.cards=e.matches;if(e.matches)$('#legend').open=false;render();});
  if(S.cards)$('#legend').open=false;
  // barre de sections : met en évidence la section visible
  if('IntersectionObserver' in window){
    const links=[...document.querySelectorAll('#tabbar a')];
    const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){
      links.forEach(a=>a.removeAttribute('aria-current'));links.find(a=>a.getAttribute('href')==='#'+e.target.id)?.setAttribute('aria-current','true');}},
      {rootMargin:'-35% 0px -55% 0px'});
    for(const id of ['sec-data','sec-geo','sec-results','sec-map'])io.observe(document.getElementById(id));
  }
  // tout en haut de la page, la première section est la section courante
  addEventListener('scroll',()=>{if(scrollY<60){const a=document.querySelector('#tabbar a');document.querySelectorAll('#tabbar a').forEach(x=>x.removeAttribute('aria-current'));a.setAttribute('aria-current','true');}},{passive:true});
}
