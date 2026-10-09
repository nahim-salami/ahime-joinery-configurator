
import { effectiveVitrage } from '../../structural.ts';
import {
  ajouterCadreMitre,
  ajouterCylindre,
  ajouterCylindreEntre,
  ajouterPave,
  ajouterPaveOriente,
  extruder,
  type Point2,
} from '../../geometrie/maillage.ts';
import {
  LAME_VOLET_ROULANT_MM,
  profilLameFinale,
  profilLameVoletRoulant,
  profilPlateBande,
  profilSeuilPMR,
} from '../../geometrie/profils.ts';
import {
  ajouterBatonDeMarechal,
  ajouterEntreeDeCle,
  ajouterGrilleVentilation,
  ajouterMoustiquaire,
  ajouterSortieDeSangle,
} from '../../geometrie/quincaillerie.ts';
import { enregistrerComplement3d, type ContexteComplement } from '../volumes-3d.ts';

/** Le pas d'une lame de volet VUE — le double de la lame réelle, comme le trait (lot D14). */
const PAS_LAME_VOLET_VUE_MM = 2 * LAME_VOLET_ROULANT_MM;

function optionsQuiSeVoient({
  atelier,
  catalog,
  config,
  cotes,
  elevation,
  monde,
  optionsIds,
  rectDormant,
  rects,
  vantaux,
  zOuvrant,
}: ContexteComplement): void {
  const ouvrantsRects = rects.filter((rect) => rect.role === 'ouvrant');
  // ---- Les options qui se voient ----
  // Elles étaient toutes tarifées sans une seule pièce en volume : un
  // client qui paie une serrure A2P, une grille de ventilation ou un seuil
  // PMR doit les voir sur son rendu.
  const cadreDormantMonde = rectDormant ? monde(rectDormant) : null;
  const rectService = ouvrantsRects.find(
    (rect) => rect.vantail === Math.max(0, vantaux - 1) && !rect.fixe,
  );

  if (cadreDormantMonde && optionsIds.includes('grille-ventilation')) {
    ajouterGrilleVentilation(
      atelier.poser('grille-ventilation', 'grille', 'quincaillerie'),
      {
        xMm: cadreDormantMonde.x + cadreDormantMonde.largeur / 2,
        yMm: cadreDormantMonde.y + cadreDormantMonde.hauteur - cotes.dormantLargeur / 2,
        zMm: cotes.dormantProfondeur * 0.5,
      },
      cadreDormantMonde.largeur,
    );
  }

  if (cadreDormantMonde && optionsIds.includes('moustiquaire')) {
    ajouterMoustiquaire(atelier.poser('moustiquaire', 'moustiquaire', 'ouvrant'), {
      xMm: cadreDormantMonde.x,
      yMm: cadreDormantMonde.y,
      largeurMm: cadreDormantMonde.largeur,
      hauteurMm: cadreDormantMonde.hauteur,
      zMm: -26,
    });
  }

  if (cadreDormantMonde && optionsIds.includes('seuil-pmr')) {
    extruder(
      atelier.poser('seuil-pmr', 'seuil', 'quincaillerie'),
      profilSeuilPMR(cotes.dormantProfondeur).map(
        ([u, v]) => [cadreDormantMonde.y + u, v] as Point2,
      ),
      'x',
      { debut: cadreDormantMonde.x, fin: cadreDormantMonde.x + cadreDormantMonde.largeur },
    );
  }

  // La porte d'entrée : béquille à l'intérieur (déjà posée), bâton de
  // maréchal et entrée de clé à l'extérieur — c'est par là qu'on l'ouvre.
  if (config.famille === 'porte-entree' && rectService) {
    const cadre = monde(rectService);
    const serrure = atelier.poser('serrure', 'serrure', 'quincaillerie', rectService.vantail);
    const cotePoignee = elevation.poignees[0]?.cote ?? 'gauche';
    const xPoignee =
      cotePoignee === 'gauche'
        ? cadre.x + cotes.ouvrantLargeur / 2
        : cadre.x + cadre.largeur - cotes.ouvrantLargeur / 2;
    ajouterBatonDeMarechal(
      serrure,
      { xMm: xPoignee, yMm: cadre.y + cadre.hauteur * 0.5, zMm: 0 },
      cadre.hauteur,
    );
    if (optionsIds.includes('serrure-a2p')) {
      ajouterEntreeDeCle(serrure, { xMm: xPoignee, yMm: cadre.y + cadre.hauteur * 0.34, zMm: 0 }, true);
    }
  }

  // La poignée à clé d'une fenêtre : l'entrée de clé sous la béquille.
  if (optionsIds.includes('poignee-cle') && rectService && config.famille !== 'porte-entree') {
    const cadre = monde(rectService);
    const poignee = elevation.poignees.find((candidate) => candidate.vantail === rectService.vantail);
    if (poignee) {
      const xPoignee =
        poignee.cote === 'gauche'
          ? cadre.x + cotes.ouvrantLargeur / 2
          : cadre.x + cadre.largeur - cotes.ouvrantLargeur / 2;
      ajouterEntreeDeCle(
        atelier.poser('poignee-cle', 'serrure', 'quincaillerie', rectService.vantail),
        { xMm: xPoignee, yMm: cadre.y + cadre.hauteur * 0.42 - 96, zMm: zOuvrant + cotes.ouvrantProfondeur },
        false,
      );
    }
  }

  // ---- Le store vénitien INTÉGRÉ, entre les verres ----
  // Il se dessine BAISSÉ, lames ouvertes : remonté, il ne se verrait pas —
  // et le client vient de payer 55 % de supplément pour lui.
  if (effectiveVitrage(config, catalog)?.storeIntegre) {
    // Les lames vivent DANS la lame d'air : au milieu de l'épaisseur du
    // vitrage, à la même profondeur que le verre lui-même.
    const zStore =
      zOuvrant + cotes.ouvrantProfondeur - cotes.vitrageEpaisseur / 2 - cotes.parcloseLargeur * 0.55;
    for (const rect of rects.filter((candidat) => candidat.role === 'clair')) {
      const cadre = monde(rect);
      const maillage = atelier.poser('store-integre', 'store-integre', 'quincaillerie', rect.vantail);
      const pas = 62;
      const nombre = Math.max(1, Math.floor(cadre.hauteur / pas) - 1);
      for (let index = 1; index <= nombre; index++) {
        // Les lames sont INCLINÉES — une lame à plat ne laisserait rien
        // passer, et un store ouvert est exactement ce qu'on veut montrer.
        ajouterPaveOriente(
          maillage,
          {
            xMm: cadre.x + cadre.largeur / 2,
            yMm: cadre.y + (index * cadre.hauteur) / (nombre + 1),
            zMm: zStore,
          },
          { xMm: cadre.largeur - 6, yMm: 24, zMm: 1.4 },
          0,
        );
      }
    }
  }
}

