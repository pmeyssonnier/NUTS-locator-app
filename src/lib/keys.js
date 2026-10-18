
// --- Clavier : actions de la carte et navigation dans une liste (pures, testées sous Node) ---
// e = événement clavier (key, shiftKey, ctrlKey, altKey, metaKey) → action ou null si la touche n'est pas gérée
export function mapKeyAction(e){
  if(e.ctrlKey||e.metaKey||e.altKey)return null;
  const d=e.shiftKey?240:80;                                   // pas de déplacement en pixels
  switch(e.key){
    case 'ArrowLeft':return {pan:[-d,0]};case 'ArrowRight':return {pan:[d,0]};
    case 'ArrowUp':return {pan:[0,-d]};case 'ArrowDown':return {pan:[0,d]};
    case '+':case '=':return {zoom:1};case '-':case '_':return {zoom:-1};
    case '0':case 'Home':return {fit:true};
    case 'PageDown':return {step:1};case 'PageUp':return {step:-1};
    case 'Escape':return {close:true};
    default:return null;}
}
// nouvel index de ligne selon la touche (sans rebouclage), null si la touche n'est pas gérée ou la liste vide
export function moveIndex(key,cur,n){
  if(!(n>0))return null;const last=n-1,c=Math.max(0,Math.min(last,cur));
  switch(key){
    case 'ArrowDown':return Math.min(last,c+1);case 'ArrowUp':return Math.max(0,c-1);
    case 'PageDown':return Math.min(last,c+10);case 'PageUp':return Math.max(0,c-10);
    case 'Home':return 0;case 'End':return last;
    default:return null;}
}
// point suivant (dir=1) ou précédent (dir=-1) avec rebouclage ; cur<0 = aucun sélectionné ; -1 si la liste est vide
export function stepIndex(cur,n,dir){
  if(!(n>0))return -1;
  if(cur<0)return dir>0?0:n-1;
  return (cur+dir+n)%n;
}
