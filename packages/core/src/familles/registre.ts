
import {
  DEFAULT_CATALOG,
  type FamilleCatalog,
  type FormeDef,
  type ModelePorteDef,
  type ModelePortailDef,
  type ModeleVoletDef,
  type MoteurDef,
  type SecuriteDef,
  type OptionDef,
  type PricingCatalog,
} from '../catalog.ts';
import type { FamilleId, JoineryConfiguration, ValidationIssue } from '../types.ts';
import type { MeasureReport } from '../types.ts';
// Un TYPE seulement : le registre ne tire pas le module d export dans le
// chargement initial, il en decrit la forme.
import type { LigneNomenclature } from '../export/nomenclature.ts';
import type { Geometry3D, Matiere3D, RolePiece } from '../geometry3d.ts';
import type { Forme } from '../geometrie/formes.ts';
import type { Maillage } from '../geometrie/maillage.ts';
import type {
  ElevationCote,
  ElevationDisque,
  ElevationLine,
  ElevationPoignee,
  ElevationRect,
} from '../drawing.ts';

/** Les groupes de familles. Un groupe = un module = un morceau téléchargé. */
export type GroupeFamilles =
  'vitrees' | 'fermetures' | 'solaire';

export type Univers =
  'menuiserie' | 'fermeture';

/**
 * L'ORDRE DES RAYONS, et il n'est pas alphabétique.
 *
 * Il va du plus vendu au moins vendu — c'est celui de docs/29 §7, qui est
 * l'ordre dans lequel les métiers ont été ouverts. Un rayon ne se lit pas
 * pour lui-même : il se lit après celui d'avant, et le premier écran doit
 * porter ce que le plus grand nombre de visiteurs vient chercher.
 */
export const UNIVERS: readonly Univers[] = ['menuiserie', 'fermeture'];

/**
 * LE MANIFESTE, ENCODÉ — et pourquoi il l'est.
 *
 * Il vit dans le chargement initial pour la raison écrite plus haut : l'écran
 * de choix doit nommer une famille AVANT que son module arrive. Cela ne se
 * discute pas. Ce qui se discutait, c'est son COÛT PAR FAMILLE.
 *
 * MESURÉ au lot D0, construction complète et `verifier:bundle` à chaque fois :
 *
 *     objet littéral, 31 familles  → 92 128 octets,  32 de marge
 *     objet littéral, 32 familles  → 92 143 octets,  17 de marge
 *     libellés vidés               → 91 885 octets, 275 de marge
 *     manifeste entièrement vide   → 91 551 octets, 609 de marge
 *
 * Le manifeste pèse donc 577 octets gzippés, une famille de plus en coûte 15,
 * et les 31 libellés en font 243. **Il restait 32 octets de marge : DEUX
 * familles de plus faisaient échouer la construction**, quand le programme en
 * demande une quarantaine. C'est la faute du lot MT4a — « dix-huit octets
 * d'entrée par ouverture ne passe pas à l'échelle » — retrouvée un cran plus
 * haut : une architecture qui se paie PAR ÉLÉMENT ne passe pas à l'échelle.
 *
 * Écrit comme UNE SEULE CHAÎNE, le même manifeste pèse 495 octets : il rend
 * 82 octets, et le coût d'une famille tombe de 15 à 7. La marge passe à 114 —
 * SEIZE familles nouvelles.
 *
 * Ce qui disparaît n'est pas la répétition de `label:` — gzip la mange déjà —
 * mais la STRUCTURE : accolades, deux-points, virgules et quatre paires de
 * guillemets par entrée, que le minifieur garde parce qu'elles portent du sens
 * en JavaScript. Une chaîne n'a qu'un guillemet pour tout le manifeste.
 *
 * SOLUTION ÉCARTÉE : sortir le manifeste du chargement initial. L'incident
 * fondateur l'interdit — sans lui l'écran ouvre sur une liste vide. Et une
 * seconde a été écartée aussi : monter la borne. `verifier-bundle.mjs` écrit
 * que « monter est une décision, baisser aussi », et ce lot devait d'abord
 * répondre à « peut-on rendre avant de demander ? ». La réponse est oui.
 *
 * CE QU'ON PERD EST RÉEL : le typage de la donnée. Un objet littéral est
 * vérifié entrée par entrée par le compilateur ; une chaîne décodée ne l'est
 * pas. Ce qui le remplace est `manifeste-encode.test.ts`, et il surveille la
 * fragilité VRAIE d'une chaîne : **un séparateur dans un libellé**. Un `|` ou
 * un `;` dans un nom de famille couperait la ligne en silence et rendrait une
 * famille sans rayon — donc une tuile hors de tout rayon, donc invisible.
 *
 * Format d'une ligne : `code|libellé|groupe|univers`, lignes séparées par `;`.
 */
