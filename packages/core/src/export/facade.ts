/**
 * Pourquoi ce fichier existe : LE PLAN DE FAÇADE — la pièce DP4 d'une
 * déclaration préalable, et la dernière projection que ce cœur ne savait pas
 * produire. Le DP2 (le plan de masse) dit OÙ ; le DP4 dit DE QUOI ÇA A
 * L'AIR, et c'est lui que l'instructeur regarde pour décider.
 *
 * LA DÉCISION QUI TIENT TOUT LE FICHIER : la façade est DÉCLARÉE, jamais
 * devinée. Un configurateur sait tout de la menuiserie et rien du mur qui la
 * reçoit — sa largeur, sa hauteur à l'égout, ce qu'on voit de son toit. Les
 * inventer aurait produit un dessin plausible et faux, et un DP4 faux n'est
 * pas un dessin raté : c'est une déclaration inexacte déposée en mairie, au
 * nom du client. `computePlanDeFacade()` rend donc `null` tant que la façade
 * manque, et `planDeFacadeManquant()` dit CE QUI manque, en une phrase que
 * l'écran peut afficher telle quelle.
 *
 * Solution écartée : dessiner la façade à part, avec sa structure. Elle rend
 * une `Elevation` — comme le plan de masse avant elle — et `elevationToSvg()`
 * la dessine sans une ligne de plus. Une façade n'est qu'une élévation dont
 * l'objet est le bâtiment.
 *
 * Solution écartée n° 2 : redessiner la menuiserie dans le mur. Elle est
 * calculée UNE fois par `computeElevation()` et TRANSLATÉE ici. C'est la
 * règle des néons appliquée au dessin : ce que le client a vu est ce qui
 * part en mairie, au trait près. Un second tracé aurait divergé du premier,
 * et personne n'aurait su lequel disait vrai.
 *
 * CE QUE LA PROJECTION ORTHOGONALE FAIT, et qu'on oublie en dessinant de
 * mémoire : côté GOUTTIÈRE, le faîtage — plus haut, plus loin — se rabat sur
 * une horizontale au-dessus de l'égout, et la couverture occupe la bande
 * entre les deux. Une fenêtre de toit posée dessus n'y montre pas sa hauteur
 * mais sa hauteur × sin(pente) : à 30°, une fenêtre de 1 400 mm en fait 700.
 * Un DP4 qui l'ignore dessine une lucarne deux fois trop grande.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { FacadeDeclaree, FamilleId, JoineryConfiguration } from '../types.ts';
import { DEFAULT_CATALOG, type PricingCatalog } from '../catalog.ts';
import {
  computeElevation,
  type Elevation,
  type ElevationCote,
  type ElevationLine,
  type ElevationRect,
} from '../drawing.ts';

/** Le débord de toiture retenu quand la façade n'en déclare pas, en mm. */
export const DEBORD_TOITURE_MM = 300;

/**
 * LES OUVRAGES QUI POSENT AU SOL. Leur bas est sur le terrain naturel, et
 * leur hauteur sur la façade ne se déclare pas : elle se lit.
 *
 * La liste est écrite plutôt que devinée. « Tout ce qui n'est pas une
 * fenêtre pose au sol » est faux — un volet roulant, un store banne, une
 * moustiquaire sont en hauteur — et l'aurait mis par terre sur le dessin.
 */
const POSE_AU_SOL: ReadonlySet<FamilleId> = new Set<FamilleId>([
  'porte-fenetre',
  'coulissant',
  'porte-entree',
  'porte-garage',
  'portail-battant',
  'portail-coulissant',
  'portillon',
  'cloture',
  'claustra',
  'muret',
  'totem',
  'veranda',
  'pergola',
]);

/**
 * Cet ouvrage pose-t-il au sol ? L'écran de saisie le demande pour savoir
 * s'il doit réclamer une allège — et un volet roulant, lui, est en hauteur.
 */
export function poseAuSol(famille: FamilleId): boolean {
  return POSE_AU_SOL.has(famille);
}

