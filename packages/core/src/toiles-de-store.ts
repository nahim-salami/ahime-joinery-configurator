/**
 * Pourquoi ce fichier existe : LA TOILE EST 79 À 85 % DE L'IMAGE, ET AUCUNE
 * CONFIGURATION NE LA PORTAIT — lot O9b.
 *
 * Le lot D17 l'a mesuré en pesant l'AIRE du maillage 3D : sur un store banne,
 * une moustiquaire et un screen, la toile fait **79 à 85 % de la surface
 * visible**, et **rien dans ce dépôt ne portait sa teinte** — ni le cœur, ni
 * le catalogue, ni la 2D, qui la peignait par un jeton de style
 * (`--ahjc-couleur-toile`, avec un vert d'eau pour défaut). Il concluait :
 * « c'est un lot de CATALOGUE, pas de dessin ». Celui-ci le fait.
 *
 * LE RELEVÉ CHIFFRE CE QUE CELA VAUT (docs/51 §4.5) : chez Fenetre24, le type
 * de tissu est **le premier poste de décision** d'un store banne — onze toiles
 * acryliques unies et douze rayées, nommées une par une — et c'est le seul
 * que le client regarde depuis la rue.
 *
 * CE QUI EST DÉCLARÉ ICI, ET CE QUI NE L'EST PAS.
 *
 * Les DOUZE teintes unies du relevé sont là, sous leur nom de couleur — ce
 * sont des mots communs, pas des références de marque, et c'est le NOM qu'on
 * commande. L'hexadécimal, lui, est un ÉQUIVALENT D'AFFICHAGE et rien de
 * plus : une toile acrylique teinte dans la masse n'a pas de valeur d'écran
 * exacte, elle a un grain et une translucidité. C'est mot pour mot la
 * doctrine de `teintes.ts` pour un RAL, et elle vaut ici sans changer d'un
 * iota.
 *
 * LES DOUZE RAYÉES N'Y SONT PAS, et c'est une lacune NOMMÉE : le relevé dit
 * qu'elles sont nommées une par une, et il n'en transcrit aucune. Une rayure
 * demande en plus un PAS — la largeur d'une bande —, et aucune fiche relevée
 * ne le publie : ce serait le huitième nombre que personne ne publie de ce
 * dépôt (après le couple d'un moteur tubulaire, la densité d'un panneau, le
 * coefficient de portance d'un bac, le pas minimal d'un compte, le
 * coefficient α de Roark, la charge d'une tablette et la portée d'un
 * brise-soleil). On ne dessine donc aucune rayure, et le dire vaut mieux que
 * d'en inventer une largeur.
 *
 * IL VIT À LA RACINE DU CŒUR — patron de `types-de-moustiquaire-et-de-store.ts`
 * (lot O9a) et du lot MT5 : `EtapesFermetures.tsx` et `EtapesSolaire.tsx` sont
 * des morceaux paresseux PARTAGÉS, et leur faire importer un module de groupe
 * ferait descendre ce groupe chez tous leurs visiteurs. La DÉCLARATION remonte,
 * les règles restent.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { FamilleId, JoineryConfiguration } from './types.ts';

/** Une teinte de toile — son nom se commande, son hexadécimal s'affiche. */
export interface TeinteDeToile {
  id: string;
  /** LE NOM, et c'est lui qu'on commande. */
  nom: string;
  /**
   * L'ÉQUIVALENT D'AFFICHAGE, en hexadécimal sRGB. Approximatif par nature —
   * une toile a un grain, une translucidité et un envers plus clair, et deux
   * rouleaux du même bain ne se ressemblent pas au soleil.
   */
  hex: string;
}

/**
 * LES DOUZE TOILES UNIES du relevé de Fenetre24 (docs/51 §4.5), dans l'ordre
 * où la page les donne.
 *
 * Ce sont des noms de COULEUR, pas des références de marque — le catalogue par
 * défaut de ce dépôt n'en porte aucune. Un marchand qui vend la gamme d'un
 * fabricant remplace cette liste par la sienne, avec ses références.
 */
export const TEINTES_DE_TOILE: readonly TeinteDeToile[] = [
  { id: 'gris-clair', nom: 'Gris clair', hex: '#C3C7C4' },
  { id: 'noir', nom: 'Noir', hex: '#1B1B1B' },
  { id: 'ivoire-clair', nom: 'Ivoire clair', hex: '#EDE4CF' },
  { id: 'brun', nom: 'Brun', hex: '#6B4A34' },
  { id: 'beige', nom: 'Beige', hex: '#D8C7A8' },
  { id: 'vert-fonce', nom: 'Vert foncé', hex: '#2F4B36' },
  { id: 'anthracite', nom: 'Anthracite', hex: '#3A3E41' },
  { id: 'nuances-de-gris', nom: 'Nuances de gris', hex: '#8E938F' },
  { id: 'jaune', nom: 'Jaune', hex: '#D9B23A' },
  { id: 'orange', nom: 'Orange', hex: '#C56A2C' },
  { id: 'bordeaux', nom: 'Bordeaux', hex: '#6B2431' },
  { id: 'bleu-fonce', nom: 'Bleu foncé', hex: '#2A3B5C' },
];

/**
 * LE VERT D'EAU DU DÉFAUT, et il n'est pas un choix : c'est la valeur que
 * `.ahjc-toile` et la matière `toile` de la scène 3D portaient en dur, chacune
 * de son côté et à la même valeur. Elle reste le défaut pour qu'une
 * configuration muette dessine exactement ce qu'elle dessinait.
 */
export const TOILE_PAR_DEFAUT_HEX = '#c9d3c4';

/**
 * LES QUATRE FAMILLES QUI ONT UNE TOILE, et ce n'est pas « les protections
 * solaires » : un BSO n'en a pas — il a des LAMES orientables, et c'est tout
 * son argument (lot MT2b). La liste se lit sur les DESSINS, qui sont les seuls
 * à savoir ce qu'ils posent.
 */
export const FAMILLES_A_TOILE: readonly FamilleId[] = [
  'store-banne',
  'screen-zip',
  'moustiquaire',
  'store-interieur',
];

/** La teinte retenue — le vert d'eau du défaut quand rien n'est déclaré. */
export function hexDeLaToile(config: Pick<JoineryConfiguration, 'teinteToile'>): string {
  const choisie = TEINTES_DE_TOILE.find((teinte) => teinte.id === config.teinteToile);
  return choisie?.hex ?? TOILE_PAR_DEFAUT_HEX;
}

/** Le nom de la teinte retenue, ou `null` quand rien n'est déclaré. */
export function nomDeLaToile(config: Pick<JoineryConfiguration, 'teinteToile'>): string | null {
  return TEINTES_DE_TOILE.find((teinte) => teinte.id === config.teinteToile)?.nom ?? null;
}
