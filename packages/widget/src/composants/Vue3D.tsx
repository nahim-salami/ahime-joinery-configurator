/**
 * Pourquoi ce fichier existe : la bascule vers la 3D — et le point EXACT où
 * three.js entre dans la page, par un `import()` et pas autrement. Tant que
 * le client reste en 2D (le défaut), le moteur de rendu n'est jamais
 * téléchargé : le prix ne paie pas la 3D de ceux qui ne la regardent pas.
 *
 * Solution écartée : importer la scène en tête de fichier et n'en monter
 * l'écran qu'au clic. L'import statique suffit à faire entrer three.js dans
 * le bundle principal — le budget serait crevé sans qu'aucun écran ne
 * change. C'est pourquoi `verifier-bundle.mjs` refuse désormais toute trace
 * de three.js dans le fichier d'entrée : la discipline est vérifiée, pas
 * espérée.
 *
 * Incident fondateur : un `WebGLRenderer` non détruit fuit le contexte
 * graphique ; quelques allers-retours entre onglets et la page tombe. D'où
 * le nettoyage systématique au démontage, et le montage différé qui annule
 * proprement si le client repart avant la fin du chargement.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { RUGOSITE_FINITION, VERNIS_PAR_MATERIAU } from '@ahjc/core';
import type { Geometry3D, JoineryConfiguration } from '@ahjc/core';
import type { AngleDeVue, CoteDeVue, Scene3D, TeintesScene } from '../3d/scene.ts';
import { aDeuxFacesTeintables, decorDeLaFamille } from '../decor-famille.ts';
import { useT } from '../i18n.ts';
import { hexDeLaToile } from '@ahjc/core/src/toiles-de-store.ts';

const FEUILLE_VUE3D = `
/* LES POINTS DE VUE de la scène 3D. Une rangée compacte : quatre angles,
   deux cotes, deux crans de zoom — et des cibles d'au moins 32 px, parce
   qu'on s'en sert au doigt sur un telephone. */
