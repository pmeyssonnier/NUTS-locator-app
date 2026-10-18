export const $=s=>document.querySelector(s);
export const coarse=()=>matchMedia('(pointer:coarse)').matches;
export const smooth=()=>matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth';
// annonce vocale (lecteurs d'écran) ; vidé puis rempli pour que le même texte soit relu
export function announce(t){const l=$('#live');l.textContent='';setTimeout(()=>{l.textContent=t;},50);}
export function setStatus(t,err){const s=$('#status');s.textContent=t;s.className=err?'err':'';if(err)announce(String(t).split('\n')[0]);}
export function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
