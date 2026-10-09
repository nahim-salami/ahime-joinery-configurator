/**
 * Pourquoi ce fichier existe : le moteur de prix — la formule de docs/04 §1 :
 * base(L, H) × coefficients (matériau, ouverture, gamme, vitrage, couleur)
 * + suppléments imposés par les règles + options, puis `finaliser()` commun
 * (remise quantité, arrondi commercial). Centimes entiers PARTOUT : chaque
 * étape arrondit au centime par arithmétique entière (millièmes), l'arrondi
 * commercial au dixième d'euro n'existe que sur le montant affiché.
 *
 * Solution écartée : dupliquer la fin de formule (remises, arrondi) dans
 * chaque branche de famille. Chez les néons, la règle « finaliser() est
 * unique » est née d'une divergence réelle entre deux branches — tout ce qui
 * ne dépend pas de la famille vit dans UNE fonction, ou divergera.
 *
 * Incident fondateur : « le client ne paie jamais un chiffre venu du
 * navigateur ». Ce module sera porté 1:1 en PHP (AHJC_Pricing, phase 4) et le
 * harnais de parité rejouera les mêmes configurations dans les deux langages
 * — d'où l'interdiction des flottants dans tout calcul d'argent.
 */

import type { JoineryConfiguration, PriceLine, PriceResult } from './types.ts';
import { applyCoefMilliemes, baseFromMatrix, roundHalfUpDiv } from './matrix.ts';
import {
  DEFAULT_CATALOG,
  familleCatalog,
  formeDe,
  matricePourVantaux,
  modelePorteDe,
  modeleVoletDe,
  modelePortailDe,
  moteurDe,
  coffreDe,
  estPortail,
  manoeuvreDe,
  optionDef,
  perimetreHabillageMm,
  poseApplicable,
  posePourFamille,
  systemeDe,
  tapeeDe,
  type FamilleCatalog,
  type PricingCatalog,
} from './catalog.ts';
import { prixALaPieceSiCharge } from './couture-du-prix-a-la-piece.ts';
import { effectiveVitrage, requiredFittings } from './structural.ts';
import { securitesRetenues } from './motorisation.ts';
import { computeMetre } from './terrain.ts';
import { nommerVantaux } from './libelles.ts';

/**
 * UNE VALEUR QUE LE CATALOGUE NE CONNAÎT PAS N'A PAS DE PRIX.
 *
 * Le moteur indexait ses tables de coefficients avec ce que la configuration
 * portait : une couleur, un remplissage de porte ou un vitrage inconnus
 * rendaient `undefined` ici (donc un prix `NaN`) et ZÉRO en PHP, où l'index
 * absent se convertit en entier — un coefficient nul, un prix nul, écrit
 * dans une commande. D'autres lectures retombaient EN SILENCE sur un défaut
 * (le coffre extérieur, la sangle, le rectangle, la pose en neuf) : une
 * valeur forgée y payait le prix de la moins chère.
 *
 * Revue de l'annuaire WordPress.org, 9 octobre 2026. La règle qui en sort,
 * la même des deux côtés du fil (AHJC_Pricing::valeurs_inconnues) : chaque
 * valeur d'énumération est cherchée dans le catalogue AVANT d'indexer quoi
 * que ce soit, et une seule inconnue refuse la configuration. Le harnais de
 * parité rejoue ces refus dans les deux langages (`parity-refus.json`).
 *
 * CE QU'ELLE NE COUVRE PAS, et c'est délibéré : ce que `validateConfiguration`
 * refuse déjà EN ERREUR — le matériau, l'ouverture, la tapée, la gamme
 * nommée, la pose, le modèle de porte, la forme, le moteur, les options. Le
 * client peut y arriver de bonne foi (changer de famille, rouvrir un projet
 * dont une option a quitté le catalogue) et l'écran lui propose l'alternative
 * qui répare ; les faire lever ici casserait l'écran pendant qu'il corrige.
 * Leur repli est d'ailleurs une configuration LÉGITIME (sans l'option, au
 * palier, en neuf, en rectangle, sans moteur), jamais un coefficient nul, et
 * le panier refuse toute configuration en erreur avant de la chiffrer.
 */
export class ValeurInconnueError extends Error {
  constructor(
    readonly champ: string,
    readonly valeur: unknown,
  ) {
    super(`Valeur inconnue du catalogue : ${champ} = ${JSON.stringify(valeur) ?? 'undefined'}`);
    this.name = 'ValeurInconnueError';
  }
}

