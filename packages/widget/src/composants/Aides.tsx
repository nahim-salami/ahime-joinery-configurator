/**
 * Pourquoi ce fichier existe : `aides.ts` et `comparateur.ts` calculaient
 * depuis des lots, et AUCUN ÉCRAN ne les appelait. Le widget n'affichait que
 * le critère technique — « les seuils sont tenus » —, ce qui est un fait sur
 * le produit et pas une somme d'argent. Un calcul juste que personne ne voit
 * ne sert personne.
 *
 * POURQUOI CET ÉCRAN N'EXISTAIT PAS, et c'est une bonne raison : le MONTANT
 * dépend de trois choses que le configurateur ne peut pas deviner — la
 * tranche de revenus, l'âge du logement, le RGE de l'artisan. Les supposer
 * pour afficher un chiffre est la demi-promesse que l'en-tête d'`aides.ts`
 * condamne. Il fallait donc POSER LES QUESTIONS, et c'est tout ce que fait
 * ce panneau.
 *
 * LES RÉPONSES VIVENT DANS L'ÉTAT, pas ici (`SituationClient`). L'écran
 * d'après la signature pose la MÊME question sur le simple vitrage — elle
 * décide de MaPrimeRénov' d'un côté et de l'éco-PTZ de l'autre —, et deux
 * réponses locales auraient pu diverger sur le même écran.
 *
 * CE QU'IL N'ÉCRIT PAS : les phrases. « Peut ouvrir droit à », jamais
 * « vous toucherez » ; la date du barème avec chaque montant ; le motif
 * d'un refus. Tout vient du cœur, où un test le vérifie — une règle de
 * formulation qui vit dans un JSX ne tient pas un mois.
 */

import { useMemo } from 'react';
import type { JoineryConfiguration, PricingCatalog } from '@ahjc/core';
// Par leur CHEMIN et non par l'index : le montant des aides et la
// comparaison de trois gammes n'intéressent que le client qui arbitre, et un
// export de confort les ramènerait dans le chargement initial de tout le
// monde. C'est la raison écrite dans `core/src/index.ts`, honorée ici.
import { computeAides } from '@ahjc/core/src/aides.ts';
import { computeComparatif } from '@ahjc/core/src/comparateur.ts';
import { euros, type SituationClient } from '../etat.ts';
import { useT, aTraduire } from '../i18n.ts';

const TRANCHES: Array<{ id: NonNullable<SituationClient['tranche']>; label: string }> = [
  { id: 'tres-modestes', label: aTraduire('Très modestes') },
  { id: 'modestes', label: aTraduire('Modestes') },
  { id: 'intermediaires', label: aTraduire('Intermédiaires') },
  { id: 'superieurs', label: aTraduire('Supérieurs') },
];

/**
 * SA PEAU VOYAGE AVEC LUI, comme celle du panneau d'après la signature :
 * mise dans la feuille principale, elle se paierait à chaque visite, y
 * compris par qui n'ouvre jamais ce panneau.
 *
 * Aucun accent grave dans cette chaîne : elle vit dans un gabarit, et le
 * premier qui s'y glisse casse la construction sans un mot.
 */
const FEUILLE_AIDES = `
.aides-panneau { border-top: 1px solid var(--ahjc-bord); padding: 14px 16px 20px; display: flex; flex-direction: column; gap: 18px; }
.aides-panneau h3 { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--ahjc-encre-douce); margin: 0 0 8px; }
.aides-questions { display: flex; flex-direction: column; gap: 10px; }
.aides-questions fieldset { border: 1px solid var(--ahjc-bord); border-radius: 6px; padding: 8px 12px 10px; margin: 0; display: flex; flex-wrap: wrap; gap: 4px 18px; }
.aides-questions legend { font-size: 12px; color: var(--ahjc-encre-douce); padding: 0 4px; }
.aides-phrase { font-size: 14px; font-weight: 600; margin: 0 0 10px; }
.aides-lignes { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.aides-lignes li { font-size: 13px; line-height: 1.5; }
.aides-lignes li.ferme { color: var(--ahjc-encre-douce); border-left: 2px solid var(--ahjc-bord); padding-left: 10px; }
.aides-motif { display: block; font-size: 12px; color: var(--ahjc-encre-douce); margin-top: 2px; }
.aides-source { font-size: 11px; color: var(--ahjc-encre-douce); margin: 0; }
.aides-offres { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.aides-offre { border: 1px solid var(--ahjc-bord); border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.aides-offre.refusee { opacity: .55; }
.aides-offre .gamme { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ahjc-encre-douce); }
.aides-offre .prix { font-size: 17px; font-weight: 700; }
.aides-offre .detail { font-size: 12px; color: var(--ahjc-encre-douce); }
@media (max-width: 560px) { .aides-offres { grid-template-columns: 1fr; } }
`;

