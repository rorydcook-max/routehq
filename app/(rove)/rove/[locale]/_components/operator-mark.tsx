"use client";

import { useState } from "react";
import s from "../rove.module.css";

/**
 * The business as a small mark: its logo on a white tile with room around it, else its initial. A logo that would be
 * unreadable at this size (much wider than tall, or so pale it vanishes on white) shows the initial instead
 * (final pre-release test, 8 Nov 2026: tiny, faint logos in the 36px tiles).
 */
export function OperatorMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [useInitial, setUseInitial] = useState(!logoUrl);
  const initial = name.trim().charAt(0).toUpperCase();

  function check(image: HTMLImageElement) {
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height || width / height > 2.4) return setUseInitial(true);
    try {
      const size = 16;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, size, size);
      const { data } = context.getImageData(0, 0, size, size);
      let ink = 0;
      let seen = 0;
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3] / 255;
        if (alpha < 0.1) continue;
        seen += 1;
        const light = (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
        // A pixel counts as visible on white when it is clearly darker than white.
        if (light < 0.82) ink += 1;
      }
      if (seen === 0 || ink / (size * size) < 0.04) setUseInitial(true);
    } catch {
      // The picture can't be read (another site's image): it is shown as it is.
    }
  }

  return (
    <span aria-hidden="true" className={useInitial ? s.opMark : `${s.opMark} ${s.opMarkLogo}`}>
      {useInitial || !logoUrl ? (
        initial
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          crossOrigin="anonymous"
          loading="lazy"
          onError={() => setUseInitial(true)}
          onLoad={(event) => check(event.currentTarget)}
          // A logo already loaded before the page came alive fired its load event too early to be checked.
          ref={(image) => {
            if (image?.complete && image.naturalWidth) check(image);
          }}
          src={logoUrl}
        />
      )}
    </span>
  );
}
