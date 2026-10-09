<?php
/**
 * Pourquoi ce fichier existe : le catalogue, côté serveur — et l'arithmétique
 * entière sur laquelle tout le reste repose.
 *
 * IL NE CONTIENT AUCUN TARIF. Le catalogue est sérialisé une fois depuis le
 * TypeScript (`npm run exporter:catalogue`) et lu ici tel quel : un seul
 * catalogue, deux langages. Le retaper en PHP l'aurait rendu juste le jour de
 * la recopie et faux au premier tarif changé — et le harnais de parité aurait
 * annoncé « les prix diffèrent », ce qui envoie chercher le défaut dans la
 * formule alors qu'il est dans la donnée.
 *
 * L'ARITHMÉTIQUE EST LE VRAI SUJET DE CE FICHIER. « Le client ne paie jamais
 * un chiffre venu du navigateur » (docs/00 §8) : ce module recalcule, et son
 * résultat doit être IDENTIQUE AU CENTIME à celui du widget. Les écarts d'un
 * centime entre widget et plugin sont l'incident fondateur du projet —
 * indétectables à l'œil, fatals à la confiance.
 *
 * D'où trois règles, et elles ne se négocient pas :
 *   1. CENTIMES ENTIERS PARTOUT. Aucun flottant dans un calcul d'argent.
 *   2. L'ARRONDI EST CELUI DE JAVASCRIPT, écrit explicitement — `intdiv()`
 *      tronque vers zéro là où `Math.floor` descend, et `round()` de PHP
 *      s'éloigne de zéro là où `Math.round` monte. Sur des valeurs positives
 *      ils s'accordent ; les écrire quand même est ce qui empêchera un
 *      montant négatif de diverger le jour où il y en aura un.
 *   3. LES BORNES SONT CELLES DU DOUBLE IEEE754, les mêmes des deux côtés :
 *      exact tant que 2N < 2^53, ce que garantissent des prix < 10 M€.
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

final class AHJC_Catalogue
{
    /** @var array<string,mixed> */
    private array $data;

    /** @param array<string,mixed> $data */
    private function __construct(array $data)
    {
        $this->data = $data;
    }

    /**
     * Le catalogue publié, lu depuis son JSON.
     *
     * IL REFUSE UN FICHIER ABSENT OU ILLISIBLE au lieu de retomber sur un
     * catalogue vide : un moteur de prix sans tarifs ne rend pas une erreur,
     * il rend zéro — et zéro euro est un prix que le serveur écrirait dans
     * une commande.
     */
    public static function depuisFichier(string $chemin): self
    {
        if (!is_readable($chemin)) {
            throw new RuntimeException(esc_html("Catalogue introuvable ou illisible : {$chemin}"));
        }
        $brut = file_get_contents($chemin);
        if ($brut === false) {
            throw new RuntimeException(esc_html("Catalogue illisible : {$chemin}"));
        }
        $data = json_decode($brut, true);
        if (!is_array($data) || !isset($data['familles'], $data['version'])) {
            throw new RuntimeException(esc_html("Catalogue mal formé : {$chemin}"));
        }
        return new self($data);
    }

    /**
     * Le catalogue entier, tel qu'il a été lu : c'est LUI que reçoit le widget.
     * Le navigateur et le serveur tarifient ainsi sur le même fichier, celui du
     * marchand quand il en a déposé un, jamais l'un sur le sien et l'autre sur
     * celui du plugin.
     *
     * @return array<string,mixed>
     */
    public function donnees(): array
    {
        return $this->data;
    }

    public function version(): string
    {
        return (string) $this->data['version'];
    }

    /** @return mixed */
    public function get(string $cle)
    {
        return $this->data[$cle] ?? null;
    }

    /**
     * Une valeur en profondeur : `$catalogue->chemin('thermique', 'psiWarmEdge')`.
     * Rend `null` dès qu'un maillon manque — jamais une exception, parce que
     * le catalogue d'un marchand peut être plus pauvre que celui de référence.
     */
    public function chemin(string ...$cles)
    {
        $courant = $this->data;
        foreach ($cles as $cle) {
            if (!is_array($courant) || !array_key_exists($cle, $courant)) {
                return null;
            }
            $courant = $courant[$cle];
        }
        return $courant;
    }

    /**
     * La famille, ou une exception qui la NOMME.
     *
     * Le miroir exact de `familleCatalog()` : une famille inconnue est une
     * erreur de programme, pas une configuration à chiffrer prudemment.
     *
     * @return array<string,mixed>
     */
    public function famille(string $famille): array
    {
        $fam = $this->data['familles'][$famille] ?? null;
        if (!is_array($fam)) {
            throw new RuntimeException(esc_html("Famille inconnue du catalogue : {$famille}"));
        }
        return $fam;
    }

    /**
     * La matrice de prix pour un nombre de vantaux — la plus proche à défaut
     * d'exacte, comme `matricePourVantaux()`.
     *
     * @param array<string,mixed> $fam
     * @return array<string,mixed>
     */
    public function matricePourVantaux(array $fam, int $vantaux): array
    {
        $matrices = $fam['matrices'];
        $exacte = $matrices[(string) $vantaux] ?? null;
        if (is_array($exacte)) {
            return $exacte;
        }
        $cles = array_map('intval', array_keys($matrices));
        sort($cles);
        $proche = $cles[0];
        foreach ($cles as $cle) {
            if (abs($cle - $vantaux) < abs($proche - $vantaux)) {
                $proche = $cle;
            }
        }
        return $matrices[(string) $proche];
    }

    /**
     * Le premier élément d'une liste dont le champ `id` vaut `$id`.
     *
     * @param string $liste  la clé de la liste au catalogue
     * @return array<string,mixed>|null
     */
    public function parId(string $liste, ?string $id): ?array
    {
        if ($id === null || $id === '') {
            return null;
        }
        foreach (($this->data[$liste] ?? []) as $element) {
            if (($element['id'] ?? null) === $id) {
                return $element;
            }
        }
        return null;
    }
}

