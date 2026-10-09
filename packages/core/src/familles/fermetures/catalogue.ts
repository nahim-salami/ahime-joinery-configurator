
import type { FamilleCatalog } from '../../catalog.ts';
import type { FamilleId } from '../../types.ts';

export const CATALOGUE: Partial<Record<FamilleId, FamilleCatalog>> = {
    'volet-roulant': {
      label: 'Volet roulant',
      matrices: {
        '1': {
          widthsMm: [600, 1000, 1400, 1800, 2200, 2600, 3000],
          heightsMm: [600, 1000, 1400, 1800, 2200, 2600],
          cellsCents: [
            [17400, 20800, 24100, 27500, 30900, 34200, 37600],
            [20300, 24300, 28300, 32300, 36300, 40300, 44300],
            [23200, 27800, 32500, 37100, 41700, 46400, 51000],
            [26100, 31300, 36600, 41900, 47200, 52500, 57700],
            [28900, 34900, 40800, 46700, 52600, 58500, 64500],
            [31800, 38400, 44900, 51500, 58100, 64600, 71200],
          ],
        },
      },
      bornes: {
        minWidthMm: 400,
        minHeightMm: 500,
        vantauxMin: 1,
        vantauxMax: 1,
        vantailMinMm: 400,
        vantailMaxMm: { pvc: 2400, alu: 3000 },
      },
      coefMateriauMilliemes: { pvc: 1000, alu: 1180 },
      vitree: false,
    },
    'volet-battant': {
      label: 'Volet battant',
      matrices: {
        '1': {
          widthsMm: [300, 450, 600, 750],
          heightsMm: [600, 1000, 1400, 1800, 2200],
          cellsCents: [
            [13500, 15200, 16800, 18400],
            [16100, 17900, 19700, 21500],
            [18700, 20600, 22600, 24600],
            [21200, 23400, 25500, 27700],
            [23800, 26100, 28500, 30800],
          ],
        },
        '2': {
          widthsMm: [600, 900, 1200, 1500, 1700],
          heightsMm: [600, 1000, 1400, 1800, 2200],
          cellsCents: [
            [20000, 23400, 26800, 30200, 32500],
            [23100, 26900, 30700, 34600, 37100],
            [26300, 30500, 34700, 38900, 41700],
            [29500, 34000, 38600, 43200, 46200],
            [32600, 37600, 42500, 47500, 50800],
          ],
        },
      },
      bornes: {
        minWidthMm: 250,
        minHeightMm: 500,
        vantauxMin: 1,
        vantauxMax: 2,
        vantailMinMm: 250,
        vantailMaxMm: { pvc: 700, alu: 800, bois: 850 },
      },
      coefMateriauMilliemes: { pvc: 1000, alu: 1300, bois: 1450 },
      vitree: false,
    },
    'store-banne': {
      label: 'Store banne',
      matrices: {
        // La « hauteur » d'un store est son avancée.
        '1': {
          widthsMm: [1800, 2400, 3000, 3600, 4200, 4800],
          heightsMm: [1500, 2000, 2500, 3000, 3500],
          cellsCents: [
            [94700, 105500, 116300, 127100, 137900, 148700],
            [103000, 115000, 127000, 139000, 151000, 163000],
            [111400, 124600, 137800, 151000, 164200, 177400],
            [119700, 134100, 148500, 162900, 177300, 191700],
            [128100, 143700, 159300, 174900, 190500, 206100],
          ],
        },
      },
      bornes: {
        minWidthMm: 1800,
        minHeightMm: 1500,
        vantauxMin: 1,
        vantauxMax: 1,
        vantailMinMm: 1800,
        vantailMaxMm: { alu: 4800 },
      },
      coefMateriauMilliemes: { alu: 1000 },
      vitree: false,
    },
};
