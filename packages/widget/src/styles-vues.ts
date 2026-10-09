/**
 * Pourquoi ce fichier existe : la peau des vues qui arrivent A LA DEMANDE --
 * le volume, la realite augmentee, la photo de facade, la coupe de profile.
 * Leur code etait deja hors du chargement initial ; leur CSS, lui, voyageait
 * dans la feuille principale et se payait a chaque visite, y compris par qui
 * ne quitte jamais l'elevation.
 *
 * Solution ecartee : injecter cette feuille dans le document au montage de
 * la premiere vue. Un Shadow DOM ne lit PAS les styles du document (c'est
 * tout son interet), et une feuille posee dans `<head>` n'aurait rien
 * repeint tout en fuyant chez l'hote. On la rend donc comme un noeud React
 * DANS l'arbre : elle atterrit dans la racine fantome parce que c'est la que
 * l'arbre vit, sans que personne n'ait a manipuler la racine.
 *
 * Le doublon ne coute rien : deux vues ne sont jamais montees ensemble, et
 * deux `<style>` identiques dans une meme racine se recouvrent exactement.
 */

export const FEUILLE_VUES = `

/* — La vue en volume : le canevas prend la place, les commandes dessous —
   Le fond du canevas n'est PAS celui du reste du viewport : une menuiserie
   blanche sur les rayures claires du fond n'avait plus d'arêtes. Un dégradé
   sourd, plus foncé en haut, sert de ciel d'atelier. */
.vue3d { width: 100%; display: flex; flex-direction: column; gap: 10px; align-items: center; }
.vue3d-canevas {
  width: 100%; height: 340px; display: block; cursor: grab; touch-action: pan-y;
  border-radius: 6px;
  background: var(--ahjc-fond-3d, radial-gradient(120% 90% at 50% 8%, #6f7a80 0%, #93a0a6 42%, #c3ccd0 100%));
}
.bascule { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ahjc-encre-douce); cursor: pointer; min-height: 40px; }
.bascule input { accent-color: var(--ahjc-accent); width: 18px; height: 18px; }
.vue3d-canevas:active { cursor: grabbing; }
.vue3d-commandes { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 2px; }
.vue3d-commandes input[type="range"] { width: 100%; min-height: 44px; accent-color: var(--ahjc-accent); }

/* — « Voir chez moi » — */
.vue-ra { display: flex; flex-direction: column; gap: 12px; align-items: center; text-align: center; padding: 12px; }
.ra-liens { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.ra-liens .bouton { text-decoration: none; display: inline-flex; align-items: center; }

/* — La mise en situation sur photo — */
.vue-photo { width: 100%; display: flex; flex-direction: column; gap: 12px; align-items: center; }
.vue-photo--vide { text-align: center; padding: 16px; }
.vue-photo label.bouton { cursor: pointer; }
.champ-fichier { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.photo-cadre { position: relative; width: 100%; overflow: hidden; border-radius: 8px; background: var(--ahjc-papier); touch-action: none; }
.photo-fond { display: block; width: 100%; height: auto; }
.photo-incrustation { position: absolute; cursor: grab; filter: drop-shadow(0 4px 14px rgba(0,0,0,.28)); }
.photo-incrustation:active { cursor: grabbing; }
.photo-incrustation svg { width: 100%; height: auto; display: block; }
.photo-commandes { width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 6px; }
.photo-commandes input[type="range"] { width: 100%; min-height: 44px; accent-color: var(--ahjc-accent); }
.photo-commandes .bouton { align-self: flex-start; }

/* — Le plan de façade, la pièce DP4 : la saisie puis les deux états —
   Les deux planches sont côte à côte parce que la mairie les compare : ce
   qui existe, ce qui est projeté, et la différence entre les deux. Sur un
   téléphone elles passent l'une sous l'autre, dans cet ordre-là. */
.vue-facade { width: 100%; display: flex; flex-direction: column; gap: 14px; }
.facade-saisie { display: flex; flex-direction: column; gap: 10px; }
.facade-saisie select { width: 100%; min-height: 44px; }
.facade-planches { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.facade-planches figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.facade-planches figcaption { font-size: 12px; color: var(--ahjc-encre-douce); text-transform: uppercase; letter-spacing: .04em; }
.facade-planches svg { width: 100%; height: auto; display: block; }
@media (max-width: 560px) { .facade-planches { grid-template-columns: 1fr; } }

/* — La coupe de profilé, sous le viewport — */
.coupe { display: flex; gap: 14px; align-items: center; padding: 12px 14px; border-top: 1px solid var(--ahjc-bord); }
.coupe-dessin { width: 130px; flex: none; }
.coupe-dessin svg { width: 100%; height: auto; display: block; }
.coupe-texte { font-size: 13px; color: var(--ahjc-encre-douce); }
.coupe-texte strong { color: var(--ahjc-encre); }
`;
