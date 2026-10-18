// nombre de cartes à afficher : au moins `max`, et jusqu'à l'index `need` inclus (arrondi au pas)
export function cardsLimit(max,need,step=60){return need<max?max:Math.ceil((need+1)/step)*step;}
export const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
export const isNum=v=>typeof v==='number'&&isFinite(v);
