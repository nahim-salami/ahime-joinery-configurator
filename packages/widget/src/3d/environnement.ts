
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

export const TEINTES = {
  enduit: '#e6ded1',
  enduitOmbre: '#d5cbbb',
  toiture: '#9a5f4c',
  menuiserieVoisine: '#454f56',
  vitrageVoisin: '#7c8f99',
  porteGarage: '#c9ccce',
  gazon: '#7d9668',
  // décor depuis son premier jour. Encore faut-il la VOIR : à #5d7a52 sur une
  // pelouse à #7d9668, l'écart de clarté perçue valait 0,111, et le
  // Foncée, il vaut 0,148 — la haie se détache, et rien d'autre ne bouge.
  haie: '#55704a',
  enrobe: '#6b6660',
  plafond: '#f2efe9',
  parquet: '#b99a72',
} as const;

/** Les matières du décor, faites une fois et partagées par toutes les pièces. */
export interface MatieresDecor {
  enduit: MeshStandardMaterial;
  enduitOmbre: MeshStandardMaterial;
  toiture: MeshStandardMaterial;
  menuiserieVoisine: MeshStandardMaterial;
  vitrageVoisin: MeshStandardMaterial;
  porteGarage: MeshStandardMaterial;
  gazon: MeshStandardMaterial;
  haie: MeshStandardMaterial;
  enrobe: MeshStandardMaterial;
  plafond: MeshStandardMaterial;
  parquet: MeshStandardMaterial;
}

export function matieresDecor(document_?: Document): MatieresDecor {
  // LE GRAIN DE L'ENDUIT. Une façade parfaitement lisse se lit comme un
  // carton peint ; deux millimètres de grain suffisent à la rendre
  // crédible, et ils accrochent la lumière rasante du soleil bas.
  const grain = document_
    ? textureDeGrain(document_, { intensite: 0.5, etirement: 1, taille: 48 })
    : null;
  if (grain) grain.repeat.set(14, 14);
  const mat = (hex: string, rugosite: number, texture: CanvasTexture | null = null) => {
    const matiere = new MeshStandardMaterial({ color: new Color(hex), roughness: rugosite, metalness: 0 });
    if (texture) {
      // La texture MODULE la teinte : posée en carte de rugosité, elle
      // fait varier le reflet sans salir la couleur — c'est exactement ce
      // qu'un enduit fait à la lumière.
      matiere.roughnessMap = texture;
    }
    return matiere;
  };
  return {
    enduit: mat(TEINTES.enduit, 0.95, grain),
    enduitOmbre: mat(TEINTES.enduitOmbre, 0.95),
    toiture: mat(TEINTES.toiture, 0.85),
    menuiserieVoisine: mat(TEINTES.menuiserieVoisine, 0.7),
    // Le vitrage du voisinage est OPAQUE et sombre : une vitre transparente
    // sur une maison vide laisserait voir l'intérieur de la boîte, et le
    // décor trahirait qu'il n'en est pas une.
    vitrageVoisin: mat(TEINTES.vitrageVoisin, 0.25),
    porteGarage: mat(TEINTES.porteGarage, 0.6),
    gazon: mat(TEINTES.gazon, 1),
    haie: mat(TEINTES.haie, 1),
    enrobe: mat(TEINTES.enrobe, 0.98),
    plafond: mat(TEINTES.plafond, 0.97),
    parquet: mat(TEINTES.parquet, 0.75),
  };
}

