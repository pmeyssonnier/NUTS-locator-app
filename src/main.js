import {initMap, resize} from './ui/map.js';
import {render} from './ui/render.js';
import {selectRow, clearSelection, stepPoint, goToRow} from './ui/select.js';
import {initFiles, buildMap} from './ui/files.js';
import {initResults} from './ui/results.js';
import {initRun} from './ui/run.js';
import {initCache} from './ui/cache.js';
import {initExports} from './ui/exports.js';
import {initLayout} from './ui/layout.js';
import {initSession} from './ui/session.js';
import {btns} from './ui/controls.js';
import {runSelfTests} from './ui/selftests.js';

// Point d'entrée : branche les modules entre eux (la carte et le tableau reçoivent leurs actions ici)
initMap({select: selectRow, clear: clearSelection, step: stepPoint, render, go: goToRow});
initFiles();
initResults();
initRun();
initCache();
initExports();
initLayout();
initSession();

buildMap();
btns();
resize();
if (location.hash === '#tests') runSelfTests();
