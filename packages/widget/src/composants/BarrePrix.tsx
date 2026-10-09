/**
 * Pourquoi ce fichier existe : la barre de prix est le SEUL élément vraiment
 * permanent du configurateur (docs/08 §1) — le prix s'affiche dès la première
 * seconde et ne se cache jamais (docs/00 §8, décision 6). Son tiroir déplie
 * la décomposition ligne à ligne, suppléments imposés compris, avec leur
 * explication.
 *
 * Solution écartée : un total seul, « détail au devis ». Le prix opaque est
 * précisément ce que le marché fait déjà et que ce produit refuse : le client
 * doit voir CE QUI COÛTE pour arbitrer.
 *
 * Incident fondateur : l'ajout au panier est REFUSÉ tant qu'une règle de
 * fabricabilité est violée — et le bouton dit pourquoi au lieu de disparaître.
 * La commande, elle, sera de toute façon recalculée côté serveur (phase 4) :
 * ce montant est un affichage, jamais une écriture.
 */

import type { CritereAides, EtatDesCotes, PriceResult, ValidationIssue } from '@ahjc/core';
import { euros } from '../etat.ts';
import { useT } from '../i18n.ts';

/** « 20 », « 5,5 » — un taux entier ne traîne pas de décimale inutile. */
function formaterTaux(taux: number): string {
  return Number.isInteger(taux) ? String(taux) : String(taux).replace('.', ',');
}

export function BarrePrix(props: {
  prix: PriceResult;
  erreurs: ValidationIssue[];
  detailOuvert: boolean;
  peutAjouter: boolean;
  /** Le taux de TVA du marchand, en millièmes — voir le commentaire ci-dessous. */
  tvaMilliemes?: number;
  /**
   * Le CRITÈRE TECHNIQUE des aides — un fait sur le produit, vérifiable
   * sans rien demander au client. Le MONTANT, lui, dépend de réponses
   * qu'on n'a pas encore : il ne s'affiche pas ici.
   */
  critereAides?: CritereAides | null;
  /** L'état des cotes — il commande l'apparition du dossier de fabrication. */
  etatDesCotes: EtatDesCotes;
  onDetail: () => void;
  onAjouter: () => void;
  onDevis: () => void;
}) {
  const t = useT();
  const bloquant = props.erreurs.length > 0;
  // LE TAUX VIENT DU MARCHAND. Cette ligne annonçait « TVA 20 % » en dur
  // pendant que le devis PDF, lui, imprimait le taux du contexte : un
  // marchand en travaux de rénovation (5,5 %) voyait deux chiffres
  // différents sur le même écran et le même document. La règle de
  // docs/04 §5 est pourtant explicite — la TVA est un réglage de boutique,
  // jamais un codage en dur.
  const taux = (props.tvaMilliemes ?? 200) / 10;
  const chiffre = props.prix.lines.length > 0;
  return (
    <div className="barre-prix" data-test="barre-prix">
      <div>
        {/* Le prix change à chaque geste : il s'ANNONCE. Sans cela, un
            utilisateur au lecteur d'écran choisit un vitrage et n'apprend
            jamais ce qu'il vient de coûter. `polite` attend une pause —
            `assertive` couperait la lecture de l'option choisie. */}
        <div
          className="montant"
          data-test="prix-total"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {chiffre ? euros(props.prix.displayTotalCents) : t('Prix à établir')}
        </div>
        {/* LA MENTION DE TVA SUIT LE MONTANT, ET ELLE DISPARAÎT AVEC LUI : un
            taux de TVA sous « prix à établir » annoncerait un régime fiscal
            pour un montant qui n'existe pas.

            ELLE N'EST REMPLACÉE PAR RIEN, et c'est une coupe assumée. Une
            première rédaction mettait ici « le bordereau de cet ouvrage n'est
            pas encore chiffré » — ce que la remarque de la famille dit déjà, en
            entier, deux blocs plus bas. Un message montré deux fois est un
            message qu'on cesse de lire (lots MT1c et MT1d), et celui-ci coûtait
            de surcroît des octets au chargement initial de tout visiteur venu
            configurer une fenêtre. */}
        {chiffre ? (
          <div className="tva">
            {t('TTC, TVA {taux} % — pose non comprise', { taux: formaterTaux(taux) })}
          </div>
        ) : null}
        {/* CE QUE LA CONFIGURATION PEUT OUVRIR, sous le prix et pas ailleurs :
            c'est là qu'un client arbitre. La phrase vient du cœur
            (`aides.ts`) et jamais d'ici — la règle de formulation
            (« peut ouvrir droit à », jamais « vous toucherez ») doit tenir
            en UN endroit vérifiable par un test, pas dans un JSX. */}
        {props.critereAides ? (
          <div className="aides" data-test="critere-aides">
            {props.critereAides.tenu
              ? t('Critères techniques des aides tenus (barème {date})', {
                  date: props.critereAides.date,
                })
              : t('Aides : {manque}', { manque: props.critereAides.manques.join(' et ') })}
          </div>
        ) : null}
      </div>

      <div>
        <button type="button" className="lien-detail" aria-expanded={props.detailOuvert} onClick={props.onDetail}>
          {props.detailOuvert ? t('Masquer le détail') : t('Détail du prix')}
        </button>
        {props.detailOuvert ? (
          <ul className="lignes" data-test="detail-prix">
            {props.prix.lines.map((ligne, index) => (
              <li key={`${ligne.code}-${index}`} className={ligne.type === 'supplement' ? 'supplement' : undefined}>
                <span>{t(ligne.label)}</span>
                <span>
                  {ligne.type === 'base' ? '' : ligne.amountCents >= 0 ? '+' : '−'}
                  {euros(Math.abs(ligne.amountCents))}
                </span>
              </li>
            ))}
            <li className="total">
              <span>{t('Total')}</span>
              <span>{chiffre ? euros(props.prix.displayTotalCents) : t('Prix à établir')}</span>
            </li>
          </ul>
        ) : null}
      </div>

      <div className="actions">
        <button type="button" className="bouton" data-test="devis-pdf" onClick={props.onDevis}>
          {t('Devis PDF')}
        </button>
        <button
          type="button"
          className="bouton bouton--primaire"
          data-test="ajouter-panier"
          disabled={bloquant || !props.peutAjouter}
          title={
            bloquant
              ? t('À corriger d’abord : {refus}', { refus: props.erreurs[0].message })
              : props.peutAjouter
                ? undefined
                : t('Le panier n’est pas disponible sur cette page')
          }
          onClick={props.onAjouter}
        >
          {bloquant ? t('Configuration à corriger') : t('Ajouter au panier')}
        </button>
      </div>
    </div>
  );
}
