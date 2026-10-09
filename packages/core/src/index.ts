/**
 * Pourquoi ce fichier existe : la porte d'entrée unique de @ahjc/core —
 * le widget, le harnais de parité et le bundle du dashboard importent d'ICI,
 * jamais d'un module interne : la surface publique est un contrat.
 *
 * Solution écartée : laisser chaque consommateur importer les modules à la
 * carte. C'est ainsi qu'un renommage interne casse trois consommateurs chez
 * les néons — l'index fige ce qui est public, le reste peut bouger.
 *
 * Incident fondateur : le portage PHP (phase 4) recopie cette surface 1:1 —
 * chaque export ci-dessous aura son miroir AHJC_Pricing, comparé par le
 * harnais de parité champ par champ.
 */

export type {
  CompositionPetitsBois,
  Couleur,
  Exposition,
  FamilleId,
  Gamme,
  JoineryConfiguration,
  Materiau,
  MeasureReport,
  OptionChoisie,
  OptionId,
  Ouverture,
  PriceLine,
  PriceLineType,
  PriceResult,
  RemplissagePorte,
  Forme,
  ModelePorte,
  ModeleVolet,
  RemplissagePortail,
  SensRefoulement,
  AlimentationMoteur,
  Motorisation,
  SecuriteId,
  TypeMoteur,
  ZoneVent,
  FacadeDeclaree,
  ToitureVue,
  OrientationFacade,
  ManoeuvreVolet,
  TypeCoffre,
  Pose,
  Sens,
  Severite,
  ValidationIssue,
  AspectVitrage,
  Vitrage,
  VitrageBase,
} from './types.ts';

export { baseFromMatrix, applyCoefMilliemes, roundHalfUpDiv, type PriceMatrix } from './matrix.ts';

export {
  DEFAULT_CATALOG,
  familleCatalog,
  formeDe,
  formesDeLaFamille,
  matricePourVantaux,
  modelePorteDe,
  modeleVoletDe,
  modelePortailDe,
  moteurDe,
  aUneCoupeDeProfil,
  moteursDeLaFamille,
  estLineaire,
  estALaPiece,
  estPortail,
  coffreDe,
  manoeuvreDe,
  optionDef,
  perimetreHabillageMm,
  poseApplicable,
  poseDe,
  posePourFamille,
  systemeDe,
  systemesDuMateriau,
  tapeeDe,
  tapeeLaPlusProche,
  type DecorPorte,
  type FormeDef,
  type ModelePorteDef,
  type ModeleVoletDef,
  type ModelePortailDef,
  type MoteurDef,
  type SecuriteDef,
  type DecorPortail,
  type DecorVolet,
  type PoseDef,
  type SystemeProfile,
  type TapeeDef,
  type BornesFamille,
  type FamilleCatalog,
  type OptionDef,
  type PricingCatalog,
  type SeuilsFerrures,
} from './catalog.ts';
/**
 * LE PRIX À LA PIÈCE (lot Z0) N'EST PAS RÉEXPORTÉ ICI, et c'est délibéré —
 * exactement comme `computeMetrage`, qui s'importe par son chemin.
 *
 * Un export de confort depuis ce fichier ramène le module dans le CHARGEMENT
 * INITIAL : mesuré, 90,8 ko gzippés pour un budget de 90,0. Les TYPES, eux,
 * ne pèsent rien et voyagent librement.
 *
 * Qui a besoin du calcul l'importe par `./prix-a-la-piece.ts` — et l'importer
 * l'ENREGISTRE dans la couture, ce qui est tout l'intérêt.
 */
export { MODULE_DES_POSTES_ABSENT, type PrixALaPiece } from './couture-du-prix-a-la-piece.ts';
export type {
  BasePoste,
  PosteDef,
  PosteChoisi,
  SommeDePostes,
  RefusDePoste,
  MotifDePoste,
} from './prix-a-la-piece.ts';

export {
  computeMeasureReport,
  effectiveVitrage,
  feuilleteImpose,
  fractionVitree,
  requiredFittings,
  verreEpaisseurMm,
  vitrageEpaisseurMm,
  type Ferrures,
} from './structural.ts';

export {
  SEUILS_AIDES,
  SEUILS_AIDES_TOIT,
  computeUw,
  critereTechniqueAides,
  seuilsAidesDe,
  type CritereAides,
  type UwReport,
} from './thermal.ts';

