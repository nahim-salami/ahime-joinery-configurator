<?php
/**
 * Pourquoi ce fichier existe : « le prix du navigateur n'écrit jamais une
 * commande » (docs/00 §8). C'est LE fichier que cette phrase annonçait.
 *
 * Il est le miroir 1:1 de `pricing.ts` — même ordre de lignes, mêmes noms de
 * codes, même formule : base(L, H) × coefficients + suppléments imposés +
 * options, puis `finaliser()` commun (remise quantité, arrondi commercial).
 * Le harnais de parité (`npm run parite`) rejoue vingt-quatre configurations
 * témoins dans les deux langages et compare `baseCents`, `totalCents`,
 * `displayTotalCents`, `uw`, `glassWeightKg` et `errorCount`. Un centime
 * d'écart fait échouer la construction.
 *
 * POURQUOI L'ORDRE DES LIGNES EST SACRÉ, et pas seulement leur somme : chaque
 * coefficient s'applique au COURANT, c'est-à-dire au résultat du précédent.
 * Intervertir « matériau » et « gamme » ne change pas le produit des
 * millièmes mais change les ARRONDIS intermédiaires — un centime ici, un
 * centime là, et le devis du client ne retombe plus sur celui du serveur.
 * D'où un portage qui suit le fichier source de haut en bas, sans regrouper
 * ni « simplifier ».
 *
 * CE QU'IL NE FAIT PAS : les libellés. Le harnais ne les compare pas et ce
 * fichier ne les fabrique pas — un libellé français dans un plugin qui sert
 * une boutique néerlandaise serait faux de toute façon, et c'est le widget
 * qui présente. Ce module rend des MONTANTS et leurs codes.
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

final class AHJC_Pricing
{
    private AHJC_Catalogue $catalogue;
    private AHJC_Structural $structural;

    public function __construct(AHJC_Catalogue $catalogue, AHJC_Structural $structural)
    {
        $this->catalogue = $catalogue;
        $this->structural = $structural;
    }

    /**
     * Le métré d'un ouvrage LINÉAIRE — `null` dès que la famille se vend à la
     * menuiserie. C'est ce `null` qui décide de la lecture de la matrice, et
     * c'est pour cela qu'il est porté ici plutôt que supposé.
     *
     * Le portage ne connaît qu'un tronçon : le serveur reçoit une
     * configuration, pas un tracé de terrain. Un projet à plusieurs tronçons
     * se chiffre ligne par ligne, et chaque ligne passe ici.
     *
     * @param array<string,mixed> $config
     * @return array<string,mixed>|null
     */
    public function metre(array $config): ?array
    {
        $fam = $this->catalogue->famille($config['famille']);
        if (($fam['unitePrix'] ?? null) !== 'metre-lineaire') {
            return null;
        }
        $cloture = $this->catalogue->get('cloture');
        $longueur = (float) $config['widthMm'];

        // UN OUVRAGE CONTINU n'a ni poteau ni panneau : c'est un mur, et sa
        // fondation est une semelle filante qu'on chiffre au mètre.
        if (!empty($fam['ouvrageContinu'])) {
            return [
                'longueurMm' => $longueur,
                'poteaux' => 0,
                'poteauxAngle' => 0,
                'panneaux' => 0,
                'betonLitres' => (int) ahjc_js_round(($longueur / 1000) * $cloture['semelleLitresParMetre']),
            ];
        }
        // L'ENTRAXE A UN PLANCHER, et c'est `terrain.ts` qui le pose : sous
        // cinq cents millimètres, un catalogue mal réglé ferait un poteau
        // tous les centimètres — ou, à zéro, une division par zéro. Le
        // portage a d'abord lu la clé sans son plancher, et le premier
        
        $entraxe = max(500.0, (float) $cloture['entraxePoteauxMm']);
        $ouverture = (float) ($config['ouverture_largeur_mm'] ?? 0);
        $remplie = max(0.0, $longueur - $ouverture);
        $travees = max(1, (int) ceil($remplie / $entraxe));
        $poteaux = $travees + 1;
        return [
            'longueurMm' => $longueur,
            'poteaux' => $poteaux,
            'poteauxAngle' => 0,
            'panneaux' => $remplie > 0 ? $travees : 0,
            'betonLitres' => (int) ahjc_js_round($poteaux * $cloture['massifLitres']),
        ];
    }

    /**
     * Tout ce qui ne dépend PAS de la famille : remise quantité, total au
     * centime, arrondi commercial d'affichage.
     *
     * UNIQUE, exactement comme en TypeScript — chez les néons, la règle
     * « finaliser() est unique » est née d'une divergence réelle entre deux
     * branches. Un portage qui la recopierait dans chaque famille
     * reproduirait la faute dans un second langage.
     *
     * @param array<int,array<string,mixed>> $lines
     * @return array<string,mixed>
     */
    public function finaliser(array $lines, int $baseCents, int $quantite): array
    {
        $total = 0;
        foreach ($lines as $ligne) {
            $total += $ligne['amountCents'];
        }

        $remise_milliemes = 0;
        foreach ($this->catalogue->get('remisesQuantite') as $palier) {
            if ($quantite >= $palier['quantiteMin'] && $palier['milliemes'] > $remise_milliemes) {
                $remise_milliemes = $palier['milliemes'];
            }
        }
        if ($remise_milliemes > 0) {
            $remise = ahjc_round_half_up_div($total * $remise_milliemes, 1000);
            $lines[] = [
                'code' => 'remise-quantite',
                'type' => 'remise',
                'amountCents' => -$remise,
            ];
            $total -= $remise;
        }

        return [
            'lines' => $lines,
            'baseCents' => $baseCents,
            'totalCents' => $total,
            'displayTotalCents' => ahjc_arrondi_commercial_cents($total),
            'currency' => 'EUR',
        ];
    }

    /**
     * LES VALEURS QUE LE CATALOGUE NE CONNAÎT PAS — portage de `valeursInconnues()`.
     *
     * Le moteur indexait ses tables de coefficients avec ce que la configuration
     * portait. Une couleur, un remplissage de porte ou un vitrage inconnus
     * rendaient un index absent, que `(int)` convertissait en ZÉRO : un
     * coefficient nul, donc un prix nul, écrit dans une commande. D'autres
     * lectures retombaient en silence sur un défaut (coffre extérieur, sangle,
     * rectangle, pose en neuf) : une valeur forgée payait le prix de la moins
     * chère. Revue de l'annuaire WordPress.org, 9 octobre 2026.
     *
     * Chaque valeur d'énumération est donc cherchée AVANT d'indexer, dans le
     * même ordre qu'en TypeScript, et `calculer()` refuse à la première
     * inconnue. Ce que la validation refuse déjà EN ERREUR n'y est pas
     * (matériau, ouverture, tapée, gamme nommée, pose, modèle de porte, forme,
     * moteur, options) : leur repli est une configuration légitime,
     * jamais un coefficient nul, et le panier refuse toute configuration en
     * erreur avant de la chiffrer.
     *
     * @param array<string,mixed> $config
     * @return array<int,array{champ:string,valeur:mixed}>
     */
    public function valeurs_inconnues(array $config): array
    {
        $fam = $this->catalogue->famille((string) ($config['famille'] ?? ''));
        if (($fam['unitePrix'] ?? null) === 'piece') {
            return [];
        }
        $inconnues = [];
        $exiger = static function (string $champ, $valeur, bool $ok) use (&$inconnues): void {
            if (!$ok) {
                $inconnues[] = ['champ' => $champ, 'valeur' => $valeur];
            }
        };
        $connue = static fn ($table, $cle): bool => is_string($cle) && is_array($table) && array_key_exists($cle, $table);
        $present = static fn (string $cle): bool => array_key_exists($cle, $config);
        $id = static fn ($valeur): ?string => is_string($valeur) ? $valeur : null;

        $systeme = $this->catalogue->parId('systemes', $id($config['systeme'] ?? null));
        if (!isset($systeme['coefMilliemes'])) {
            $gamme = $systeme['gamme'] ?? ($config['gamme'] ?? null);
            $exiger('gamme', $gamme, $connue($this->catalogue->get('coefGammeMilliemes'), $gamme));
        }
        if ($config['famille'] === 'porte-entree') {
            $remplissage = $config['remplissagePorte'] ?? 'pleine';
            $exiger('remplissagePorte', $remplissage, $connue($this->catalogue->get('coefRemplissagePorteMilliemes'), $remplissage));
        }
        if ($this->est_portail($config['famille']) && $present('remplissagePortail')) {
            $exiger('remplissagePortail', $config['remplissagePortail'], $this->catalogue->parId('modelesPortail', $id($config['remplissagePortail'])) !== null);
        }
        if ($config['famille'] === 'volet-battant' && $present('modeleVolet')) {
            $exiger('modeleVolet', $config['modeleVolet'], $this->catalogue->parId('modelesVolet', $id($config['modeleVolet'])) !== null);
        }
        if ($config['famille'] === 'volet-roulant') {
            if ($present('coffre')) {
                $exiger('coffre', $config['coffre'], $connue($this->catalogue->get('coffres'), $config['coffre']));
            }
            if ($present('manoeuvre')) {
                $exiger('manoeuvre', $config['manoeuvre'], $connue($this->catalogue->get('manoeuvres'), $config['manoeuvre']));
            }
        }
        // Le vitrage n'est lu que s'il existe (une porte pleine, un volet n'en ont pas).
        $vitrage = $this->structural->vitrage_effectif($config);
        if ($vitrage !== null) {
            $base = $vitrage['base'] ?? null;
            $exiger('vitrage.base', $base, $connue($this->catalogue->get('coefVitrageMilliemes'), $base));
            $aspect = $vitrage['aspect'] ?? 'clair';
            $exiger('vitrage.aspect', $aspect, $connue($this->catalogue->get('coefAspectVitrageMilliemes'), $aspect));
        }
        $exiger('couleur', $config['couleur'] ?? null, $connue($this->catalogue->get('coefCouleurMilliemes'), $config['couleur'] ?? null));
        // L'alimentation n'est lue que sur un moteur CONNU : un moteur inconnu
        // n'écrit aucune ligne (le prix est celui de l'ouvrage sans moteur, et le
        
        $motorisation = is_array($config['motorisation'] ?? null) ? $config['motorisation'] : null;
        if ($motorisation !== null && $this->catalogue->parId('moteurs', $id($motorisation['type'] ?? null)) !== null) {
            $exiger(
                'motorisation.alimentation',
                $motorisation['alimentation'] ?? null,
                $connue($this->catalogue->get('coefAlimentationMilliemes'), $motorisation['alimentation'] ?? null)
            );
        }
        return $inconnues;
    }

    /**
     * Le prix d'UNE menuiserie, décomposé ligne à ligne.
     *
     * Ne lève jamais sur une configuration refusable : la validation dit non,
     * le prix reste défini. Un serveur qui jetterait une exception sur une
     * cote hors matrice rendrait une erreur 500 là où il doit rendre un refus
     * expliqué.
     *
     * @param array<string,mixed> $config
     * @return array<string,mixed>
     */
    public function calculer(array $config): array
    {
        $fam = $this->catalogue->famille($config['famille']);

        // 0. LA BIFURCATION DU LOT Z0. Une famille vendue À LA PIÈCE n'a pas
        //    de matrice : son prix est une SOMME DE POSTES déclarés. Elle sort
        //    donc avant la matrice, et avant les coefficients — qui
        //    multiplieraient une somme de lignes tracées et rendraient
        //    chacune fausse au regard du bordereau de l'atelier.
        if (($fam['unitePrix'] ?? null) === 'piece') {
            return $this->prix_a_la_piece($config, $fam);
        }

        // 0 bis. AUCUNE VALEUR INCONNUE n'est indexée : voir `valeurs_inconnues()`.
        $inconnues = $this->valeurs_inconnues($config);
        if ($inconnues !== []) {
            throw new InvalidArgumentException(esc_html('Valeur inconnue du catalogue : ' . $inconnues[0]['champ']));
        }

        $matrice = $this->catalogue->matricePourVantaux($fam, (int) $config['vantaux']);
        $lines = [];

        // 1. LA BASE. Deux lectures de la MÊME matrice selon l'unité de vente :
        //    à la menuiserie, la cellule est le prix de l'ouvrage entier ; au
        //    mètre courant, elle est le prix d'un mètre à cette hauteur.
        $metre = $this->metre($config);
        $base = $metre !== null
            ? ahjc_round_half_up_div(
                ahjc_base_from_matrix($matrice, 1000, $config['heightMm']) * $metre['longueurMm'],
                1000
            )
            : ahjc_base_from_matrix($matrice, $config['widthMm'], $config['heightMm']);
        $courant = $base;
        $lines[] = ['code' => 'base', 'type' => 'base', 'amountCents' => $base];

        // 2. LES COEFFICIENTS — chaque ligne porte le DELTA appliqué, et
        //    chacun s'applique au courant. L'ordre est celui du TypeScript.
        $applique = function (string $code, int $milliemes) use (&$lines, &$courant): void {
            if ($milliemes === 1000) {
                return;
            }
            $apres = ahjc_apply_coef_milliemes($courant, $milliemes);
            $lines[] = ['code' => $code, 'type' => 'coefficient', 'amountCents' => $apres - $courant];
            $courant = $apres;
        };

        $applique('coef-materiau', (int) ($fam['coefMateriauMilliemes'][$config['materiau']] ?? 1000));

        $ouverture = $config['ouverture'] ?? ($fam['ouvertures'][0] ?? null);
        if ($ouverture !== null && isset($fam['coefOuvertureMilliemes'])) {
            $applique('coef-ouverture', (int) ($fam['coefOuvertureMilliemes'][$ouverture] ?? 1000));
        }

        // Une gamme NOMMÉE peut porter son propre coefficient ; à défaut on
        // retombe sur le palier, et le prix ne bouge pas d'un centime pour
        // une configuration qui n'en choisit aucune.
        $systeme = $this->catalogue->parId('systemes', $config['systeme'] ?? null);
        $gamme_milliemes = $systeme['coefMilliemes']
            ?? $this->catalogue->get('coefGammeMilliemes')[$systeme['gamme'] ?? $config['gamme']];
        $applique('coef-gamme', (int) $gamme_milliemes);

        if ($config['famille'] === 'porte-entree') {
            // La porte d'entrée passe par le coefficient de REMPLISSAGE, qui
            // inclut déjà le feuilleté réglementaire de ses faces vitrées.
            $remplissage = $config['remplissagePorte'] ?? 'pleine';
            $applique(
                'coef-remplissage',
                (int) $this->catalogue->get('coefRemplissagePorteMilliemes')[$remplissage]
            );
            // Le MODÈLE de panneau : une porte à moulures ou à inserts d'inox
            // n'est pas une porte unie repeinte.
            $modele = $config['modelePorte'] ?? null;
            if ($modele !== null) {
                $def = $this->catalogue->parId('modelesPorte', $modele);
                if ($def !== null && $def['coefMilliemes'] !== 1000) {
                    $applique('coef-modele-porte', (int) $def['coefMilliemes']);
                }
            }
        } else {
            
            // ajouré, un découpé au laser bien plus (une passe par motif).
            if ($this->est_portail($config['famille'])) {
                $portail = $this->catalogue->parId('modelesPortail', $config['remplissagePortail'] ?? null)
                    ?? $this->catalogue->get('modelesPortail')[0];
                if ($portail !== null && $portail['coefMilliemes'] !== 1000) {
                    $applique('coef-remplissage-portail', (int) $portail['coefMilliemes']);
                }
            }
            // Le MODÈLE d'un volet battant : un plein à barres et écharpe se
            // fabrique plus vite qu'un persienné de vingt lames mortaisées.
            if ($config['famille'] === 'volet-battant') {
                $volet = $this->catalogue->parId('modelesVolet', $config['modeleVolet'] ?? null)
                    ?? $this->premier_persienne();
                if ($volet !== null && $volet['coefMilliemes'] !== 1000) {
                    $applique('coef-modele-volet', (int) $volet['coefMilliemes']);
                }
            }
            // Le COFFRE d'un volet roulant : un tunnel est un caisson isolé
            // qui se maçonne, un bloc-baie un ensemble monobloc. Ce ne sont
            // pas des variantes de pose, ce sont des produits différents.
            if ($config['famille'] === 'volet-roulant') {
                $coffres = $this->catalogue->get('coffres');
                $coffre = $config['coffre'] ?? null;
                $coffre = ($coffre !== null && isset($coffres[$coffre])) ? $coffre : 'exterieur';
                if ($coffres[$coffre]['coefMilliemes'] !== 1000) {
                    $applique('coef-coffre', (int) $coffres[$coffre]['coefMilliemes']);
                }
                // La MANŒUVRE, et seulement si le volet n'est pas motorisé :
                // une manivelle sur un volet à moteur n'existe pas, et la
                // facturer serait vendre deux fois la même fonction.
                $motorise = false;
                foreach (($config['options'] ?? []) as $choisie) {
                    if (str_starts_with((string) $choisie['id'], 'motorisation-')) {
                        $motorise = true;
                    }
                }
                if (!$motorise) {
                    $manoeuvres = $this->catalogue->get('manoeuvres');
                    $m = $config['manoeuvre'] ?? null;
                    $m = ($m !== null && isset($manoeuvres[$m])) ? $m : 'sangle';
                    if ($manoeuvres[$m]['coefMilliemes'] !== 1000) {
                        $applique('coef-manoeuvre', (int) $manoeuvres[$m]['coefMilliemes']);
                    }
                }
            }
            $vitrage = $this->structural->vitrage_effectif($config);
            if ($vitrage !== null) {
                $combine = ahjc_combine_milliemes(
                    (int) $this->catalogue->get('coefVitrageMilliemes')[$vitrage['base']],
                    !empty($vitrage['phonique']) ? (int) $this->catalogue->get('coefPhoniqueMilliemes') : 1000,
                    !empty($vitrage['feuillete']) ? (int) $this->catalogue->get('coefFeuilleteMilliemes') : 1000,
                    (int) $this->catalogue->get('coefAspectVitrageMilliemes')[$vitrage['aspect'] ?? 'clair'],
                    !empty($vitrage['storeIntegre']) ? (int) $this->catalogue->get('coefStoreIntegreMilliemes') : 1000,
                    !empty($vitrage['warmEdge']) ? (int) $this->catalogue->get('coefWarmEdgeMilliemes') : 1000
                );
                $applique('coef-vitrage', $combine);
            }
        }

        $applique('coef-couleur', (int) $this->catalogue->get('coefCouleurMilliemes')[$config['couleur']]);

        // LA FORME. Un profilé cintré passe à la cintreuse, se contrôle au
        // gabarit et se rebute : c'est le poste où un menuisier perd de
        // l'argent s'il chiffre à la louche. Le rectangle vaut 1000.
        $forme = $this->catalogue->parId('formes', $config['forme'] ?? 'rectangle')
            ?? $this->catalogue->get('formes')[0];
        if ($forme['coefMilliemes'] !== 1000) {
            $applique('coef-forme', (int) $forme['coefMilliemes']);
        }

        // LA POSE. Un seul coefficient au catalogue ne vaut pas 1000 : la
        // rénovation, parce que son dormant est un AUTRE profilé. Les autres
        // poses coûtent des heures de chantier, pas d'atelier — et le pied de
        // page annonce « pose non comprise ».
        $pose = $this->structural->pose_pour_famille($config['famille'], $config['pose'] ?? null);
        if ($pose['coefMilliemes'] !== 1000) {
            $applique('coef-pose', (int) $pose['coefMilliemes']);
        }

        // 3. LES SUPPLÉMENTS IMPOSÉS PAR LES RÈGLES — la base CORRIGÉE sert
        //    d'assiette, comme dans l'exemple chiffré de docs/04 §6.
        $base_corrigee = $courant;
        $ferrures = $this->structural->ferrures_requises($config);
        if ($ferrures === 'renforcees' || $ferrures === 'hors-limite') {
            $supplement = ahjc_round_half_up_div(
                $base_corrigee * $this->catalogue->get('ferruresRenforceesMilliemes'),
                1000
            );
            $lines[] = [
                'code' => 'ferrures-renforcees',
                'type' => 'supplement',
                'amountCents' => $supplement,
            ];
            $courant += $supplement;
        }

        // Les pièces que la POSE fait fabriquer. Ce sont des PROFILÉS —
        // l'atelier les coupe, le poseur les retrouve dans le colis. Rien ici
        // n'est de la main-d'œuvre.
        if (in_array($config['famille'], $this->catalogue->get('famillesAvecPose') ?? [], true)) {
            $perimetre = $config['widthMm'] + 2 * $config['heightMm'];
            $tapee = null;
            if (!empty($pose['tapee']) && isset($config['tapeeMm'])) {
                foreach ($this->catalogue->get('tapees') as $candidate) {
                    if ($candidate['epaisseurMm'] === $config['tapeeMm']) {
                        $tapee = $candidate;
                    }
                }
            }
            if ($tapee !== null) {
                // La tapée fait le TOUR du dormant : périmètre entier, appui
                // compris — pas les trois côtés du couvre-joint.
                $tour = 2 * ($config['widthMm'] + $config['heightMm']);
                $montant = ahjc_round_half_up_div($tour * $tapee['centsParMetre'], 1000);
                $lines[] = ['code' => 'tapee', 'type' => 'supplement', 'amountCents' => $montant];
                $courant += $montant;
            }
            if ($pose['couvreJointCentsParMetre'] > 0) {
                $montant = ahjc_round_half_up_div($perimetre * $pose['couvreJointCentsParMetre'], 1000);
                $lines[] = ['code' => 'couvre-joint', 'type' => 'supplement', 'amountCents' => $montant];
                $courant += $montant;
            }
            if ($pose['bavetteCentsParMetre'] > 0) {
                $montant = ahjc_round_half_up_div($config['widthMm'] * $pose['bavetteCentsParMetre'], 1000);
                $lines[] = ['code' => 'bavette', 'type' => 'supplement', 'amountCents' => $montant];
                $courant += $montant;
            }
        }

        $renfort = $this->catalogue->get('renfortCoulisse');
        if ($config['famille'] === 'coulissant' && $config['widthMm'] > $renfort['auDelaDeMm']) {
            $montant = ahjc_round_half_up_div($config['widthMm'] * $renfort['centsParMetre'], 1000);
            $lines[] = ['code' => 'renfort-coulisse', 'type' => 'supplement', 'amountCents' => $montant];
            $courant += $montant;
        }

        // 3 bis. LA MOTORISATION. Elle n'est pas un coefficient : c'est un
        // matériel, avec son prix, et ses SÉCURITÉS qui s'ajoutent d'office.
        $moteur = $this->catalogue->parId('moteurs', $config['motorisation']['type'] ?? null);
        if ($moteur !== null) {
            $alim = $config['motorisation']['alimentation'];
            $supplement = (int) ($this->catalogue->get('coefAlimentationMilliemes')[$alim] ?? 1000);
            $lines[] = [
                'code' => 'motorisation',
                'type' => 'option',
                'amountCents' => ahjc_round_half_up_div($moteur['amountCents'] * $supplement, 1000),
            ];
            foreach ($this->securites_retenues($config) as $securite) {
                if ($securite['amountCents'] === 0) {
                    continue;
                }
                $lines[] = [
                    'code' => 'securite-' . $securite['id'],
                    'type' => 'option',
                    'amountCents' => $securite['amountCents'],
                ];
            }
        }

        // 3 ter. LES POTEAUX d'un ouvrage linéaire. Ils ne sont pas dans le
        
        // vingt mètres — l'une droite, l'autre en L — n'en portent pas autant.
        if ($metre !== null && $metre['poteaux'] > 0) {
            $cloture = $this->catalogue->get('cloture');
            $lines[] = [
                'code' => 'poteaux',
                'type' => 'supplement',
                'amountCents' => $metre['poteaux'] * $cloture['poteauCents']
                    + $metre['poteauxAngle'] * $cloture['poteauAngleSupplementCents'],
            ];
        }

        // 4. LES OPTIONS à montant fixe.
        foreach (($config['options'] ?? []) as $choisie) {
            $def = $this->catalogue->parId('options', (string) $choisie['id']);
            if ($def === null || !in_array($config['famille'], $def['familles'], true)) {
                continue; // la validation l'a dit
            }
            $quantite = ($def['unite'] ?? null) === 'parVantail'
                ? max(1, (int) ($choisie['quantite'] ?? 1))
                : 1;
            $montant = $def['amountCents'] * $quantite;
            $lines[] = [
                'code' => 'option-' . $def['id'],
                'type' => 'option',
                'amountCents' => $montant,
            ];
            $courant += $montant;
        }

        // 5. LA CONVERGENCE COMMUNE — remise quantité, arrondi commercial.
        return $this->finaliser($lines, $base, (int) ($config['quantite'] ?? 1));
    }

    private function est_portail(string $famille): bool
    {
        return in_array($famille, ['portail-battant', 'portail-coulissant', 'portillon'], true);
    }

    /** Le modèle de volet par défaut : le persienné, à 1000 millièmes. */
    private function premier_persienne(): ?array
    {
        foreach ($this->catalogue->get('modelesVolet') as $modele) {
            if (($modele['decor']['persiennePart'] ?? null) === 1) {
                return $modele;
            }
        }
        return null;
    }

    

    private function securites_retenues(array $config): array
    {
        $portail = in_array(
            $config['famille'],
            ['portail-battant', 'portail-coulissant', 'portillon'],
            true
        );
        if (!$portail || empty($config['motorisation'])) {
            return [];
        }
        $imposees = $this->catalogue->get('securites') ?? [];
        $demandees = $config['motorisation']['securites'] ?? null;
        if ($demandees === null) {
            return $imposees;
        }
        return array_values(array_filter(
            $imposees,
            static fn (array $securite): bool => in_array($securite['id'], $demandees, true)
        ));
    }

    /**
     * LE PRIX D'UN OUVRAGE VENDU À LA PIÈCE — portage de `prixALaPiece()`.
     *
     * Les postes déclarés, les options à montant fixe, puis la convergence
     * commune. AUCUN coefficient : ils multiplieraient une somme de lignes
     * tracées.
     *
     * @param array<string,mixed> $config
     * @param array<string,mixed> $fam
     * @return array<string,mixed>
     */
    private function prix_a_la_piece(array $config, array $fam): array
    {
        $somme = ahjc_somme_des_postes($fam['postes'] ?? [], $config['postes'] ?? null);
        $lines = $somme['lignes'];

        foreach (($config['options'] ?? []) as $choisie) {
            $def = $this->catalogue->parId('options', (string) $choisie['id']);
            if ($def === null || !in_array($config['famille'], $def['familles'], true)) {
                continue; // la validation l'a dit
            }
            $quantite = ($def['unite'] ?? null) === 'parVantail'
                ? max(1, (int) ($choisie['quantite'] ?? 1))
                : 1;
            $lines[] = [
                'code' => 'option-' . $def['id'],
                'type' => 'option',
                'amountCents' => $def['amountCents'] * $quantite,
            ];
        }

        return $this->finaliser($lines, $somme['totalCents'], (int) ($config['quantite'] ?? 1));
    }
}
