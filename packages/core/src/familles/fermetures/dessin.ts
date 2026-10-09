/**
 * Pourquoi ce fichier existe : le TRAIT des fermetures — le coffre, les
 * coulisses et le tablier à lames d'un volet roulant ; les battants
 * persiennés d'un volet battant ; le coffre, la toile en lés et le
 * lambrequin d'un store banne. Il vient VERBATIM de `drawing.ts` : déplacé,
 * jamais réécrit.
 *
 * Solution écartée : un tracé générique « rectangle plus des lignes »
 * paramétré par la famille. Les trois produits n'ont en commun que d'être
 * des rectangles : le volet roulant se lit par sa hauteur totale, le store
 * par sa seule largeur (son avancée se cote à part), et le volet battant se
 * divise en battants. Un paramétrage commun aurait coûté plus de lignes que
 * les trois fonctions réunies.
 *
 * Incident fondateur : la « hauteur » d'un store banne est son AVANCÉE —
 * la façade n'en montre que 42 %, et la cote le dit en toutes lettres.
 */

import type { JoineryConfiguration } from '../../types.ts';
import { CADRE_MM, SECTIONNELLE } from './porte-garage.ts';
import { coffreDe, manoeuvreDe, modeleVoletDe, type PricingCatalog } from '../../catalog.ts';
import { coffreDuVoletMm, lameDuVoletMm } from '../../lames-de-volet.ts';
import { hexDeLaToile } from '../../toiles-de-store.ts';
import {
  COULISSE_VOLET_MM,
  LAME_FINALE_VOLET_MM,
} from '../../geometrie/profils.ts';
import { coteGondsVolet } from '../../drawing.ts';
import type { ElevationLine, ElevationRect } from '../../drawing.ts';

/**
 * Volet roulant : coffre, coulisses, tablier à lames, lame finale.
 *
 * Le TYPE DE COFFRE décide de ce qu'on voit. Le coffre extérieur — celui de
 * la rénovation — se pose en applique et mange le haut du tableau : c'est le
 * volet que ce catalogue a toujours dessiné. Le coffre tunnel, lui, est
 * maçonné dans le linteau : il n'apparaît PAS à l'élévation, et le tablier
 * descend sur toute la hauteur commandée. C'est exactement l'argument de
 * vente du tunnel — il ne prend rien au clair de jour — et un dessin qui
 * montrerait un caisson là où il n'y en a pas le ferait mentir.
 */
