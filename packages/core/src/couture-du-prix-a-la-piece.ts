/**
 * Pourquoi ce fichier existe : LE VERROU DU BUNDLE A REFUSÉ LE LOT Z0, et il
 * avait raison.
 *
 * `prix-a-la-piece.ts` est importé par `pricing.ts` et par `validate.ts`, qui
 * sont tous deux dans le CHARGEMENT INITIAL. Le module y entrait donc avec
 * eux : le chargement initial passait de 89,5 à 90,7 ko gzippés pour un
 * budget de 90,0. Un kilo-octet et deux dixièmes payés par tout visiteur venu
 * configurer une fenêtre, pour une façon de tarifer qu'AUCUNE famille du
 * catalogue par défaut n'emploie encore.
 *
 * SOLUTION ÉCARTÉE : monter le budget d'entrée. C'est la borne la plus dure
 * du dépôt — celle que le lot B1 a DESCENDUE de 97 à 90 —, et la monter pour
 * une capacité qui n'a pas un seul appelant aurait été le contraire exact de
 * ce qu'elle protège. Le budget est un verrou, pas un objectif.
 *
 * DEUXIÈME SOLUTION ÉCARTÉE : rendre `computePrice()` asynchrone pour qu'il
 * attende son module. C'est la solution que `familles/registre.ts` avait déjà
 * écartée en son temps, et pour les mêmes raisons : les 41 golden configs, le
 * harnais de parité et le portage PHP n'ont pas d'`await` à offrir.
 *
 * CE FICHIER EST DONC LA COUTURE, sur le patron EXACT de `contourDeForme` et
 * de `volume3D` (`familles/registre.ts`) : le cœur appelle un emplacement,
 * et le module qui vend la marchandise le remplit en arrivant. Le
 * chargement initial ne porte que l'emplacement — quelques lignes.
 *
 * Le calcul s'enregistre par le SEUL FAIT d'importer `prix-a-la-piece.ts` :
 * une famille vendue à la pièce arrive dans un module paresseux, ce module
 * importe la somme des postes, et l'emplacement se remplit au même moment
 * que le catalogue de la famille. Rien à appeler, rien à oublier.
 *
 * ET SI PERSONNE NE L'A REMPLI, LE PRIX NE S'INVENTE PAS : `sommeSiChargee`
 * rend `null`, et l'appelant en fait un refus qui NOMME le module manquant.
 * C'est la contrepartie déjà assumée par le registre des familles — « un
 * appelant qui demande le prix d'un volet roulant sans avoir chargé son
 * module obtient un refus explicite, jamais un prix faux ».
 */

import type { FamilleCatalog, PricingCatalog } from './catalog.ts';
import type { JoineryConfiguration, PriceResult, ValidationIssue } from './types.ts';

/**
 * LES DEUX EMPLACEMENTS, et ils sont GROS à dessein : le prix ENTIER et les
 * refus ENTIERS, pas seulement la somme des postes.
 *
 * Une première couture ne portait que `sommeDesPostes`, et laissait dans le
 * chargement initial la boucle des options, l'écriture des refus et leurs
 * phrases. Mesuré : 90,2 ko pour 90,0 — toujours refusé. Une couture qui
 * laisse la moitié du travail derrière elle ne coud rien. Un TYPE, lui, ne
 * pèse pas un octet.
 */
export interface PrixALaPiece {
  /**
   * L'EMPREINTE du module, retenue ICI pour qu'elle SURVIVE à la construction.
   *
   * Une première rédaction l'exportait comme une constante que personne ne
   * lisait : elle était secouée de l'arbre, et le garde-fou de
   * `verifier-bundle.mjs` cherchait dans l'entrée une chaîne qui n'existait
   * nulle part — vert pour toujours. Le vérifier a coûté une construction ;
   * ne pas le vérifier aurait coûté le verrou.
   */
  marque: 'ahjc:prix-a-la-piece:module-paresseux';
  prix: (
    config: JoineryConfiguration,
    fam: FamilleCatalog,
    catalog: PricingCatalog,
  ) => PriceResult;
  refus: (fam: FamilleCatalog, config: JoineryConfiguration) => ValidationIssue[];
}

let charge: PrixALaPiece | null = null;

/** L'empreinte du module chargé — lue, donc conservée par le constructeur. */
export function marqueDuPrixALaPiece(): string | null {
  return charge === null ? null : charge.marque;
}

/**
 * Appelée par `prix-a-la-piece.ts` à son chargement. Elle n'est PAS destinée
 * à être appelée à la main : l'import suffit, et c'est ce qui empêche
 * qu'on l'oublie.
 */
export function enregistrerLePrixALaPiece(implementation: PrixALaPiece): void {
  charge = implementation;
}

/** Le prix si le module est là, `null` sinon — jamais zéro inventé. */
export function prixALaPieceSiCharge(
  config: JoineryConfiguration,
  fam: FamilleCatalog,
  catalog: PricingCatalog,
): PriceResult | null {
  return charge === null ? null : charge.prix(config, fam, catalog);
}

/**
 * Les refus des postes si le module est là ; sinon LE refus du module
 * manquant, qui nomme ce qu'il faut charger.
 */
export function refusDesPostesSiCharge(
  fam: FamilleCatalog,
  config: JoineryConfiguration,
): ValidationIssue[] {
  if (charge === null) {
    return [{ code: 'module-des-postes-absent', severite: 'erreur', message: MODULE_DES_POSTES_ABSENT }];
  }
  return charge.refus(fam, config);
}

/**
 * La phrase du module manquant. Elle vit ici parce qu'elle est le pendant du
 * refus de `familles/registre.ts` : elle nomme ce qu'il faut charger, jamais
 * un montant.
 */
/**
 * ELLE A ÉTÉ RACCOURCIE AU LOT C11b, et c'est ce qu'il a RENDU pour tenir la
 * borne d'entrée. Rien de ce qu'un test exige n'a bougé : le CODE reste
 * `module-des-postes-absent`, et c'est lui le contrat (règle du lot Z17 — « les
 * libellés ont le droit de changer, les codes n'ont pas ce droit »).
 *
 * Ce qui est parti est l'explication longue, et elle s'adresse à un
 * DÉVELOPPEUR : ce refus ne se produit que si personne n'a chargé le module du
 * groupe, c'est-à-dire jamais dans un navigateur, où le registre s'en charge.
 * Le chargement initial de tout visiteur venu configurer une fenêtre la payait.
 */
export const MODULE_DES_POSTES_ABSENT =
  'Prix à la pièce : le module des postes n’est pas chargé. Charger celui du groupe.';
