/**
 * Pourquoi ce fichier existe : tout ce qui se passe APRÈS la signature, et
 * que le devis ne dit jamais. Le financement, les garanties, l'entretien.
 *
 * IL POSE LA QUESTION QUE PERSONNE NE POSE : qui pose ? Elle décide de la
 * moitié du panneau. Posée par un professionnel, la vente est un marché de
 * TRAVAUX et les garanties de construction s'ouvrent à la réception ; livrée
 * seule, c'est une VENTE, et il n'en reste que deux ans sur le bien. Le
 * badge « 10 ans » que tout le marché affiche est faux dans le second cas,
 * et le voir basculer d'un clic vaut mieux qu'un paragraphe.
 *
 * ELLE N'ENTRE PAS DANS LA CONFIGURATION, et c'est délibéré : ce
 * configurateur ne facture pas la pose, le prix n'en dépend pas, et lui
 * inventer un champ de configuration aurait fait un réglage de plus à tenir
 * d'accord avec le devis. C'est une question d'AFFICHAGE, posée là où la
 * réponse change quelque chose.
 *
 * IL EST À LA DEMANDE, comme le relevé : la plupart des visiteurs comparent
 * des prix. Celui qui ouvre « après la signature » a déjà décidé d'acheter —
 * et son code, son barème et ses trois modules ne pèsent rien pour les
 * autres.
 *
 * CE QU'IL NE DÉCIDE PAS : rien. Les durées, les articles, les refus, la
 * mention légale, le TAEG — tout vient de `garanties.ts`, `financement.ts`
 * et `sav.ts`. Cet écran collecte et montre.
 */

import { useMemo } from 'react';
import type { JoineryConfiguration, PricingCatalog } from '@ahjc/core';
// Par leur CHEMIN et non par l'index : trois modules qui n'intéressent que
// l'acheteur décidé, et un export de confort les ramènerait dans le
// chargement initial de tout le monde.
import {
  computeGaranties,
  phraseDeGarantie,
  type EngagementsDuVendeur,
  type GarantieCommerciale,
  type ModeDeFourniture,
} from '@ahjc/core/src/garanties.ts';
import {
  BAREME_FINANCEMENT_2026,
  MENTION_LEGALE,
  MENTION_RETRACTATION,
  computeFinancement,
  ecoPret,
  type OffreDeCredit,
} from '@ahjc/core/src/financement.ts';
import { computeFicheSav } from '@ahjc/core/src/sav.ts';
import { euros, type SituationClient } from '../etat.ts';
import { useT, aTraduire } from '../i18n.ts';

/** Combien d'années, dit en français, à partir d'un nombre de mois. */
function annees(mois: number): string {
  const an = Math.round(mois / 12);
  return an >= 1 ? `${an} an${an > 1 ? 's' : ''}` : `${mois} mois`;
}

/** Le pourcentage d'un taux en millièmes — 59 → « 5,90 % ». */
function taux(milliemes: number): string {
  return `${(milliemes / 10).toFixed(2).replace('.', ',')} %`;
}

/**
 * SA PEAU VOYAGE AVEC LUI. Elle est rendue comme un nœud React et atterrit
 * dans la racine fantôme parce que c'est là que l'arbre vit — le même geste
 * que `styles-vues.ts`, un étage plus bas. Mise dans la feuille principale,
 * elle se paierait à chaque visite, y compris par qui n'ouvre jamais ce
 * panneau : c'est-à-dire presque tout le monde.
 *
 * Aucun accent grave dans cette chaîne : elle vit dans un gabarit, et le
 * premier qui s'y glisse casse la construction sans un mot.
 */
