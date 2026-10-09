
import {
  DEFAULT_CATALOG,
  familleCatalog,
  formeDe,
  formesDeLaFamille,
  type PricingCatalog,
} from '../../catalog.ts';
import { flecheEffective, offsetContour } from '../../geometrie/formes.ts';
import { moduleDe } from '../registre.ts';
import { nommerVantaux } from '../../libelles.ts';
import type { JoineryConfiguration, ValidationIssue } from '../../types.ts';

export function reglesDeForme(contexte: {
  config: JoineryConfiguration;
  catalog: PricingCatalog;
}): ValidationIssue[] {
  const { config, catalog } = contexte;
  const issues: ValidationIssue[] = [];
  const fam = familleCatalog(catalog, config.famille);

  // --- La forme
  // Elle ne se refuse presque jamais : elle se REDIRIGE. Un client qui
  // demande un œil-de-bœuf coulissant n'a pas fait d'erreur de saisie — il
  // a demandé une chose qui ne se fabrique pas, et on lui dit laquelle des
  // deux garder.
  if (config.forme !== undefined && config.forme !== 'rectangle') {
    const forme = formeDe(catalog, config.forme);
    if (forme.id !== config.forme) {
      issues.push({
        code: 'forme-inconnue',
        severite: 'erreur',
        message: `La forme « ${config.forme} » n'existe pas au catalogue.`,
        alternative: { label: 'Revenir au rectangle', patch: { forme: 'rectangle' } },
      });
    } else if (!forme.familles.includes(config.famille)) {
      const disponibles = formesDeLaFamille(catalog, config.famille);
      issues.push({
        code: 'forme-hors-famille',
        severite: 'erreur',
        message: `${fam.label} : la forme « ${forme.label.toLowerCase()} » ne se fabrique pas dans cette famille.`,
        alternative: {
          label: `Revenir à « ${(disponibles[0]?.label ?? 'Rectangulaire').toLowerCase()} »`,
          patch: { forme: disponibles[0]?.id ?? 'rectangle' },
        },
      });
    } else {
      const ouverture = config.ouverture ?? fam.ouvertures?.[0];
      if (forme.ouvertures && ouverture && !forme.ouvertures.includes(ouverture)) {
        issues.push({
          code: 'forme-ouverture-incompatible',
          severite: 'erreur',
          message: `Une menuiserie « ${forme.label.toLowerCase()} » ne se fait pas en ${ouverture} : son contour n'a pas de montant droit pour porter le rail ou la ferrure.`,
          alternative: {
            label: `Passer en ${forme.ouvertures[0]}`,
            patch: { ouverture: forme.ouvertures[0] },
          },
        });
      }
      if (config.flecheMm !== undefined) {
        const retenue = Math.round(
          flecheEffective(forme.id, config.widthMm, config.heightMm, config.flecheMm),
        );
        if (Math.abs(retenue - config.flecheMm) > 1) {
          issues.push({
            code: 'fleche-hors-bornes',
            severite: 'avertissement',
            message: `Montée de ${config.flecheMm} mm impossible sur ${config.widthMm} × ${config.heightMm} mm : la valeur retenue sera ${retenue} mm.`,
            alternative: { label: `Retenir ${retenue} mm`, patch: { flecheMm: retenue } },
          });
        }
      }
      if (forme.id === 'rond' && config.widthMm !== config.heightMm) {
        const cote = Math.min(config.widthMm, config.heightMm);
        issues.push({
          code: 'rond-non-carre',
          severite: 'avertissement',
          message: `Un œil-de-bœuf s'inscrit dans un carré : sur ${config.widthMm} × ${config.heightMm} mm le cercle ne fera que ${cote} mm, et le reste sera perdu.`,
          alternative: {
            label: `Passer à ${cote} × ${cote} mm`,
            patch: { widthMm: cote, heightMm: cote },
          },
        });
      }
      // Le profilé a-t-il seulement la place de rentrer dans la forme ?
      const bande = fam.frameBandMm?.[config.materiau] ?? catalog.frameBandMm[config.materiau];
      const tracer = moduleDe(config.famille)?.contourDeForme;
      const contour = tracer?.(
        forme.id,
        config.widthMm,
        config.heightMm,
        config.flecheMm,
        config.formeCoteBas ?? 'gauche',
      );
      if (contour && offsetContour(contour, bande).length < 3) {
        issues.push({
          code: 'forme-trop-etroite',
          severite: 'erreur',
          message: `La forme « ${forme.label.toLowerCase()} » ne laisse pas la place au profilé de ${bande} mm : il ne resterait aucun clair de vitrage.`,
          alternative: { label: 'Revenir au rectangle', patch: { forme: 'rectangle' } },
        });
      }
    }
  }
  if (config.flecheMm !== undefined && (config.forme ?? 'rectangle') === 'rectangle') {
    issues.push({
      code: 'fleche-sans-forme',
      severite: 'avertissement',
      message:
        'La montée ne concerne que les formes cintrées, le rampant et le triangle — valeur ignorée.',
    });
  }

  return issues;
}
