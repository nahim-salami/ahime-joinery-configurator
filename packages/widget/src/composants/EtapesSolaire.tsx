
import type { JoineryConfiguration, PricingCatalog } from '@ahjc/core';
import {
  BORNES_BSO,
  LA_NORME_S_ARRETE_A,
  MODELES_BSO,
  classeDeVent,
  linteauNecessaireMm,
  vitesseDeClasseKmh,
  type ModeleBso,
} from '@ahjc/core/src/familles/solaire/bso.ts';
import {
  CLASSE_PAR_GUIDAGE,
  TOILES_SCREEN,
  guidageDe,
  laizeUtileMaxMm,
  nombreDeLes,
  pressionDeClassePa,
  surfaceMaxEcrite,
  type ToileScreen,
} from '@ahjc/core/src/familles/solaire/screen-zip.ts';
import { aTraduire, useT } from '../i18n.ts';
import { Etape, Tuile, delta, libelleDelta } from './briques.tsx';
import type { ReactNode } from 'react';
import { rangerSousLEcran } from './Notes.tsx';
// LA TEINTE DE LA TOILE — lot O9b, déclarée à la RACINE du cœur : cet écran
// est partagé par le BSO et le screen zip, et un module de groupe y ferait
// descendre ce groupe chez tous ses visiteurs (lot MT5).
import { nomDeLaToile, TEINTES_DE_TOILE } from '@ahjc/core/src/toiles-de-store.ts';

/**
 * CE QUE CET ÉCRAN MONTRE, ET QUE LE PANNEAU RANGERA SOUS SON ÉTAPE — lot
 * D22. LES PROTECTIONS SOLAIRES : quatorze codes sous deux préfixes (lot S1).
 *
 * Les rangements voyagent avec l'écran qui les montre : ils pesaient 137
 * octets du chargement initial pour tous les visiteurs, et ils ne servent
 * qu'ici. L'appel est au niveau du MODULE — il s'exécute une fois, par le
 * seul fait que ce morceau soit importé (patron du lot Z0).
 */
rangerSousLEcran(4, ['bso-', 'screen-']);