.vue3d-angles { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; margin-bottom: 8px; background: var(--ahjc-papier); padding: 3px; border-radius: 8px; }
.vue3d-angles button { border: 0; background: none; padding: 6px 10px; min-height: 32px; min-width: 32px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--ahjc-encre-douce); }
.vue3d-angles button[aria-pressed="true"] { background: var(--ahjc-surface); color: var(--ahjc-encre); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.vue3d-separateur { width: 1px; align-self: stretch; margin: 2px 4px; background: var(--ahjc-bord); }
.vue3d-canevas:focus-visible { outline: 2px solid var(--ahjc-accent); outline-offset: -2px; }
`.trim();

export function Vue3D(props: {
  geometrie: Geometry3D;
  teintes: TeintesScene;
  /**
   * La configuration, pour en tirer le DÉCOR — voir `decor-famille.ts`.
   *
   * Le viewport le calculait et le passait tout fait ; cela mettait la
   * table des décors dans le CHARGEMENT INITIAL, 0,7 ko payés par tous
   * ceux qui n'ouvrent jamais l'onglet 3D. Le décor est une affaire de
   * volume : il se décide ici, dans un morceau paresseux.
   */
  config: JoineryConfiguration;
  /** Élargit le mur — un galandage y enfonce son fourreau. */
  debordMurMm?: number;
}) {
  const canevas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const t = useT();
  const [etat, setEtat] = useState<'chargement' | 'prete' | 'echec'>('chargement');
  const [ouverture, setOuverture] = useState(0);
  // Le décor est actif par défaut : sans mur, une menuiserie blanche sur
  // fond clair n'a plus d'arêtes, et rien ne dit sa taille.
  const [decor, setDecor] = useState(true);
  const decorFamille = decorDeLaFamille(props.config);
  /**
   * LA TEINTE, COMPLÉTÉE DE CE QUE SEUL LE DÉCOR SAIT : cet ouvrage a-t-il
   * deux faces ?
   *
   * Le viewport, lui, ne peut pas le dire — il vit dans le CHARGEMENT
   * INITIAL, et la table des décors n'y entre pas (c'est la raison même pour
   * laquelle le décor se décide ici depuis le lot 7.7). Le drapeau se pose
   * donc au seuil de la 3D, gratuitement.
   *
   * ET L'IDENTITÉ SE GARDE. Un objet neuf à chaque rendu reconstruirait la
   * scène entière parce qu'on a ouvert le détail du prix — c'est l'incident
   * que le `useMemo` du viewport consigne, et le recopier ici l'annulerait.
   */
  const deuxFaces = aDeuxFacesTeintables(decorFamille.type);
  // LA BRILLANCE ET LE VERNIS se calculent ICI depuis le lot D18, et non plus
  // dans le viewport. Un 7016 mat et un 7016 satiné portent la même teinte et
  // ne se ressemblent pas au soleil ; un aluminium laqué a un vernis, un PVC
  // teinté dans la masse n'en a presque pas. Ce sont des grandeurs de RENDU :
  // leurs deux tables n'ont rien à faire dans le chargement initial de qui
  // n'ouvre jamais l'onglet 3D.
  // L'ASPECT DU VERRE et le FIL DU BOIS sont ici pour la même raison : un
  // dépoli se rend par une RUGOSITÉ, pas par une teinte plus laiteuse, et un
  // aluminium thermolaqué n'a pas de fil. Le dessin, lui, n'a que des
  // couleurs à donner.
  const materiau = props.config.materiau;
  const finition = props.config.finition ?? 'satine';
  const aspectVitrage = props.config.vitrage?.aspect;
  const teintes = useMemo(
    () => ({
      ...props.teintes,
      deuxFaces,
      rugositeCadre: RUGOSITE_FINITION[finition],
      vernisCadre: VERNIS_PAR_MATERIAU[materiau],
      vitrageDepoli: aspectVitrage === 'depoli' || aspectVitrage === 'sable',
      filDuBois: materiau === 'bois' || materiau === 'mixte',
      // LA TEINTE DE LA TOILE, lue ICI et pas dans le viewport : la table des
      // douze teintes est une grandeur de RENDU comme la rugosité d'une
      // finition, et elle n'a rien à faire dans le chargement initial de qui
      // n'ouvre jamais l'onglet 3D (lot D18).
      toile: hexDeLaToile(props.config),
    }),
    [props.teintes, deuxFaces, finition, materiau, aspectVitrage, props.config],
  );
  // Le point de vue courant, tenu à jour pour que les boutons disent lequel
  // est actif. La caméra, elle, vit dans la scène three.js.
  const [vue, setVue] = useState<{ angle: AngleDeVue; cote: CoteDeVue }>({
    angle: 'trois-quarts',
    cote: decorFamille.vuDepuis,
  });

  // Montage : le chargement du moteur est asynchrone et annulable.
  useEffect(() => {
    let abandonne = false;
    (async () => {
      try {
        const { monterScene } = await import('../3d/scene.ts');
        if (abandonne || !canevas.current) return;
        scene.current = monterScene(canevas.current);
        const cadre = canevas.current.getBoundingClientRect();
        scene.current.redimensionner(cadre.width, cadre.height);
        setEtat('prete');
      } catch (erreur) {
        if (!abandonne) setEtat('echec');
        console.error('[joinery] la scène 3D n\'a pas pu démarrer', erreur);
      }
    })();
    return () => {
      abandonne = true;
      scene.current?.detruire();
      scene.current = null;
    };
  }, []);

  // La géométrie change à chaque geste du client : la scène se remet à jour
  // sans être reconstruite.
  useEffect(() => {
    if (etat !== 'prete') return;
    scene.current?.mettreAJour(props.geometrie, teintes, {
      // Le décor de la famille est passé EN ENTIER, jamais recopié champ à
      // champ : le premier jet en énumérait trois, et le jour où
      // `decor-famille.ts` a su dire qu'une baie est ronde ou rampante,
      // l'information s'arrêtait ici sans qu'aucun test ne s'en aperçoive.
      decor: decor ? { ...decorFamille, debordMm: props.debordMurMm } : null,
    });
    scene.current?.ouvrir(ouverture);
  }, [
    etat,
    props.geometrie,
    teintes,
    decorFamille.type,
    decorFamille.vuDepuis,
    decorFamille.allegeMm,
    props.debordMurMm,
    decor,
  ]);

  useEffect(() => {
    scene.current?.ouvrir(ouverture);
  }, [ouverture]);

  // Le canevas suit la taille de son conteneur — un widget vit dans des
  // colonnes de largeurs très différentes selon la boutique.
  useEffect(() => {
    if (!canevas.current) return;
    const observateur = new ResizeObserver((entrees) => {
      const cadre = entrees[0].contentRect;
      scene.current?.redimensionner(cadre.width, cadre.height);
    });
    observateur.observe(canevas.current);
    return () => observateur.disconnect();
  }, [etat]);

  const orbiter = (evenement: React.PointerEvent<HTMLCanvasElement>) => {
    if (evenement.buttons !== 1) return;
    scene.current?.tourner(-evenement.movementX * 0.008, evenement.movementY * 0.006);
    rafraichirVue();
  };

  /**
   * Relire le point de vue APRÈS chaque geste. La caméra vit dans la scène
   * three.js, pas dans l'état React : sans cette relecture, les boutons
   * d'angle resteraient enfoncés sur le précédent après un glissé de souris.
   */
  const rafraichirVue = () => {
    const vue = scene.current?.pointDeVue();
    if (vue) setVue({ angle: vue.angle, cote: vue.cote });
  };

  /** Se placer sur un angle nommé, du côté demandé (ou du côté courant). */
  const viser = (angle: AngleDeVue, cote: CoteDeVue | null) => {
    scene.current?.viser(angle, cote);
    rafraichirVue();
  };

  const zoomer = (facteur: number) => {
    scene.current?.rapprocher(facteur);
  };

  /**
   * LA MOLETTE ZOOME, et elle ne fait pas défiler la page.
   *
   * `passive: false` est indispensable : React pose ses écouteurs de
   * molette en passif, et un écouteur passif n'a pas le droit d'appeler
   * `preventDefault()`. Sans cela, zoomer dans la scène emportait la page
   * avec — le client perdait la menuiserie de vue en essayant de s'en
   * approcher.
   */
  useEffect(() => {
    const cible = canevas.current;
    if (!cible || etat !== 'prete') return;
    const surLaMolette = (evenement: WheelEvent) => {
      evenement.preventDefault();
      zoomer(evenement.deltaY > 0 ? 1.12 : 1 / 1.12);
    };
    cible.addEventListener('wheel', surLaMolette, { passive: false });
    return () => cible.removeEventListener('wheel', surLaMolette);
  }, [etat]);

  /**
   * LE PINCEMENT À DEUX DOIGTS — le zoom du téléphone. Sans lui, la seule
   * façon de s'approcher sur mobile était les boutons, et personne ne les
   * cherche : on pince.
   */
  useEffect(() => {
    const cible = canevas.current;
    if (!cible || etat !== 'prete') return;
    const doigts = new Map<number, { x: number; y: number }>();
    let ecartPrecedent = 0;
    const ecart = () => {
      const [a, b] = [...doigts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const bas = (evenement: PointerEvent) => {
      if (evenement.pointerType !== 'touch') return;
      doigts.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
      if (doigts.size === 2) ecartPrecedent = ecart();
    };
    const bouge = (evenement: PointerEvent) => {
      if (!doigts.has(evenement.pointerId)) return;
      doigts.set(evenement.pointerId, { x: evenement.clientX, y: evenement.clientY });
      if (doigts.size !== 2) return;
      evenement.preventDefault();
      const courant = ecart();
      if (ecartPrecedent > 0 && courant > 0) zoomer(ecartPrecedent / courant);
      ecartPrecedent = courant;
    };
    const haut = (evenement: PointerEvent) => {
      doigts.delete(evenement.pointerId);
      ecartPrecedent = 0;
    };
    cible.addEventListener('pointerdown', bas);
    cible.addEventListener('pointermove', bouge, { passive: false });
    cible.addEventListener('pointerup', haut);
    cible.addEventListener('pointercancel', haut);
    return () => {
      cible.removeEventListener('pointerdown', bas);
      cible.removeEventListener('pointermove', bouge);
      cible.removeEventListener('pointerup', haut);
      cible.removeEventListener('pointercancel', haut);
    };
  }, [etat]);

  /**
   * LE CLAVIER. Les flèches tournent, `+` et `-` zooment — le canevas est
   * focalisable, et c'est ce qui rend la vue en volume utilisable sans
   * souris. Le lot 7.2 a posé la règle : on configure et on achète au
   * clavier ; une vue qu'on ne peut pas tourner au clavier n'est pas une
   * vue, c'est une image.
   */
  const auClavier = (evenement: React.KeyboardEvent<HTMLCanvasElement>) => {
    const pas = 0.22;
    const touches: Record<string, () => void> = {
      ArrowLeft: () => scene.current?.tourner(pas, 0),
      ArrowRight: () => scene.current?.tourner(-pas, 0),
      ArrowUp: () => scene.current?.tourner(0, -pas * 0.5),
      ArrowDown: () => scene.current?.tourner(0, pas * 0.5),
      '+': () => zoomer(1 / 1.18),
      '=': () => zoomer(1 / 1.18),
      '-': () => zoomer(1.18),
    };
    const geste = touches[evenement.key];
    if (!geste) return;
    evenement.preventDefault();
    geste();
    rafraichirVue();
  };

  if (etat === 'echec') {
    return (
      <p className="a-venir">
        La 3D n'a pas pu démarrer sur cet appareil. La vue 2D reste la vue de travail — elle porte
        les mêmes cotes.
      </p>
    );
  }

  const ouvrants = props.geometrie.ouvrants.length;
  return (
    <div className="vue3d" data-decor={decor ? 'oui' : 'non'}>
      <style>{FEUILLE_VUE3D}</style>
      <canvas
        ref={canevas}
        className="vue3d-canevas"
        data-test="canevas-3d"
        onPointerMove={orbiter}
        onKeyDown={auClavier}
        // Le canevas est FOCALISABLE : c'est ce qui rend les flèches et le
        // zoom au clavier possibles. Un `role="application"` dit au lecteur
        // d'écran de laisser passer les flèches au lieu de les avaler pour
        // sa propre navigation.
        tabIndex={0}
        role="application"
        aria-label={t('Vue en volume — flèches pour tourner, plus et moins pour zoomer')}
      />
      {etat === 'chargement' ? (
        <p className="a-venir">{t('Chargement de la vue en volume…')}</p>
      ) : null}
      {etat === 'prete' ? (
        <div className="vue3d-commandes">
          {/* Un châssis fixe n'ouvre rien : pas de curseur. Le décor, lui,
              se règle quelle que soit la menuiserie. */}
          {ouvrants > 0 ? (
            <>
              <label className="champ" htmlFor="ahjc-ouverture">
                {t('Ouverture des vantaux')}
              </label>
              <input
                id="ahjc-ouverture"
                data-test="ouverture-3d"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(ouverture * 100)}
                onChange={(evenement) => setOuverture(Number((evenement.target as HTMLInputElement).value) / 100)}
              />
            </>
          ) : null}
          {/* LES POINTS DE VUE. Quatre angles et un côté, pas un de plus :
              chacun répond à une question qu'un client se pose vraiment, et
              une rangée de dix boutons n'aide personne. */}
          <div className="vue3d-angles" role="group" aria-label={t('Point de vue')}>
            {(
              [
                ['face', t('Face')],
                ['trois-quarts', t('¾')],
                ['profil', t('Profil')],
                ['plongee', t('Dessus')],
              ] as const
            ).map(([angle, libelle]) => (
              <button
                key={angle}
                type="button"
                data-test={`vue-${angle}`}
                aria-pressed={vue.angle === angle}
                onClick={() => viser(angle, null)}
              >
                {libelle}
              </button>
            ))}
            <span className="vue3d-separateur" aria-hidden="true" />
            {/* LE CÔTÉ. C'est le geste le plus utile de tous : une
                bicoloration, les pentures d'un volet, la face rue d'une
                porte — on ne les juge que de l'autre bord. */}
            {(
              [
                ['dedans', t('Dedans')],
                ['dehors', t('Dehors')],
              ] as const
            ).map(([cote, libelle]) => (
              <button
                key={cote}
                type="button"
                data-test={`vue-${cote}`}
                aria-pressed={vue.cote === cote}
                onClick={() => viser(vue.angle, cote)}
              >
                {libelle}
              </button>
            ))}
            <span className="vue3d-separateur" aria-hidden="true" />
            <button
              type="button"
              data-test="zoom-moins"
              aria-label={t('Reculer')}
              onClick={() => zoomer(1.18)}
            >
              −
            </button>
            <button
              type="button"
              data-test="zoom-plus"
              aria-label={t('Rapprocher')}
              onClick={() => zoomer(1 / 1.18)}
            >
              +
            </button>
          </div>
          <span className="aide">
            {t('Glisser pour tourner · molette ou pincement pour zoomer · flèches au clavier.')}
          </span>
          <label className="bascule">
            <input
              type="checkbox"
              data-test="decor-3d"
              checked={decor}
              onChange={(evenement) => setDecor((evenement.target as HTMLInputElement).checked)}
            />
            {t('Poser dans son décor — l’échelle se lit d’un coup d’œil')}
          </label>
        </div>
      ) : null}
    </div>
  );
}