const MANIFESTE_ENCODE =
  'fenetre|Fenêtre|vitrees|menuiserie;porte-fenetre|Porte-fenêtre|vitrees|menuiserie;coulissant|Baie coulissante|vitrees|menuiserie;porte-entree|Porte d’entrée|vitrees|menuiserie;fenetre-toit|Fenêtre de toit|vitrees|menuiserie;volet-roulant|Volet roulant|fermetures|fermeture;volet-battant|Volet battant|fermetures|fermeture;store-banne|Store banne|fermetures|fermeture;porte-garage|Porte de garage|fermetures|menuiserie;moustiquaire|Moustiquaire|fermetures|fermeture;store-interieur|Store intérieur|fermetures|fermeture;bso|Brise-soleil orientable|solaire|fermeture;screen-zip|Screen vertical à coulisses zip|solaire|fermeture';

export const MANIFESTE_FAMILLES = Object.fromEntries(
  MANIFESTE_ENCODE.split(';').map((ligne) => {
    const [code, label, groupe, univers] = ligne.split('|');
    return [code, { label, groupe, univers }];
  }),
) as Record<FamilleId, { label: string; groupe: GroupeFamilles; univers: Univers }>;


/** Ce que le module reçoit pour poser son trait — les tableaux à remplir. */
/** Ce qu'un module reçoit pour poser ses propres cotes — voir `ModuleFamille.cotes`. */
export interface ContexteCotes {
  config: JoineryConfiguration;
  /** Les cotes du cœur, à modifier en place ou à vider et remplacer. */
  cotes: ElevationCote[];
  /** L'emprise dessinée et la marge du cadre, dans les unités du dessin. */
  dessinW: number;
  dessinH: number;
  marge: number;
}

export interface ContexteDessin {
  config: JoineryConfiguration;
  catalog: typeof DEFAULT_CATALOG;
  /**
   * Masse vue par côté — dormant + ouvrant pour une famille vitrée, la
   * bande forfaitaire du tube pour une famille à cadre plein. Déjà
   * résolue par matériau, et par la pose (la rénovation mange moins).
   */
  bandeMm: number;
  /**
   * Ce que le DORMANT montre seul, au-delà de l'ouvrant. C'est là que
   * l'ouvrant commence, donc là que se place son rectangle. Sur une
   * famille sans chaîne de cotes, c'est la moitié de la bande — le
   * partage d'avant le lot 0, qui vaut ce qu'il vaut pour un tube.
   */
  dormantVuMm: number;
  /**
   * Le REFEND entre deux vantaux — battement de frappe ou chicane de
   * coulissant, compté UNE fois par intervalle. 0 sur une famille qui
   * n'en a pas. C'est lui qui manquait au dessin : deux vantaux se
   * touchaient par un trait, là où le métier pose 112 mm de profilé.
   */
  battementMm: number;
  rects: ElevationRect[];
  lines: ElevationLine[];
  poignees: ElevationPoignee[];
  disques: ElevationDisque[];
}

/** Ce qu'une règle de famille reçoit — la configuration et son catalogue. */
/** Ce qu'une nomenclature de famille reçoit — et rien de plus. */
export interface ContexteNomenclature {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
  /** Le rapport de mesure, DÉJÀ calculé : on n'en refait pas un second. */
  mesure: MeasureReport;
  /** Le repère de l'ouvrage — il voyage jusque dans la référence. */
  repere: string;
}

/**
 * Ce qu'elle rend : des lignes, et ce qu'elle ne sait PAS produire. Les
 * secondes comptent autant — une liste incomplète qui se présente comme
 * complète fait fabriquer un ouvrage auquel il manque une pièce.
 */
export interface ResultatNomenclature {
  lignes: LigneNomenclature[];
  lacunes: string[];
}

export interface ContexteRegles {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}

/**
 * L'ATELIER, vu par un module de famille qui apporte son volume.
 *
 * Il est décrit ICI et non dans `geometry3d.ts` pour que le module d'une
 * famille n'ait pas à importer le moteur 3D — ce qui ferait entrer la 3D
 * dans le morceau de la famille, exactement à l'envers de ce qu'on
 * cherche. C'est un TYPE, donc zéro octet à la construction.
 */
