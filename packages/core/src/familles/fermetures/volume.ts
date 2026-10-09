
import {
  ajouterCylindre,
  ajouterPave,
  ajouterPaveOriente,
  extruder,
  type Maillage,
  type Point2,
  type Point3,
} from '../../geometrie/maillage.ts';
import type { JoineryConfiguration } from '../../types.ts';
import { manoeuvreDe, modeleVoletDe } from '../../catalog.ts';
import { ajouterButeeLameFinale, ajouterManivelle, ajouterSortieDeSangle } from '../../geometrie/quincaillerie.ts';
import { profilLameFinale, profilLamePersienne, profilLamePleine } from '../../geometrie/profils.ts';
import { coteGondsVolet } from '../../drawing.ts';
import {
  enregistrerComplement3d,
  enregistrerVolume3d,
  type ContexteComplement,
  type ContexteVolume,
} from '../volumes-3d.ts';
import { CADRE_MM, SECTIONNELLE } from './cotes-de-sectionnelle.ts';
import { ajouterArretVolet, ajouterEspagnolette, ajouterGond, ajouterPenture } from './ferrures-de-volet.ts';

/** La hauteur du coffre d'un store banne dans le volume, en mm. */
const COFFRE_MM = 230;

/**
 * LA PENTE D'ÉCOULEMENT, en millièmes de l'avancée.
 *
 * Une toile tendue à plat retiendrait la pluie. Dix-sept pour cent est la
 * convention du trait, et les deux vues la partagent — c'est la leçon du lot
 * D14, où le pas d'une lame de volet valait trois nombres différents selon
 * qu'on lisait le dessin, le volume ou la cote réelle.
 */
const CHUTE_EN_MILLIEMES = 170;

/**
 * LE VOLUME D'UN STORE BANNE — coffre, toile, barre de charge, lambrequin,
 * deux bras, et le capteur de vent quand il est commandé.
 *
 * Il ne lit ni cote de profilé ni chaîne de cotes : les seules grandeurs qui
 * décident sont la largeur du dessin et l'AVANCÉE, que le catalogue range dans
 * `heightMm` — un store banne se commande en largeur × avancée, et c'est la
 * convention que sa famille déclare.
 */
export function volumeDeStoreBanne(contexte: {
  atelier: ContexteVolume['atelier'];
  config: JoineryConfiguration;
  dessin: ContexteVolume['dessin'];
}): boolean {
  const { atelier, config, dessin } = contexte;
  const largeur = dessin.largeurMm;
  const avancee = config.heightMm;
  const yCoffre = dessin.hauteurMm - COFFRE_MM;
  const yBout = yCoffre - (avancee * CHUTE_EN_MILLIEMES) / 1000;

  ajouterPave(
    atelier.poser('coffre', 'coffre', 'cadre'),
    { xMm: 0, yMm: yCoffre + COFFRE_MM / 2, zMm: -130 },
    { xMm: largeur, yMm: COFFRE_MM, zMm: 270 },
  );

  extruder(
    atelier.poser('toile', 'toile', 'toile'),
    [
      [yCoffre, 0],
      [yCoffre - 10, 0],
      [yBout - 10, -avancee],
      [yBout, -avancee],
    ] as Point2[],
    'x',
    { debut: -largeur / 2, fin: largeur / 2 },
  );

  ajouterPave(
    atelier.poser('barre-de-charge', 'barre-de-charge', 'cadre'),
    { xMm: 0, yMm: yBout - 45, zMm: -avancee },
    { xMm: largeur, yMm: 90, zMm: 46 },
  );
  // Le lambrequin pend de la barre de charge, pas du mur.
  ajouterPave(
    atelier.poser('lambrequin', 'lambrequin', 'toile'),
    { xMm: 0, yMm: yBout - 90 - 85, zMm: -avancee },
    { xMm: largeur, yMm: 170, zMm: 6 },
  );

  const brasEcart = Math.min(largeur * 0.34, 1400);
  for (const signe of [-1, 1]) {
    ajouterBrasStore(
      atelier.poser(`bras-${signe > 0 ? 'droit' : 'gauche'}`, 'bras', 'quincaillerie'),
      { xMm: signe * brasEcart, yMm: yCoffre - 40, zMm: -40 },
      { xMm: signe * brasEcart, yMm: yBout - 70, zMm: -avancee + 60 },
    );
  }

  if ((config.options ?? []).some((option) => option.id === 'capteur-vent')) {
    ajouterCapteurVent(
      atelier.poser('capteur-vent', 'capteur', 'quincaillerie'),
      { xMm: largeur / 2 - 140, yMm: yBout - 40, zMm: -avancee + 40 },
    );
  }
  return true;
}

