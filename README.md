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

## Contrôle croisé avec les codes postaux Eurostat (prototype)

En option, l'application compare le NUTS 3 trouvé par la **position du point** à celui que donne le **code postal** dans les tables « code postal → NUTS » publiées par Eurostat (fichiers à plat Tercet, page « Postal codes » de GISCO). Les deux méthodes étant indépendantes, un désaccord signale un point mal placé ou un code postal erroné.

**Utilisation** : dans « Colonnes & géocodage », importez les tables avec « Tables code postal → NUTS 3 ». Deux formes de fichiers Eurostat sont acceptées, en `.zip` tel que téléchargé ou en `.csv` :
- un fichier par pays (`pc2025_FR_NUTS-2024_v1.0.zip`) ;
- le fichier **tous pays** (`PCODE_2025_NUTS-2024_v2.0.zip`, 830 033 codes postaux, 34 pays) : il est réparti par pays d'après le préfixe du code NUTS (UK → GB, EL → GR). Compter 3 à 5 secondes d'analyse ; les tables sont ensuite rechargées en moins d'une seconde.

Quand plus de trois pays sont chargés, la liste se replie derrière un résumé cliquable (« Tables chargées : 34 pays, 830 033 codes postaux ») ; son état ouvert ou fermé est mémorisé. Les tables sont conservées dans le navigateur (« Retirer les tables » les efface) et lues localement : elles ne sont jamais envoyées nulle part. Sans table, rien ne change.

**Appliquer les tables après coup** : importer ou retirer des tables recalcule aussitôt les lignes déjà géocodées, sans nouvel appel à Nominatim (le résultat brut du géocodeur est gardé avec chaque ligne, y compris dans la session sauvegardée). Restaurer une session recalcule de la même façon ses lignes avec les tables chargées. Les lignes d'une session sauvegardée avant cette fonction n'ont pas ce résultat : le message l'indique, et il faut alors relancer « Géocoder » (en décochant « Seulement les lignes non OK »).

**Conservation des imports** : contours et tables sont gardés dans le navigateur (IndexedDB) et ne s'importent qu'une fois. Une ligne sous les imports indique l'état du stockage : « durable », « non garanti » (le navigateur peut tout effacer : fenêtre privée, nettoyage automatique des données de site, disque presque plein) ou « indisponible » (tout reste en mémoire et est perdu à la fermeture de l'onglet). Les contours importés sont aussi concernés.

**Résultat** : deux colonnes sont ajoutées, `NUTS3_codepostal` (le ou les NUTS 3 de la table) et `controle_cp_nuts` :

| `controle_cp_nuts` | Signification | Effet sur le statut |
|---|---|---|
| `OUI` | même NUTS 3 | aucun (note « confirmé ») |
| `LIMITROPHE` | NUTS 3 différent, mais le point est à 10 km au plus de la zone du code postal | aucun (note) |
| `NON` | NUTS 3 différent, point à plus de 10 km | `A_VERIFIER`, confiance `MOYENNE` au plus |
| `MEME_NUTS2` | comme `NON`, avec un NUTS 3 de la même région NUTS 2 | `A_VERIFIER`, confiance `MOYENNE` au plus |
| `VERSION_DIFFERENTE` | désaccord, mais millésimes NUTS différents (ou inconnu) : non concluant | aucun (note) |
| `CP_ABSENT` | code postal absent de la table | aucun (note) |
| `SANS_TABLE` | des tables sont chargées mais pas pour ce pays (le Royaume-Uni par exemple) : pas de contrôle | aucun (note) |

Le millésime de la table (NUTS 2021, 2024…) est lu dans le nom du fichier (`…_NUTS-2024_…`) et comparé à celui des contours (2024, ou 2021 pour le Royaume-Uni). Ne renommez pas le fichier : sans millésime, un désaccord reste non concluant.