export interface AtelierVolume {
  poser(nom: string, role: RolePiece, matiere: Matiere3D, vantail?: number): Maillage;
}

/** Une grandeur du résumé d'un ouvrage, déjà écrite en français. */
export interface GrandeurResumee {
  readonly nom: string;
  readonly valeur: string;
}

export interface ModuleFamille {
  groupe: GroupeFamilles;
  /**
   * L'EMPREINTE du module — une chaîne de la forme
   * `ahjc:module-de-famille:<groupe>`, écrite en toutes lettres dans chaque
   * module et NULLE PART ailleurs, ce fichier compris.
   *
   * Elle n'existe que pour être cherchée par `verifier-bundle.mjs` : si
   * cette chaîne apparaît dans le chargement initial, c'est qu'un module de
   * famille s'y est glissé, et la construction échoue. Un verrou qui repose
   * sur une convention de nommage de morceaux se contourne sans le vouloir —
   * il suffit qu'un import statique fasse INLINER le module dans l'entrée,
   * et il n'y a plus de morceau à nommer. Une empreinte dans le texte, elle,
   * survit à la minification et voyage avec le code où qu'il aille.
   */
  marque: `ahjc:module-de-famille:${GroupeFamilles}`;
  /** Les entrées de catalogue — matrices, bornes, coefficients. */
  catalogue: Partial<Record<FamilleId, FamilleCatalog>>;
  /** Les options que seul ce groupe vend. Fusionnées à l'enregistrement. */
  options?: OptionDef[];
  formes?: FormeDef[];
  /**
   * LE TRACÉ d'une forme — le générateur de contour, apporté par le module.
   *
   * Il vivait dans le chargement initial (`geometrie/formes.ts`), et il y
   * pesait deux kilo-octets et demi : les onze formes — plein cintre, anse
   * de panier, œil-de-bœuf, chapeau de gendarme — étaient téléchargées par
   * tout visiteur, alors qu'une menuiserie RECTANGULAIRE, qui est
   * l'écrasante majorité, n'en lit pas une ligne. C'était la couture
   * nommée comme dette au lot 0 ; le lot 1 la paie, parce qu'il apporte la
   * mécanique et qu'il doit rendre avant de demander
   * (`scripts/verifier-bundle.mjs`).
   *
   * Un module qui vend des formes l'apporte ; un module qui n'en vend pas
   * ne le déclare pas, et le dessin traite alors sa configuration comme un
   * rectangle — ce qu'elle est nécessairement, puisqu'aucune forme ne lui
   * est proposée.
   */
  contourDeForme?: (
    forme: Forme,
    largeurMm: number,
    hauteurMm: number,
    flecheMm?: number,
    coteBas?: 'gauche' | 'droite',
  ) => Array<[number, number]>;
  modelesPortail?: ModelePortailDef[];
  modelesPorte?: ModelePorteDef[];
  modelesVolet?: ModeleVoletDef[];
  moteurs?: MoteurDef[];
  /** Les sécurités que la norme impose à toute installation motorisée. */
  securites?: SecuriteDef[];
  regles?: (contexte: ContexteRegles) => ValidationIssue[];
  /**
   * LA NOMENCLATURE PROPRE À UNE FAMILLE — sa liste de pièces, quand elle
   * n'est pas celle d'une fenêtre.
   *
   * `computeNomenclature` a été écrite pour la fenêtre : un dormant de
   * quatre barres d'onglet, un ouvrant de quatre autres, un vitrage dans la
   * feuillure. Douze familles n'ont rien de tout cela — une moustiquaire est
   * un coffre, deux coulisses et une toile ; une sectionnelle des panneaux
   * et des rails. Leur appliquer l'anatomie d'une fenêtre produisait une
   * liste dont la pièce principale manquait, et le manifeste refusait le
   * dossier de fabrication, à raison.
   *
   * Le module RÉPOND `null` quand la famille suit le modèle générique — un
   * groupe couvre plusieurs familles, et la fenêtre de toit n'est pas la
   * moustiquaire. Ce qui est rendu REMPLACE la liste générique : on ne
   * complète pas une anatomie fausse, on en donne une autre.
   */
  nomenclature?: (contexte: ContexteNomenclature) => ResultatNomenclature | null;
  /** Le trait propre au groupe. Le cadre de rendu et les cotes restent au cœur. */
  dessin: (contexte: ContexteDessin) => void;
  cotes?: (contexte: ContexteCotes) => void;
  /**
   * LES GRANDEURS DE L'OUVRAGE en tête du dessin — lot I11. Le viewport est dans
   * le chargement initial : il ne calcule rien, il affiche ce que le GROUPE rend.
   * Une grandeur non déclarée n'apparaît pas — elle ne vaut pas zéro.
   */
  resume?: (config: JoineryConfiguration) => readonly GrandeurResumee[];
  /**
   * LE VOLUME, et c'est un CHARGEUR, pas une fonction.
   *
   * Le lot 0.2 a sorti la pile 3D de l'entrée en la faisant voyager avec le
   * module de famille. C'était un progrès, et ce n'était pas assez : le
   * module de famille est chargé DÈS LA PREMIÈRE MILLISECONDE, puisque le
   * prix en dépend. `geometry3d.ts` et ses trois modules de maillage —
   * 12,9 ko gzippés — arrivaient donc avec le prix, pour un client qui
   * regarde un dessin en deux dimensions.
   *
   * Le chrono du lot 7.5 l'a trouvé en vérifiant ce que la page charge
   * avant d'afficher son premier prix. Le budget du bundle, lui, ne
   * pouvait pas : il suit le graphe depuis l'ENTRÉE, et `geometry3d.js`
   * y figurait bien du bon côté — « à la demande ». Sauf que la demande
   * arrivait tout de suite.
   *
   * D'où un `import()` : la fonction n'est allée chercher que par l'écran
   * qui la regarde. La couture reste ouverte — une famille qui aura un
   * volume à elle écrira son propre chargeur.
   */
  volume: () => Promise<(config: JoineryConfiguration, catalog?: typeof DEFAULT_CATALOG) => Geometry3D>;
}

