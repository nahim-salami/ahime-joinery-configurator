/**
 * Pourquoi ce fichier existe : les SECTIONS de profilé. Un dormant n'est pas
 * un pavé : c'est un profil qui porte une feuillure — la marche où vient
 * s'appuyer l'ouvrant. Un ouvrant n'est pas un pavé non plus : il porte la
 * feuillure à verre, celle que la parclose vient refermer. Un seuil de
 * coulissant est un rail à deux gorges. Ces marches sont exactement ce que
 * l'œil reconnaît comme « une vraie fenêtre ».
 *
 * Solution écartée : dessiner ces sections à la main, une par gamme, et les
 * stocker. Elles ne suivraient plus l'épaisseur du profilé que le marchand
 * vend, et une gamme ajoutée au catalogue n'aurait pas de dessin. Ici tout
 * est PARAMÉTRÉ par la profondeur du catalogue (`profils.epaisseurMm`) et
 * par l'épaisseur réelle du vitrage : changer de gamme change la section.
 *
 * Convention de section, une fois pour toutes :
 *   `u` — transversal, 0 au bord EXTÉRIEUR de la barre, croissant vers
 *         l'intérieur du cadre (vers le clair de vitrage) ;
 *   `v` — profondeur, 0 côté EXTÉRIEUR du logement, croissant vers
 *         l'intérieur.
 *
 * Incident fondateur : la première version modélisait tout en pavés. Le
 * vitrage se retrouvait noyé dans la masse, aucune arête ne captait la
 * lumière, et l'ensemble ressemblait à une maquette en carton — pas à une
 * menuiserie. Les feuillures ci-dessous sont ce qui fait la différence.
 */

import type { Point2 } from './maillage.ts';

/** Les cotes d'atelier d'un jeu de profilés, toutes en millimètres. */
export interface CotesProfils {
  /** Profondeur du dormant — vient du catalogue. */
  dormantProfondeur: number;
  /** Largeur vue du dormant. */
  dormantLargeur: number;
  /** Profondeur de l'ouvrant — toujours moindre, il se loge dans le dormant. */
  ouvrantProfondeur: number;
  /** Largeur vue de l'ouvrant. */
  ouvrantLargeur: number;
  /** Épaisseur du vitrage effectif. */
  vitrageEpaisseur: number;
  /** Recouvrement de la parclose sur le verre. */
  parcloseLargeur: number;
}

/**
 * Ce qu'il faut savoir pour tailler une section. Les largeurs vues viennent
 * de la CHAÎNE DE COTES du catalogue (lot 0) : ce sont exactement celles
 * qui ont servi à poser le clair de vitrage, si bien que le profilé dessiné
 * s'arrête là où le verre commence.
 */
export interface EntreesProfils {
  /** Ce que le dormant montre au-delà de l'ouvrant, par côté. */
  dormantVuMm: number;
  /** Ce que l'ouvrant montre, parclose comprise, par côté. */
  ouvrantVuMm: number;
  /** Profondeur du dormant — l'épaisseur de la gamme. */
  profondeurMm: number;
  /** Épaisseur du vitrage effectif. */
  vitrageMm: number;
  /** Recouvrement de la parclose sur le verre — du clair à la cote de vitrage. */
  priseDeVerreMm?: number;
}

/**
 * Les cotes de section, tirées de la chaîne de cotes.
 *
 * Solution écartée, et c'est la correction du lot 3D-B : déduire la largeur
 * vue du dormant d'un RATIO de la bande de profil (`bande × 0,5`) et celle
 * de l'ouvrant d'un autre (`bande − dormant × 0,55`). Ces deux ratios
 * donnaient un dormant et un ouvrant dans le rapport 1:1 quel que soit le
 * matériau — un PVC, un aluminium et un chêne se ressemblaient donc en
 * coupe, alors que c'est précisément là qu'ils diffèrent. Les vraies
 * largeurs vues sont au catalogue depuis le lot 0 ; il n'y a plus de raison
 * de les deviner.
 *
 * La PROFONDEUR de l'ouvrant reste une fraction de celle du dormant : un
 * ouvrant se loge DANS le dormant et sa face intérieure vient affleurer,
 * jamais dépasser. C'est une règle de montage, pas une approximation.
 */
