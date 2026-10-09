/**
 * Pourquoi ce fichier existe : « un chantier compte rarement une seule
 * fenêtre » (docs/02 §5) — le panier porte des lignes de configurations
 * DISTINCTES, chacune avec sa vignette, son prix et sa quantité.
 *
 * Solution écartée : mémoriser le prix de chaque ligne à l'ajout. Un tarif
 * qui change, une remise quantité qui bascule, et le panier afficherait un
 * montant périmé. Chaque ligne est RECALCULÉE à chaque rendu depuis sa
 * configuration — c'est le même réflexe que pour la configuration courante.
 *
 * Incident fondateur : la vignette du panier sort du MÊME dessin que le
 * viewport et que le devis (docs/08, règle 7) — sans cotes, à la même
 * élévation. Une vignette « décorative » qui ne montrerait pas le produit
 * commandé serait un mensonge tranquille.
 */

import {
  computeElevation,
  computePrice,
  computeProjet,
  elevationToSvg,
  harmoniser,
  type PricingCatalog,
} from '@ahjc/core';
import { euros, totalLigneCents, totalPanierCents, type LignePanier } from '../etat.ts';
import { formater, type Unite } from '../unites.ts';
import { useT } from '../i18n.ts';

export function Panier(props: {
  lignes: LignePanier[];
  catalogue: PricingCatalog;
  /** L'unité des cotes affichées — le titre de la ligne et le titre de la vignette. */
  unite: Unite;
  onQuantite: (cle: string, quantite: number) => void;
  onRetirer: (cle: string) => void;
  /**
   * Applique une teinte à tout le chantier — le geste du PROJET.
   *
   * IL REND LES LIGNES FAITES, et non la teinte. `harmoniser()` vit dans le
   * même module du cœur que `computeProjet` et ses remarques : l'appeler
   * depuis le réducteur mettait toute cette prose dans le chargement
   * initial de tout le monde, pour un panneau que seul un client à
   * plusieurs menuiseries ouvre. Ce composant, lui, est paresseux et a déjà
   * le module en main.
   */
  onHarmoniser: (lignes: LignePanier[]) => void;
}) {
  const t = useT();
  const cote = (valeurMm: number) => formater(valeurMm, props.unite);
  // LE PROJET. Le panier savait empiler des lignes ; il ne savait pas
  // qu'elles forment un ensemble — un métré consolidé, une teinte commune,
  // et un seul devis.
  const projet = computeProjet(props.lignes, props.catalogue);
  return (
    <section className="panier" aria-label={t('Panier du chantier')} data-test="panier">
      <h3>{t('Le chantier ({n})', { n: props.lignes.length })}</h3>
      {/* Ce composant n'est monté QU'AVEC des lignes — l'état vide vit dans
          le Configurateur, hors du morceau paresseux. */}
      <>
          <ul>
            {props.lignes.map((ligne) => {
              const config = { ...ligne.config, quantite: ligne.quantite };
              const prix = computePrice(config, props.catalogue);
              const vignette = elevationToSvg(computeElevation(config, props.catalogue), {
                cotes: false,
                unite: props.unite,
                titre: `${t(props.catalogue.familles[config.famille].label)} ${cote(config.widthMm)} × ${cote(config.heightMm)}`,
              });
              return (
                <li key={ligne.cle} data-test="ligne-panier">
                  <div className="vignette" dangerouslySetInnerHTML={{ __html: vignette }} />
                  <div>
                    <div className="titre">
                      {/* LE REPÈRE DU PLAN passe devant le nom du produit
                          quand il y en a un. Sur un lot importé d'un
                          bordereau, c'est par lui que le lecteur retrouve sa
                          ligne : « B12 » est écrit sur ses plans, « Fenêtre
                          1200 × 1350 » l'est vingt fois. */}
                      {ligne.repere ? <strong data-test="repere-ligne">{ligne.repere} · </strong> : null}
                      {t(props.catalogue.familles[config.famille].label)} {cote(config.widthMm)} × {cote(config.heightMm)}
                    </div>
                    <div className="titre" style={{ color: 'var(--ahjc-encre-douce)' }}>
                      {ligne.piece ? `${ligne.piece} · ` : ''}
                      {config.materiau} · {config.couleur}
                      {config.vitrage ? ` · ${config.vitrage.base}` : ''}
                    </div>
                  </div>
                  <label className="champ" htmlFor={`ahjc-qte-${ligne.cle}`} style={{ margin: 0 }}>
                    {t('Qté')}
                  </label>
                  <input
                    id={`ahjc-qte-${ligne.cle}`}
                    type="number"
                    min={1}
                    value={ligne.quantite}
                    onChange={(evenement) =>
                      props.onQuantite(ligne.cle, Number((evenement.target as HTMLInputElement).value))
                    }
                  />
                  {/* Le total de la LIGNE — unitaire × quantité. Afficher le
                      prix unitaire à côté d'une quantité de quatre était le
                      bug le plus ancien du panier. */}
                  <span
                    className="prix-ligne"
                    title={t('{prix} l’unité', { prix: euros(prix.displayTotalCents) })}
                  >
                    {euros(totalLigneCents(ligne, props.catalogue))}
                  </span>
                  <button type="button" className="retirer" onClick={() => props.onRetirer(ligne.cle)}>
                    {t('Retirer')}
                  </button>
                </li>
              );
            })}
          </ul>
          {/* LE MÉTRÉ CONSOLIDÉ — ce que le dépôt prépare pour tout le
              chantier, et non ligne par ligne. C'est la question que se
              pose le poseur en arrivant : combien de poteaux, combien de
              béton. */}
          {projet.metre ? (
            <div className="metre-projet" data-test="metre-projet">
              <strong>{t('Métré du chantier')}</strong>{' '}
              {t('{metres} m développés · {poteaux} poteaux', {
                metres: Math.round(projet.metre.longueurMm / 100) / 10,
                poteaux: projet.metre.poteaux,
              })}
              {projet.metre.poteauxAngle > 0
                ? t(' dont {n} d’angle', { n: projet.metre.poteauxAngle })
                : ''}{' '}
              {t('· {panneaux} panneaux · {litres} L de béton', {
                panneaux: projet.metre.panneaux,
                litres: projet.metre.betonLitres,
              })}
            </div>
          ) : null}

          {projet.remarques.map((remarque) => (
            <div
              key={remarque.code}
              className={`note note--${remarque.severite}`}
              data-code={remarque.code}
            >
              <p>{remarque.message}</p>
              {remarque.alternative?.patch.couleur ? (
                <button
                  type="button"
                  onClick={() =>
                    props.onHarmoniser(
                      // Les lignes FAITES : `harmoniser()` rend des
                      // configurations, et la clé de chaque ligne doit
                      // survivre — c'est par elle que l'hôte la retrouve.
                      harmoniser(props.lignes, {
                        couleur: remarque.alternative!.patch.couleur as never,
                      }, props.catalogue).map((ligne, index) => ({
                        ...props.lignes[index],
                        config: ligne.config,
                      })),
                    )
                  }
                >
                  {t(remarque.alternative.label)}
                </button>
              ) : null}
            </div>
          ))}

          <div className="total-panier">
            <span>{t('Total du chantier')}</span>
            <span data-test="total-panier">{euros(totalPanierCents(props.lignes, props.catalogue))}</span>
          </div>
      </>
    </section>
  );
}
