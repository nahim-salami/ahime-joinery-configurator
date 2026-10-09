
import type { FamilleId, JoineryConfiguration } from './types.ts';

/**
 * LES FAMILLES MUES PAR UN MOTEUR TUBULAIRE. Le volet roulant en fait
 * partie depuis toujours ; les deux protections solaires l'ont rejoint au
 * lot S1. Le store banne aussi — mais son tablier pend sur des bras, sa
 * masse ne se calcule pas de la même façon, et il attend sa donnée
 * (docs/23).
 */
export const FAMILLES_A_MOTEUR_TUBULAIRE: readonly FamilleId[] = [
  'volet-roulant',
  'bso',
  'screen-zip',
];

export function seMeutParTubulaire(famille: FamilleId): boolean {
  return FAMILLES_A_MOTEUR_TUBULAIRE.includes(famille);
}

/**
 * LES TYPES DE TUBE relevés au catalogue Somfy, en millimètres.
 *
 * Le tube n'est pas un détail de montage : c'est lui qui fixe le rayon de
 * départ, donc le couple initial, donc la ligne de l'abaque. Un tablier
 * enroulé sur un tube de 40 et sur un tube de 70 ne demande pas le même
 * moteur.
 *
 * Les cotes viennent de `somfy-catalogue-moteurs.pdf` (pouces convertis) :
 * rond 63,5 et 89 ; octogonal 40, 60 et 70 ; rond 70 et 75.
 */
export const TUBES = {
  'octo-40': { nom: 'Octogonal 40', diametreMm: 40, forme: 'octogonal' },
  'octo-60': { nom: 'Octogonal 60', diametreMm: 60, forme: 'octogonal' },
  'octo-70': { nom: 'Octogonal 70', diametreMm: 70, forme: 'octogonal' },
  'rond-63': { nom: 'Rond 63,5', diametreMm: 63.5, forme: 'rond' },
  'rond-70': { nom: 'Rond 70', diametreMm: 70, forme: 'rond' },
  'rond-75': { nom: 'Rond 75', diametreMm: 75, forme: 'rond' },
  'rond-89': { nom: 'Rond 89', diametreMm: 89, forme: 'rond' },
} as const;

export type TypeTube = keyof typeof TUBES;

/**
 * LA MARGE DE SÉCURITÉ DÉCLARÉE PAR LE FABRICANT, en millièmes.
 *
 * Somfy annonce « not less than 20% safety factor » sur le couple retenu, et
 * précise que ce facteur est DÉJÀ COMPRIS dans ses abaques de sélection. Ce
 * nombre n'est donc pas là pour être appliqué : il est là pour être DIT,
 * afin que personne ne l'applique une seconde fois.
 */
export const MARGE_DECLAREE_MILLIEMES = 200;

/**
 * OÙ TOMBE LE COUPLE MAXIMAL, en millièmes de la course depuis le bas.
 *
 * Un tiers. C'est le fait qui interdit la formule naïve, et il est écrit ici
 * plutôt que dans un commentaire pour qu'une épreuve puisse le citer.
 */
export const COURSE_DU_COUPLE_MAXIMAL_MILLIEMES = 333;

/** Ce qu'on sait de la masse d'un tablier avant d'ouvrir un abaque. */
export interface RapportTablier {
  famille: FamilleId;
  surfaceM2: number;
  /**
   * La masse surfacique retenue, en grammes par m². Elle est DÉCLARÉE :
   * elle vient de la toile choisie ou du marchand, jamais d'une moyenne.
   */
  masseSurfaciqueGM2: number | null;
  /** La masse du tablier, en grammes entiers. `null` si rien n'est déclaré. */
  masseG: number | null;
  /**
   * Ce qui manque pour choisir un moteur, nommé. Vide quand tout est là —
   * ce qui, au 6 septembre 2026, n'arrive encore jamais : l'abaque de
   * sélection n'est déclaré par personne.
   */
  manque: string[];
}