/**
 * Division entière arrondie « moitié vers le haut ».
 *
 * `floor((2N + D) / 2D)`, écrit exactement comme en JavaScript. `intdiv()`
 * aurait été plus rapide et FAUX sur un numérateur négatif : elle tronque
 * vers zéro, `floor` descend. Aucun montant négatif ne passe ici aujourd'hui ;
 * l'écrire ainsi est ce qui évitera la divergence le jour où il y en aura un.
 */
function ahjc_round_half_up_div(float $num, float $den): int
{
    return (int) floor((2 * $num + $den) / (2 * $den));
}

/** Applique un coefficient en millièmes (1060 = ×1,06) — entier. */
function ahjc_apply_coef_milliemes(int $cents, int $milliemes): int
{
    return ahjc_round_half_up_div($cents * $milliemes, 1000);
}

/**
 * `Math.round()` de JavaScript, qui n'est pas `round()` de PHP.
 *
 * JS arrondit la demie vers le HAUT (−0,5 → −0) ; PHP l'éloigne de zéro
 * (−0,5 → −1). Sur des poids et des coefficients positifs les deux
 * s'accordent, et c'est justement pourquoi la différence ne se verrait pas
 * en essai avant de se voir en production.
 */
function ahjc_js_round(float $x): float
{
    return floor($x + 0.5);
}

/** Arrondi au dixième — la précision de parité des poids (kg). */
function ahjc_arrondi_dixieme(float $x): float
{
    return ahjc_js_round($x * 10) / 10;
}

/** Arrondi au centième — la précision de parité du Uw. */
function ahjc_arrondi_centieme(float $x): float
{
    return ahjc_js_round($x * 100) / 100;
}

/** L'arrondi commercial : au dixième d'euro, moitié vers le haut. */
function ahjc_arrondi_commercial_cents(int $cents): int
{
    return ahjc_round_half_up_div($cents, 10) * 10;
}

/**
 * Combine des coefficients cumulables par multiplication de millièmes,
 * arrondi au millième à chaque étape — l'ordre compte, et c'est celui de
 * l'appelant.
 *
 * @param int ...$milliemes
 */
function ahjc_combine_milliemes(int ...$milliemes): int
{
    $acc = 1000;
    foreach ($milliemes as $m) {
        $acc = ahjc_round_half_up_div($acc * $m, 1000);
    }
    return $acc;
}

/**
 * Encadre `$x` entre deux paliers d'une matrice.
 *
 * Sous le premier palier : prix plancher. Au-delà du dernier : borné au
 * dernier — c'est la VALIDATION qui refuse une cote hors matrice, pas le
 * prix, qui doit rester défini pour que rien ne casse pendant la correction.
 *
 * @param array<int,int|float> $paliers
 * @return array{lo:int,hi:int,num:float,den:float}
 */
function ahjc_voisins(array $paliers, float $x): array
{
    $dernier = count($paliers) - 1;
    if ($x <= $paliers[0]) {
        return ['lo' => 0, 'hi' => 0, 'num' => 0.0, 'den' => 1.0];
    }
    if ($x >= $paliers[$dernier]) {
        return ['lo' => $dernier, 'hi' => $dernier, 'num' => 0.0, 'den' => 1.0];
    }
    $i = 0;
    while ($paliers[$i + 1] < $x) {
        $i++;
    }
    if ((float) $paliers[$i] === $x) {
        return ['lo' => $i, 'hi' => $i, 'num' => 0.0, 'den' => 1.0];
    }
    return [
        'lo' => $i,
        'hi' => $i + 1,
        'num' => $x - $paliers[$i],
        'den' => $paliers[$i + 1] - $paliers[$i],
    ];
}

