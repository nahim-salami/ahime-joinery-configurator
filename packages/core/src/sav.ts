/**
 * Pourquoi ce fichier existe : `garanties.ts` dit qu'un défaut d'entretien
 * documenté fait tomber la garantie commerciale du fabricant. Il fallait
 * donc dire CE QU'ON ENTRETIENT — sinon on oppose au client une obligation
 * que personne ne lui a jamais énoncée.
 *
 * ET IL FALLAIT DIRE CE QUI S'USE. Une menuiserie ne tombe pas en panne, elle
 * se dégrade par une pièce à la fois : un joint qui durcit, un galet qui
 * plat, une crémone qui force, un moteur qui ne renvoie plus. Chacune se
 * remplace pour quelques dizaines d'euros — À CONDITION de savoir laquelle
 * commander, huit ans après, sur une menuiserie dont plus personne n'a le
 * dossier. C'est tout l'objet de la fiche : dire quoi surveiller, à quel
 * signe, et quelles références garder.
 *
 * CE QU'IL N'INVENTE PAS : des durées de vie. « Un joint dure douze ans »
 * est le genre de chiffre qui s'écrit facilement et ne se vérifie jamais —
 * il dépend de l'exposition, du nettoyage, du produit employé. La fiche
 * donne donc un RYTHME D'ENTRETIEN, qui est une pratique documentée, et un
 * SYMPTÔME, qui s'observe. Ni l'un ni l'autre ne se devine ; les deux se
 * constatent.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { JoineryConfiguration } from './types.ts';
import { DEFAULT_CATALOG, estPortail, type PricingCatalog } from './catalog.ts';

/** Ce qu'une pièce d'usure demande — et ce qu'on voit quand elle lâche. */
export interface PieceDUsure {
  code: string;
  label: string;
  /** Où elle se trouve, en clair — un client doit pouvoir la montrer du doigt. */
  ou: string;
  /** Le rythme d'entretien, en mois. Une pratique documentée, pas une durée de vie. */
  entretienMois: number;
  /** Le geste d'entretien, en une phrase exécutable. */
  geste: string;
  /** LE SYMPTÔME : ce qu'on constate quand la pièce est à remplacer. */
  symptome: string;
}

/** LE DRAINAGE — la pièce qui n'en est pas une, et la première cause de dégât. */
const DRAINAGE: PieceDUsure = {
  code: 'drainage',
  label: 'Trous de drainage du dormant',
  ou: 'Dans la traverse basse du dormant, côté extérieur — deux à quatre fentes de quelques millimètres.',
  entretienMois: 6,
  geste:
    'Dégager les fentes à sec — un pinceau, jamais un fil de fer qui déchirerait le joint. Elles évacuent l’eau qui entre par la feuillure, et c’est normal qu’il en entre.',
  symptome:
    'De l’eau stagne dans la feuillure basse, ou une flaque apparaît à l’intérieur sans qu’aucun joint ne soit percé. C’est presque toujours un drainage bouché, pas une fenêtre qui fuit.',
};

const JOINTS: PieceDUsure = {
  code: 'joints',
  label: 'Joints de frappe',
  ou: 'Sur le pourtour de l’ouvrant, en périphérie — le cordon souple qui vient écraser sur le dormant.',
  entretienMois: 12,
  geste:
    'Nettoyer à l’eau savonneuse et nourrir au silicone en spray ou à la vaseline. Ni solvant ni produit ménager : ils durcissent l’élastomère.',
  symptome:
    'Un courant d’air à fenêtre fermée, un joint qui reste écrasé au lieu de reprendre sa forme, ou qui se fend au coin. Un joint dur ne rattrape plus le voile du vantail.',
};

const QUINCAILLERIE: PieceDUsure = {
  code: 'quincaillerie',
  label: 'Crémone et points de fermeture',
  ou: 'Dans la feuillure de l’ouvrant, côté poignée — les galets et gâches qui verrouillent.',
  entretienMois: 12,
  geste:
    'Graisser les points de verrouillage et les paumelles à la graisse blanche. Vérifier le serrage des vis de gâche.',
  symptome:
    'La poignée force en fin de course, ou un point ne rentre plus dans sa gâche. Se rattrape presque toujours par un RÉGLAGE de paumelle avant de changer la pièce.',
};

const PAUMELLES: PieceDUsure = {
  code: 'paumelles',
  label: 'Paumelles réglables',
  ou: 'Sur le montant côté charnières — deux ou trois, avec des vis de réglage sous cache.',
  entretienMois: 12,
  geste: 'Graisser l’axe. Le réglage en hauteur, en latéral et en compression se fait à la clé Allen.',
  symptome:
    'Le vantail frotte en bas côté poignée, ou un jour inégal apparaît le long du dormant. C’est le vantail qui a « pris du ventre » — un réglage, pas une pièce.',
};

