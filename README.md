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

Le fichier d'exemple se trouve dans [`exemples/exemple_societes_europe.xlsx`](exemples/exemple_societes_europe.xlsx) (27 sociétés européennes, contacts fictifs). Il contient les colonnes `Société`, `Nom`, `Prénom`, `Adresse`, `Code postal`, `Ville`, `Pays`. Le pays peut être un code ISO (`BE`, `UK`, `EL`) ou un nom (« Belgique », « Germany »).

## Statut et confiance

| Statut | Signification |
|---|---|
| `OK` | Code NUTS fiable |
| `NUTS_PROCHE` | Point hors contour, mais dans la tolérance en km |
| `A_VERIFIER` | Repli sur le code postal ou la ville, résultat imprécis, ou code postal différent |
| `PAYS_INCOHERENT` | Pays trouvé ou NUTS0 différent du pays saisi |
| `HORS_NUTS`, `ECHEC_GEOCODAGE`, `ERREUR` | Pas de code NUTS exploitable |

La **confiance** (`HAUTE`, `MOYENNE`, `FAIBLE`) mesure la précision de la localisation. `HAUTE` exige un bâtiment trouvé, un code postal identique et un point dans le contour. La colonne `controle_manuel` vaut `OUI` dès que la confiance n'est pas `HAUTE`.

## Confidentialité et limites

- Seuls les champs Adresse, Numéro, Code postal, Ville et Pays sont envoyés au serveur Nominatim choisi. Les autres colonnes restent dans le navigateur.
- Les réponses du géocodeur et les contours NUTS sont gardés dans le navigateur (IndexedDB). Le bouton « Vider le cache » efface le cache de géocodage.
- Le serveur public Nominatim est limité à 1 requête par seconde et n'est pas prévu pour du géocodage massif. Pour de gros volumes, renseignez un serveur Nominatim auto-hébergé.
- Le géocodage s'arrête après 5 erreurs consécutives (réseau ou serveur indisponible).
- Si GISCO est bloqué par un pare-feu, importez les fichiers `NUTS_RG_…_4326_LEVL_n.geojson` avec « Importer des contours ».

## Tests

Ajoutez `#tests` à l'URL (`index.html#tests`) pour lancer les auto-tests des fonctions pures (codes postaux, pays, niveaux, point dans polygone, règle de statut).

## Sources et licences

- Géocodage © contributeurs OpenStreetMap (Nominatim).
- Limites administratives © EuroGeographics — Eurostat GISCO, NUTS 2024.
