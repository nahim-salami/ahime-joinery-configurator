
import type { ContexteDessin, ModuleFamille } from './registre.ts';
import { CATALOGUE_BSO, reglesBso } from './solaire/bso.ts';
import { CATALOGUE_SCREEN_ZIP, reglesScreenZip } from './solaire/screen-zip.ts';
import { elevationBso, elevationScreenZip } from './solaire/dessin.ts';

function dessin({ config, rects, lines }: ContexteDessin): void {
  if (config.famille === 'bso') elevationBso(config, rects, lines);
  else elevationScreenZip(config, rects, lines);
}

export const MODULE: ModuleFamille = {
  groupe: 'solaire',
  marque: 'ahjc:module-de-famille:solaire',
  catalogue: {
    bso: CATALOGUE_BSO,
    'screen-zip': CATALOGUE_SCREEN_ZIP,
  },
  // PAS D'OPTION PROPRE, et c'est un choix plutôt qu'un oubli. Le capteur
  // vent est vendu par le groupe des fermetures pour le store banne, qui se
  // REPLIE : le capteur lui sert à décider de rentrer. Un BSO ne se replie
  // pas — son capteur sert à ORIENTER ses lames à plat, ce qui n'est pas la
  // même fonction, ni le même prix, ni la même pose. Le copier aurait été
  // le genre de ressemblance que la liste de différences dénonce.
  regles: (contexte) => [...reglesBso(contexte), ...reglesScreenZip(contexte)],
  dessin,
  // LOT D16e : les lames d'un BSO se posent dans le volume des FERMETURES — un BSO est un
  // vénitien extérieur, et une seule copie des lames vaut le téléchargement.
  volume: async () => {
    const [moteur] = await Promise.all([import('../geometry3d.ts'), import('./fermetures/volume.ts')]);
    return moteur.computeGeometry3D;
  },
};
