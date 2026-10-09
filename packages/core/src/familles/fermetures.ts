
import type { OptionDef } from '../catalog.ts';
import type { ContexteDessin, ModuleFamille } from './registre.ts';
import { CATALOGUE } from './fermetures/catalogue.ts';
import {
  elevationMoustiquaire,
  elevationStoreInterieur,
  elevationPorteGarage,
  elevationStore,
  elevationVoletBattant,
  elevationVoletRoulant,
} from './fermetures/dessin.ts';
import { reglesFermetures } from './fermetures/regles.ts';
import {
  CATALOGUE_PORTE_GARAGE,
  nomenclaturePorteDeGarage,
  reglesPorteGarage,
} from './fermetures/porte-garage.ts';
import {
  CATALOGUE_MOUSTIQUAIRE,
  nomenclatureMoustiquaire,
  reglesMoustiquaire,
} from './fermetures/moustiquaire.ts';
import { nomenclatureVoletBattant } from './fermetures/volet-battant.ts';
import { nomenclatureVoletRoulant } from './fermetures/volet-roulant.ts';
import {
  CATALOGUE_STORE_INTERIEUR,
  reglesStoreInterieur,
} from './fermetures/store-interieur.ts';

/** Le capteur vent : la seule option que seules les fermetures vendent. */
const OPTIONS: OptionDef[] = [
  {
    // Le VERROU AUTOMATIQUE : deux crochets dans le coffre qui bloquent le
    // tablier dès qu'il est baissé. C'est l'anti-effraction du volet
    // roulant — sans lui, un tablier se soulève à la main depuis la rue.
    //
    // Il ne se DESSINE pas, et c'est délibéré : il vit à l'intérieur du
    // caisson, invisible du dehors comme du dedans. Lui fabriquer une
    // représentation serait montrer au client une pièce qu'il ne verra
    // jamais — un test vérifie qu'il n'ajoute aucune géométrie.
    id: 'verrou-automatique',
    label: 'Verrou automatique anti-relevage',
    amountCents: 7400,
    unite: 'parMenuiserie',
    familles: ['volet-roulant'],
  },
  {
    id: 'capteur-vent',
    label: 'Capteur vent',
    amountCents: 9800,
    unite: 'parMenuiserie',
    familles: ['store-banne'],
  },
];

function dessin({ config, catalog, rects, lines }: ContexteDessin): void {
  if (config.famille === 'volet-roulant') elevationVoletRoulant(config, catalog, rects, lines);
  else if (config.famille === 'volet-battant') elevationVoletBattant(config, catalog, rects, lines);
  else if (config.famille === 'porte-garage') elevationPorteGarage(config, rects, lines);
  else if (config.famille === 'moustiquaire') elevationMoustiquaire(config, rects, lines);
  else if (config.famille === 'store-interieur') elevationStoreInterieur(config, rects, lines);
  else elevationStore(config, rects, lines);
}

