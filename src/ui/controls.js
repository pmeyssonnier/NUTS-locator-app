import {$} from './dom.js';
import {S} from './state.js';

export function btns(){$('#run').disabled=S.running||!S.rows.length;$('#stop').disabled=!S.running;$('#exp').disabled=$('#expAno').disabled=$('#expCsv').disabled=$('#expGeo').disabled=!S.rows.length;
  for(const id of ['#file','#sample','#withUK','#res','#maxKm','#defPays','#nomUrl','#email','#onlyMissing','#clearCache','#geoFiles','#restore','#forget','#sheet'])$(id).disabled=S.running;$('#mapBox').querySelectorAll('select').forEach(x=>x.disabled=S.running);}