export function elevationVoletRoulant(
  config: JoineryConfiguration,
  catalog: PricingCatalog,
  rects: ElevationRect[],
  lines: ElevationLine[],
): void {
  const W = config.widthMm;
  const H = config.heightMm;
  const coulisseW = COULISSE_VOLET_MM;
  const tunnel = coffreDe(catalog, config.famille, config.coffre) === 'tunnel';
  // LE COFFRE SE CALCULE DU DIAMÈTRE D'ENROULEMENT, pas d'une fraction de
  // la hauteur : c'est le rouleau de tablier qui décide, et il grossit en
  // spirale (voir `hauteurCoffreMm`).
  //
  // IL LIT DÉSORMAIS LA TAILLE DE LAME DÉCLARÉE — lot O5, par
  // `coffreDuVoletMm()`, la seule fonction que le dessin, la nomenclature et
  // l'écran appellent. Les trois la calculaient chacun de leur côté ; le jour
  // où la lame se choisit, l'un des trois aurait oublié de la passer, et le
  // dessin aurait montré un coffre que le débit ne commande pas.
  const coffreH = tunnel ? 0 : coffreDuVoletMm(config);
  if (!tunnel) {
    rects.push({ role: 'coffre', xMm: 0, yMm: 0, widthMm: W, heightMm: coffreH });
  }
  rects.push({ role: 'coulisse', xMm: 0, yMm: coffreH, widthMm: coulisseW, heightMm: H - coffreH });
  rects.push({ role: 'coulisse', xMm: W - coulisseW, yMm: coffreH, widthMm: coulisseW, heightMm: H - coffreH });

  // LA LAME FINALE. Elle n'est pas une lame de plus : elle est plus haute,
  // plus épaisse, elle porte le joint qui vient buter sur le seuil et les
  // BUTÉES qui l'empêchent d'entrer dans le coffre. Un tablier qui
  // s'enroulerait entièrement ne se rattraperait plus d'en bas.
  const lameFinaleH = LAME_FINALE_VOLET_MM;
  rects.push({
    role: 'tablier',
    xMm: coulisseW,
    yMm: coffreH,
    widthMm: W - 2 * coulisseW,
    heightMm: H - coffreH - lameFinaleH,
  });
  rects.push({
    role: 'lame-finale',
    xMm: coulisseW,
    yMm: H - lameFinaleH,
    widthMm: W - 2 * coulisseW,
    heightMm: lameFinaleH,
  });

  // LE PAS DES TRAITS DE LAME EST UNE CONVENTION DE VUE, pas une cote — et
  //
  // La lame réelle fait `LAME_VOLET_ROULANT_MM` (41 mm), et c'est cette
  // valeur-là que le coffre et la nomenclature emploient. La tracer telle
  // quelle mettrait quarante-huit traits sur un volet de deux mètres, à six
  // pixels l'un de l'autre à l'échelle d'une élévation : une trame grise
  // dont on ne lit plus rien. On trace donc UN TRAIT SUR DEUX.
  //
  // C'est un choix de lisibilité, et il a un coût qu'on assume : le dessin
  // montre moitié moins de lames qu'il n'y en a. Ce qui compte est que
  // personne ne les COMPTE sur le dessin — c'est la nomenclature qui les
  // compte, et elle lit la vraie cote.
  //
  // ET LE PAS SUIT LA LAME DÉCLARÉE depuis le lot O5 : une lame de 37 en met
  // plus, une de 55 en met moins, et c'est exactement ce que le client
  // choisit. Le facteur deux, lui, reste la convention de lisibilité.
  const lameMm = 2 * lameDuVoletMm(config);
  for (let y = coffreH + lameMm; y < H - lameFinaleH; y += lameMm) {
    lines.push({ role: 'lame', x1Mm: coulisseW, y1Mm: y, x2Mm: W - coulisseW, y2Mm: y });
  }

  // LE CÔTÉ DE LA MANŒUVRE — lot O5, et il ne se voyait NULLE PART.
  //
  // Le catalogue vend deux manœuvres depuis toujours — sangle et manivelle —,
  // l'écran les pose, la nomenclature les débite… et le dessin n'en montrait
  // aucune. Deux volets, l'un à sangle et l'autre à manivelle, sortaient au
  // trait IDENTIQUE : c'est la faute du lot D14, où le modèle de lame d'un
  // BSO ne changeait rien à l'image.
  //
  // LA CONVENTION EST CELLE DE L'ÉLÉVATION — vue INTÉRIEURE, donc « à
  // droite » est la droite de celui qui regarde depuis la pièce, et c'est
  // aussi celle du relevé de Fenetre24. Le symbole sort du coffre et descend
  // dans le tableau, là où la main l'attrape.
  //
  // ET C'EST UN `symbole`, PAS UN RÔLE NEUF. Le dépôt en porte un qui
  // ressemble — `espagnolette`, la tringle d'un volet battant — et l'employer
  // ici aurait nommé une pièce qui n'est pas celle-là : c'est la faute du lot
  // D17, où quatre volumes posaient leurs pièces sous un rôle inventé. Ce
  // trait ne PRÉTEND pas être la manivelle à l'échelle ; il dit de quel côté
  // elle sort, ce qu'un poseur cherche sur un plan.
  if (!tunnel) {
    const aGauche = config.coteManoeuvre === 'gauche';
    const xManoeuvre = aGauche ? coulisseW + 40 : W - coulisseW - 40;
    const basDeLaCourse = Math.min(H - lameFinaleH, coffreH + 420);
    if (manoeuvreDe(catalog, config.famille, config.manoeuvre) === 'manivelle') {
      // LA MANIVELLE est une TRINGLE OSCILLANTE : elle sort du caisson en
      // biais et pend le long du tableau. Le biais est ce qui la distingue
      // d'une sangle au premier regard, et c'est ce qu'un poseur cherche sur
      // un plan — de quel côté passer le trou.
      lines.push({
        role: 'symbole',
        x1Mm: xManoeuvre,
        y1Mm: coffreH,
        // ELLE PENCHE VERS LE MILIEU, et c'est une correction faite en
        // REGARDANT le dessin : penchée vers le bord, la tringle sortait
        // au-dessus de la coulisse — à trente-cinq millimètres du bord d'un
        // volet de 1 800 — et paraissait fixée au mur. Elle pend DEVANT le
        // tablier, dans la pièce, et c'est là qu'une main l'attrape.
        x2Mm: aGauche ? xManoeuvre + 60 : xManoeuvre - 60,
        y2Mm: basDeLaCourse,
      });
    } else {
      // LA SANGLE descend droit dans son enrouleur encastré : deux traits
      // parallèles, la largeur de la sangle.
      for (const dx of [-9, 9]) {
        lines.push({
          role: 'symbole',
          x1Mm: xManoeuvre + dx,
          y1Mm: coffreH,
          x2Mm: xManoeuvre + dx,
          y2Mm: basDeLaCourse,
        });
      }
    }
  }
}