/** L'état représenté : le projet, ou ce qui existe avant lui. */
export type EtatFacade = 'projete' | 'existant';

const RADIAN = Math.PI / 180;

/**
 * LA HAUTEUR AU FAÎTAGE, déclarée ou déduite.
 *
 * Elle se déduit d'un PIGNON ou d'une MONOPENTE : le faîtage est au milieu
 * (ou au bout) de la largeur qu'on dessine, et la pente fait le reste. Elle
 * ne se déduit PAS côté gouttière : là, le faîtage est au milieu de la
 * PROFONDEUR du bâtiment, que ce configurateur ne connaît pas et n'a aucune
 * raison de connaître. Il faut alors la déclarer — c'est une cote du
 * formulaire, pas un calcul.
 */
export function hauteurAuFaitageMm(
  facade: FacadeDeclaree,
  penteToitureDeg?: number,
): number | null {
  if (facade.hauteurFaitageMm !== undefined) return facade.hauteurFaitageMm;
  if (facade.toiture === 'terrasse') return facade.hauteurEgoutMm;
  if (facade.toiture === 'gouttiere') return null;
  if (penteToitureDeg === undefined || penteToitureDeg <= 0) return null;
  const portee = facade.toiture === 'pignon' ? facade.largeurMm / 2 : facade.largeurMm;
  return Math.round(facade.hauteurEgoutMm + portee * Math.tan(penteToitureDeg * RADIAN));
}

/** La boîte de ce qu'un dessin occupe VRAIMENT, en millimètres. */
function boiteDuDessin(dessin: Elevation): {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
} {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  const point = (x: number, y: number) => {
    xMin = Math.min(xMin, x);
    yMin = Math.min(yMin, y);
    xMax = Math.max(xMax, x);
    yMax = Math.max(yMax, y);
  };
  for (const rect of dessin.rects) {
    point(rect.xMm, rect.yMm);
    point(rect.xMm + rect.widthMm, rect.yMm + rect.heightMm);
  }
  for (const contour of dessin.contours) {
    for (const [x, y] of contour.points) point(x, y);
  }
  for (const ligne of dessin.lines) {
    // LES TRAITS DE COUPE SONT EXCLUS, et ce n'est pas un détail : le
    // place à réserver, pas de la matière.
    if (ligne.role === 'ligne-de-coupe') continue;
    point(ligne.x1Mm, ligne.y1Mm);
    point(ligne.x2Mm, ligne.y2Mm);
  }
  if (!Number.isFinite(xMin)) return { xMm: 0, yMm: 0, widthMm: 0, heightMm: 0 };
  return { xMm: xMin, yMm: yMin, widthMm: xMax - xMin, heightMm: yMax - yMin };
}

/**
 * CE QUI MANQUE POUR DESSINER LA FAÇADE — une phrase, ou `null` si rien.
 *
 * Elle est faite pour être affichée telle quelle : un panneau vide n'apprend
 * rien à personne, et « déclarez la hauteur à l'égout » est une consigne.
 */