const charges = new Map<GroupeFamilles, ModuleFamille>();
const enVol = new Map<GroupeFamilles, Promise<ModuleFamille>>();

/** Le groupe d'une famille — lu dans le manifeste, sans rien charger. */
export function groupeDe(famille: FamilleId): GroupeFamilles {
  const entree = MANIFESTE_FAMILLES[famille];
  if (!entree) throw new Error(`Famille inconnue du manifeste : ${famille}`);
  return entree.groupe;
}

/** Le module d'une famille s'il est déjà là — jamais une attente déguisée. */
export function moduleDe(famille: FamilleId): ModuleFamille | undefined {
  return charges.get(groupeDe(famille));
}

/** Vrai quand la famille est utilisable : matrices, dessin et volume présents. */
export function familleChargee(famille: FamilleId): boolean {
  return charges.has(groupeDe(famille));
}

/**
 * Verse un module dans le catalogue par défaut. Idempotent : recharger un
 * groupe déjà là ne duplique pas ses options.
 */
export function enregistrerModule(module: ModuleFamille): void {
  charges.set(module.groupe, module);
  Object.assign(DEFAULT_CATALOG.familles, module.catalogue);
  for (const option of module.options ?? []) {
    if (!DEFAULT_CATALOG.options.some((deja) => deja.id === option.id)) {
      DEFAULT_CATALOG.options.push(option);
    }
  }
  for (const forme of module.formes ?? []) {
    if (!DEFAULT_CATALOG.formes.some((deja) => deja.id === forme.id)) {
      DEFAULT_CATALOG.formes.push(forme);
    }
  }
  for (const modele of module.modelesPortail ?? []) {
    if (!DEFAULT_CATALOG.modelesPortail.some((deja) => deja.id === modele.id)) {
      DEFAULT_CATALOG.modelesPortail.push(modele);
    }
  }
  for (const modele of module.modelesPorte ?? []) {
    if (!DEFAULT_CATALOG.modelesPorte.some((deja) => deja.id === modele.id)) {
      DEFAULT_CATALOG.modelesPorte.push(modele);
    }
  }
  for (const modele of module.modelesVolet ?? []) {
    if (!DEFAULT_CATALOG.modelesVolet.some((deja) => deja.id === modele.id)) {
      DEFAULT_CATALOG.modelesVolet.push(modele);
    }
  }
  for (const moteur of module.moteurs ?? []) {
    if (!DEFAULT_CATALOG.moteurs.some((deja) => deja.id === moteur.id)) {
      DEFAULT_CATALOG.moteurs.push(moteur);
    }
  }
  for (const securite of module.securites ?? []) {
    if (!DEFAULT_CATALOG.securites.some((deja) => deja.id === securite.id)) {
      DEFAULT_CATALOG.securites.push(securite);
    }
  }
}

