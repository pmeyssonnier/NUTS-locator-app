import {draw} from './map.js';
import {renderList} from './table.js';

export function render(){renderList();draw();}
let renderTimer=0;
// pendant le géocodage, pas de reconstruction du tableau tant que le focus y est (sinon la ligne est relue en boucle) ; rendu final à la fin
export const renderSoon=()=>{if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=0;if(!document.activeElement?.closest?.('#tbody,#thead,#cards')&&!document.querySelector('#cards details[open]'))render();},300);};