const FEUILLE_APRES_VENTE = `
.apres-vente { border-top: 1px solid var(--ahjc-bord); padding: 14px 16px 20px; display: flex; flex-direction: column; gap: 18px; }
.apres-vente h3 { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--ahjc-encre-douce); margin: 0 0 8px; }
.apres-vente section { display: flex; flex-direction: column; }
.apres-mode { border: 1px solid var(--ahjc-bord); border-radius: 6px; padding: 8px 12px 10px; margin: 0 0 12px; display: flex; flex-wrap: wrap; gap: 4px 18px; }
.apres-mode legend { font-size: 12px; color: var(--ahjc-encre-douce); padding: 0 4px; }
.apres-phrase { font-size: 14px; font-weight: 600; margin: 0 0 10px; }
.apres-liste { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.apres-liste li { font-size: 13px; line-height: 1.5; }
.apres-liste--exclusions li { color: var(--ahjc-encre-douce); border-left: 2px solid var(--ahjc-bord); padding-left: 10px; }
.apres-fondement, .apres-couvre, .apres-symptome { display: block; font-size: 12px; color: var(--ahjc-encre-douce); margin-top: 2px; }
.apres-symptome { font-style: italic; }
.apres-mention { font-size: 12px; font-weight: 600; margin: 10px 0 0; padding: 8px 10px; border: 1px solid var(--ahjc-bord); border-radius: 4px; }
`;

const MODES: Array<{ id: ModeDeFourniture; label: string }> = [
  { id: 'pose-par-le-pro', label: aTraduire('Posé par un professionnel') },
  { id: 'fourniture-seule', label: aTraduire('Fourniture seule — je pose') },
];