export function cotesProfils(entrees: EntreesProfils): CotesProfils {
  const { dormantVuMm, ouvrantVuMm, profondeurMm, vitrageMm } = entrees;
  return {
    dormantProfondeur: profondeurMm,
    dormantLargeur: Math.max(18, dormantVuMm),
    ouvrantProfondeur: profondeurMm * 0.78,
    ouvrantLargeur: Math.max(20, ouvrantVuMm),
    vitrageEpaisseur: Math.max(4, vitrageMm),
    // La parclose est la part de l'ouvrant qui recouvre le verre : elle
    // vient de la chaîne de cotes, pas d'un forfait de 14 mm.
    parcloseLargeur: Math.max(8, entrees.priseDeVerreMm ?? 12),
  };
}

/**
 * LA SPIRALE D’ENROULEMENT A REMONTÉ À LA RACINE — lot O10, et c’est la
 * coupure du lot MT5 : `structural.ts` est dans le CHARGEMENT INITIAL, et lui
 * faire lire ce fichier y faisait descendre six cent quatre-vingts lignes de
 * sections de profilé. **MESURÉ : dépassement de 979 octets gzippés.**
 *
 * Les trois symboles sont RÉEXPORTÉS ici pour que les dessins n’aient qu’un
 * endroit à connaître ; l’entrée, elle, lit `enroulement-du-tablier.ts`
 * directement — une réexportation ramènerait ce module en entier.
 */
export { hauteurCoffreMm, LAME_VOLET_ROULANT_MM, TUBE_VOLET_MM } from '../enroulement-du-tablier.ts';

/**
 * LA LAME FINALE d'un tablier, en mm. Elle n'est PAS une lame de plus :
 * plus haute, plus épaisse, elle porte le joint qui bute sur le seuil et les
 * BUTÉES qui l'empêchent d'entrer dans le coffre. Un tablier qui
 * s'enroulerait entièrement ne se rattraperait plus d'en bas.
 */
export const LAME_FINALE_VOLET_MM = 66;

/** La coulisse d'un volet roulant, largeur vue, joint brosse compris. */
export const COULISSE_VOLET_MM = 55;

/**
 * Un profil PLAT — le rectangle. Il sert aux LISERÉS : joints de frappe,
 * joint de vitrage, intercalaire. Ces pièces n'ont pas de galbe, elles ont
 * une largeur, une épaisseur et une couleur sombre ; c'est tout ce qui est
 * demandé d'elles, et c'est ce qui fait qu'un cadre cesse d'être un bloc.
 */
export function profilPlat(largeurMm: number, epaisseurMm: number): Point2[] {
  return [
    [0, 0],
    [largeurMm, 0],
    [largeurMm, epaisseurMm],
    [0, epaisseurMm],
  ];
}

/**
 * LES FACES DE VERRE d'un vitrage, et leur position dans son épaisseur.
 *
 * Un vitrage isolant n'est pas un bloc : c'est deux verres (ou trois) et de
 * l'air entre eux. On modélise les VERRES ; la lame d'air est du vide, et
 * c'est justement elle qui fait le reflet dédoublé qu'on reconnaît.
 *
 * L'épaisseur d'une face est plafonnée : un feuilleté 44.2 fait 8,8 mm,
 * mais au-delà on aurait des dalles au lieu de vitres.
 */
export function facesDuVitrage(
  epaisseurTotaleMm: number,
): Array<{ debut: number; epaisseur: number }> {
  // Sous douze millimètres, il n'y a pas de lame d'air à représenter : un
  // simple vitrage, ou un remplissage plein.
  if (epaisseurTotaleMm < 12) return [{ debut: 0, epaisseur: epaisseurTotaleMm }];
  const face = Math.min(8, Math.max(4, epaisseurTotaleMm * 0.18));
  // Au-delà de 38 mm, c'est un triple : trois verres, deux lames.
  if (epaisseurTotaleMm >= 38) {
    const milieu = (epaisseurTotaleMm - 3 * face) / 2;
    return [
      { debut: 0, epaisseur: face },
      { debut: face + milieu, epaisseur: face },
      { debut: epaisseurTotaleMm - face, epaisseur: face },
    ];
  }
  return [
    { debut: 0, epaisseur: face },
    { debut: epaisseurTotaleMm - face, epaisseur: face },
  ];
}

