/**
 * Pourquoi ce fichier existe : le point EXACT où le plan de masse entre dans
 * la page, par un `import()` et pas autrement. Tant que le client reste sur
 * le dessin de face — ce qu'il fait neuf fois sur dix — la vue de dessus
 * n'est jamais téléchargée.
 *
 * C'est le même geste que `Vue3D` avec three.js, un étage plus bas : ce
 * n'est pas un moteur de rendu qu'on économise, c'est un calcul de terrain.
 * Le budget du widget ne fait pas la différence entre les deux — et c'est
 * lui qui a exigé cette séparation, au premier ouvrage linéaire ajouté.
 */

import { useMemo } from 'react';
import {
  elevationToSvg,
  type JoineryConfiguration,
  type PricingCatalog,
  type Unite,
} from '@ahjc/core';
import { computePlanDeMasse } from '@ahjc/core/src/export/plan.ts';
import { formater } from '../unites.ts';
import { useT } from '../i18n.ts';

export function VuePlan(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  unite: Unite;
}) {
  const t = useT();
  const svg = useMemo(() => {
    const plan = computePlanDeMasse(props.config, props.catalogue);
    if (!plan) return null;
    return elevationToSvg(plan, {
      unite: props.unite,
      titre: t('Plan de masse — {longueur} développés', {
        longueur: formater(plan.widthMm, props.unite),
      }),
    });
  }, [props.config, props.catalogue, props.unite, t]);

  if (!svg) return <p className="a-venir">{t('Cet ouvrage n’a pas de plan de masse.')}</p>;
  return <div data-test="plan-de-masse" dangerouslySetInnerHTML={{ __html: svg }} />;
}
