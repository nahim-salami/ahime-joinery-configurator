/**
 * Pourquoi ce fichier existe : la NOMENCLATURE d'un volet roulant — son
 * coffre, ses deux coulisses, son tablier de lames, sa lame finale, son tube
 * et sa manœuvre.
 *
 * CE QU'UN VOLET ROULANT N'EST PAS : un ouvrant. Il n'a ni cadre d'onglet ni
 * feuillure ; son « vantail » est un TABLIER, c'est-à-dire un empilement de
 * lames articulées qui s'enroule autour d'un tube. Le modèle générique de la
 * fenêtre lui réclamait un cadre d'ouvrant, et refusait son dossier de
 * fabrication.
 *
 * TOUTES LES COTES SONT DÉJÀ DANS LE DÉPÔT, et c'est ce qui a permis
 * d'écrire ce fichier : la lame de 41 mm et le tube de 60 vivent dans
 * `geometrie/profils.ts`, où `hauteurCoffreMm()` calcule la spirale
 * d'enroulement ; la coulisse de 55 et la lame finale de 66 étaient dans le
 * dessin. Elles ont été NOMMÉES et partagées plutôt que recopiées — deux
 * nombres pour la même pièce dans la même famille, c'est ainsi qu'un dessin
 * et un débit finissent par ne plus parler du même volet.
 *
 * LA LAME FINALE N'EST PAS UNE LAME DE PLUS. Elle est plus haute, plus
 * épaisse, elle porte le joint qui bute sur le seuil et les BUTÉES qui
 * l'empêchent d'entrer dans le coffre. Un tablier qui s'enroulerait
 * entièrement ne se rattraperait plus d'en bas — et c'est une intervention
 * de dépose complète.
 */

import type { JoineryConfiguration } from '../../types.ts';
import type { LigneNomenclature } from '../../export/nomenclature.ts';
import { coffreDe, manoeuvreDe, type PricingCatalog } from '../../catalog.ts';
import { coffreDuVoletMm, lameDuVoletMm } from '../../lames-de-volet.ts';
import {
  COULISSE_VOLET_MM,
  LAME_FINALE_VOLET_MM,
  TUBE_VOLET_MM,
} from '../../geometrie/profils.ts';

/**
 * LA NOMENCLATURE D'UN VOLET ROULANT.
 *
 * Elle rend `null` pour les autres familles du groupe : un volet battant n'a
 * pas de tube, une moustiquaire pas de lame finale.
 */
