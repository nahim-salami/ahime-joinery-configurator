/**
 * Pourquoi ce fichier existe : entre le prix et l'établi, il manquait tout.
 * Le cœur savait dire ce qu'une menuiserie COÛTE et ce qu'elle MESURE ; il
 * ne savait pas dire de quoi elle est FAITE. Un menuisier qui reçoit une
 * commande devait donc rouvrir sa propre application et ressaisir — c'est
 * exactement la ressaisie que le configurateur promet de supprimer
 * (docs/16, besoins 5 à 10).
 *
 * Ce que ce module rend : l'explosion en pièces. Des barres de profilé avec
 * leur longueur de débit et leurs angles de coupe, des renforts, des
 * vitrages aux cotes du verrier, de la quincaillerie, des joints au mètre,
 * des consommables. Chaque ligne porte DEUX choses qu'une nomenclature
 * ordinaire n'a pas : la RÈGLE qui l'a créée, et une référence commandable.
 *
 * La règle, parce qu'une nomenclature sans elle est un mystère : un atelier
 * qui lit « barre 1 174 mm × 2 » ne peut ni la vérifier ni la corriger. Il
 * doit pouvoir lire « hauteur de fabrication moins deux traverses », refaire
 * l'opération de tête, et tomber sur le même nombre.
 *
 * Solution écartée : dériver la nomenclature du MAILLAGE 3D, qui décompose
 * déjà en pièces. Séduisant — et faux. Le maillage est une projection, il
 * fusionne ce qui se ressemble et ignore ce qui ne se voit pas (les
 * renforts, les cales, les vis). La règle du projet tient depuis les néons :
 * le rapport de mesure fait foi, jamais le maillage. La nomenclature descend
 * donc de la CHAÎNE DE COTES, comme le prix.
 *
 * L'INVARIANT, et il est dur : une configuration valide ne produit JAMAIS
 * une nomenclature partielle. Quand une pièce ne peut pas être calculée,
 * elle n'est pas omise en silence — elle est déclarée dans `lacunes`, et le
 * manifeste refuse alors de s'émettre. Un atelier qui reçoit une liste
 * incomplète sans le savoir fabrique un rebut, et c'est le marchand qui le
 * paie.
 *
 * Sources des angles et des sections : `ressources/donnees/
 * sections-et-quincaillerie.json` — PVC soudé en onglet, aluminium serti en
 * onglet, bois en tenon-mortaise à joint droit. Ces trois assemblages ne
 * consomment pas la même longueur de barre, et c'est la première chose
 * qu'un débit se trompe.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { JoineryConfiguration, Materiau } from '../types.ts';
import {
  DEFAULT_CATALOG,
  deductionsDe,
  familleCatalog,
  systemeDe,
  type PricingCatalog,
} from '../catalog.ts';
import { moduleDe } from '../familles/registre.ts';
import {
  computeMeasureReport,
  effectiveVitrage,
  requiredFittings,
  verreEpaisseurMm,
  vitrageEpaisseurMm,
} from '../structural.ts';
import { inertieProfilCm4, inertieRenfortCm4 } from '../mecanique.ts';

export type CategorieLigne =
  | 'profil'
  | 'renfort'
  | 'vitrage'
  | 'quincaillerie'
  | 'joint'
  | 'accessoire'
  | 'consommable';

/**
 * L'ASSEMBLAGE D'ANGLE, par matériau — et il change la longueur de débit.
 *
 * PVC : onglet à 45° THERMOSOUDÉ. La soudure consomme de la matière : les
 * deux bouts fondent et se rapprochent. Trois millimètres par angle est la
 * valeur des gammistes, et c'est pour cela qu'une barre PVC se coupe PLUS
 * LONGUE que la cote finie.
 *
 * Aluminium : onglet à 45° SERTI par équerre. Rien ne fond, rien ne se
 * perd — la coupe est à la cote exacte.
 *
 * Bois : TENON-MORTAISE à joint droit. Le montant traverse, la traverse
 * porte un tenon : il faut donc AJOUTER la longueur des deux tenons, et
 * c'est l'inverse d'une perte.
 */