/**
 * Volet battant : un ou deux battants, gonds sur les bords extérieurs.
 *
 * Vue INTÉRIEURE, comme toute élévation de ce cœur — c'est-à-dire depuis la
 * fenêtre. C'est de ce côté que se voient les barres, l'écharpe et
 * l'espagnolette ; les pentures et les gonds, eux, sont sur la face de la
 * rue et n'apparaissent qu'en volume. Un volet dessiné avec ses pentures en
 * vue intérieure serait un volet monté à l'envers.
 */
export function elevationVoletBattant(
  config: JoineryConfiguration,
  catalog: PricingCatalog,
  rects: ElevationRect[],
  lines: ElevationLine[],
): void {
  const W = config.widthMm;
  const H = config.heightMm;
  const vantaux = Math.max(1, Math.round(config.vantaux));
  const cadre = 70;
  const lameMm = 110;
  const decor = modeleVoletDe(catalog, config.famille, config.modeleVolet)?.decor ?? {
    persiennePart: 1,
  };
  // La part persiennée se compte depuis le HAUT : on ferme le bas pour
  // l'intimité et on laisse l'air passer par le haut.
  const part = Math.max(0, Math.min(1, decor.persiennePart));

  for (let i = 0; i < vantaux; i++) {
    const x = (W * i) / vantaux;
    const w = W / vantaux - (vantaux > 1 && i < vantaux - 1 ? 10 : 0);
    rects.push({ role: 'ouvrant', xMm: x, yMm: 0, widthMm: w, heightMm: H, vantail: i });
    rects.push({
      role: 'tablier',
      xMm: x + cadre,
      yMm: cadre,
      widthMm: w - 2 * cadre,
      heightMm: H - 2 * cadre,
      vantail: i,
    });

    const gauche = x + cadre;
    const droite = x + w - cadre;
    const haut = cadre;
    const bas = H - cadre;
    // La frontière entre persiennes et planches. Elle tombe sur une lame
    // entière : une demi-persienne coupée en travers ne se fabrique pas.
    const separation =
      part >= 1 ? bas : part <= 0 ? haut : haut + Math.round(((bas - haut) * part) / lameMm) * lameMm;

    // --- La partie persiennée : des lames horizontales inclinées ---
    for (let y = haut + lameMm; y < separation; y += lameMm) {
      lines.push({ role: 'lame', x1Mm: gauche, y1Mm: y, x2Mm: droite, y2Mm: y, vantail: i });
    }

    if (separation >= bas) continue;

    // --- La partie pleine : des planches VERTICALES jointives ---
    // Verticales, et c'est la seule façon dont un volet plein se fabrique :
    // l'eau doit courir le long du fil du bois jusqu'en bas. Des planches
    // horizontales retiendraient la pluie sur chaque joint.
    const largeurPlanche = 130;
    const planches = Math.max(2, Math.round((droite - gauche) / largeurPlanche));
    for (let j = 1; j < planches; j++) {
      const xPlanche = gauche + ((droite - gauche) * j) / planches;
      lines.push({
        role: 'lame',
        x1Mm: xPlanche,
        y1Mm: separation,
        x2Mm: xPlanche,
        y2Mm: bas,
        vantail: i,
      });
    }

    // --- L'écharpe, PUIS les barres : la diagonale passe dessous ---
    const cotePivot = coteGondsVolet(config, i, vantaux);
    const barres = Math.max(0, decor.barres ?? 0);
    const hauteurBarre = 90;
    // Les barres se répartissent dans la partie pleine, en retrait des
    // bouts : une barre à ras du bord ne tient rien.
    const positions: number[] = [];
    for (let b = 0; b < barres; b++) {
      const t = barres === 1 ? 0.5 : 0.22 + (0.56 * b) / (barres - 1);
      positions.push(separation + (bas - separation) * t - hauteurBarre / 2);
    }

    if (decor.echarpe && barres > 0) {
      // L'ÉCHARPE. Elle part du bas CÔTÉ GONDS et monte vers le côté libre :
      // le volet pèse alors sur elle en compression. Posée dans l'autre
      // sens elle travaille en traction, l'assemblage s'ouvre, et le volet
      // tombe du nez en deux hivers.
      const basY = positions[positions.length - 1] + hauteurBarre / 2;
      const hautY = positions[0] + hauteurBarre / 2;
      const xBas = cotePivot === 'gauche' ? gauche + 60 : droite - 60;
      const xHaut = cotePivot === 'gauche' ? droite - 60 : gauche + 60;
      lines.push({ role: 'echarpe', x1Mm: xBas, y1Mm: basY, x2Mm: xHaut, y2Mm: hautY, vantail: i });
    }

    for (const yBarre of positions) {
      rects.push({
        role: 'barre',
        xMm: gauche,
        yMm: yBarre,
        widthMm: droite - gauche,
        heightMm: hauteurBarre,
        vantail: i,
      });
    }
  }

  // --- L'ESPAGNOLETTE : la tringle qui ferme, sur le battant de service ---
  // Un seul volet en porte une, même sur une paire : c'est le battant qui
  // ferme en dernier, et il verrouille les deux. En poser une par battant
  // ferait croire à deux fermetures indépendantes.
  const service = vantaux - 1;
  const xService = (W * service) / vantaux;
  const wService = W / vantaux;
  const cotePivotService = coteGondsVolet(config, service, vantaux);
  const xTringle =
    cotePivotService === 'gauche' ? xService + wService - cadre - 45 : xService + cadre + 45;
  lines.push({
    role: 'espagnolette',
    x1Mm: xTringle,
    y1Mm: cadre + 40,
    x2Mm: xTringle,
    y2Mm: H - cadre - 40,
    vantail: service,
  });
}