/**
 * L'ENREGISTREMENT SE FAIT PAR LE SEUL FAIT D'IMPORTER CE MODULE — patron du
 * lot Z0, et c'est ce qui permet à `computeGeometry3D` de rester SYNCHRONE.
 *
 * Le groupe ne rend `true` que pour le store banne : ses autres familles — le
 * volet roulant, le battant, la porte de garage, le store intérieur, la
 * moustiquaire — passent par le chemin générique, que la porte de garage et
 * le battant COMPLÈTENT depuis le lot D16c (plus bas). Rendre `true` pour
 * elles effacerait le cadre.
 */
enregistrerVolume3d('fermetures', (contexte) =>
  contexte.config.famille === 'store-banne' ? volumeDeStoreBanne(contexte) : false,
);

/* ------------------------------------------------------------------ *
 * LES DEUX AIDES DU STORE BANNE — descendues de `geometrie/quincaillerie.ts`
 * au lot D16b, et c’est la mesure qui l’a exigé.
 *
 * Sorti le bloc, `geometry3d.js` a bien perdu 2 094 octets — et un morceau
 * `ahjc-quincaillerie.js` de 2 253 est NÉ dans la base, parce que deux
 * morceaux importaient désormais la même trousse. **L’extraction n’avait rien
 * rendu : elle avait coupé un fichier en deux.**
 *
 * La règle qui en sort, et elle vaut pour toute extraction : **sortir un bloc
 * qui PARTAGE une trousse avec ce qu’il quitte ne rend rien.** Il faut que ce
 * qui part n’ait plus qu’un lecteur — ces trois fonctions n’en avaient plus
 * qu’un —, sans quoi le partage devient un morceau de base et le compte
 * s’inverse. Ce qui reste en bas, `ajouterSortieDeSangle` et le reste de la
 * quincaillerie, a toujours ses lecteurs dans `geometry3d.ts`.
 * ------------------------------------------------------------------ */

/**
 * Un bras articulé de store banne : deux segments et leur coude. C'est lui
 * qui porte la toile en avant du mur — sans bras, un store est un panneau
 * collé à la façade.
 */
export function ajouterBrasStore(
  maillage: Maillage,
  attache: Point3,
  bout: Point3,
): void {
  const coude: Point3 = {
    xMm: (attache.xMm + bout.xMm) / 2 + (bout.xMm - attache.xMm) * 0.08,
    yMm: (attache.yMm + bout.yMm) / 2 + 60,
    zMm: (attache.zMm + bout.zMm) / 2,
  };
  segmentDeBras(maillage, attache, coude);
  segmentDeBras(maillage, coude, bout);
  ajouterCylindre(maillage, coude, 'x', 16, 34, 12);
  ajouterCylindre(maillage, attache, 'x', 14, 40, 12);
}

