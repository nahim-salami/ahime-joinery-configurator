/**
 * Pourquoi ce fichier existe : la NOMENCLATURE d'un volet battant — ses
 * lames, ses barres, son écharpe, ses pentures et ses gonds.
 *
 * CE QU'UN VOLET BATTANT N'EST PAS : un cadre à quatre barres d'onglet. Il
 * n'a ni dormant ni feuillure ; c'est un panneau de LAMES VERTICALES tenues
 * par deux ou trois barres horizontales, et une écharpe en diagonale qui
 * l'empêche de se déformer en losange. Le modèle générique de la fenêtre lui
 * réclamait un cadre d'ouvrant qu'il n'a pas, et refusait son dossier de
 * fabrication.
 *
 * TOUTES LES COTES VIENNENT DE LA FICHE FRANCE-VOLET déjà téléchargée dans
 * `ressources/donnees/familles-a-venir.json` (`voletBattantReference`) :
 * l'épaisseur de 27 mm pour un plein et de 36 pour un persienné, la largeur
 * de lame, le RECOUVREMENT — qui décide du nombre de lames et qu'on ne peut
 * pas deviner —, le battement entre deux vantaux, et le seuil de 1 740 mm à
 * partir duquel il faut une troisième penture.
 *
 * LE RECOUVREMENT EST LA COTE QUI COMPTE. Une lame de 90 mm ne couvre pas
 * 90 mm : elle en couvre 65, parce que 25 passent sous sa voisine. Compter
 * les lames sur leur largeur au lieu de leur pas donne un volet trop étroit
 * d'un cinquième — et c'est un volet à refaire, pas à recouper.
 */

import type { JoineryConfiguration } from '../../types.ts';
import type { LigneNomenclature } from '../../export/nomenclature.ts';
import { modeleVoletDe, type PricingCatalog } from '../../catalog.ts';

/**
 * LE VOLET PLEIN À LAMES VERTICALES, 27 mm — la référence du bois.
 *
 * Source : France-Volet, fiche produit « volets battants bois 27 mm ».
 */
export const LAMES_PLEIN = {
  epaisseurMm: 27,
  /** Les deux largeurs vendues. La 90 est la plus courante en neuf. */
  largeursMm: [65, 90] as const,
  /** Ce qui passe sous la lame voisine — c'est le pas qui s'en déduit. */
  recouvrementMm: 25,
  /** Le battement entre deux vantaux, sur un volet à deux ouvrants. */
  battementMm: 45,
} as const;

/**
 * LE PERSIENNÉ, 36 mm — plus épais, parce que ses lames inclinées sont
 * mortaisées dans deux montants au lieu d'être jointives.
 */
export const LAMES_PERSIENNE = {
  epaisseurMm: 36,
  recouvrementMm: 20,
  battementMm: 50,
} as const;

/**
 * LE NOMBRE DE PENTURES par vantail, et il ne se choisit pas.
 *
 * Deux jusqu'à 1 739 mm, trois à partir de 1 740. C'est le seuil de la fiche
 * fournisseur, et il tient à la flexion du panneau : passé un mètre
 * soixante-quinze, deux barres laissent le bas du volet gauchir en un été.
 */
export function nombreDePentures(hauteurMm: number): number {
  return hauteurMm >= 1740 ? 3 : 2;
}

/**
 * LE PAS D'UNE LAME — sa largeur moins ce qui passe dessous.
 *
 * C'est la seule façon honnête de compter des lames à recouvrement, et
 * l'écart avec un comptage naïf n'est pas petit : sur un vantail de 600 mm
 * en lames de 90, le pas de 65 en demande dix au lieu de sept.
 */
export function nombreDeLames(largeurVantailMm: number, largeurLameMm: number, recouvrementMm: number): number {
  const pas = Math.max(1, largeurLameMm - recouvrementMm);
  return Math.max(1, Math.ceil(largeurVantailMm / pas));
}

/**
 * LA NOMENCLATURE D'UN VOLET BATTANT.
 *
 * Elle rend `null` pour toute autre famille : le groupe des fermetures en
 * porte cinq, et une moustiquaire n'a pas de penture.
 */
