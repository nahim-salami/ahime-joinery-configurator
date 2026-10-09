
import type { DeductionsGamme, FamilleCatalog } from '../../catalog.ts';
import type { Materiau } from '../../types.ts';

/**
 * LA CHAÎNE DE COTES des menuiseries vitrées (lot 0) — les masses vues
 * qui séparent le hors-tout du clair de vitrage, par matériau.
 *
 * Elles vivent dans le module de famille, et pas dans le catalogue global,
 * parce qu'elles ne servent qu'ici : le chargement initial du widget n'a
 * pas à porter les sept nombres d'un profilé de fenêtre pour un visiteur
 * venu configurer un volet roulant. Le vérificateur de bundle l'a dit au
 * premier essai — un demi-kilo-octet gzippé de trop.
 *
 * Calibrage : ces valeurs se vérifient sur une menuiserie posée (on mesure
 * la bande entre le tableau et le verre) et elles sont réglées pour que le
 * taux de clair d'une menuiserie courante tombe entre 55 et 75 % — la
 * fourchette du métier, que `structural.test.ts` verrouille.
 */
const FRAPPE: Record<Materiau, DeductionsGamme> = {
  // PVC 70 : dormant 33 vu + ouvrant 52 (parclose comprise) = 85 par côté.
  pvc: { dormantVuMm: 33, ouvrantVuMm: 52, battementMm: 112, meneauMm: 80, renovationEcartMm: 0, priseDeVerreMm: 12, jeuVitrageMm: 4, recouvrementOuvrantMm: 8 },
  // L'aluminium vend sa FINESSE : c'est son argument, et il se voit.
  alu: { dormantVuMm: 25, ouvrantVuMm: 45, battementMm: 100, meneauMm: 70, renovationEcartMm: 0, priseDeVerreMm: 10, jeuVitrageMm: 4, recouvrementOuvrantMm: 6 },
  bois: { dormantVuMm: 35, ouvrantVuMm: 55, battementMm: 130, meneauMm: 90, renovationEcartMm: 0, priseDeVerreMm: 14, jeuVitrageMm: 4, recouvrementOuvrantMm: 12 },
  mixte: { dormantVuMm: 30, ouvrantVuMm: 50, battementMm: 120, meneauMm: 85, renovationEcartMm: 0, priseDeVerreMm: 12, jeuVitrageMm: 4, recouvrementOuvrantMm: 10 },
};

/** Une variante de la frappe : mêmes profils, un ouvrant plus large. */
const ouvrantPlusLarge = (
  parMateriau: Record<Materiau, number>,
): Record<Materiau, DeductionsGamme> => ({
  pvc: { ...FRAPPE.pvc, ouvrantVuMm: parMateriau.pvc },
  alu: { ...FRAPPE.alu, ouvrantVuMm: parMateriau.alu },
  bois: { ...FRAPPE.bois, ouvrantVuMm: parMateriau.bois },
  mixte: { ...FRAPPE.mixte, ouvrantVuMm: parMateriau.mixte },
});

/**
 * UN COULISSANT N'A PAS DE BATTEMENT, il a une CHICANE : les deux montants
 * centraux s'emboîtent au lieu de se recouvrir, et la chicane fait la
 * moitié d'un battement de frappe. Ses profils sont aussi plus fins. C'est
 * ce qui permet à une baie de montrer presque tout son verre — et c'est
 * exactement ce qu'on lui achète.
 */
const COULISSANT: Record<Materiau, DeductionsGamme> = {
  // `recouvrementOuvrantMm: 0` — un vantail coulissant NE RECOUVRE PAS son
  // dormant : il roule dans un rail, entre deux joints-brosses. Le
  // recouvrement de la frappe est ce qui rend une menuiserie étanche à la
  // pression ; un coulissant, lui, l'est par sa chicane. C'est aussi ce qui
  // explique qu'il soit classé plus bas à l'air et à l'eau.
  pvc: { ...FRAPPE.pvc, dormantVuMm: 30, ouvrantVuMm: 47, battementMm: 60, recouvrementOuvrantMm: 0 },
  alu: { ...FRAPPE.alu, dormantVuMm: 22, ouvrantVuMm: 44, battementMm: 40, recouvrementOuvrantMm: 0 },
  bois: { ...FRAPPE.bois, dormantVuMm: 34, ouvrantVuMm: 52, battementMm: 70, recouvrementOuvrantMm: 0 },
  mixte: { ...FRAPPE.mixte, dormantVuMm: 28, ouvrantVuMm: 48, battementMm: 56, recouvrementOuvrantMm: 0 },
};
import type { FamilleId } from '../../types.ts';

