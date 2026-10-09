
/** Les cinq produits que le mot « moustiquaire » recouvre. */
export type TypeMoustiquaire =
  | 'enroulable-verticale'
  | 'enroulable-laterale'
  | 'cadre-fixe'
  | 'plissee'
  | 'coulissante';

/**
 * LE TYPE DÉCIDE DE TOUT, et c'est la troisième différence que le module de
 * la moustiquaire énumère : une enroulable verticale a un coffre et deux
 * coulisses, un cadre fixe n'a ni l'un ni l'autre et se clipse, une plissée
 * se replie en accordéon. Ce ne sont pas des finitions, ce sont trois
 * produits — et la nomenclature en fabrique deux anatomies distinctes.
 */
export const TYPES_MOUSTIQUAIRE: Array<{
  id: TypeMoustiquaire;
  nom: string;
  argument: string;
}> = [
  {
    id: 'enroulable-verticale',
    nom: 'Enroulable verticale',
    argument: 'Elle disparaît dans son coffre l’hiver — le produit le plus vendu en fenêtre.',
  },
  {
    id: 'enroulable-laterale',
    nom: 'Enroulable latérale',
    argument: 'Pour une porte : la toile se tire de côté, on passe sans se baisser.',
  },
  {
    id: 'cadre-fixe',
    nom: 'Cadre fixe',
    argument: 'Clipsé ou aimanté, démontable en dix secondes. Le moins cher, et le plus durable.',
  },
  {
    id: 'plissee',
    nom: 'Plissée',
    argument: 'Elle se replie en accordéon, sans ressort — pour les grandes largeurs.',
  },
  {
    id: 'coulissante',
    nom: 'Coulissante',
    argument: 'Sur rail, devant une baie : elle suit le vantail qu’elle protège.',
  },
];

/** Les quatre mécanismes que le mot « store intérieur » recouvre. */
export type TypeStoreInterieur = 'venitien' | 'enrouleur' | 'californien' | 'plisse';

export const TYPES_STORE_INTERIEUR: Array<{
  id: TypeStoreInterieur;
  nom: string;
  argument: string;
}> = [
  {
    id: 'venitien',
    nom: 'Vénitien à lames',
    argument:
      'Les lames s’orientent : on règle la lumière sans fermer. Le store intérieur le plus vendu d’Europe.',
  },
  {
    id: 'enrouleur',
    nom: 'Enrouleur à toile',
    argument: 'Une toile, un tube, rien qui dépasse. C’est l’occultation la plus simple et la moins chère.',
  },
  {
    id: 'californien',
    nom: 'Californien à bandes',
    argument:
      'Des bandes verticales qui pivotent et se rangent d’un côté — pour une baie large, là où un vénitien pèserait trop.',
  },
  {
    id: 'plisse',
    nom: 'Plissé',
    argument:
      'Guidé par câbles, il tient à n’importe quelle hauteur — et il se pose dans une fenêtre de toit inclinée.',
  },
];

/**
 * LES TOILES D'UN ENROULEUR, et ce qu'elles font VRAIMENT.
 *
 * Le `screen` est le piège : il est technique, il est cher, il est beau —
 * et il N'OCCULTE PAS. Il filtre, en laissant voir dehors. Un client qui en
 * commande un pour une chambre commande la mauvaise chose, et c'est la
 * première réclamation du métier sur ce produit.
 */
export const TOILES = {
  occultant: { nom: 'Occultant', occulte: true, argument: 'Le noir complet — chambre, salle de projection.' },
  tamisant: {
    nom: 'Tamisant',
    occulte: false,
    argument: 'Il adoucit la lumière sans l’arrêter, et on ne voit plus dedans depuis la rue.',
  },
  screen: {
    nom: 'Screen',
    occulte: false,
    argument:
      'Il filtre le soleil ET laisse voir dehors — c’est un store de bureau ou de séjour, pas de chambre.',
  },
} as const;

export type Toile = keyof typeof TOILES;

/** Les largeurs de lame d'un vénitien, en mm, et leur caisson. */
export const LAMES_VENITIEN = [
  { largeurMm: 15, caissonMm: 25 },
  { largeurMm: 16, caissonMm: 25 },
  { largeurMm: 25, caissonMm: 25 },
  { largeurMm: 50, caissonMm: 57 },
] as const;