/** Store banne : coffre, toile en lés, lambrequin — vue de face déployée. */
export function elevationStore(
  config: JoineryConfiguration,
  rects: ElevationRect[],
  lines: ElevationLine[],
): void {
  const W = config.widthMm;
  // En façade, un store se lit par sa largeur ; l'avancée est cotée à part.
  const H = Math.round(config.heightMm * 0.42);
  const coffreH = 230;
  const lambrequinH = 180;
  rects.push({ role: 'coffre', xMm: 0, yMm: 0, widthMm: W, heightMm: coffreH });
  // LA TOILE PORTE SA TEINTE — lot O9b. Elle fait 79 à 85 % de l'image (lot
  // D17) et sortait au vert d'eau du jeton de style, quelle que soit la
  // commande.
  const toile = hexDeLaToile(config);
  rects.push({
    role: 'toile',
    xMm: 0,
    yMm: coffreH,
    widthMm: W,
    heightMm: H - coffreH - lambrequinH,
    teinte: toile,
  });
  // ET LE LAMBREQUIN EST DE LA TOILE, pas du cadre. Il était peint comme le
  // coffre — `.ahjc-lambrequin` prend `--ahjc-cadre` — alors que c'est le
  // BORD de la toile qui pend : un store à toile bordeaux montrait un
  // lambrequin blanc, et c'est la pièce que l'on voit le mieux depuis la rue.
  rects.push({
    role: 'lambrequin',
    xMm: 0,
    yMm: H - lambrequinH,
    widthMm: W,
    heightMm: lambrequinH,
    teinte: toile,
  });
  const les = Math.max(1, Math.round(W / 1200));
  for (let i = 1; i < les; i++) {
    const x = (W * i) / les;
    lines.push({ role: 'lame', x1Mm: x, y1Mm: coffreH, x2Mm: x, y2Mm: H });
  }
}

/**
 * L'ÉLÉVATION D'UNE PORTE DE GARAGE SECTIONNELLE, vue de l'extérieur.
 *
 * Ce qui la distingue d'un volet roulant, alors qu'à distance les deux se
 * ressemblent : un volet a un COFFRE en haut et des COULISSES sur les
 * côtés ; une sectionnelle a un CADRE DORMANT sur trois côtés, et son
 * mécanisme est DERRIÈRE le linteau, invisible depuis la rue. Dessiner un
 * coffre sur une porte de garage serait faux, et un client qui compare deux
 * devis le verrait.
 *
 * Les PANNEAUX ne sont pas des lames : ils font 500 mm, on les compte, et
 * LE PLUS BAS EST RECOUPÉ. C'est ce qu'on voit sur une porte posée — le
 * premier joint n'est jamais à 500 mm du sol —, et c'est ce qui trahit un
 * dessin fait au hasard.
 */
