import {$} from './dom.js';
import {updateSummaries} from './folds.js';
import {requestPersist, storageInfo} from './storage.js';

// Ligne d'état du stockage sous les imports : contours, tables et cache ne survivent que si le navigateur les conserve.
// ask=true (après un import, donc à la suite d'un geste de l'utilisateur) demande au navigateur un stockage durable.
export async function refreshStorage(ask=false){
  if(ask)await requestPersist();
  const {idb,persisted}=await storageInfo(),el=$('#storeInfo');
  el.classList.toggle('warn',!idb);el.classList.toggle('muted',idb);
  el.textContent=!idb
    ?'⚠ Stockage du navigateur indisponible : contours, tables et cache de géocodage ne sont gardés qu\'en mémoire et seront perdus à la fermeture de l\'onglet (fenêtre privée, stockage bloqué ou plein). Il faudra tout réimporter à chaque visite.'
    :persisted===true?'Stockage durable : les contours et les tables importés sont conservés d\'une visite à l\'autre.'
    :'Stockage non garanti : le navigateur peut effacer les contours et les tables importés (fenêtre privée, nettoyage automatique des données de site, disque presque plein).';
  if(!idb)$('#dImp').open=true;      // l'avertissement ne doit pas rester caché dans une section repliée
  updateSummaries();
}
