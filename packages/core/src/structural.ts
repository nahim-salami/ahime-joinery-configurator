/**
 * Pourquoi ce fichier existe : le poids du vitrage et ce qu'il impose — les
 * cotes de vantail, le clair de vitrage, les ferrures admissibles, le
 * vitrage effectif (feuilleté imposé compris). Le prix, la thermique et la
 * validation s'appuient tous trois sur CES calculs, jamais sur les leurs.
 *
 * Solution écartée : déduire finement les profils (dormant, battue,
 * mullions) pour le clair de vitrage. Ces cotes dépendent de la gamme et du
 * fournisseur — indisponibles en phase 1. Le modèle « bande de profil
 * forfaitaire par matériau, de chaque côté du vantail » est volontairement
 * simple, réglable au catalogue, et suffisant pour le poids et le Uw.
 *
 * Incident fondateur : la règle des néons « le manifeste de mesures fait
 * foi, jamais le maillage ». Les cotes de fabrication sortiront d'ICI —
 * la 3D de la phase 3 n'en sera qu'une projection.
 */

import type { JoineryConfiguration, MeasureReport, Vitrage } from './types.ts';
import {
  DEFAULT_CATALOG,
  deductionsDe,
  familleCatalog,
  masseVueMm,
  posePourFamille,
  tapeeDe,
  type PricingCatalog,
} from './catalog.ts';
// LA SPIRALE, ET RIEN DE PLUS. `geometrie/profils.ts` porte la même fonction
// en réexportation, et la lire LÀ ferait descendre six cent quatre-vingts
// lignes de sections de profilé dans le chargement initial — mesuré à 979
// octets gzippés de trop au lot O10. Ce fichier est dans l'entrée, puisque le
// prix, la thermique et la validation lisent tous trois la cote de vantail.
import { hauteurCoffreMm } from './enroulement-du-tablier.ts';