interface AssemblageAngle {
  /** Le nom du métier, tel qu'il s'écrit sur une fiche de débit. */
  type: string;
  /** L'angle de coupe aux deux bouts, en degrés. 90 = coupe droite. */
  coupeDeg: number;
  /**
   * Ce que l'assemblage AJOUTE à la longueur de coupe, par bout, en mm.
   * Positif en PVC (la soudure consomme) et en bois (le tenon s'enfonce) ;
   * nul en aluminium.
   */
  surlongueurParBoutMm: number;
}

const ASSEMBLAGE: Record<Materiau, AssemblageAngle> = {
  pvc: { type: 'onglet 45° thermosoudé', coupeDeg: 45, surlongueurParBoutMm: 3 },
  alu: { type: 'onglet 45° serti par équerre', coupeDeg: 45, surlongueurParBoutMm: 0 },
  bois: { type: 'tenon-mortaise, joint droit', coupeDeg: 90, surlongueurParBoutMm: 30 },
  // Le mixte est un bois côté intérieur, capoté d'aluminium : c'est le BOIS
  // qui porte l'assemblage, et donc lui qui commande le débit.
  mixte: { type: 'tenon-mortaise, capotage alu rapporté', coupeDeg: 90, surlongueurParBoutMm: 30 },
};

export interface LigneNomenclature {
  categorie: CategorieLigne;
  /**
   * La RÉFÉRENCE COMMANDABLE — ce qu'on tape chez le fournisseur.
   *
   * Elle est construite à partir de l'identifiant de gamme du catalogue,
   * qui est la seule référence dont ce projet dispose réellement. Un
   * marchand qui branche son ERP la remplace par la sienne : c'est un champ
   * de catalogue, pas une vérité de ce fichier. Ce qui compte est qu'elle
   * soit DÉTERMINISTE — deux configurations identiques rendent la même.
   */
  reference: string;
  designation: string;
  quantite: number;
  unite: 'piece' | 'm' | 'm2' | 'kg';
  /** Longueur de débit, en mm — les barres seulement. */
  longueurMm?: number;
  /** Les angles de coupe aux deux bouts, en degrés. */
  coupesDeg?: [number, number];
  /** La teinte à appliquer — jamais devinée, toujours celle de la config. */
  teinte?: string;
  /**
   * LA RÈGLE qui a créé cette ligne, en une phrase qu'un chef d'atelier
   * peut refaire de tête. Sans elle, une nomenclature ne se vérifie pas.
   */
  regle: string;
}

export interface Nomenclature {
  /** Le repère de l'ouvrage dans le chantier — M1, M2… Vide hors projet. */
  repere: string;
  lignes: LigneNomenclature[];
  /**
   * CE QU'ON N'A PAS SU PRODUIRE. Jamais un silence : une nomenclature
   * incomplète qui se présente comme complète est pire que pas de
   * nomenclature du tout. Le manifeste refuse de s'émettre tant que ce
   * tableau n'est pas vide.
   */
  lacunes: string[];
}

/** La somme des longueurs de barre, en mètres — l'achat de profilé. */
export function metresDeProfil(nomenclature: Nomenclature): number {
  const mm = nomenclature.lignes
    .filter((ligne) => ligne.categorie === 'profil' || ligne.categorie === 'renfort')
    .reduce((somme, ligne) => somme + (ligne.longueurMm ?? 0) * ligne.quantite, 0);
  return Math.round(mm) / 1000;
}

/**
 * L'EXPLOSION EN PIÈCES d'une configuration.
 *
 * Elle descend de la chaîne de cotes, pas du maillage : `dimensionFabrication`
 * donne le dormant, `fondDeFeuillure` donne l'ouvrant, `coteVitrage` donne ce
 * qu'on commande au verrier. Ces trois étages sont déjà calculés, déjà testés
 * et déjà comparés par le harnais de parité — la nomenclature n'invente pas
 * une seconde vérité, elle traduit celle qui existe.
 */