function blocBaieExterieur({ atelier, cotes, elevation, monde, optionsIds, rectDormant }: ContexteComplement): void {
  const cadreDormantMonde = rectDormant ? monde(rectDormant) : null;
  // ---- Le bloc-baie : coulisses et tablier, côté EXTÉRIEUR ----
  // L'élévation ne montre que le coffre (elle est une vue intérieure) ; les
  // coulisses longent la face extérieure et n'existent qu'ici.
  const rectCoffre = elevation.rects.find((rect) => rect.role === 'coffre');
  const blocBaie = rectCoffre !== undefined && cadreDormantMonde !== null;
  if (blocBaie && cadreDormantMonde) {
    const coulisseLargeur = 58;
    const coulisses = atelier.poser('coulisses', 'coulisse', 'cadre');
    for (const signe of [-1, 1]) {
      ajouterPave(coulisses, {
        xMm: signe * (cadreDormantMonde.largeur / 2 + coulisseLargeur / 2),
        yMm: cadreDormantMonde.y + cadreDormantMonde.hauteur / 2,
        zMm: -22,
      }, {
        xMm: coulisseLargeur,
        yMm: cadreDormantMonde.hauteur,
        zMm: 44,
      });
    }
    // Le tablier remonté dans son coffre : quelques lames restent visibles
    // sous le coffre, comme sur un volet ouvert.
    const cadreCoffre = monde(rectCoffre!);
    const maillageLames = atelier.poser('tablier-remonte', 'lame', 'cadre');
    for (let index = 0; index < 2; index++) {
      extruder(
        maillageLames,
        profilLameVoletRoulant(PAS_LAME_VOLET_VUE_MM, 26).map(
          ([u, v]) => [cadreCoffre.y - PAS_LAME_VOLET_VUE_MM * (index + 1) + u, v - 30] as Point2,
        ),
        'x',
        { debut: -cadreDormantMonde.largeur / 2, fin: cadreDormantMonde.largeur / 2 },
      );
    }
    // La lame finale ferme le tablier.
    extruder(
      atelier.poser('lame-finale', 'lame', 'cadre'),
      profilLameFinale(66, 30).map(([u, v]) => [cadreCoffre.y - 88 * 2 - 66 + u, v - 30] as Point2),
      'x',
      { debut: -cadreDormantMonde.largeur / 2, fin: cadreDormantMonde.largeur / 2 },
    );
    if (!optionsIds.some((id) => id.startsWith('motorisation-'))) {
      ajouterSortieDeSangle(
        atelier.poser('sortie-de-sangle', 'manoeuvre', 'quincaillerie'),
        {
          xMm: cadreDormantMonde.x + cadreDormantMonde.largeur - cotes.dormantLargeur,
          yMm: cadreDormantMonde.y + cadreDormantMonde.hauteur * 0.55,
          zMm: cotes.dormantProfondeur,
        },
      );
    }
  }
}

