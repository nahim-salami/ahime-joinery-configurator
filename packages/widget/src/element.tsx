/**
 * Pourquoi ce fichier existe : `<ahjc-configurator>` — le web component qui
 * embarque le configurateur dans n'importe quelle page : une fiche produit
 * WooCommerce, une page dédiée, un site tiers. Shadow DOM **ouvert** : les
 * tests Playwright et le support technique peuvent inspecter l'intérieur ;
 * les styles de l'hôte, eux, ne fuient pas dedans.
 *
 * Solution écartée : monter React directement dans la page. Les thèmes
 * WordPress imposent leurs styles à tout (`* { box-sizing }`, `button`
 * rebadgé, polices) — chez les néons, l'isolation du shadow root est ce qui
 * rend le widget installable chez n'importe qui sans retouche.
 *
 * Incident fondateur : les `@font-face` ne chargent PAS depuis un shadow
 * root ; elles sont injectées dans le document (voir `styles.ts`). Second
 * incident : un élément défini deux fois (deux copies du script sur la même
 * page) lève une exception qui casse TOUTE la page — d'où le garde
 * `customElements.get()` avant `define()`.
 */

import { createRoot, type Root } from 'react-dom/client';
import { lireContexte, resoudreCatalogue, type ModeVue } from './host-context.ts';
import { FEUILLE_WIDGET, injecterPolices } from './styles.ts';
import { Configurateur, type EvenementWidget } from './composants/Configurateur.tsx';

export const NOM_ELEMENT = 'ahjc-configurator';

export class JoineryConfigElement extends HTMLElement {
  static observedAttributes = ['data-vue'];
  #racineReact: Root | null = null;
  #hote: HTMLDivElement | null = null;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const fantome = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = FEUILLE_WIDGET;
      this.#hote = document.createElement('div');
      fantome.append(style, this.#hote);
    }
    const contexte = lireContexte();
    if (contexte.appearance?.police) injecterPolices(contexte.appearance.police, document);
    if (contexte.appearance?.accent) this.style.setProperty('--ahjc-accent', contexte.appearance.accent);
    if (contexte.appearance?.rayon) this.style.setProperty('--ahjc-rayon', contexte.appearance.rayon);
    if (!this.getAttribute('data-vue')) this.setAttribute('data-vue', contexte.vue ?? 'pleine');
    this.#rendre();
  }

  attributeChangedCallback(): void {
    if (this.#racineReact) this.#rendre();
  }

  disconnectedCallback(): void {
    // React n'aime pas être démonté pendant son propre rendu : on diffère.
    // Mais on RELIT `isConnected` au moment de démonter — déplacer un
    // élément dans le DOM (un thème qui reparente son conteneur, un onglet
    // qui déplace son panneau) déclenche `disconnected` PUIS `connected`,
    // l'un derrière l'autre, avant la micro-tâche. Démonter sans vérifier
    // vidait alors la racine que le rattachement venait tout juste de
    // recréer, et le configurateur disparaissait de la page.
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.#racineReact?.unmount();
      this.#racineReact = null;
    });
  }

  #rendre(): void {
    if (!this.#hote) return;
    const contexte = lireContexte();
    this.#racineReact ??= createRoot(this.#hote);
    this.#racineReact.render(
      <Configurateur
        contexte={contexte}
        catalogue={resoudreCatalogue(contexte.pricing)}
        vue={(this.getAttribute('data-vue') as ModeVue) ?? 'pleine'}
        onEvenement={(evenement: EvenementWidget) => this.#emettre(evenement)}
      />,
    );
  }

  /** Les événements montent hors du shadow root — l'hôte n'écoute que nous. */
  #emettre(evenement: EvenementWidget): void {
    this.dispatchEvent(
      new CustomEvent(evenement.nom, { detail: evenement.detail, bubbles: true, composed: true }),
    );
  }
}

/** Déclare l'élément — sans jamais lever si une autre copie l'a déjà fait. */
export function definirElement(): void {
  if (typeof customElements === 'undefined') return;
  if (customElements.get(NOM_ELEMENT)) return;
  customElements.define(NOM_ELEMENT, JoineryConfigElement);
}