export const MODULE: ModuleFamille = {
  groupe: 'fermetures',
  marque: 'ahjc:module-de-famille:fermetures',
  // La porte de garage s'ajoute ICI et pas dans `fermetures/catalogue.ts` :
  // elle a son propre fichier parce qu'elle a ses propres cotes de MUR, sa
  // propre déduction de panneaux et ses propres refus. La mélanger aux
  // volets aurait recommencé la faute que sa liste de différences dénonce.
  catalogue: {
    ...CATALOGUE,
    'porte-garage': CATALOGUE_PORTE_GARAGE,
    moustiquaire: CATALOGUE_MOUSTIQUAIRE,
    'store-interieur': CATALOGUE_STORE_INTERIEUR,
  },
  options: OPTIONS,
  // LES MODÈLES DE VOLET BATTANT — persienné, plein à barres et écharpe,
  // mi-persienné. Ils vivaient dans `catalog.ts`, donc dans le chargement
  // initial : un visiteur venu configurer une fenêtre les téléchargeait
  // que les déductions du lot 0 — la donnée d'une famille voyage avec sa
  // famille.
  modelesVolet: [
    {
      id: 'persienne',
      nom: 'Persienné',
      coefMilliemes: 1000,
      decor: { persiennePart: 1 },
      argument: "Les lames inclinées laissent passer l'air et arrêtent la pluie — le volet du Sud.",
    },
    {
      id: 'plein-barre-echarpe',
      nom: 'Plein, à barres et écharpe',
      coefMilliemes: 940,
      decor: { persiennePart: 0, barres: 2, echarpe: true },
      argument:
        "Des planches jointives, deux barres et l'écharpe qui les tient — le volet de campagne, et le moins cher à fabriquer.",
    },
    {
      id: 'mi-persienne',
      nom: 'Mi-plein, persienné en partie haute',
      coefMilliemes: 1030,
      decor: { persiennePart: 0.55, barres: 1, echarpe: true },
      argument: "Plein en bas pour l'intimité, persienné en haut pour l'air — deux ouvrages en un.",
    },
  ],
  // LE REFUS PROPRE AUX FERMETURES — la manivelle d'un volet motorisé.
  // Voir l'en-tête de `fermetures/regles.ts`.
  // LES NOMENCLATURES DE CE GROUPE — deux écrites, trois à venir.
  //
  // La moustiquaire et le volet battant apportent la leur ; chacune rend
  // `null` pour les autres familles, et la première qui répond gagne. Le
  // volet ROULANT, le store banne et la porte de garage attendent encore :
  // un tablier de lames avec son pas d'empilage, une toile sur bras, des
  // panneaux et des rails. Ce qui leur manque n'est pas ce mécanisme, c'est
  // de la donnée — `docs/23-nomenclatures-manquantes.md` la nomme, avec qui
  // la détient.
  nomenclature: (contexte) =>
    nomenclatureMoustiquaire(contexte) ??
    nomenclatureVoletBattant(contexte) ??
    nomenclatureVoletRoulant(contexte) ??
    nomenclaturePorteDeGarage(contexte),
  regles: (contexte) => [
    ...reglesFermetures(contexte),
    ...reglesPorteGarage(contexte),
    ...reglesMoustiquaire(contexte),
    ...reglesStoreInterieur(contexte),
  ],
  dessin,
  // L'AVANCÉE D'UN STORE BANNE SE COTE « avancée », pas « hauteur » : c'est une
  // projection depuis le mur, et le client la lit ainsi sur tout catalogue.
  // Ces trois lignes vivaient dans `drawing.ts`, c'est-à-dire dans le
  // chargement initial ; elles sont descendues avec la couture des cotes.
  cotes: ({ config, cotes }) => {
    if (config.famille !== 'store-banne') return;
    cotes[1].label = `avancée ${config.heightMm} mm`;
    cotes[1].prefixe = 'avancée ';
  },
  // Le volume vient du cœur, mais il n'est ATTEINT que d'ici : c'est ainsi
  // que `geometry3d.ts` et toute la pile de maillage quittent l'entrée sans
  // qu'une ligne de leur code ne bouge.
  // Le maillage n'arrive QUE si un ecran le regarde. Voir `ModuleFamille.volume`.
  // LE VOLUME DU STORE BANNE NE DESCEND PLUS AVEC LE MOTEUR (lot D16b). Ce
  // thunk charge le moteur ET le volume du groupe ; le module s'enregistre en
  // étant importé, et `computeGeometry3D` reste synchrone parce que
  // l'appelant attend déjà ce thunk. Sans lui, un store banne retombe dans le
  // chemin générique — il ne casse pas, il dessine un châssis de fenêtre.
  volume: async () => {
    const [moteur] = await Promise.all([
      import('../geometry3d.ts'),
      import('./fermetures/volume.ts'),
    ]);
    return moteur.computeGeometry3D;
  },
};