const VITRAGE: PieceDUsure = {
  code: 'vitrage',
  label: 'Joint d’étanchéité du vitrage isolant',
  ou: 'Sur le pourtour du double vitrage, entre les deux verres — l’intercalaire noir ou gris.',
  entretienMois: 12,
  geste:
    'Rien à faire, sinon garder les parcloses propres et le drainage libre : c’est l’eau stagnante dans la feuillure qui tue l’intercalaire.',
  symptome:
    'De la BUÉE ENTRE LES DEUX VERRES, qui ne s’essuie pas. Le vitrage a perdu son étanchéité : il se remplace, il ne se répare pas — et c’est la garantie la plus souvent invoquée.',
};

const MOTEUR: PieceDUsure = {
  code: 'moteur',
  label: 'Motorisation',
  ou: 'Dans le tube d’enroulement, ou dans le bras du portail.',
  entretienMois: 12,
  geste:
    'Vérifier les fins de course et, sur un tablier, la reprise de la lame finale. Sur un portail, contrôler la détection d’obstacle : c’est une sécurité, pas un confort.',
  symptome:
    'Le tablier ne remonte plus complètement, s’arrête en cours de course, ou le portail rebondit sans détecter. Un moteur qui perd ses fins de course se reprogramme avant de se remplacer.',
};

const TABLIER: PieceDUsure = {
  code: 'tablier',
  label: 'Attaches de tablier et lame finale',
  ou: 'En haut du tablier, dans le coffre : deux à quatre attaches souples entre la première lame et le tube.',
  entretienMois: 24,
  geste:
    'Contrôler à l’ouverture du coffre. Ce sont des pièces sacrificielles : elles cèdent AVANT le moteur, et c’est leur rôle.',
  symptome:
    'Le tablier descend de travers, ou reste en haut alors que le moteur tourne. Une attache cassée, pas un moteur mort — et la réparation coûte cent fois moins.',
};

const GALETS: PieceDUsure = {
  code: 'galets',
  label: 'Galets de coulissant',
  ou: 'Sous la traverse basse du vantail, dans le rail.',
  entretienMois: 12,
  geste:
    'Aspirer le rail — le sable est l’ennemi, pas l’usure. Ne jamais graisser un rail de coulissant : la graisse retient la poussière et fabrique une pâte abrasive.',
  symptome:
    'Le vantail devient dur à pousser, ou grince en un point du rail. Un galet plat se remplace ; un rail rayé se remplace aussi, et c’est plus long.',
};

const BRAS_STORE: PieceDUsure = {
  code: 'bras-store',
  label: 'Bras articulés et toile',
  ou: 'Sous le coffre du store banne.',
  entretienMois: 12,
  geste:
    'Ne JAMAIS enrouler une toile humide : c’est ce qui fabrique les taches noires qu’on prend pour de la moisissure. Contrôler la tension des câbles de bras.',
  symptome:
    'La toile pend d’un côté, ou le store descend en biais. Un câble de bras détendu se retend ; un câble rompu se remplace, et le bras entier avec.',
};

const CHENEAU: PieceDUsure = {
  code: 'cheneau',
  label: 'Chéneau et descente d’eau',
  ou: 'Dans les poutres périphériques, avec une descente cachée dans un poteau.',
  entretienMois: 6,
  geste:
    'Vider les feuilles du chéneau et vérifier que la descente coule — un seau d’eau versé en tête suffit à le savoir.',
  symptome:
    'De l’eau déborde par un angle, ou la terrasse est mouillée au pied d’un poteau alors qu’il pleut peu. La descente est bouchée, et le chéneau porte alors un poids qu’il n’a pas été calculé pour porter.',
};

const GONDS_PORTAIL: PieceDUsure = {
  code: 'gonds',
  label: 'Gonds et paumelles de portail',
  ou: 'Sur les piliers, deux par vantail.',
  entretienMois: 12,
  geste:
    'Graisser les axes. Vérifier le scellement des gonds : un pilier qui bouge desserre tout le reste, et c’est le pilier qu’il faut reprendre.',
  symptome:
    'Le vantail racle le sol, ou les deux battants ne se rejoignent plus au centre. Le portail n’a pas bougé : le pilier, si.',
};

const SERRURE: PieceDUsure = {
  code: 'serrure',
  label: 'Serrure multipoints et cylindre',
  ou: 'Dans le montant de l’ouvrant, côté poignée.',
  entretienMois: 12,
  geste:
    'Lubrifier le cylindre au spray graphite ou au téflon — jamais d’huile ni de dégrippant, qui collent la poussière et bloquent le barillet.',
  symptome:
    'La clé accroche, ou il faut soulever la porte pour tourner. Le second cas n’est pas la serrure : c’est le vantail qui est descendu.',
};