function decorDeLaPorte({ atelier, cotes, elevation, monde, zOuvrant }: ContexteComplement): void {
  // ---- Le décor du panneau de porte, et ses accessoires ----
  // Panneaux, moulures et inserts se posent EN RELIEF, côté rue : ce sont
  // des pièces rapportées sur le panneau, et c'est leur ombre portée qui
  // les fait lire. Les rainures, elles, sont creusées dans le panneau
  // lui-même (voir `ajouterPanneauPorte`) — un creux ne se simule pas par
  // une baguette.
  const zRelief = zOuvrant;
  for (const rect of elevation.rects) {
    if (rect.role !== 'panneau' && rect.role !== 'moulure' && rect.role !== 'insert') continue;
    const cadre = monde(rect);
    if (cadre.largeur <= 0 || cadre.hauteur <= 0) continue;
    if (rect.role === 'insert') {
      // L'inox est une plaque en applique, et il brille : sa matière est
      // celle de la quincaillerie, jamais celle du dormant.
      ajouterPave(
        atelier.poser(`insert-${rect.vantail ?? 0}-${Math.round(cadre.y)}`, 'insert', 'quincaillerie', rect.vantail),
        {
          xMm: cadre.x + cadre.largeur / 2,
          yMm: cadre.y + cadre.hauteur / 2,
          zMm: zRelief - 3,
        },
        { xMm: cadre.largeur, yMm: cadre.hauteur, zMm: 6 },
      );
      continue;
    }
    // La plate-bande d'un panneau est large et montante ; la moulure qui
    // la double est fine et plus proche du champ.
    const plateBande = rect.role === 'panneau';
    const largeurBaguette = plateBande ? Math.min(52, cadre.largeur * 0.1) : 18;
    const saillie = plateBande ? 20 : 11;
    ajouterCadreMitre(
      atelier.poser(
        `${rect.role}-${rect.vantail ?? 0}-${Math.round(cadre.y)}`,
        rect.role === 'panneau' ? 'panneau' : 'moulure',
        'panneau',
        rect.vantail,
      ),
      {
        xMm: cadre.x,
        yMm: cadre.y,
        largeurMm: cadre.largeur,
        hauteurMm: cadre.hauteur,
        zMm: zRelief - saillie,
      },
      profilPlateBande(largeurBaguette, saillie),
    );
  }

  for (const disque of elevation.disques) {
    const centre = monde({ xMm: disque.xMm, yMm: disque.yMm, widthMm: 0, heightMm: 0 });
    const maillage = atelier.poser(disque.role, disque.role, 'quincaillerie', disque.vantail);
    if (disque.role === 'judas') {
      // Le judas TRAVERSE la porte : on le voit des deux côtés, et sa
      // bague dépasse un peu de chaque face.
      ajouterCylindre(
        maillage,
        { xMm: centre.x, yMm: centre.y, zMm: zRelief - 4 },
        'z',
        disque.rayonMm,
        cotes.ouvrantProfondeur + 8,
        18,
      );
      continue;
    }
    // Le heurtoir : un anneau de fonte sur sa platine. L'anneau est
    // approché par des cordes — le noyau ne sait pas faire un tore, et
    // seize cordes ne se distinguent pas d'un cercle à cette échelle.
    ajouterCylindre(
      maillage,
      { xMm: centre.x, yMm: centre.y + disque.rayonMm * 0.9, zMm: zRelief - 6 },
      'z',
      disque.rayonMm * 0.42,
      8,
      16,
    );
    const segments = 16;
    for (let index = 0; index < segments; index++) {
      const a = (index / segments) * Math.PI * 2;
      const b = ((index + 1) / segments) * Math.PI * 2;
      ajouterCylindreEntre(
        maillage,
        {
          xMm: centre.x + Math.cos(a) * disque.rayonMm,
          yMm: centre.y + Math.sin(a) * disque.rayonMm,
          zMm: zRelief - 12,
        },
        {
          xMm: centre.x + Math.cos(b) * disque.rayonMm,
          yMm: centre.y + Math.sin(b) * disque.rayonMm,
          zMm: zRelief - 12,
        },
        7,
        8,
      );
    }
  }
}

enregistrerComplement3d('vitrees', 'decor', decorDeLaPorte);
enregistrerComplement3d('vitrees', 'ferrures', optionsQuiSeVoient);
enregistrerComplement3d('vitrees', 'apres-la-grille', blocBaieExterieur);
