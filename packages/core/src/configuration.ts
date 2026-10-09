/**
 * Pourquoi ce fichier existe : « une configuration neuve et valide pour une
 * famille ». Trois appelants en ont besoin et n'ont rien d'autre en commun —
 * le configurateur quand le visiteur change de famille, la tuile de famille
 * qui affiche un « dès … €», et le lecteur de bordereau qui reçoit quarante
 * lignes ne portant que des cotes.
 *
 * POURQUOI IL A DÉMÉNAGÉ DANS LE CŒUR. Il vivait dans l'état du widget, et
 * c'était logique tant que seul un écran l'appelait. Le lecteur de bordereau
 * (`bordereau.ts`) l'a rendu faux : sans lui, il aurait fallu recomposer une
 * configuration à la main — un matériau, une gamme, un système, une
 * ouverture — et cette deuxième recette aurait divergé de la première au
 * premier champ ajouté au catalogue. Une configuration à demi remplie ne
 * plante pas : elle se chiffre, et elle se chiffre FAUX.
 *
 * TOUT VIENT DU CATALOGUE. Aucune dimension, aucun matériau, aucune gamme
 * n'est écrit en dur ici : les paliers sont lus dans la matrice de prix, le
 * matériau est le premier que la famille vend, le système est celui que le
 * marchand a nommé. La seule table de ce fichier est le nombre de vantaux
 * COURANT — un défaut d'affichage, pas une donnée de tarif.
 *
 * LE CAISSON (lot M1) porte 1, et ce n'est pas un vantail : un caisson est
 * un VOLUME. Ses compartiments se comptent en MONTANTS intermédiaires, qui
 * ont leur propre champ — un montant ne s'ouvre pas, et c'est lui qui porte
 * les étagères.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import { familleCatalog, systemesDuMateriau, type PricingCatalog } from './catalog.ts';
import type { FamilleId, JoineryConfiguration, Materiau } from './types.ts';

const VANTAUX_SI_PAS_UN: Partial<Record<FamilleId, number>> = {
  // La fenêtre à deux vantaux est le produit pivot du métier.
  fenetre: 2,
  'porte-fenetre': 2,
  coulissant: 2,
  'volet-battant': 2,
  'portail-battant': 2,
};


/** Une configuration neuve et valide pour une famille — tout vient du catalogue. */
export function configurationParDefaut(
  famille: FamilleId,
  catalogue: PricingCatalog,
): JoineryConfiguration {
  const fam = familleCatalog(catalogue, famille);
  const vantaux = Math.min(
    fam.bornes.vantauxMax,
    Math.max(fam.bornes.vantauxMin, VANTAUX_SI_PAS_UN[famille] ?? 1),
  );
  // UNE FAMILLE VENDUE À LA PIÈCE N'A PAS DE MATRICE (lot Z0) : ses cotes
  // par défaut viennent des bornes de FABRICATION, pas du milieu d'un
  // tableau de prix qui n'existe pas. Elles ne décident d'aucun montant —
  // c'est la somme des postes qui le fait —, mais elles doivent être
  // fabricables : une configuration neuve ne s'ouvre jamais en refus.
  const matrice = fam.matrices?.[String(vantaux)] ?? Object.values(fam.matrices ?? {})[0];
  const materiau = (Object.keys(fam.coefMateriauMilliemes) as Materiau[])[0];
  const milieu = (paliers: number[]) => paliers[Math.floor(paliers.length / 2)];

  const config: JoineryConfiguration = {
    famille,
    widthMm: matrice ? milieu(matrice.widthsMm) : fam.bornes.minWidthMm,
    heightMm: matrice ? milieu(matrice.heightsMm) : fam.bornes.minHeightMm,
    vantaux,
    materiau,
    gamme: 'standard',
    couleur: 'blanc',
  };
  // Quand le marchand a saisi ses gammes, on en choisit une d'emblée :
  // laisser aucune tuile allumée donnerait un écran qui n'a rien décidé.
  const gammes = systemesDuMateriau(catalogue, famille, materiau);
  const parDefaut = gammes.find((systeme) => systeme.gamme === 'standard') ?? gammes[0];
  if (parDefaut) {
    config.systeme = parDefaut.id;
    config.gamme = parDefaut.gamme;
  }
  if (fam.ouvertures) config.ouverture = fam.ouvertures[0];
  if (fam.vitree) config.vitrage = { base: 'double' };
  // CE QUE LA FAMILLE DÉCLARE PRIME, ET IL VIENT EN DERNIER (lot C12d). Tout
  // ce qui précède est DÉRIVÉ — le milieu d'une matrice, la première gamme, le
  // premier matériau — et un dérivé n'a rien à dire contre une déclaration.
  // C'est aussi ce qui rend le champ utilisable par une famille À LA PIÈCE,
  // qui n'a pas de matrice et retombait donc sur le plus PETIT ouvrage
  // deux fonds mangeaient les trois quarts.
  return { ...config, ...fam.defauts };
}