export const CATALOGUE: Partial<Record<FamilleId, FamilleCatalog>> = {
    fenetre: {
      label: 'Fenêtre',
      matrices: {
        '1': {
          widthsMm: [400, 600, 800, 1000, 1200],
          heightsMm: [450, 700, 950, 1200, 1500, 1800, 2100],
          cellsCents: [
            [16900, 19100, 21400, 23700, 26000],
            [18900, 21500, 24100, 26700, 29200],
            [21000, 23900, 26700, 29600, 32500],
            [23100, 26300, 29400, 32600, 35700],
            [25600, 29100, 32600, 36100, 39600],
            [28100, 31900, 35800, 39600, 43500],
            [30600, 34800, 39000, 43200, 47400],
          ],
        },
        // Le bloc 800–1600 × 800–1500 est celui de docs/04 §1, verbatim.
        '2': {
          widthsMm: [800, 1000, 1200, 1400, 1600, 1900, 2200, 2400],
          heightsMm: [800, 1000, 1200, 1350, 1500, 1800, 2100],
          cellsCents: [
            [28900, 31500, 34200, 37100, 40300, 46200, 51000, 54200],
            [31500, 34400, 37500, 40800, 44400, 50800, 56000, 59500],
            [34200, 37500, 41000, 44700, 48800, 55300, 61000, 64800],
            [36300, 39900, 43700, 47800, 52300, 58700, 64800, 68800],
            [38500, 42400, 46600, 51100, 56000, 62100, 68600, 72900],
            [42600, 47400, 52200, 57000, 61700, 68900, 76100, 80900],
            [46800, 52100, 57300, 62600, 67800, 75700, 83600, 88900],
          ],
        },
        '3': {
          widthsMm: [1800, 2100, 2400, 2700, 3000],
          heightsMm: [800, 1000, 1200, 1500, 1800, 2100],
          cellsCents: [
            [49200, 54200, 59100, 64100, 69100],
            [53800, 59200, 64700, 70100, 75600],
            [58300, 64300, 70200, 76200, 82100],
            [65100, 71800, 78500, 85200, 91900],
            [72000, 79400, 86800, 94300, 101700],
            [78800, 87000, 95100, 103300, 111500],
          ],
        },
        '4': {
          widthsMm: [2400, 2800, 3200, 3600],
          heightsMm: [800, 1200, 1500, 1800, 2100],
          cellsCents: [
            [64600, 71500, 78400, 85300],
            [76100, 84300, 92600, 100800],
            [84700, 93900, 103200, 112400],
            [93300, 103500, 113800, 124000],
            [101900, 113100, 124400, 135700],
          ],
        },
      },
      bornes: {
        minWidthMm: 400,
        minHeightMm: 450,
        vantauxMin: 1,
        vantauxMax: 4,
        vantailMinMm: 280,
        vantailMaxMm: { pvc: 900, alu: 1200, bois: 1000, mixte: 1100 },
      },
      coefMateriauMilliemes: { pvc: 1000, alu: 1600, bois: 1850, mixte: 2200 },
      ouvertures: ['frappe', 'fixe', 'soufflet'],
      coefOuvertureMilliemes: { frappe: 1000, fixe: 820, soufflet: 950 },
      vitree: true,
      seuilsFerrures: { standardKg: 80, renforceKg: 130 },
      // La fenêtre suit la CHAÎNE DE COTES (lot 0) : dormant, ouvrant,
      // battement compté une fois, parclose, jeu de vitrage.
      deductions: FRAPPE,
    },
    'porte-fenetre': {
      label: 'Porte-fenêtre',
      matrices: {
        '1': {
          widthsMm: [700, 900, 1100],
          heightsMm: [1950, 2100, 2250, 2400],
          cellsCents: [
            [49100, 53900, 58700],
            [51100, 56100, 61200],
            [53000, 58300, 63600],
            [55000, 60500, 66000],
          ],
        },
        '2': {
          widthsMm: [1200, 1400, 1600, 1800, 2000],
          heightsMm: [1950, 2100, 2250, 2400],
          cellsCents: [
            [64900, 69900, 74900, 80000, 85000],
            [67500, 72700, 78000, 83300, 88600],
            [70100, 75600, 81100, 86600, 92100],
            [72700, 78400, 84200, 89900, 95600],
          ],
        },
        '3': {
          widthsMm: [1800, 2100, 2400, 2700, 3000],
          heightsMm: [1950, 2100, 2250, 2400],
          cellsCents: [
            [85000, 92800, 100600, 108500, 116300],
            [88400, 96600, 104700, 112900, 121100],
            [91800, 100300, 108900, 117400, 126000],
            [95100, 104100, 113000, 121900, 130800],
          ],
        },
      },
      bornes: {
        minWidthMm: 600,
        minHeightMm: 1900,
        vantauxMin: 1,
        vantauxMax: 3,
        vantailMinMm: 500,
        vantailMaxMm: { pvc: 900, alu: 1200, bois: 1000, mixte: 1100 },
      },
      coefMateriauMilliemes: { pvc: 1000, alu: 1600, bois: 1850, mixte: 2200 },
      ouvertures: ['frappe', 'fixe'],
      coefOuvertureMilliemes: { frappe: 1000, fixe: 850 },
      vitree: true,
      seuilsFerrures: { standardKg: 90, renforceKg: 150 },
      // La traverse basse d'une porte-fenêtre est plus haute que celle
      // d'une fenêtre : elle prend les coups de pied et porte le seuil.
      deductions: ouvrantPlusLarge({ pvc: 60, alu: 52, bois: 64, mixte: 58 }),
    },
    coulissant: {
      label: 'Baie coulissante',
      matrices: {
        // Construit pour que base(2400, 2150) = 69200 — l'exemple de docs/04 §6.
        '2': {
          widthsMm: [1800, 2000, 2200, 2400, 2700, 3000],
          heightsMm: [1800, 2000, 2100, 2200, 2400],
          cellsCents: [
            [56000, 59000, 62200, 65600, 71000, 76800],
            [58500, 61600, 64900, 68400, 74000, 80000],
            [59800, 63000, 66400, 68800, 74800, 81000],
            [61200, 64500, 67900, 69600, 76400, 82800],
            [64000, 67400, 71000, 73000, 80000, 86600],
          ],
        },
        '3': {
          widthsMm: [2700, 3000, 3300, 3600, 4000],
          heightsMm: [1800, 2000, 2200, 2400],
          cellsCents: [
            [98000, 104200, 110400, 116600, 124800],
            [103100, 109700, 116300, 122800, 131600],
            [108300, 115200, 122200, 129100, 138400],
            [113400, 120700, 128100, 135400, 145100],
          ],
        },
        '4': {
          widthsMm: [3600, 4000, 4400, 4800, 5400, 6000],
          heightsMm: [1800, 2000, 2200, 2400],
          cellsCents: [
            [121600, 129800, 137900, 146000, 158200, 170400],
            [127800, 136400, 145000, 153600, 166500, 179400],
            [134000, 143000, 152100, 161200, 174800, 188400],
            [140100, 149700, 159200, 168800, 183100, 197500],
          ],
        },
      },
      bornes: {
        minWidthMm: 1600,
        minHeightMm: 1750,
        vantauxMin: 2,
        vantauxMax: 4,
        vantailMinMm: 700,
        vantailMaxMm: { pvc: 1250, alu: 1600, bois: 1400, mixte: 1500 },
      },
      coefMateriauMilliemes: { pvc: 1000, alu: 1600, bois: 2000, mixte: 2300 },
      // LE LEVAGE (lot MT1a) est une OUVERTURE, pas une famille : ce qui
      // change est la ferrure, les cotes, le seuil et le prix — pas le
      // produit. Son coefficient est le plus haut du catalogue parce que le
      // prix d'un lift & slide est dominé par deux postes que le coulissant
      // ordinaire n'a pas : la ferrure de levage (classe EN 13126-16) et le
      // triple vitrage que ses cotes appellent. Voir sa liste de différences
      // en tête de `familles/vitrees/levage.ts`.
      ouvertures: ['coulissant', 'galandage', 'levage'],
      coefOuvertureMilliemes: { coulissant: 1000, galandage: 1450, levage: 1750 },
      vitree: true,
      seuilsFerrures: { standardKg: 80, renforceKg: 200 },
      // UN COULISSANT N'A PAS DE BATTEMENT, il a une CHICANE : les deux
      // montants centraux s'emboîtent au lieu de se recouvrir, et la
      // chicane fait la moitié d'un battement de frappe. C'est ce qui
      // permet à une baie de montrer presque tout son verre — et c'est
      // exactement ce qu'on lui achète.
      deductions: COULISSANT,
    },
    'porte-entree': {
      label: 'Porte d’entrée',
      matrices: {
        // La rangée 2400 existe pour l'IMPOSTE : une porte surmontée d'un
        // fixe vitré dépasse la hauteur d'une porte seule, et la matrice
        // s'arrêtant à 2250 la refusait. Elle prolonge la progression des
        // rangées précédentes (≈ +2 % par 100 mm) et ne touche à rien en
        // deçà — l'interpolation d'une porte de 2150 est inchangée.
        '1': {
          widthsMm: [800, 900, 1000, 1100],
          heightsMm: [1950, 2050, 2150, 2250, 2400],
          cellsCents: [
            [82400, 84800, 87200, 89500],
            [84000, 86400, 88900, 91300],
            [85600, 88100, 90600, 93000],
            [87200, 89700, 92300, 94800],
            [89700, 92300, 95000, 97500],
          ],
        },
        // 2 « vantaux » = porte + tierce.
        '2': {
          widthsMm: [1200, 1350, 1500, 1650, 1800],
          heightsMm: [1950, 2050, 2150, 2250, 2400],
          cellsCents: [
            [106900, 110500, 114100, 117800, 121400],
            [108700, 112400, 116200, 119900, 123600],
            [110600, 114400, 118200, 122000, 125800],
            [112400, 116300, 120200, 124100, 128000],
            [115700, 119700, 123700, 127700, 131700],
          ],
        },
      },
      bornes: {
        minWidthMm: 750,
        minHeightMm: 1900,
        vantauxMin: 1,
        vantauxMax: 2,
        vantailMinMm: 350,
        vantailMaxMm: { pvc: 1000, alu: 1100, bois: 1100, mixte: 1100 },
      },
      coefMateriauMilliemes: { pvc: 1000, alu: 1500, bois: 1750, mixte: 2100 },
      ouvertures: ['frappe'],
      coefOuvertureMilliemes: { frappe: 1000 },
      // UNE PORTE S'OUVRE PLEINE, et c'est ici que ça se déclare depuis le lot
      // C12d. `configurationParDefaut` portait la ligne
      // `if (famille === 'porte-entree') config.remplissagePorte = 'pleine'` —
      // un nom de famille écrit en dur dans une fonction qui sert les quarante,
      // donc payé au CHARGEMENT INITIAL par tout visiteur venu configurer une
      // premier geste du lot a été de lui faire porter ce qu'il y avait déjà.
      defauts: { remplissagePorte: 'pleine' },
      vitree: false, // vitrée selon remplissage — géré par effectiveVitrage()
      seuilsFerrures: { standardKg: 90, renforceKg: 140 },
      // Un ouvrant de porte est le plus large de toute la menuiserie : il
      // porte la serrure multipoints et encaisse les claquements. Sa
      // battue de recouvrement, seule, fait 40 mm.
      deductions: ouvrantPlusLarge({ pvc: 78, alu: 70, bois: 84, mixte: 76 }),
    },
};