const SCELLEMENT: PieceDUsure = {
  code: 'scellement',
  label: 'Scellement des poteaux',
  ou: 'Au pied de chaque poteau, sous le niveau du sol — le massif de béton.',
  entretienMois: 12,
  geste:
    'Contrôler l’aplomb à la règle une fois l’an, après l’hiver. Dégager la terre et les racines au pied : c’est une racine qui soulève un massif, rarement le gel seul.',
  symptome:
    'Un poteau hors d’aplomb, un panneau qui ne joint plus son voisin, un jour qui s’ouvre en bas. Repris à temps, c’est un massif ; laissé faire, c’est la ligne entière.',
};

/** LES DONNÉES À GARDER pour recommander une pièce huit ans plus tard. */
export const A_CONSERVER = [
  'la référence de commande et la date du bon de livraison',
  'le repère d’atelier de la menuiserie — celui de l’étiquette collée en feuillure, sous le dormant',
  'le système de profilé et la gamme, tels qu’ils figurent au devis',
  'la composition du vitrage (par exemple 4/16/4 argon) et son cachet d’intercalaire',
  'la marque et le modèle de la quincaillerie, lisibles sur la crémone à ouvrant ouvert',
] as const;

export interface FicheSav {
  /** Les pièces qui s'usent sur CETTE menuiserie, et rien d'autre. */
  pieces: PieceDUsure[];
  /** Le rythme le plus court de la fiche, en mois — la fréquence à retenir. */
  rythmeMois: number;
  /** Ce qu'il faut garder pour recommander, en clair. */
  aConserver: readonly string[];
  /** Les gestes qui abîment plus qu'ils n'entretiennent. */
  aNePasFaire: string[];
}

export function computeFicheSav(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): FicheSav {
  const pieces: PieceDUsure[] = [];
  const famille = config.famille;
  const vitre = catalog.familles[famille]?.vitree === true;
  const motorise =
    config.motorisation !== undefined ||
    (config.options ?? []).some((option) => option.id.startsWith('motorisation-'));
  // Le LEVAGE roule sur des CHARIOTS, pas sur des galets de coulissant — et
  // c'est la même pièce d'usure au même endroit, sous un autre nom du
  // métier. L'oublier ici aurait rendu une fiche SAV qui envoie graisser des
  // paumelles sur une baie qui n'en a pas (lot MT1a).
  const coulissant =
    config.ouverture === 'coulissant' ||
    config.ouverture === 'galandage' ||
    config.ouverture === 'levage';

  if (vitre) {
    pieces.push(DRAINAGE, JOINTS, VITRAGE);
    if (coulissant) pieces.push(GALETS);
    else if (config.ouverture !== 'fixe') pieces.push(QUINCAILLERIE, PAUMELLES);
    if (famille === 'porte-entree') pieces.push(SERRURE);
  }
  if (famille === 'volet-roulant' || famille === 'porte-garage') pieces.push(TABLIER);
  if (famille === 'volet-battant') pieces.push(GONDS_PORTAIL, JOINTS);
  if (famille === 'store-banne') pieces.push(BRAS_STORE);
  if (estPortail(famille)) pieces.push(GONDS_PORTAIL, SCELLEMENT);
  // LES OUVRAGES LINÉAIRES n'ont aucune pièce mobile — et pourtant ils
  // tombent, par le pied. Rendre une fiche vide aurait laissé croire qu'il
  if (catalog.familles[famille]?.unitePrix === 'metre-lineaire') pieces.push(SCELLEMENT);
  if (famille === 'pergola' || famille === 'veranda') pieces.push(CHENEAU);
  if (motorise) pieces.push(MOTEUR);

  const aNePasFaire = [
    'Nettoyer un profilé à l’acétone, au white-spirit ou à la crème à récurer : ils rayent le PVC et attaquent le laquage de l’aluminium. Eau savonneuse, chiffon doux.',
    'Déboucher un drainage au fil de fer : il déchire le joint qu’il traverse, et la fuite qu’on croyait réparer commence là.',
  ];
  if (coulissant) {
    aNePasFaire.push(
      'Graisser un rail de coulissant : la graisse retient la poussière et fabrique une pâte abrasive qui use les galets plus vite que le sable seul.',
    );
  }
  if (famille === 'store-banne') {
    aNePasFaire.push(
      'Enrouler une toile humide : c’est ce qui fabrique les taches noires qu’on prend ensuite pour de la moisissure d’usine.',
    );
  }

  // fiche le dit plutôt que de rendre un rythme d'entretien tiré d'un
  // tableau vide, qui vaudrait l'infini.
  const rythme = pieces.length > 0 ? Math.min(...pieces.map((piece) => piece.entretienMois)) : 0;

  return { pieces, rythmeMois: rythme, aConserver: A_CONSERVER, aNePasFaire };
}
