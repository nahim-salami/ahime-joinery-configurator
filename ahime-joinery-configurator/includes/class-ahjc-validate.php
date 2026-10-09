<?php
/**
 * Pourquoi ce fichier existe : le serveur doit REFUSER ce que le widget
 * refusait. Sans lui, le moteur PHP chiffrait une configuration que le
 * navigateur avait déclarée infabricable — et l'encaissait.
 *
 * C'est le dernier champ du harnais de parité : `errorCount`. Le harnais ne
 * compare pas les LIBELLÉS, et c'est écrit depuis la phase 1 — ils ont le
 * droit de différer entre les deux langages. Il compare le NOMBRE de refus,
 * ce qui est la seule chose qui décide si une commande passe.
 *
 * LES MESSAGES SONT DONC COURTS ICI, et ce n'est pas de la négligence : le
 * widget porte la prose, avec son alternative cliquable et son explication
 * de métier. Le serveur, lui, refuse et dit pourquoi en une phrase — c'est
 * ce qu'un panier affiche, et c'est tout ce qu'il peut afficher.
 *
 * CE QUI N'EST PAS PORTÉ, et le harnais le répète : `forme-trop-etroite`. Le
 * refus demande de TRACER le contour de la forme puis de l'offsetter de la
 * largeur du profilé — sept cents lignes de géométrie pour une règle qui ne
 * se déclenche que sur un cintre ou un trapèze trop étroit. L'approcher
 * serait pire que l'omettre : une approximation donnerait un compte d'erreurs
 * différent dans les cas limites, et le harnais deviendrait rouge sans que
 * personne sache si c'est la formule ou l'approximation qui a tort.
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

final class AHJC_Validate
{
    

    private const FAMILLES_A_FORMES = [
        'fenetre', 'porte-fenetre', 'coulissant', 'porte-entree', 'fenetre-toit',
    ];

    private AHJC_Catalogue $catalogue;
    private AHJC_Structural $structural;

    /** @var array<int,array<string,string>> */
    private array $issues = [];

    public function __construct(AHJC_Catalogue $catalogue, AHJC_Structural $structural)
    {
        $this->catalogue = $catalogue;
        $this->structural = $structural;
    }

    /** Le nombre de refus — ce que le harnais compare, et ce qui bloque une commande. */
    public static function compter_erreurs(array $issues): int
    {
        return count(array_filter($issues, static fn (array $i): bool => $i['severite'] === 'erreur'));
    }

    private function refus(string $code, string $message): void
    {
        $this->issues[] = ['code' => $code, 'severite' => 'erreur', 'message' => $message];
    }

    private function alerte(string $code, string $message): void
    {
        $this->issues[] = ['code' => $code, 'severite' => 'avertissement', 'message' => $message];
    }

    private function info(string $code, string $message): void
    {
        $this->issues[] = ['code' => $code, 'severite' => 'info', 'message' => $message];
    }

    private static function borne(float $x, float $min, float $max): float
    {
        return min($max, max($min, $x));
    }

    /**
     * Ce qu'une configuration a de refusable.
     *
     * L'ORDRE SUIT `validate.ts` DE HAUT EN BAS. Il n'a pas d'importance pour
     * le compte, et il en a une pour la relecture : quand le harnais annonce
     * un écart, on ouvre les deux fichiers côte à côte, et deux fichiers qui
     * ne se lisent pas dans le même ordre ne se comparent pas.
     *
     * @param array<string,mixed> $config
     * @return array<int,array<string,string>>
     */
    public function valider(array $config): array
    {
        $this->issues = [];
        $familles = $this->catalogue->get('familles');
        $fam = $familles[$config['famille']] ?? null;
        if ($fam === null) {
            $this->refus('famille-inconnue', sprintf('La famille « %s » n’existe pas au catalogue.', $config['famille']));
            return $this->issues;
        }

        $bornes = $fam['bornes'];
        $vantaux = (int) $config['vantaux'];
        if ($vantaux < $bornes['vantauxMin'] || $vantaux > $bornes['vantauxMax']) {
            $this->refus('vantaux-hors-famille', sprintf(
                '%s : de %d à %d vantaux (demandé : %d).',
                $fam['label'], $bornes['vantauxMin'], $bornes['vantauxMax'], $vantaux
            ));
        }

        // LES BORNES DIMENSIONNELLES : le mini de la famille, le maxi de la
        // MATRICE — sauf sur un ouvrage linéaire, où la matrice n'a qu'un
        
        // refusée avec « largeur de 1000 à 1000 mm », ce qui est exact et
        // absurde : sa borne est celle de la FABRICATION.
        // À LA PIÈCE, IL N'Y A PAS DE MATRICE À LIRE (lot Z0) : les bornes
        // sont celles de la FABRICATION — les seules qui existent quand le
        // prix ne vient pas d'un tableau de cotes.
        $a_la_piece = ($fam['unitePrix'] ?? null) === 'piece';
        $matrice = $a_la_piece ? null : $this->catalogue->matricePourVantaux(
            $fam,
            (int) self::borne($vantaux, $bornes['vantauxMin'], $bornes['vantauxMax'])
        );
        $lineaire = ($fam['unitePrix'] ?? null) === 'metre-lineaire';
        $max_fabrication = (float) $bornes['minWidthMm'];
        foreach ($bornes['vantailMaxMm'] as $valeur) {
            if ($valeur !== null) {
                $max_fabrication = max($max_fabrication, (float) $valeur);
            }
        }
        if ($lineaire || $a_la_piece) {
            $max_width = $max_fabrication;
        } else {
            $max_width = (float) end($matrice['widthsMm']);
        }
        // LA BORNE DE HAUTEUR À LA PIÈCE SE DÉCLARE (lot C11b). Le repli sur la
        // borne de LARGEUR n'avait jamais eu d'appelant, et la première famille
        // à la pièce a montré qu'il confond deux contraintes : le gabarit
        
        $max_height = $matrice === null
            ? (isset($bornes['hauteurMaxMm'])
                ? (float) $bornes['hauteurMaxMm']
                : max((float) $bornes['minHeightMm'], $max_fabrication))
            : (float) end($matrice['heightsMm']);
        if ($config['widthMm'] < $bornes['minWidthMm'] || $config['widthMm'] > $max_width) {
            $this->refus('largeur-hors-bornes', sprintf(
                '%s : %s de %d à %d mm (demandé : %d mm).',
                $fam['label'], $lineaire ? 'longueur' : 'largeur',
                $bornes['minWidthMm'], $max_width, $config['widthMm']
            ));
        }
        if ($config['heightMm'] < $bornes['minHeightMm'] || $config['heightMm'] > $max_height) {
            $this->refus('hauteur-hors-bornes', sprintf(
                '%s : hauteur de %d à %d mm (demandé : %d mm).',
                $fam['label'], $bornes['minHeightMm'], $max_height, $config['heightMm']
            ));
        }

        // LES POSTES D'UN OUVRAGE VENDU À LA PIÈCE (lot Z0). C'est ici que se
        // dit ce que `ahjc_somme_des_postes` a refusé de chiffrer : sans ce
        // bloc, un poste sans prix unitaire déclaré disparaîtrait du devis EN
        // SILENCE, et le total serait plus bas de ce qu'on ne sait pas.
        //
        // LE PORTAGE N'EST PAS SYMÉTRIQUE DE STRUCTURE, ET C'EST VOULU : côté
        // TypeScript, ce calcul vit dans un module PARESSEUX, parce que le
        // budget du chargement initial l'exigeait. Le PHP n'a pas de bundle ;
        // il appelle la fonction directement. Ce qui doit coïncider est le
        // COMPORTEMENT — les mêmes lignes, les mêmes motifs, le même compte de
        // refus —, et c'est ce que le harnais compare.
        //
        // « Des postes sur une famille vendue au tableau » n'est PAS ici, ni de
        // l'autre côté : c'est une incohérence de CATALOGUE, refusée par
        
        if ($a_la_piece) {
            $somme = ahjc_somme_des_postes($fam['postes'] ?? [], $config['postes'] ?? null);
            $phrases = [
                'poste-inconnu' => 'n’est pas déclaré au catalogue de cette famille',
                'prix-unitaire-non-declare' => 'n’a pas de prix unitaire déclaré : un poste sans prix ne vaut pas zéro euro, il vaut un prix inconnu',
                'quantite-negative' => 'est demandé pour une quantité négative : une remise se règle par une ligne tracée',
            ];
            foreach ($somme['refus'] as $refuse) {
                $this->refus('poste-' . $refuse['motif'], sprintf(
                    'Le poste « %s » %s.',
                    $refuse['id'],
                    $phrases[$refuse['motif']] ?? $refuse['motif']
                ));
            }
        }

        $materiaux = array_keys($fam['coefMateriauMilliemes']);
        if (!isset($fam['coefMateriauMilliemes'][$config['materiau']])) {
            $this->refus('materiau-indisponible', sprintf(
                '%s : pas de fabrication en %s (disponible : %s).',
                $fam['label'], $config['materiau'], implode(', ', $materiaux)
            ));
        }

        // LA GAMME NOMMÉE doit exister ET correspondre au matériau. Le piège
        // est de changer de matériau APRÈS avoir choisi sa gamme : sans cette
        // règle, on vendait un profilé alu facturé en PVC.
        if (isset($config['systeme'])) {
            $systeme = $this->catalogue->parId('systemes', $config['systeme']);
            if ($systeme === null) {
                $this->refus('systeme-inconnu', sprintf('La gamme « %s » n’existe pas au catalogue.', $config['systeme']));
            } elseif ($systeme['materiau'] !== $config['materiau']) {
                $this->refus('systeme-hors-materiau', sprintf(
                    'La gamme « %s » est une gamme %s, pas %s.',
                    $systeme['nom'], $systeme['materiau'], $config['materiau']
                ));
            }
        }

        $mesure = $this->structural->rapport_de_mesure($config);
        $vantail_max = $bornes['vantailMaxMm'][$config['materiau']] ?? null;
        if ($vantail_max !== null && $mesure['vantail']['widthMm'] > $vantail_max) {
            $this->refus('vantail-trop-large', sprintf(
                'Vantail de %d mm : le %s admet %d mm au plus.',
                $mesure['vantail']['widthMm'], $config['materiau'], $vantail_max
            ));
        }
        if ($mesure['vantail']['widthMm'] < $bornes['vantailMinMm']) {
            $this->refus('vantail-trop-etroit', sprintf(
                'Vantail de %d mm : l’atelier fabrique à partir de %d mm.',
                $mesure['vantail']['widthMm'], $bornes['vantailMinMm']
            ));
        }

        $ouvertures = $fam['ouvertures'] ?? null;
        if (isset($config['ouverture']) && $ouvertures !== null && !in_array($config['ouverture'], $ouvertures, true)) {
            $this->refus('ouverture-hors-famille', sprintf(
                '%s : ouverture « %s » impossible (au choix : %s).',
                $fam['label'], $config['ouverture'], implode(', ', $ouvertures)
            ));
        }
        if (($config['ouverture'] ?? null) === 'soufflet' && $vantaux !== 1) {
            $this->refus('soufflet-monovantail', 'Un châssis à soufflet est monovantail.');
        }

        // LE POIDS DE VITRAGE. `hors-limite` veut dire : même renforcées, les
        // ferrures ne portent pas ce vantail. Les « renforcées » ne sont pas
        // un refus — elles sont un supplément, déjà au prix.
        if ($this->structural->ferrures_requises($config) === 'hors-limite') {
            $this->refus('vitrage-trop-lourd', sprintf(
                'Vantail de %s kg : au-delà de ce que portent les ferrures renforcées.',
                $mesure['poidsVantailKg']
            ));
        }

        $this->regles_exposition($config, $fam, $mesure);
        $this->regles_options($config, $fam);
        $this->regles_pose($config, $fam);
        $this->regles_champs_sans_objet($config, $fam);
        $this->regles_de_famille($config, $fam, $mesure);

        if (isset($config['quantite'])) {
            $q = $config['quantite'];
            if (!is_int($q) || $q < 1) {
                $this->refus('quantite-invalide', 'La quantité doit être un entier d’au moins 1.');
            }
        }
        return $this->issues;
    }

    /**
     * L'EXPOSITION : le classement AEV, l'épaisseur de verre, la flèche du
     * montant. Rien de tout cela ne s'évalue sans site déclaré — et c'est
     * pourquoi le bloc entier est sous condition, exactement comme en
     * TypeScript. Un configurateur qui supposerait une zone de vent
     * refuserait des menuiseries que le site accepte.
     *
     * @param array<string,mixed> $config
     * @param array<string,mixed> $fam
     * @param array<string,mixed> $mesure
     */
    private function regles_exposition(array $config, array $fam, array $mesure): void
    {
        if (empty($config['exposition'])) {
            return;
        }

        // LE SECOND AXE DU DOMAINE (lot Z17), porté de `zones.ts`. Le
        // classement A/E/V est celui d'une menuiserie de FAÇADE : avant ce
        // lot, `aev-insuffisant` sortait sur les trente et une familles,
        
        // recopiées de `zones.ts` et TROIS témoins les comparent, ajoutés au
        
        
        $classes_aev = ['fenetre', 'porte-fenetre', 'coulissant', 'porte-entree', 'fenetre-toit'];
        $dedans = ['caisson', 'bibliotheque', 'store-interieur'];
        if (!in_array($config['famille'], $classes_aev, true)) {
            $this->info('exposition-sans-emploi', sprintf(
                'Ouvrage %s : l’exposition déclarée n’a pas servi.',
                in_array($config['famille'], $dedans, true) ? 'd’intérieur' : 'sans classement A/E/V'
            ));
        }
        $etage = !empty($config['exposition']['etageEleve']);
        // `Exposition.zoneVent` est une RÉGION (1 à 4), pas la chaîne
        // « abritée / normale / exposée » du champ `config.zoneVent`, qui
        // est un AUTRE champ. Deux noms identiques, deux types — et le
        // portage a d'abord appliqué la conversion de l'un à l'autre.
        $vent = AHJC_Mecanique::charge_de_vent(
            (int) $config['exposition']['zoneVent'],
            $etage ? 'mer' : 'bocage',
            $etage ? 22 : 8
        );

        // La gamme standard tient la classe 2 — 800 Pa. Au-delà, il faut un
        // profilé plus épais et un renfort, c'est-à-dire une autre gamme.
        if (
            $config['gamme'] === 'standard'
            && $vent['classePression'] > 2
            && in_array($config['famille'], $classes_aev, true)
        ) {
            $this->refus('aev-insuffisant', sprintf(
                'Zone de vent %s : %d Pa, classement %s. La gamme standard tient jusqu’à 800 Pa.',
                $config['exposition']['zoneVent'], $vent['qpPa'], $vent['classement']
            ));
        }

        $vitrage = $this->structural->vitrage_effectif($config);
        $clair = $mesure['clairVitrage'];
        if ($clair !== null) {
            $surface = ($clair['widthMm'] * $clair['heightMm']) / 1000000;
            $conseil = AHJC_Mecanique::epaisseur_verre_conseillee_mm($surface, $vent['qpPa']);
            // La face EXTÉRIEURE est celle qui prend le vent, et le supplément
            // phonique l'épaissit (4/16/4 → 10/16/4) : c'est exactement le
            // levier qui sert aussi au dimensionnement.
            $face = 4 + (!empty($vitrage['phonique'])
                ? $this->catalogue->chemin('verre', 'phoniqueSupplementMm')
                : 0);
            if ($face < $conseil['faceExterieureMm']) {
                $message = sprintf(
                    'Vitrage de %.2f m² sous %d Pa : face de %d mm posée, %d mm conseillés (EN 16612).',
                    $surface, $vent['qpPa'], $face, $conseil['faceExterieureMm']
                );
                // AU-DELÀ DE 4 m² ÉQUIVALENTS c'est un REFUS, en deçà un
                // avertissement — la même valeur, deux gravités, et c'est le
                // seuil d'étude qui les sépare.
                if ($conseil['etudeRequise']) {
                    $this->refus('verre-sous-dimensionne', $message);
                } else {
                    $this->alerte('verre-sous-dimensionne', $message);
                }
            }
        }

        // LA FLÈCHE, calculée DEUX FOIS — profilé nu, puis renforcé. Une
        // menuiserie PVC est TOUJOURS renforcée passé le mètre : c'est le
        // produit, pas un défaut. Ne calculer que le nu faisait crier au
        // renfort sur une fenêtre abritée, et une alerte qui sonne toujours ne
        // dit plus rien. Seul « même renforcé, ça fléchit » est un refus.
        $profondeur = $this->catalogue->parId('systemes', $config['systeme'] ?? null)['epaisseurMm']
            ?? $this->catalogue->chemin('profils', 'epaisseurMm', $config['materiau'], $config['gamme']);
        // LA FLÈCHE SUIT LA CHAÎNE DE COTES, pas le clair de vitrage. Les
        // deux allaient ensemble jusqu'à ce qu'une porte pleine ait l'une
        // sans l'autre : son montant fléchit sous le vent comme celui d'une
        // porte vitrée, et ne plus le vérifier aurait laissé passer côté
        // serveur un refus que le widget oppose.
        if ($mesure['chaineDeCotes'] !== null && $profondeur !== null) {
            $bande = $this->structural->masse_vue_mm(
                $config['famille'],
                $config['materiau'],
                $this->structural->pose_pour_famille($config['famille'], $config['pose'] ?? null)
            );
            $inertie = AHJC_Mecanique::inertie_profil_cm4($config['materiau'], (float) $profondeur, $bande);
            $renfort = AHJC_Mecanique::inertie_renfort_cm4($config['materiau'], (float) $profondeur);
            $portee = (float) $mesure['chaineDeCotes']['dimensionFabrication']['heightMm'];
            $tributaire = (float) $mesure['vantail']['widthMm'];
            $renforce = AHJC_Mecanique::fleche(
                $vent['qpPa'], $portee, $tributaire, $config['materiau'], $inertie, $renfort
            );
            if ($renforce['renfortRequis']) {
                $this->refus('fleche-excessive', sprintf(
                    'Montant de %d mm sous %d Pa : %s mm de flèche même renforcé, pour %s mm admissibles (L/300).',
                    $portee, $vent['qpPa'], $renforce['flecheMm'], $renforce['admissibleMm']
                ));
            } else {
                $nu = AHJC_Mecanique::fleche(
                    $vent['qpPa'], $portee, $tributaire, $config['materiau'], $inertie, 0.0
                );
                // Le bois n'a pas de chambre : on ne le renforce pas, on
                // l'épaissit. D'où un avertissement là où le PVC n'aurait
                // qu'une ligne de débit en plus.
                if ($nu['renfortRequis'] && $renfort <= 0) {
                    $this->alerte('fleche-excessive', sprintf(
                        'Montant de %d mm sous %d Pa : %s mm de flèche, %s mm admissibles. Le bois se renforce en section.',
                        $portee, $vent['qpPa'], $nu['flecheMm'], $nu['admissibleMm']
                    ));
                }
            }
        }
    }

    /**
     * LA COHÉRENCE DES OPTIONS.
     *
     * @param array<string,mixed> $config
     * @param array<string,mixed> $fam
     */
    private function regles_options(array $config, array $fam): void
    {
        $options = $config['options'] ?? [];
        $ids = array_map(static fn (array $o): string => (string) $o['id'], $options);
        foreach ($options as $choisie) {
            $def = $this->catalogue->parId('options', (string) $choisie['id']);
            if ($def === null) {
                $this->refus('option-inconnue', sprintf('Option « %s » inconnue du catalogue.', $choisie['id']));
                continue;
            }
            if (!in_array($config['famille'], $def['familles'], true)) {
                $this->refus('option-hors-famille', sprintf('%s : indisponible sur %s.', $def['label'], $fam['label']));
                continue;
            }
            if (($def['unite'] ?? null) === 'parVantail' && ($choisie['quantite'] ?? 1) > $config['vantaux']) {
                $this->refus('option-quantite-excessive', sprintf(
                    '%s : %d vantaux équipés demandés, la menuiserie n’en a que %d.',
                    $def['label'], $choisie['quantite'], $config['vantaux']
                ));
            }
        }

        $ouverture = $config['ouverture'] ?? ($fam['ouvertures'][0] ?? null);
        if (in_array('oscillo-battant', $ids, true) && $ouverture !== 'frappe') {
            $this->refus('oscillo-battant-incompatible', sprintf(
                'Pas d’oscillo-battant sur une ouverture « %s » — il se greffe sur la frappe.',
                $ouverture
            ));
        }
        // On ne pose jamais deux grilles sur la même baie.
        $grilles = array_values(array_filter(
            $ids,
            static fn (string $id): bool => str_starts_with($id, 'grille-') && $id !== 'grille-ventilation'
        ));
        if (count($grilles) > 1) {
            $this->refus('grilles-multiples', 'Une seule grille de défense par baie.');
        }
        $motorisations = array_values(array_filter(
            $ids,
            static fn (string $id): bool => str_starts_with($id, 'motorisation-')
        ));
        if (count($motorisations) > 1) {
            $this->refus('motorisations-multiples', 'Une seule motorisation par volet ou store.');
        }
        // Une motorisation sur une fenêtre équipe SON VOLET : sans bloc-baie,
        // elle n'a rien à mouvoir.
        if (
            count($motorisations) === 1
            && in_array($config['famille'], ['fenetre', 'porte-fenetre'], true)
            && !in_array('bloc-baie-manuel', $ids, true)
        ) {
            $this->refus('motorisation-sans-volet', 'La motorisation équipe un volet : ajoutez le bloc-baie.');
        }
        if (
            in_array('moustiquaire', $ids, true)
            && in_array('bloc-baie-manuel', $ids, true)
            && $config['gamme'] === 'standard'
        ) {
            $this->refus(
                'moustiquaire-bloc-baie',
                'Moustiquaire intégrée et bloc-baie ne cohabitent pas dans le coffre de la gamme standard.'
            );
        }
    }

    /**
     * LA POSE : ce qui a été mesuré, et ce qu'il en reste. Elle ne bloque
     * presque jamais — elle DIT. Une cote prise pour une pose et fabriquée
     * pour une autre donne une menuiserie qui ne rentre pas, et le client ne
     * l'apprend que le jour de la livraison.
     *
     * @param array<string,mixed> $config
     * @param array<string,mixed> $fam
     */
    private function regles_pose(array $config, array $fam): void
    {
        $poses = $this->catalogue->get('poses');
        $applicable = in_array($config['famille'], $this->catalogue->get('famillesAvecPose') ?? [], true);
        if (isset($config['pose']) && !$applicable) {
            $this->alerte('pose-sans-objet', sprintf('%s : le type de pose ne se règle pas ainsi.', $fam['label']));
        }
        if (isset($config['pose']) && !isset($poses[$config['pose']])) {
            $this->refus('pose-inconnue', sprintf('La pose « %s » n’existe pas au catalogue.', $config['pose']));
        }
        if (!$applicable) {
            if (isset($config['tapeeMm'])) {
                $this->alerte('tapee-sans-objet', sprintf('%s : la tapée ne s’applique pas.', $fam['label']));
            }
            return;
        }

        $pose = $this->structural->pose_pour_famille($config['famille'], $config['pose'] ?? null);
        $epaisseurs = array_map(
            static fn (array $t): int => (int) $t['epaisseurMm'],
            $this->catalogue->get('tapees')
        );
        if (isset($config['tapeeMm']) && empty($pose['tapee'])) {
            $this->alerte('tapee-sans-applique', 'La tapée ne s’emploie qu’en pose applique — valeur ignorée.');
        } elseif (isset($config['tapeeMm']) && !in_array((int) $config['tapeeMm'], $epaisseurs, true)) {
            $this->refus('tapee-inconnue', sprintf(
                'Tapée de %d mm : les épaisseurs vendues sont %s mm.',
                $config['tapeeMm'], implode(', ', $epaisseurs)
            ));
        } elseif (!empty($pose['tapee']) && !isset($config['tapeeMm'])) {
            $this->alerte(
                'applique-sans-tapee',
                'Pose en applique sans tapée : le dormant s’arrêtera au nu de la maçonnerie.'
            );
        }
    }

    /**
     * LES CHAMPS SANS OBJET — ignorés, mais DITS. Un champ silencieusement
     * ignoré est un champ que le client croit avoir commandé.
     *
     * @param array<string,mixed> $config
     * @param array<string,mixed> $fam
     */
    private function regles_champs_sans_objet(array $config, array $fam): void
    {
        if (isset($config['hauteurAllegeMm']) && $config['famille'] !== 'fenetre') {
            $this->alerte('allege-sans-objet', 'La hauteur d’allège ne concerne que les fenêtres.');
        }
        $a_imposte = in_array($config['famille'], ['fenetre', 'porte-fenetre', 'porte-entree'], true);
        if (isset($config['imposteHauteurMm']) && !$a_imposte) {
            $this->alerte('imposte-sans-objet', 'L’imposte ne concerne que fenêtres, portes-fenêtres et portes d’entrée.');
        }
        // LE BLOC-BAIE N'EST PAS UN VOLET, c'est une FENÊTRE : son coffre est
        // solidaire du dormant et se pose avec elle. Le commander seul, c'est
        // commander un dormant sans sa fenêtre.
        if ($config['famille'] === 'volet-roulant' && ($config['coffre'] ?? null) === 'bloc-baie') {
            $this->refus(
                'bloc-baie-sans-menuiserie',
                'Un bloc-baie se commande AVEC la menuiserie, par son option — seul, un volet se pose en coffre extérieur ou tunnel.'
            );
        }
        if (isset($config['modelePorte']) && $config['famille'] !== 'porte-entree') {
            $this->alerte('modele-porte-sans-objet', 'Le modèle de panneau ne concerne que les portes d’entrée.');
        } elseif (
            isset($config['modelePorte'])
            && $this->catalogue->parId('modelesPorte', $config['modelePorte']) === null
        ) {
            $this->refus('modele-porte-inconnu', sprintf(
                'Le modèle de porte « %s » n’existe pas au catalogue.',
                $config['modelePorte']
            ));
        }
        if (isset($config['vitrage']) && empty($fam['vitree']) && $config['famille'] !== 'porte-entree') {
            $this->alerte('vitrage-sans-objet', sprintf('%s : pas de vitrage — valeur ignorée.', $fam['label']));
        }
    }

    /**
     * LES REFUS PROPRES À LA FAMILLE — ceux que `ModuleFamille.regles` porte
     * côté TypeScript, et qui n'y sont pas par rangement : une fenêtre
     * n'oppose aucun d'eux, et elle en téléchargeait le code.
     *
     * @param array<string,mixed> $config
     * @param array<string,mixed> $fam
     * @param array<string,mixed> $mesure
     */
    private function regles_de_famille(array $config, array $fam, array $mesure): void
    {
        switch ($config['famille']) {
            case 'volet-roulant':
                $this->regles_volet_roulant($config);
                break;
            case 'moustiquaire':
                $this->regles_moustiquaire($config);
                break;
            case 'porte-garage':
                $this->regles_porte_garage($config);
                break;
            case 'fenetre-toit':
                $this->regles_fenetre_de_toit($config);
                break;
            case 'coulissant':
                $this->regles_levage($config);
                break;
            case 'screen-zip':
                $this->regles_screen($config);
                break;
        }
        // LES RÈGLES DE FORME NE VALENT PAS POUR TOUTES LES FAMILLES, et ce
        // n'est pas un oubli côté TypeScript : elles sont câblées GROUPE PAR
        // GROUPE dans `ModuleFamille.regles`, et seuls les vitrées, les
        
        // porte de garage, moustiquaire — n'a pas de forme cintrée à refuser,
        
        //
        // Le portage les appliquait à TOUT LE MONDE, et refusait un volet
        // roulant « plein cintre » que le cœur accepte en silence. C'est le
        // dernier écart qu'a trouvé le harnais, et il n'aurait pas été trouvé
        // sans un témoin qui déclenche la règle.
        if (in_array($config['famille'], self::FAMILLES_A_FORMES, true)) {
            $this->regles_forme($config, $fam);
        }
    }

    

    /**
     * LE VOLET ROULANT — lot O5 : le côté de la manœuvre et le moteur
     * solaire.
     *
     * Le relevé de Fenetre24 (docs/51 §4.2) déclare que le panneau d'un
     * moteur solaire se monte TOUJOURS à gauche, vu de l'intérieur. Une
     * manœuvre demandée à droite et ce moteur ne se fabriquent donc pas
     * ensemble, et rien ne le disait : ni le prix, ni le dessin, ni une
     * remarque. C'est une ERREUR, parce que le panneau ne se déplace pas.
     *
     * La convention « vu de l'intérieur » est celle de l'élévation de ce
     * moteur comme du relevé : les deux coïncident, et le dire évite la faute
     * du lot C0, où « 60° » ne disait pas quel angle.
     *
     * Seul ce REFUS est porté, comme ailleurs : la taille de lame ne produit
     * aucun refus — elle change le coffre dérivé, le nombre de lames et le
     * trait, c'est-à-dire le DESSIN et le DÉBIT, qui ne passent pas par ce
     * moteur —, et `manoeuvre-et-moteur` est un avertissement.
     *
     * @param array<string,mixed> $config
     */
    private function regles_volet_roulant(array $config): void
    {
        $options = $config['options'] ?? [];
        $solaire = false;
        foreach ($options as $choisie) {
            if (($choisie['id'] ?? '') === 'motorisation-solaire') {
                $solaire = true;
            }
        }
        if ($solaire && ($config['coteManoeuvre'] ?? null) === 'droite') {
            $this->refus(
                'motorisation-solaire-cote',
                'Motorisation solaire : le panneau se monte toujours à GAUCHE, vu de l’intérieur — et la manœuvre est demandée à droite.'
            );
        }
    }

    /**
     * LA MOUSTIQUAIRE ENROULABLE : le coffre doit avaler la toile. Au-delà du
     * plus grand, aucun coffre du marché ne la reçoit.
     *
     * @param array<string,mixed> $config
     */
    private function regles_moustiquaire(array $config): void
    {
        $type = $config['typeMoustiquaire'] ?? 'enroulable-verticale';
        if ($type !== 'enroulable-verticale' && $type !== 'enroulable-laterale') {
            return;
        }
        $toile = $type === 'enroulable-laterale' ? $config['widthMm'] : $config['heightMm'];
        if ($toile > 3000) {
            $this->refus('coffre-moustiquaire-insuffisant', sprintf(
                'Toile de %d mm : le plus grand coffre du marché avale 3000 mm.',
                $toile
            ));
        }
    }

    /**
     * LA PORTE DE GARAGE SECTIONNELLE — trois cotes du BÂTIMENT, pas de la
     * porte. C'est ce que personne ne pense à mesurer, et qui fait revenir
     * le poseur.
     *
     * @param array<string,mixed> $config
     */
    private function regles_porte_garage(array $config): void
    {
        $ids = array_map(static fn (array $o): string => (string) $o['id'], $config['options'] ?? []);
        $reduite = in_array('garage-ferrure-reduite', $ids, true);
        $isole = in_array('garage-panneau-isole', $ids, true);
        $requise = $reduite ? 55 : ($isole ? 105 : 100);

        if (isset($config['retombeeLinteauMm']) && $config['retombeeLinteauMm'] < $requise) {
            $this->refus('linteau-insuffisant', sprintf(
                'Retombée de linteau de %d mm : cette ferrure en demande %d.',
                $config['retombeeLinteauMm'], $requise
            ));
        }
        if (isset($config['ecoinconMm']) && $config['ecoinconMm'] < 90) {
            $this->refus('ecoincon-insuffisant', sprintf(
                'Écoinçon de %d mm : les rails verticaux en demandent 90 de chaque côté.',
                $config['ecoinconMm']
            ));
        }
        $profondeur_requise = $config['heightMm'] + 500;
        if (isset($config['profondeurGarageMm']) && $config['profondeurGarageMm'] < $profondeur_requise) {
            $this->refus('garage-trop-court', sprintf(
                'Garage de %d mm de profondeur : les rails horizontaux en demandent %d.',
                $config['profondeurGarageMm'], $profondeur_requise
            ));
        }
    }

    /**
     * LA FENÊTRE DE TOIT se commande par CODE, pas au millimètre. Le chevêtre
     * est calé sur des cotes de fabricant, et une cote intermédiaire n'existe
     * chez personne.
     *
     * @param array<string,mixed> $config
     */
    private function regles_fenetre_de_toit(array $config): void
    {
        $codes = [
            ['CK01', 550, 698], ['CK02', 550, 778], ['CK04', 550, 978],
            ['FK04', 660, 978], ['FK06', 660, 1178],
            ['MK04', 780, 978], ['MK06', 780, 1178], ['MK08', 780, 1398],
            ['SK06', 1140, 1178], ['SK08', 1140, 1398], ['UK04', 1340, 978],
        ];
        $exact = false;
        foreach ($codes as [$code, $l, $h]) {
            if ((int) $config['widthMm'] === $l && (int) $config['heightMm'] === $h) {
                $exact = true;
            }
        }
        if (!$exact) {
            $this->refus('code-fenetre-de-toit', sprintf(
                '%d × %d mm ne correspond à aucun code de fenêtre de toit.',
                $config['widthMm'], $config['heightMm']
            ));
        }
        $pente = $config['penteToitureDeg'] ?? null;
        if ($pente === null) {
            $this->alerte('pente-a-mesurer', 'La pente de la toiture n’est pas déclarée — elle décide du raccord.');
        } elseif ($pente < 15) {
            // Sous quinze degrés l'eau stagne sur le vitrage et la neige
            // s'accumule contre la traverse haute : aucun fabricant ne
            // garantit l'étanchéité.
            $this->refus('pente-insuffisante', sprintf('Pente de %s° : le minimum est 15°.', $pente));
        } elseif ($pente > 90) {
            $this->refus('pente-excessive', sprintf('Pente de %s° : au-delà de 90° ce n’est plus un toit.', $pente));
        }
    }

    /**
     * LE SCREEN VERTICAL, porté de `familles/solaire/screen-zip.ts`.
     *
     * IL NE L'ÉTAIT PAS, et le lot MT1b l'a découvert en ajoutant ses trois
     * premiers témoins : la famille était au catalogue PHP depuis le lot S1,
     * ses REFUS n'y étaient pas, et aucun témoin ne jouait un screen. Le
     * harnais a mordu sur `store-vertical-hors-surface` — JS 1 refus, PHP 0.
     * Une famille qu'aucun témoin ne joue est une famille dont personne ne
     * sait si elle est portée.
     *
     * Ne sont portés que les REFUS : ce sont eux que `errorCount` compare.
     * L'avertissement de couture, les infos de guidage, de facteur
     * d'ouverture et de moteur restent côté JavaScript — les libellés ont le
     * droit de différer, le compte des refus non.
     *
     * @param array<string,mixed> $config
     */
    private function regles_screen(array $config): void
    {
        // Le coffre et les deux coulisses sont en ALUMINIUM : c'est ce qui
        // tient la toile tendue.
        if ($config['materiau'] !== 'alu') {
            $this->refus('screen-aluminium-seul', sprintf(
                'Un screen a un coffre et deux coulisses en ALUMINIUM. Matière demandée : %s.',
                $config['materiau']
            ));
        }

        // LE GUIDAGE (lot MT1b) et la borne DÉRIVÉE qu'il donne. Le rapport
        // des pressions de classe EN 13561 : (49/28)² = 3,063 du zip aux
        // câbles. La borne du zip est 18 m², déclarée côté JavaScript.
        $guidage = $config['guidageDeToile'] ?? 'zip';
        $rapport = $guidage === 'zip' ? 1.0 : pow(49 / 28, 2);
        $surface_max = round((18 * 10) / $rapport) / 10;
        $surface = ($config['widthMm'] / 1000) * ($config['heightMm'] / 1000);
        if ($surface > $surface_max) {
            $this->refus('screen-surface-hors-borne', sprintf(
                '%s m² : au-delà de %s m², la toile prend trop au vent.',
                $surface, $surface_max
            ));
        }

        if ((int) $config['widthMm'] > 6000) {
            $this->refus('screen-largeur-hors-borne', sprintf(
                '%d mm de large : ce store s’arrête à 6000 mm.',
                $config['widthMm']
            ));
        }
        if ((int) $config['heightMm'] > 4000) {
            $this->refus('screen-hauteur-hors-borne', sprintf(
                '%d mm de haut : ce store s’arrête à 4000 mm.',
                $config['heightMm']
            ));
        }

        // Le gtot ne se donne pas pour une toile seule.
        if (($config['gtotDemande'] ?? false) === true) {
            $this->refus('screen-gtot-sans-vitrage',
                'Le facteur solaire gtot est une propriété du COUPLE toile + vitrage.');
        }
    }

    /**
     * LE COULISSANT À LEVAGE (lot MT1a), porté de `familles/vitrees/levage.ts`.
     *
     * Trois choses recopiées, et la première est celle qui compte :
     * l'ENVELOPPE est une LISTE de rectangles publiés, jamais leur rectangle
     * englobant. Schüco publie « 3 500 × 3 200 ou 3 200 × 3 500 » pour
     * l'ASE 80.HI ; le couple de maxima accepte 3 400 × 3 400, que le
     * fabricant n'a jamais publié et qui pèse 355 kg — onze de plus que ses
     * deux maximums. Le coin ajouté par le raccourci est le point le PLUS
     * LOURD de l'enveloppe.
     *
     * Et la CLASSE de ferrure (EN 13126-16) n'est pas le SEUIL DE MANŒUVRE :
     * la première dit ce que la ferrure supporte, le second ce qu'un bras
     * fait bouger. Les confondre vend un vantail conforme qui ne s'ouvre pas.
     *
     * @param array<string,mixed> $config
     */
    private function regles_levage(array $config): void
    {
        if (($config['ouverture'] ?? null) !== 'levage') {
            return;
        }
        $mesure = $this->structural->rapport_de_mesure($config);
        $largeur = (int) $mesure['vantail']['widthMm'];
        $hauteur = (int) $mesure['vantail']['heightMm'];
        $poids = (float) $mesure['poidsVantailKg'];

        // Les rectangles PUBLIÉS, un par un — jamais leur enveloppe carrée.
        $rectangles = [[3500, 3200, '3 500 × 3 200'], [3200, 3500, '3 200 × 3 500']];
        $dedans = false;
        foreach ($rectangles as [$l, $h, $_nom]) {
            if ($largeur <= $l && $hauteur <= $h) {
                $dedans = true;
            }
        }
        if (!$dedans) {
            $this->refus('levage-hors-enveloppe', sprintf(
                '%d × %d mm n’est dans aucune cote publiée de vantail à levage (3 500 × 3 200 ou 3 200 × 3 500).',
                $largeur, $hauteur
            ));
        }

        if ((int) $config['widthMm'] > 18000) {
            $this->refus('levage-rail-trop-long', sprintf(
                'Baie de %d mm : le rail publié va jusqu’à 18000 mm.',
                $config['widthMm']
            ));
        }

        $classe = null;
        foreach ([150, 200, 300, 400] as $palier) {
            if ($classe === null && $poids <= $palier) {
                $classe = $palier;
            }
        }
        if ($classe === null) {
            $this->refus('levage-hors-classe', sprintf(
                'Vantail de %s kg : au-delà de 400 kg, aucune classe EN 13126-16 n’est essayée.',
                $poids
            ));
        } else {
            $this->info('levage-classe-de-ferrure', sprintf(
                'Vantail de %s kg : ferrure de classe %d kg (EN 13126-16).',
                $poids, $classe
            ));
        }

        if ($poids > 400) {
            $this->refus('levage-motorisation-imposee', sprintf(
                'Vantail de %s kg, au-dessus du seuil de manœuvre manuelle déclaré (400 kg).',
                $poids
            ));
        }
    }

    /**
     * LA FORME. Le tracé du contour et son offset ne sont PAS portés — voir
     * l'en-tête de ce fichier. Ce qui l'est : la forme existe, la famille la
     * vend, et l'ouverture l'admet.
     *
     * @param array<string,mixed> $config
     * @param array<string,mixed> $fam
     */
    private function regles_forme(array $config, array $fam): void
    {
        $forme_id = $config['forme'] ?? 'rectangle';
        if ($forme_id === 'rectangle') {
            return;
        }
        $forme = $this->catalogue->parId('formes', $forme_id);
        if ($forme === null) {
            $this->refus('forme-inconnue', sprintf('La forme « %s » n’existe pas au catalogue.', $forme_id));
            return;
        }
        if (!in_array($config['famille'], $forme['familles'], true)) {
            $this->refus('forme-hors-famille', sprintf(
                '%s : la forme « %s » ne se fabrique pas sur cette famille.',
                $fam['label'], $forme['label']
            ));
            return;
        }
        $ouverture = $config['ouverture'] ?? ($fam['ouvertures'][0] ?? null);
        if (!empty($forme['ouvertures']) && $ouverture !== null && !in_array($ouverture, $forme['ouvertures'], true)) {
            $this->refus('forme-ouverture-incompatible', sprintf(
                'La forme « %s » ne va pas avec une ouverture « %s ».',
                $forme['label'], $ouverture
            ));
        }
    }
}