export function computeNomenclature(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
  options: { repere?: string } = {},
): Nomenclature {
  const lignes: LigneNomenclature[] = [];
  const lacunes: string[] = [];
  const repere = options.repere ?? '';
  // LA TEINTE de la commande. `Couleur` est un CHOIX DE FINITION — 'blanc',
  // 'plaxe', 'ral-1-face', 'bicolore' — et pas une valeur RVB. C'est
  // exactement ce qu'une fiche de débit doit porter : le laqueur ne reçoit
  // pas un dièse suivi de six chiffres, il reçoit un poste de finition.
  const teinte: string = config.couleur;

  const fam = familleCatalog(catalog, config.famille);
  const mesure = computeMeasureReport(config, catalog);
  const assemblage = ASSEMBLAGE[config.materiau];
  const systeme = systemeDe(catalog, config.systeme);
  const gamme = systeme?.id ?? `${config.materiau}-${config.gamme}`;
  const profondeurMm = systeme?.epaisseurMm ?? catalog.profils.epaisseurMm[config.materiau][config.gamme];

  // LA NOMENCLATURE PROPRE À LA FAMILLE, quand son module en apporte une.
  //
  // Elle REMPLACE tout ce qui suit, et ce n'est pas un raccourci : une
  // moustiquaire n'a pas un dormant auquel il manquerait un coffre, elle a
  // une AUTRE anatomie. Compléter une liste fausse aurait fait commander
  // quatre barres d'onglet en plus d'un enrouleur.
  //
  // Un module qui n'en apporte pas — ou qui n'en apporte pas pour CETTE
  // famille de son groupe — rend `null`, et le modèle générique de la
  // fenêtre s'applique comme avant.
  const propre = moduleDe(config.famille)?.nomenclature?.({ config, catalog, mesure, repere });
  if (propre) {
    return {
      repere,
      lignes: propre.lignes.map((ligne) => ({ teinte, ...ligne })),
      lacunes: propre.lacunes,
    };
  }

  const ajouter = (ligne: LigneNomenclature) => lignes.push({ ...ligne, teinte });

  /** Une barre de profilé : la cote finie plus ce que l'assemblage consomme. */
  const barre = (
    role: string,
    coteFinieMm: number,
    quantite: number,
    regle: string,
    suffixe: string,
  ) => {
    if (coteFinieMm <= 0) {
      lacunes.push(`${role} : cote finie nulle ou négative (${coteFinieMm} mm)`);
      return;
    }
    ajouter({
      categorie: 'profil',
      reference: `${gamme}-${suffixe}`,
      designation: `${role} — ${assemblage.type}`,
      quantite,
      unite: 'piece',
      longueurMm: Math.round(coteFinieMm + 2 * assemblage.surlongueurParBoutMm),
      coupesDeg: [assemblage.coupeDeg, assemblage.coupeDeg],
      regle,
    });
  };

  // --- LE DORMANT. Quatre barres au hors-tout de fabrication : c'est la
  // cote que l'atelier commande et que le poseur retrouve dans le mur.
  const fabrication = mesure.chaineDeCotes?.dimensionFabrication ?? {
    widthMm: mesure.widthMm,
    heightMm: mesure.heightMm,
  };
  barre(
    'Dormant — montant',
    fabrication.heightMm,
    2,
    'hauteur de fabrication, coupée en onglet aux deux bouts',
    'dor-mnt',
  );
  barre(
    'Dormant — traverse',
    fabrication.widthMm,
    2,
    'largeur de fabrication, coupée en onglet aux deux bouts',
    'dor-trv',
  );

  // --- LE RENFORT ACIER. Il n'est PAS décoratif et il n'est pas optionnel :
  // sans lui un montant PVC de deux mètres fléchit de dix centimètres sous
  // le vent (voir `mecanique.ts`). Il entre donc dans la nomenclature dès
  // que le profilé seul ne tient pas — la même règle que la validation, et
  // surtout le même calcul, pour qu'un devis et un débit ne se contredisent
  // jamais.
  const renfortCm4 = inertieRenfortCm4(config.materiau, profondeurMm);
  const inertieProfil = inertieProfilCm4({
    materiau: config.materiau,
    profondeurMm,
    largeurMm: mesure.chaineDeCotes?.masseVueMm ?? 68,
  });
  if (renfortCm4 > 0 && fabrication.heightMm > SEUIL_RENFORT_MM) {
    const coteTube = Math.round(profondeurMm - 2 * 2 - 10);
    ajouter({
      categorie: 'renfort',
      reference: `renf-${coteTube}x${coteTube}x2`,
      designation: `Renfort acier galvanisé — tube ${coteTube}×${coteTube}×2 (${renfortCm4} cm⁴)`,
      quantite: 2,
      unite: 'piece',
      // Le renfort s'arrête aux traverses : il ne traverse pas l'angle.
      longueurMm: Math.max(0, fabrication.heightMm - 2 * (mesure.chaineDeCotes?.masseVueMm ?? 68)),
      coupesDeg: [90, 90],
      regle:
        `montant de plus de ${SEUIL_RENFORT_MM} mm en ${config.materiau} ` +
        `(profilé seul : ${inertieProfil} cm⁴, insuffisant sous vent courant)`,
    });
  }

  // --- LES OUVRANTS. Chacun quatre barres au fond de feuillure.
  const ouvrants = ouvrantsDe(config, mesure.vantaux, catalog);
  const fond = mesure.chaineDeCotes?.fondDeFeuillure;
  const cadreOuvrant = mesure.chaineDeCotes?.ouvrant;
  if (ouvrants > 0) {
    if (!cadreOuvrant) {
      // LE MOTIF DIT CE QUI MANQUE VRAIMENT. Seize familles n'ont pas
      // l'ouvrant d'une fenêtre, et leur opposer « la chaîne de cotes ne
      // donne pas de cadre d'ouvrant » envoyait chercher un défaut de cote
      // là où il n'y a qu'un modèle à écrire.
      lacunes.push(
        OUVRANTS_HORS_MODELE[config.famille] ??
          `${ouvrants} ouvrant(s) à débiter, mais la chaîne de cotes ne donne pas de cadre d'ouvrant`,
      );
    } else {
      // LA COTE EXTÉRIEURE du cadre, jamais le fond de feuillure. Débiter
      // au fond de feuillure faisait une barre trente-deux millimètres trop
      // courte sur une fenêtre PVC — quatre barres à jeter par vantail.
      barre(
        'Ouvrant — montant',
        cadreOuvrant.heightMm,
        2 * ouvrants,
        'cadre d’ouvrant hors tout en hauteur, recouvrement compris',
        'ouv-mnt',
      );
      barre(
        'Ouvrant — traverse',
        cadreOuvrant.widthMm,
        2 * ouvrants,
        'cadre d’ouvrant hors tout en largeur, recouvrement compris',
        'ouv-trv',
      );
    }
  }

  // --- LE BATTEMENT. UNE fois par refend, jamais deux : c'est le défaut
  // que le lot 0 a corrigé dans la chaîne de cotes, et la nomenclature
  // hérite de la correction au lieu de la refaire.
  const refends = Math.max(0, mesure.vantaux - 1);
  const battementMm = mesure.chaineDeCotes?.battementMm ?? 0;
  if (refends > 0 && battementMm > 0) {
    barre(
      'Battement central',
      cadreOuvrant?.heightMm ?? fabrication.heightMm,
      refends,
      `un battement par refend (${refends}), jamais un par demi-ouvrant`,
      'batt',
    );
  }

  // --- LES PARCLOSES et LE VITRAGE.
  const vitrage = effectiveVitrage(config, catalog);
  const coteVitrage = mesure.chaineDeCotes?.coteVitrage;
  if (vitrage && mesure.clairVitrage) {
    if (!coteVitrage) {
      lacunes.push('vitrage à commander, mais la chaîne de cotes ne donne pas de cote de vitrage');
    } else {
      const surfaceM2 = (coteVitrage.widthMm * coteVitrage.heightMm) / 1_000_000;
      ajouter({
        categorie: 'vitrage',
        reference: referenceVitrage(config, catalog),
        designation: `Vitrage ${compositionVitrage(config, catalog)} — ${coteVitrage.widthMm} × ${coteVitrage.heightMm} mm`,
        quantite: Math.max(1, ouvrants || mesure.vantaux),
        unite: 'piece',
        regle: 'fond de feuillure moins deux jeux de vitrage, par vantail',
      });
      ajouter({
        categorie: 'accessoire',
        reference: 'cale-vitrage-100',
        designation: 'Jeu de cales de vitrage (assise, latérales)',
        quantite: Math.max(1, ouvrants || mesure.vantaux),
        unite: 'piece',
        regle: 'NF DTU 39 : un vitrage ne repose jamais sur le profilé',
      });
      // Quatre parcloses par vantail, à la cote du fond de feuillure : elles
      // se coupent en onglet même en bois, où l'assemblage du cadre est
      // droit — une parclose ne porte rien, elle ferme.
      const parcloses = Math.max(1, ouvrants || mesure.vantaux);
      ajouter({
        categorie: 'profil',
        reference: `${gamme}-parclose`,
        designation: `Parclose — hauteur vitrage + 4 mm (épaisseur ${vitrageEpaisseurMm(vitrage, catalog)} mm)`,
        quantite: 2 * parcloses,
        unite: 'piece',
        longueurMm: coteVitrage.heightMm + 2 * PRISE_PARCLOSE_MM,
        coupesDeg: [45, 45],
        regle: 'cote de vitrage en hauteur, plus la prise de parclose aux deux bouts',
      });
      ajouter({
        categorie: 'profil',
        reference: `${gamme}-parclose`,
        designation: 'Parclose — traverse',
        quantite: 2 * parcloses,
        unite: 'piece',
        longueurMm: coteVitrage.widthMm + 2 * PRISE_PARCLOSE_MM,
        coupesDeg: [45, 45],
        regle: 'cote de vitrage en largeur, plus la prise de parclose aux deux bouts',
      });
    }
  }

  // --- LES JOINTS, au mètre. Deux circuits distincts, et les confondre est
  // une fuite : le joint de FRAPPE ferme l'ouvrant sur le dormant, le joint
  // de VITRAGE ferme le verre dans sa feuillure.
  if (ouvrants > 0 && fond) {
    const perimetreOuvrantM = (2 * (fond.widthMm + fond.heightMm) * ouvrants) / 1000;
    ajouter({
      categorie: 'joint',
      reference: `${gamme}-jt-frappe`,
      designation: 'Joint de frappe EPDM',
      quantite: Math.round(perimetreOuvrantM * 10) / 10,
      unite: 'm',
      regle: 'périmètre de chaque ouvrant, au fond de feuillure',
    });
  }
  if (vitrage && coteVitrage) {
    const perimetreVerreM =
      (2 * (coteVitrage.widthMm + coteVitrage.heightMm) * Math.max(1, ouvrants || mesure.vantaux) * 2) /
      1000;
    ajouter({
      categorie: 'joint',
      reference: `${gamme}-jt-vitrage`,
      designation: 'Joint de vitrage EPDM (intérieur + extérieur)',
      quantite: Math.round(perimetreVerreM * 10) / 10,
      unite: 'm',
      regle: 'périmètre du vitrage, compté sur les DEUX faces',
    });
  }

  // --- LA QUINCAILLERIE. La classe vient des abaques, sur le poids du
  // VANTAIL COMPLET — c'est la correction du lot 1, et elle vaut ici aussi :
  // commander des paumelles standard pour un vantail de 95 kg est un
  // sinistre différé.
  const ferrures = requiredFittings(config, catalog);
  if (ferrures === 'hors-limite') {
    lacunes.push(
      `vantail de ${mesure.poidsVantailKg} kg : aucune ferrure du catalogue ne le porte ` +
        `(limite ${fam.seuilsFerrures?.renforceKg} kg)`,
    );
  } else if (ferrures && ouvrants > 0) {
    const suffixe = ferrures === 'renforcees' ? 'renf' : 'std';
    const paumellesParVantail = mesure.poidsVantailKg > SEUIL_TROISIEME_PAUMELLE_KG ? 3 : 2;
    ajouter({
      categorie: 'quincaillerie',
      reference: `paumelle-${config.materiau}-${suffixe}`,
      designation: `Paumelle ${ferrures === 'renforcees' ? 'renforcée' : 'standard'}`,
      quantite: paumellesParVantail * ouvrants,
      unite: 'piece',
      regle:
        `${paumellesParVantail} par ouvrant — vantail de ${mesure.poidsVantailKg} kg ` +
        `(seuil renfort ${fam.seuilsFerrures?.standardKg} kg, ` +
        `troisième paumelle au-delà de ${SEUIL_TROISIEME_PAUMELLE_KG} kg)`,
    });
    ajouter({
      categorie: 'quincaillerie',
      reference: `cremone-${suffixe}`,
      designation: 'Crémone-serrure',
      quantite: ouvrants,
      unite: 'piece',
      regle: 'une par ouvrant manœuvrant',
    });
    ajouter({
      categorie: 'quincaillerie',
      reference: 'bequille-alu',
      designation: 'Béquille (carré 7 mm, rosace 43 mm d’entraxe)',
      quantite: ouvrants,
      unite: 'piece',
      regle: 'une par ouvrant manœuvrant',
    });
  }

  // --- LES CONSOMMABLES. Ils ne se voient pas, ils ne se dessinent pas, et
  // un atelier qui en manque s'arrête. Ils sont dans la nomenclature pour
  // cette raison-là, et pas pour le prix.
  ajouter({
    categorie: 'consommable',
    reference: 'vis-fixation-7.5x92',
    designation: 'Vis de fixation dormant 7,5 × 92',
    quantite: nombreDeFixations(fabrication),
    unite: 'piece',
    regle: 'NF DTU 36.5 : une fixation à moins de 150 mm de chaque angle, puis tous les 700 mm',
  });
  ajouter({
    categorie: 'consommable',
    reference: 'silicone-neutre-310',
    designation: 'Cartouche de mastic silicone neutre',
    quantite: 1,
    unite: 'piece',
    regle: 'calfeutrement périphérique — une cartouche couvre environ 12 m de joint',
  });

  return { repere, lignes, lacunes };
}