export function nomenclatureVoletRoulant(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
  repere: string;
}): { lignes: LigneNomenclature[]; lacunes: string[] } | null {
  const { config, catalog } = contexte;
  if (config.famille !== 'volet-roulant') return null;

  const lignes: LigneNomenclature[] = [];
  const lacunes: string[] = [];
  const teinte = config.couleur;
  const gamme = `vr-${config.materiau}`;
  const largeurMm = Math.round(config.widthMm);
  const hauteurMm = Math.round(config.heightMm);

  // LE COFFRE. Sa hauteur sort de la SPIRALE d'enroulement, jamais d'une
  // fraction de la hauteur : c'est le rouleau qui décide, et il grossit avec
  // la longueur de tablier.
  //
  // UN COFFRE TUNNEL EST MAÇONNÉ dans le linteau : il ne se commande pas
  // avec le volet, et le compter dans le débit ferait payer deux fois une
  // pièce que le maçon a posée.
  const typeCoffre = coffreDe(catalog, config.famille, config.coffre) ?? 'exterieur';
  // LA HAUTEUR DE COFFRE VIENT DE LA SEULE FONCTION QUI LA CONNAISSE depuis
  // le lot O5 — `coffreDuVoletMm()`, que le dessin et l'écran appellent
  // aussi. Elle lit la taille de lame déclarée : un débit qui commanderait un
  // coffre de 205 pour un dessin de 250 est un débit faux, et il se signe.
  const hauteurCoffre = coffreDuVoletMm(config);
  const lameMm = lameDuVoletMm(config);
  if (typeCoffre === 'tunnel') {
    lignes.push({
      categorie: 'accessoire',
      reference: `${gamme}-joues-tunnel`,
      designation: `Joues et sous-face pour coffre tunnel de ${hauteurCoffre} mm`,
      quantite: 1,
      unite: 'piece',
      teinte,
      regle: 'le caisson tunnel est maçonné — seules les joues et la sous-face se commandent',
    });
  } else {
    lignes.push({
      categorie: 'profil',
      reference: `${gamme}-coffre-${hauteurCoffre}`,
      designation: `Coffre ${typeCoffre} de ${hauteurCoffre} mm, joues et sous-face comprises`,
      quantite: 1,
      unite: 'piece',
      longueurMm: largeurMm,
      coupesDeg: [90, 90],
      teinte,
      regle: `diamètre d’enroulement de ${hauteurMm} mm de tablier sur un tube de ${TUBE_VOLET_MM} mm`,
    });
  }

  // --- LES COULISSES. Elles descendent du coffre au seuil.
  const hauteurCoulisse = Math.max(0, hauteurMm - (typeCoffre === 'tunnel' ? 0 : hauteurCoffre));
  lignes.push({
    categorie: 'profil',
    reference: `${gamme}-coulisse-${COULISSE_VOLET_MM}`,
    designation: `Coulisse ${COULISSE_VOLET_MM} mm, joint brosse intégré`,
    quantite: 2,
    unite: 'piece',
    longueurMm: hauteurCoulisse,
    coupesDeg: [90, 90],
    teinte,
    regle:
      typeCoffre === 'tunnel'
        ? 'hauteur hors tout — un coffre tunnel est dans le linteau, les coulisses descendent de dessous'
        : 'hauteur hors tout moins la hauteur du coffre',
  });

  // --- LE TABLIER. Le nombre de lames est la hauteur DÉPLOYÉE divisée par la
  // lame — la même cote de 41 mm que la spirale du coffre emploie.
  const hauteurTablier = Math.max(0, hauteurCoulisse - LAME_FINALE_VOLET_MM);
  const lames = Math.max(1, Math.ceil(hauteurTablier / lameMm));
  // LA LARGEUR DE LAME EST CELLE DU PASSAGE ENTRE COULISSES. Ce que la lame
  // engage DANS la rainure s'ajoute chez le gammiste, qui seul connaît la
  // profondeur de sa coulisse — et une lame trop courte sort de son rail au
  // premier coup de vent.
  const largeurTablier = Math.max(0, largeurMm - 2 * COULISSE_VOLET_MM);
  lignes.push({
    categorie: 'profil',
    reference: `${gamme}-lame-${lameMm}`,
    designation: `Lame de tablier ${lameMm} mm, agrafée`,
    quantite: lames,
    unite: 'piece',
    longueurMm: largeurTablier,
    coupesDeg: [90, 90],
    teinte,
    regle:
      `hauteur de tablier divisée par la lame de ${lameMm} mm ; ` +
      'largeur entre coulisses — l’engagement en rainure s’ajoute chez le gammiste',
  });
  lignes.push({
    categorie: 'profil',
    reference: `${gamme}-lame-finale-${LAME_FINALE_VOLET_MM}`,
    designation: `Lame finale ${LAME_FINALE_VOLET_MM} mm, joint de seuil et butées`,
    quantite: 1,
    unite: 'piece',
    longueurMm: largeurTablier,
    coupesDeg: [90, 90],
    teinte,
    regle: 'une par volet — ses butées empêchent le tablier d’entrer entièrement dans le coffre',
  });

  // --- LE TUBE ET SES ATTACHES. Les attaches sont ce qui relie le tablier au
  // tube ; sur un volet motorisé elles sont ANTI-CHUTE, et ce n'est pas une
  // option : c'est ce qui empêche le tablier de tomber si le moteur lâche.
  lignes.push({
    categorie: 'accessoire',
    reference: `${gamme}-tube-${TUBE_VOLET_MM}`,
    designation: `Tube d’enroulement octogonal ${TUBE_VOLET_MM} mm`,
    quantite: 1,
    unite: 'piece',
    longueurMm: largeurTablier,
    regle: 'largeur entre coulisses',
  });
  const motorise =
    config.motorisation !== undefined ||
    (config.options ?? []).some((option) => String(option.id).startsWith('motorisation-'));
  lignes.push({
    categorie: 'quincaillerie',
    reference: `${gamme}-attaches${motorise ? '-antichute' : ''}`,
    designation: motorise
      ? 'Attaches tablier ANTI-CHUTE, verrous automatiques'
      : 'Attaches tablier souples',
    // Une attache tous les cinq cents millimètres, deux au moins : c'est ce
    // qui empêche le tablier de gondoler entre deux points d'accroche.
    quantite: Math.max(2, Math.ceil(largeurTablier / 500)),
    unite: 'piece',
    regle: motorise
      ? 'une tous les 500 mm — anti-chute sur un volet motorisé : sans elles le tablier tombe si le moteur lâche'
      : 'une tous les 500 mm de largeur de tablier, deux au minimum',
  });

  // --- LA MANŒUVRE. Un volet motorisé n'a ni sangle ni manivelle : la
  // facturer serait vendre deux fois la même fonction, et c'est déjà la
  // règle du prix.
  if (motorise) {
    lignes.push({
      categorie: 'quincaillerie',
      reference: `${gamme}-moteur`,
      designation: 'Moteur tubulaire, support et fins de course',
      quantite: 1,
      unite: 'piece',
      regle: 'un par volet — il se loge dans le tube',
    });
  } else {
    const manoeuvre = manoeuvreDe(catalog, config.famille, config.manoeuvre) ?? 'sangle';
    lignes.push({
      categorie: 'quincaillerie',
      reference: `${gamme}-manoeuvre-${manoeuvre}`,
      designation:
        manoeuvre === 'manivelle'
          ? 'Treuil, sortie de caisson et manivelle'
          : 'Enrouleur de sangle encastré, sangle et guide',
      quantite: 1,
      unite: 'piece',
      longueurMm: manoeuvre === 'manivelle' ? undefined : hauteurMm + largeurTablier,
      regle:
        manoeuvre === 'manivelle'
          ? 'un treuil par volet'
          : 'la sangle fait la hauteur plus un tour de tube',
    });
  }

  return { lignes, lacunes };
}