**Méthode d'Eurostat, et ce qu'elle implique** (notes méthodologiques GISCO « NUTS 2024 – PC 2025 ») :
- chaque code postal reçoit **un seul** NUTS 3, celui où tombe le **centroïde** du code postal. Un code postal qui chevauche deux NUTS 3 est donc affecté à l'un d'eux seulement : d'où le statut `LIMITROPHE`, qui évite de signaler à tort un point situé du bon côté de la frontière réelle du code postal ;
- les codes **non géographiques** (boîtes postales, grands destinataires, codes d'organisation comme les CEDEX) ne figurent pas dans les tables : `CP_ABSENT` ;
- la précision de la table dépend du pays (finesse du code postal) : le contrôle est surtout utile quand le code postal est détaillé.

**Formats par pays** (fichier tous pays, vérifiés) : code à 4 chiffres (AT, BE, CH, DK, HU, LU, NO, SI…), 5 chiffres (DE, ES, FR, IT, GR…), `NNN NN` (CZ, SK, SE), `NN-NNN` (PL), `NNNN-NNN` (PT), `NNNN AA` (NL, 464 890 codes), `LV-NNNN` (LV), clés de routage à 3 caractères pour l'Irlande (`D02`) et Malte (`MTP`). Les espaces et tirets sont ignorés à la comparaison ; une adresse néerlandaise ou portugaise qui n'a que les 4 premiers chiffres est comparée aux NUTS 3 des codes qui commencent par eux ; un Eircode complet est ramené à sa clé de routage. Le Royaume-Uni n'est pas dans les tables 2024.

**Fichier d'essai** : `examples/exemple_erreurs_codes_postaux.csv` contient quelques cas pour voir le contrôle à l'œuvre : un code postal erroné, un code postal d'une autre ville, un code CEDEX, un code néerlandais à 4 chiffres et une adresse britannique. Importez-le avec les tables Eurostat (dernière colonne : cas testé). Résultats attendus, à vérifier à l'usage car ils dépendent des réponses de Nominatim : les deux lignes à code postal erroné devraient finir `A_VERIFIER` (CP trouvé ≠ CP saisi, et `controle_cp_nuts` = `NON`) ; le CEDEX `CP_ABSENT` ; les adresses de référence et la ligne néerlandaise `OUI` ; l'adresse britannique `SANS_TABLE`.

**Mode sans géocodage** : cochez « Sans géocodage : NUTS 3 déduit du code postal » (le bouton devient « Déterminer le NUTS »). Aucun appel à Nominatim ni aux contours : le NUTS 0 à 3 et les libellés viennent du seul code postal et de la table Eurostat du pays (seuls les libellés sont téléchargés, une fois). C'est instantané et sans position, donc sans carte ni GeoJSON.

| Statut | Cas | Confiance | À contrôler |
|---|---|---|---|
| `CP_SEUL` | un seul NUTS 3 pour ce code postal | `MOYENNE` | non |
| `A_VERIFIER` | plusieurs NUTS 3 possibles : seuls les niveaux communs sont remplis | `FAIBLE` | oui |
| `ECHEC_CP` | code postal manquant, pays inconnu, pas de table pour ce pays (dont le Royaume-Uni) ou code absent de la table | `FAIBLE` | oui |

Moins précis que le géocodage : le NUTS 3 est celui du centroïde du code postal et peut être faux près d'une limite de NUTS 3. Il convient pour des listes dont les codes postaux sont fiables et fins (NL, PT, DE, FR…) ; les codes non géographiques (CEDEX, boîtes postales) échouent. `controle_cp_nuts` vaut `TABLE_SEULE` et `precision` `CODE_POSTAL_TABLE`.

**Concordance par pays selon Eurostat** (notes méthodologiques, tableau 2 : contrôle sur un échantillon de codes postaux de chaque pays, comparé à trois sources indépendantes — Azure Maps, Bing Maps et les districts postaux TomTom) :

| Pays | Échantillon | Azure Maps | Bing Maps | TomTom |
|---|--:|--:|--:|--:|
| AT | 209 | 99 % | 100 % | 100 % |
| BE | 108 | 92 % | 93 % | 92 % |
| BG | 116 | 84 % | 85 % | 85 % |
| CH | 307 | 92 % | 92 % | 92 % |
| CY | 107 | 65 % | 64 % | 65 % |
| CZ | 277 | 93 % | 93 % | 93 % |
| DE | 829 | 95 % | 95 % | 95 % |
| DK | 100 | 88 % | 91 % | 86 % |
| EE | 543 | 93 % | 95 % | 95 % |
| EL | 98 | 72 % | 71 % | 70 % |
| ES | 1 114 | 75 % | 75 % | 75 % |
| FI | 329 | 78 % | 78 % | 78 % |
| FR | 581 | 97 % | 97 % | 97 % |
| HR | 36 | 100 % | 100 % | 100 % |
| HU | 291 | 91 % | 90 % | 91 % |
| IT | 473 | 93 % | 93 % | 92 % |
| LI | 8 | 100 % | 100 % | 100 % |
| LT | 203 | 51 % | 53 % | 29 % |
| LV | 70 | 77 % | 76 % | 76 % |
| MT | 10 | 90 % | 80 % | 90 % |
| NL | 45 627 | 99 % | 89 % | 99 % |
| NO | 475 | 62 % | 63 % | 63 % |
| PL | 466 | 80 % | 80 % | 77 % |
| PT | 3 968 | 96 % | 41 % | 96 % |
| RO | 71 | 80 % | 80 % | 77 % |
| RS | 115 | 82 % | 81 % | 82 % |
| SE | 1 889 | 7 % | 7 % | 7 % |
| SI | 53 | 79 % | 79 % | 81 % |
| SK | 150 | 77 % | 77 % | 77 % |
| TR | 284 | 38 % | 38 % | 36 % |

À lire avec prudence :
- les pourcentages du tableau d'Eurostat correspondent en réalité au nombre de codes postaux **retrouvés** par la source de comparaison rapporté à l'échantillon (par exemple SE : 134 retrouvés sur 1 889, soit 7 %), et non à un taux d'erreur de la table. Une valeur basse (SE, LT, TR, NO, CY) traduit surtout une couverture faible de la source de comparaison, pas forcément des erreurs de la table ; elle signifie que le contrôle d'Eurostat est peu concluant pour ces pays ;
- le chiffre faible de Bing pour le Portugal (41 %) vient de la couverture de Bing (1 628 codes retrouvés sur 3 968), pas de la table ;
- Irlande, Islande, Luxembourg et Macédoine du Nord ne figurent pas dans ce tableau ;
- Eurostat précise que la position des codes postaux n'est pas exacte à 100 % et que la couverture n'est pas complète (codes absents, codes non géographiques) ;
- plus de 97 % des codes postaux viennent de sources officielles (services postaux, adresses officielles, tables de correspondance) ; le reste vient d'OpenStreetMap ou de Geonames. Selon le tableau 1 du document, la quasi-totalité des codes de la Roumanie, de la Suède, de la Serbie, de la Macédoine du Nord et de l'Irlande vient de Geonames ; en Lituanie, 5 603 codes sur 7 697 ont été localisés manuellement, et la Grèce, la Turquie et la majorité de la Pologne reprennent l'édition 2020 des données GISCO.

**État du prototype** :
- Testé sur le fichier français `pc2025_FR_NUTS-2024_v1.0` et sur le fichier tous pays `PCODE_2025_NUTS-2024_v2.0` : aucun code postal n'y a plusieurs NUTS 3 ; la même chaîne de code existe dans plusieurs pays (19 578 cas, par exemple `60315` en Allemagne et en Lituanie), d'où une table par pays. Format : en-tête `NUTS3;CODE`, valeurs entre apostrophes, NUTS en première colonne, BOM UTF-8.
- Le lecteur reste tolérant (séparateur, guillemets, ordre des colonnes, plusieurs NUTS 3 par code postal). Un code postal à plusieurs NUTS 3 est traité comme confirmé si l'un d'eux correspond.
- Les tables conservées dans le navigateur occupent de la place (plusieurs dizaines de Mo avec le fichier tous pays, surtout NL et PT) ; « Retirer les tables » la libère.
- Le code postal saisi est utilisé en priorité, puis celui trouvé par le géocodeur.

## Statut et confiance

| Statut | Signification |
|---|---|
| `OK` | Code NUTS fiable |
| `NUTS_PROCHE` | Point hors contour, mais dans la tolérance en km |
| `A_VERIFIER` | Repli sur le code postal ou la ville, résultat imprécis, ou code postal différent |
| `PAYS_INCOHERENT` | Pays trouvé ou NUTS0 différent du pays saisi |
| `HORS_NUTS`, `ECHEC_GEOCODAGE`, `ERREUR` | Pas de code NUTS exploitable |

La **confiance** (`HAUTE`, `MOYENNE`, `FAIBLE`) mesure la précision de la localisation. `HAUTE` exige un bâtiment trouvé et un point dans le contour, avec un code postal identique ou voisin (seuls les 2 derniers caractères diffèrent : avec un bâtiment exact, c'est le code postal d'OpenStreetMap qui diffère, et la note « CP voisin » reste visible). Une rue sans numéro, une zone proche ou un complément d'adresse ignoré donnent au mieux `MOYENNE`. La colonne `controle_manuel` vaut `OUI` dès que la confiance n'est pas `HAUTE`.

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
  postcodes.js             tables Eurostat code postal → NUTS 3 : lecture, recherche, comparaison
  markers.js keys.js mapmath.js util.js sample.js   marqueurs, touches, zoom, outils, exemple
  index.js                 point d'entrée unique de la logique pure
src/ui/             interface (DOM)
  dom.js state.js storage.js     utilitaires, état partagé, IndexedDB et préférences
  nuts.js nominatim.js           contours GISCO, appels Nominatim (cache, limite de débit)
  postcodes.js                   import des tables code postal → NUTS (zip ou csv)
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

Fichiers de test : `test/postal.test.js` (pays, codes postaux, règle de statut), `test/keyboard.test.js` (touches de la carte et du tableau), `test/markers.test.js` (formes et couleurs des points), `test/mobile.test.js` (zoom au pincement, tuiles, pagination des cartes), `test/nuts.test.js` (géométrie), `test/files.test.js` (CSV, XLSX, export CSV), `test/geocode.test.js` (stratégie de géocodage et rattachement NUTS avec un géocodeur simulé), `test/postcodes.test.js` (tables code postal → NUTS : lecture, recherche, comparaison), `test/version.test.js` (numéro de version).

## Numéro de version

L'application affiche « v… » à côté du titre, en haut de page, et « NUTS Locator v… (date) » dans le pied de page. Après une mise à jour de la page publiée (GitHub Pages met une à deux minutes à se rafraîchir), comparez ce numéro à celui de la dernière version fusionnée ; s'il est ancien, rechargez sans le cache du navigateur. Pour publier une nouvelle version, modifier `src/version.js` (`VERSION`, `VERSION_DATE`) et `version` dans `package.json` : un test vérifie que les deux concordent.

## Sources et licences

- Géocodage © contributeurs OpenStreetMap (Nominatim).
- Limites administratives © EuroGeographics — Eurostat GISCO, NUTS 2024.