/**
 * La masse d'un tablier, depuis sa surface et sa masse surfacique déclarée.
 *
 * `masseSurfaciqueGM2` est un intrant, et c'est délibéré : le module ne va
 * pas la chercher dans une table de toiles. Une toile screen la porte
 * (`TOILES_SCREEN`), un tablier de volet roulant l'attend encore du
 * gammiste (docs/23), et un BSO n'a pas de tablier au sens d'une toile mais
 * un empilement de lames dont le pas n'est pas relevé.
 */
export function rapportTablier(
  config: JoineryConfiguration,
  masseSurfaciqueGM2: number | null,
): RapportTablier | null {
  if (!seMeutParTubulaire(config.famille)) return null;

  const surfaceM2 = (config.widthMm / 1000) * (config.heightMm / 1000);
  const manque: string[] = [];
  if (masseSurfaciqueGM2 === null || masseSurfaciqueGM2 <= 0) {
    manque.push('la masse surfacique du tablier, déclarée par le fabricant');
  }
  // L'ABAQUE. Il n'est déclaré nulle part, et ce n'est pas un oubli de
  // saisie : aucun abaque public ne s'extrait des documents du cache — les
  // cellules du tableau Somfy sont un graphique, pas du texte (docs/37).
  manque.push('l’abaque de sélection du fabricant (masse × hauteur × tube)');

  // Les grammes sont ENTIERS, comme les centimes et les millimètres. Un
  // tablier de 2,1 kg est 2 100 g, pas 2,0999999999999996.
  const masseG =
    masseSurfaciqueGM2 === null || masseSurfaciqueGM2 <= 0
      ? null
      : Math.round(surfaceM2 * masseSurfaciqueGM2);

  return { famille: config.famille, surfaceM2, masseSurfaciqueGM2, masseG, manque };
}

/** Ce que l'écran doit dire quand on lui demande un moteur. */
export interface VerdictMoteurTubulaire {
  /** Vrai seulement si un abaque déclaré couvre ce tablier. Jamais, encore. */
  choisi: false;
  /** La masse calculée, quand elle l'est — elle vaut d'être montrée seule. */
  masseG: number | null;
  /** Ce qui manque, nommé, dans l'ordre où on peut l'obtenir. */
  manque: string[];
  /** Pourquoi le configurateur ne comble pas le trou lui-même. */
  pourquoiPasDeCalcul: string;
}

/**
 * Le verdict sur la motorisation d'un tablier — et c'est un REFUS DE
 * CALCULER, pas un échec.
 *
 * Il rend la masse quand elle se calcule : c'est déjà ce que le poseur veut
 * savoir, et c'est ce qui décide si l'on monte à deux. Il ne rend aucun
 * couple, aucune référence de moteur, et il dit pourquoi.
 */
export function verdictMoteurTubulaire(
  config: JoineryConfiguration,
  masseSurfaciqueGM2: number | null,
): VerdictMoteurTubulaire | null {
  const tablier = rapportTablier(config, masseSurfaciqueGM2);
  if (!tablier) return null;
  return {
    choisi: false,
    masseG: tablier.masseG,
    manque: tablier.manque,
    pourquoiPasDeCalcul:
      'Le couple d’un moteur tubulaire n’est pas constant : il monte pendant la montée, ' +
      'parce que le rayon d’enroulement grossit, et son maximum tombe au TIERS de la course ' +
      'depuis le bas. Une formule « masse × rayon » est juste au démarrage et fausse là où ' +
      'ça compte. Le fabricant publie un abaque à trois entrées — masse, hauteur, tube — ' +
      'avec sa marge déjà comprise ; c’est lui qu’il faut déclarer, pas un calcul à refaire.',
  };
}

/** La masse en kilogrammes, arrondie au dixième, écrite à la française. */
export function masseLisible(masseG: number | null): string | null {
  if (masseG === null) return null;
  return (Math.round(masseG / 100) / 10).toFixed(1).replace('.', ',');
}