export function planDeFacadeManquant(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): string | null {
  if (config.famille === 'store-interieur') {
    return 'Un store intérieur ne se voit pas de la rue : aucune déclaration préalable ne le concerne, et il n’a pas de plan de façade.';
  }
  const facade = config.facade;
  if (!facade) {
    return 'La façade n’est pas déclarée. Un plan de façade se dessine sur des cotes relevées — largeur, hauteur à l’égout, ce qu’on voit du toit — et un DP4 inventé est une déclaration inexacte, pas un dessin raté.';
  }
  if (!(facade.largeurMm > 0)) return 'Largeur de façade manquante : mesurez-la d’angle à angle.';
  if (!(facade.hauteurEgoutMm > 0)) {
    return 'Hauteur à l’égout manquante : c’est la première des deux cotes qu’un instructeur lit, et elle se mesure depuis le terrain naturel.';
  }
  const faitage = hauteurAuFaitageMm(facade, config.penteToitureDeg);
  if (faitage === null) {
    return facade.toiture === 'gouttiere'
      ? 'Hauteur au faîtage manquante. De ce côté-ci elle ne se déduit pas de la largeur : le faîtage est au milieu de la PROFONDEUR du bâtiment. Déclarez-la, comme sur le formulaire.'
      : 'Hauteur au faîtage manquante, et la pente du toit non plus : l’une des deux suffit.';
  }
  if (faitage < facade.hauteurEgoutMm) {
    return `Faîtage annoncé à ${faitage} mm, sous l’égout à ${facade.hauteurEgoutMm} mm : une des deux cotes est fausse. Un faîtage est le point haut.`;
  }
  if (config.famille === 'fenetre-toit') {
    if (facade.toiture !== 'gouttiere') {
      return 'Sur un pignon comme sur une monopente, la pente est vue DE CHAMP : la fenêtre de toit n’y apparaît pas. C’est la façade côté gouttière qu’il faut dessiner.';
    }
    if (config.penteToitureDeg === undefined) {
      return 'Pente du toit manquante. Vue de face, une fenêtre de toit ne montre pas sa hauteur mais sa hauteur × sin(pente) — sans la pente, le dessin la ferait presque deux fois trop grande.';
    }
  }
  const largeurOuvrage = boiteDuDessin(computeElevation(config, catalog)).widthMm;
  if (largeurOuvrage > facade.largeurMm) {
    return `L’ouvrage fait ${Math.round(largeurOuvrage)} mm de large et la façade ${facade.largeurMm} : il n’y entre pas. Vérifiez laquelle des deux cotes est la bonne.`;
  }
  // UNE FENÊTRE DE TOIT N'A PAS D'ALLÈGE : elle est dans la pente, pas dans
  // le mur. Lui en réclamer une aurait été réclamer une cote qui n'existe
  // pas — et le dessin la place, lui, dans la bande de couverture.
  if (
    config.famille !== 'fenetre-toit' &&
    !POSE_AU_SOL.has(config.famille) &&
    config.hauteurAllegeMm === undefined
  ) {
    return 'Hauteur d’allège manquante : sans elle, l’ouvrage se poserait par terre sur le dessin. C’est la cote du terrain naturel au bas de la menuiserie.';
  }
  return null;
}

/**
 * LE PLAN DE FAÇADE — la pièce DP4. Il rend une `Elevation`, comme le plan
 * de masse : `elevationToSvg()` le dessine sans une ligne de plus, et le
 * devis comme le dossier le reliront de la même façon.
 *
 * L'origine est en haut du POINT LE PLUS HAUT — faîtage ou acrotère — et
 * l'axe vertical descend jusqu'au terrain naturel. Toutes les hauteurs d'un
 * DP4 se mesurent depuis ce terrain : c'est pour cela qu'il est dessiné.
 */