/** Un segment de bras : un profil rectangulaire tendu entre deux points. */
function segmentDeBras(maillage: Maillage, depart: Point3, arrivee: Point3): void {
  const dy = arrivee.yMm - depart.yMm;
  const dz = arrivee.zMm - depart.zMm;
  const longueur = Math.hypot(dy, dz);
  if (longueur < 1) return;
  const angle = Math.atan2(dy, dz);
  const demi = 13;
  // Section rectangulaire tournée dans le plan (y, z), extrudée selon x.
  const coins: Array<[number, number]> = [
    [-demi, -longueur / 2],
    [demi, -longueur / 2],
    [demi, longueur / 2],
    [-demi, longueur / 2],
  ];
  const cy = (depart.yMm + arrivee.yMm) / 2;
  const cz = (depart.zMm + arrivee.zMm) / 2;
  extruder(
    maillage,
    coins.map(([u, v]) => [
      cy + u * Math.cos(angle) + v * Math.sin(angle),
      cz - u * Math.sin(angle) + v * Math.cos(angle),
    ] as [number, number]),
    'x',
    { debut: depart.xMm - 13, fin: depart.xMm + 13 },
  );
}

/** Le capteur vent d'un store : le boîtier qui replie la toile en rafale. */
export function ajouterCapteurVent(maillage: Maillage, ancrage: Point3): void {
  ajouterPave(maillage, ancrage, { xMm: 64, yMm: 44, zMm: 40 });
  ajouterCylindre(
    maillage,
    { ...ancrage, yMm: ancrage.yMm - 34 },
    'y',
    7,
    28,
    10,
  );
}

/* ------------------------------------------------------------------ *
 * LES COMPLÉMENTS DU CHEMIN GÉNÉRIQUE — lot D16c.
 *
 * La porte de garage et les ferrures du volet battant ne remplacent pas le
 * cadre générique comme le store banne : elles le complètent, chacune à son
 * moment (`MomentDuComplement`). Leurs corps sont DÉPLACÉS de `geometry3d.ts`
 * sans une cote changée — seul le repère d'un point passe par `monde()` au
 * lieu de `auMonde()`, qui rend la même chose —, et
 * `volume-des-fermetures-epingle.test.ts`, écrit AVANT le déplacement, compare
 * leurs maillages au millimètre.
 *
 * MESURÉ : retirer ces deux blocs du morceau commun rend **1,2 ko gzippés** à
 * la session, qui était à 264 octets de sa borne. Les deux constantes du joint
 * et les quatre ferrures descendent avec eux, parce qu'elles n'ont plus que ce
 * lecteur (règle du lot D16b).
 * ------------------------------------------------------------------ */

/**
 * LE JOINT ENTRE DEUX PANNEAUX de sectionnelle, en mm, et LA SAILLIE de
 * chaque panneau sur le plan du tablier.
 *
 * Huit millimètres et pas deux : à la distance où l'on regarde une porte de
 * garage — depuis la rue, en entier —, deux millimètres disparaissent, et
 * la porte redevient la plaque blanche que la première capture montrait.
 * C'est la succession de lignes horizontales qui fait reconnaître une
 * sectionnelle ; sans elles on vend une dalle.
 */
const JOINT_PANNEAU_MM = 8;
const SAILLIE_PANNEAU_MM = 6;

