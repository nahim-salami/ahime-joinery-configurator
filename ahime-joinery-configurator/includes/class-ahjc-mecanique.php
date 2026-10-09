<?php
/**
 * Pourquoi ce fichier existe : le miroir PHP de `mecanique.ts` — la charge de
 * vent (EN 1991-1-4), la flèche d'un montant (EN 12210), l'épaisseur de verre
 * conseillée (EN 16612).
 *
 * POURQUOI LE SERVEUR EN A BESOIN, alors qu'il n'affiche rien : ce sont ces
 * trois calculs qui produisent les REFUS `aev-insuffisant` et
 * `fleche-excessive`. Un serveur qui ne les ferait pas accepterait une
 * commande que le widget avait refusée — et le refus, ici, n'est pas une
 * préférence commerciale : c'est une menuiserie qui fléchit.
 *
 * LES CONSTANTES SONT ÉCRITES ICI, pas au catalogue, exactement comme du côté
 * TypeScript. Ce ne sont pas des tarifs qu'un marchand règle : ce sont la
 * masse volumique de l'air, le module d'Young du PVC et les paliers d'une
 * norme européenne. Les mettre au catalogue laisserait croire qu'on peut les
 * négocier.
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

final class AHJC_Mecanique
{
    /** Vitesse de référence du vent par région française, m/s (annexe nationale). */
    private const VITESSE_REFERENCE = [1 => 22, 2 => 24, 3 => 26, 4 => 28];

    /**
     * Facteur de rugosité par catégorie de terrain, et hauteur sous laquelle
     * il ne descend plus. Les paliers d'EN 1991-1-4, simplifiés en un couple :
     * la formule logarithmique complète demande `z0` et `kr`, et sa précision
     * n'a de sens qu'avec un `cpe` de rive qu'un configurateur n'a pas.
     */
    private const TERRAIN = [
        'mer' => ['facteur' => 1.18, 'hauteurMinM' => 1],
        'rase-campagne' => ['facteur' => 1.0, 'hauteurMinM' => 2],
        'bocage' => ['facteur' => 0.86, 'hauteurMinM' => 5],
        'urbain' => ['facteur' => 0.73, 'hauteurMinM' => 9],
        'ville-dense' => ['facteur' => 0.62, 'hauteurMinM' => 15],
    ];

    /** Masse volumique de l'air, kg/m³ — la constante d'EN 1991-1-4. */
    private const RHO_AIR = 1.25;

    /** Module d'Young, MPa. L'acier de renfort travaille presque seul. */
    private const MODULE_YOUNG = [
        'pvc' => 2700,
        'alu' => 70000,
        'bois' => 11000,
        'mixte' => 11000,
        'acier' => 210000,
    ];

    /**
     * L'épaisseur de PAROI d'un profilé, mm — ce qui porte vraiment.
     * Le bois est PLEIN : une paroi de 999 revient à la section pleine, et
     * c'est physiquement exact.
     */
    private const PAROI_MM = ['pvc' => 2.8, 'alu' => 1.8, 'bois' => 999, 'mixte' => 999];

    private const JEU_DE_POSE_RENFORT_MM = 10;
    private const PAROI_RENFORT_MM = 2;

    /** Ce qu'une déclaration qualitative vaut en région, du côté sûr. */
    public static function region_depuis_zone(string $zone): int
    {
        if ($zone === 'abritee') {
            return 1;
        }
        if ($zone === 'exposee') {
            return 3;
        }
        return 2;
    }

    /**
     * LA CHARGE DE VENT, d'une adresse à des pascals.
     *
     * @return array{qpPa:int,classePression:int,classement:string}
     */
    public static function charge_de_vent(int $region, string $terrain, float $hauteurM): array
    {
        $t = self::TERRAIN[$terrain];
        $hauteur = max($t['hauteurMinM'], $hauteurM);
        // La vitesse moyenne croît avec la hauteur ; la racine cubique
        // approche le profil logarithmique entre 3 et 30 m, à quelques pour
        // cent près — le domaine des maisons et des petits collectifs.
        $vitesse = self::VITESSE_REFERENCE[$region] * $t['facteur'] * (($hauteur / 10) ** (1 / 3));
        // qp = (1 + 7·Iv) · ½ · ρ · vm², l'intensité de turbulence prise à
        // 0,19, sa valeur en terrain courant.
        $qp = (1 + 7 * 0.19) * 0.5 * self::RHO_AIR * $vitesse * $vitesse;
        $qpPa = (int) ahjc_js_round($qp);
        $classe = self::classe_de_pression($qpPa);
        return [
            'qpPa' => $qpPa,
            'classePression' => $classe,
            // La lettre est la RIGIDITÉ, le chiffre la pression. On vise la
            // classe C — flèche sous L/300 — celle qu'un CCTP demande.
            'classement' => 'V*C' . $classe,
        ];
    }

    /**
     * La classe EN 12210 qui couvre une pression — 400, 800, 1200, 1600,
     * 2000 Pa. Au-delà, la norme sort de ses classes numérotées et note la
     * valeur d'essai : on rend 6 pour que l'appelant sache qu'on est dehors.
     */
    public static function classe_de_pression(int $qpPa): int
    {
        $paliers = [400, 800, 1200, 1600, 2000];
        foreach ($paliers as $index => $palier) {
            if ($qpPa <= $palier) {
                return $index + 1;
            }
        }
        return 6;
    }

    /**
     * LE MOMENT QUADRATIQUE d'un montant, cm⁴, déduit de sa SECTION RÉELLE —
     * `I = (b·h³ − (b−2e)·(h−2e)³) / 12`, `h` étant la profondeur, celle qui
     * compte au cube.
     *
     * Volontairement conservateur : les cloisons intérieures sont ignorées
     * (elles n'ajoutent presque rien en flexion) et le renfort acier se
     * demande explicitement, plus bas.
     */
    public static function inertie_profil_cm4(string $materiau, float $profondeurMm, float $largeurMm): float
    {
        $h = max(1.0, $profondeurMm);
        $b = max(1.0, $largeurMm);
        $e = min(self::PAROI_MM[$materiau], $b / 2, $h / 2);
        $creux_b = max(0.0, $b - 2 * $e);
        $creux_h = max(0.0, $h - 2 * $e);
        $i_mm4 = ($b * $h ** 3 - $creux_b * $creux_h ** 3) / 12;
        return ahjc_js_round(($i_mm4 / 10000) * 100) / 100;
    }

    /**
     * LE MOMENT QUADRATIQUE DU RENFORT ACIER — celui du TUBE, pas celui du
     * profilé qui l'abrite.
     *
     * Un renfort n'est pas « du PVC avec le module de l'acier » : c'est un
     * tube mince logé dans la chambre, avec sa propre section. Confondre les
     * deux supposait un montant en acier plein de 70 mm de profondeur — huit
     * fois trop rigide.
     */
    public static function inertie_renfort_cm4(string $materiau, float $profondeurMm): float
    {
        if ($materiau === 'bois') {
            return 0.0;
        }
        $cote = $profondeurMm - 2 * self::PAROI_MM[$materiau] - self::JEU_DE_POSE_RENFORT_MM;
        if ($cote < 20) {
            return 0.0;
        }
        $creux = $cote - 2 * self::PAROI_RENFORT_MM;
        $i_mm4 = ($cote ** 4 - $creux ** 4) / 12;
        return ahjc_js_round(($i_mm4 / 10000) * 100) / 100;
    }

    /**
     * LA FLÈCHE d'un montant sous le vent — `f = 5·w·L⁴ / (384·E·I)`, appui
     * simple et charge uniforme.
     *
     * La règle « renfort au-delà d'un mètre » que le métier applique n'est
     * pas une convention commerciale : c'est cette formule arrondie.
     *
     * @return array{flecheMm:float,admissibleMm:float,renfortRequis:bool}
     */
    public static function fleche(
        float $pressionPa,
        float $porteeMm,
        float $largeurTributaireMm,
        string $materiau,
        float $inertieCm4,
        float $renfortCm4 = 0.0
    ): array {
        // Charge linéique : la pression (N/mm²) par la largeur reprise.
        $w = ($pressionPa / 1000000) * $largeurTributaireMm;
        // LA RIGIDITÉ COMPOSITE. Deux barres solidaires se comportent comme
        // des ressorts en parallèle : c'est ΣEI qui résiste, pas le plus
        // rigide des deux. L'acier apporte vingt-cinq fois ce qu'apporte le
        // PVC — mais le PVC est encore là.
        $renfort_mm4 = max(0.0, $renfortCm4) * 10000;
        $rigidite = self::MODULE_YOUNG[$materiau] * max(0.01, $inertieCm4) * 10000
            + self::MODULE_YOUNG['acier'] * $renfort_mm4;
        $f = (5 * $w * $porteeMm ** 4) / (384 * $rigidite);
        // Classe C d'EN 12210, plafonnée à 15 mm comme le demandent la
        // plupart des cahiers des charges.
        $admissible = min(15.0, $porteeMm / 300);
        return [
            'flecheMm' => ahjc_js_round($f * 100) / 100,
            'admissibleMm' => ahjc_js_round($admissible * 100) / 100,
            'renfortRequis' => $f > $admissible,
        ];
    }

    /**
     * L'ÉPAISSEUR DE VERRE conseillée en face extérieure — les repères de
     * terrain d'EN 16612, pas une note de calcul, et le module le dit.
     *
     * @return array{faceExterieureMm:int,etudeRequise:bool}
     */
    public static function epaisseur_verre_conseillee_mm(float $surfaceM2, float $pressionPa): array
    {
        // Une pression forte revient à agrandir : on ramène la surface à son
        // équivalent sous 900 Pa, la pression d'une maison courante.
        $equivalente = $surfaceM2 * max(1.0, $pressionPa / 900);
        foreach ([[1.5, 4], [2.5, 6], [4.0, 8]] as [$limite, $epaisseur]) {
            if ($equivalente <= $limite) {
                return ['faceExterieureMm' => $epaisseur, 'etudeRequise' => false];
            }
        }
        return ['faceExterieureMm' => 10, 'etudeRequise' => true];
    }
}