export function Aides(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  situation: SituationClient;
  onSituation: (patch: Partial<SituationClient>) => void;
}) {
  const t = useT();
  const { situation } = props;

  // LA TRANCHE DÉCIDE DE TOUT, et sans elle il n'y a pas de montant. Tant
  // qu'elle n'est pas répondue, on ne calcule rien : afficher une fourchette
  // « à partir de » supposerait une tranche, c'est-à-dire exactement la
  // demi-promesse qu'on refuse.
  const contexte = useMemo(
    () => ({
      tranche: situation.tranche ?? ('modestes' as const),
      logementDePlusDe15Ans: situation.logementDePlusDe15Ans,
      remplaceSimpleVitrage: situation.remplaceSimpleVitrage,
      artisanRge: situation.artisanRge,
    }),
    [situation],
  );
  const rapport = useMemo(
    () =>
      situation.tranche === undefined
        ? null
        : computeAides(props.config, contexte, undefined, props.catalogue),
    [situation.tranche, contexte, props.config, props.catalogue],
  );
  const comparatif = useMemo(
    () =>
      situation.tranche === undefined
        ? null
        : computeComparatif(props.config, contexte, undefined, props.catalogue),
    [situation.tranche, contexte, props.config, props.catalogue],
  );

  /** Une question à trois états : oui, non, et « je ne sais pas ». */
  const question = (
    legende: string,
    champ: 'logementDePlusDe15Ans' | 'remplaceSimpleVitrage' | 'artisanRge',
  ) => (
    <fieldset>
      <legend>{t(legende)}</legend>
      {(
        [
          [true, aTraduire('Oui')],
          [false, aTraduire('Non')],
          [undefined, aTraduire('Je ne sais pas')],
        ] as const
      ).map(([valeur, label]) => (
        <label key={String(valeur)} className="bascule">
          <input
            type="radio"
            name={`ahjc-${champ}`}
            data-test={`${champ}-${String(valeur)}`}
            checked={situation[champ] === valeur}
            onChange={() => props.onSituation({ [champ]: valeur })}
          />
          {t(label)}
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="aides-panneau" data-test="aides">
      <style>{FEUILLE_AIDES}</style>

      <div className="aides-questions">
        <fieldset>
          <legend>{t('Vos revenus, au sens de l’Anah')}</legend>
          {TRANCHES.map((tranche) => (
            <label key={tranche.id} className="bascule">
              <input
                type="radio"
                name="ahjc-tranche"
                data-test={`tranche-${tranche.id}`}
                checked={situation.tranche === tranche.id}
                onChange={() => props.onSituation({ tranche: tranche.id })}
              />
              {t(tranche.label)}
            </label>
          ))}
        </fieldset>
        {question(aTraduire('Le logement a-t-il plus de quinze ans ?'), 'logementDePlusDe15Ans')}
        {question(
          aTraduire('Remplacez-vous du simple vitrage ?'),
          'remplaceSimpleVitrage',
        )}
        {question(aTraduire('L’artisan est-il certifié RGE ?'), 'artisanRge')}
      </div>

      {rapport === null ? (
        <p className="a-venir" data-test="aides-sans-tranche">
          {t(
            'Sans votre tranche de revenus, aucun montant ne peut s’afficher. Une fourchette « à partir de » supposerait une tranche — et c’est l’Anah qui décide, pas ce configurateur.',
          )}
        </p>
      ) : (
        <section>
          <h3>{t('Ce que cette menuiserie peut ouvrir')}</h3>
          {/* LA PHRASE VIENT DU CŒUR, mot pour mot : « peut ouvrir droit
              à », jamais « vous toucherez ». La règle de formulation tient
              en UN endroit vérifiable par un test, pas dans un JSX. */}
          <p className="aides-phrase" data-test="phrase-aides">
            {rapport.phrase}
          </p>
          <ul className="aides-lignes" data-test="lignes-aides">
            {rapport.lignes.map((ligne) => (
              <li key={ligne.dispositif} className={ligne.ouvert ? undefined : 'ferme'}>
                <strong>{ligne.dispositif}</strong>
                {ligne.ouvert
                  ? ` — ${
                      ligne.minEuros === ligne.maxEuros
                        ? `${ligne.minEuros} €`
                        : `${ligne.minEuros} à ${ligne.maxEuros} €`
                    }`
                  : ''}
                <span className="aides-motif">{ligne.motif}</span>
              </li>
            ))}
          </ul>
          {rapport.ecrete ? (
            <p className="aide">
              {t('Le cumul est écrêté : au-delà d’un plafond, l’aide ne suit plus la dépense.')}
            </p>
          ) : null}
          {/* UNE VALEUR AFFICHÉE CITE SA SOURCE ET SA DATE, ou elle ne
              s'affiche pas. C'est la cinquième règle du projet. */}
          <p className="aides-source" data-test="date-bareme">
            {t('Barème du {date} (version {version}) · TVA {tva} %', {
              date: rapport.dateBareme,
              version: rapport.versionBareme,
              // LE TAUX EST UNE FRACTION — 0,055 et non 55. Le premier jet
              // divisait par dix et affichait « TVA 0,0055 % » : un chiffre
              // faux d'un facteur mille, lisible, et que personne n'aurait
              // relu deux fois.
              tva: (rapport.tauxTva * 100).toFixed(1).replace('.', ','),
            })}
          </p>
        </section>
      )}

      {comparatif === null ? null : (
        <section>
          <h3>{t('Trois gammes, sur VOTRE ouverture')}</h3>
          {/* On ne change QUE ce qui distingue une gamme : le profilé et le
              vitrage. Les cotes, la famille, l'ouverture et la couleur
              restent celles du client — c'est SA fenêtre en trois versions,
              pas trois fenêtres. */}
          <div className="aides-offres" data-test="comparatif">
            {comparatif.offres.map((offre) => (
              <div
                key={offre.gamme}
                className={`aides-offre${offre.refus.length > 0 ? ' refusee' : ''}`}
                data-test={`offre-${offre.gamme}`}
              >
                <span className="gamme">{t(offre.gamme)}</span>
                <span className="prix">{euros(offre.prixCents)}</span>
                {offre.uw === null ? null : (
                  <span className="detail">
                    {t('Uw')} {offre.uw.toFixed(2).replace('.', ',')}
                    {offre.rwDb === null ? '' : ` · ${offre.rwDb} ${t('dB')}`}
                  </span>
                )}
                {offre.aides.cumulMaxEuros > 0 ? (
                  <span className="detail">
                    {t('aides jusqu’à {montant} €', { montant: String(offre.aides.cumulMaxEuros) })}
                  </span>
                ) : null}
                {offre.economieAnnuelleEuros === null ? null : (
                  <span className="detail">
                    {t('≈ {euros} € de chauffage par an', {
                      euros: String(offre.economieAnnuelleEuros),
                    })}
                  </span>
                )}
                {/* UNE OFFRE QUI NE SE FABRIQUE PAS EST MONTRÉE QUAND MÊME,
                    avec son refus : la faire disparaître laisserait croire
                    qu'elle n'existe pas, alors qu'elle demande autre chose. */}
                {offre.refus.map((refus) => (
                  <span key={refus} className="detail">
                    {refus}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {/* JAMAIS UN CHIFFRE NU : les hypothèses du calcul d'économie
              s'affichent avec lui, et elles sont donc corrigeables. */}
          <p className="aides-source" data-test="hypotheses">
            {comparatif.offres[0]?.hypotheses.join(' · ')}
          </p>
        </section>
      )}
    </div>
  );
}