/** Au-delà de cette hauteur, un montant demande son renfort. Voir `mecanique.ts`. */
const SEUIL_RENFORT_MM = 1000;
/** La prise d'une parclose dans sa feuillure, par bout, en mm. */
const PRISE_PARCLOSE_MM = 2;
/** Au-delà de ce poids, un ouvrant prend une troisième paumelle. */
const SEUIL_TROISIEME_PAUMELLE_KG = 60;

/** Le nombre d'ouvrants réellement manœuvrants — un châssis fixe n'en a pas. */
function ouvrantsDe(
  config: JoineryConfiguration,
  vantaux: number,
  catalog: PricingCatalog,
): number {
  if (config.ouverture === 'fixe') return 0;
  // UN OUVRAGE LINÉAIRE N'A PAS D'OUVRANT, et le compter comme s'il en avait
  // un était le défaut qui refusait le dossier de fabrication de cinq
  // se débitent en POTEAUX et en PANNEAUX — c'est ce que rend `computeMetre`,
  // et c'est leur nomenclature entière. Leur demander un cadre d'ouvrant à
  // quatre barres d'onglet revenait à leur appliquer l'anatomie d'une
  // fenêtre, puis à refuser le dossier faute de trouver la cote d'une pièce
  // qui n'existe pas.
  //
  // Le `vantaux: 1` de ces familles est une CONVENTION — « le seul ouvrage
  // qu'on configure à la fois », dit `configuration.ts` — et non un vantail.
  if (SANS_OUVRANT.has(config.famille)) return 0;
  return vantaux;
}