export function elevationPorteGarage(
  config: JoineryConfiguration,
  rects: ElevationRect[],
  lines: ElevationLine[],
): void {
  const W = config.widthMm;
  const H = config.heightMm;
  // Le cadre dormant : deux montants et un linteau. PAS DE TRAVERSE BASSE —
  // une porte de garage roule sur le sol fini, et un seuil rapporté
  // arrêterait la voiture.
  //
  // `CADRE_MM` vient du module de la famille et n'est pas recopié ici : le
  // nombre de panneaux se compte sur le TABLIER, et le dessin, le volume et
  // le message de validation doivent tomber sur le même nombre.
  const cadre = CADRE_MM;
  rects.push({ role: 'dormant', xMm: 0, yMm: 0, widthMm: W, heightMm: H });
  rects.push({
    role: 'tablier',
    xMm: cadre,
    yMm: cadre,
    widthMm: W - 2 * cadre,
    heightMm: H - cadre,
  });

  // LES JOINTS ENTRE PANNEAUX. On les pose depuis le HAUT, parce que c'est
  // le panneau du BAS qu'on recoupe : compter depuis le sol mettrait le
  // panneau court en haut, là où il ne se fabrique jamais.
  const panneauH = SECTIONNELLE.panneauHauteurMm;
  const hautTablier = cadre;
  const basTablier = H;
  for (let y = hautTablier + panneauH; y < basTablier; y += panneauH) {
    lines.push({ role: 'lame', x1Mm: cadre, y1Mm: y, x2Mm: W - cadre, y2Mm: y });
  }

  // LA POIGNÉE, à mi-largeur et à un mètre du sol : c'est la hauteur à
  // laquelle on la saisit debout, et c'est là que les gammistes la posent.
  lines.push({
    role: 'rainure',
    x1Mm: W / 2 - 110,
    y1Mm: H - 1000,
    x2Mm: W / 2 + 110,
    y2Mm: H - 1000,
  });
}

/**
 * L'ÉLÉVATION D'UNE MOUSTIQUAIRE, vue de l'extérieur.
 *
 * Ce qu'elle a et qu'un volet roulant n'a pas : une TOILE, dessinée par sa
 * trame. Ce qu'elle n'a pas et qu'un volet a : des lames. À distance les
 * deux se ressemblent — un coffre en haut, deux coulisses —, et c'est la
 * trame qui les distingue. La dessiner en lames pleines montrerait au
 * client un volet roulant miniature.
 *
 * Un CADRE FIXE n'a ni coffre ni coulisses : il se clipse dans l'embrasure,
 * et son dessin est un cadre plat. Lui dessiner un coffre serait vendre
 * autre chose.
 */
export function elevationMoustiquaire(
  config: JoineryConfiguration,
  rects: ElevationRect[],
  lines: ElevationLine[],
): void {
  const W = config.widthMm;
  const H = config.heightMm;
  const type = config.typeMoustiquaire ?? 'enroulable-verticale';
  const enroulable = type === 'enroulable-verticale' || type === 'enroulable-laterale';

  // Le cadre : mince, parce qu'une moustiquaire est mince. Vingt-cinq
  // millimètres de profilé, contre cent dix pour une fenêtre.
  const cadre = 25;
  const coffre = enroulable && type === 'enroulable-verticale' ? 42 : 0;

  if (coffre > 0) {
    rects.push({ role: 'coffre', xMm: 0, yMm: 0, widthMm: W, heightMm: coffre });
    rects.push({ role: 'coulisse', xMm: 0, yMm: coffre, widthMm: cadre, heightMm: H - coffre });
    rects.push({
      role: 'coulisse',
      xMm: W - cadre,
      yMm: coffre,
      widthMm: cadre,
      heightMm: H - coffre,
    });
  } else {
    rects.push({ role: 'dormant', xMm: 0, yMm: 0, widthMm: W, heightMm: H });
  }

  // LA TOILE, et sa TRAME. C'est elle qu'on reconnaît : une grille fine,
  // bien plus serrée qu'un barreaudage. On ne dessine pas chaque fil —
  // 1,5 mm de maille sur un mètre en ferait six cents — mais un pas
  // visible qui dit « c'est une toile, pas une plaque ».
  const gauche = coffre > 0 ? cadre : cadre;
  const haut = coffre > 0 ? coffre : cadre;
  const droite = W - cadre;
  const bas = H - cadre;
  rects.push({
    role: 'toile',
    xMm: gauche,
    yMm: haut,
    widthMm: Math.max(0, droite - gauche),
    heightMm: Math.max(0, bas - haut),
    // LA MAILLE D'UNE MOUSTIQUAIRE EST UNE TOILE — lot O9b. Le relevé la
    // vend « fibre de verre, noir » : c'est une teinte, et elle décide de ce
    // qu'on voit au travers.
    teinte: hexDeLaToile(config),
  });
  const pasTrame = 60;
  for (let x = gauche + pasTrame; x < droite - 1; x += pasTrame) {
    lines.push({ role: 'rainure', x1Mm: x, y1Mm: haut, x2Mm: x, y2Mm: bas });
  }
  for (let y = haut + pasTrame; y < bas - 1; y += pasTrame) {
    lines.push({ role: 'rainure', x1Mm: gauche, y1Mm: y, x2Mm: droite, y2Mm: y });
  }

  // LA BARRE DE TIRAGE d'une enroulable — celle qu'on saisit pour
  // descendre la toile. Un cadre fixe n'en a pas : on le décroche.
  if (enroulable) {
    rects.push({ role: 'lame-finale', xMm: 0, yMm: H - 30, widthMm: W, heightMm: 30 });
  }
}

