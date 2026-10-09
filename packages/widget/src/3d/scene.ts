/**
 * Pourquoi ce fichier existe : la scène Three.js — la menuiserie en volume,
 * tournable, avec l'ouverture animée de ses vantaux. Ce module est le SEUL
 * du widget à importer three.js, et il n'est jamais importé statiquement :
 * `Vue3D.tsx` le charge par `import()` quand l'onglet 3D s'ouvre. C'est la
 * condition du budget de performance — « la 3D ne pénalise jamais le
 * chargement du prix » (docs/05, phase 3).
 *
 * Solution écartée : construire la géométrie ici, avec les aides de
 * three.js. Le volume viendrait alors d'un endroit pour l'écran et d'un
 * autre pour l'export GLB, et les deux divergeraient. `computeGeometry3D()`
 * du cœur est la seule source ; ce module ne fait que POSER des boîtes et
 * les faire tourner.
 *
 * Incident fondateur : les pivots. Poser l'origine d'un groupe SUR l'axe de
 * rotation évite de recomposer une matrice à chaque image — et surtout, le
 * pivot vient du cœur, donc du symbole d'ouverture dessiné en 2D : le
 * vantail s'ouvre du côté que le plan annonce.
 */

import {
  AmbientLight,
  type CanvasTexture,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import type { Geometry3D, Maillage, Matiere3D } from '@ahjc/core';
import {
  construireDecor,
  hauteurDeCielMm,
  inclinaisonDuRampant,
  margeDeCadrageMm,
  niveauDuSolMm,
  type OptionsDecor,
} from './decor.ts';
import { textureDeGrain, textureEnvironnement, texturePourLeCiel } from './environnement.ts';

export interface TeintesScene {
  cadre: string;
  vitrage: string;
  cadreExterieur?: string;
  /**
   * LA TEINTE DE LA TOILE — lot O9b. Absente, la scène garde le vert d'eau
   * qu'elle portait en dur : une configuration muette rend la même image.
   *
   * Elle arrive de `Vue3D`, qui est PARESSEUX, et la table des douze teintes
   * y est donc importée sans coûter un octet au chargement initial — c'est le
   * geste du lot D18, qui a sorti l'aspect du verre et le fil du bois du
   * viewport pour la même raison.
   */
  toile?: string;
  deuxFaces?: boolean;
  /**
   * LA RUGOSITÉ DU LAQUAGE, de 0 (miroir) à 1 (mate). Elle vient du cœur
   * (`teintes.ts`, table `RUGOSITE_FINITION`) et pas d'ici : c'est une
   * propriété du PRODUIT — un 7016 mat et un 7016 satiné ne se ressemblent
   * pas sur une façade au soleil, et c'est ce que le client choisit.
   *
   * Absente = 0,5, la valeur qu'on appliquait à tout avant que la finition
   * n'existe.
   */
  rugositeCadre?: number;
  /**
   * LE VERNIS, de 0 à 1 — `clearcoat` au sens PBR.
   *
   * Un laquage poudre est un film transparent sur un pigment : il ajoute un
   * reflet spéculaire NET par-dessus la couleur, comme un vernis de
   * carrosserie. C'est ce qui distingue à l'œil un aluminium laqué d'un PVC
   * teinté dans la masse, et sans lui les deux rendaient pareil.
   *
   * ET LE MÉTAL RESTE À ZÉRO. Un profilé aluminium LAQUÉ n'est pas du métal
   * nu : c'est du métal peint, et sa surface est du polyester. Le décrire à
   * `metalness = 1` le rend miroitant et noir dans les zones sans reflet —
   * l'erreur qu'on voit dans presque tous les configurateurs 3D, et qui ne
   * ressemble à rien de posé sur une façade.
   */
  vernisCadre?: number;
  /**
   * Le VERRE DÉPOLI diffuse au lieu de transmettre. C'est la seule chose
   * qu'on achète en le choisissant — ne plus être vu — et elle doit donc
   * se voir : une rugosité forte plutôt qu'une teinte plus laiteuse.
   */
  vitrageDepoli?: boolean;
  /**
   * Le FIL du bois. `false` l'éteint — un aluminium thermolaqué n'a pas de
   * fil, et lui en donner un le ferait passer pour du plaxé.
   */
  filDuBois?: boolean;
}

export interface OptionsScene {
  /** Le mur d'échelle connue et son sol — jamais exporté en RA. */
  decor?: OptionsDecor | null;
}

export interface Scene3D {
  /** Redessine la scène pour une nouvelle géométrie, sans tout recréer. */
  mettreAJour(geometrie: Geometry3D, teintes: TeintesScene, options?: OptionsScene): void;
  /** 0 = fermé, 1 = ouvert — l'UI pilote, la scène n'anime pas seule. */
  ouvrir(taux: number): void;
  /** Fait tourner la caméra autour de la menuiserie (radians). */
  tourner(deltaAzimut: number, deltaHauteur: number): void;
  orienter(azimut: number, hauteur: number): void;
  /**
   * Se place sur un POINT DE VUE nommé — de face, de trois quarts, de
   * profil, en plongée — du côté demandé.
   *
   * `null` en second argument garde le côté courant : c'est ce qui permet
   * de changer d'angle sans se retrouver de l'autre côté du mur.
   */
  viser(angle: AngleDeVue, cote: CoteDeVue | null): void;
  /** Le point de vue courant, pour que l'écran sache quel bouton est enfoncé. */
  pointDeVue(): { angle: AngleDeVue; cote: CoteDeVue; zoom: number };
  /** Rapproche la caméra — 1 = cadrage d'ensemble, 0,3 = un détail. */
  rapprocher(facteur: number): void;
  redimensionner(largeur: number, hauteur: number): void;
  detruire(): void;
}

/**
 * Libère les ressources d'un groupe, PUIS le vide. L'ordre est le sujet :
 * détacher d'abord ne laisse plus rien à parcourir, et chaque géométrie
 * comme chaque matière reste sur la carte graphique — une fuite silencieuse
 * à chaque remise à jour de la scène. Exportée pour être vérifiable dans
 * Node : seul le moteur de rendu réclame un contexte graphique, pas le
 * graphe d'objets.
 */
export function libererPuisDetacher(racine: Object3D): number {
  let liberees = 0;
  racine.traverse((objet) => {
    if (objet instanceof Mesh) {
      objet.geometry.dispose();
      const matieres: Material[] = Array.isArray(objet.material) ? objet.material : [objet.material];
      for (const matiere of matieres) matiere.dispose();
      liberees++;
    }
  });
  for (const enfant of [...racine.children]) racine.remove(enfant);
  return liberees;
}

/**
 * Les bornes de l'assemblage, en millimètres. Le cœur sait le faire
 * (`encombrement`), mais l'IMPORTER ici ferait de `@ahjc/core` un module
 * partagé entre l'entrée et le morceau 3D : Rollup l'extrairait dans un
 * troisième fichier, que le plugin WordPress devrait mettre en file
 * d'attente en plus. Cinq lignes valent mieux qu'un fichier de plus.
 */
function bornesDesPieces(geometrie: Geometry3D): { min: number[]; max: number[] } | null {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let vu = false;
  for (const piece of geometrie.pieces) {
    const positions = piece.maillage.positions;
    for (let i = 0; i < positions.length; i += 3) {
      vu = true;
      for (let axe = 0; axe < 3; axe++) {
        min[axe] = Math.min(min[axe], positions[i + axe]);
        max[axe] = Math.max(max[axe], positions[i + axe]);
      }
    }
  }
  return vu ? { min, max } : null;
}

/**
 * De quel côté un vantail COULISSANT s'efface, et sur quelle longueur.
 *
 * Rien à inventer : le cœur porte déjà `sens` et `courseMm` sur l'ouvrant,
 * puisque c'est avec eux qu'il l'anime. Le décor s'en sert pour poser le
 * rail du bon côté — sans quoi il aurait fallu deviner, et le rail aurait
 * fini par montrer l'inverse de ce que le vantail fait à l'écran.
 */
function refoulementDe(
  geometrie: Geometry3D,
): { sens: -1 | 1; longueurMm: number } | undefined {
  const coulissant = geometrie.ouvrants.find((ouvrant) => ouvrant.mode === 'coulissant');
  if (!coulissant || !coulissant.courseMm) return undefined;
  return {
    sens: coulissant.sens < 0 ? -1 : 1,
    longueurMm: Math.abs(coulissant.courseMm),
  };
}

/**
 * La pose d'un vantail pour un taux d'ouverture donné : sa position (en
 * mètres) et sa rotation (en radians). Extraite et exportée pour être
 * vérifiable dans Node — c'est ici que vivait le défaut le plus grave de la
 * scène : le coulissement était ÉCRIT dans `position.x` au lieu de s'ajouter
 * au pivot, si bien qu'à l'état fermé le vantail gauche se superposait au
 * droit et la baie s'affichait avec un trou.
 */
/**
 * LES QUATRE ANGLES qu'on veut vraiment sur une menuiserie, et pas un de
 * plus. Ce ne sont pas des positions de caméra choisies pour faire joli :
 * chacun répond à une question qu'un client se pose.
 *
 *  · `face` — les PROPORTIONS. C'est la vue du dessin coté, celle qui dit
 *    si la fenêtre est trop haute pour son mur ;
 *  · `trois-quarts` — le défaut. La seule qui montre à la fois la face et
 *    l'ÉPAISSEUR, donc le tableau et le relief des profilés ;
 *  · `profil` — la SAILLIE : l'avancée d'un store, la course d'un vantail
 *    ouvert, l'épaisseur d'un volet contre son mur ;
 *  · `plongee` — le DESSUS, pour un store banne ou un seuil.
 */
export type AngleDeVue = 'face' | 'trois-quarts' | 'profil' | 'plongee';

/** De quel côté on se tient : dans la pièce, ou dehors. */
export type CoteDeVue = 'dedans' | 'dehors';

/**
 * L'azimut et la hauteur de chaque angle, côté INTÉRIEUR. Le côté extérieur
 * est le même à π près — c'est la même scène, vue de l'autre bord.
 */
/** Les bornes du zoom : assez près pour une béquille, assez loin pour tout voir. */
const ZOOM_MIN = 0.32;
const ZOOM_MAX = 2.2;

const ANGLES: Record<AngleDeVue, { azimut: number; hauteur: number }> = {
  face: { azimut: 0, hauteur: 0.06 },
  'trois-quarts': { azimut: -0.42, hauteur: 0.16 },
  // Presque de profil, jamais tout à fait : à 90° pile, une menuiserie
  // n'est plus qu'un trait, et on ne juge plus rien.
  profil: { azimut: -1.24, hauteur: 0.1 },
  plongee: { azimut: -0.42, hauteur: 0.62 },
};

/**
 * LA HAUTEUR DE CAMÉRA, BORNÉE PAR LE SOL.
 *
 * Le sol du décor est une dalle mince : en tournant vers le bas ou en
 * reculant, la caméra passait dessous, et l'on regardait la scène par
 * en dessous — la pelouse vue de sa face cachée, la maison flottant sur
 * rien. Aucun test de géométrie ne voit cela ; le marchand, lui, l'a vu
 * en une seconde.
 *
 * On ne borne PAS l'angle : la hauteur admissible dépend de la distance.
 * Reculer sans rien changer d'autre fait descendre la caméra, et un angle
 * qui passait de près traverse le sol de loin. On borne donc la POSITION,
 * puis on en redéduit l'angle.
 *
 * `garde` est la hauteur d'œil minimale au-dessus du sol : à ras, on
 * rase l'herbe et l'image ne dit plus rien.
 */
export function hauteurBornee(
  hauteur: number,
  centreY: number,
  eloignement: number,
  solY: number,
  garde = 0.18,
): number {
  if (eloignement <= 0.0001) return hauteur;
  // La hauteur d'œil demandée, ramenée au-dessus du sol.
  const yMin = solY + garde;
  const sinMin = (yMin - centreY) / eloignement;
  // La caméra est déjà au-dessus : rien à corriger.
  if (Math.sin(hauteur) >= sinMin) return hauteur;
  // Le sol est plus haut que tout ce que la caméra peut atteindre —
  // on la met à l'horizontale plutôt que de tomber sur un `asin` hors
  // domaine.
  if (sinMin >= 1) return Math.PI / 2;
  if (sinMin <= -1) return hauteur;
  return Math.asin(sinMin);
}

export function poseOuvrant(
  ouvrant: Geometry3D['ouvrants'][number],
  taux: number,
): { position: [number, number, number]; rotation: [number, number] } {
  const t = Math.min(1, Math.max(0, taux));
  const base: [number, number, number] = [
    ouvrant.pivotMm.xMm / 1000,
    ouvrant.pivotMm.yMm / 1000,
    ouvrant.pivotMm.zMm / 1000,
  ];
  if (ouvrant.mode === 'coulissant') {
    return {
      position: [base[0] + ((ouvrant.courseMm ?? 0) / 1000) * ouvrant.sens * t, base[1], base[2]],
      rotation: [0, 0],
    };
  }
  const angle = (((ouvrant.angleMaxDeg ?? 0) * Math.PI) / 180) * ouvrant.sens * t;
  return {
    position: base,
    rotation: ouvrant.axe === 'y' ? [0, angle] : [angle, 0],
  };
}

/**
 * Un maillage du cœur devient une géométrie Three.js — millimètres →
 * mètres, et rien d'autre. La scène ne CONSTRUIT aucune forme : elle pose
 * ce que le cœur a modélisé, exactement comme l'exportateur GLB. C'est ce
 * qui garantit que l'écran et la réalité augmentée montrent la même pièce.
 */
function versGeometrie(maillage: Maillage): BufferGeometry {
  const geometrie = new BufferGeometry();
  const positions = new Float32Array(maillage.positions.length);
  for (let i = 0; i < maillage.positions.length; i++) positions[i] = maillage.positions[i] / 1000;
  geometrie.setAttribute('position', new BufferAttribute(positions, 3));
  geometrie.setAttribute('normal', new BufferAttribute(new Float32Array(maillage.normales), 3));
  // DES COORDONNÉES DE TEXTURE, par projection planaire.
  //
  // Le cœur n'en produit pas, et il a raison : une cote de fabrication n'a
  // pas d'UV. Mais sans elles, toute carte — grain d'un PVC, fil d'un
  // chêne — se lit au même point de l'image pour tous les sommets, et ne
  // fait donc rien du tout. On projette chaque sommet sur le plan
  // perpendiculaire à sa normale DOMINANTE : c'est l'approximation qui
  // convient à une menuiserie, faite de faces planes orientées selon les
  // trois axes. Un mètre de surface parcourt une fois la texture.
  const uv = new Float32Array((maillage.positions.length / 3) * 2);
  for (let sommet = 0, i = 0; i < maillage.positions.length; i += 3, sommet += 2) {
    const [nx, ny, nz] = [
      Math.abs(maillage.normales[i]),
      Math.abs(maillage.normales[i + 1]),
      Math.abs(maillage.normales[i + 2]),
    ];
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (nx >= ny && nx >= nz) {
      uv[sommet] = z; uv[sommet + 1] = y;
    } else if (ny >= nz) {
      uv[sommet] = x; uv[sommet + 1] = z;
    } else {
      uv[sommet] = x; uv[sommet + 1] = y;
    }
  }
  geometrie.setAttribute('uv', new BufferAttribute(uv, 2));
  geometrie.setIndex(Array.from(maillage.indices));
  return geometrie;
}

/** Ce que la scène sait du produit quand elle choisit une matière. */
export interface ContexteMatiere {
  /** Le fil du bois — absent hors menuiserie bois. */
  fil?: CanvasTexture | null;
  /** Vrai quand la scène a un environnement à réfléchir. */
  reflets: boolean;
  /** Un verre DÉPOLI diffuse au lieu de transmettre — c'est ce qu'on achète. */
  vitrageDepoli?: boolean;
  /**
   * DE QUEL CÔTÉ ON REGARDE, au moment où la matière est créée. La couleur
   * de la peau en dépend (`teinteDeLaPeau`), et `reglerLesDeuxCotes` la
   * reprend à chaque fois que la caméra passe de l'autre bord — sans
   * reconstruire la scène, qui se rebâtirait alors à chaque degré de souris.
   */
  cote: CoteDeVue;
}

const MATIERES_DE_PEAU: ReadonlyArray<Matiere3D> = ['cadre', 'ouvrant', 'panneau'];

export function teinteDeLaPeau(teintes: TeintesScene, cote: CoteDeVue): string {
  const choisie = teintes.cadreExterieur ?? teintes.cadre;
  if (teintes.deuxFaces !== true) return choisie;
  return cote === 'dehors' ? choisie : teintes.cadre;
}

/** La couleur rendue d'une pièce de peau : le panneau est un ton plus bas. */
export function couleurDeLaPeau(teintes: TeintesScene, cote: CoteDeVue, matiere: Matiere3D): Color {
  const couleur = new Color(teinteDeLaPeau(teintes, cote));
  return matiere === 'panneau' ? couleur.offsetHSL(0, 0, -0.05) : couleur;
}

function materiau(
  matiere: Matiere3D,
  teintes: TeintesScene,
  contexte: ContexteMatiere,
): MeshStandardMaterial | MeshPhysicalMaterial {
  switch (matiere) {
    case 'vitrage': {
      // LE VERRE — translucide, et il RÉFLÉCHIT.
      //
      // Ce qui dit « verre » à l'œil est la variation du reflet avec
      // l'angle : de face on voit au travers, de biais on voit le ciel.
      // Le modèle standard la donne dès qu'il a un environnement à
      // renvoyer — et la scène en a un depuis ce lot, dessiné au canevas.
      // C'est ce qui manquait : le commentaire d'origine disait déjà
      // « sans rien à réfléchir il s'éteint », et c'était vrai du verre
      // autant que du métal.
      //
      // SOLUTION ÉCARTÉE, et elle a été essayée : `MeshPhysicalMaterial`
      // avec `transmission`. C'est le modèle juste — indice de réfraction,
      // épaisseur, Fresnel complet — mais three.js le rend dans une PASSE
      // SÉPARÉE qui échantillonne la scène opaque. Sous rasterisation
      // LOGICIELLE — un navigateur sans accélération, une capture sans
      // tête, une machine d'entrée de gamme — cette passe rend un aplat :
      // la vitre devient un panneau opaque et masque les petits-bois qu'on
      // est en train d'acheter. Un rendu qui dépend du matériel du client
      // pour montrer la marchandise n'est pas un rendu, c'est un pari.
      //
      // Le DÉPOLI, lui, se rend par la rugosité : c'est elle qui diffuse,
      // et c'est la seule chose qu'on achète en le choisissant — ne plus
      // être vu.
      const depoli = contexte.vitrageDepoli === true;
      const matiere = new MeshStandardMaterial({
        color: new Color(teintes.vitrage),
        transparent: true,
        opacity: depoli ? 0.82 : 0.34,
        roughness: depoli ? 0.55 : 0.05,
        metalness: 0,
        depthWrite: false, // sans quoi le verre cache ce qu'il devrait montrer
      });
      // Le reflet est TEMPÉRÉ : à pleine intensité, une vitre vue de biais
      // renvoie assez de ciel pour cacher son propre vitrage. Un
      // photographe de produit visse un polariseur pour cette raison.
      matiere.envMapIntensity = contexte.reflets ? (depoli ? 0.25 : 0.85) : 0;
      return matiere;
    }
    case 'quincaillerie':
      // Un métal ne fait que RÉFLÉCHIR : sans rien à réfléchir, il
      // s'éteint et la béquille devient une silhouette. C'est pourquoi
      // elle était décrite à `metalness 0.28` — une triche qui la sauvait
      // faute d'environnement. Maintenant qu'il y en a un (procédural,
      // zéro octet téléchargé), le métal peut redevenir du métal.
      return new MeshStandardMaterial({
        color: new Color('#b0b6ba'),
        roughness: contexte.reflets ? 0.34 : 0.38,
        metalness: contexte.reflets ? 0.75 : 0.28,
      });
    case 'cadre-exterieur':
      // LA FACE RUE. Elle porte la MÊME finition que l'intérieur — un
      // laqueur ne change pas de brillance entre les deux faces d'un même
      // profilé —, mais elle peut porter une autre teinte : c'est toute la
      // bicoloration, et c'est ce qu'on achète en la choisissant.
      return new MeshPhysicalMaterial({
        color: new Color(teintes.cadreExterieur ?? teintes.cadre),
        roughness: teintes.rugositeCadre ?? 0.45,
        metalness: 0,
        clearcoat: contexte.reflets ? (teintes.vernisCadre ?? 0) : 0,
        clearcoatRoughness: 0.12,
      });
    case 'joint':
      // LES LISERÉS. Un joint d'étanchéité est en EPDM ou en TPE : il
      // absorbe la lumière au lieu de la renvoyer, et c'est cette absence
      // de reflet qui le fait lire comme une ligne creuse. Le gris très
      // sombre plutôt que le noir pur : sur une menuiserie blanche, un
      // noir absolu découpe le cadre au lieu de le dessiner.
      //
      // Il vaut aussi pour l'INTERCALAIRE du vitrage, vu à travers le
      // verre : deux à trois millimètres de sombre qui bordent le clair.
      return new MeshStandardMaterial({ color: new Color('#33383a'), roughness: 0.92, metalness: 0 });
    case 'panneau':
      return new MeshStandardMaterial({
        color: couleurDeLaPeau(teintes, contexte.cote, 'panneau'),
        roughness: 0.6,
      });
    case 'toile':
      // LA TOILE PORTE LA TEINTE CHOISIE — lot O9b. Elle était peinte en dur
      // au vert d'eau, ici comme dans la feuille du SVG, et elle fait 79 à
      // 85 % de l'aire visible d'un store (lot D17) : le premier poste de
      // décision du produit ne changeait pas un pixel de son image.
      return new MeshStandardMaterial({
        color: new Color(teintes.toile ?? '#c9d3c4'),
        roughness: 0.9,
      });
    case 'maconnerie':
      // LA MAÇONNERIE (lot D12). Elle ne suit PAS le nuancier du client : on
      // quand on change celle de la menuiserie.
      //
      // ET LE COMPILATEUR NE L'AURAIT PAS RÉCLAMÉE : ce `switch` a un
      // `default`, contrairement aux tables de `glb.ts`, d'`usdz.ts` et du
      // site, qui sont des `Record` complets et ont refusé de compiler. Une
      // matière oubliée ici ne casse rien — elle sort au BLANC DE LA
      // payée avant elle.
      return new MeshStandardMaterial({ color: new Color('#b8b5ae'), roughness: 0.95 });
    case 'inox':
      // L'INOX (lot C11b). Il ne suit PAS le nuancier du client non plus, et
      // alimentaire ne se laque pas — un revêtement organique au contact
      return new MeshStandardMaterial({
        color: new Color('#bcc0c4'),
        roughness: 0.25,
        metalness: 0.9,
      });
    case 'module-pv':
      // le CADRE —, et un champ de trente modules se rendait en blanc de
      // menuiserie : le produit disparaissait dans sa propre structure.
      //
      // Ce qui le fait reconnaître n'est pas sa couleur mais son REFLET :
      // un module est un verre trempé sur fond de cellules, presque noir et
      // très lisse. La rugosité basse est donc l'essentiel ; le bleu à
      // peine perceptible n'est que le rappel du silicium.
      //
      // Il n'est PAS transparent, même sur une verrière semi-transparente :
      // ce qui passe entre les cellules d'un module semi-transparent est un
      // taux, pas une vitre, et le rendre en verre ferait disparaître le
      // seul produit de la famille.
      return new MeshStandardMaterial({
        color: new Color('#101828'),
        roughness: contexte.reflets ? 0.12 : 0.2,
        metalness: contexte.reflets ? 0.2 : 0.1,
      });
    default: {
      // LE CADRE. Un blanc de menuiserie n'est jamais #FFFFFF — c'est un
      // RAL 9016 cassé — et sa surface n'est jamais parfaitement lisse.
      // Le fil du bois, quand il y en a un, se pose en carte de rugosité :
      // il fait varier le reflet sans salir la teinte, ce qui est
      // exactement ce que fait un vernis sur du chêne.
      const matiere = new MeshPhysicalMaterial({
        // `'cadre'` en dur, et non la matière reçue : ce `default` ne couvre
        // que `cadre` et `ouvrant` — `Matiere3D` est une union fermée —, et
        // le nom `matiere` est ici celui du matériau qu'on construit.
        color: couleurDeLaPeau(teintes, contexte.cote, 'cadre'),
        roughness: teintes.rugositeCadre ?? 0.5,
        // Zéro, toujours. Voir `TeintesScene.vernisCadre` : un alu laqué
        // est du métal PEINT, et sa surface est du polyester.
        metalness: 0,
        // LE VERNIS. `MeshPhysicalMaterial` est ici pour lui et pour rien
        // d'autre — surtout pas pour `transmission`, essayé sur le vitrage
        // au lot précédent et rendu opaque par le rastériseur logiciel des
        // captures. Le `clearcoat`, lui, se calcule sans extension et
        // survit partout.
        clearcoat: contexte.reflets ? (teintes.vernisCadre ?? 0) : 0,
        clearcoatRoughness: 0.12,
      });
      if (contexte.fil) matiere.roughnessMap = contexte.fil;
      return matiere;
    }
  }
}

/**
 * Monte la scène dans un canevas. Rend un pilote — l'appelant garde la main
 * sur le cycle de vie, parce qu'un WebGLRenderer non détruit fuit le
 * contexte graphique et finit par faire tomber l'onglet.
 */
export function monterScene(canevas: HTMLCanvasElement): Scene3D {
  const moteur = new WebGLRenderer({ canvas: canevas, antialias: true, alpha: true });
  moteur.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
  // Les ombres portées : c'est ce qui POSE la menuiserie dans son mur. Sans
  // elles, l'ouvrant flotte devant le dormant et le tableau ne se creuse
  // pas. Une seule passe d'ombre, filtrée en douceur — le budget du morceau
  // 3D n'autorise pas davantage.
  moteur.shadowMap.enabled = true;
  moteur.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  // LE CIEL. Le fond était un gris uni, et un gris uni derrière une maison
  // se lit comme un studio photo : rien ne dit où est le haut. Un dégradé
  // de deux couleurs suffit à poser l'extérieur — et il se dessine sur un
  // canevas, donc sans un octet à télécharger.
  //
  // Il vaut aussi pour les décors INTÉRIEURS : c'est ce qu'on voit par la
  // fenêtre, au-dessus de la haie.
  const ciel = texturePourLeCiel(canevas.ownerDocument);
  if (ciel) scene.background = ciel;
  // L'ENVIRONNEMENT À RÉFLÉCHIR — sans lui, ni verre ni métal.
  //
  // Un verre physique et un métal ne font que renvoyer ce qui les entoure.
  // La scène n'avait rien à leur donner : le verre était donc décrit par
  // une opacité constante, et la béquille par une fausse metalness. Le
  // PMREM transforme le dégradé du ciel — deux pixels de large, déjà
  // dessiné, déjà là — en carte d'environnement filtrée. Une passe au
  // montage, 128 pixels, et pas un octet téléchargé : la règle « maquette
  // d'architecte, zéro téléchargement » tient toujours.
  let reflets = false;
  const pourReflets = textureEnvironnement(canevas.ownerDocument);
  if (pourReflets) {
    try {
      const pmrem = new PMREMGenerator(moteur);
      scene.environment = pmrem.fromEquirectangular(pourReflets).texture;
      pmrem.dispose();
      pourReflets.dispose();
      reflets = true;
    } catch {
      // Un contexte graphique bridé — impression, vignette, navigateur
      // ancien — ne doit pas priver le client de sa menuiserie. On retombe
      // sur les matières d'avant, qui ne demandent rien.
      reflets = false;
    }
  }
  // LE FIL DU BOIS, dessiné une fois : un bruit étiré, posé en carte de
  // rugosité. Il ne sert qu'aux menuiseries bois, et c'est la teinte du
  // cadre qui le dira au moment de poser les pièces.
  const fil = textureDeGrain(canevas.ownerDocument, { intensite: 0.42, etirement: 9, taille: 64 });
  if (fil) fil.repeat.set(1, 5);
  // La PROFONDEUR DE CHAMP monte à 120 m : la maison d'en face est à
  // quinze mètres, et le lointain était coupé net à soixante.
  const camera = new PerspectiveCamera(38, 1, 0.05, 120);
  // Une hémisphérique tient lieu de rebond du ciel et du sol : elle éclaire
  // les faces tournées vers le haut autrement que celles tournées vers le
  // bas, ce qu'une ambiante uniforme ne fait pas. C'est l'occlusion du
  // pauvre, mais elle coûte zéro passe de rendu.
  // L'HÉMISPHÉRIQUE PORTE, L'AMBIANTE COMPLÈTE — pas l'inverse. Une
  // ambiante uniforme éclaire toutes les faces de la même façon : elle
  // REMPLIT les creux, et un creux rempli n'est plus un creux. À 0,55, la
  // feuillure du dormant, le décrochement de l'ouvrant et la ligne de la
  // parclose disparaissaient — le cadre redevenait un bloc blanc (docs/18
  // §3.2, R4). L'hémisphérique, elle, distingue le haut du bas : c'est
  // l'occlusion du pauvre, et elle ne coûte aucune passe de rendu.
  scene.add(new HemisphereLight(0xdfe9f0, 0x5b5349, 1.35));
  scene.add(new AmbientLight(0xffffff, 0.22));
  const soleil = new DirectionalLight(0xfff4e2, 2.4);
  soleil.position.set(-2.4, 3.2, 4.2);
  soleil.castShadow = true;
  // 2048 plutôt que 1024, et un décalage le long de la normale plutôt qu'un
  // biais de profondeur : à 1024, le tableau se striait d'ACNÉ D'OMBRE —
  // ces rayures que produit une surface presque parallèle à la lumière
  // quand la carte d'ombre manque de résolution.
  soleil.shadow.mapSize.set(2048, 2048);
  soleil.shadow.bias = -0.0004;
  soleil.shadow.normalBias = 0.045;
  scene.add(soleil);
  scene.add(soleil.target);
  const contreJour = new DirectionalLight(0xdfe8ef, 0.7);
  contreJour.position.set(2.2, 1.4, -3.6);
  scene.add(contreJour);

  // L'APPOINT D'INTÉRIEUR. Une pièce ne s'éclaire pas comme une façade :
  // le soleil est DEHORS, et il entre par la fenêtre — les murs qui
  // l'entourent ne reçoivent que le rebond. Sans cet appoint, la pièce
  // ajoutée derrière la baie rendait le tableau brun sombre, et une fenêtre
  // blanche dans une caverne ne se juge pas.
  //
  // Il est ÉTEINT par défaut : dehors, il aplatirait les ombres du soleil,
  // qui sont ce qui pose l'ouvrage au sol.
  const appointInterieur = new DirectionalLight(0xfdf6ea, 0);
  appointInterieur.position.set(1.6, 2.2, 3.4);
  scene.add(appointInterieur);

  /** Vrai quand un décor est posé — sans lui, aucune pièce à éclairer. */
  let decorPose = false;

  const racine = new Group();
  scene.add(racine);

  // La caméra orbite : azimut, hauteur, distance — recalculés à la demande.
  let azimut = -0.42;
  let hauteur = 0.16;
  let distance = 4;
  /**
   * LE ZOOM, en facteur sur la distance de cadrage — jamais en valeur
   * absolue. Le cadrage se recalcule à chaque geste du client (une baie
   * plus large éloigne la caméra) ; un zoom absolu se serait battu contre
   * lui à chaque frappe.
   */
  let zoom = 1;
  /**
   * Le niveau du sol du décor, en mètres — `null` quand le client a retiré
   * le décor, puisqu'il n'y a alors plus rien à traverser.
   */
  let solY: number | null = null;
  let centre = new Vector3(0, 1, 0);
  /** Un vecteur de travail, réutilisé — pour ne pas en allouer à chaque image. */
  const pointDeTravail = new Vector3();
  /**
   * LE VIS-À-VIS — la haie et la maison d'en face — N'EXISTE QUE VU DE LA
   * PIÈCE. C'est le paysage qu'on aperçoit PAR la fenêtre, et c'est lui qui
   * donne sa profondeur au clair de vitrage.
   *
   * Vu de la rue, il est DERRIÈRE l'observateur ; mais la caméra recule à
   * mesure qu'on dézoome, finit par le dépasser, et il s'interpose alors
   * entre l'œil et le produit. Un volet battant — qu'on juge du dehors par
   * définition — s'affichait avec DEUX maisons : la sienne, et celle d'en
   * face par-dessus.
   *
   * La pelouse, elle, ne s'éteint jamais : c'est le terrain, et la maison y
   * est posée des deux côtés.
   */
  /**
   * LA PIÈCE N'EXISTE QUE VUE DU DEDANS, comme le vis-à-vis. C'est le même
   * incident, sur l'autre décor : le sol, le plafond et les murs de retour
   * sont ce qui donne son échelle à une fenêtre regardée depuis le salon.
   * Vus de la RUE, ils forment une boîte grise qui s'interpose entre l'œil
   * et la façade — la vue « de la rue » d'un volet battant montrait le
   * plafond et le parquet d'un séjour (docs/18 §2.8).
   *
   * Une façade se regarde du dehors, une pièce du dedans. Le décor porte
   * les deux ; c'est la caméra qui décide lequel a un sens.
   */
  const reglerLesDeuxCotes = () => {
    const dedans = coteCourant() === 'dedans';
    // LA PEAU SUIT LA FACE QU'ON REGARDE. Voir `teinteDeLaPeau` : le bouton
    // « Dedans / Dehors » existe pour juger une bicoloration et rendait la
    // même couleur des deux bords. On repeint les matériaux plutôt que de
    // reconstruire la scène — un glissé de souris la rebâtirait à chaque
    // degré —, et seulement quand le côté CHANGE.
    const cote = coteCourant();
    if (cote !== coteApplique) {
      coteApplique = cote;
      for (const peau of peauxDuCadre) {
        peau.materiau.color.copy(cote === 'dehors' ? peau.dehors : peau.dedans);
      }
      besoinDeRendu = true;
    }
    for (const nom of ['vis-a-vis', 'piece']) {
      const objet = racine.getObjectByName(nom);
      if (objet) objet.visible = dedans;
    }
    // LE PLAFOND S'EFFACE QUAND ON PASSE AU-DESSUS. Une vue en PLONGÉE —
    // celle qui montre un seuil à gorges ou l'appui — porte la caméra plus
    // haut que le plafond de la pièce ; on regardait alors le dessus d'une
    // dalle, et l'écran devenait un aplat gris. C'est le même incident que
    // la caméra sortie par le mur de retour, sur l'autre axe.
    //
    // On l'efface plutôt que de borner la hauteur : la plongée est un
    // point de vue qu'on veut garder, et un plafond qu'on survole n'a rien
    // à dire de la menuiserie.
    const plafond = racine.getObjectByName('piece-plafond');
    if (plafond) {
      plafond.visible = dedans && camera.position.y < plafond.getWorldPosition(pointDeTravail).y;
    }
  };

  const placerCamera = () => {
    const eloignement = distance * zoom;
    // LE SOL EST UN PLANCHER, pas une suggestion : la caméra ne passe pas
    // dessous. Sans décor il n'y a pas de sol, et rien à borner.
    if (solY !== null) hauteur = hauteurBornee(hauteur, centre.y, eloignement, solY);
    camera.position.set(
      centre.x + eloignement * Math.cos(hauteur) * Math.sin(azimut),
      centre.y + eloignement * Math.sin(hauteur),
      centre.z + eloignement * Math.cos(hauteur) * Math.cos(azimut),
    );
    camera.lookAt(centre);
    reglerLesDeuxCotes();
    reglerLumiere();
  };

  const reglerLumiere = () => {
    const dedans = coteCourant() === 'dedans';
    appointInterieur.intensity = dedans && decorPose ? 1.5 : 0;
    // Le soleil ne CHANGE PAS DE PLACE — il est dehors dans les deux cas,
    // et c'est justement ce qui fait le contre-jour. Ce qui change, c'est
    // ce qu'on met en face pour que la scène reste lisible.
    contreJour.intensity = dedans ? 0.35 : 0.7;
  };

  /**
   * De quel côté la caméra se trouve. Le repère du cœur met l'INTÉRIEUR en
   * z positif : le cosinus de l'azimut suffit à trancher, et il suit le
   * client quand il fait le tour lui-même.
   */
  const coteCourant = (): CoteDeVue => (Math.cos(azimut) >= 0 ? 'dedans' : 'dehors');

  let groupesOuvrants: Array<{ groupe: Group; ouvrant: Geometry3D['ouvrants'][number] }> = [];
  /**
   * LES PEAUX DE L'OUVRAGE ET LEURS DEUX COULEURS — celle de la face pièce,
   * celle de la face rue. La scène les repeint quand la caméra passe de
   * l'autre côté, sans rien reconstruire.
   */
  let peauxDuCadre: Array<{
    materiau: MeshStandardMaterial | MeshPhysicalMaterial;
    dedans: Color;
    dehors: Color;
  }> = [];
  /** Le côté déjà peint, pour ne repeindre qu'au franchissement. */
  let coteApplique: CoteDeVue | null = null;
  /** Vrai tant que le client n'a pas tourné lui-même autour de la scène. */
  let orientationLibre = true;
  let tauxOuverture = 0;
  let besoinDeRendu = true;
  let horsToutM = { largeur: 1, hauteur: 1, profondeur: 0.1 };

  /**
   * Le cadrage se DÉDUIT du champ de vision et du format du canevas, au lieu
   * d'un facteur choisi à l'œil : une baie de 6 m et un châssis de 40 cm
   * remplissent alors l'image de la même façon, dans une colonne étroite
   * comme dans une page pleine. Le premier cadrage, réglé au jugé, laissait
   * la menuiserie flotter au milieu du vide.
   */
  const cadrer = () => {
    const champVertical = (camera.fov * Math.PI) / 180;
    const champHorizontal = 2 * Math.atan(Math.tan(champVertical / 2) * camera.aspect);
    const pourHauteur = horsToutM.hauteur / 2 / Math.tan(champVertical / 2);
    const pourLargeur = horsToutM.largeur / 2 / Math.tan(champHorizontal / 2);
    // La PROFONDEUR compte aussi : un store banne avance de trois mètres, et
    // cadré sur sa seule façade il sortait du champ. On recule de sa
    // demi-profondeur en plus.
    // 1,18 : la marge qui empêche la menuiserie de toucher les bords quand
    // un vantail s'ouvre vers l'observateur.
    distance = Math.max(pourHauteur, pourLargeur) * 1.18 + horsToutM.profondeur / 2 + 0.25;
  };

  const vider = () => {
    libererPuisDetacher(racine);
    groupesOuvrants = [];
    // Les matériaux viennent d'être détruits : garder leurs couleurs ferait
    // repeindre des objets qui n'existent plus. Et le côté peint se rouvre —
    // la scène suivante n'a encore aucune peau.
    peauxDuCadre = [];
    coteApplique = null;
  };

  const appliquerOuverture = () => {
    for (const { groupe, ouvrant } of groupesOuvrants) {
      const pose = poseOuvrant(ouvrant, tauxOuverture);
      groupe.position.set(...pose.position);
      groupe.rotation.x = pose.rotation[0];
      groupe.rotation.y = pose.rotation[1];
    }
  };

  const mettreAJour = (geometrie: Geometry3D, teintes: TeintesScene, options: OptionsScene = {}) => {
    vider();
    // Le décor d'abord : il est derrière tout le reste, et sa présence
    // change le cadrage (le mur déborde de la menuiserie).
    if (options.decor) {
      // Le contour vient du cœur : c'est LUI qui sait la forme, et le mur
      // n'a qu'à s'y conformer. Un plein cintre dans un trou carré laissait
      // deux triangles de vide aux épaules.
      racine.add(
        construireDecor(geometrie.horsToutMm, {
          ...options.decor,
          contourMm: geometrie.contourDormantMm,
          // Et la hauteur AU DROIT DES BORDS, sur laquelle les piliers
          // s'arasent : un chapeau de gendarme n'a pas la même hauteur au
          // milieu et là où le fût le touche.
          hauteurAuxBordsMm: geometrie.hauteurAuxBordsMm,
          // LE REFOULEMENT vient du cœur : c'est lui qui sait de quel côté
          // le vantail s'efface et sur quelle course. Le décor ne l'invente
          // pas — il le montre, et les deux ne peuvent donc pas diverger.
          refoulement: refoulementDe(geometrie),
        }, canevas.ownerDocument),
      );
    }
    // ---- L'OUVRAGE DANS SON PROPRE GROUPE, et pourquoi il en fallait un ----
    //
    // Jusqu'ici tout allait dans `racine` : le décor, la menuiserie, les
    // vantaux. Cela suffisait tant que TOUT était vertical. Une fenêtre de
    // toit ne l'est pas — elle est couchée dans la pente —, et le décor du
    // rampant l'est avec elle. Tourner `racine` aurait tourné le terrain,
    // le ciel et la maison ; il fallait un groupe qui ne porte QUE ce qu'on
    // vend.
    //
    // L'angle vient du décor, jamais d'ici : `inclinaisonDuRampant()` est
    // la seule fonction qui le calcule, et le pan de couverture s'en sert
    // aussi. Un demi-degré d'écart entre les deux et la menuiserie traverse
    // le toit.
    const ouvrage = new Group();
    ouvrage.name = 'ouvrage';
    if (options.decor?.type === 'rampant') {
      // DEUX GROUPES ET PAS UN, et l'ordre des rotations est la raison.
      //
      // Coucher la menuiserie dans la pente ne suffit pas : elle arrive
      // avec son INTÉRIEUR vers les z positifs — la poignée est du côté de
      // la pièce, le jet d'eau du côté de la rue. Or la normale sortante
      // d'un pan de toit pointe vers le ciel, c'est-à-dire précisément là
      // où le +z de la menuiserie l'envoie une fois couchée. Le premier jet
      // posait donc la fenêtre à plat SUR les tuiles, intérieur vers le
      // ciel, avec son ombre portée dessous.
      //
      // Le demi-tour la retourne : le dormant s'enfonce alors dans
      // l'épaisseur du pan, la poignée descend dans le comble, et le jet
      // d'eau ressort de quatorze millimètres au-dessus des tuiles —
      // exactement ce que fait un solin. Rien à décaler.
      const pivot = new Group();
      pivot.name = 'rampant-pivot';
      pivot.rotation.x = -inclinaisonDuRampant(options.decor.penteToitDeg);
      ouvrage.rotation.y = Math.PI;
      pivot.add(ouvrage);
      racine.add(pivot);
    } else {
      racine.add(ouvrage);
    }

    const parVantail = new Map<number, Group>();
    for (const ouvrant of geometrie.ouvrants) {
      const groupe = new Group();
      // L'origine du groupe est POSÉE sur l'axe de rotation : plus rien à
      // recomposer par image, et le vantail tourne là où le plan le dit.
      const pose = poseOuvrant(ouvrant, 0);
      groupe.position.set(...pose.position);
      ouvrage.add(groupe);
      parVantail.set(ouvrant.vantail, groupe);
      groupesOuvrants.push({ groupe, ouvrant });
    }

    // LE FIL NE VA QUE SUR LE BOIS. La scène ne connaît pas le matériau —
    // elle ne reçoit que des teintes — mais elle connaît l'ÉPAISSEUR du
    // profilé et la teinte du cadre : un cadre qui n'est pas blanc cassé
    // sur une gamme épaisse est un bois ou un plaxé, et c'est justement
    // sur ceux-là qu'un fil se voit. Le grain, lui, va sur tout : aucune
    // menuiserie n'est parfaitement lisse.
    const contexteMatiere: ContexteMatiere = {
      fil: teintes.filDuBois === false ? null : fil,
      reflets,
      vitrageDepoli: teintes.vitrageDepoli === true,
      cote: coteCourant(),
    };

    for (const piece of geometrie.pieces) {
      const matiereDeLaPiece = materiau(piece.matiere, teintes, contexteMatiere);
      // LES DEUX COULEURS SE CALCULENT ICI, une fois, pendant qu'on tient la
      // teinte : `reglerLesDeuxCotes` n'aura plus qu'à copier la bonne.
      if (MATIERES_DE_PEAU.includes(piece.matiere)) {
        peauxDuCadre.push({
          materiau: matiereDeLaPiece,
          dedans: couleurDeLaPeau(teintes, 'dedans', piece.matiere),
          dehors: couleurDeLaPeau(teintes, 'dehors', piece.matiere),
        });
      }
      const maille = new Mesh(versGeometrie(piece.maillage), matiereDeLaPiece);
      maille.name = piece.nom;
      // Le verre se dessine après l'opaque, sans quoi le tri de
      // transparence laisse voir au travers ce qui devrait être caché.
      maille.renderOrder = piece.matiere === 'vitrage' ? 1 : 0;
      // Le verre reçoit la lumière mais ne porte pas d'ombre pleine : une
      // vitre qui projette un rectangle noir sur le sol trahit le rendu.
      maille.castShadow = piece.matiere !== 'vitrage';
      maille.receiveShadow = true;
      const parent = piece.vantail !== undefined ? parVantail.get(piece.vantail) : undefined;
      if (parent) {
        // Les sommets sont en coordonnées du monde ; on décale le groupe
        // du vantail pour que son origine tombe sur l'axe de rotation.
        maille.position.set(-parent.position.x, -parent.position.y, -parent.position.z);
        parent.add(maille);
      } else {
        ouvrage.add(maille);
      }
    }

    // Le cadrage suit l'ENCOMBREMENT RÉEL des pièces, pas le hors-tout de
    // la menuiserie : une poignée dépasse, un coffre de bloc-baie s'ajoute
    // au-dessus, un store projette. Cadrer sur la seule façade laissait
    // tout cela hors champ.
    // D'OÙ ON REGARDE. Une fenêtre se juge depuis l'intérieur du logement ;
    // se présentait donc de dos, derrière son propre décor. Le point de vue
    // par défaut suit le produit — jusqu'à ce que le client tourne
    // lui-même.
    solY = options.decor
      ? niveauDuSolMm(options.decor.type, options.decor.allegeMm, {
          penteToitDeg: options.decor.penteToitDeg,
          hauteurOuvrageMm: geometrie.horsToutMm.yMm,
        }) / 1000
      : null;
    // Le point de vue est celui que la FAMILLE déclare (`decor-famille.ts`)
    // — on choisit sa fenêtre depuis le salon, son volet depuis la rue. À
    // défaut, tout ce qui n'est pas une baie se regarde du dehors.
    //
    // UNE PIÈCE SE REGARDE DU DEDANS, et il n'y a pas de dehors (lot D10).
    // à trois tiroirs rendue comme un caisson blanc sans un trait — ce qu'un
    // et qu'on le regardait par derrière.
    const dehors = options.decor
      ? (options.decor.vuDepuis ??
          (options.decor.type === 'baie' || options.decor.type === 'piece'
            ? 'dedans'
            : 'dehors')) === 'dehors'
      : false;
    if (orientationLibre && dehors) {
      azimut = Math.PI - 0.42;
    }
    // ON NE REGARDE PAS UN TOIT D'EN BAS. La caméra part à neuf degrés
    // au-dessus de l'horizon — ce qu'il faut pour une façade, et ce qui
    // rend un pan de couverture presque de champ : la première capture
    // montrait la fenêtre comme un écran d'ordinateur posé sur une pente,
    // parce qu'on la voyait par la tranche.
    //
    // On monte donc vers la NORMALE du pan, sans l'atteindre : la normale
    // seule donnerait une vue en plan, à plat, sans relief. Trois quarts du
    // chemin laissent voir l'épaisseur du dormant et l'ombre portée, qui
    // sont ce qui dit qu'une fenêtre de toit est encastrée et non posée.
    if (orientationLibre && options.decor?.type === 'rampant') {
      hauteur = inclinaisonDuRampant(options.decor.penteToitDeg) * 0.75;
    }
    // L'appoint suit désormais la CAMÉRA, pas le décor : voir
    // `reglerLumiere`, appelée à chaque placement. On mémorise seulement
    // s'il y a un décor — sans décor, il n'y a pas de pièce à éclairer.
    decorPose = Boolean(options.decor);

    const bornes = bornesDesPieces(geometrie);
    if (bornes) {
      // LE DÉCOR PEUT ÉLARGIR LE CADRE. Le mur d'une baie est un fond qu'on
      // d'échelle, et les couper en deux ôte au décor sa raison d'être.
      const marge = options.decor ? margeDeCadrageMm(options.decor.type) : 0;
      // LA HAUTEUR DU CIEL. Dehors, cadrer sur le seul ouvrage coupait la
      // maison à mi-toit — et une maison sans toit n'est pas une maison.
      // On ajoute donc de la hauteur au-dessus, assez pour que le faîtage
      const ciel = options.decor
        ? hauteurDeCielMm(options.decor.type, dehors, bornes.max[1] - bornes.min[1])
        : 0;
      horsToutM = {
        largeur: (bornes.max[0] - bornes.min[0] + 2 * marge) / 1000,
        hauteur: (bornes.max[1] - bornes.min[1] + ciel) / 1000,
        profondeur: (bornes.max[2] - bornes.min[2]) / 1000,
      };
      // LE CENTRE REMONTE DE LA MOITIÉ DU CIEL AJOUTÉ, et il ne le faisait
      // PAS : l'ordre était écrit, puis écrasé à la ligne suivante par un
      // `centre` tout neuf calculé sur les seules bornes des pièces. Un
      // ordre qui n'arrive jamais — et son propre commentaire disait déjà ce
      // qu'on verrait sans lui : « le cadre s'ouvrirait vers le bas, sur de
      // la pelouse ».
      //
      // C'EST EXACTEMENT CE QUE MONTRAIENT LES CAPTURES (lot D17). Sur un
      // gazon et la maison du fond sortait du cadre PAR LE TOIT : le champ
      // s'élargissait bien de 2,6 m de ciel — la caméra reculait d'autant —
      // mais il restait centré sur le produit, si bien que la hauteur gagnée
      // s'ouvrait SOUS lui. Le décor des ouvrages posés au sol n'a rien à
      // montrer en dessous : le sol est à leur pied.
      //
      // Le centre se calcule donc D'ABORD sur les bornes, et le ciel s'ajoute
      // ENSUITE. Une ligne d'ordre, et c'est tout le cadrage du dehors.
      centre = new Vector3(
        (bornes.min[0] + bornes.max[0]) / 2000,
        (bornes.min[1] + bornes.max[1]) / 2000,
        (bornes.min[2] + bornes.max[2]) / 2000,
      );
      centre.y += ciel / 2000;
      // Un objet PLUS PROFOND QUE HAUT — un store banne — se regarde d'en
      // haut. À l'élévation de caméra d'une fenêtre, sa toile est vue par
      // la tranche et se réduit à un trait blanc.
      if (orientationLibre && horsToutM.profondeur > horsToutM.hauteur * 1.5) {
        hauteur = 0.52;
      }
    }

    // Le soleil suit la menuiserie : sa caméra d'ombre est orthographique et
    // doit couvrir la scène, décor compris. Trop large, l'ombre devient
    // grossière ; trop étroite, elle se coupe net au bord du champ.
    const rayon = Math.max(horsToutM.largeur, horsToutM.hauteur, horsToutM.profondeur) * 1.5 + 1.6;
    // DE QUEL CÔTÉ VIENT LE SOLEIL. Il était toujours du côté INTÉRIEUR —
    // ce qui convient à une baie, qu'on regarde depuis la pièce, et qui
    // met à CONTRE-JOUR tout ce qu'on regarde depuis dehors : la façade
    // grises, comme un jour de pluie, et le décor perdait le relief qui le
    // rendait crédible. Le soleil suit donc le point de vue.
    const cotePris = dehors ? -1 : 1;
    soleil.position.set(
      centre.x - rayon * 0.55,
      centre.y + rayon * 0.85,
      centre.z + cotePris * rayon * 0.95,
    );
    soleil.target.position.copy(centre);
    soleil.target.updateMatrixWorld();
    const camOmbre = soleil.shadow.camera;
    camOmbre.left = -rayon;
    camOmbre.right = rayon;
    camOmbre.top = rayon;
    camOmbre.bottom = -rayon;
    camOmbre.near = 0.1;
    camOmbre.far = rayon * 4.5;
    camOmbre.updateProjectionMatrix();

    cadrer();
    appliquerOuverture();
    placerCamera();
    besoinDeRendu = true;
  };

  /**
   * L'occlusion ambiante par post-traitement (SSAOPass) a été essayée puis
   * RETIRÉE. Elle coûtait 12 ko gzippés au morceau 3D — acceptable — mais
   * elle rendait un aplat gris : la chaîne de post-traitement demande un
   * canevas opaque et une gestion de profondeur que ce rendu, volontairement
   * transparent pour laisser voir le fond de la page, ne lui donne pas.
   *
   * Ce qui la remplace fait l'essentiel pour zéro passe supplémentaire : les
   * OMBRES PORTÉES creusent le tableau et posent l'ouvrant dans le dormant,
   * et la lumière HÉMISPHÉRIQUE éclaire différemment ce qui regarde le ciel
   * et ce qui regarde le sol. Une menuiserie est faite de plans francs :
   * c'est l'ombre, plus que l'occlusion, qui la met en relief.
   */
  let vivante = true;
  const boucle = () => {
    if (!vivante) return;
    if (besoinDeRendu) {
      moteur.render(scene, camera);
      besoinDeRendu = false;
    }
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);

  return {
    mettreAJour,
    ouvrir(taux: number) {
      tauxOuverture = Math.min(1, Math.max(0, taux));
      appliquerOuverture();
      besoinDeRendu = true;
    },
    tourner(deltaAzimut: number, deltaHauteur: number) {
      orientationLibre = false;
      azimut += deltaAzimut;
      hauteur = Math.min(1.2, Math.max(-0.6, hauteur + deltaHauteur));
      placerCamera();
      besoinDeRendu = true;
    },
    orienter(azimutVoulu: number, hauteurVoulue: number) {
      orientationLibre = false;
      azimut = azimutVoulu;
      hauteur = Math.min(1.2, Math.max(-0.6, hauteurVoulue));
      placerCamera();
      besoinDeRendu = true;
    },
    viser(angle: AngleDeVue, cote: CoteDeVue | null) {
      // Le côté demandé, ou celui où l'on se trouve déjà : changer d'ANGLE
      // ne doit pas faire passer de l'autre côté du mur sans l'avoir
      // demandé.
      const cible = cote ?? coteCourant();
      const pose = ANGLES[angle];
      orientationLibre = false;
      azimut = cible === 'dehors' ? Math.PI - pose.azimut : pose.azimut;
      hauteur = pose.hauteur;
      placerCamera();
      besoinDeRendu = true;
    },
    pointDeVue() {
      const cote = coteCourant();
      // On rend l'angle DÉCLARÉ le plus proche : deux degrés d'écart après
      // un glissé de souris ne doivent pas éteindre le bouton enfoncé.
      const reference = cote === 'dehors' ? Math.PI - azimut : azimut;
      let angle: AngleDeVue = 'trois-quarts';
      let ecartMin = Infinity;
      for (const [nom, pose] of Object.entries(ANGLES) as Array<[AngleDeVue, { azimut: number; hauteur: number }]>) {
        const ecart = Math.abs(pose.azimut - reference) + Math.abs(pose.hauteur - hauteur) * 0.6;
        if (ecart < ecartMin) {
          ecartMin = ecart;
          angle = nom;
        }
      }
      return { angle: ecartMin < 0.2 ? angle : 'trois-quarts', cote, zoom };
    },
    rapprocher(facteur: number) {
      // LE ZOOM EST BORNÉ, et il l'est sur un FACTEUR CUMULÉ, pas sur un
      // pas. Le premier jet multipliait `distance` sans mémoire : trente
      // crans de molette et la caméra était dans le vitrage, trente en
      // arrière et la menuiserie devenait un point. On ne revenait jamais
      // au cadrage d'origine.
      zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * facteur));
      placerCamera();
      besoinDeRendu = true;
    },
    redimensionner(largeur: number, hauteurPx: number) {
      moteur.setSize(largeur, hauteurPx, false);
      camera.aspect = largeur / Math.max(1, hauteurPx);
      camera.updateProjectionMatrix();
      // Le format change : le cadrage aussi, sinon une colonne étroite
      // coupe la menuiserie sur les côtés.
      cadrer();
      placerCamera();
      besoinDeRendu = true;
    },
    detruire() {
      vivante = false;
      vider();
      moteur.dispose();
    },
  };
}
