
/**
 * LES COTES D'UNE SECTIONNELLE, telles que les gammistes les publient.
 *
 * `retombeeLinteauMm` est la seule cote de ce projet qui ne décrit PAS
 * l'ouvrage : elle décrit le MUR. C'est la place qu'il faut au-dessus du
 * passage pour loger l'axe, les ressorts et la courbe des rails — et si
 * elle manque, la porte n'entre pas, quelle que soit sa qualité.
 */
export const SECTIONNELLE = {
  largeurMinMm: 2000,
  largeurMaxMm: 6000,
  hauteurMaxMm: 3000,
  /** Le pas de fabrication. Une porte de garage ne se coupe pas au mm. */
  pasLargeurMm: 125,
  /** La hauteur d'un panneau. Le nombre s'en déduit, il ne se choisit pas. */
  panneauHauteurMm: 500,
  /** Les deux épaisseurs de panneau du marché — 42 courant, 67 isolé. */
  epaisseursPanneauMm: [42, 67] as const,
  retombeeLinteauMm: {
    /** La ferrure standard — la moins chère, et la plus gourmande en place. */
    standard: 100,
    /** La ferrure à retombée réduite, quand le linteau est bas. */
    reduite: 55,
    /** Le panneau isolé de 67 mm demande cinq millimètres de plus. */
    isolee: 105,
  },
  /** La place qu'il faut de CHAQUE côté, pour les rails verticaux. */
  ecoinconMinMm: 90,
  /** La profondeur libre devant, pour les rails horizontaux : H + 500. */
  profondeurSupplementaireMm: 500,
  /** Le coefficient de la porte, par épaisseur de panneau. */
  ud: { 42: 1.3, 67: 1.0 } as const,
} as const;

/**
 * LA HAUTEUR DU TABLIER — la porte elle-même, linteau déduit.
 *
 * Elle est ici, exportée, et pas recalculée à trois endroits : c'est elle
 * qui commande le nombre de panneaux, et le dessin, le volume et le message
 * de validation doivent tomber sur le MÊME nombre. Un test l'a montré :
 * compter sur la hauteur totale d'un côté et sur le tablier de l'autre
 * donne cinq panneaux dans l'info et quatre dans le dessin, sur une porte
 * de 2 060 mm — et personne ne s'en apercevrait avant l'atelier.
 */
export const CADRE_MM = 60;
