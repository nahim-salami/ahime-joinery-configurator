/**
 * Pourquoi ce fichier existe : la COUPE DE PROFILÉ — « le dessin qui vend la
 * gamme » ([docs/05](../../../../docs/05-roadmap.md), phase 3) — est un
 * argument, pas un prix. Elle part donc à la demande, comme la 3D, la
 * réalité augmentée, la photo, le plan de masse, le devis et le panier
 * plein.
 *
 * C'est la couture que le lot 7.4 apporte pour payer ce qu'il coûte. Le
 * budget du chargement initial est un verrou, et la note de
 * `verifier-bundle.mjs` est explicite : chaque lot cherche ce qu'il peut
 * rendre avant de demander une hausse. Les écrans de panne, eux, ne peuvent
 * pas être paresseux — un écran qui dit « le morceau n'est pas arrivé » ne
 * peut pas arriver dans un morceau. La coupe, si.
 *
 * Ce qu'on paie : la section apparaît une fraction de seconde après le
 * dessin, sur le premier affichage seulement. Ce qu'on gagne : 2,1 ko
 * gzippés pour tout le monde, y compris ceux qui ne descendent jamais
 * jusque-là.
 */

import { computeCoupe, coupeToSvg, type JoineryConfiguration, type PricingCatalog } from '@ahjc/core';
import { useT } from '../i18n.ts';
import { formater, type Unite } from '../unites.ts';

export function VueCoupe(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  unite: Unite;
}) {
  const t = useT();
  const coupe = computeCoupe(props.config, props.catalogue);
  return (
    <div className="coupe" data-test="coupe-profil">
      <div className="coupe-dessin" dangerouslySetInnerHTML={{ __html: coupeToSvg(coupe) }} />
      <p className="coupe-texte">
        {/* Le NOM de la gamme quand le marchand en vend une : c'est ce
            qu'il met sur son devis, pas « alu gamme standard ». */}
        {coupe.nomSysteme ? (
          <>{t('Gamme')} <strong>{coupe.nomSysteme}</strong> — </>
        ) : (
          <>{t('Profilé')} <strong>{props.config.materiau}</strong> {t('gamme')}{' '}
            <strong>{props.config.gamme}</strong> — </>
        )}
        {formater(coupe.epaisseurMm, props.unite)}
        {coupe.chambres > 0 ? t(', {n} chambres', { n: coupe.chambres }) : t(', massif')}
        {coupe.ruptureThermique ? t(', rupture de pont thermique') : ''}.{' '}
        <span>{t('Coupe schématique, à l’échelle de l’épaisseur réelle.')}</span>
      </p>
    </div>
  );
}