/**
 * Le dormant. Une masse pleine côté extérieur, entaillée au coin
 * intérieur-intérieur : c'est la feuillure où l'ouvrant vient se poser, et
 * elle est ce qui donne au cadre son épaisseur lue de l'intérieur.
 */
export function profilDormant(cotes: CotesProfils): Point2[] {
  const b = cotes.dormantLargeur;
  const p = cotes.dormantProfondeur;
  const feuillureProfondeur = cotes.ouvrantProfondeur * 0.62;
  const feuillureLargeur = b * 0.42;
  const chanfrein = Math.min(3, b * 0.08);

  return [
    [0, 0],
    [b, 0],
    [b, p - feuillureProfondeur],
    [b - feuillureLargeur, p - feuillureProfondeur],
    [b - feuillureLargeur, p - chanfrein],
    // Un petit chanfrein sur l'arête vue de l'intérieur : sans lui, l'arête
    // est trop nette et accroche une ligne blanche à l'écran.
    [b - feuillureLargeur - chanfrein, p],
    [0, p],
  ];
}

/**
 * L'ouvrant. Même logique inversée : la feuillure à verre est ouverte côté
 * intérieur, et la lèvre qui reste côté extérieur est ce qui masque la
 * tranche du vitrage quand on regarde la façade.
 */
export function profilOuvrant(cotes: CotesProfils): Point2[] {
  const b = cotes.ouvrantLargeur;
  const p = cotes.ouvrantProfondeur;
  const feuillureLargeur = b - cotes.parcloseLargeur;
  const feuillureProfondeur = cotes.vitrageEpaisseur + cotes.parcloseLargeur * 0.55;
  const chanfrein = Math.min(2.5, b * 0.07);

  return [
    [0, 0],
    [b, 0],
    [b, p - feuillureProfondeur],
    [b - feuillureLargeur, p - feuillureProfondeur],
    [b - feuillureLargeur, p - chanfrein],
    [b - feuillureLargeur - chanfrein, p],
    [0, p],
  ];
}

/**
 * La parclose — la baguette amovible qui pince le verre côté intérieur.
 * Elle est petite, mais c'est elle qui dit « ce vitrage est posé », et non
 * « ce vitrage flotte dans un trou ».
 */
export function profilParclose(cotes: CotesProfils): Point2[] {
  const largeur = cotes.parcloseLargeur;
  const hauteur = cotes.vitrageEpaisseur * 0.8 + 4;
  const conge = Math.min(5, hauteur * 0.45);
  return [
    [0, 0],
    [largeur, 0],
    [largeur, hauteur - conge],
    [largeur - conge, hauteur],
    [0, hauteur],
  ];
}

/**
 * Le jet d'eau : la lèvre inclinée en bas d'ouvrant, côté extérieur, qui
 * rejette la pluie. Toute menuiserie en porte une ; son absence se remarque.
 */
export function profilJetDEau(cotes: CotesProfils): Point2[] {
  const saillie = 14;
  const hauteur = 22;
  return [
    [0, 0],
    [0, -saillie],
    [hauteur * 0.55, -saillie * 0.72],
    [hauteur, 0],
  ];
}

/** Une gorge de rail : sa largeur et sa profondeur, en millimètres. */
export interface Gorge {
  /** Cote du bord de la gorge le plus près de l'extérieur. */
  depart: number;
  largeur: number;
  profondeur: number;
}

/**
 * Le seuil d'un coulissant — le rail à gorges dans lequel roulent les
 * galets. C'est LA pièce qui fait reconnaître un coulissant au premier coup
 * d'œil, et celle qui manquait entièrement au modèle en pavés.
 *
 * Section dans le plan (hauteur, profondeur) : les gorges s'ouvrent vers le
 * haut. Le polygone est concave — d'où la triangulation par oreilles.
 */
export function profilRail(
  hauteur: number,
  profondeur: number,
  gorges: Gorge[],
  versLeHaut = true,
): Point2[] {
  const points: Point2[] = [[0, 0], [0, profondeur]];
  const sommet = hauteur;
  // On parcourt la face supérieure de l'intérieur vers l'extérieur, en
  // creusant chaque gorge au passage.
  const ordonnees = [...gorges].sort((a, b) => b.depart - a.depart);
  points.push([sommet, profondeur]);
  for (const gorge of ordonnees) {
    const fin = gorge.depart + gorge.largeur;
    points.push([sommet, fin]);
    points.push([sommet - gorge.profondeur, fin]);
    points.push([sommet - gorge.profondeur, gorge.depart]);
    points.push([sommet, gorge.depart]);
  }
  points.push([sommet, 0]);

  if (versLeHaut) return points;
  // Rail haut : la même section retournée, gorges vers le bas.
  return points.map(([u, v]) => [hauteur - u, v] as Point2).reverse();
}

