import {$} from './dom.js';
import {FIELDS, getMap, S} from './state.js';

// Section 2 : colonnes, réglages et imports sont repliés ; leur résumé garde l'essentiel visible (sur mobile, la section dépassait un écran).
const SHORT={adr:'Adresse',num:'N°',cp:'Code postal',ville:'Ville',pays:'Pays'};
export function updateSummaries(){
  const m=S.headers.length?getMap():{},used=FIELDS.map(([k])=>m[k]&&`${SHORT[k]} « ${m[k]} »`).filter(Boolean);
  const none=!m.adr&&!m.cp&&!m.ville;
  $('#sMap').textContent=!S.headers.length?'Colonnes (après import d\'un fichier)':none?'⚠ Colonnes à indiquer (adresse, code postal, ville)':'Colonnes : '+used.join(' · ');
  if(none&&S.headers.length)$('#dMap').open=true;
  $('#sSet').textContent=`Réglages : pays par défaut ${$('#defPays').value||'—'} · contours ${$('#res').value} · tolérance ${$('#maxKm').value||0} km${$('#withUK').checked?' · Royaume-Uni':''}`;
  const n=Object.keys(S.postal).length,warn=$('#storeInfo').classList.contains('warn');
  $('#sImp').textContent=(warn?'⚠ ':'')+`Imports hors ligne : ${n?`tables Eurostat de ${n} pays`:'aucune table Eurostat'}${warn?' · stockage temporaire':''}`;
}
export function initFolds(){
  for(const ev of ['change','input'])$('#sec-geo').addEventListener(ev,updateSummaries);
  updateSummaries();
}
