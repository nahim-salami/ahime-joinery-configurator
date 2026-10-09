
import type { ContexteDessin, ModuleFamille } from './registre.ts';
import { CATALOGUE } from './vitrees/catalogue.ts';
import { elevationVitree } from './vitrees/dessin.ts';
import { contourForme } from '../geometrie/contours.ts';
import { reglesDeForme } from './partages/formes.ts';
import {
  CATALOGUE_FENETRE_TOIT,
  corrigerLeDessinDeLaFenetreDeToit,
  nomenclatureFenetreDeToit,
  reglesFenetreDeToit,
} from './vitrees/fenetre-toit.ts';
import { reglesDeLevage } from './vitrees/levage.ts';
import { reglesDuBlocBaie } from './vitrees/bloc-baie-sur-la-fenetre.ts';

function dessin({
  config,
  catalog,
  bandeMm,
  dormantVuMm,
  battementMm,
  rects,
  lines,
  poignees,
  disques,
}: ContexteDessin): void {
  elevationVitree(
    config,
    catalog,
    { bandeMm, dormantVuMm, battementMm },
    rects,
    lines,
    poignees,
    disques,
  );
  // UNE FENÊTRE DE TOIT N'EST PAS UNE FENÊTRE COUCHÉE. Le tracé commun la
  // sortait en frappe — V sur un montant, poignée latérale à mi-hauteur,
  // paumelles le long de l'autre montant. Elle pivote sur un axe horizontal
  // médian et se commande par une barre en tête. Sa correction vit dans son
  // propre fichier, avec sa liste de différences.
  if (config.famille === 'fenetre-toit') {
    corrigerLeDessinDeLaFenetreDeToit({ rects, lines, poignees });
  }
}

export const MODULE: ModuleFamille = {
  groupe: 'vitrees',
  marque: 'ahjc:module-de-famille:vitrees',
  // La fenêtre de toit s'ajoute ICI, avec son propre fichier : ses codes de
  // dimension, ses seuils d'aide et ses refus lui sont propres, et les
  // mélanger aux fenêtres verticales aurait recommencé la faute que sa
  // liste de différences dénonce.
  catalogue: { ...CATALOGUE, 'fenetre-toit': CATALOGUE_FENETRE_TOIT },
  contourDeForme: contourForme,
  // LES REFUS DE FORME — ils suivent le tracé, et pour la même raison :
  // une menuiserie rectangulaire n'en oppose aucun. Voir
  // `familles/partages/formes.ts`.
  // LA NOMENCLATURE DE LA FENÊTRE DE TOIT, et d'elle seule dans ce groupe.
  // Les quatre autres familles vitrées se FABRIQUENT — dormant, ouvrant,
  // vitrage — et le modèle générique est exactement le leur. La fenêtre de
  // toit, elle, s'ACHÈTE par code : sa liste est une liste de commande, pas
  // une liste de débit.
  nomenclature: (contexte) => nomenclatureFenetreDeToit(contexte),
  regles: (contexte) => [
    ...reglesDeForme(contexte),
    ...reglesFenetreDeToit(contexte),
    // LE COULISSANT À LEVAGE (lot MT1a). Ses règles descendent ici pour la
    // raison qui a fait descendre celles de la fenêtre de toit : elles ne
    // valent que pour une ouverture de ce groupe, et l'entrée n'a pas à
    // porter une enveloppe de cotes Schüco.
    ...reglesDeLevage(contexte),
    // LE BLOC-BAIE (lot O10) : ce que son coffre prend sur la hauteur
    // commandée. La règle descend ici pour la raison des deux précédentes —
    // elle ne vaut que pour une option de ce groupe, et l'entrée n'a pas à
    // porter la spirale d'enroulement d'un tablier.
    ...reglesDuBlocBaie(contexte),
  ],
  // LES MODÈLES DE PORTE D'ENTRÉE. Ils vivaient dans `catalog.ts`, donc
  // dans le chargement initial : un visiteur venu configurer une fenêtre
  // téléchargeait le panneau vitré, la traverse et leurs arguments de vente
  // sans jamais les voir. Ils voyagent maintenant avec le groupe qui les
  // vend, comme les déductions du lot 0 avant eux.
  modelesPorte: [
    {
      id: 'unie',
      nom: 'Panneau uni',
      coefMilliemes: 1000,
      decor: {},
      argument: 'La surface lisse, sans reprise — la plus sobre et la moins chère.',
    },
    {
      id: 'trois-panneaux',
      nom: 'Trois panneaux en creux',
      coefMilliemes: 1060,
      decor: { panneaux: 3 },
      argument: 'Le dessin classique de la porte de maison, en trois registres.',
    },
    {
      id: 'moulures',
      nom: 'Deux panneaux à moulures',
      coefMilliemes: 1090,
      decor: { panneaux: 2, moulures: 1 },
      argument: "L'encadrement en relief autour de chaque panneau — le style ancien.",
    },
    {
      id: 'rainures',
      nom: 'Rainures verticales',
      coefMilliemes: 1040,
      decor: { rainures: 4 },
      argument: 'Quatre traits fraisés dans la masse : contemporain et discret.',
    },
    {
      id: 'inserts-inox',
      nom: 'Inserts inox horizontaux',
      coefMilliemes: 1130,
      decor: { insertsInox: 4 },
      argument: "Les barres d'acier brossé en applique — la porte contemporaine.",
    },
    {
      id: 'rainures-inox',
      nom: 'Rainures et inserts inox',
      coefMilliemes: 1180,
      decor: { rainures: 2, insertsInox: 3 },
      argument: 'Le haut de gamme contemporain : le fraisage ET le métal.',
    },
  ],
  dessin,
  // Le maillage n'arrive QUE si un ecran le regarde. Voir `ModuleFamille.volume`.
  // LOT D16e : les options qui se voient, la serrure, le store intégré et le bloc-baie
  // se posent dans le volume du groupe, qui s'enregistre en étant importé. Sans lui
  // une fenêtre ne casse rien : elle OUBLIE ses pièces.
  volume: async () => {
    const [moteur] = await Promise.all([import('../geometry3d.ts'), import('./vitrees/volume.ts')]);
    return moteur.computeGeometry3D;
  },
};