// ---- LA PORTE DE GARAGE SECTIONNELLE ----
//
// Elle passe ICI et pas par le chemin des volets, parce qu'elle n'a rien
// d'un volet : sans cette branche, elle sortait en UNE SEULE PIÈCE — un
// tablier de volet roulant à lames enroulables, sans cadre. Une dalle
// grise à la place d'une porte.
//
// Ce qu'elle est vraiment : un CADRE DORMANT sur trois côtés — pas de
// traverse basse, la porte roule sur le sol fini — et N PANNEAUX de
// 500 mm dont LE PLUS BAS EST RECOUPÉ. C'est ce qui se voit sur une porte
// posée : le premier joint n'est jamais à 500 mm du sol.
function porteDeGarageSectionnelle({ atelier, monde, profondeur, rects }: ContexteComplement): void {
  const rectDormant = rects.find((rect) => rect.role === 'dormant');
  if (!rectDormant) return;
  const cadre = monde(rectDormant);
  // La MÊME cote que le dessin et que le comptage de panneaux : elle vient
  // du module de la famille, et la recopier ici ferait diverger le volume
  // de l'élévation d'un panneau entier sur certaines hauteurs.
  const montant = CADRE_MM;
  const dormant = atelier.poser('dormant', 'dormant', 'cadre');
  // Trois barres : deux montants et un linteau. La quatrième n'existe pas.
  for (const barre of [
    { x: cadre.x, y: cadre.y, l: montant, h: cadre.hauteur },
    { x: cadre.x + cadre.largeur - montant, y: cadre.y, l: montant, h: cadre.hauteur },
    { x: cadre.x, y: cadre.y + cadre.hauteur - montant, l: cadre.largeur, h: montant },
  ]) {
    ajouterPave(
      dormant,
      { xMm: barre.x + barre.l / 2, yMm: barre.y + barre.h / 2, zMm: 0 },
      { xMm: barre.l, yMm: barre.h, zMm: profondeur },
    );
  }

  // LES PANNEAUX. On les empile depuis le HAUT, parce que c'est celui du
  // BAS qu'on recoupe. Empiler depuis le sol mettrait le panneau court en
  // haut, là où le gammiste n'en fabrique jamais.
  const panneaux = atelier.poser('tablier', 'panneau', 'cadre');
  const largeurTablier = cadre.largeur - 2 * montant;
  const hautTablier = cadre.y + cadre.hauteur - montant;
  const basTablier = cadre.y;
  const panneauMm = SECTIONNELLE.panneauHauteurMm;
  let y = hautTablier;
  while (y > basTablier + 1) {
    const hauteur = Math.min(panneauMm, y - basTablier);
    // LE JOINT ENTRE DEUX PANNEAUX DOIT SE VOIR, et deux millimètres ne
    // se voient pas : la première capture montrait une plaque blanche
    // avec une ligne pâle au milieu. Or c'est précisément la succession
    // de lignes horizontales qui fait reconnaître une sectionnelle.
    //
    // Le joint réel n'est pas un simple jeu : chaque panneau porte un
    // BORD CHANFREINÉ, et c'est le chanfrein qui creuse l'ombre. On le
    // rend en RETIRANT de la hauteur et en avançant la face — le panneau
    // devient un pavé légèrement en saillie, et le creux entre deux
    // panneaux prend la lumière autrement.
    ajouterPave(
      panneaux,
      {
        xMm: cadre.x + montant + largeurTablier / 2,
        yMm: y - hauteur / 2,
        zMm: profondeur * 0.2 + SAILLIE_PANNEAU_MM / 2,
      },
      {
        xMm: largeurTablier,
        yMm: Math.max(1, hauteur - JOINT_PANNEAU_MM),
        zMm: profondeur * 0.55,
      },
    );
    y -= hauteur;
  }

  // LA POIGNÉE, à un mètre du sol : la hauteur à laquelle on la saisit
  // debout, et celle où les gammistes la posent.
  ajouterPave(
    atelier.poser('poignee', 'poignee', 'quincaillerie'),
    {
      xMm: cadre.x + cadre.largeur / 2,
      yMm: cadre.y + 1000,
      zMm: profondeur * 0.55,
    },
    { xMm: 220, yMm: 34, zMm: 26 },
  );
}