const SANS_OUVRANT: ReadonlySet<JoineryConfiguration['famille']> = new Set([
  'cloture',
  'claustra',
  'muret',
  'garde-corps',
  'totem',
]);

const OUVRANTS_HORS_MODELE: Partial<Record<JoineryConfiguration['famille'], string>> = {
  'volet-roulant': 'le tablier d’un volet roulant est un empilement de lames et son axe, pas un cadre à débiter',
  'volet-battant': 'le vantail d’un volet battant est un cadre à barres et écharpe, avec son propre débit',
  'store-banne': 'un store banne se compose d’une toile, de bras et d’une barre de charge',
  'porte-garage': 'une sectionnelle se compose de panneaux et de rails, jamais de barres d’onglet',
  moustiquaire: 'une moustiquaire est un cadre et une toile, aux cotes de son coffre',
  'store-interieur': 'un store intérieur est un tablier et un mécanisme',
  // Le BSO et le screen zip ont leur CONCEPTION (docs/36 : bornes, classes
  // de vent, réservation de linteau) et pas encore leur DÉBIT. Ce qui leur
  // manque est de la DONNÉE, pas du mécanisme — le pas d'empilage des lames
  // et le couple moteur pour l'un, la coupe des lés pour l'autre. Les deux
  // motifs sont courts à dessein : cette table vit dans le chargement de
  // session, et le budget s'est plaint au premier pesage.
  bso: 'un brise-soleil est un paquet de lames et deux coulisses ; son pas d’empilage n’est pas relevé',
  'screen-zip': 'un screen zip est une toile coupée en lés ; la coupe dépend de la laize, non relevée',
  caisson: 'un caisson se débite en PIÈCES à placer dans un panneau, pas en barres — le nesting est le lot M4',
  'portail-battant': 'le vantail d’un portail a son propre cadre et son remplissage',
  'portail-coulissant': 'le vantail d’un portail a son propre cadre, son rail et ses galets',
  portillon: 'le vantail d’un portillon a son propre cadre et son remplissage',
  pergola: 'une pergola se compose de poteaux, d’une poutre-chéneau et de lames orientables',
  veranda: 'une véranda se compose d’une ossature, de chevrons et de sa couverture',
  'porte-entree': 'la porte d’entrée attend ses déductions de gamme — dormant vu, ouvrant vu, recouvrement',
  'fenetre-toit': 'la fenêtre de toit se commande par CODE et son chevêtre suit le fabricant',
};