function importerGroupe(groupe: GroupeFamilles): Promise<{ MODULE: ModuleFamille }> {
  switch (groupe) {
    case 'vitrees':
      return import('./vitrees.ts');
    case 'fermetures':
      return import('./fermetures.ts');
    case 'solaire':
      return import('./solaire.ts');
    default:
      throw new Error(`Groupe de familles inconnu : ${groupe}`);
  }
}

/** Charge le module d'un groupe — une seule fois, même sur dix appels. */
export function chargerGroupe(groupe: GroupeFamilles): Promise<ModuleFamille> {
  const deja = charges.get(groupe);
  if (deja) return Promise.resolve(deja);

  // Deux familles du même groupe demandées coup sur coup ne doivent
  // déclencher qu'UNE requête : le promise en vol est mémorisé, pas le
  // résultat. Sans cela, ouvrir « volet roulant » puis « store banne » plus
  // vite que le réseau téléchargeait le morceau deux fois.
  const enCours = enVol.get(groupe);
  if (enCours) return enCours;

  // CE QU'ON NE PEUT PAS RATTRAPER ICI, et il faut le savoir avant
  // d'écrire un bouton « Réessayer » : quand un `import()` ÉCHOUE, le
  // navigateur mémorise l'échec dans sa carte des modules, DÉFINITIVEMENT.
  // Un second `import()` du même spécificateur rejette sans émettre la
  // moindre requête — mesuré, pas supposé (lot 7.4 : une sonde Playwright
  // compte une requête avant l'échec, une seule après le réessai).
  //
  // Effacer `enVol` ci-dessous ne rend donc PAS le chargement réessayable :
  // cela évite seulement qu'un échec fige la clé pour un appelant qui,
  // lui, rechargerait la page. Le seul remède est le rechargement — c'est
  // ce que le widget propose, et il ne promet rien d'autre.
  // LES PHRASES DES REFUS ARRIVENT AVEC LE GROUPE (lot D26) : une famille ne se
  // valide jamais sans son groupe, donc un refus ne s'affiche jamais sans sa phrase.
  const promesse = Promise.all([importerGroupe(groupe), import('../textes-des-refus.ts')])
    .then(([module]) => {
      enregistrerModule(module.MODULE);
      return module.MODULE;
    })
    .finally(() => enVol.delete(groupe));
  enVol.set(groupe, promesse);
  return promesse;
}

/** Charge ce qu'il faut pour configurer cette famille. */
export function chargerFamille(famille: FamilleId): Promise<ModuleFamille> {
  return chargerGroupe(groupeDe(famille));
}

/**
 * Tout charger. Réservé aux appelants qui n'ont pas de budget de bundle :
 * les tests, les scripts de génération, le harnais de parité, et le portage
 * PHP du lot 2 — qui, lui, n'a jamais eu de morceaux à télécharger.
 */
export async function chargerToutesLesFamilles(): Promise<void> {
  await Promise.all(
    (Object.keys(MANIFESTE_FAMILLES) as FamilleId[]).map((famille) => chargerFamille(famille)),
  );
}

/**
 * Le refus, quand on demande une famille dont le module n'est pas là. Il
 * porte son alternative — l'appel exact qui le fait disparaître — comme
 * l'exige docs/11 §2.5. Un `undefined` propagé jusqu'à une matrice aurait
 * donné un prix de zéro euro, ce qu'aucun test n'aurait vu venir.
 */
export function refusFamilleNonChargee(famille: FamilleId): Error {
  const groupe = MANIFESTE_FAMILLES[famille]?.groupe;
  // RACCOURCIE AU LOT C11b, et c'est ce qu'il a rendu pour tenir la borne
  // d'entrée — un message d'erreur de DÉVELOPPEUR payé par tout visiteur venu
  // configurer une fenêtre est un message mal placé.
  //
  // LE RENVOI À docs/11 EST RESTÉ, et c'est `familles.test.ts` qui l'a exigé.
  // La première rédaction l'avait emporté avec la phrase sur les morceaux
  // séparés, et le verrou a refusé : ce n'est pas de la prose, c'est un
  // POINTEUR — la seule chose dans ce message qui mène à la décision 0.2, dont
  // le lecteur de cette erreur ignore tout. Ce qui est parti est l'explication,
  // que le bloc en tête de ce fichier donne en entier.
  return new Error(
    groupe
      ? `Famille « ${famille} » non chargée : chargerFamille('${famille}') — groupe « ${groupe} » (docs/11, décision 0.2).`
      : `Famille inconnue : ${famille}`,
  );
}