/** Arrondi « moitié vers le haut » au dixième — poids en kg. */
function arrondiDixieme(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Le vitrage feuilleté est-il imposé par la règle ? (docs/02 §3.3)
 * — toute porte : porte-fenêtre toujours, porte d'entrée dès qu'elle est
 *   vitrée (le vitrage descend sous 90 cm) ;
 * — fenêtre dont l'allège déclarée est sous le seuil (90 cm).
 * Le coulissant reste un choix conseillé, pas une imposition : l'exemple
 * chiffré de docs/04 §6 tarife une baie SANS feuilleté.
 */
export function feuilleteImpose(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): boolean {
  if (config.famille === 'porte-fenetre') return true;
  if (config.famille === 'porte-entree') {
    return (config.remplissagePorte ?? 'pleine') !== 'pleine';
  }
  if (config.famille === 'fenetre') {
    return (
      config.hauteurAllegeMm !== undefined &&
      config.hauteurAllegeMm < catalog.feuilleteImposeAllegeSousMm
    );
  }
  return false;
}

/**
 * Le vitrage réellement fabriqué : celui de la configuration, feuilleté
 * forcé quand la règle l'impose — null si la famille n'est pas vitrée.
 * Une porte d'entrée vitrée sans précision part sur du double.
 */
export function effectiveVitrage(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Vitrage | null {
  const fam = familleCatalog(catalog, config.famille);
  const porteVitree =
    config.famille === 'porte-entree' && (config.remplissagePorte ?? 'pleine') !== 'pleine';
  if (!fam.vitree && !porteVitree) return null;
  const declare: Vitrage = config.vitrage ?? { base: 'double' };
  if (feuilleteImpose(config, catalog) && !declare.feuillete) {
    return { ...declare, feuillete: true };
  }
  return declare;
}

/** Épaisseur de verre cumulée (mm) d'un vitrage — pilote le poids. */
export function verreEpaisseurMm(vitrage: Vitrage, catalog: PricingCatalog = DEFAULT_CATALOG): number {
  let mm = catalog.verre.epaisseurMm[vitrage.base];
  if (vitrage.phonique) mm += catalog.verre.phoniqueSupplementMm;
  if (vitrage.feuillete) mm += catalog.verre.feuilleteSupplementMm;
  // Le store intégré épaissit le VITRAGE, pas le verre : il lui faut de la
  // lame d'air pour que ses lames tournent. La distinction compte pour la
  // coupe technique — qui dessine l'épaisseur totale du vitrage — mais pas
  // pour le poids du verre, qui se calcule plus bas sur les seules faces.
  if (vitrage.storeIntegre) mm += catalog.verre.storeIntegreSupplementMm;
  return mm;
}

/**
 * L'ÉPAISSEUR HORS TOUT du vitrage — verre plus lames d'air. C'est elle
 * que la feuillure reçoit, que la parclose pince et que le volume dessine ;
 * `verreEpaisseurMm()` ne rend que ce qui PÈSE.
 *
 * Séparer les deux est ce qui permet à la 3D de montrer DEUX verres et
 * leur intercalaire sans que le poids d'un vantail ne double.
 */
export function vitrageEpaisseurMm(
  vitrage: Vitrage,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): number {
  return verreEpaisseurMm(vitrage, catalog) + catalog.verre.lameAirMm[vitrage.base];
}

/**
 * L'épaisseur de VERRE seule, sans la lame d'air ajoutée par un store
 * intégré. C'est elle qui pèse : douze millimètres de vide ne pèsent rien,
 * et les compter au poids ferait imposer des ferrures renforcées à une
 * fenêtre qui n'en a pas besoin.
 */
function verreSeulMm(vitrage: Vitrage, catalog: PricingCatalog): number {
  return (
    verreEpaisseurMm(vitrage, catalog) -
    (vitrage.storeIntegre ? catalog.verre.storeIntegreSupplementMm : 0)
  );
}

/** Part de la surface du clair réellement vitrée (porte d'entrée : 40 % en
 * semi-vitrée, 80 % en vitrée) — 1 partout ailleurs. */
export function fractionVitree(config: JoineryConfiguration): number {
  if (config.famille !== 'porte-entree') return 1;
  const remplissage = config.remplissagePorte ?? 'pleine';
  if (remplissage === 'semi-vitree') return 0.4;
  if (remplissage === 'vitree') return 0.8;
  return 0;
}

/**
 * LE COFFRE D'UN BLOC-BAIE PREND SUR LA HAUTEUR COMMANDÉE — lot O10.
 *
 * La cote saisie est celle du TABLEAU, et le catalogue le dit mot pour mot :
 * « du rejingot au linteau, au plus court des trois mesures, jeu de pose
 * déduit ». Un bloc-baie est un MONOBLOC : son coffre est solidaire du
 * dormant et entre dans le trou AVEC lui — l'argument du catalogue le dit
 * aussi, « une seule pose, aucun pont thermique au raccord ».
 *
 * MESURÉ AVANT CORRECTION, sur une fenêtre 1 200 × 1 450 : le dessin
 * descendait à **1 630 mm** — le coffre de 180 s'ajoutait PAR-DESSUS la cote
 * saisie —, et le clair, le vantail, la masse de vitrage et l'Uw étaient
 * **identiques avec et sans l'option**. L'ouvrage livré ne rentrait pas dans
 * le trou mesuré, de 12,4 % de sa hauteur, et rien ne le disait.
 *
 * Le relevé de Fenetre24 (docs/51 §4.1) tranche dans le même sens et le
 * répète deux fois sur sa page : « la hauteur du caisson est comprise dans la
 * hauteur totale de la fenêtre ». C'est un jeu de cotes à lettres (lot Z6) —
 * une cote saisie que des choix ultérieurs MANGENT —, et c'est la faute de
 * convention des lots MT7a, O8b et C0 : deux grandeurs sous un même nom.
 */
export function coffreDuBlocBaieMm(config: JoineryConfiguration): number {
  const pris = (config.options ?? []).some((option) => option.id === 'bloc-baie-manuel');
  return pris ? hauteurCoffreMm(config.heightMm) : 0;
}

/**
 * LA HAUTEUR DE LA MENUISERIE — la cote commandée moins ce que le coffre
 * d'un bloc-baie prend. Sans l'option, c'est la cote commandée.
 */
export function hauteurDeMenuiserieMm(config: JoineryConfiguration): number {
  return Math.max(0, config.heightMm - coffreDuBlocBaieMm(config));
}

/**
 * Le rapport de mesure : cotes de vantail, clair de vitrage, poids.
 * Les poids sont arrondis au dixième de kg — c'est la précision que la
 * parité JS↔PHP compare (`glassWeightKg`).
 */
export function computeMeasureReport(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): MeasureReport {
  const fam = familleCatalog(catalog, config.famille);
  const vantaux = Math.max(1, Math.round(config.vantaux));
  const vantailWidthMm = Math.round(config.widthMm / vantaux);
  // LA HAUTEUR DU VANTAIL PART DE LA MENUISERIE, pas de la cote commandée :
  // le coffre d'un bloc-baie prend sur elle (lot O10). Sans l'option, rien ne
  // change — et c'est ce que la parité vérifie sur cent deux configurations.
  const vantailHeightMm = Math.max(
    0,
    hauteurDeMenuiserieMm(config) - (config.imposteHauteurMm ?? 0),
  );

  // La pose, avant tout le reste : elle dit ce que le client aurait dû
  // mesurer, et donc ce que ces cotes veulent dire. Sur un volet ou un
  // store la question ne se pose pas — on retombe sur la référence.
  const pose = posePourFamille(catalog, config.famille, config.pose);
  // LA MASSE VUE PAR CÔTÉ — dormant + ouvrant, l'écart de rénovation
  // la bande forfaitaire d'avant, inchangée.
  const bande = masseVueMm(catalog, config.famille, config.materiau, pose);
  // Ce que le client perd en clair de jour par rapport à SA menuiserie
  // actuelle : la bande du nouveau cadre, moins celle que l'ancien ouvrant
  // masquait déjà à cet endroit. Hors rénovation il n'y a pas d'existant à
  // comparer — la question n'a pas de sens, la réponse est 0.
  const clairPerduParCoteMm =
    pose.recouvrementMm > 0 ? Math.max(0, bande - pose.ouvrantExistantMm) : 0;
  const tapeeMm = pose.tapee ? (tapeeDe(catalog, config.tapeeMm)?.epaisseurMm ?? 0) : 0;
  const cotesDePose = {
    pose: pose.id,
    recouvrementMm: pose.recouvrementMm,
    clairPerduParCoteMm,
    tapeeMm,
  };

  const vitrage = effectiveVitrage(config, catalog);
  const d = deductionsDe(catalog, config.famille, config.materiau);

  // DEUX CHOSES INDÉPENDANTES, et les confondre est la faute que ce bloc a
  // faite DEUX FOIS, une dans chaque sens :
  //
  //   — le CLAIR et le POIDS demandent un vitrage. Ils n'ont pas besoin des
  //     déductions : la bande vue a toujours une valeur, forfaitaire à
  //     défaut de gamme ;
  //   — la CHAÎNE DE COTES demande les déductions. Elle n'a pas besoin du
  //     vitrage : une porte PLEINE se débite comme une porte vitrée, c'est
  //     le panneau qui remplace le verre dans la feuillure.
  //
  // Le premier jet sortait dès qu'il n'y avait pas de vitrage, et refusait
  // le dossier de fabrication d'une porte d'entrée pleine — le modèle le
  // plus vendu du segment. La correction a d'abord sorti dès qu'il n'y
  // avait pas de déductions, et a fait perdre son Uw à la fenêtre de toit,
  // qui est vitrée et n'en a pas. On ne sort donc que s'il manque LES DEUX.
  if (!vitrage && !d) {
    return {
      widthMm: config.widthMm,
      heightMm: config.heightMm,
      vantaux,
      vantail: { widthMm: vantailWidthMm, heightMm: vantailHeightMm },
      ...cotesDePose,
      chaineDeCotes: null,
      clairVitrage: null,
      verreMm: 0,
      glassWeightKgParVantail: 0,
      glassWeightKg: 0,
      poidsVantailKg: 0,
    };
  }

  // LA CHAÎNE DE COTES (lot 0, docs/15). Le battement se déduit UNE FOIS
  // de la largeur totale — jamais deux fois d'un demi-vantail, ce qui
  // faisait porter à un deux-vantaux un refend de 230 mm là où le métier
  // en pose 112, et sous-évaluait le clair de 10 à 61 % (docs/13 §2).
  const battementMm = d?.battementMm ?? 0;
  const clairTotalWidthMm = Math.max(0, config.widthMm - 2 * bande - battementMm * (vantaux - 1));
  const clairWidthMm = Math.round(clairTotalWidthMm / vantaux);
  const clairHeightMm = Math.max(0, vantailHeightMm - 2 * bande);
  // LE VERRE, s'il y en a. UNE PORTE PLEINE N'EN A PAS et se débite quand
  // même : son ouvrant est le même cadre à quatre barres d'onglet, et c'est
  // le panneau qui remplace le vitrage dans la feuillure.
  //
  // Le premier jet sortait de cette fonction dès qu'il n'y avait pas de
  // vitrage, en rendant `chaineDeCotes: null`. La nomenclature réclamait
  // alors un cadre d'ouvrant qu'elle ne trouvait pas, et le dossier de
  // fabrication d'une porte d'entrée PLEINE — le modèle le plus vendu du
  // segment — était refusé. Le refus disait « la chaîne de cotes ne donne
  // pas de cadre d'ouvrant », ce qui envoyait chercher un défaut de cote là
  // où il n'y avait qu'un garde-fou posé au mauvais endroit.
  const verreMm = vitrage ? verreEpaisseurMm(vitrage, catalog) : 0;
  const fraction = fractionVitree(config);
  const aireM2 = (clairWidthMm * clairHeightMm * fraction) / 1_000_000;
  // Le poids : le VERRE seul, plus le store s'il y en a un. Un store
  // vénitien intégré pèse ses lames d'aluminium, ses rails et sa commande —
  // deux kilos et demi au mètre carré, qui comptent pour les ferrures.
  const parVantail = vitrage
    ? arrondiDixieme(
        aireM2 * verreSeulMm(vitrage, catalog) * catalog.verre.kgParM2ParMm +
          (vitrage.storeIntegre ? aireM2 * catalog.verre.storeIntegreKgParM2 : 0),
      )
    : 0;

  // Les étages du dessus : le clair remonte vers le verre, puis vers la
  // feuillure. Chaque pas est une addition documentée — recouvrement de
  // parclose, puis jeu périphérique NF DTU 39.
  const chaineDeCotes = d
    ? {
        dimensionFabrication: { widthMm: config.widthMm, heightMm: config.heightMm },
        coteVitrage: {
          widthMm: clairWidthMm + 2 * d.priseDeVerreMm,
          heightMm: clairHeightMm + 2 * d.priseDeVerreMm,
        },
        fondDeFeuillure: {
          widthMm: clairWidthMm + 2 * (d.priseDeVerreMm + d.jeuVitrageMm),
          heightMm: clairHeightMm + 2 * (d.priseDeVerreMm + d.jeuVitrageMm),
        },
        // LE CADRE DE L'OUVRANT — la cote de DÉBIT, et elle ne se déduit
        // pas du fond de feuillure. Elle part du clair et remonte par ce
        // que l'ouvrant MONTRE (`ouvrantVuMm`, parclose comprise) puis par
        // ce qu'il CACHE derrière le dormant (`recouvrementOuvrantMm`).
        //
        // EN HAUTEUR, les deux traverses rencontrent toujours le dormant :
        // le recouvrement compte deux fois, sans discussion.
        //
        // EN LARGEUR, non. Sur un deux-vantaux, le montant de rive recouvre
        // le dormant, mais le montant CENTRAL rencontre l'autre vantail —
        // et ce recouvrement-là est déjà dans le battement. On ne le compte
        // donc qu'une fois dès qu'il y a un refend.
        //
        // Ce que cela laisse d'imprécis, dit franchement : le vantail du
        // MILIEU d'un trois-vantaux ne touche le dormant d'aucun côté, et
        // sa barre sortira un recouvrement trop longue. C'est délibéré —
        // une barre trop longue se recoupe, une barre trop courte se jette.
        // Un atelier arbitre toujours dans ce sens.
        //
        // Un châssis fixe n'a pas d'ouvrant : `null` plutôt qu'une cote
        // inventée, parce qu'un atelier qui débite un cadre inutile le
        // débite quand même.
        ouvrant:
          config.ouverture === 'fixe'
            ? null
            : {
                widthMm:
                  clairWidthMm +
                  2 * d.ouvrantVuMm +
                  (vantaux === 1 ? 2 : 1) * d.recouvrementOuvrantMm,
                heightMm:
                  clairHeightMm + 2 * (d.ouvrantVuMm + d.recouvrementOuvrantMm),
              },
        battementMm,
        masseVueMm: bande,
      }
    : null;

  // LE POIDS DU VANTAIL COMPLET — verre, cadre et ferrure. C'est LUI que
  // les abaques comparent : une ferrure porte un ouvrant, pas une vitre.
  // Le périmètre du cadre vient des cotes de vantail ; sa masse linéique
  // du catalogue.
  const perimetreM = (2 * (vantailWidthMm + vantailHeightMm)) / 1000;
  const poidsCadreKg =
    perimetreM * (catalog.masseLineiqueKgParM[config.materiau] ?? 2.4) +
    catalog.ferrureKgParVantail;

  return {
    widthMm: config.widthMm,
    heightMm: config.heightMm,
    vantaux,
    vantail: { widthMm: vantailWidthMm, heightMm: vantailHeightMm },
    ...cotesDePose,
    chaineDeCotes,
    // LE CLAIR reste `null` sans verre : un panneau plein n'a pas de clair
    // de vitrage, et en annoncer un ferait commander du verre pour une
    // porte qui n'en veut pas.
    clairVitrage: vitrage ? { widthMm: clairWidthMm, heightMm: clairHeightMm } : null,
    verreMm,
    glassWeightKgParVantail: parVantail,
    glassWeightKg: arrondiDixieme(parVantail * vantaux),
    poidsVantailKg: arrondiDixieme(parVantail + poidsCadreKg),
  };
}

export type Ferrures = 'standard' | 'renforcees' | 'hors-limite';

/**
 * Les ferrures qu'impose le poids de vitrage — docs/02 §3.2.
 * null : famille sans vitrage, la question ne se pose pas.
 * 'hors-limite' : même renforcées, les ferrures ne portent pas ce vantail —
 * c'est la validation qui transforme cela en refus expliqué.
 */
export function requiredFittings(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Ferrures | null {
  const fam = familleCatalog(catalog, config.famille);
  if (!fam.seuilsFerrures) return null;
  const mesure = computeMeasureReport(config, catalog);
  if (mesure.clairVitrage === null) return null;
  // LE VANTAIL COMPLET, pas le verre seul : c'est ce que la ferrure porte.
  const poids = mesure.poidsVantailKg;
  if (poids > fam.seuilsFerrures.renforceKg) return 'hors-limite';
  if (poids > fam.seuilsFerrures.standardKg) return 'renforcees';
  return 'standard';
}