const connue = (table: object, cle: unknown): boolean =>
  typeof cle === 'string' && Object.prototype.hasOwnProperty.call(table, cle);

/**
 * Les valeurs d'énumération de la configuration que le catalogue ne connaît
 * pas, dans l'ordre où le moteur les lirait. Vide = la configuration se
 * chiffre. Une famille vendue à la pièce n'en lit aucune.
 */
export function valeursInconnues(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Array<{ champ: string; valeur: unknown }> {
  const fam = familleCatalog(catalog, config.famille);
  if (fam.unitePrix === 'piece') return [];
  const inconnues: Array<{ champ: string; valeur: unknown }> = [];
  const exiger = (champ: string, valeur: unknown, ok: boolean) => {
    if (!ok) inconnues.push({ champ, valeur });
  };

  const systeme = systemeDe(catalog, config.systeme);
  if (systeme?.coefMilliemes === undefined) {
    const gamme = systeme?.gamme ?? config.gamme;
    exiger('gamme', gamme, connue(catalog.coefGammeMilliemes, gamme));
  }
  if (config.famille === 'porte-entree') {
    const remplissage = config.remplissagePorte ?? 'pleine';
    exiger('remplissagePorte', remplissage, connue(catalog.coefRemplissagePorteMilliemes, remplissage));
  }
  if (estPortail(config.famille) && config.remplissagePortail !== undefined) {
    exiger(
      'remplissagePortail',
      config.remplissagePortail,
      catalog.modelesPortail.some((modele) => modele.id === config.remplissagePortail),
    );
  }
  if (config.famille === 'volet-battant' && config.modeleVolet !== undefined) {
    exiger(
      'modeleVolet',
      config.modeleVolet,
      catalog.modelesVolet.some((modele) => modele.id === config.modeleVolet),
    );
  }
  if (config.famille === 'volet-roulant') {
    if (config.coffre !== undefined) exiger('coffre', config.coffre, connue(catalog.coffres, config.coffre));
    if (config.manoeuvre !== undefined) {
      exiger('manoeuvre', config.manoeuvre, connue(catalog.manoeuvres, config.manoeuvre));
    }
  }
  // Le vitrage n'est lu que s'il existe (une porte pleine, un volet n'en ont pas).
  const vitrage = effectiveVitrage(config, catalog);
  if (vitrage) {
    exiger('vitrage.base', vitrage.base, connue(catalog.coefVitrageMilliemes, vitrage.base));
    const aspect = vitrage.aspect ?? 'clair';
    exiger('vitrage.aspect', aspect, connue(catalog.coefAspectVitrageMilliemes, aspect));
  }
  exiger('couleur', config.couleur, connue(catalog.coefCouleurMilliemes, config.couleur));
  // L'alimentation n'est lue que sur un moteur CONNU : un moteur inconnu
  // n'écrit aucune ligne (le prix est celui de l'ouvrage sans moteur, et le
  if (moteurDe(catalog, config.motorisation?.type) !== undefined) {
    exiger(
      'motorisation.alimentation',
      config.motorisation!.alimentation,
      connue(catalog.coefAlimentationMilliemes, config.motorisation!.alimentation),
    );
  }
  return inconnues;
}

/** L'arrondi commercial : au dixième d'euro, moitié vers le haut. */
export function arrondiCommercialCents(cents: number): number {
  return roundHalfUpDiv(cents, 10) * 10;
}

/**
 * Combine des coefficients cumulables par multiplication de millièmes
 * (docs/04 §2 : « triple + feuilleté ») — arrondi au millième.
 */
export function combineMilliemes(...milliemes: number[]): number {
  return milliemes.reduce((acc, m) => roundHalfUpDiv(acc * m, 1000), 1000);
}

/**
 * Tout ce qui ne dépend PAS de la famille : la remise quantité, le total au
 * centime, l'arrondi commercial d'affichage. Unique et exportée — les tests
 * la prennent à part, les branches de famille n'ont pas le droit d'en
 * recopier une ligne.
 */
export function finaliser(
  lines: PriceLine[],
  baseCents: number,
  quantite: number,
  catalog: PricingCatalog,
  motDeLUnite = 'menuiseries',
): PriceResult {
  let totalCents = lines.reduce((somme, ligne) => somme + ligne.amountCents, 0);

  let remiseMilliemes = 0;
  for (const palier of catalog.remisesQuantite) {
    if (quantite >= palier.quantiteMin && palier.milliemes > remiseMilliemes) {
      remiseMilliemes = palier.milliemes;
    }
  }
  if (remiseMilliemes > 0) {
    const remise = roundHalfUpDiv(totalCents * remiseMilliemes, 1000);
    lines = [
      ...lines,
      {
        code: 'remise-quantite',
        label: `Remise quantité (dès ${quantite} ${motDeLUnite}, −${remiseMilliemes / 10} %)`,
        type: 'remise',
        amountCents: -remise,
      },
    ];
    totalCents -= remise;
  }

  return {
    lines,
    baseCents,
    totalCents,
    displayTotalCents: arrondiCommercialCents(totalCents),
    currency: 'EUR',
  };
}

/**
 * Le prix d'UNE menuiserie, décomposé ligne à ligne. Ne lève jamais sur une
 * configuration refusable : la validation dit non, le prix reste défini —
 * l'affichage ne casse pas pendant que le client corrige.
 */
export function computePrice(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): PriceResult {
  const fam = familleCatalog(catalog, config.famille);

  // 0. LA BIFURCATION DU LOT Z0. Une famille vendue À LA PIÈCE n'a pas de
  //    matrice : son prix est une SOMME DE POSTES déclarés (kilos de tôle,
  //    mètres de soudure, m² de jaquette, heures). Elle sort donc avant la
  //    matrice — et avant les coefficients, qui multiplieraient une somme de
  //    lignes tracées et rendraient chacune fausse.
  //
  //    Elle rejoint la convergence commune : `finaliser()` reste UNIQUE.
  //    LA COUTURE : le calcul lui-même vit dans un module PARESSEUX
  //    (`prix-a-la-piece.ts`), qu'apporte le groupe de familles qui en vend
  //    une. Il coûtait 1,2 ko gzippés de chargement initial à tout visiteur
  //    venu pour une fenêtre, et le verrou du bundle l'a refusé.
  //
  //    Absent, le prix ne s'invente pas : zéro ligne, zéro total, et
  //    `validateConfiguration` porte la phrase qui nomme le module manquant.
  if (fam.unitePrix === 'piece') {
    return (
      prixALaPieceSiCharge(config, fam, catalog) ??
      finaliser([], 0, config.quantite ?? 1, catalog, fam.motDeLUnite)
    );
  }

  // 0 bis. AUCUNE VALEUR INCONNUE n'est indexée : voir `ValeurInconnueError`.
  const inconnue = valeursInconnues(config, catalog)[0];
  if (inconnue) throw new ValeurInconnueError(inconnue.champ, inconnue.valeur);

  const matrice = matricePourVantaux(fam, config.vantaux);
  const lines: PriceLine[] = [];

  // 1. La base. Deux lectures de la MÊME matrice, selon l'unité de vente :
  //    — à la menuiserie, la cellule est le prix de l'ouvrage entier ;
  //    — au MÈTRE COURANT, elle est le prix d'un mètre à cette hauteur, et
  //      la longueur la multiplie.
  //
  // s'arrête à cinq : au-delà du dernier palier, `baseFromMatrix()` fige la
  // cellule du bord, et vingt mètres auraient coûté le prix de cinq. Le
  // mètre courant n'est pas un raffinement, c'est ce qui rend le segment
  // chiffrable.
  const metre = computeMetre(config, catalog);
  const baseCents = metre
    ? roundHalfUpDiv(baseFromMatrix(matrice, 1000, config.heightMm) * metre.longueurMm, 1000)
    : baseFromMatrix(matrice, config.widthMm, config.heightMm);
  let courant = baseCents;
  lines.push({
    code: 'base',
    label: metre
      ? `${fam.label}, ${Math.round(metre.longueurMm / 100) / 10} m × ${config.heightMm} mm`
      : `${fam.label} ${nommerVantaux(config.vantaux)}, ${config.widthMm} × ${config.heightMm} mm`,
    type: 'base',
    amountCents: baseCents,
  });

  // 2. Les coefficients — chaque ligne porte le delta appliqué
  const appliqueCoef = (code: string, label: string, milliemes: number) => {
    if (milliemes === 1000) return;
    const apres = applyCoefMilliemes(courant, milliemes);
    lines.push({ code, label, type: 'coefficient', amountCents: apres - courant });
    courant = apres;
  };

  appliqueCoef(
    'coef-materiau',
    `Matériau ${config.materiau}`,
    fam.coefMateriauMilliemes[config.materiau] ?? 1000,
  );

  const ouverture = config.ouverture ?? fam.ouvertures?.[0];
  if (ouverture && fam.coefOuvertureMilliemes) {
    appliqueCoef('coef-ouverture', `Ouverture ${ouverture}`, fam.coefOuvertureMilliemes[ouverture] ?? 1000);
  }

  // Une gamme NOMMÉE peut porter son propre coefficient : un système alu
  // « grandes dimensions » coûte davantage qu'un simple palier performance.
  // À défaut, on retombe sur le palier — et le prix ne change pas d'un
  // centime pour une configuration qui n'en choisit aucune.
  const systeme = systemeDe(catalog, config.systeme);
  appliqueCoef(
    'coef-gamme',
    systeme ? `Gamme ${systeme.nom}` : `Gamme ${config.gamme}`,
    systeme?.coefMilliemes ?? catalog.coefGammeMilliemes[systeme?.gamme ?? config.gamme],
  );

  // Le vitrage : coefficients cumulables — feuilleté imposé compris.
  // La porte d'entrée passe par le coefficient de remplissage, qui inclut
  // déjà le feuilleté réglementaire de ses faces vitrées.
  if (config.famille === 'porte-entree') {
    const remplissage = config.remplissagePorte ?? 'pleine';
    appliqueCoef(
      'coef-remplissage',
      `Remplissage ${remplissage}`,
      catalog.coefRemplissagePorteMilliemes[remplissage],
    );
    // Le MODÈLE de panneau. Une porte à moulures ou à inserts d'inox n'est
    // pas une porte unie repeinte : ce sont des passes d'usinage et de la
    // matière rapportée. Absent, le coefficient ne s'écrit même pas — le
    // catalogue des modèles est additif comme celui des gammes nommées.
    const modele = modelePorteDe(catalog, config.famille, config.modelePorte);
    if (modele && modele.coefMilliemes !== 1000) {
      appliqueCoef('coef-modele-porte', `Modèle ${modele.nom}`, modele.coefMilliemes);
    }
  } else {
    // Le MODÈLE d'un volet battant, sur le patron exact du modèle de porte :
    // un volet plein à barres et écharpe se fabrique plus vite qu'un
    // persienné de vingt lames mortaisées, et il coûte donc MOINS. Le
    // persienné est à 1000 millièmes — le coefficient ne s'écrit alors même
    // pas, et le prix d'hier est celui d'aujourd'hui.
    // barreaudé coûte moins qu'un ajouré (moins de matière), un découpé au
    // laser bien plus (une passe de machine par motif). L'ajouré est à 1000
    // millièmes : c'est le compromis que le métier vend le plus.
    const portail = modelePortailDe(catalog, config.famille, config.remplissagePortail);
    if (portail && portail.coefMilliemes !== 1000) {
      appliqueCoef('coef-remplissage-portail', `Remplissage ${portail.nom.toLowerCase()}`, portail.coefMilliemes);
    }
    const volet = modeleVoletDe(catalog, config.famille, config.modeleVolet);
    if (volet && volet.coefMilliemes !== 1000) {
      appliqueCoef('coef-modele-volet', `Volet ${volet.nom.toLowerCase()}`, volet.coefMilliemes);
    }
    // Le COFFRE d'un volet roulant. Un coffre tunnel est un caisson isolé
    // qui se maçonne ; un bloc-baie est un ensemble monobloc. Ce ne sont pas
    // des variantes de pose, ce sont des produits différents — et le
    // coefficient le dit. `exterieur` est à 1000 : le coefficient ne
    // s'écrit alors même pas.
    const coffre = coffreDe(catalog, config.famille, config.coffre);
    if (coffre && catalog.coffres[coffre].coefMilliemes !== 1000) {
      appliqueCoef(
        'coef-coffre',
        catalog.coffres[coffre].label,
        catalog.coffres[coffre].coefMilliemes,
      );
    }
    // La MANŒUVRE — et seulement si le volet n'est pas motorisé : une
    // manivelle sur un volet à moteur n'existe pas, et la facturer serait
    // vendre deux fois la même fonction.
    const motorise = (config.options ?? []).some((choisie) =>
      String(choisie.id).startsWith('motorisation-'),
    );
    const manoeuvre = motorise ? undefined : manoeuvreDe(catalog, config.famille, config.manoeuvre);
    if (manoeuvre && catalog.manoeuvres[manoeuvre].coefMilliemes !== 1000) {
      appliqueCoef(
        'coef-manoeuvre',
        `Manœuvre à ${catalog.manoeuvres[manoeuvre].label.toLowerCase()}`,
        catalog.manoeuvres[manoeuvre].coefMilliemes,
      );
    }
    const vitrage = effectiveVitrage(config, catalog);
    if (vitrage) {
      const combine = combineMilliemes(
        catalog.coefVitrageMilliemes[vitrage.base],
        vitrage.phonique ? catalog.coefPhoniqueMilliemes : 1000,
        vitrage.feuillete ? catalog.coefFeuilleteMilliemes : 1000,
        catalog.coefAspectVitrageMilliemes[vitrage.aspect ?? 'clair'],
        vitrage.storeIntegre ? catalog.coefStoreIntegreMilliemes : 1000,
        vitrage.warmEdge ? catalog.coefWarmEdgeMilliemes : 1000,
      );
      const etiquette = [
        `Vitrage ${vitrage.base}`,
        vitrage.phonique ? 'phonique' : null,
        vitrage.feuillete ? 'feuilleté 44.2' : null,
        vitrage.aspect && vitrage.aspect !== 'clair' ? vitrage.aspect : null,
        vitrage.storeIntegre ? 'store intégré' : null,
        vitrage.warmEdge ? 'bord chaud' : null,
      ]
        .filter(Boolean)
        .join(', ');
      appliqueCoef('coef-vitrage', etiquette, combine);
    }
  }

  appliqueCoef('coef-couleur', `Couleur ${config.couleur}`, catalog.coefCouleurMilliemes[config.couleur]);

  // La POSE. Un seul coefficient au catalogue ne vaut pas 1000 : celui de
  // la rénovation, parce que son dormant est un AUTRE profilé, avec son
  // aile de recouvrement et son usinage. Les autres poses coûtent des
  // heures de chantier, pas de l'atelier — et le pied de page annonce
  // « pose non comprise ». Les facturer ici ferait mentir le devis.
  // La FORME. Un profilé cintré passe à la cintreuse, se contrôle au
  // gabarit et se rebute : c'est le poste où un menuisier perd de l'argent
  // s'il chiffre à la louche. Le rectangle vaut 1000 — une configuration
  // qui ne dit rien de sa forme paie ce qu'elle payait avant.
  const forme = formeDe(catalog, config.forme);
  if (forme.coefMilliemes !== 1000) {
    appliqueCoef('coef-forme', `Forme ${forme.label.toLowerCase()}`, forme.coefMilliemes);
  }

  const pose = posePourFamille(catalog, config.famille, config.pose);
  if (pose.coefMilliemes !== 1000) {
    appliqueCoef('coef-pose', `Pose ${pose.label.toLowerCase()}`, pose.coefMilliemes);
  }

  // 3. Les suppléments imposés par les règles (docs/04 §4) — la base
  // corrigée sert d'assiette, comme dans l'exemple chiffré de la doc.
  const baseCorrigee = courant;
  const ferrures = requiredFittings(config, catalog);
  if (ferrures === 'renforcees' || ferrures === 'hors-limite') {
    const supplement = roundHalfUpDiv(baseCorrigee * catalog.ferruresRenforceesMilliemes, 1000);
    lines.push({
      code: 'ferrures-renforcees',
      label: 'Ferrures renforcées (poids de vitrage)',
      type: 'supplement',
      amountCents: supplement,
    });
    courant += supplement;
  }
  // Les pièces que la pose fait fabriquer. Ce sont des PROFILÉS — l'atelier
  // les coupe, le dossier de fabrication les listera, le poseur les
  // retrouvera dans le colis. Rien ici n'est de la main-d'œuvre.
  if (poseApplicable(catalog, config.famille)) {
    const perimetreMm = perimetreHabillageMm(config.widthMm, config.heightMm);
    const tapee = pose.tapee ? tapeeDe(catalog, config.tapeeMm) : undefined;
    if (tapee) {
      // La tapée fait le TOUR du dormant : périmètre entier, appui compris.
      const tourMm = 2 * (config.widthMm + config.heightMm);
      const montant = roundHalfUpDiv(tourMm * tapee.centsParMetre, 1000);
      lines.push({
        code: 'tapee',
        label: `Tapée d'isolation ${tapee.epaisseurMm} mm`,
        type: 'supplement',
        amountCents: montant,
      });
      courant += montant;
    }
    if (pose.couvreJointCentsParMetre > 0) {
      const montant = roundHalfUpDiv(perimetreMm * pose.couvreJointCentsParMetre, 1000);
      lines.push({
        code: 'couvre-joint',
        label: 'Couvre-joint intérieur (3 côtés)',
        type: 'supplement',
        amountCents: montant,
      });
      courant += montant;
    }
    if (pose.bavetteCentsParMetre > 0) {
      const montant = roundHalfUpDiv(config.widthMm * pose.bavetteCentsParMetre, 1000);
      lines.push({
        code: 'bavette',
        label: "Bavette d'appui aluminium",
        type: 'supplement',
        amountCents: montant,
      });
      courant += montant;
    }
  }

  if (config.famille === 'coulissant' && config.widthMm > catalog.renfortCoulisse.auDelaDeMm) {
    const renfort = roundHalfUpDiv(config.widthMm * catalog.renfortCoulisse.centsParMetre, 1000);
    lines.push({
      code: 'renfort-coulisse',
      label: `Renfort de coulisse (baie de ${config.widthMm} mm)`,
      type: 'supplement',
      amountCents: renfort,
    });
    courant += renfort;
  }

  // 3 bis. LA MOTORISATION. Elle n'est pas un coefficient : c'est un
  // matériel, avec son prix, et ses SÉCURITÉS qui s'ajoutent d'office.
  // Le devis les nomme une par une — un client doit pouvoir lire ce que la
  // norme lui a fait payer, et pourquoi.
  const moteur = moteurDe(catalog, config.motorisation?.type);
  if (moteur) {
    const supplement = catalog.coefAlimentationMilliemes[config.motorisation!.alimentation] ?? 1000;
    lines.push({
      code: 'motorisation',
      label: `Motorisation ${moteur.nom.toLowerCase()} (${config.motorisation!.alimentation})`,
      type: 'option',
      amountCents: roundHalfUpDiv(moteur.amountCents * supplement, 1000),
    });
    for (const securite of securitesRetenues(config, catalog)) {
      if (securite.amountCents === 0) continue;
      lines.push({
        code: `securite-${securite.id}`,
        label: `${securite.nom} — imposé`,
        type: 'option',
        amountCents: securite.amountCents,
      });
    }
  }

  // 3 ter. LES POTEAUX d'un ouvrage linéaire. Ils ne sont pas dans le prix
  // mètres — l'une droite, l'autre en L — n'en portent pas autant. Les
  // fondre dans le mètre courant aurait fait payer les angles à ceux qui
  // n'en ont pas.
  // « 0 poteaux » sur un devis ferait douter de tout le reste.
  if (metre && metre.poteaux > 0) {
    lines.push({
      code: 'poteaux',
      label: `${metre.poteaux} poteaux${metre.poteauxAngle > 0 ? `, dont ${metre.poteauxAngle} d'angle` : ''}`,
      type: 'supplement',
      amountCents:
        metre.poteaux * catalog.cloture.poteauCents +
        metre.poteauxAngle * catalog.cloture.poteauAngleSupplementCents,
    });
  }

  // 4. Les options à montant fixe (docs/04 §3)
  for (const choisie of config.options ?? []) {
    const def = optionDef(catalog, choisie.id);
    if (!def || !def.familles.includes(config.famille)) continue; // la validation l'a dit
    const quantite = def.unite === 'parVantail' ? Math.max(1, choisie.quantite ?? 1) : 1;
    const montant = def.amountCents * quantite;
    lines.push({
      code: `option-${def.id}`,
      label: quantite > 1 ? `${def.label} × ${quantite}` : def.label,
      type: 'option',
      amountCents: montant,
    });
    courant += montant;
  }

  // 5. La convergence commune — remise quantité, arrondi commercial
  return finaliser(lines, baseCents, config.quantite ?? 1, catalog);
}