/**
 * LES FIXATIONS DU DORMANT, selon NF DTU 36.5 : une à moins de 150 mm de
 * chaque angle, puis un entraxe de 700 mm au plus. C'est un calcul, pas un
 * forfait — un dormant de 2,4 m n'a pas le même nombre de pattes qu'un de
 * 0,6 m, et l'atelier qui en met quatre partout laisse fuir l'air.
 */
function nombreDeFixations(fabrication: { widthMm: number; heightMm: number }): number {
  const parCote = (longueurMm: number) =>
    Math.max(2, Math.ceil((longueurMm - 2 * 150) / 700) + 2);
  return 2 * parCote(fabrication.widthMm) + 2 * parCote(fabrication.heightMm);
}

/** La composition lisible d'un vitrage — « 4/16/4 », « 10/16/44.2 ». */
function compositionVitrage(config: JoineryConfiguration, catalog: PricingCatalog): string {
  const vitrage = effectiveVitrage(config, catalog);
  if (!vitrage) return '';
  const lame = catalog.verre.lameAirMm[vitrage.base];
  const exterieur = 4 + (vitrage.phonique ? catalog.verre.phoniqueSupplementMm : 0);
  const interieur = vitrage.feuillete ? '44.2' : '4';
  if (vitrage.base === 'triple') return `${exterieur}/${lame / 2}/4/${lame / 2}/${interieur}`;
  return `${exterieur}/${lame}/${interieur}`;
}

/** Une référence de vitrage déterministe — composition, options, épaisseur. */
function referenceVitrage(config: JoineryConfiguration, catalog: PricingCatalog): string {
  const vitrage = effectiveVitrage(config, catalog);
  if (!vitrage) return '';
  const marques = [
    vitrage.base,
    vitrage.warmEdge ? 'we' : '',
    vitrage.phonique ? 'ph' : '',
    vitrage.feuillete ? 'fe' : '',
    vitrage.controleSolaire ? 'cs' : '',
  ].filter(Boolean);
  return `vit-${marques.join('-')}-${verreEpaisseurMm(vitrage, catalog)}`;
}

/** Les déductions de la gamme, pour qui veut vérifier une cote à la main. */
export function deductionsPourNomenclature(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
) {
  return deductionsDe(catalog, config.famille, config.materiau);
}