// ---- Le volet battant : ses ferrures ----
// Elles manquaient toutes, et c'est par elles qu'un volet se reconnaît :
// un battant sans penture est une planche appuyée contre un mur.
function ferruresDuVoletBattant({ atelier, config, elevation, monde, profondeur, rects }: ContexteComplement): void {
  const battants = rects.filter((rect) => rect.role === 'ouvrant');
  const vantaux = Math.max(1, battants.length);

  // L'écharpe est un TRAIT de l'élévation — la seule pièce diagonale du
  // volet. On la relit là où elle a été calculée plutôt que de refaire
  // son sens ici : le côté des gonds ne doit être décidé qu'une fois.
  for (const trait of elevation.lines.filter((ligne) => ligne.role === 'echarpe')) {
    const a = monde({ xMm: trait.x1Mm, yMm: trait.y1Mm, widthMm: 0, heightMm: 0 });
    const b = monde({ xMm: trait.x2Mm, yMm: trait.y2Mm, widthMm: 0, heightMm: 0 });
    const maillage = atelier.poser('echarpe', 'echarpe', 'cadre', trait.vantail);
    const longueur = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ajouterPaveOriente(
      maillage,
      { xMm: (a.x + b.x) / 2, yMm: (a.y + b.y) / 2, zMm: profondeur * 0.34 + 13 },
      { xMm: longueur, yMm: 88, zMm: 26 },
      angle,
    );
  }

  for (const [index, rect] of battants.entries()) {
    const cadre = monde(rect);
    const cote = coteGondsVolet(config, index, vantaux);
    const signe: 1 | -1 = cote === 'gauche' ? 1 : -1;
    const xGond = cote === 'gauche' ? cadre.x : cadre.x + cadre.largeur;

    // Deux pentures par battant, au sixième et aux cinq sixièmes de la
    // hauteur — les emplacements du serrurier : assez écartés pour tenir
    // le battant, assez en retrait pour ne pas fendre les bouts.
    for (const part of [1 / 6, 5 / 6]) {
      const y = cadre.y + cadre.hauteur * part;
      ajouterPenture(
        atelier.poser('penture', 'penture', 'quincaillerie', index),
        { xMm: xGond, yMm: y, zMm: -6 },
        signe,
        cadre.largeur * 0.78,
      );
      // Le gond, scellé dans le tableau, DERRIÈRE la penture. Il s'enfonce
      // vers l'extérieur de la baie, jamais vers le vitrage.
      ajouterGond(
        atelier.poser('gond', 'gond', 'quincaillerie'),
        { xMm: xGond, yMm: y, zMm: -6 },
        (-signe) as 1 | -1,
      );
    }

    // L'arrêt de volet — la « bergère » — scellé en façade, au large du
    // battant ouvert, à hauteur d'appui.
    ajouterArretVolet(
      atelier.poser('arret-volet', 'arret-volet', 'quincaillerie'),
      {
        xMm: xGond + signe * -Math.max(120, cadre.largeur * 0.14),
        yMm: cadre.y + cadre.hauteur * 0.42,
        zMm: -30,
      },
      signe,
    );
  }

  // L'espagnolette : une seule, sur le battant qui ferme en dernier.
  for (const trait of elevation.lines.filter((ligne) => ligne.role === 'espagnolette')) {
    const haut = monde({ xMm: trait.x1Mm, yMm: trait.y1Mm, widthMm: 0, heightMm: 0 });
    const bas = monde({ xMm: trait.x2Mm, yMm: trait.y2Mm, widthMm: 0, heightMm: 0 });
    const service = trait.vantail ?? Math.max(0, vantaux - 1);
    const cote = coteGondsVolet(config, service, vantaux);
    ajouterEspagnolette(
      atelier.poser('espagnolette', 'espagnolette', 'quincaillerie', trait.vantail),
      { xMm: haut.x, yMm: (haut.y + bas.y) / 2, zMm: profondeur * 0.34 + 18 },
      Math.abs(haut.y - bas.y),
      cote === 'gauche' ? -1 : 1,
    );
  }
}

// ---- LOT D16e — LA MANŒUVRE D'UN VOLET ROULANT ET LES LAMES D'UN STORE ----
//
// Ils vivaient dans `geometry3d.ts`, le morceau que tire tout visiteur qui ouvre la
// 3D. Ils se posent au moment `ferrures`, AVANT les ferrures du volet battant : les
// familles ne se recouvrent pas, et l'ordre des pièces est celui d'avant —
// `volume-des-options-epingle.test.ts` le compare.

