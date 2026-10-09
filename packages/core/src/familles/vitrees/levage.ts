
import type { PricingCatalog } from '../../catalog.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';
import { horsEnveloppe, type EnveloppeDeCotes } from '../../enveloppe-de-cotes.ts';
import { nombre } from '../../ecriture-francaise.ts';
import { computeMeasureReport } from '../../structural.ts';

/**
 * L'ENVELOPPE DE L'ASE 80.HI — les deux rectangles PUBLIÉS, et rien entre
 * eux.
 *
 * Ils sont écrits comme le fabricant les écrit. Les réduire à un couple de
 * maxima créerait un coin qu'il n'a jamais publié : voir le point 2 en tête
 * de ce fichier, et le comparateur de `levage.test.ts` qui le mesure.
 */
export const ENVELOPPE_VANTAIL_LEVAGE: EnveloppeDeCotes = {
  code: 'vantail-levage',
  libelle: 'Vantail de coulissant à levage',
  rectangles: [
    { largeurMaxMm: 3500, hauteurMaxMm: 3200, libelle: '3 500 × 3 200' },
    { largeurMaxMm: 3200, hauteurMaxMm: 3500, libelle: '3 200 × 3 500' },
  ],
  source: 'Schüco ASE 80.HI, pages produit — relevé taxonomie §1.5',
};

/**
 * LES CLASSES DE FERRURE DE L'EN 13126-16, en kilogrammes.
 *
 * Ce sont des classes d'ESSAI. La norme dit ce que la ferrure supporte ; elle
 * ne dit pas ce qu'un bras humain fait bouger — voir `SEUIL_DE_MANŒUVRE`.
 */
export const CLASSES_EN_13126_16 = [150, 200, 300, 400] as const;

/**
 * LE POIDS AU-DELÀ DUQUEL LA MANŒUVRE MANUELLE NE SE VEND PLUS.
 *
 * Personne ne le publie : les fabricants publient une classe de ferrure et
 * une capacité motorisée (600 kg chez Schüco), jamais la limite du bras. Il
 * est donc DÉCLARÉ, et il vaut ici la plus haute classe d'essai — le seul
 * nombre défendable en l'absence de déclaration, parce qu'au-delà il n'existe
 * plus de ferrure essayée du tout.
 *
 * Un marchand qui connaît son produit le descend ; personne ne peut le
 * monter sans sortir des classes.
 */
export const SEUIL_DE_MANOEUVRE_MANUELLE_KG = 400;

/** Le rail que le fabricant publie — une borne lue, jamais un calcul. */
export const RAIL_MAXIMAL_MM = 18_000;

/** La course de levage, en millimètres. Elle décide de la réservation. */
export const LEVAGE_MM = { min: 5, max: 10 } as const;

/**
 * LA CLASSE ATTEINTE PAR UN POIDS — la plus petite qui le porte.
 *
 * `null` au-delà de la dernière : une classe qui se figerait au bord serait
 * un mensonge technique, exactement ce que le lot Z8 refuse pour une abaque.
 */
export function classeDeFerrure(poidsKg: number): number | null {
  return CLASSES_EN_13126_16.find((classe) => poidsKg <= classe) ?? null;
}

/** Les cotes d'un vantail, telles que le moteur les calcule déjà. */
function vantailDe(config: JoineryConfiguration, catalog: PricingCatalog) {
  const mesure = computeMeasureReport(config, catalog);
  return { vantail: mesure.vantail, poidsKg: mesure.poidsVantailKg };
}

/**
 * LES REFUS DU COULISSANT À LEVAGE.
 *
 * Ils ne s'opposent QUE sur l'ouverture `levage` : un coulissant ordinaire
 * garde ses bornes et ses seuils de ferrure, qui sont plus bas et qui le
 * refusent bien avant.
 */
