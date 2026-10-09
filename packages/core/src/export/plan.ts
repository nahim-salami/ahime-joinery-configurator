/**
 * Pourquoi ce fichier existe : LE PLAN DE MASSE — la vue de dessus, la seule
 * projection que ce cœur ne savait pas produire. C'est le dessin qui évite
 * les litiges de pose, et c'est aussi la pièce DP2 d'une déclaration
 * préalable de travaux.
 *
 * Solution écartée : une projection à part, avec sa structure et son propre
 * exportateur. Le plan de masse rend une `Elevation` — la même structure que
 * le dessin de face — et `elevationToSvg()` le dessine sans une ligne de
 * plus. Une vue de dessus n'est qu'une élévation dont l'axe vertical est une
 * profondeur.
 *
 * Solution écartée n° 2 : le laisser dans `terrain.ts`, avec le métré. Le
 * PRIX a besoin du métré à chaque frappe — il est donc dans le chargement
 * initial. La vue de dessus, elle, ne sert qu'à l'onglet qui la regarde :
 * la garder à côté faisait payer le plan à qui ne l'ouvre jamais, et le
 * budget du widget l'a dit au premier calcul.
 *
 * Aucune horloge, aucun DOM, aucun aléa.
 */

import type { JoineryConfiguration } from '../types.ts';
import { DEFAULT_CATALOG, familleCatalog, type PricingCatalog } from '../catalog.ts';
import type { Elevation, ElevationCote, ElevationLine, ElevationRect } from '../drawing.ts';
import { computeMetre, tronconsDe } from '../terrain.ts';

/** L'entraxe retenu — celui du catalogue, borné par la longueur du panneau. */
function entraxeMm(catalog: PricingCatalog): number {
  return Math.max(500, catalog.cloture.entraxePoteauxMm);
}

/** Un point du plan, en millimètres, dans le repère du terrain. */
type Point = { xMm: number; yMm: number };

/**
 * LE PLAN DE MASSE — la vue de dessus. Il rend une `Elevation`, la même
 * structure que le dessin de face : `elevationToSvg()` le dessine sans une
 * ligne de plus, et le devis comme le DXF le reliront de la même façon.
 *
 * L'axe vertical n'est plus une hauteur mais une PROFONDEUR : c'est la seule
 * chose qui change, et c'est ce qui fait d'une élévation un plan.
 */