// NI `aides.ts` NI `comparateur.ts` ne sont réexportés ici, et la raison
// n'est pas seulement le budget — elle est de fond.
//
// Le CRITÈRE TECHNIQUE (`critereTechniqueAides`, ci-dessus) ne dépend que
// de la menuiserie : il se vérifie dès la première seconde, sans rien
// demander, et il se corrige en changeant de vitrage. C'est un FAIT sur le
// produit, et il reste dans l'entrée.
//
// Le MONTANT, lui, dépend de la tranche de revenus, de l'ancienneté du
// logement et du RGE de l'artisan. Le configurateur ne les connaît pas au
// premier affichage ; les supposer pour afficher un chiffre serait la
// demi-promesse que `aides.ts` condamne dans son propre en-tête. Il
// s'importe donc par l'écran qui pose les questions :
//   `@ahjc/core/src/aides.ts`
//   `@ahjc/core/src/comparateur.ts`
// — ce dernier calculant en plus TROIS configurations complètes.
export {
  computeAcoustique,
  ISOLEMENT_FACADE_MINIMAL_DB,
  type RapportAcoustique,
} from './acoustique.ts';
export {
  chargeDeVent,
  classeDePression,
  epaisseurVerreConseilleeMm,
  fleche,
  MODULE_YOUNG,
  regionDepuisZone,
  type CategorieTerrain,
  type ChargeDeVent,
  type Fleche,
  type RegionVent,
} from './mecanique.ts';

export {
  DECORS_PLAXES,
  NUANCIER,
  RUGOSITE_FINITION,
  VERNIS_PAR_MATERIAU,
  resoudreTeintes,
  type ChoixTeinte,
  type DecorPlaxe,
  type TeinteRal,
  type TeintesResolues,
} from './teintes.ts';

export { computeMetre, tronconsDe, type RapportMetre, type Troncon } from './terrain.ts';

// `metrage.ts` N'EST PAS réexporté ici — mêmes raisons que le manifeste,
// et la même leçon apprise trois fois : Rollup découpe par MODULE, et un
// export de confort suffit à ramener tout le fichier dans l'entrée.
//
// Le relevé aux trois points est un ÉCRAN qu'on ouvre quand on a décidé
// d'acheter, pas un calcul que le prix consulte à chaque frappe. Il
// s'importe par son chemin, depuis l'écran qui le montre :
//   `@ahjc/core/src/metrage.ts`
//
// Seul le TYPE `ReleveTroisPoints` reste public — le widget le range dans
// son état, et un type ne pèse rien.
export type { ReleveTroisPoints } from './metrage.ts';

// L'ÉTAT DES COTES est un TYPE, et il vient de `export/manifeste.ts` — le
// module qui en fait quelque chose. Le réexporter ici met le vocabulaire à
// portée du widget sans tirer le manifeste dans l'entrée : `export type`
// et non `export { type … }`, la leçon déjà apprise sur `Geometry3D`.
export type { EtatDesCotes } from './export/manifeste.ts';

export {
  SANS_PIECE,
  computeProjet,
  dupliquer,
  harmoniser,
  recapParPiece,
  repereDe,
  reperesDuProjet,
  type RecapPiece,
  type LigneProjet,
  type MetreProjet,
  type ParametresProjet,
  type RapportProjet,
} from './projet.ts';

export { configurationParDefaut } from './configuration.ts';

// LE LECTEUR DE BORDEREAU n'est PAS reexporte ici, meme regle que le plan de
// masse : c'est l'ecran du bailleur qui l'importe, par son chemin
// — `@ahjc/core/src/bordereau.ts` —, et le visiteur venu configurer une
// fenetre n'en telecharge pas une ligne.

// LE PLAN DE MASSE n'est PAS reexporte ici, et c'est delibere : l'index est
// ce que le widget charge d'emblee. Le plan s'importe par son chemin, depuis
// l'ecran qui le regarde — `@ahjc/core/src/export/plan.ts` — comme la
// scene 3D importe three.js. Un export de confort ici l'aurait remis dans le
// chargement initial de tout le monde, et le budget l'a dit.

export {
  computePriseAuVent,
  computeRapportVantail,
  moteurCompatibleLePlusProche,
  securitesImposees,
  securitesManquantes,
  securitesRetenues,
  verifierMoteur,
  type CompatibiliteMoteur,
  type RapportVantail,
  type RapportVent,
} from './motorisation.ts';

export {
  computeElevation,
  dormantMm,
  sensDesVantaux,
  teinteParDefaut,
  type Elevation,
  type ElevationCote,
  type ElevationLine,
  type ElevationPoignee,
  type ElevationRect,
  type SensVantail,
} from './drawing.ts';

export {
  MANIFESTE_FAMILLES,
  UNIVERS,
  chargerFamille,
  chargerGroupe,
  chargerToutesLesFamilles,
  enregistrerModule,
  familleChargee,
  groupeDe,
  moduleDe,
  refusFamilleNonChargee,
  type ContexteDessin,
  type GroupeFamilles,
  type Univers,
  type ModuleFamille,
} from './familles/registre.ts';