export function reglesDeLevage(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config, catalog } = contexte;
  if (config.famille !== 'coulissant' || config.ouverture !== 'levage') return [];

  const issues: ValidationIssue[] = [];
  const { vantail, poidsKg } = vantailDe(config, catalog);

  // --- L'ENVELOPPE. Deux rectangles, jamais leur rectangle englobant.
  const dehors = horsEnveloppe(ENVELOPPE_VANTAIL_LEVAGE, vantail.widthMm, vantail.heightMm);
  if (dehors) {
    issues.push({
      code: 'levage-hors-enveloppe',
      severite: 'erreur',
      message:
        `${dehors.message} La cote maximale d’un coulissant à levage est une limite de FERRURE ` +
        'écrite en millimètres : les deux rectangles publiés font la même surface, et le coin ' +
        'entre les deux n’existe pas.',
    });
  }

  // --- LE RAIL. Une borne lue, et elle porte la baie entière.
  if (config.widthMm > RAIL_MAXIMAL_MM) {
    issues.push({
      code: 'levage-rail-trop-long',
      severite: 'erreur',
      message:
        `Baie de ${nombre(config.widthMm)} mm : le rail publié va jusqu’à ${nombre(RAIL_MAXIMAL_MM)} mm ` +
        `(${ENVELOPPE_VANTAIL_LEVAGE.source}). Au-delà, il se raboute — et un raboutage de rail ` +
        'de levage est une étude du fabricant, pas une cote de configurateur.',
    });
  }

  // --- LA FERRURE. La classe dit ce qu'elle supporte…
  const classe = classeDeFerrure(poidsKg);
  if (classe === null) {
    issues.push({
      code: 'levage-hors-classe',
      severite: 'erreur',
      message:
        `Vantail de ${nombre(poidsKg)} kg : au-delà de ${CLASSES_EN_13126_16[CLASSES_EN_13126_16.length - 1]} kg, ` +
        'aucune classe de ferrure de l’EN 13126-16 n’est essayée. Alternative : réduire le vantail, ' +
        'passer en double vitrage, ou ajouter un vantail pour répartir la surface.',
    });
  } else {
    issues.push({
      code: 'levage-classe-de-ferrure',
      severite: 'info',
      message:
        `Vantail de ${nombre(poidsKg)} kg : ferrure de classe ${classe} kg (EN 13126-16). C’est une classe ` +
        'd’ESSAI — elle dit ce que la ferrure supporte, pas ce qu’un bras fait bouger.',
    });
  }

  // --- …et le seuil de manœuvre dit ce qu'un bras fait bouger. Deux choses.
  if (poidsKg > SEUIL_DE_MANOEUVRE_MANUELLE_KG) {
    issues.push({
      code: 'levage-motorisation-imposee',
      severite: 'erreur',
      message:
        `Vantail de ${nombre(poidsKg)} kg, au-dessus du seuil de manœuvre manuelle déclaré ` +
        `(${SEUIL_DE_MANOEUVRE_MANUELLE_KG} kg). Une ferrure essayée à cette classe SUPPORTE le ` +
        'vantail ; elle ne le fait pas glisser à la main. La motorisation s’impose, et ce ' +
        'configurateur ne la dimensionne pas.',
    });
  }

  return issues;
}

/**
 * CE QUE LE SEUIL ENCASTRÉ DEMANDE — dit, jamais promis.
 *
 * Le levage permet un seuil plat, et c'est son argument PMR. Il demande une
 * RÉSERVATION dans la dalle, et la dalle n'est pas déclarée : on donne la
 * cote et on nomme le métier, on n'atteste aucune accessibilité.
 */
export const SEUIL_ENCASTRE_SE_RESERVE =
  'Le seuil plat d’un coulissant à levage se pose dans une réservation de la dalle, et le vantail ' +
  `descend de ${LEVAGE_MM.min} à ${LEVAGE_MM.max} mm en se verrouillant : la réservation se prévoit ` +
  'AVANT le coulage. Ce configurateur ne commande pas de gros œuvre et n’atteste aucune ' +
  'accessibilité — la cote se donne au maçon, la conformité PMR se constate sur l’ouvrage fini.';