/** L'épaisseur d'une lame de store vue, en mm. */
const EPAISSEUR_LAME_STORE_MM = 1.2;
/** L'inclinaison d'une lame de store vue : ouverte, sans quoi on revoit une toile. */
const ANGLE_LAMES_STORE_DEG = 20;

function manoeuvreDuVoletRoulant({ atelier, catalog, config, elevation, monde, optionsIds, profondeur }: ContexteComplement): void {
  // Un volet roulant sans motorisation se manœuvre à la main — à la sangle,
  // ou à la manivelle. Sans l'une des deux, il a l'air motorisé, et la
  // motorisation se facture.
  if (
    config.famille === 'volet-roulant' &&
    !optionsIds.some((id) => id.startsWith('motorisation-'))
  ) {
    const tablier = elevation.rects.find((rect) => rect.role === 'tablier');
    if (tablier) {
      const cadre = monde(tablier);
      const manoeuvre = manoeuvreDe(catalog, config.famille, config.manoeuvre);
      if (manoeuvre === 'manivelle') {
        // La manivelle sort du CAISSON, pas du tableau : elle est portée
        // par l'axe d'enroulement, tout en haut, et non par un enrouleur
        // encastré à mi-hauteur comme la sangle.
        ajouterManivelle(
          atelier.poser('manivelle', 'manoeuvre', 'quincaillerie'),
          {
            xMm: cadre.x + cadre.largeur + 40,
            yMm: cadre.y + cadre.hauteur - 40,
            zMm: profondeur * 0.3,
          },
          Math.min(520, Math.max(280, cadre.hauteur * 0.34)),
          1,
        );
      } else {
        ajouterSortieDeSangle(
          atelier.poser('sortie-de-sangle', 'manoeuvre', 'quincaillerie'),
          { xMm: cadre.x + cadre.largeur + 90, yMm: cadre.y + cadre.hauteur * 0.62, zMm: profondeur * 0.3 },
        );
      }
    }
  }
}

/**
 * LE BSO EMPRUNTE CETTE FONCTION, et c'est la même mécanique parce que c'est le même
 * produit : un brise-soleil orientable est un vénitien extérieur. Elle s'enregistre
 * donc aussi pour le groupe `solaire`, dont le thunk importe ce module — un visiteur
 * de BSO télécharge le volume des fermetures en ouvrant la 3D, et c'est le prix
 * d'une seule copie des lames.
 */