export {
  POUCE_MM,
  SEIZIEMES_PAR_POUCE,
  analyserCote,
  analyserSeiziemes,
  formaterCote,
  formaterSeiziemes,
  mmVersSeiziemes,
  seiziemesVersMm,
  valeurPourChamp,
  type Unite,
} from './unites.ts';

export { elevationToSvg, type SvgOptions } from './export/svg.ts';

// LES MENTIONS DU DEVIS sont un TYPE, et il est réexporté ici parce que
// c'est l'hôte qui les fournit — le cœur ne peut pas les inventer.
// `export type` et non `export { type … }` : la seconde forme laisse
// l'import à l'exécution, et ramènerait l'écrivain PDF dans l'entrée.
export type { MentionsLegales, OptionsDevis } from './export/pdf.ts';

// `computeGeometry3D` N'EST PAS reexporte ici, et c'est delibere — la meme
// raison que le plan de masse, le devis PDF et le guide de cotes. L'index
// est ce que le widget charge d'emblee ; le maillage pese 12,9 ko gzippes
// et ne sert qu'aux ecrans 3D et RA. Il s'importe par son chemin :
// `@ahjc/core/src/geometry3d.ts`, ou par le chargeur `volume()` du
// module de famille, qui est la porte prevue.
//
// Le tonneau le portait jusqu'au lot 7.5. Rollup le retirait bien du
// chargement initial en production — mais un seul import depuis le widget
// l'y aurait ramene sans que rien ne le crie.
// `export type { … }` et non `export { type … }` : la seconde forme laisse
// esbuild conserver le specificateur « au cas ou le module aurait des effets
// de bord », et le serveur de developpement allait donc chercher
// `geometry3d.ts` pour n'en tirer que des types. Mesure a l'appui — c'est
// cette ligne, et elle seule, qui restait.
export type {
  Geometry3D,
  Matiere3D,
  ModeOuvrant,
  Ouvrant,
  Piece,
  Point3,
  RolePiece,
} from './geometry3d.ts';

// Le TYPE `Maillage` reste public — la scène three.js le lit pour convertir
// un maillage en `BufferGeometry`, et un type ne pèse rien. Les quatre
// FONCTIONS qui l'accompagnaient (`trianguler`, `deduplique`,
// `compterTriangles`, `boiteEnglobante`) sont parties : leur seul appelant
// est `geometry3d.ts`, qui est déjà à la demande. Les réexporter ici
// tirait tout `maillage.ts` dans le chargement initial pour un
// configurateur 2D qui ne triangule rien.
//
// `export type { … }` et non `export { type … }` : la seconde forme laisse
// esbuild garder le specificateur, et le serveur de développement irait
// chercher le module pour n'en tirer qu'un type. C'est la leçon déjà
// apprise sur `Geometry3D`, quinze lignes plus haut.
export type { Maillage } from './geometrie/maillage.ts';

export {
  cotesProfils,
  profilBarreauPortail,
  profilBarreVolet,
  profilLamePleine,
  profilLamePortail,
  profilPoteau,
  profilTubePortail,
  type CotesProfils,
} from './geometrie/profils.ts';
export {
  FORMES_CINTREES,
  FORMES_CLOSES,
  boiteContour,
  developpeMm,
  flecheEffective,
  flecheParDefaut,
  offsetContour,
} from './geometrie/formes.ts';

export { computeCoupe, coupeToSvg, type CoupeProfil } from './export/coupe.ts';

export { countErrors, validateConfiguration } from './validate.ts';

// NI `telemetrie.ts`, NI `versions.ts`, NI `export/erp.ts` ne sont
// réexportés ici, et pour trois raisons distinctes :
//
//   - la TÉLÉMÉTRIE s'agrège côté marchand, jamais dans le navigateur du
//     client. Le widget ÉMET (`HostContext.onEvenement`, une fonction que
//     l'hôte fournit ou pas) ; c'est un tableau de bord qui importe
//     `telemetrie.ts` pour lire un journal ;
//   - le REGISTRE DE VERSIONS sert à refaire un vieux devis, ce qu'un
//     client ne fait jamais — il en demande un neuf. C'est un outil de
//     back-office ;
//   - les EXPORTS ERP suivent le manifeste et la nomenclature, déjà hors de
//     l'entrée pour la même raison : un client qui configure ne télécharge
//     pas le format XML de l'ERP de son marchand.
//
// Chacun s'importe par son chemin, depuis l'écran qui en a l'usage.

export { nommerMateriau, nommerVantaux, nommerZoneVent } from './libelles.ts';

export {
  arrondiCommercialCents,
  combineMilliemes,
  computePrice,
  finaliser,
  ValeurInconnueError,
  valeursInconnues,
} from './pricing.ts';
