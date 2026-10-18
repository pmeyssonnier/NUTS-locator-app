# NUTS Locator

Application web autonome (un seul fichier, `index.html`, sans dépendance ni installation) qui :

1. importe un fichier Excel (`.xlsx`) ou CSV contenant des adresses ;
2. géocode chaque adresse avec Nominatim (OpenStreetMap) ;
3. rattache le point aux codes **NUTS 0/1/2/3** d'Eurostat (NUTS 2024 ; Royaume-Uni en NUTS 2021) ;
4. affiche les résultats dans un tableau et sur une carte ;
5. exporte en `.xlsx`, `.csv` ou GeoJSON.

## Utilisation

Ouvrez `index.html` dans un navigateur récent (Chrome 116+, Firefox 124+, Safari 17.4+), ou servez-le en HTTPS (par exemple GitHub Pages).

1. **Données** : chargez votre fichier, ou cliquez sur « Charger l'exemple ».
2. **Colonnes & géocodage** : vérifiez le mappage (Adresse, Numéro, Code postal, Ville, Pays), renseignez votre e-mail (politique Nominatim), puis cliquez sur « Géocoder ».
3. **Résultats** : filtrez, triez, exportez. « Exporter les lignes à contrôler » isole les lignes dont le statut n'est pas `OK` ou la confiance pas `HAUTE`.
4. **Carte** : choisissez le niveau de contours NUTS et le fond de carte.

**Classeur à plusieurs feuilles** : si le fichier `.xlsx` contient plusieurs feuilles, une liste « Feuille » apparaît. La première feuille visible est chargée par défaut ; vous pouvez choisir une autre feuille (les feuilles masquées sont signalées) ou « Toutes les feuilles », qui fusionne les feuilles visibles : les colonnes sont alignées par nom d'en-tête, et une colonne « Feuille » indique l'origine de chaque ligne. Les feuilles vides ou réduites à un en-tête sont ignorées.

Le fichier d'exemple se trouve dans [`exemples/exemple_societes_europe.xlsx`](exemples/exemple_societes_europe.xlsx) (27 sociétés européennes, contacts fictifs). Il contient les colonnes `Société`, `Nom`, `Prénom`, `Adresse`, `Code postal`, `Ville`, `Pays`. Le pays peut être un code ISO (`BE`, `UK`, `EL`) ou un nom (« Belgique », « Germany »).

Un second exemple, [`exemples/exemple_multi_feuilles.xlsx`](exemples/exemple_multi_feuilles.xlsx), a trois feuilles (dont une masquée) avec des colonnes dans des ordres différents, pour essayer la liste « Feuille » et la fusion.

## Statut et confiance

| Statut | Signification |
|---|---|
| `OK` | Code NUTS fiable |
| `NUTS_PROCHE` | Point hors contour, mais dans la tolérance en km |
| `A_VERIFIER` | Repli sur le code postal ou la ville, résultat imprécis, ou code postal différent |
| `PAYS_INCOHERENT` | Pays trouvé ou NUTS0 différent du pays saisi |
| `HORS_NUTS`, `ECHEC_GEOCODAGE`, `ERREUR` | Pas de code NUTS exploitable |

La **confiance** (`HAUTE`, `MOYENNE`, `FAIBLE`) mesure la précision de la localisation. `HAUTE` exige un bâtiment trouvé, un code postal identique et un point dans le contour. La colonne `controle_manuel` vaut `OUI` dès que la confiance n'est pas `HAUTE`.

## Accessibilité clavier