/**
 * Une lame de volet roulant. Section dans le plan (hauteur, profondeur) :
 * la face extérieure est légèrement en retrait en haut et en bas, ce qui
 * creuse une ligne d'ombre entre deux lames.
 *
 * Incident fondateur : les premières lames étaient des pavés coplanaires,
 * séparés par un jeu de 3 mm. Vu de face, le tablier était une DALLE
 * BLANCHE — aucune ligne, aucun relief. Ce n'est pas le jeu qui fait voir
 * les lames, c'est le chanfrein.
 */
export function profilLameVoletRoulant(hauteur: number, profondeur: number): Point2[] {
  const retrait = Math.min(2.5, profondeur * 0.22);
  const biseau = Math.min(hauteur * 0.16, 12);
  return [
    [0, retrait],
    [biseau, 0],
    [hauteur - biseau, 0],
    [hauteur, retrait],
    [hauteur, profondeur],
    [0, profondeur],
  ];
}

/**
 * Une lame de persienne — le volet battant ajouré. Elle est INCLINÉE : c'est
 * l'inclinaison qui laisse passer l'air en arrêtant la pluie, et c'est elle
 * qu'on reconnaît sur une façade. Un volet battant dont les lames seraient
 * à plat ressemble à une porte de placard.
 */
export function profilLamePersienne(
  largeur: number,
  epaisseur: number,
  angleDeg = 24,
): Point2[] {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const demiL = largeur / 2;
  const demiE = epaisseur / 2;
  const coins: Point2[] = [
    [-demiL, -demiE],
    [demiL, -demiE],
    [demiL, demiE],
    [-demiL, demiE],
  ];
  return coins.map(([u, v]) => [u * cos - v * sin, u * sin + v * cos] as Point2);
}

/**
 * Le capot extérieur d'une menuiserie BICOLORE. En PVC c'est un plaxage, en
 * aluminium une coque rapportée devant la rupture de pont thermique : dans
 * les deux cas, une peau mince qui porte la teinte extérieure pendant que
 * l'intérieur reste blanc.
 *
 * Incident fondateur : la bicoloration se vend +25 % et ne se voyait PAS en
 * 3D — la face extérieure gardait la teinte intérieure. Un client qui paie
 * pour deux couleurs doit en voir deux.
 */
export function profilCapot(largeur: number, epaisseur: number): Point2[] {
  const chanfrein = Math.min(2, epaisseur * 0.3);
  return [
    [0, -epaisseur],
    [largeur, -epaisseur],
    [largeur, -chanfrein],
    [largeur - chanfrein, 0],
    [0, 0],
  ];
}

/**
 * Le coffre d'un volet roulant en bloc-baie : le caisson qui loge le
 * tablier enroulé, posé au-dessus de la menuiserie. Sa face avant est
 * légèrement inclinée, comme sur les coffres du commerce.
 */
export function profilCoffre(hauteur: number, profondeur: number): Point2[] {
  const pan = Math.min(hauteur * 0.28, 55);
  return [
    [0, 0],
    [hauteur - pan, 0],
    [hauteur, pan * 0.55],
    [hauteur, profondeur],
    [0, profondeur],
  ];
}

/**
 * La lame finale d'un tablier : plus épaisse que les autres, elle porte les
 * butées et ferme le volet. Son absence se remarque — un tablier qui
 * s'arrête sur une lame ordinaire a l'air coupé.
 */
export function profilLameFinale(hauteur: number, profondeur: number): Point2[] {
  return [
    [0, -2],
    [hauteur * 0.2, -profondeur * 0.35],
    [hauteur * 0.8, -profondeur * 0.35],
    [hauteur, -2],
    [hauteur, profondeur],
    [0, profondeur],
  ];
}

/**
 * Le seuil PMR : la barre plate de 20 mm qu'on franchit en fauteuil. Sa
 * cote est réglementaire (arrêté accessibilité), et c'est justement ce que
 * le client achète — un seuil qu'on ne voit pas est un seuil qu'on ne
 * croit pas.
 */
