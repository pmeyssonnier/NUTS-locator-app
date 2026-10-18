# NUTS Locator

Application web (JavaScript natif, sans dépendance ni étape de compilation) qui :

1. importe un fichier Excel (`.xlsx`) ou CSV contenant des adresses ;
2. géocode chaque adresse avec Nominatim (OpenStreetMap) ;
3. rattache le point aux codes **NUTS 0/1/2/3** d'Eurostat (NUTS 2024 ; Royaume-Uni en NUTS 2021) ;
4. affiche les résultats dans un tableau et sur une carte ;
5. exporte en `.xlsx`, `.csv` ou GeoJSON.

## Utilisation

Utilisez un navigateur récent (Chrome 116+, Firefox 124+, Safari 17.4+). Le code est découpé en modules ES : la page doit être **servie en HTTP(S)**, elle ne fonctionne pas ouverte directement depuis un fichier (`file://`, un bandeau l'indique).

- **En ligne** : la version publiée sur GitHub Pages (fichiers statiques, rien à configurer).
- **En local** : `npm start` dans le dossier du projet (petit serveur sans dépendance, Node 20+), puis ouvrez http://localhost:8000. Tout autre serveur statique convient (`python3 -m http.server`, `npx serve`…).

1. **Données** : chargez votre fichier, ou cliquez sur « Charger l'exemple ».
2. **Colonnes & géocodage** : vérifiez le mappage (Adresse, Numéro, Code postal, Ville, Pays), renseignez votre e-mail (politique Nominatim), puis cliquez sur « Géocoder ».
3. **Résultats** : filtrez, triez, exportez. « Exporter les lignes à contrôler » isole les lignes dont le statut n'est pas `OK` ou la confiance pas `HAUTE`.
4. **Carte** : choisissez le niveau de contours NUTS et le fond de carte.

**Classeur à plusieurs feuilles** : si le fichier `.xlsx` contient plusieurs feuilles, une liste « Feuille » apparaît. La première feuille visible est chargée par défaut ; vous pouvez choisir une autre feuille (les feuilles masquées sont signalées) ou « Toutes les feuilles », qui fusionne les feuilles visibles : les colonnes sont alignées par nom d'en-tête, et une colonne « Feuille » indique l'origine de chaque ligne. Les feuilles vides ou réduites à un en-tête sont ignorées.

Le fichier d'exemple se trouve dans [`exemples/exemple_societes_europe.xlsx`](exemples/exemple_societes_europe.xlsx) (27 sociétés européennes, contacts fictifs). Il contient les colonnes `Société`, `Nom`, `Prénom`, `Adresse`, `Code postal`, `Ville`, `Pays`. Le pays peut être un code ISO (`BE`, `UK`, `EL`) ou un nom (« Belgique », « Germany »).

Un second exemple, [`exemples/exemple_multi_feuilles.xlsx`](exemples/exemple_multi_feuilles.xlsx), a trois feuilles (dont une masquée) avec des colonnes dans des ordres différents, pour essayer la liste « Feuille » et la fusion.

## Stratégie de géocodage

Pour chaque ligne, l'application essaie la rue sous plusieurs formes, de la plus fidèle à la plus simplifiée, chacune en recherche structurée puis en recherche libre : l'adresse telle quelle, sans abréviation de type de voie (« ul. », « bd. »…), sans complément après une virgule (« Abbey Road, Whitley » → « Abbey Road »), puis les deux. Le numéro est ajouté après avoir retiré le complément, pour ne pas le perdre. **Un complément ignoré rend le résultat douteux** : le complément (« Whitley ») peut désigner un autre quartier, donc une rue de même nom ailleurs dans la ville. L'adresse trouvée ainsi est classée `A_VERIFIER` (confiance `MOYENNE` au plus), avec la position de la rue et une note, sauf si le code postal saisi est retrouvé à l'identique. Retirer une abréviation (« ul. ») ne change pas le sens de l'adresse et ne déclenche pas ce doute. Si aucune adresse n'aboutit, elle se rabat sur le code postal puis sur la ville (confiance `FAIBLE`, statut `A_VERIFIER`).

L'ordre des essais est **appris pays par pays** pendant la session : un essai qui n'a jamais réussi pour un pays après deux échecs passe en dernier recours (il reste tenté s'il le faut, et reprend sa place dès qu'il réussit). Cela évite, par exemple, de perdre une requête par ligne quand la recherche structurée n'aboutit jamais pour la Pologne ou la Tchéquie. Seuls les résultats au niveau de la rue ou du bâtiment servent à apprendre. Les libellés Eurostat sont nettoyés (espaces en trop retirés).

## Statut et confiance

| Statut | Signification |
|---|---|
| `OK` | Code NUTS fiable |
| `NUTS_PROCHE` | Point hors contour, mais dans la tolérance en km |
| `A_VERIFIER` | Repli sur le code postal ou la ville, résultat imprécis, ou code postal différent |
| `PAYS_INCOHERENT` | Pays trouvé ou NUTS0 différent du pays saisi |
| `HORS_NUTS`, `ECHEC_GEOCODAGE`, `ERREUR` | Pas de code NUTS exploitable |

La **confiance** (`HAUTE`, `MOYENNE`, `FAIBLE`) mesure la précision de la localisation. `HAUTE` exige un bâtiment trouvé, un code postal identique et un point dans le contour. La colonne `controle_manuel` vaut `OUI` dès que la confiance n'est pas `HAUTE`.

## Utilisation sur téléphone et tablette

L'interface s'adapte aux petits écrans (jusqu'à 720 px de large, par exemple un téléphone en portrait) :

- **Liste de cartes** à la place du tableau à une trentaine de colonnes : une carte par ligne avec le nom, l'adresse, le statut (forme **et** couleur), le code NUTS 3 et sa confiance, la note de contrôle. « Toutes les données » déplie les autres colonnes visibles. Les cartes s'affichent par paquets de 60 (« Afficher plus »). Le filtre fonctionne comme sur le bureau, et une liste « Trier par » avec un bouton « Sens » remplace les en-têtes de colonnes.
- **Barre de sections** fixée en bas de l'écran : Données, Géocodage, Résultats, Carte (la section visible est mise en évidence).
- **Carte tactile** : un doigt pour déplacer, deux doigts pour zoomer (pincement fluide, le point entre les doigts reste en place), toucher un point pour afficher sa fiche, puis « Voir dans la liste » pour retrouver sa ligne. « Voir sur la carte » sur une carte fait l'inverse. Les cibles tactiles font au moins 44 px, et la zone de toucher d'un point est élargie.
- **Plein écran** pour la carte (bouton ⛶ sur la carte, ou « Carte en plein écran » sous la liste) ; `Échap` ou ✕ pour en sortir.
- **Légende** repliée par défaut sur petit écran, pour ne pas masquer la carte.
- Champs en 16 px (pas de zoom automatique sur iPhone), formulaires sur une ou deux colonnes, aucun défilement horizontal de la page. En paysage (plus de 720 px), le tableau revient.

## Accessibilité clavier

- **Accès rapide** : au premier `Tab`, des liens permettent de sauter aux résultats ou à la carte.
- **Tableau** : `Tab` entre dans le tableau (une seule ligne dans l'ordre de tabulation) ; `↑` `↓`, `Début`, `Fin`, `Page ↑` `Page ↓` changent de ligne ; `Entrée` affiche la ligne sur la carte et donne le focus à la carte ; `Tab` sort du tableau. `Entrée` ou `Espace` sur un en-tête trie la colonne (`aria-sort`).
- **Carte** (quand elle a le focus) : `←` `↑` `→` `↓` déplacent la carte (`Maj` : plus loin) ; `+` et `−` zooment ; `0` ou `Début` ajustent la carte aux points ; `Page ↓` / `Page ↑` passent au point suivant / précédent ; `Échap` ferme l'info. Sur un clavier AZERTY, `+` et `0` demandent `Maj` ; les boutons de zoom restent accessibles par `Tab`.
- **Lecteurs d'écran** : la sélection d'une ligne, le tri, la fin du géocodage et les erreurs sont annoncés (zone `aria-live`) ; l'indicateur de focus est visible partout.
- **Points de la carte** : le statut est indiqué par la forme **et** la couleur, pour rester lisible sans distinguer les couleurs : ● cercle vert = `OK`, ▲ triangle jaune = `A_VERIFIER`, ◆ losange orange = `NUTS_PROCHE`, ■ carré rouge = pays incohérent, hors NUTS ou échec. La légende est générée depuis la même définition que les points.
- **Limites** : les zones NUTS de la carte ne se sélectionnent qu'à la souris (les codes NUTS de chaque point sont dans le tableau).

## Confidentialité et limites

- Seuls les champs Adresse, Numéro, Code postal, Ville et Pays sont envoyés au serveur Nominatim choisi. Les autres colonnes restent dans le navigateur.
- Les réponses du géocodeur et les contours NUTS sont gardés dans le navigateur (IndexedDB). Le bouton « Vider le cache » efface le cache de géocodage.
- La dernière session (données importées et résultats, sans l'e-mail) est aussi conservée dans le navigateur : au rechargement, un bouton « Restaurer la session » la rétablit, et « Oublier la session » l'efface. Elle est enregistrée pendant le géocodage (toutes les 50 lignes) et à la fin.
- Le serveur public Nominatim est limité à 1 requête par seconde et n'est pas prévu pour du géocodage massif. Pour de gros volumes, renseignez un serveur Nominatim auto-hébergé.
- Le numéro est placé avant la rue pour FR, GB, IE et LU, après pour les autres pays.
- Les territoires d'outre-mer français (Guadeloupe, Martinique, Guyane, Réunion, Mayotte) et Åland sont rattachés à leur pays NUTS0 (FR, FI) : ils ne déclenchent plus de faux `PAYS_INCOHERENT`.
- Le géocodage s'arrête après 5 erreurs consécutives (réseau ou serveur indisponible).
- Si GISCO est bloqué par un pare-feu, importez les fichiers `NUTS_RG_…_4326_LEVL_n.geojson` avec « Importer des contours ».

## Structure du code

```
index.html          balisage de la page
css/style.css       styles (bureau, mobile, mode sombre)
src/main.js         point d'entrée : branche les modules entre eux
src/lib/            logique pure, sans DOM ni réseau (importable par Node)
  xml.js zip.js xlsx.js    lecture et écriture des classeurs .xlsx (feuilles multiples, fusion)
  csv.js                   lecture CSV, cellule d'export CSV
  geo.js                   point dans polygone, distance, rattachement NUTS
  postal.js                pays, codes postaux, ordre numéro/rue, règle de statut
  geocode.js               stratégie de géocodage d'une ligne, rattachement NUTS, synthèse
  markers.js keys.js mapmath.js util.js sample.js   marqueurs, touches, zoom, outils, exemple
  index.js                 point d'entrée unique de la logique pure
src/ui/             interface (DOM)
  dom.js state.js storage.js     utilitaires, état partagé, IndexedDB et préférences
  nuts.js nominatim.js           contours GISCO, appels Nominatim (cache, limite de débit)
  rows.js table.js map.js        fiche d'une ligne, tableau et cartes, carte canvas
  render.js select.js            rendu d'ensemble, sélection d'une ligne
  files.js run.js cache.js results.js exports.js session.js layout.js controls.js   fonctions de l'application
  selftests.js                   auto-tests du navigateur (#tests)
test/               tests Node (node:test)
scripts/serve.mjs   serveur statique local (npm start)
```

Règles de dépendance : `src/lib/` n'importe jamais `src/ui/`, et il n'y a aucun import circulaire. Les modules qui dessinent (`table.js`, `map.js`) ne connaissent pas l'orchestration : `main.js` leur passe leurs actions (sélection, tri, effacement) à l'initialisation (`initMap`, `initTable`). Pour ajouter une règle de géocodage ou de statut, il suffit de modifier `src/lib/` et ses tests.

## Tests

**Dans le navigateur** : ajoutez `#tests` à l'URL (`http://localhost:8000/#tests`) pour lancer des auto-tests rapides.

**En ligne de commande** (Node 20+, aucune dépendance à installer) :

```
npm test
```

Les tests Node importent directement `src/lib/` : ils exécutent le code réellement livré. La partie `src/ui/` (tableau, carte, IndexedDB, appels réseau) n'est pas couverte par les tests Node.

Les tests tournent aussi automatiquement sur GitHub (Actions, Node 20 et 22) à chaque push sur `main` et à chaque pull request : voir `.github/workflows/test.yml`.

Fichiers de test : `test/postal.test.js` (pays, codes postaux, règle de statut), `test/keyboard.test.js` (touches de la carte et du tableau), `test/markers.test.js` (formes et couleurs des points), `test/mobile.test.js` (zoom au pincement, tuiles, pagination des cartes), `test/nuts.test.js` (géométrie), `test/files.test.js` (CSV, XLSX, export CSV), `test/geocode.test.js` (stratégie de géocodage et rattachement NUTS avec un géocodeur simulé).

## Sources et licences

- Géocodage © contributeurs OpenStreetMap (Nominatim).
- Limites administratives © EuroGeographics — Eurostat GISCO, NUTS 2024.