export function ApresVente(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  totalCents: number;
  /**
   * L'OFFRE DE CRÉDIT DU MARCHAND. Absente, aucune mensualité ne s'affiche —
   * et c'est la bonne réponse : ce widget ne connaît pas le partenaire
   * financier du marchand, et « à partir de 49 €/mois » sans taux ni durée
   * est une publicité que le Code de la consommation interdit.
   */
  offre?: OffreDeCredit & {
    /** Les seuils d'usure du trimestre, déclarés par le marchand. */
    usure?: Array<{ jusquACents: number; tauxMilliemes: number }>;
  };
  /**
   * CE QUE LA MARQUE ACCORDE en plus du droit, et la durée de disponibilité
   * des pièces détachées. Absents, l'écran n'invente rien et DIT que
   * l'obligation d'information n'est pas remplie.
   */
  engagements?: { commerciales?: GarantieCommerciale[]; piecesDetacheesMois?: number };
  /**
   * CE QUE LE CLIENT A DÉCLARÉ DE SA SITUATION, et qui vit dans l'état.
   *
   * Deux réponses sont partagées avec l'écran des aides : QUI POSE et LE
   * SIMPLE VITRAGE. La seconde décide de MaPrimeRénov' d'un côté et de
   * l'éco-PTZ de l'autre — et elle vivait ici dans un `useState` local, ce
   * qui laissait un même écran répondre « oui » aux aides et « non » au
   * prêt, avec deux droits contradictoires affichés en même temps.
   */
  situation: SituationClient;
  onSituation: (patch: Partial<SituationClient>) => void;
}) {
  const t = useT();
  const mode: ModeDeFourniture =
    props.situation.poseParLePro === false ? 'fourniture-seule' : 'pose-par-le-pro';
  const setMode = (choix: ModeDeFourniture) =>
    props.onSituation({ poseParLePro: choix === 'pose-par-le-pro' });
  // LE SIMPLE VITRAGE : la question propre à l'éco-PTZ, et la plus souvent
  // ratée. Trois états, pas deux — « on ne sait pas » n'est pas « non ».
  const simpleVitrage: 'oui' | 'non' | 'inconnu' =
    props.situation.remplaceSimpleVitrage === undefined
      ? 'inconnu'
      : props.situation.remplaceSimpleVitrage
        ? 'oui'
        : 'non';
  const setSimpleVitrage = (choix: 'oui' | 'non' | 'inconnu') =>
    props.onSituation({
      remplaceSimpleVitrage: choix === 'inconnu' ? undefined : choix === 'oui',
    });

  // `commerciales` est FACULTATIF côté hôte et REQUIS côté cœur, et c'est
  // volontaire des deux côtés : un marchand qui n'en déclare aucune écrit
  // simplement `garanties: { piecesDetacheesMois: 120 }`, pendant que le
  // module, lui, veut une liste — fût-elle vide — pour n'avoir jamais à
  // distinguer « aucune » de « pas renseigné ».
  const engagements: EngagementsDuVendeur = useMemo(
    () => ({
      commerciales: props.engagements?.commerciales ?? [],
      ...(props.engagements?.piecesDetacheesMois !== undefined
        ? { piecesDetacheesMois: props.engagements.piecesDetacheesMois }
        : {}),
    }),
    [props.engagements],
  );
  const garanties = useMemo(
    () => computeGaranties(props.config, mode, engagements, props.catalogue),
    [props.config, mode, engagements, props.catalogue],
  );
  const fiche = useMemo(
    () => computeFicheSav(props.config, props.catalogue),
    [props.config, props.catalogue],
  );
  const eco = useMemo(
    () =>
      ecoPret(
        props.config,
        simpleVitrage === 'inconnu' ? {} : { remplaceDuSimpleVitrage: simpleVitrage === 'oui' },
        props.catalogue,
      ),
    [props.config, simpleVitrage, props.catalogue],
  );
  const credit = useMemo(
    () =>
      props.offre
        ? computeFinancement(props.totalCents, props.offre, {
            ...BAREME_FINANCEMENT_2026,
            // LES SEUILS DU TRIMESTRE, quand le marchand les a déclarés.
            // Sans eux le module ne valide rien et le dit : il ne suppose
            // jamais qu'une offre est légale.
            usure: props.offre.usure ?? BAREME_FINANCEMENT_2026.usure,
          })
        : null,
    [props.offre, props.totalCents],
  );

  return (
    <div className="apres-vente" data-test="apres-vente">
      <style>{FEUILLE_APRES_VENTE}</style>
      {/* --- QUI POSE. La question qui décide de la moitié du panneau. */}
      <fieldset className="apres-mode">
        <legend>{t('Qui pose ?')}</legend>
        {MODES.map((choix) => (
          <label key={choix.id} className="bascule">
            <input
              type="radio"
              name="ahjc-mode-fourniture"
              data-test={`mode-${choix.id}`}
              checked={mode === choix.id}
              onChange={() => setMode(choix.id)}
            />
            {t(choix.label)}
          </label>
        ))}
      </fieldset>

      {/* --- LES GARANTIES. */}
      <section>
        <h3>{t('Les garanties')}</h3>
        <p className="apres-phrase" data-test="phrase-garantie">
          {phraseDeGarantie(garanties)}
        </p>
        <ul className="apres-liste" data-test="liste-garanties">
          {garanties.garanties.map((garantie) => (
            <li key={garantie.code}>
              <strong>{t(garantie.label)}</strong> — {annees(garantie.dureeMois)}{' '}
              {garantie.depart === 'reception'
                ? t('à compter de la réception des travaux')
                : t('à compter de la livraison')}
              <span className="apres-fondement">{garantie.fondement}</span>
              <span className="apres-couvre">{garantie.couvre}</span>
            </li>
          ))}
        </ul>
        {/* CE QUI N'EST PAS COUVERT — la moitié utile du rapport, et celle
            qu'aucun devis n'imprime. */}
        <ul className="apres-liste apres-liste--exclusions" data-test="exclusions-garantie">
          {garanties.exclusions.map((exclusion) => (
            <li key={exclusion.slice(0, 40)}>{exclusion}</li>
          ))}
        </ul>
        {garanties.rappels.map((rappel) => (
          <p key={rappel.slice(0, 40)} className="aide">
            {rappel}
          </p>
        ))}
      </section>

      {/* --- LE FINANCEMENT. */}
      <section>
        <h3>{t('Le financement')}</h3>
        {credit === null ? (
          <p className="a-venir" data-test="pas-d-offre">
            {t(
              'Aucune offre de crédit n’est déclarée par ce marchand. Une mensualité sans taux, sans durée et sans coût total est une publicité interdite — elle ne s’affiche donc pas.',
            )}
          </p>
        ) : 'code' in credit ? (
          <p className="a-venir" data-test="refus-credit">
            {credit.message}
          </p>
        ) : (
          <div data-test="exemple-representatif">
            <p className="apres-phrase">
              {t('{mensualite} par mois pendant {duree} mois', {
                mensualite: euros(credit.mensualiteTotaleCents),
                duree: String(credit.dureeMois),
              })}
            </p>
            <ul className="apres-liste">
              <li>
                {t('Montant emprunté')} : <strong>{euros(credit.capitalEmprunteCents)}</strong>
              </li>
              <li>
                {t('Taux débiteur fixe')} : {taux(credit.tauxDebiteurMilliemes)} · {t('TAEG')}{' '}
                <strong>{taux(credit.taegMilliemes)}</strong>
              </li>
              <li>
                {t('Coût total du crédit')} : <strong>{euros(credit.coutDuCreditCents)}</strong> ·{' '}
                {t('montant total dû')} {euros(credit.montantTotalDuCents)}
              </li>
            </ul>
            {credit.avertissements.map((avertissement) => (
              <p key={avertissement.slice(0, 40)} className="aide">
                {avertissement}
              </p>
            ))}
            {/* LE DROIT DE REVENIR EN ARRIÈRE, avant la mention.
                Il était calculé par le cœur et affiché nulle part : le
                bloc portait le taux, le coût total et la mention légale,
                et taisait le seul droit qui permette au client de défaire
                sa signature. Il court à la SIGNATURE DE L'OFFRE, pas à la
                livraison — et c'est ce qui trompe le plus. */}
            {/* LE DROIT DE REVENIR EN ARRIÈRE, avant la mention. Il était
                calculé par le cœur et affiché nulle part : le bloc portait
                le taux, le coût total et la mention légale, et taisait le
                seul droit qui permette au client de défaire sa signature.
                Comme la mention, il ne passe pas par le dictionnaire. */}
            <p className="apres-mention" data-test="retractation-credit">
              {MENTION_RETRACTATION}
            </p>
            {/* LA MENTION, mot pour mot et jamais reformulée. */}
            <p className="apres-mention" data-test="mention-credit">
              {MENTION_LEGALE}
            </p>
          </div>
        )}

        {/* L'ÉCO-PTZ, et sa question à trois états. */}
        <fieldset className="apres-mode">
          <legend>{t('Les fenêtres remplacées sont-elles en simple vitrage ?')}</legend>
          {(
            [
              ['oui', aTraduire('Oui')],
              ['non', aTraduire('Non, déjà du double')],
              ['inconnu', aTraduire('Je ne sais pas')],
            ] as const
          ).map(([valeur, label]) => (
            <label key={valeur} className="bascule">
              <input
                type="radio"
                name="ahjc-simple-vitrage"
                data-test={`simple-vitrage-${valeur}`}
                checked={simpleVitrage === valeur}
                onChange={() => setSimpleVitrage(valeur)}
              />
              {t(label)}
            </label>
          ))}
        </fieldset>
        <p className={eco.ouvert ? 'apres-phrase' : 'aide'} data-test="eco-ptz">
          {eco.phrase}
        </p>
        {eco.conditionsNonVerifiees.length > 0 ? (
          <ul className="apres-liste apres-liste--exclusions">
            {eco.conditionsNonVerifiees.map((condition) => (
              <li key={condition.slice(0, 40)}>{condition}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* --- L'ENTRETIEN ET LE SAV. */}
      <section>
        <h3>{t('L’entretien, et ce qui s’use')}</h3>
        {fiche.pieces.length === 0 ? (
          <p className="aide">{t('Aucune pièce d’usure sur cet ouvrage.')}</p>
        ) : (
          <>
            <p className="apres-phrase">
              {t('À contrôler tous les {mois} mois.', { mois: String(fiche.rythmeMois) })}
            </p>
            <ul className="apres-liste" data-test="pieces-usure">
              {fiche.pieces.map((piece) => (
                <li key={piece.code}>
                  <strong>{t(piece.label)}</strong>
                  <span className="apres-fondement">{piece.ou}</span>
                  <span className="apres-couvre">{piece.geste}</span>
                  <span className="apres-symptome">{piece.symptome}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <h3>{t('Ce qui abîme')}</h3>
        <ul className="apres-liste apres-liste--exclusions">
          {fiche.aNePasFaire.map((geste) => (
            <li key={geste.slice(0, 40)}>{geste}</li>
          ))}
        </ul>
        <h3>{t('À conserver pour recommander une pièce')}</h3>
        <ul className="apres-liste" data-test="a-conserver">
          {fiche.aConserver.map((donnee) => (
            <li key={donnee.slice(0, 40)}>{donnee}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