export function profilSeuilPMR(profondeur: number): Point2[] {
  const hauteur = 20;
  const rampe = 6;
  return [
    [0, 0],
    [hauteur - rampe, 0],
    [hauteur, rampe],
    [hauteur, profondeur - rampe],
    [hauteur - rampe, profondeur],
    [0, profondeur],
  ];
}

export function profilTubePortail(largeurMm: number, profondeurMm: number): Point2[] {
  const chanfrein = Math.min(3, largeurMm * 0.06);
  return [
    [chanfrein, 0],
    [largeurMm - chanfrein, 0],
    [largeurMm, chanfrein],
    [largeurMm, profondeurMm - chanfrein],
    [largeurMm - chanfrein, profondeurMm],
    [chanfrein, profondeurMm],
    [0, profondeurMm - chanfrein],
    [0, chanfrein],
  ];
}

export function profilLamePortail(hauteurMm: number, profondeurMm: number): Point2[] {
  const chanfrein = Math.min(hauteurMm * 0.14, 8);
  return [
    [chanfrein, 0],
    [hauteurMm - chanfrein, 0],
    [hauteurMm, chanfrein],
    [hauteurMm, profondeurMm - chanfrein],
    [hauteurMm - chanfrein, profondeurMm],
    [chanfrein, profondeurMm],
    [0, profondeurMm - chanfrein],
    [0, chanfrein],
  ];
}

export function profilBarreauPortail(coteMm: number): Point2[] {
  const c = Math.min(2, coteMm * 0.12);
  return [
    [c, 0],
    [coteMm - c, 0],
    [coteMm, c],
    [coteMm, coteMm - c],
    [coteMm - c, coteMm],
    [c, coteMm],
    [0, coteMm - c],
    [0, c],
  ];
}

export function profilPoteau(coteMm: number): Point2[] {
  const chanfrein = Math.min(6, coteMm * 0.1);
  return [
    [chanfrein, 0],
    [coteMm - chanfrein, 0],
    [coteMm, chanfrein],
    [coteMm, coteMm - chanfrein],
    [coteMm - chanfrein, coteMm],
    [chanfrein, coteMm],
    [0, coteMm - chanfrein],
    [0, chanfrein],
  ];
}

/**
 * Une PLANCHE de volet plein, vue en coupe. Les planches d'un volet plein
 * sont VERTICALES et jointives, assemblées à rainure et languette — le joint
 * se creuse d'un petit V, et c'est ce V qui fait voir les planches.
 *
 * Incident fondateur, celui du volet roulant, rejoué à l'identique : des
 * planches coplanaires séparées d'un jeu donnent une DALLE. Vu de face, sans
 * ombre portée dans le joint, rien ne distingue quinze planches d'un
 * panneau de contreplaqué. C'est le chanfrein qui fait la ligne, pas le jeu.
 */
export function profilLamePleine(largeur: number, epaisseur: number): Point2[] {
  const chanfrein = Math.min(4, largeur * 0.06);
  const creux = Math.min(epaisseur * 0.28, 4);
  return [
    [0, 0],
    [largeur, 0],
    [largeur, epaisseur - chanfrein],
    [largeur - chanfrein, epaisseur],
    [largeur - chanfrein, epaisseur - creux],
    [chanfrein, epaisseur - creux],
    [chanfrein, epaisseur],
    [0, epaisseur - chanfrein],
  ];
}

/**
 * Une BARRE de volet — la traverse qui tient les planches ensemble. Ses
 * arêtes sont abattues : une barre à angles vifs accroche la manche et
 * fend le bois au premier choc, et aucun menuisier n'en pose.
 */
export function profilBarreVolet(hauteur: number, epaisseur: number): Point2[] {
  const chanfrein = Math.min(hauteur * 0.18, 10);
  return [
    [chanfrein, 0],
    [hauteur - chanfrein, 0],
    [hauteur, chanfrein],
    [hauteur, epaisseur - chanfrein],
    [hauteur - chanfrein, epaisseur],
    [chanfrein, epaisseur],
    [0, epaisseur - chanfrein],
    [0, chanfrein],
  ];
}