function lamesDuStore({ atelier, config, elevation, monde }: ContexteComplement): void {
  // ---- LE STORE INTÉRIEUR À LAMES : un vénitien n'est pas une toile ----
  //
  // L'élévation pose une `toile` pour TOUS les types — c'est le champ du
  // store — puis dessine par-dessus les lames d'un vénitien ou les bandes
  // d'un californien. À plat, cela se lit. En volume, la toile devenait un
  // panneau plein et les traits disparaissaient : le store le plus vendu
  // d'Europe sortait en écran laiteux, exactement comme l'enrouleur dont sa
  // fiche prend soin de le distinguer.
  //
  // Les lames sont donc de vraies lames, INCLINÉES : c'est ce qu'un
  // vénitien fait — on règle la lumière sans fermer — et une lame à plat
  // redonnerait la toile qu'on vient de retirer.
  const typeStore = config.famille === 'store-interieur' ? (config.typeStoreInterieur ?? 'venitien') : null;
  // LE BSO REJOINT LE VÉNITIEN, et c'est la même mécanique parce que c'est le
  // même produit : un brise-soleil ORIENTABLE est un vénitien extérieur.
  //
  // MESURÉ avant (docs/45 §4.1) : son tablier tombait dans la branche
  // générique, qui lui posait le profil d'une lame de VOLET ROULANT, fermée,
  // au pas fixe. Changer son modèle de lame faisait passer l'élévation de 18
  // à 24 lames et laissait la 3D à 380 triangles — IDENTIQUE. Le client
  // payait un choix que l'image ignorait, sur le produit dont l'argument est
  // que les lames tournent.
  const storeALames = typeStore === 'venitien' || typeStore === 'californien' || config.famille === 'bso';
  // LE PAS RÉEL, LU SUR LE DESSIN. Il vaut la largeur de la lame : le trait
  // d'un vénitien est posé au pas de `lameStoreMm`, celui d'un BSO au pas du
  // modèle (69 ou 93). Le relever ici évite de redescendre les deux tables
  // dans le volume — c'est l'élévation qui a déjà tranché, comme pour le
  // Les traits d'un CALIFORNIEN sont verticaux : leurs `y` sont égaux, le pas
  // sort donc à zéro et la bande reprend sa largeur de 127. Filtrer sur
  // l'horizontalité aurait coûté des octets pour le même résultat.
  const traitsDeLame = elevation.lines.filter((trait) => trait.role === 'lame');
  const pasDeLameMm = traitsDeLame[1]
    ? Math.abs(traitsDeLame[1].y1Mm - traitsDeLame[0].y1Mm)
    : 0;
  if (storeALames) {
    const lames = atelier.poser('lames', 'lame', 'cadre');
    const angle = (ANGLE_LAMES_STORE_DEG * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const trait of elevation.lines) {
      if (trait.role !== 'lame') continue;
      const a = monde({ xMm: trait.x1Mm, yMm: trait.y1Mm, widthMm: 0, heightMm: 0 });
      const b = monde({ xMm: trait.x2Mm, yMm: trait.y2Mm, widthMm: 0, heightMm: 0 });
      const horizontal = Math.abs(b.y - a.y) < 0.5;
      // Une lame de vénitien a la largeur COMMANDÉE — 15, 16, 25 ou 50 — et
      // c'est elle qui distingue les deux produits à l'œil. Une bande de
      // californien fait 127 mm, la largeur que le dessin a déjà retenue.
      const largeurLame = horizontal ? pasDeLameMm || 25 : 127;
      const du = largeurLame / 2;
      const dv = EPAISSEUR_LAME_STORE_MM / 2;
      if (horizontal) {
        // Section dans le plan (y, z), extrudée sur la largeur : la lame
        // tourne autour de son axe long, comme sur le produit.
        const coin = ([u, v]: [number, number]): [number, number] => [
          a.y + u * sin + v * cos,
          u * cos - v * sin,
        ];
        extruder(lames, [coin([-du, dv]), coin([du, dv]), coin([du, -dv]), coin([-du, -dv])], 'x', {
          debut: Math.min(a.x, b.x),
          fin: Math.max(a.x, b.x),
        });
      } else {
        // UNE BANDE DE CALIFORNIEN pivote autour de la VERTICALE : sa
        // section vit dans le plan (x, z) et s'extrude sur la hauteur.
        const coin = ([u, v]: [number, number]): [number, number] => [
          a.x + u * cos - v * sin,
          u * sin + v * cos,
        ];
        extruder(lames, [coin([-du, -dv]), coin([du, -dv]), coin([du, dv]), coin([-du, dv])], 'y', {
          debut: Math.min(a.y, b.y),
          fin: Math.max(a.y, b.y),
        });
      }
    }
  }
}

enregistrerComplement3d('fermetures', 'apres-le-dormant', (contexte) => {
  if (contexte.config.famille === 'porte-garage') porteDeGarageSectionnelle(contexte);
});

enregistrerComplement3d('fermetures', 'ferrures', (contexte) => {
  manoeuvreDuVoletRoulant(contexte);
  lamesDuStore(contexte);
  if (contexte.config.famille === 'volet-battant') ferruresDuVoletBattant(contexte);
});

enregistrerComplement3d('solaire', 'ferrures', lamesDuStore);
/**
 * LOT D16f — CE QUI SE POSE RECTANGLE PAR RECTANGLE : le tablier d'un volet battant
 * (persiennes et planches, selon son modèle) et la lame finale d'un volet ou d'un store
 * avec ses butées. Le crochet est appelé en tête de la boucle générique, à la place
 * exacte où ces branches vivaient, et rend `true` quand il a posé le rectangle — l'ordre
 * des pièces ne bouge pas. Le groupe `solaire` l'emprunte pour la lame finale d'un
 * screen ou d'un BSO.
 */
