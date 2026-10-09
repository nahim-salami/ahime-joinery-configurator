/**
 * Pourquoi ce fichier existe : le point d'entrée du bundle embarqué. Il
 * déclare l'élément dès son chargement — un `<script type="module">` suffit,
 * l'hôte n'a aucune fonction à appeler.
 *
 * Solution écartée : exiger un `JoineryWidget.init()`. Un intégrateur qui
 * oublie l'appel voit une page vide sans message ; un plugin qui l'appelle
 * deux fois monte deux widgets. La déclaration d'un custom element est
 * idempotente par nature — c'est le mécanisme du navigateur qui garantit
 * l'unicité, pas notre discipline.
 *
 * Incident fondateur : le build doit être un MODULE ES (voir
 * vite.embed.config.ts) — Rollup ne découpe pas un IIFE, et la 3D de la
 * phase 3 doit pouvoir arriver en chunk paresseux.
 */

export { JoineryConfigElement, NOM_ELEMENT, definirElement } from './element.tsx';
export type { HostContext, ModeVue, Preset } from './host-context.ts';
export type { EvenementWidget } from './composants/Configurateur.tsx';

import { definirElement } from './element.tsx';

definirElement();