- **Accès rapide** : au premier `Tab`, des liens permettent de sauter aux résultats ou à la carte.
- **Tableau** : `Tab` entre dans le tableau (une seule ligne dans l'ordre de tabulation) ; `↑` `↓`, `Début`, `Fin`, `Page ↑` `Page ↓` changent de ligne ; `Entrée` affiche la ligne sur la carte et donne le focus à la carte ; `Tab` sort du tableau. `Entrée` ou `Espace` sur un en-tête trie la colonne (`aria-sort`).
- **Carte** (quand elle a le focus) : `←` `↑` `→` `↓` déplacent la carte (`Maj` : plus loin) ; `+` et `−` zooment ; `0` ou `Début` ajustent la carte aux points ; `Page ↓` / `Page ↑` passent au point suivant / précédent ; `Échap` ferme l'info. Sur un clavier AZERTY, `+` et `0` demandent `Maj` ; les boutons de zoom restent accessibles par `Tab`.
- **Lecteurs d'écran** : la sélection d'une ligne, le tri, la fin du géocodage et les erreurs sont annoncés (zone `aria-live`) ; l'indicateur de focus est visible partout.
- **Limites** : les zones NUTS de la carte ne se sélectionnent qu'à la souris (les codes NUTS de chaque point sont dans le tableau) ; la couleur des points sur la carte n'est pas doublée par une forme (le statut figure en texte dans le tableau).

## Confidentialité et limites

- Seuls les champs Adresse, Numéro, Code postal, Ville et Pays sont envoyés au serveur Nominatim choisi. Les autres colonnes restent dans le navigateur.
- Les réponses du géocodeur et les contours NUTS sont gardés dans le navigateur (IndexedDB). Le bouton « Vider le cache » efface le cache de géocodage.
- La dernière session (données importées et résultats, sans l'e-mail) est aussi conservée dans le navigateur : au rechargement, un bouton « Restaurer la session » la rétablit, et « Oublier la session » l'efface. Elle est enregistrée pendant le géocodage (toutes les 50 lignes) et à la fin.
- Le serveur public Nominatim est limité à 1 requête par seconde et n'est pas prévu pour du géocodage massif. Pour de gros volumes, renseignez un serveur Nominatim auto-hébergé.
- Le numéro est placé avant la rue pour FR, GB, IE et LU, après pour les autres pays.
- Les territoires d'outre-mer français (Guadeloupe, Martinique, Guyane, Réunion, Mayotte) et Åland sont rattachés à leur pays NUTS0 (FR, FI) : ils ne déclenchent plus de faux `PAYS_INCOHERENT`.
- Le géocodage s'arrête après 5 erreurs consécutives (réseau ou serveur indisponible).
- Si GISCO est bloqué par un pare-feu, importez les fichiers `NUTS_RG_…_4326_LEVL_n.geojson` avec « Importer des contours ».

## Tests

**Dans le navigateur** : ajoutez `#tests` à l'URL (`index.html#tests`) pour lancer des auto-tests rapides.

**En ligne de commande** (Node 20+, aucune dépendance à installer) :

```
npm test
```

`index.html` reste un fichier autonome. Sa section `LIB` (lecture et écriture XLSX, CSV, point dans polygone, codes postaux, pays, règle de statut, `geocodeRow`, `applyResult`, `summarize`, `csvCell`) ne dépend ni du DOM ni du réseau : le géocodeur, les contours NUTS et les libellés y sont passés en paramètres. `test/lib.js` charge cette section directement depuis `index.html`, donc les tests exécutent le code réellement livré. La section `UI` (tableau, carte, IndexedDB, Nominatim) n'est pas couverte par les tests Node.

Les tests tournent aussi automatiquement sur GitHub (Actions, Node 20 et 22) à chaque push sur `main` et à chaque pull request : voir `.github/workflows/test.yml`.

Fichiers de test : `test/postal.test.js` (pays, codes postaux, règle de statut), `test/keyboard.test.js` (touches de la carte et du tableau), `test/nuts.test.js` (géométrie), `test/files.test.js` (CSV, XLSX, export CSV), `test/geocode.test.js` (stratégie de géocodage et rattachement NUTS avec un géocodeur simulé).

## Sources et licences

- Géocodage © contributeurs OpenStreetMap (Nominatim).
- Limites administratives © EuroGeographics — Eurostat GISCO, NUTS 2024.
