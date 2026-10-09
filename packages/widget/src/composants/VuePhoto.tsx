/**
 * Pourquoi ce fichier existe : la mise en situation — la menuiserie posée
 * sur la photo de la façade du client. C'est la « preuve » de la thèse
 * produit : le prix accroche, la projection convainc (docs/00 §1).
 *
 * Solution écartée : un détourage automatique de la baie. La vision par
 * ordinateur appartient à la vague 3 (docs/00 §2, ligne 17) et n'a rien à
 * faire sur le chemin critique. Ici le client **place lui-même** le dessin :
 * il glisse, il redimensionne, il voit. C'est immédiat, c'est honnête, et
 * ça marche sur n'importe quelle photo.
 *
 * Incident fondateur, de confidentialité : la photo d'une maison est une
 * donnée personnelle. Elle ne quitte JAMAIS le navigateur — pas d'envoi,
 * pas de service tiers, une simple URL d'objet locale, révoquée au
 * démontage. Le plugin de la phase 4 ne la transmettra qu'avec le lead de
 * pose, et parce que le client l'aura demandé.
 */

import { useEffect, useRef, useState } from 'react';
import { elevationToSvg, type Elevation } from '@ahjc/core';
import { useT } from '../i18n.ts';

interface Pose {
  /** Position du coin haut-gauche, en pourcentage de la photo. */
  xPct: number;
  yPct: number;
  /** Largeur de l'incrustation, en pourcentage de la largeur de la photo. */
  largeurPct: number;
}

export function VuePhoto(props: { elevation: Elevation }) {
  const t = useT();
  const [photo, setPhoto] = useState<string | null>(null);
  const [pose, setPose] = useState<Pose>({ xPct: 34, yPct: 26, largeurPct: 32 });
  const cadre = useRef<HTMLDivElement>(null);
  const glisse = useRef<{ xPct: number; yPct: number } | null>(null);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo);
    };
  }, [photo]);

  const choisirPhoto = (evenement: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = evenement.target.files?.[0];
    if (!fichier) return;
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(fichier));
  };

  // Le dessin sans cotes : sur une façade, les traits de cotation sont du
  // bruit — c'est la même élévation, dépouillée.
  const svg = elevationToSvg(props.elevation, { cotes: false, titre: t('Projection sur la façade') });

  const enPourcentage = (evenement: { clientX: number; clientY: number }) => {
    const boite = cadre.current?.getBoundingClientRect();
    if (!boite) return null;
    return {
      xPct: ((evenement.clientX - boite.left) / boite.width) * 100,
      yPct: ((evenement.clientY - boite.top) / boite.height) * 100,
    };
  };

  if (!photo) {
    return (
      <div className="vue-photo vue-photo--vide" data-test="vue-photo">
        <p className="a-venir">
          {t('Ajoutez une photo de votre façade : la menuiserie s’y pose, à la bonne place et aux bonnes proportions.')}{' '}
          <strong>{t('La photo reste sur votre appareil')}</strong>{' '}
          {t('— elle n’est envoyée nulle part.')}
        </p>
        <label className="bouton" htmlFor="ahjc-photo">{t('Choisir une photo')}</label>
        <input
          id="ahjc-photo"
          data-test="choisir-photo"
          type="file"
          accept="image/*"
          className="champ-fichier"
          onChange={choisirPhoto}
        />
      </div>
    );
  }

  return (
    <div className="vue-photo" data-test="vue-photo">
      <div
        className="photo-cadre"
        ref={cadre}
        onPointerMove={(evenement) => {
          if (!glisse.current || evenement.buttons !== 1) return;
          const point = enPourcentage(evenement);
          if (!point) return;
          setPose((precedente) => ({
            ...precedente,
            xPct: Math.min(100, Math.max(-20, point.xPct - glisse.current!.xPct)),
            yPct: Math.min(100, Math.max(-20, point.yPct - glisse.current!.yPct)),
          }));
        }}
        onPointerUp={() => {
          glisse.current = null;
        }}
      >
        <img src={photo} alt={t('Votre façade')} className="photo-fond" />
        <div
          className="photo-incrustation"
          data-test="incrustation"
          style={{ left: `${pose.xPct}%`, top: `${pose.yPct}%`, width: `${pose.largeurPct}%` }}
          onPointerDown={(evenement) => {
            const point = enPourcentage(evenement);
            if (point) glisse.current = { xPct: point.xPct - pose.xPct, yPct: point.yPct - pose.yPct };
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div className="photo-commandes">
        <label className="champ" htmlFor="ahjc-taille-photo">
          {t('Taille de la menuiserie sur la photo')}
        </label>
        <input
          id="ahjc-taille-photo"
          data-test="taille-incrustation"
          type="range"
          min={8}
          max={90}
          value={pose.largeurPct}
          onChange={(evenement) =>
            setPose((precedente) => ({ ...precedente, largeurPct: Number((evenement.target as HTMLInputElement).value) }))
          }
        />
        <p className="aide">
          {t('Glissez la menuiserie pour la placer. Les proportions restent celles de vos cotes — seule l’échelle à l’écran change.')}
        </p>
        <button
          type="button"
          className="bouton"
          onClick={() => {
            URL.revokeObjectURL(photo);
            setPhoto(null);
          }}
        >
          Changer de photo
        </button>
      </div>
    </div>
  );
}
