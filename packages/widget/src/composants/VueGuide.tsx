/**
 * Pourquoi ce fichier existe : LE GUIDE DE COTES ILLUSTRÉ — « la pièce de
 * conversion majeure » ([docs/06](../../../../docs/06-parcours-utilisateurs.md)).
 * Le panneau disait déjà QUOI mesurer, en deux phrases. Il ne montrait pas
 * OÙ, et deux phrases ne remplacent pas un dessin quand le client a un mètre
 * à la main devant un tableau qui penche.
 *
 * UN ÉCRAN PAR TYPE DE POSE, jamais un guide générique — c'est la règle de
 * la compétence `prise-de-cotes` §5, et c'était exactement le défaut de la
 * ligne unique qu'affichait le panneau : « trois mesures par axe », vrai
 * partout, utile nulle part.
 *
 * Les DESSINS sortent du moteur (`export/guide.ts`) ; les PHRASES viennent
 * du catalogue. Rien n'est écrit ici, et c'est voulu : un marchand qui
 * ajoute une pose obtient son écran — schémas compris — sans qu'on rouvre ce
 * fichier, et un marchand qui traduit traduit des données, pas du code.
 *
 * Incident fondateur, celui de Neuffer (docs/09) : quatorze étapes qui
 * découragent. Le guide s'OUVRE à la demande, il ne s'impose pas ; il tient
 * en un écran, et le chrono du parcours de vente ne doit pas le sentir.
 *
 * Il part à la demande, comme la 3D et la coupe : le client qui connaît sa
 * pose n'a aucune raison d'en payer le code.
 */

import { useState } from 'react';
import { elevationToSvg, type Pose, type PricingCatalog } from '@ahjc/core';
import { computeSchemaPose, posesIllustrees, reglesDOr } from '@ahjc/core/src/export/guide.ts';
import { useT } from '../i18n.ts';

const FEUILLE_GUIDE = `
.guide { margin: 12px 0 0; padding: 12px; background: var(--ahjc-surface); border: 1px solid var(--ahjc-bord); border-radius: var(--ahjc-rayon); }
.guide-entete { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.guide-entete h3 { margin: 0; font-size: 15px; }
.guide-planches { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: 12px 0 0; }
.guide-planches figure { margin: 0; }
.guide-dessin { display: flex; justify-content: center; background: var(--ahjc-papier); border-radius: 8px; padding: 8px; }
.guide-dessin svg { width: 100%; height: auto; max-height: 240px; display: block; }
.guide-planches figcaption { margin-top: 6px; font-size: 13px; color: var(--ahjc-encre-douce); }
.guide-planches figcaption strong { color: var(--ahjc-encre); }
.guide-regles { margin: 14px 0 0; padding-left: 20px; font-size: 13px; color: var(--ahjc-encre-douce); }
.guide-regles li { margin-bottom: 6px; }
`.trim();

export function VueGuide(props: {
  catalogue: PricingCatalog;
  /** La pose du client — son écran s'ouvre en premier. */
  pose: Pose;
  onFermer: () => void;
}) {
  const t = useT();
  const poses = posesIllustrees(props.catalogue);
  const [choisie, setChoisie] = useState<Pose>(props.pose);
  const def = poses.find((candidate) => candidate.id === choisie) ?? poses[0];

  return (
    <section className="guide" data-test="guide-illustre" aria-label={t('Guide de prise de cotes')}>
      <style>{FEUILLE_GUIDE}</style>
      <header className="guide-entete">
        <h3>{t('Comment mesurer')}</h3>
        <button type="button" className="retirer" data-test="fermer-guide" onClick={props.onFermer}>
          {t('Fermer')}
        </button>
      </header>

      {/* Le choix de la pose. Ce sont des interrupteurs, comme partout
          ailleurs dans le widget — un seul enfoncé, et le groupe se nomme. */}
      <div className="tuiles" role="group" aria-label={t('Type de pose')}>
        {poses.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className="tuile"
            data-test={`guide-pose-${candidate.id}`}
            aria-pressed={candidate.id === def.id}
            onClick={() => setChoisie(candidate.id)}
          >
            <span>{t(candidate.label)}</span>
          </button>
        ))}
      </div>

      <p className="aide">{t(def.argument)}</p>

      {/* LES DEUX SCHÉMAS, chacun avec sa phrase. Le dessin dit OÙ, la
          phrase dit QUOI — l'un sans l'autre ne suffit pas. */}
      <div className="guide-planches">
        {(
          [
            ['largeur', t('Largeur'), def.mesureLargeur],
            ['hauteur', t('Hauteur'), def.mesureHauteur],
          ] as const
        ).map(([axe, titre, phrase]) => (
          <figure key={axe} data-test={`guide-schema-${axe}`}>
            <div
              className="guide-dessin"
              dangerouslySetInnerHTML={{
                __html: elevationToSvg(computeSchemaPose(def.id, axe, props.catalogue), {
                  titre: `${def.label} — ${titre}`,
                }),
              }}
            />
            <figcaption>
              <strong>{titre}</strong> — {t(phrase)}
            </figcaption>
          </figure>
        ))}
      </div>

      {/* LES RÈGLES D'OR. Ce sont des DONNÉES, livrées avec le module du
          guide plutôt qu'avec le catalogue de prix — trois phrases de
          conseil de chantier n'ont pas à peser sur le premier octet. Un
          marchand qui veut les siennes les pose dans `catalog.guideCotes` ;
          le rejingot est une pièce du bâti français, et le lot
          international les remplacera. */}
      <ol className="guide-regles" data-test="regles-or">
        {reglesDOr(props.catalogue).map((regle) => (
          <li key={regle}>{t(regle)}</li>
        ))}
      </ol>
    </section>
  );
}