export function texturePourLeCiel(document_: Document): CanvasTexture | null {
  const canevas = document_.createElement('canvas');
  canevas.width = 2;
  canevas.height = 256;
  const pinceau = canevas.getContext('2d');
  // Un canevas sans contexte 2D arrive : impression, capture de vignette,
  // navigateur bridé. Le ciel est un agrément, jamais une condition.
  if (!pinceau) return null;
  const degrade = pinceau.createLinearGradient(0, 0, 0, 256);
  degrade.addColorStop(0, '#8fb4d6');
  degrade.addColorStop(0.62, '#cfdeea');
  degrade.addColorStop(1, '#eef2f2');
  pinceau.fillStyle = degrade;
  pinceau.fillRect(0, 0, 2, 256);
  const texture = new CanvasTexture(canevas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * L'ENVIRONNEMENT À RÉFLÉCHIR — ciel EN HAUT, sol EN BAS, horizon entre les
 * deux.
 *
 * Le fond de scène est un dégradé de ciel : il convient pour ce qu'on voit
 * DERRIÈRE la menuiserie. Il ne convient pas pour ce qu'elle REFLÈTE. Un
 * verre vu de biais renvoie presque tout ce qui lui fait face ; si cela est
 * un aplat pâle, la vitre devient un panneau opaque et l'on perd les
 * petits-bois qu'on est en train d'acheter — c'est ce qui est arrivé au
 * premier essai du verre physique.
 *
 * Un reflet se LIT quand il porte une ligne d'horizon : l'œil comprend
 * alors qu'il regarde un reflet, et continue de voir au travers. D'où cette
 * seconde texture, avec un sol sous l'horizon. Toujours dessinée au
 * canevas, toujours zéro téléchargement.
 */
export function textureEnvironnement(document_: Document): CanvasTexture | null {
  const canevas = document_.createElement('canvas');
  canevas.width = 4;
  canevas.height = 256;
  const pinceau = canevas.getContext('2d');
  if (!pinceau) return null;
  const degrade = pinceau.createLinearGradient(0, 0, 0, 256);
  // Le ciel occupe la moitié haute, le sol la moitié basse. La transition
  // est FRANCHE : c'est la ligne d'horizon, et c'est elle qui rend le
  // reflet lisible.
  degrade.addColorStop(0, '#7ba6cf');
  degrade.addColorStop(0.42, '#cfe0ee');
  degrade.addColorStop(0.5, '#e8eef0');
  degrade.addColorStop(0.52, '#9aa08e');
  degrade.addColorStop(1, '#5e6553');
  pinceau.fillStyle = degrade;
  pinceau.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canevas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function textureDeGrain(
  document_: Document,
  options: { intensite: number; etirement: number; taille?: number },
): CanvasTexture | null {
  const taille = options.taille ?? 64;
  const canevas = document_.createElement('canvas');
  canevas.width = taille;
  canevas.height = taille;
  const pinceau = canevas.getContext('2d');
  if (!pinceau) return null;
  const image = pinceau.createImageData(taille, taille);
  // Un bruit à valeur moyenne 128 : la texture MODULE la couleur de base,
  // elle ne la remplace pas. Le générateur est déterministe — deux rendus
  // de la même scène doivent donner la même image, sinon les captures de
  // contrôle deviennent illisibles.
  let graine = 0x2f6e2b;
  const suivant = () => {
    graine = (graine * 1103515245 + 12345) & 0x7fffffff;
    return graine / 0x7fffffff;
  };
  const etirement = Math.max(1, options.etirement);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      // L'étirement fait varier le bruit LENTEMENT selon x : deux pixels
      // voisins d'une même ligne se ressemblent, deux lignes voisines non.
      const u = Math.floor(x / etirement);
      const valeur = suivantStable(u, y, suivant);
      const canal = 128 + (valeur - 0.5) * 255 * options.intensite;
      const index = (y * taille + x) * 4;
      image.data[index] = image.data[index + 1] = image.data[index + 2] = Math.max(0, Math.min(255, canal));
      image.data[index + 3] = 255;
    }
  }
  pinceau.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canevas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/**
 * Un bruit reproductible pour une case donnée. Le générateur linéaire est
 * consommé dans un ordre fixe : deux appels sur la même case rendent la
 * même valeur tant qu'on parcourt l'image dans le même sens.
 */
function suivantStable(u: number, v: number, suivant: () => number): number {
  // Un mélange bon marché : on hache les coordonnées, le tirage sert de sel.
  const h = Math.sin(u * 127.1 + v * 311.7) * 43758.5453;
  return (h - Math.floor(h) + suivant()) / 2;
}

/**
 * Une boîte du décor, en millimètres.
 *
 * `fond` distingue ce qui est LOIN — la maison, la haie, le voisinage. Ces
 * pièces ne PROJETTENT pas d'ombre : la caméra d'ombre du soleil est
 * dimensionnée sur le produit, et une maison à huit mètres tomberait hors
 * de son champ. Son ombre s'y couperait net, en travers de l'allée, et
 * c'est plus laid que pas d'ombre du tout.
 */
export function boite(
  nom: string,
  materiau: MeshStandardMaterial,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  fond = false,
): Mesh | null {
  const largeur = (x1 - x0) / 1000;
  const hauteur = (y1 - y0) / 1000;
  const profondeur = (z1 - z0) / 1000;
  if (largeur <= 0.0001 || hauteur <= 0.0001 || profondeur <= 0.0001) return null;
  const maille = new Mesh(new BoxGeometry(largeur, hauteur, profondeur), materiau);
  maille.name = nom;
  maille.position.set((x0 + x1) / 2000, (y0 + y1) / 2000, (z0 + z1) / 2000);
  maille.castShadow = !fond;
  maille.receiveShadow = true;
  return maille;
}

/**
 * Un triangle vertical — le pignon d'un toit à deux pentes.
 *
 * Il se pose DIRECTEMENT dans le repère du monde : ses trois sommets sont
 * donnés en (z, y), et `xMm` dit à quelle abscisse le plan se trouve. Le
 * premier jet le construisait à plat puis le faisait tourner d'un quart de
 * tour, en lui donnant SA POSITION EN PLUS — l'abscisse s'appliquait donc
 * deux fois, et un pignon partait à vingt-deux mètres devant la maison.
 * C'est le test « la maison est derrière, jamais devant » qui l'a dit.
 */
function pignon(
  nom: string,
  materiau: MeshStandardMaterial,
  sommetsZY: Array<[number, number]>,
  xMm: number,
): Mesh {
  const m = (valeur: number) => valeur / 1000;
  const positions: number[] = [];
  // Les deux faces, pour que le pignon se voie des deux côtés — on tourne
  // autour de la scène, et un pignon à une seule face disparaît de dos.
  for (const inverse of [false, true]) {
    const ordre = inverse ? [0, 2, 1] : [0, 1, 2];
    for (const index of ordre) {
      positions.push(m(xMm), m(sommetsZY[index][1]), m(sommetsZY[index][0]));
    }
  }
  const geometrie = new BufferGeometry();
  geometrie.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometrie.computeVertexNormals();
  const maille = new Mesh(geometrie, materiau);
  maille.name = nom;
  maille.receiveShadow = true;
  return maille;
}

export interface OptionsMaison {
  /** La largeur de la maison, en millimètres. */
  largeurMm: number;
  /** Sa profondeur — ce qu'elle occupe en s'éloignant. */
  profondeurMm: number;
  /** La hauteur sous gouttière, puis la montée du toit jusqu'au faîtage. */
  gouttiereMm: number;
  faitageMm: number;
  /** Où se pose sa façade sur l'axe z, et à quelle hauteur son rez-de-chaussée. */
  zFacadeMm: number;
  solMm: number;
  /** Un GARAGE dans la façade — l'entrée d'une maison en a presque toujours un. */
  garage?: boolean;
  /** De combien elle se décale latéralement : une maison jamais tout à fait en face. */
  decalageXMm?: number;
}

export function construireMaison(matieres: MatieresDecor, options: OptionsMaison): Group {
  const groupe = new Group();
  groupe.name = 'maison';
  const pieces: Array<Mesh | null> = [];

  const dx = options.decalageXMm ?? 0;
  const demi = options.largeurMm / 2;
  const x0 = dx - demi;
  const x1 = dx + demi;
  const yBas = options.solMm;
  const yGouttiere = yBas + options.gouttiereMm;
  const yFaitage = yBas + options.faitageMm;
  const zAvant = options.zFacadeMm;
  const zArriere = zAvant + options.profondeurMm;

  // LE CORPS.
  pieces.push(boite('maison-corps', matieres.enduit, x0, x1, yBas, yGouttiere, zAvant, zArriere, true));

  // LE TOIT À DEUX PENTES. Le faîtage court parallèlement à la façade : les
  // deux pans regardent la rue et le jardin, comme la plupart des maisons
  // d'un lotissement. Chaque pan est une dalle inclinée, posée par sa
  // rotation autour de l'axe du faîtage.
  const debordToit = 260;
  const zMilieu = (zAvant + zArriere) / 2;
  const demiProfondeur = options.profondeurMm / 2 + debordToit;
  const monteeMm = options.faitageMm - options.gouttiereMm;
  const penteLongueur = Math.hypot(demiProfondeur, monteeMm);
  for (const sens of [-1, 1] as const) {
    const pan = boite(
      'maison-toit',
      matieres.toiture,
      x0 - debordToit,
      x1 + debordToit,
      -60,
      0,
      -penteLongueur / 2,
      penteLongueur / 2,
      true,
    );
    if (!pan) continue;
    // On pose la dalle à plat puis on l'incline : son centre tombe à
    // mi-pente, entre la gouttière et le faîtage.
    pan.position.set(
      dx / 1000,
      (yGouttiere + monteeMm / 2) / 1000,
      (zMilieu + (sens * demiProfondeur) / 2) / 1000,
    );
    pan.rotation.x = sens * Math.atan2(monteeMm, demiProfondeur);
    groupe.add(pan);
  }
  // Les deux PIGNONS, qui bouchent les triangles sous le toit.
  for (const x of [x0, x1]) {
    groupe.add(
      pignon(
        'maison-pignon',
        matieres.enduitOmbre,
        [
          [zAvant, yGouttiere],
          [zArriere, yGouttiere],
          [zMilieu, yFaitage],
        ],
        x,
      ),
    );
  }

  // LA PORTE D'ENTRÉE et les FENÊTRES, en léger relief sur la façade.
  const saillie = 30;
  const zFace = zAvant - saillie;
  const hauteurPorte = 2150;
  const largeurPorte = 950;
  const xPorte = options.garage ? dx + demi * 0.28 : dx;
  pieces.push(
    boite(
      'maison-porte',
      matieres.menuiserieVoisine,
      xPorte - largeurPorte / 2,
      xPorte + largeurPorte / 2,
      yBas,
      yBas + hauteurPorte,
      zFace,
      zAvant,
      true,
    ),
  );

  if (options.garage) {
    // LE GARAGE — porte sectionnelle, à gauche de l'entrée. C'est vers lui
    const largeurGarage = Math.min(2600, options.largeurMm * 0.36);
    const xGarage = dx - demi * 0.42;
    pieces.push(
      boite(
        'maison-garage',
        matieres.porteGarage,
        xGarage - largeurGarage / 2,
        xGarage + largeurGarage / 2,
        yBas,
        yBas + 2150,
        zFace,
        zAvant,
        true,
      ),
    );
  }

  // Deux fenêtres au rez, deux à l'étage — assez pour qu'une façade se lise
  // comme une façade, pas assez pour qu'on la compte.
  const largeurFenetre = 1100;
  const hauteurFenetre = 1250;
  for (const [rang, yAppui] of [
    [0, yBas + 900],
    [1, yBas + options.gouttiereMm * 0.58],
  ] as const) {
    for (const cote of [-1, 1] as const) {
      const x = dx + cote * demi * (rang === 0 ? 0.72 : 0.5);
      // Au rez, la fenêtre de gauche tomberait sur la porte de garage.
      if (rang === 0 && options.garage && cote < 0) continue;
      pieces.push(
        boite(
          `maison-fenetre`,
          matieres.vitrageVoisin,
          x - largeurFenetre / 2,
          x + largeurFenetre / 2,
          yAppui,
          yAppui + hauteurFenetre,
          zFace,
          zAvant,
          true,
        ),
      );
    }
  }

  for (const piece of pieces) if (piece) groupe.add(piece);
  return groupe;
}

/** Une HAIE : le rideau vert qui ferme un jardin, et qui dit où il s'arrête. */
export function construireHaie(
  matieres: MatieresDecor,
  options: { x0Mm: number; x1Mm: number; zMm: number; hauteurMm: number; solMm: number },
): Mesh | null {
  return boite(
    'haie',
    matieres.haie,
    options.x0Mm,
    options.x1Mm,
    // Une haie S'ENFONCE : elle est plantée, pas posée. Vingt millimètres,
    // qui évitent en passant que son dessous partage le plan du rail ou du
    // gazon — deux faces au même endroit clignotent l'une sur l'autre.
    options.solMm - 20,
    options.solMm + options.hauteurMm,
    options.zMm - 350,
    options.zMm + 350,
    true,
  );
}

export function construireAllee(
  matieres: MatieresDecor,
  options: { largeurMm: number; z0Mm: number; z1Mm: number; solMm: number },
): Mesh | null {
  return boite(
    'allee',
    matieres.enrobe,
    -options.largeurMm / 2,
    options.largeurMm / 2,
    options.solMm - 4,
    options.solMm + 6,
    options.z0Mm,
    options.z1Mm,
    true,
  );
}

/**
 * UNE PIÈCE — sol, plafond, murs de retour.
 *
 * On regarde une fenêtre depuis le logement : sans pièce autour, le mur
 * percé flottait dans le vide et le client voyait un fragment de maçonnerie,
 * pas sa chambre. Le plafond compte autant que le sol — c'est lui qui dit la
 * hauteur sous plafond, et donc si la fenêtre est haute.
 *
 * Il n'y a PAS de mur du fond : la caméra est dedans, et un quatrième mur
 * lui passerait derrière la nuque sans rien apporter.
 */
export function construirePiece(
  matieres: MatieresDecor,
  options: {
    demiLargeurMm: number;
    solMm: number;
    plafondMm: number;
    zDebutMm: number;
    profondeurMm: number;
    /**
     * SOUS UN COMBLE, IL N'Y A PAS DE PLAFOND — il y a le rampant. La
     * fonction reçoit alors la hauteur libre à gauche et à droite, lues sur
     * la pente du toit, et se passe de dalle : c'est le versant lui-même,
     * posé par le décor, qui ferme la pièce par le haut.
     *
     * Sans cela, la dalle de plafond et les murs de retour dépassaient du
     * mur coupé et s'affichaient AU-DESSUS du toit — une boîte beige en
     * plein ciel, la pièce vue du dehors.
     */
    sousRampant?: { gaucheMm: number; droiteMm: number };
  },
): Group {
  const groupe = new Group();
  groupe.name = 'piece';
  const { demiLargeurMm: demi, solMm, plafondMm, zDebutMm, profondeurMm } = options;
  const zFin = zDebutMm + profondeurMm;
  const epaisseur = 120;
  const rampant = options.sousRampant;
  const hautGauche = rampant ? Math.min(plafondMm, rampant.gaucheMm) : plafondMm;
  const hautDroite = rampant ? Math.min(plafondMm, rampant.droiteMm) : plafondMm;

  const pieces = [
    // Le SOL de la pièce — parquet clair, pour qu'il se distingue du sol
    // extérieur qu'on voit par la fenêtre.
    boite('piece-sol', matieres.parquet, -demi, demi, solMm - 20, solMm, zDebutMm, zFin, true),
    // Le PLAFOND, sauf sous un rampant : c'est le versant qui en tient lieu.
    rampant
      ? null
      : boite('piece-plafond', matieres.plafond, -demi, demi, plafondMm, plafondMm + 20, zDebutMm, zFin, true),
    // Les deux murs de retour, qui referment la pièce sur les côtés.
    boite('piece-mur', matieres.enduit, -demi - epaisseur, -demi, solMm, hautGauche, zDebutMm, zFin, true),
    boite('piece-mur', matieres.enduit, demi, demi + epaisseur, solMm, hautDroite, zDebutMm, zFin, true),
    // LA PLINTHE — et c'est le seul détail de cette pièce qui se voie à
    // TOUTES les échelles.
    //
    // Une pièce a un sol, un plafond et des murs de retour ; cadrée sur une
    // rien n'entre dans l'image. Le plafond est à 2,50 m, les murs de retour
    // à deux mètres et demi de chaque côté : la capture du lot D18 ne
    // les deux. Le décor était là, et il ne disait plus rien — ni où est le
    // sol, ni quelle taille fait l'ouvrage.
    //
    // La plinthe, elle, est EXACTEMENT à la jonction du mur et du sol, donc
    // toujours derrière l'ouvrage qu'on cadre. Et elle fait 80 mm : une cote
    // que tout le monde a chez soi, ce qui en fait un étalon gratuit.
    boite(
      'piece-plinthe',
      matieres.plafond,
      -demi,
      demi,
      solMm,
      solMm + 80,
      zDebutMm,
      zDebutMm + 22,
      true,
    ),
  ];
  for (const piece of pieces) if (piece) groupe.add(piece);
  return groupe;
}

/**
 * LE DEHORS qu'on voit par la fenêtre : la pelouse, une haie, et la maison
 * d'en face.
 *
 * C'est ce qui donne enfin une PROFONDEUR au clair de vitrage. Devant un
 * fond uni, une baie de quatre mètres et un châssis de soixante centimètres
 * se ressemblent ; devant un jardin, on voit tout de suite lequel des deux
 * on regarde.
 */
export function construireDehors(
  matieres: MatieresDecor,
  options: {
    demiLargeurMm: number;
    solMm: number;
    hauteurOuvrageMm: number;
    zFondMm?: number;
  },
): Group {
  const groupe = new Group();
  groupe.name = 'dehors';
  const portee = Math.max(16000, options.demiLargeurMm * 8);

  const pieces: Array<Mesh | null | Group> = [
    boite(
      'pelouse',
      matieres.gazon,
      -portee,
      portee,
      // LE TERRAIN EST SOUS LE PLANCHER, franchement. Il affleurait à dix
      // millimètres du parquet et le CHEVAUCHAIT de vingt : tant qu'il
      // s'arrêtait au nu du mur, cela ne se voyait pas ; maintenant qu'il
      // passe dessous, deux dalles au même niveau se disputeraient le pixel.
      // Trente-cinq millimètres de moins que le plancher fini, comme dehors.
      options.solMm - 55,
      options.solMm - 35,
      -portee,
      options.zFondMm ?? -60,
      true,
    ),
  ];

  /**
   * LE VIS-À-VIS — la haie et la maison d'en face.
   *
   * Il vit dans un GROUPE À PART, et c'est tout l'objet de ce découpage :
   * ces deux pièces-là n'existent que pour être vues PAR LA FENÊTRE. Dès
   * qu'on passe du côté de la rue et qu'on recule un peu, la caméra les
   * dépasse et elles s'interposent entre l'œil et le produit — un volet
   * battant, qu'on regarde du dehors par définition, s'affichait avec DEUX
   * maisons, celle qu'il habille et celle d'en face par-dessus.
   *
   * La scène éteint ce groupe quand la caméra est dehors. La PELOUSE, elle,
   * reste : c'est le terrain, et la maison est posée dessus des deux côtés.
   */
  const visAVis = new Group();
  visAVis.name = 'vis-a-vis';
  groupe.add(visAVis);
  const dansLeVisAVis: Array<Mesh | null | Group> = [
    construireHaie(matieres, {
      x0Mm: -portee,
      x1Mm: portee,
      zMm: -7000,
      hauteurMm: 1600,
      solMm: options.solMm,
    }),
  ];
  // LA MAISON D'EN FACE, derrière la haie. Elle est décalée : deux maisons
  // exactement en face l'une de l'autre, cela n'arrive que sur un plan.
  dansLeVisAVis.push(
    construireMaison(matieres, {
      largeurMm: 9000,
      profondeurMm: 7000,
      gouttiereMm: 4600,
      faitageMm: 6800,
      zFacadeMm: -15000,
      solMm: options.solMm,
      decalageXMm: -2600,
    }),
  );

  for (const piece of pieces) if (piece) groupe.add(piece);
  for (const piece of dansLeVisAVis) if (piece) visAVis.add(piece);
  return groupe;
}

/** L'épaisseur du mur de façade — celle du décor, et celle d'où partent les retours. */
const MUR_FACADE_MM = 300;

/**
 * HABILLER UNE FAÇADE PERCÉE : le toit qui la couronne, et les autres
 * ouvertures qui l'accompagnent.
 *
 * Le décor d'une baie était un FRAGMENT de mur — neuf cents millimètres
 * autour de l'ouverture. Vu de l'intérieur cela suffisait ; mais dès qu'on
 * tournait autour, la fenêtre se retrouvait dans un panneau de maçonnerie
 * posé sur une pelouse. Le marchand l'a dit : « chacun doit être placé
 * exactement où il serait dans la vraie vie ».
 *
 * La façade s'étend donc aux dimensions d'une maison, et ce module lui
 * ajoute ce qui en fait une maison : une toiture, une porte d'entrée, et
 * les fenêtres voisines. La menuiserie qu'on configure est alors la
 * SIENNE — celle qu'on remplace — au milieu de celles qu'on garde.
 *
 * Les autres ouvertures sont posées EN RETRAIT du nu extérieur, dans le
 * plan du tableau : elles se lisent comme des trous, pas comme des
 * autocollants.
 */
export function habillerFacade(
  matieres: MatieresDecor,
  options: {
    demiLargeurFacadeMm: number;
    solMm: number;
    gouttiereMm: number;
    faitageMm: number;
    profondeurMm: number;
    zExterieurMm: number;
    /** L'emprise de la baie configurée : on n'y pose rien. */
    baie: { demiLargeurMm: number; basMm: number; hautMm: number };
    /**
     * Une PORTE-FENÊTRE au centre. C'est ce qu'un store banne abrite : sans
     * elle il ombrage un mur, et personne ne comprend à quoi il sert.
     */
    porteCentrale?: boolean;
    /**
     * LE PIED de la façade — jusqu'où le mur descend, sous le plancher.
     * À défaut, le niveau du sol : c'est ce que faisait le premier jet, et
     * la maison montrait sa sous-face.
     */
    piedMm?: number;
    /**
     * LE RAMPANT, quand la façade est un PIGNON — la ligne de toit, en
     * millimètres dans le plan du mur.
     *
     * Il change deux choses. La toiture d'abord : une maison qu'on regarde
     * par son pignon a son faîtage dans la profondeur, pas en travers ;
     * les deux pans et les deux pignons de côté n'ont plus lieu d'être, et
     * c'est la RIVE qui tient lieu de toit — le décor la pose lui-même sur
     * le rampant. Les ouvertures voisines ensuite : sous une pente, il n'y
     * a pas de fenêtre à la même hauteur qu'une baie de comble, et surtout
     * pas d'étage.
     */
    rampant?: Array<[number, number]>;
  },
): Group {
  const groupe = new Group();
  groupe.name = 'facade';
  const demi = options.demiLargeurFacadeMm;
  const zAvant = options.zExterieurMm;
  const zArriere = zAvant + options.profondeurMm;
  const zMilieu = (zAvant + zArriere) / 2;
  const debordToit = 300;
  const monteeMm = options.faitageMm - options.gouttiereMm;
  const demiProfondeur = options.profondeurMm / 2 + debordToit;
  const penteLongueur = Math.hypot(demiProfondeur, monteeMm);

  /** La hauteur du rampant à une abscisse donnée — l'infini sans rampant. */
  const sousLeRampant = (x: number): number => {
    const ligne = options.rampant;
    if (!ligne || ligne.length < 2) return Infinity;
    if (x <= ligne[0][0]) return ligne[0][1];
    for (let index = 1; index < ligne.length; index++) {
      const a = ligne[index - 1];
      const b = ligne[index];
      if (x <= b[0]) {
        const part = (x - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * part;
      }
    }
    return ligne[ligne.length - 1][1];
  };

  // LA TOITURE, deux pans et deux pignons — la même que celle des maisons
  // du fond, aux cotes de celle-ci. Sur un PIGNON, rien de tout cela : le
  // faîtage court dans la profondeur, et c'est la rive posée sur le rampant
  // qui fait le toit.
  for (const sens of options.rampant ? [] : ([-1, 1] as const)) {
    const pan = boite(
      'facade-toit',
      matieres.toiture,
      -demi - debordToit,
      demi + debordToit,
      -60,
      0,
      -penteLongueur / 2,
      penteLongueur / 2,
      true,
    );
    if (!pan) continue;
    pan.position.set(
      0,
      (options.gouttiereMm + monteeMm / 2) / 1000,
      (zMilieu + (sens * demiProfondeur) / 2) / 1000,
    );
    pan.rotation.x = sens * Math.atan2(monteeMm, demiProfondeur);
    groupe.add(pan);
  }
  // LES RETOURS ET LE FOND — ce qui fait qu'une maison est un VOLUME.
  //
  // La façade était un PANNEAU de trente centimètres d'épaisseur, coiffé
  // d'un toit qui portait sur huit mètres de vide. Il suffisait de tourner
  // un peu pour voir sa TRANCHE, et derrière : la pelouse et le ciel. Une
  // maison vue de trois quarts n'est pas un écran ; ses murs reviennent.
  //
  // Trois pavés, trente-six triangles. C'est le prix d'une maison qui se
  // tient debout dans le décor au lieu d'y être posée de champ.
  {
    const pied = options.piedMm ?? options.solMm;
    const epaisseur = 300;
    // LES TROIS PAVÉS NE SE TOUCHENT QUE PAR LEURS ABOUTS, jamais par leurs
    // faces. Le premier jet les faisait partir du nu de la façade et courir
    // sur toute la largeur : le retour et le mur avaient alors la MÊME face
    // en x = ±demi, tournée du même côté, et les deux se disputaient le
    // pixel sur toute la hauteur de la maison. Deux surfaces au même endroit
    // clignotent — c'est la faute que le comblement a déjà value au décor.
    //
    // Le retour part donc DERRIÈRE le mur, et le fond ne va que d'un retour
    // à l'autre.
    const zRetour = zAvant + MUR_FACADE_MM;
    for (const cote of [-1, 1] as const) {
      const interieur = cote * (demi - epaisseur);
      const exterieur = cote * demi;
      groupe.add(
        boite(
          'facade-retour',
          matieres.enduitOmbre,
          Math.min(interieur, exterieur),
          Math.max(interieur, exterieur),
          pied,
          options.gouttiereMm,
          zRetour,
          zArriere,
          true,
        ) as Mesh,
      );
    }
    groupe.add(
      boite(
        'facade-fond',
        matieres.enduitOmbre,
        -demi + epaisseur,
        demi - epaisseur,
        pied,
        options.gouttiereMm,
        zArriere - epaisseur,
        zArriere,
        true,
      ) as Mesh,
    );
  }

  for (const x of options.rampant ? [] : [-demi, demi]) {
    groupe.add(
      pignon(
        'facade-pignon',
        matieres.enduitOmbre,
        [
          [zAvant, options.gouttiereMm],
          [zArriere, options.gouttiereMm],
          [zMilieu, options.faitageMm],
        ],
        x,
      ),
    );
  }

  // LES AUTRES OUVERTURES — celles qu'on GARDE, autour de celle qu'on
  // remplace.
  //
  // Le premier jet les posait en saillie sur le nu du mur, à des positions
  // proportionnelles à la façade : de grands rectangles bleus, à moitié
  // coupés par le cadre, qui se lisaient comme des autocollants. Une
  // ouverture se lit comme une ouverture à trois conditions, et elles ne
  // coûtent qu'une boîte de plus chacune :
  //
  //  1. elle est SOMBRE et légèrement DÉTACHÉE du nu — un verre, pas un
  //     aplat d'enduit ;
  //  2. elle a un ENCADREMENT en relief, qui la borde ;
  //  3. elle a un APPUI, la ligne horizontale qui dit « fenêtre » de loin.
  //
  // Le premier jet la posait EN RETRAIT, dans l'épaisseur du mur, pour
  // qu'elle se lise comme un trou. Elle s'y trouvait purement et simplement
  // ENTERRÉE : le mur est plein — on ne le perce pas, faute de découpe
  // booléenne — et la vitre disparaissait derrière l'enduit. Elle vient
  // donc en légère saillie, devant le nu.
  //
  // Et elles se placent PAR RAPPORT À LA BAIE, pas à la façade : ce sont
  // ses voisines, elles l'encadrent. Calées sur la largeur de la maison,
  // elles sortaient du champ dès que le cadrage serrait sur le produit.
  /** De combien la vitre et son encadrement avancent devant le nu du mur. */
  const SAILLIE_VITRE = 40;
  const SAILLIE_CADRE = 70;
  const ENCADREMENT = 95;

  const libre = (x0: number, x1: number, y0: number, y1: number) =>
    x1 < -options.baie.demiLargeurMm - 400 ||
    x0 > options.baie.demiLargeurMm + 400 ||
    y1 < options.baie.basMm - 250 ||
    y0 > options.baie.hautMm + 250;

  /** Une ouverture de décor : son encadrement, son trou, son appui. */
  const ouverture = (
    nom: string,
    xCentre: number,
    largeur: number,
    y0: number,
    y1: number,
    avecAppui: boolean,
  ) => {
    const x0 = xCentre - largeur / 2;
    const x1 = xCentre + largeur / 2;
    // Ni hors de la façade, ni sur la baie qu'on vend.
    if (x0 < -demi + 250 || x1 > demi - 250) return;
    if (!libre(x0, x1, y0, y1)) return;
    // NI AU-DESSUS DU RAMPANT : sous une pente de toit, il n'y a plus de
    // mur — une fenêtre posée là flotte dans le ciel.
    if (y1 + 150 > Math.min(sousLeRampant(x0), sousLeRampant(x1))) return;
    // L'ENCADREMENT est une BORDURE — quatre plates-bandes — et non un
    // panneau plein. Le premier jet posait un rectangle entier au nu du
    // mur : il RECOUVRAIT le trou qu'il devait encadrer, et les fenêtres
    // voisines s'affichaient comme des panneaux beiges aveugles. C'est en
    // regardant une porte d'entrée en grand qu'on l'a vu ; sur une vignette
    // de deux cents pixels, cela passait pour un choix.
    //
    // SAUF SOUS UNE PORTE : une porte qui descend au sol n'a pas de
    // plate-bande dessous, elle a un seuil. Le premier jet en posait une
    // quand même, et son DESSUS tombait exactement dans le plan du sol —
    // deux surfaces au même endroit, qui clignotent devant l'entrée.
    const auSol = y0 <= options.solMm + 1;
    const bandes: Array<[number, number, number, number]> = [
      [x0 - ENCADREMENT, x1 + ENCADREMENT, y1, y1 + ENCADREMENT],
      ...(auSol
        ? []
        : ([[x0 - ENCADREMENT, x1 + ENCADREMENT, y0 - ENCADREMENT, y0]] as Array<
            [number, number, number, number]
          >)),
      [x0 - ENCADREMENT, x0, y0, y1],
      [x1, x1 + ENCADREMENT, y0, y1],
    ];
    for (const [bx0, bx1, by0, by1] of bandes) {
      groupe.add(
        boite(
          nom,
          matieres.enduitOmbre,
          bx0,
          bx1,
          by0,
          by1,
          zAvant - SAILLIE_CADRE,
          zAvant + 10,
          true,
        ) as Mesh,
      );
    }
    // LA VITRE, entre le nu du mur et le nu de l'encadrement : elle est
    // donc en creux PAR RAPPORT À LUI, et l'ombre qu'il porte dessus fait
    // le reste.
    groupe.add(
      boite(
        nom,
        matieres.vitrageVoisin,
        x0,
        x1,
        y0,
        y1,
        zAvant - SAILLIE_VITRE,
        zAvant + 10,
        true,
      ) as Mesh,
    );
    if (avecAppui) {
      groupe.add(
        boite(
          `${nom}-appui`,
          matieres.porteGarage,
          x0 - ENCADREMENT - 30,
          x1 + ENCADREMENT + 30,
          y0 - ENCADREMENT - 60,
          y0 - ENCADREMENT,
          zAvant - SAILLIE_CADRE - 45,
          zAvant + 10,
          true,
        ) as Mesh,
      );
    }
  };

  // LES DEUX VOISINES, de part et d'autre et à la même hauteur : ce sont
  // elles qui donnent l'échelle, et elles doivent rester dans le champ.
  const hauteurBaie = options.baie.hautMm - options.baie.basMm;
  const hautVoisine = Math.min(1350, Math.max(900, hauteurBaie * 0.9));
  const basVoisine = Math.max(options.solMm + 850, options.baie.hautMm - hautVoisine);
  for (const cote of [-1, 1] as const) {
    ouverture(
      'facade-fenetre',
      cote * (options.baie.demiLargeurMm + 620 + 1150 / 2),
      1150,
      basVoisine,
      basVoisine + hautVoisine,
      true,
    );
  }
  // L'ÉTAGE, s'il y a la place sous la gouttière — et sur une maison de
  // plain-pied il n'y en a pas, ce que la garde dit toute seule.
  const basEtage = options.solMm + options.gouttiereMm * 0.62;
  if (basEtage > options.baie.hautMm + 400 && basEtage + 1250 < options.solMm + options.gouttiereMm - 400) {
    for (const cote of [-1, 1] as const) {
      ouverture('facade-fenetre', cote * 1750, 1100, basEtage, basEtage + 1250, true);
    }
  }
  // LA PORTE-FENÊTRE que le store abrite, au centre et sous lui.
  if (options.porteCentrale) {
    ouverture('facade-porte-fenetre', 0, 1600, options.solMm, options.solMm + 2150, false);
  }
  // LA PORTE D'ENTRÉE, au rez, du côté qui reste libre.
  ouverture(
    'facade-porte',
    -(options.baie.demiLargeurMm + 620 + 1150 + 1400),
    950,
    options.solMm,
    options.solMm + 2150,
    false,
  );
  return groupe;
}