export function nomenclatureVoletBattant(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
  repere: string;
}): { lignes: LigneNomenclature[]; lacunes: string[] } | null {
  const { config, catalog } = contexte;
  if (config.famille !== 'volet-battant') return null;

  const lignes: LigneNomenclature[] = [];
  const lacunes: string[] = [];
  const teinte = config.couleur;
  const gamme = `volet-${config.materiau}`;
  const vantaux = Math.max(1, Math.round(config.vantaux));
  const hauteurMm = Math.round(config.heightMm);

  // LE BATTEMENT SE DÉDUIT UNE FOIS de la largeur totale, comme sur une
  // fenêtre : un volet à deux vantaux a UN recouvrement central, pas deux.
  const modele = modeleVoletDe(catalog, config.famille, config.modeleVolet);
  const persiennePart = modele?.decor?.persiennePart ?? 1;
  const persienne = persiennePart >= 1;
  const lame = persienne ? LAMES_PERSIENNE : LAMES_PLEIN;
  const battementMm = vantaux > 1 ? lame.battementMm : 0;
  const largeurVantailMm = Math.round((config.widthMm - battementMm) / vantaux);

  if (largeurVantailMm <= 0) {
    lacunes.push(
      `largeur de ${config.widthMm} mm pour ${vantaux} vantaux : le battement de ` +
        `${battementMm} mm ne laisse rien à fabriquer`,
    );
    return { lignes, lacunes };
  }

  // --- LES LAMES. Verticales, à recouvrement, sur toute la hauteur.
  const largeurLameMm = LAMES_PLEIN.largeursMm[1];
  const compte = nombreDeLames(largeurVantailMm, largeurLameMm, lame.recouvrementMm);
  lignes.push({
    categorie: 'profil',
    reference: `${gamme}-lame-${largeurLameMm}x${lame.epaisseurMm}`,
    designation: persienne
      ? `Lame persiennée ${largeurLameMm} × ${lame.epaisseurMm} mm, inclinée et mortaisée`
      : `Lame verticale ${largeurLameMm} × ${lame.epaisseurMm} mm, à recouvrement`,
    quantite: compte * vantaux,
    unite: 'piece',
    longueurMm: hauteurMm,
    coupesDeg: [90, 90],
    teinte,
    regle:
      `largeur de vantail (${largeurVantailMm} mm) divisée par le PAS de ` +
      `${largeurLameMm - lame.recouvrementMm} mm — la lame fait ${largeurLameMm}, ` +
      `${lame.recouvrementMm} passent sous sa voisine`,
  });

  // --- LE CADRE D'UN PERSIENNÉ, et pourquoi il manque.
  //
  // Un volet PLEIN à barres et écharpe n'a pas de cadre : ce sont des
  // planches jointives que les barres tiennent, et c'est ce qui en fait le
  // moins cher à fabriquer. Un PERSIENNÉ, lui, a ses lames MORTAISÉES dans
  // deux montants et deux traverses — sans eux, ce n'est pas un volet, c'est
  // une pile de lames.
  //
  // Les sections de ce cadre ne sont pas dans la fiche fournisseur qu'on a.
  // Les inventer aurait fait débiter dessus ; on les RÉCLAME donc, et le
  // manifeste refuse le dossier d'un persienné jusque-là.
  if (persiennePart > 0) {
    lacunes.push(
      'volet persienné : les lames sont mortaisées dans un cadre — deux montants ' +
        'et deux traverses — dont les sections ne sont pas sourcées ' +
        '(voir docs/23-nomenclatures-manquantes.md)',
    );
  }

  // --- LES BARRES ET L'ÉCHARPE. Elles ne tiennent pas le volet fermé, elles
  // l'empêchent de se DÉFORMER : sans écharpe, un panneau de lames devient un
  // losange en une saison, et il frotte au gond.
  const barres = modele?.decor?.barres ?? 0;
  if (barres > 0) {
    lignes.push({
      categorie: 'profil',
      reference: `${gamme}-barre`,
      designation: 'Barre horizontale — traverse de contreventement',
      quantite: barres * vantaux,
      unite: 'piece',
      longueurMm: largeurVantailMm,
      coupesDeg: [90, 90],
      teinte,
      regle: `${barres} par vantail, au modèle « ${modele?.nom ?? ''} »`,
    });
  }
  if (modele?.decor?.echarpe) {
    // L'ÉCHARPE est la DIAGONALE du panneau : sa longueur est l'hypoténuse,
    // et la couper à la hauteur du volet la ferait trop courte de vingt
    // centimètres sur un vantail ordinaire.
    const diagonaleMm = Math.round(Math.sqrt(largeurVantailMm ** 2 + hauteurMm ** 2));
    lignes.push({
      categorie: 'profil',
      reference: `${gamme}-echarpe`,
      designation: 'Écharpe — diagonale de contreventement',
      quantite: vantaux,
      unite: 'piece',
      longueurMm: diagonaleMm,
      // Elle se coupe en biais aux deux bouts, à l'angle de la diagonale.
      coupesDeg: [
        Math.round((Math.atan2(largeurVantailMm, hauteurMm) * 180) / Math.PI),
        Math.round((Math.atan2(largeurVantailMm, hauteurMm) * 180) / Math.PI),
      ],
      teinte,
      regle: 'diagonale du vantail — hypoténuse, jamais la hauteur',
    });
  }

  // --- LES PENTURES ET LES GONDS, appairés. Le nombre vient de la HAUTEUR :
  // passé 1 740 mm, deux barres laissent le bas gauchir en un été.
  const pentures = nombreDePentures(hauteurMm);
  lignes.push({
    categorie: 'quincaillerie',
    reference: `${gamme}-penture`,
    designation: 'Penture réglable, avec sa contre-penture',
    quantite: pentures * vantaux,
    unite: 'piece',
    longueurMm: largeurVantailMm,
    teinte,
    regle: `${pentures} par vantail — trois à partir de 1 740 mm de haut`,
  });
  lignes.push({
    categorie: 'quincaillerie',
    reference: `${gamme}-gond-14`,
    designation: 'Gond à sceller Ø 14 mm',
    quantite: pentures * vantaux,
    unite: 'piece',
    regle: 'un gond par penture — ils se posent appairés',
  });

  // --- L'ARRÊT ET LE VERROU. Un volet qui n'a pas d'arrêt bat au vent, et
  // c'est ce qui casse les gonds.
  lignes.push({
    categorie: 'quincaillerie',
    reference: `${gamme}-arret`,
    designation: 'Arrêt de volet à bascule',
    quantite: vantaux,
    unite: 'piece',
    regle: 'un par vantail — sans lui, le volet bat au vent et descelle son gond',
  });
  if (vantaux > 1) {
    lignes.push({
      categorie: 'quincaillerie',
      reference: `${gamme}-espagnolette`,
      designation: 'Espagnolette de fermeture',
      quantite: 1,
      unite: 'piece',
      longueurMm: hauteurMm,
      teinte,
      regle: 'une par volet à deux vantaux — elle verrouille en haut et en bas',
    });
  }

  return { lignes, lacunes };
}