/**
 * L'ÉLÉVATION D'UN STORE INTÉRIEUR — vu de la pièce, store baissé.
 *
 * BAISSÉ, et c'est délibéré : remonté, il n'y aurait rien à montrer, et le
 * client vient de choisir ce qui occulte sa fenêtre. C'est le même
 * raisonnement que le store vénitien intégré au vitrage.
 *
 * Un VÉNITIEN montre ses lames, un ENROULEUR sa toile, un CALIFORNIEN ses
 * bandes verticales. Les trois ne se ressemblent pas, et les dessiner
 * pareil ferait acheter au hasard.
 */
export function elevationStoreInterieur(
  config: JoineryConfiguration,
  rects: ElevationRect[],
  lines: ElevationLine[],
): void {
  const W = config.widthMm;
  const H = config.heightMm;
  const type = config.typeStoreInterieur ?? 'venitien';
  // LE CAISSON, en tête — sauf pour un californien, dont le rail est plat.
  const caisson = type === 'californien' ? 25 : type === 'venitien' ? 25 : 50;
  rects.push({ role: 'coffre', xMm: 0, yMm: 0, widthMm: W, heightMm: caisson });

  const haut = caisson;
  rects.push({ role: 'toile', xMm: 0, yMm: haut, widthMm: W, heightMm: H - haut, teinte: hexDeLaToile(config) });

  if (type === 'venitien') {
    // LES LAMES, à leur pas réel. Une lame de 25 se voit ; une de 50 se
    // compte. C'est ce qui distingue les deux produits à l'œil.
    const pas = config.lameStoreMm ?? 25;
    for (let y = haut + pas; y < H - 1; y += pas) {
      lines.push({ role: 'lame', x1Mm: 0, y1Mm: y, x2Mm: W, y2Mm: y });
    }
    return;
  }

  if (type === 'californien') {
    // DES BANDES VERTICALES, larges de 89 ou 127 mm : c'est vertical, et
    // c'est tout ce qui le distingue d'un enrouleur à distance.
    const bande = 127;
    for (let x = bande; x < W - 1; x += bande) {
      lines.push({ role: 'lame', x1Mm: x, y1Mm: haut, x2Mm: x, y2Mm: H });
    }
    return;
  }

  if (type === 'plisse') {
    // LES PLIS, serrés : vingt à vingt-cinq millimètres. À cette échelle
    // ils font une trame plutôt que des lignes, et c'est exactement ce
    // qu'on voit.
    for (let y = haut + 25; y < H - 1; y += 25) {
      lines.push({ role: 'rainure', x1Mm: 0, y1Mm: y, x2Mm: W, y2Mm: y });
    }
    return;
  }

  // UN ENROULEUR n'a rien à montrer qu'une toile pleine et sa barre de
  // charge. Lui dessiner des lames en ferait un vénitien.
  rects.push({ role: 'lame-finale', xMm: 0, yMm: H - 28, widthMm: W, heightMm: 28 });
}