/**
 * Le cadre d'un volet battant : deux montants, deux traverses, assemblés,
 * qui reçoivent les lames de persienne. C'est un bâti de menuisier, pas un
 * panneau — un volet battant plein existe, mais il se dit « plein », et
 * celui-là n'a alors pas de lames du tout.
 */
export function profilCadreVolet(largeur: number, profondeur: number): Point2[] {
  const chanfrein = Math.min(4, largeur * 0.12);
  return [
    [0, 0],
    [largeur, 0],
    [largeur, profondeur - chanfrein],
    [largeur - chanfrein, profondeur],
    [0, profondeur],
  ];
}

/**
 * Le battement d'un coulissant : le montant central où les deux vantaux se
 * croisent. Il est plus épais qu'un montant courant, et c'est visible.
 */
export function profilBattement(cotes: CotesProfils): Point2[] {
  const b = cotes.ouvrantLargeur * 1.35;
  const p = cotes.ouvrantProfondeur;
  const feuillureProfondeur = cotes.vitrageEpaisseur + cotes.parcloseLargeur * 0.55;
  return [
    [0, 0],
    [b, 0],
    [b, p - feuillureProfondeur],
    [b - cotes.parcloseLargeur, p - feuillureProfondeur],
    [b - cotes.parcloseLargeur, p],
    [0, p],
  ];
}

/**
 * L'aile de recouvrement d'un dormant de rénovation : la lèvre plate qui
 * vient coiffer l'ancien cadre par l'extérieur. `u` court depuis le bord
 * EXTÉRIEUR de l'aile vers la menuiserie ; `recouvrementMm` est ce qui
 * déborde, `lapMm` ce qui revient se poser sur le dormant neuf.
 *
 * Solution écartée : un simple pavé. L'aile a un retour d'équerre sur son
 * bord libre — sans lui elle sonne creux à l'œil, et surtout une tôle sans
 * pli ne tiendrait pas droite sur trois mètres.
 */
export function profilAileRecouvrement(
  recouvrementMm: number,
  lapMm: number,
  epaisseurMm: number,
): Point2[] {
  const retour = Math.min(9, recouvrementMm * 0.3);
  return [
    [0, 0],
    [recouvrementMm + lapMm, 0],
    [recouvrementMm + lapMm, epaisseurMm],
    [retour, epaisseurMm],
    [retour, epaisseurMm + retour],
    [0, epaisseurMm + retour],
  ];
}

/**
 * La tapée d'isolation : le prolongement du dormant vers l'intérieur, qui
 * rattrape l'épaisseur du doublage. Sa gorge reçoit le couvre-joint — c'est
 * cette rainure qui la distingue d'une simple planche, et qui explique
 * qu'on la commande à l'épaisseur du doublage et pas à la louche.
 */
export function profilTapee(largeurMm: number, profondeurMm: number): Point2[] {
  const gorge = Math.min(12, largeurMm * 0.16);
  const fond = Math.min(8, profondeurMm * 0.2);
  return [
    [0, 0],
    [largeurMm, 0],
    [largeurMm, profondeurMm],
    [largeurMm - gorge, profondeurMm],
    [largeurMm - gorge, profondeurMm - fond],
    [largeurMm - 2 * gorge, profondeurMm - fond],
    [largeurMm - 2 * gorge, profondeurMm],
    [0, profondeurMm],
  ];
}

/**
 * La plate-bande d'un panneau de porte — la moulure qui borde le champ et
 * le fait paraître en creux. Profil en doucine : plat au ras de la porte
 * côté extérieur du cadre, rampe montante, puis sommet plat qui retombe
 * d'un coup sur le champ.
 *
 * Solution écartée : une baguette plate. Essayée d'abord, invisible de
 * face : un décrochement de 14 mm sur un panneau blanc, éclairé de face,
 * ne fait aucune ombre — la porte revenait au panneau uni dès qu'on la
 * regardait droit. C'est la RAMPE qui prend la lumière autrement que la
 * face de la porte, et c'est elle qui dessine le panneau.
 */
export function profilPlateBande(largeurMm: number, saillieMm: number): Point2[] {
  const plat = largeurMm * 0.3;
  const rampe = largeurMm * 0.42;
  return [
    [0, saillieMm],
    [plat, saillieMm],
    [plat + rampe, 0],
    [largeurMm, 0],
    [largeurMm, saillieMm],
  ];
}