export function computePlanDeMasse(
  config: JoineryConfiguration,
  catalog: PricingCatalog = DEFAULT_CATALOG,
): Elevation | null {
  const metre = computeMetre(config, catalog);
  if (!metre) return null;

  const troncons = tronconsDe(config);
  const entraxe = entraxeMm(catalog);
  const continu = familleCatalog(catalog, config.famille).ouvrageContinu === true;
  const epaisseur = catalog.cloture.epaisseurPanneauMm;
  const poteau = catalog.cloture.sectionPoteauMm;

  // On parcourt le terrain, tronçon par tronçon, en tournant du cap de
  // chacun. Le cap part vers la droite — la lecture naturelle d'un plan.
  const rects: ElevationRect[] = [];
  const lines: ElevationLine[] = [];
  const poteauxPoses: Point[] = [];
  const jalons: Point[] = [];
  /** Les trouées, pour les coter — c'est ce qu'un instructeur cherche. */
  const ouvertures: Array<{
    label: string;
    largeurMm: number;
    declaree: boolean;
    milieu: Point;
  }> = [];
  let cap = 0;
  let position: Point = { xMm: 0, yMm: 0 };
  jalons.push(position);
  if (!continu) poteauxPoses.push(position);

  for (const [index, troncon] of troncons.entries()) {
    cap += ((troncon.angleDeg ?? 0) * Math.PI) / 180;
    const dx = Math.cos(cap);
    const dy = Math.sin(cap);
    const fin: Point = {
      xMm: position.xMm + dx * troncon.longueurMm,
      yMm: position.yMm + dy * troncon.longueurMm,
    };

    // LE TRONÇON, ET SA TROUÉE. Un trait épais du départ à l'arrivée quand
    //
    // Le premier jet dessinait le tronçon ENTIER en trait mixte dès qu'il
    // de trois disparaissait tout entière du plan, remplacée par un axe.
    //
    // La POSITION de la trouée est déclarée (`depuisDebutMm`) ou CENTRÉE
    // par convention — et dans le second cas la cote le dit, parce qu'une
    // pièce DP2 déposée en mairie ne doit pas faire passer une convention
    // pour un relevé.
    const point = (distance: number): Point => ({
      xMm: position.xMm + dx * distance,
      yMm: position.yMm + dy * distance,
    });
    const plein = (a: Point, b: Point) =>
      lines.push({
        role: 'troncon',
        x1Mm: a.xMm,
        y1Mm: a.yMm,
        x2Mm: b.xMm,
        y2Mm: b.yMm,
        vantail: index,
      });

    if (troncon.ouverture) {
      const large = Math.min(troncon.ouverture.largeurMm, troncon.longueurMm);
      const debut = Math.max(
        0,
        Math.min(
          troncon.longueurMm - large,
          troncon.ouverture.depuisDebutMm ?? (troncon.longueurMm - large) / 2,
        ),
      );
      const avant = point(debut);
      const apres = point(debut + large);
      if (debut > 1) plein(position, avant);
      lines.push({
        role: 'ligne-de-coupe',
        x1Mm: avant.xMm,
        y1Mm: avant.yMm,
        x2Mm: apres.xMm,
        y2Mm: apres.yMm,
        vantail: index,
      });
      if (troncon.longueurMm - debut - large > 1) plein(apres, fin);
      ouvertures.push({
        label: troncon.ouverture.label,
        largeurMm: large,
        declaree: troncon.ouverture.depuisDebutMm !== undefined,
        milieu: point(debut + large / 2),
      });
    } else {
      plein(position, fin);
    }

    // Les poteaux intermédiaires, à l'entraxe, plus celui de fin.
    const remplie = Math.max(0, troncon.longueurMm - (troncon.ouverture?.largeurMm ?? 0));
    const travees = continu ? 0 : Math.max(1, Math.ceil(remplie / entraxe));
    for (let pas = 1; pas <= travees; pas++) {
      const distance = (troncon.longueurMm * pas) / travees;
      poteauxPoses.push({
        xMm: position.xMm + dx * distance,
        yMm: position.yMm + dy * distance,
      });
    }
    jalons.push(fin);
    position = fin;
  }

  for (const point of poteauxPoses) {
    rects.push({
      role: 'poteau',
      xMm: point.xMm - poteau / 2,
      yMm: point.yMm - poteau / 2,
      widthMm: poteau,
      heightMm: poteau,
    });
  }

  // Le cadre du plan : la boîte de tout ce qu'on a posé, avec sa marge.
  // La boîte se calcule sur les JALONS — les extrémités des tronçons — et
  const xs = jalons.map((point) => point.xMm);
  const ys = jalons.map((point) => point.yMm);
  const xMin = Math.min(...xs) - poteau;
  const xMax = Math.max(...xs) + poteau;
  const yMin = Math.min(...ys) - poteau;
  const yMax = Math.max(...ys) + poteau;
  const marge = Math.max(400, Math.round(Math.max(xMax - xMin, yMax - yMin) * 0.12));

  const cotes: ElevationCote[] = [
    // CHAQUE TROUÉE PORTE SA COTE, et dit si sa position est relevée ou
    // supposée. Un plan de masse sans la largeur du passage oblige
    // l'instructeur à la mesurer à la règle sur un tirage.
    ...ouvertures.map(
      (ouverture): ElevationCote => ({
        code: 'ouverture',
        label: `${ouverture.label} ${ouverture.largeurMm} mm${ouverture.declaree ? '' : ' (centré)'}`,
        valeurMm: ouverture.largeurMm,
        prefixe: `${ouverture.label} `,
        orientation: 'horizontale',
        x1Mm: ouverture.milieu.xMm - ouverture.largeurMm / 2,
        y1Mm: ouverture.milieu.yMm,
        x2Mm: ouverture.milieu.xMm + ouverture.largeurMm / 2,
        y2Mm: ouverture.milieu.yMm,
        textXMm: ouverture.milieu.xMm,
        textYMm: ouverture.milieu.yMm,
      }),
    ),
    {
      code: 'longueur-developpee',
      label: `${Math.round(metre.longueurMm / 100) / 10} m développés`,
      valeurMm: metre.longueurMm,
      prefixe: '',
      orientation: 'horizontale',
      x1Mm: xMin,
      y1Mm: yMax + marge * 0.5,
      x2Mm: xMax,
      y2Mm: yMax + marge * 0.5,
      textXMm: (xMin + xMax) / 2,
      textYMm: yMax + marge * 0.5,
    },
  ];

  return {
    famille: config.famille,
    widthMm: metre.longueurMm,
    heightMm: config.heightMm,
    viewBox: {
      xMm: xMin - marge,
      yMm: yMin - marge,
      widthMm: xMax - xMin + marge * 2,
      heightMm: yMax - yMin + marge * 2,
    },
    rects,
    contours: [],
    lines,
    cotes,
    poignees: [],
    disques: [],
    couleurs: { cadreInterieur: '#8d9aa0', cadreExterieur: '#8d9aa0', vitrage: '#d9e8ec' },
    // L'épaisseur du panneau ne se voit pas en plan à cette échelle, mais
    // le DXF de la phase suivante en aura besoin : on la garde ici plutôt
    // que de la recalculer ailleurs.
    epaisseurPanneauMm: epaisseur,
  } as Elevation & { epaisseurPanneauMm: number };
}