function parRectangle({ atelier, catalog, config, monde, profondeur, rect }: ContexteComplement): boolean {
  if (!rect) return false;
  if (rect.role === 'tablier' && config.famille === 'volet-battant') {
    const cadre = monde(rect);
    const maillage = atelier.poser('tablier', 'lame', 'cadre', rect.vantail);
    const decorVolet = modeleVoletDe(catalog, config.famille, config.modeleVolet)?.decor;
    // Un volet battant garnit son bâti selon son MODÈLE : persiennes en
    // haut, planches verticales en bas, dans la proportion que le
    // catalogue vend. Le volet plein n'est PAS une dalle — c'est un
    // rang de planches, et chaque planche est une pièce du maillage.
    const partPersienne = Math.max(0, Math.min(1, decorVolet?.persiennePart ?? 1));
    const hautPersienne = cadre.hauteur * partPersienne;

    if (hautPersienne > 1) {
      const lameMm = 62;
      const nombre = Math.max(1, Math.round(hautPersienne / lameMm));
      const hauteurLame = hautPersienne / nombre;
      for (let index = 0; index < nombre; index++) {
        // Les persiennes occupent le HAUT du battant, donc le haut en
        // coordonnées du monde : y décroît vers le bas de la baie.
        const yLame = cadre.y + cadre.hauteur - hautPersienne + hauteurLame * index;
        const section = profilLamePersienne(hauteurLame * 0.92, 9).map(
          ([u, v]) => [yLame + hauteurLame / 2 + u, profondeur * 0.22 + v] as Point2,
        );
        extruder(maillage, section, 'x', { debut: cadre.x, fin: cadre.x + cadre.largeur });
      }
    }

    const hautPlein = cadre.hauteur - hautPersienne;
    if (hautPlein > 1) {
      const largeurPlanche = 130;
      const planches = Math.max(2, Math.round(cadre.largeur / largeurPlanche));
      const largeur = cadre.largeur / planches;
      for (let index = 0; index < planches; index++) {
        // Les planches se balaient sur la HAUTEUR : chacune est un
        // prisme vertical, et le V de son joint creuse la ligne.
        const section = profilLamePleine(largeur, profondeur * 0.34).map(
          ([u, v]) => [cadre.x + largeur * index + u, v] as Point2,
        );
        extruder(maillage, section, 'y', { debut: cadre.y, fin: cadre.y + hautPlein });
      }
    }
    return true;
  }
  if (rect.role !== 'lame-finale') return false;
  // --- La lame finale d'un volet roulant, et ses butées ---
    const cadre = monde(rect);
    const maillage = atelier.poser('lame-finale', 'lame', 'cadre');
    extruder(
      maillage,
      profilLameFinale(cadre.hauteur, profondeur * 0.34).map(
        ([u, v]) => [cadre.y + u, v] as Point2,
      ),
      'x',
      { debut: cadre.x, fin: cadre.x + cadre.largeur },
    );
    // Les BUTÉES, une à chaque bout : c'est elles qui arrêtent le tablier
    // avant qu'il ne disparaisse dans son coffre.
    const butees = atelier.poser('butees', 'butee', 'quincaillerie');
    for (const signe of [-1, 1]) {
      ajouterButeeLameFinale(butees, {
        xMm: cadre.x + cadre.largeur / 2 + signe * (cadre.largeur / 2 - 60),
        yMm: cadre.y + cadre.hauteur + 8,
        zMm: profondeur * 0.17,
      });
    }
  return true;
}

enregistrerComplement3d('fermetures', 'par-rectangle', parRectangle);
enregistrerComplement3d('solaire', 'par-rectangle', parRectangle);