export function computePlanDeFacade(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
  options: { etat?: EtatFacade } = {},
): Elevation | null {
  if (planDeFacadeManquant(config, catalog)) return null;
  const facade = config.facade!;
  const etat = options.etat ?? 'projete';

  const largeur = facade.largeurMm;
  const hEgout = facade.hauteurEgoutMm;
  const hFaitage = hauteurAuFaitageMm(facade, config.penteToitureDeg)!;
  const debord = facade.toiture === 'terrasse' ? 0 : (facade.debordToitureMm ?? DEBORD_TOITURE_MM);

  // Le repère : y = 0 au point le plus haut, y croissant vers le bas, le
  // terrain naturel à `ySol`. C'est le repère d'une élévation, et il évite
  // d'inverser un axe entre le dessin de la menuiserie et celui du mur.
  const ySol = hFaitage;
  const yEgout = hFaitage - hEgout;

  const rects: ElevationRect[] = [];
  const lines: ElevationLine[] = [];
  const contours: Elevation['contours'] = [];

  // --- LE MUR, du terrain naturel à l'égout.
  rects.push({ role: 'maconnerie', xMm: 0, yMm: yEgout, widthMm: largeur, heightMm: hEgout });

  // --- LA COUVERTURE, telle qu'on la voit DE CETTE FAÇADE.
  const xg = -debord;
  const xd = largeur + debord;
  if (facade.toiture === 'pignon') {
    contours.push({
      role: 'toiture',
      points: [
        [xg, yEgout],
        [largeur / 2, 0],
        [xd, yEgout],
      ],
    });
  } else if (facade.toiture === 'monopente') {
    contours.push({
      role: 'toiture',
      points: [
        [xg, yEgout],
        [xd, 0],
        [xd, yEgout],
      ],
    });
  } else if (facade.toiture === 'gouttiere') {
    // LA BANDE. Le faîtage se rabat sur une horizontale au-dessus de
    // l'égout : c'est ce que fait une projection orthogonale, et c'est ce
    // qui distingue un long-pan d'un pignon sur le même toit.
    rects.push({ role: 'toiture', xMm: xg, yMm: 0, widthMm: xd - xg, heightMm: yEgout });
  } else if (yEgout > 0) {
    // n'existe que si le faîtage déclaré dépasse l'égout.
    rects.push({ role: 'maconnerie', xMm: 0, yMm: 0, widthMm: largeur, heightMm: yEgout });
  }

  // --- L'OUVRAGE, calculé une seule fois et TRANSLATÉ.
  const dessin = computeElevation(config, catalog);
  const boite = boiteDuDessin(dessin);
  const surLeToit = config.famille === 'fenetre-toit';
  // Vue de face, une fenêtre de toit ne montre pas sa hauteur : elle montre
  // sa composante VERTICALE. À 30°, une fenêtre de 1 400 mm en fait 700.
  const raccourci = surLeToit ? Math.sin((config.penteToitureDeg ?? 0) * RADIAN) : 1;
  const largeurPosee = boite.widthMm;
  const hauteurPosee = boite.heightMm * raccourci;
  const x0 = facade.implantationXMm ?? Math.round((largeur - largeurPosee) / 2);
  const yBas = surLeToit
    ? yEgout - (yEgout - hauteurPosee) / 2
    : ySol - (POSE_AU_SOL.has(config.famille) ? 0 : (config.hauteurAllegeMm ?? 0));
  const yHaut = yBas - hauteurPosee;

  if (etat === 'projete') {
    const dx = x0 - boite.xMm;
    const dy = yHaut - boite.yMm * raccourci;
    const py = (y: number) => y * raccourci + dy;
    for (const rect of dessin.rects) {
      rects.push({
        ...rect,
        xMm: rect.xMm + dx,
        yMm: py(rect.yMm),
        heightMm: rect.heightMm * raccourci,
      });
    }
    for (const contour of dessin.contours) {
      contours.push({
        ...contour,
        points: contour.points.map(([x, y]) => [x + dx, py(y)] as [number, number]),
      });
    }
    for (const ligne of dessin.lines) {
      // LE TRAIT DE COUPE EST DESSINÉ, bien qu'il ne compte pas dans la
      lines.push({
        ...ligne,
        x1Mm: ligne.x1Mm + dx,
        y1Mm: py(ligne.y1Mm),
        x2Mm: ligne.x2Mm + dx,
        y2Mm: py(ligne.y2Mm),
      });
    }
  } else if (config.pose === 'renovation' || config.pose === 'depose-totale') {
    // L'ÉTAT EXISTANT D'UN REMPLACEMENT : la baie est déjà là, et c'est
    // tout ce qu'on peut en dire honnêtement — sa forme, pas sa menuiserie,
    // qu'on n'a pas relevée. D'où le trait interrompu du rôle `existant`.
    rects.push({
      role: 'existant',
      xMm: x0,
      yMm: yHaut,
      widthMm: largeurPosee,
      heightMm: hauteurPosee,
    });
  }
  // la façade NUE. Ne rien dessiner de plus est ici la réponse juste : le
  // DP4 demande deux vues pour montrer la différence, et la différence est
  // que l'ouvrage n'y était pas.

  // --- LE TERRAIN NATUREL. Toutes les cotes d'un DP4 partent de lui.
  const margeTerrain = Math.max(600, Math.round(largeur * 0.08));
  lines.push({
    role: 'terrain',
    x1Mm: xg - margeTerrain,
    y1Mm: ySol,
    x2Mm: xd + margeTerrain,
    y2Mm: ySol,
  });

  const marge = Math.max(500, Math.round(Math.max(largeur, hFaitage) * 0.12));
  const cote = (
    code: string,
    valeurMm: number,
    orientation: ElevationCote['orientation'],
    x1Mm: number,
    y1Mm: number,
    x2Mm: number,
    y2Mm: number,
    prefixe = '',
  ): ElevationCote => ({
    code,
    label: `${prefixe}${Math.round(valeurMm)} mm`,
    valeurMm: Math.round(valeurMm),
    prefixe,
    orientation,
    x1Mm,
    y1Mm,
    x2Mm,
    y2Mm,
    textXMm: (x1Mm + x2Mm) / 2,
    textYMm: (y1Mm + y2Mm) / 2,
  });

  const cotes: ElevationCote[] = [
    cote(
      'facade-largeur',
      largeur,
      'horizontale',
      0,
      ySol + marge * 0.55,
      largeur,
      ySol + marge * 0.55,
    ),
    cote('facade-egout', hEgout, 'verticale', -marge * 0.5, yEgout, -marge * 0.5, ySol, 'égout '),
  ];
  if (hFaitage > hEgout) {
    cotes.push(cote('facade-faitage', hFaitage, 'verticale', -marge, 0, -marge, ySol, 'faîtage '));
  }
  if (etat === 'projete' || rects.some((rect) => rect.role === 'existant')) {
    // L'IMPLANTATION est la cote que l'instructeur recoupe avec le plan de
    // masse : elle dit où l'ouvrage tombe sur le mur, et sans elle les deux
    // pièces du dossier ne se répondent pas.
    if (x0 > 0) {
      cotes.push(
        cote('facade-implantation', x0, 'horizontale', 0, ySol + marge * 0.2, x0, ySol + marge * 0.2),
      );
    }
    const allege = ySol - yBas;
    if (allege > 0 && !surLeToit) {
      cotes.push(
        cote(
          'facade-allege',
          allege,
          'verticale',
          x0 + largeurPosee + marge * 0.25,
          yBas,
          x0 + largeurPosee + marge * 0.25,
          ySol,
          'allège ',
        ),
      );
    }
  }

  // LE CADRE se ferme sur TOUT ce qui a été posé, cotes comprises. Le
  // sur le seul mur, il aurait été coupé — et une place à réserver qu'on ne
  // voit pas ne sert à rien.
  let cadreXMin = xg - marge * 1.3;
  let cadreYMin = -marge * 0.35;
  let cadreXMax = xd + marge * 0.7;
  let cadreYMax = hFaitage + marge * 0.95;
  const etendre = (x: number, y: number) => {
    cadreXMin = Math.min(cadreXMin, x);
    cadreYMin = Math.min(cadreYMin, y);
    cadreXMax = Math.max(cadreXMax, x);
    cadreYMax = Math.max(cadreYMax, y);
  };
  for (const rect of rects) {
    etendre(rect.xMm, rect.yMm);
    etendre(rect.xMm + rect.widthMm, rect.yMm + rect.heightMm);
  }
  for (const contour of contours) for (const [x, y] of contour.points) etendre(x, y);
  for (const ligne of lines) {
    etendre(ligne.x1Mm, ligne.y1Mm);
    etendre(ligne.x2Mm, ligne.y2Mm);
  }
  for (const mesure of cotes) {
    etendre(mesure.x1Mm, mesure.y1Mm);
    etendre(mesure.x2Mm, mesure.y2Mm);
  }

  return {
    famille: config.famille,
    widthMm: largeur,
    heightMm: hFaitage,
    viewBox: {
      xMm: cadreXMin,
      yMm: cadreYMin,
      widthMm: cadreXMax - cadreXMin,
      heightMm: cadreYMax - cadreYMin,
    },
    rects,
    contours,
    lines,
    cotes,
    poignees: [],
    disques: [],
    couleurs: dessin.couleurs,
  };
}