export function EtapesSolaire(props: {
  config: JoineryConfiguration;
  catalogue: PricingCatalog;
  etape: number;
  ouvrir: (etape: number) => void;
  champ: (patch: Partial<JoineryConfiguration>) => void;
  notes: (etape: number) => ReactNode;
}) {
  const t = useT();
  const { catalogue, config, champ, notes, ouvrir } = props;

  if (config.famille === 'bso') {
    const modele: ModeleBso = config.modeleBso ?? 'lamisol-90';
    const retenu = MODELES_BSO.find((candidat) => candidat.id === modele);
    const classe = classeDeVent(modele, config.widthMm);
    const kmh = classe === null ? null : vitesseDeClasseKmh(classe);
    const linteau = linteauNecessaireMm(modele, config.heightMm);
    const declare = config.linteauDisponibleMm;

    return (
      <Etape
        numero={4}
        titre={aTraduire('Lames et réservation')}
        resume={retenu?.nom ?? modele}
        ouverte={props.etape === 4}
        onOuvrir={() => ouvrir(4)}
      >
        <div className="tuiles" role="group" aria-label={t('Modèle de lame')}>
          {MODELES_BSO.map((candidat) => {
            // La classe que CE modèle laisse à la largeur demandée. C'est
            // l'information qui fait choisir, et elle n'est nulle part
            // ailleurs : deux modèles au même prix n'ont pas la même classe.
            const classeDuCandidat = classeDeVent(candidat.id, config.widthMm);
            return (
              <Tuile
                key={candidat.id}
                test={`modele-bso-${candidat.id}`}
                label={candidat.nom}
                note={
                  classeDuCandidat === null
                    ? t('hors domaine à cette largeur')
                    : `classe ${classeDuCandidat} · ${libelleDelta(
                        delta(config, { modeleBso: candidat.id }, catalogue),
                      )}`
                }
                actif={modele === candidat.id}
                raison={candidat.argument}
                onClick={() => champ({ modeleBso: candidat.id })}
              />
            );
          })}
        </div>

        {/* LA CLASSE DE VENT, EN DIRECT. Elle baisse quand la largeur monte,
            et c'est le seul endroit du configurateur où on le VOIT. */}
        <p className="aide" data-test="classe-de-vent-bso">
          {classe === null ? (
            <>
              À {config.widthMm} mm de large, ce modèle n’a <strong>plus de classe</strong> de
              résistance au vent selon EN 13659. Ce n’est pas « non testé » : c’est hors domaine.
            </>
          ) : (
            <>
              À {config.widthMm} mm de large : <strong>classe {classe}</strong> EN 13659
              {kmh === null ? null : <> — capteur à régler vers {String(kmh).replace('.', ',')} km/h</>}
              {classe > LA_NORME_S_ARRETE_A ? (
                <> . Au-delà de {LA_NORME_S_ARRETE_A}, c’est une désignation du gammiste et non une
                  classe de la norme produit.</>
              ) : (
                <>. La classe BAISSE quand la largeur monte — c’est la largeur, pas la qualité.</>
              )}
            </>
          )}
        </p>

        {/* LE LINTEAU. Une cote du BÂTIMENT, comme la retombée de linteau
            d'une porte de garage : elle décide si l'ouvrage se pose, et
            personne ne pense à la mesurer avant d'avoir été refusé. */}
        <div className="bloc">
          <span className="champ">{t('Linteau disponible (mm)')}</span>
          <input
            type="number"
            inputMode="numeric"
            data-test="linteau-bso"
            min={0}
            max={2000}
            step={5}
            value={declare ?? ''}
            placeholder={t('à mesurer')}
            onChange={(evenement) => {
              const valeur = evenement.target.value.trim();
              champ({ linteauDisponibleMm: valeur === '' ? undefined : Number(valeur) });
            }}
          />
          <p className="aide" data-test="linteau-necessaire">
            {linteau === null ? (
              <>Cette hauteur sort de la gamme : la réservation ne se calcule pas.</>
            ) : declare === undefined ? (
              <>
                Ce store demande <strong>{linteau} mm</strong> au-dessus du tableau pour empiler ses
                lames. C’est une cote du mur, pas du produit — tant qu’elle n’est pas mesurée, on ne
                sait pas si le store se pose.
              </>
            ) : declare < linteau ? (
              <>
                Il manque <strong>{linteau - declare} mm</strong> : {linteau} nécessaires,{' '}
                {declare} déclarés.
              </>
            ) : (
              <>
                {linteau} mm nécessaires, {declare} déclarés — le paquet de lames se range.
              </>
            )}
          </p>
        </div>

        <p className="aide">
          Largeur admise de {BORNES_BSO[modele].largeurMinMm} à {BORNES_BSO[modele].largeurMaxMm} mm,
          et <strong>{BORNES_BSO[modele].surfaceMaxM2} m² au plus</strong> — ce plafond de surface
          est séparé des cotes, et il mord bien avant elles.
        </p>
        {notes(4)}
      </Etape>
    );
  }

  const toile: ToileScreen = config.toileScreen ?? 'soltis-92';
  const guidage = guidageDe(config);
  const fiche = TOILES_SCREEN[toile];
  const utile = laizeUtileMaxMm(toile);
  const les = nombreDeLes(toile, config.widthMm);

  return (
    <Etape
      numero={4}
      titre={aTraduire('Toile')}
      resume={fiche.nom}
      ouverte={props.etape === 4}
      onOuvrir={() => ouvrir(4)}
    >
      <div className="tuiles" role="group" aria-label={t('Toile')}>
        {(Object.keys(TOILES_SCREEN) as ToileScreen[]).map((candidat) => (
          <Tuile
            key={candidat}
            test={`toile-screen-${candidat}`}
            label={TOILES_SCREEN[candidat].nom}
            note={`${TOILES_SCREEN[candidat].facteurOuverturePourCent} % d’ouverture · ${TOILES_SCREEN[candidat].masseSurfaciqueGM2} g/m²`}
            actif={toile === candidat}
            raison={TOILES_SCREEN[candidat].argument}
            onClick={() => champ({ toileScreen: candidat })}
          />
        ))}
      </div>

      {/* LE GUIDAGE (lot MT1b) — ce qui retient la toile, donc la classe.
          C'est la tuile qui transforme un screen en STORE VERTICAL, et le
          client doit voir ce qu'il perd : une classe de moins se lit comme
          une nuance, c'est trois fois moins de pression admissible. */}
      <div className="tuiles" role="group" aria-label={t('Guidage de la toile')}>
        {(['zip', 'cables'] as const).map((candidat) => (
          <Tuile
            key={candidat}
            test={`guidage-${candidat}`}
            label={
              candidat === 'zip'
                ? aTraduire('Coulisses zip')
                : aTraduire('Câbles — store vertical')
            }
            note={`${aTraduire('classe de vent')} ${CLASSE_PAR_GUIDAGE[candidat]} · ${pressionDeClassePa(CLASSE_PAR_GUIDAGE[candidat])} Pa · ${surfaceMaxEcrite(candidat)} au plus`}
            actif={guidage === candidat}
            raison={
              candidat === 'zip'
                ? aTraduire(
                    'La bordure soudée court dans une coulisse fermée : la toile ne sort pas, et le store tient la classe la plus haute d’EN 13561.',
                  )
                : aTraduire(
                    'La toile est guidée par des câbles : moins cher, moins encombrant, et trois fois moins de vent admissible.',
                  )
            }
            onClick={() => champ({ guidageDeToile: candidat })}
          />
        ))}
      </div>

      {/* LA COUTURE. Le seul endroit où un client l'apprend avant la pose. */}
      <p className="aide" data-test="lés-de-toile">
        {les === 1 ? (
          <>
            Un seul lé, <strong>aucune couture</strong> : la laize utile va jusqu’à {utile} mm.
          </>
        ) : (
          <>
            {les} lés, donc <strong>{les - 1} couture{les > 2 ? 's' : ''}</strong> — la laize utile
            s’arrête à {utile} mm. Une couture de toile se voit à contre-jour, et un store de fenêtre
            est toujours à contre-jour.
          </>
        )}
      </p>

      <p className="aide">
        {fiche.facteurOuverturePourCent} % d’ouverture : ce n’est <strong>pas un occultant</strong>.
        On voit dehors, et un peu de lumière passe. Épaisseur {String(fiche.epaisseurMm).replace('.', ',')} mm,
        réaction au feu {fiche.euroclasseFeu} (EN 13501-1).
      </p>

      {/* LA TEINTE DE LA TOILE — lot O9b. Elle est un AUTRE champ que la
          référence ci-dessus, et ce sont deux grandeurs : celle-là porte un
          facteur d'ouverture, une laize et une euroclasse au feu ; celle-ci
          est ce que le client voit depuis la rue, et elle fait 79 à 85 % de
          l'image (lot D17).

          LE BLOC EST ÉCRIT DEUX FOIS DANS CE DÉPÔT — ici et dans
          `EtapesFermetures.tsx` — et la duplication a son comparateur
          (`teinte-de-toile.test.ts`). Un morceau paresseux de plus coûterait
          son préambule d'imports (1 051 octets bruts, mesurés au lot MT5), et
          `briques.tsx` est dans le chargement initial. */}
      <div className="bloc">
        <span className="champ">{t('Teinte de la toile')}</span>
        <div className="prereglages" role="group" aria-label={t('Teinte de la toile')}>
          {TEINTES_DE_TOILE.map((teinte) => (
            <button
              key={teinte.id}
              type="button"
              data-test={`teinte-toile-${teinte.id}`}
              aria-pressed={config.teinteToile === teinte.id}
              onClick={() => champ({ teinteToile: teinte.id })}
            >
              <span
                style={{
                  background: teinte.hex,
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '3px',
                  border: '1px solid var(--ahjc-bord)',
                  marginRight: '6px',
                  verticalAlign: '-2px',
                }}
                aria-hidden="true"
              />
              {teinte.nom}
            </button>
          ))}
        </div>
        <p className="aide" data-test="toile-aide">
          {nomDeLaToile(config) === null
            ? aTraduire(
                'Non déclarée : la toile est le premier poste de décision du produit, et c’est la seule pièce qu’on regarde depuis la rue. Le dessin la montre au vert d’eau tant qu’elle n’est pas choisie.',
              )
            : `${nomDeLaToile(config)} — ${t(aTraduire('le nom se commande ; la pastille n’est qu’un équivalent d’écran'))}.`}
        </p>
      </div>

      {notes(4)}
    </Etape>
  );
}