/**
 * Le prix de base d'une matrice pour des cotes au millimètre — interpolation
 * bilinéaire exacte en arithmétique entière, arrondie au centime.
 *
 * @param array<string,mixed> $matrix
 */
function ahjc_base_from_matrix(array $matrix, float $widthMm, float $heightMm): int
{
    $w = ahjc_voisins($matrix['widthsMm'], $widthMm);
    $h = ahjc_voisins($matrix['heightsMm'], $heightMm);
    $c = $matrix['cellsCents'];
    $numerateur =
        $c[$h['lo']][$w['lo']] * ($w['den'] - $w['num']) * ($h['den'] - $h['num'])
        + $c[$h['lo']][$w['hi']] * $w['num'] * ($h['den'] - $h['num'])
        + $c[$h['hi']][$w['lo']] * ($w['den'] - $w['num']) * $h['num']
        + $c[$h['hi']][$w['hi']] * $w['num'] * $h['num'];
    return ahjc_round_half_up_div($numerateur, $w['den'] * $h['den']);
}

/**
 * LE MONTANT D'UN POSTE, à l'entier de bout en bout — lot Z0.
 *
 *     montantCents = arrondiMoitiéHaut(quantitéMillièmes × prixUnitaire / 1000)
 *
 * La même arithmétique que les coefficients en millièmes, dans le même ORDRE
 * qu'en TypeScript. Multiplier d'abord et diviser ensuite n'est pas un
 * détail : diviser d'abord perdrait le dernier centime, et le harnais de
 * parité tombe pour un centime.
 */
function ahjc_montant_de_poste(int $quantite_milliemes, int $prix_unitaire_cents): int
{
    return ahjc_round_half_up_div($quantite_milliemes * $prix_unitaire_cents, 1000);
}

/**
 * LA SOMME DES POSTES d'une famille vendue à la pièce — portage 1:1 de
 * `prix-a-la-piece.ts`.
 *
 * C'est une fonction LIBRE et non une méthode, exactement comme son jumeau
 * TypeScript est un module à part : elle ne dépend ni du catalogue ni de la
 * structure, et le validateur en a besoin autant que le moteur de prix. En
 * faire une méthode de `AHJC_Pricing` aurait obligé `AHJC_Validate` à tenir
 * une référence sur le moteur de prix pour dire un refus.
 *
 * UN POSTE SANS PRIX UNITAIRE NE VAUT PAS ZÉRO : il ne produit aucune ligne,
 * et son motif part dans `refus`. C'est la validation qui le dit au client ;
 * le prix, lui, reste défini.
 *
 * L'ORDRE EST CELUI DU CATALOGUE, pas celui de la saisie — sinon deux moteurs
 * rendraient les mêmes lignes dans un ordre différent, et le harnais compare
 * la SUITE des lignes, pas seulement le total.
 *
 * @param array<int,array<string,mixed>> $declares
 * @param array<int,array<string,mixed>>|null $choisis
 * @return array<string,mixed>
 */
function ahjc_somme_des_postes(array $declares, ?array $choisis): array
{
    $lignes = [];
    $refus = [];
    $connus = [];
    foreach ($declares as $poste) {
        $connus[$poste['id']] = true;
    }
    $demandes = [];
    foreach ($choisis ?? [] as $choisi) {
        if (!isset($connus[$choisi['id']])) {
            $refus[] = ['id' => $choisi['id'], 'motif' => 'poste-inconnu'];
            continue;
        }
        $demandes[$choisi['id']] = $choisi['quantiteMilliemes'] ?? null;
    }

    foreach ($declares as $poste) {
        $demande = array_key_exists($poste['id'], $demandes)
            ? $demandes[$poste['id']]
            : ($poste['quantiteMilliemesParDefaut'] ?? null);
        if ($demande === null) {
            continue;
        }
        $demande = (int) $demande;
        if ($demande < 0) {
            $refus[] = ['id' => $poste['id'], 'motif' => 'quantite-negative'];
            continue;
        }
        if (!isset($poste['prixUnitaireCents'])) {
            $refus[] = ['id' => $poste['id'], 'motif' => 'prix-unitaire-non-declare'];
            continue;
        }
        if ($demande === 0) {
            continue;
        }
        $lignes[] = [
            'code' => 'poste-' . $poste['id'],
            'type' => 'base',
            'amountCents' => ahjc_montant_de_poste($demande, (int) $poste['prixUnitaireCents']),
        ];
    }

    $total = 0;
    foreach ($lignes as $ligne) {
        $total += $ligne['amountCents'];
    }
    return ['lignes' => $lignes, 'totalCents' => $total, 'refus' => $refus];
}
