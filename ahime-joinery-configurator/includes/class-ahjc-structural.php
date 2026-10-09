<?php
/**
 * Pourquoi ce fichier existe : le miroir PHP de `structural.ts` — le vitrage
 * effectif, la chaîne de cotes, le poids, et les ferrures qu'il impose.
 *
 * IL EST PORTÉ ET NON RÉINVENTÉ, fonction par fonction, dans le même ordre et
 * sous les mêmes noms. C'est ce qui rend une divergence LISIBLE : quand le
 * harnais de parité dit que `glassWeightKg` diffère, il y a une seule
 * fonction à ouvrir des deux côtés, et elles se lisent l'une à côté de
 * l'autre.
 *
 * CE QU'IL NE PORTE PAS, et c'est dit franchement : la chaîne de cotes
 * DÉTAILLÉE — cote de vitrage, fond de feuillure, cadre d'ouvrant. Elle sert
 * au DESSIN et au DÉBIT, que ce serveur ne produit pas : le dossier de
 * fabrication se produit dans le navigateur de l'administrateur, avec le
 * même code que le widget (voir `widget/src/atelier.ts`). Porter six modules
 * d'export sans qu'aucun harnais ne les compare aurait fait une seconde
 * implémentation qui dérive.
 *
 * Il en porte la PRÉSENCE et la portée du montant, parce que la validation
 * en dépend : c'est `chaineDeCotes` qui décide si la flèche se calcule, et
 * une porte PLEINE l'a sans avoir de clair de vitrage.
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

final class AHJC_Structural
{
    private AHJC_Catalogue $catalogue;

    public function __construct(AHJC_Catalogue $catalogue)
    {
        $this->catalogue = $catalogue;
    }

    /**
     * Le vitrage feuilleté est-il IMPOSÉ par la règle ?
     *
     * Porte-fenêtre toujours ; porte d'entrée dès qu'elle est vitrée (le
     * vitrage descend sous 90 cm) ; fenêtre dont l'allège déclarée passe sous
     * le seuil. Le coulissant reste un conseil, pas une obligation.
     *
     * @param array<string,mixed> $config
     */
    public function feuillete_impose(array $config): bool
    {
        $famille = $config['famille'];
        if ($famille === 'porte-fenetre') {
            return true;
        }
        if ($famille === 'porte-entree') {
            return ($config['remplissagePorte'] ?? 'pleine') !== 'pleine';
        }
        if ($famille === 'fenetre') {
            return isset($config['hauteurAllegeMm'])
                && $config['hauteurAllegeMm'] < $this->catalogue->get('feuilleteImposeAllegeSousMm');
        }
        return false;
    }

    /**
     * Le vitrage réellement fabriqué — feuilleté forcé quand la règle
     * l'impose, `null` si la famille n'est pas vitrée.
     *
     * @param array<string,mixed> $config
     * @return array<string,mixed>|null
     */
    public function vitrage_effectif(array $config): ?array
    {
        $fam = $this->catalogue->famille($config['famille']);
        $porte_vitree = $config['famille'] === 'porte-entree'
            && ($config['remplissagePorte'] ?? 'pleine') !== 'pleine';
        if (empty($fam['vitree']) && !$porte_vitree) {
            return null;
        }
        $declare = $config['vitrage'] ?? ['base' => 'double'];
        if ($this->feuillete_impose($config) && empty($declare['feuillete'])) {
            $declare['feuillete'] = true;
        }
        return $declare;
    }

    /**
     * L'épaisseur de verre cumulée (mm) — ce qui pilote le poids ET la coupe.
     *
     * @param array<string,mixed> $vitrage
     */
    public function verre_epaisseur_mm(array $vitrage): float
    {
        $verre = $this->catalogue->get('verre');
        $mm = (float) $verre['epaisseurMm'][$vitrage['base']];
        if (!empty($vitrage['phonique'])) {
            $mm += $verre['phoniqueSupplementMm'];
        }
        if (!empty($vitrage['feuillete'])) {
            $mm += $verre['feuilleteSupplementMm'];
        }
        // Le store intégré épaissit le VITRAGE, pas le verre : il lui faut de
        // la lame d'air pour que ses lames tournent.
        if (!empty($vitrage['storeIntegre'])) {
            $mm += $verre['storeIntegreSupplementMm'];
        }
        return $mm;
    }

    /**
     * L'épaisseur de VERRE seule, sans la lame d'air d'un store intégré.
     * C'est elle qui pèse : douze millimètres de vide ne pèsent rien, et les
     * compter imposerait des ferrures renforcées à une fenêtre saine.
     *
     * @param array<string,mixed> $vitrage
     */
    private function verre_seul_mm(array $vitrage): float
    {
        $verre = $this->catalogue->get('verre');
        return $this->verre_epaisseur_mm($vitrage)
            - (!empty($vitrage['storeIntegre']) ? $verre['storeIntegreSupplementMm'] : 0);
    }

    /**
     * La part du clair réellement vitrée — 40 % en semi-vitrée, 80 % en
     * vitrée sur une porte d'entrée, 1 partout ailleurs.
     *
     * @param array<string,mixed> $config
     */
    public function fraction_vitree(array $config): float
    {
        if ($config['famille'] !== 'porte-entree') {
            return 1.0;
        }
        $remplissage = $config['remplissagePorte'] ?? 'pleine';
        if ($remplissage === 'semi-vitree') {
            return 0.4;
        }
        if ($remplissage === 'vitree') {
            return 0.8;
        }
        return 0.0;
    }

    /** La pose applicable à cette famille — sinon la référence, `neuf-tableau`. */
    public function pose_pour_famille(string $famille, ?string $pose): array
    {
        $poses = $this->catalogue->get('poses');
        $applicable = in_array($famille, $this->catalogue->get('famillesAvecPose') ?? [], true);
        if (!$applicable) {
            return $poses['neuf-tableau'];
        }
        return $poses[$pose ?? 'neuf-tableau'] ?? $poses['neuf-tableau'];
    }

    /** @return array<string,mixed>|null */
    public function deductions_de(string $famille, string $materiau): ?array
    {
        $d = $this->catalogue->chemin('familles', $famille, 'deductions', $materiau);
        return is_array($d) ? $d : null;
    }

    /**
     * LA MASSE VUE PAR CÔTÉ — dormant plus ouvrant, l'écart de rénovation
     * déduit. Sans déductions de gamme, la bande forfaitaire par matériau.
     *
     * @param array<string,mixed>|null $pose
     */
    public function masse_vue_mm(string $famille, string $materiau, ?array $pose = null): float
    {
        $d = $this->deductions_de($famille, $materiau);
        if ($d === null) {
            $bande = $this->catalogue->chemin('familles', $famille, 'frameBandMm', $materiau);
            if ($bande === null) {
                $bande = $this->catalogue->chemin('frameBandMm', $materiau);
            }
            return (float) ($bande ?? 110);
        }
        // La RÉNOVATION mange moins : le dormant qui se loge dans l'ancien est
        // plus mince que le dormant neuf.
        $reno = ($pose !== null && $pose['recouvrementMm'] > 0) ? $d['renovationEcartMm'] : 0;
        return max(0.0, (float) $d['dormantVuMm'] + (float) $d['ouvrantVuMm'] - $reno);
    }

    /**
     * Le rapport de mesure — cotes de vantail, clair de vitrage, poids.
     *
     * Les poids sont arrondis au dixième de kilogramme : c'est la précision
     * que la parité compare (`glassWeightKg`), et c'est aussi la seule qui
     * ait un sens sur un verre découpé.
     *
     * @param array<string,mixed> $config
     * @return array<string,mixed>
     */
    /**
     * LE COFFRE D'UN BLOC-BAIE, en mm — zéro sans l'option.
     *
     * La spirale d'enroulement est celle du volet roulant, et elle est
     * recopiée de `geometrie/profils.ts` comme le reste de ce moteur : même
     * formule, mêmes tailles du commerce, même arrondi.
     *
     * @param array<string,mixed> $config
     */
    public function coffre_du_bloc_baie_mm(array $config): int
    {
        $pris = false;
        foreach (($config['options'] ?? []) as $option) {
            if (($option['id'] ?? '') === 'bloc-baie-manuel') {
                $pris = true;
            }
        }
        if (!$pris) {
            return 0;
        }
        $longueur = max(0, (float) $config['heightMm']);
        $lame = 41.0;
        $epaisseur = $lame >= 50 ? 13.0 : 9.0;
        $tube = 60.0;
        $diametre = sqrt($tube * $tube + (4 * $longueur * $epaisseur) / M_PI);
        $besoin = $diametre + 30;
        foreach ([165, 180, 205, 250] as $taille) {
            if ($besoin <= $taille) {
                return $taille;
            }
        }
        return (int) ahjc_js_round($besoin);
    }

    /**
     * LA HAUTEUR DE LA MENUISERIE — la cote commandée moins ce que le coffre
     * d'un bloc-baie prend.
     *
     * @param array<string,mixed> $config
     */
    public function hauteur_de_menuiserie_mm(array $config): float
    {
        return max(0, (float) $config['heightMm'] - $this->coffre_du_bloc_baie_mm($config));
    }

    public function rapport_de_mesure(array $config): array
    {
        $vantaux = max(1, (int) ahjc_js_round((float) $config['vantaux']));
        $vantail_width = (int) ahjc_js_round($config['widthMm'] / $vantaux);
        // LE COFFRE D'UN BLOC-BAIE PREND SUR LA HAUTEUR COMMANDÉE — lot O10,
        // et c'est une CORRECTION de convention portée des deux côtés.
        //
        // La cote saisie est celle du TABLEAU, et le catalogue le dit : « du
        // rejingot au linteau, au plus court des trois mesures ». Un bloc-baie
        // est un MONOBLOC — son coffre entre dans le trou AVEC le dormant.
        // MESURÉ côté JavaScript avant correction, sur une fenêtre
        // 1 200 × 1 450 : le coffre de 180 mm s'AJOUTAIT par-dessus, et la
        // mesure l'ignorait — le vantail, le clair, la masse de vitrage et
        // l'Uw étaient identiques avec et sans l'option. L'ouvrage ne rentrait
        // pas dans le trou mesuré, de 12,4 % de sa hauteur.
        //
        // `glassWeightKg` et `uw` sont deux des NEUF champs que le harnais
        // compare : sans ce portage, la parité tomberait sur le premier témoin
        // qui prend l'option (docs/54).
        $vantail_height = max(
            0,
            $this->hauteur_de_menuiserie_mm($config) - ($config['imposteHauteurMm'] ?? 0)
        );

        $pose = $this->pose_pour_famille($config['famille'], $config['pose'] ?? null);
        $bande = $this->masse_vue_mm($config['famille'], $config['materiau'], $pose);

        $vitrage = $this->vitrage_effectif($config);
        $d = $this->deductions_de($config['famille'], $config['materiau']);

        // DEUX CHOSES INDÉPENDANTES — le miroir exact du commentaire de
        // `structural.ts`, et la même faute commise deux fois avant d'y
        // arriver : le CLAIR et le POIDS demandent un vitrage ; la CHAÎNE DE
        // COTES demande les déductions. Une porte PLEINE se débite comme une
        // porte vitrée ; une fenêtre de toit est vitrée et n'a pas de
        // déductions. On ne sort que s'il manque LES DEUX.
        if ($vitrage === null && $d === null) {
            return [
                'widthMm' => $config['widthMm'],
                'heightMm' => $config['heightMm'],
                'vantaux' => $vantaux,
                'vantail' => ['widthMm' => $vantail_width, 'heightMm' => $vantail_height],
                'clairVitrage' => null,
                'chaineDeCotes' => null,
                'verreMm' => 0.0,
                'glassWeightKgParVantail' => 0.0,
                'glassWeightKg' => 0.0,
                'poidsVantailKg' => 0.0,
            ];
        }

        // LE BATTEMENT SE DÉDUIT UNE FOIS de la largeur totale — jamais deux
        // fois d'un demi-vantail, ce qui faisait porter à un deux-vantaux un
        // refend de 230 mm là où le métier en pose 112.
        $battement = $d['battementMm'] ?? 0;
        $clair_total = max(0.0, $config['widthMm'] - 2 * $bande - $battement * ($vantaux - 1));
        $clair_width = (int) ahjc_js_round($clair_total / $vantaux);
        $clair_height = max(0.0, $vantail_height - 2 * $bande);
        // LE VERRE, s'il y en a — une porte pleine n'en a pas et se débite
        // quand même.
        $verre_mm = $vitrage === null ? 0.0 : $this->verre_epaisseur_mm($vitrage);
        $fraction = $this->fraction_vitree($config);
        $aire_m2 = ($clair_width * $clair_height * $fraction) / 1000000;

        $verre = $this->catalogue->get('verre');
        // Le poids : le VERRE seul, plus le store s'il y en a un. Un vénitien
        // intégré pèse ses lames, ses rails et sa commande.
        $par_vantail = $vitrage === null ? 0.0 : ahjc_arrondi_dixieme(
            $aire_m2 * $this->verre_seul_mm($vitrage) * $verre['kgParM2ParMm']
            + (!empty($vitrage['storeIntegre']) ? $aire_m2 * $verre['storeIntegreKgParM2'] : 0)
        );

        // LE POIDS DU VANTAIL COMPLET — verre, cadre et ferrure. C'est LUI que
        // les abaques comparent : une ferrure porte un ouvrant, pas une vitre.
        $perimetre_m = (2 * ($vantail_width + $vantail_height)) / 1000;
        $masses = $this->catalogue->get('masseLineiqueKgParM');
        $poids_cadre = $perimetre_m * ($masses[$config['materiau']] ?? 2.4)
            + $this->catalogue->get('ferrureKgParVantail');

        return [
            'widthMm' => $config['widthMm'],
            'heightMm' => $config['heightMm'],
            'vantaux' => $vantaux,
            'vantail' => ['widthMm' => $vantail_width, 'heightMm' => $vantail_height],
            // LE CLAIR reste `null` sans verre : un panneau plein n'a pas de
            // clair de vitrage, et en annoncer un ferait commander du verre.
            'clairVitrage' => $vitrage === null
                ? null
                : ['widthMm' => $clair_width, 'heightMm' => $clair_height],
            // LA CHAÎNE DE COTES, elle, suit les DÉDUCTIONS. Le portage n'en
            // rend que ce dont la validation a besoin : sa présence, et la
            // portée du montant le plus chargé.
            'chaineDeCotes' => $d === null
                ? null
                : ['dimensionFabrication' => [
                    'widthMm' => $config['widthMm'],
                    'heightMm' => $config['heightMm'],
                ], 'masseVueMm' => $bande],
            'verreMm' => $verre_mm,
            'glassWeightKgParVantail' => $par_vantail,
            'glassWeightKg' => ahjc_arrondi_dixieme($par_vantail * $vantaux),
            'poidsVantailKg' => ahjc_arrondi_dixieme($par_vantail + $poids_cadre),
        ];
    }

    /**
     * Les ferrures qu'impose le poids du vantail — `standard`, `renforcees`,
     * `hors-limite`, ou `null` quand la famille n'a pas de seuils.
     *
     * `hors-limite` n'est pas une erreur ici : c'est la validation qui en
     * fait un refus expliqué. Le prix, lui, reste défini.
     *
     * @param array<string,mixed> $config
     */
    public function ferrures_requises(array $config): ?string
    {
        $fam = $this->catalogue->famille($config['famille']);
        if (empty($fam['seuilsFerrures'])) {
            return null;
        }
        $mesure = $this->rapport_de_mesure($config);
        if ($mesure['clairVitrage'] === null) {
            return null;
        }
        $poids = $mesure['poidsVantailKg'];
        if ($poids > $fam['seuilsFerrures']['renforceKg']) {
            return 'hors-limite';
        }
        if ($poids > $fam['seuilsFerrures']['standardKg']) {
            return 'renforcees';
        }
        return 'standard';
    }
}
