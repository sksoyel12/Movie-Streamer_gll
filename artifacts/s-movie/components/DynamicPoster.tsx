import React, { useEffect, useState } from "react";
import type { ImageContentFit, ImageSource } from "expo-image";

import SmartImage from "@/components/SmartImage";
import {
  fetchMoviePosters,
  tmdbOriginal,
} from "@/lib/tmdb";
import { getLockedHomePosterUri } from "@/lib/posterAlgorithm";

type Props = {
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  fallback: ImageSource | string | null | undefined;
  style?: any;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  transition?: number;
  cachePolicy?: "none" | "disk" | "memory" | "memory-disk";
};

/**
 * Netflix-style artwork selector for every browse surface.
 *
 * TMDB can expose dozens of approved key-art variants for one title. The
 * selector locks one of the first 50 for the current rotation window so
 * scrolling stays stable while revisiting the same title changes the artwork
 * over time instead of flickering on every render.
 */
export default function DynamicPoster({
  tmdbId,
  mediaType = "movie",
  fallback,
  style,
  contentFit = "cover",
  recyclingKey,
  transition = 250,
  cachePolicy = "memory-disk",
}: Props) {
  const fallbackSource: ImageSource | null | undefined =
    typeof fallback === "string" ? { uri: fallback } : fallback;
  const fallbackUri =
    typeof fallbackSource === "object" && fallbackSource && "uri" in fallbackSource
      ? fallbackSource.uri
      : undefined;
  const [uri, setUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!tmdbId) {
      setUri(undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const posters = await fetchMoviePosters(tmdbId, mediaType);
        const selected = await getLockedHomePosterUri(
          tmdbId,
          posters,
          (path) => tmdbOriginal(path),
          fallbackUri ?? null,
        );
        if (!cancelled && selected) setUri(selected);
      } catch {
        // The standard TMDB poster remains visible if artwork enrichment fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, fallbackUri]);

  return (
    <SmartImage
      source={uri ? { uri } : fallbackSource}
      style={style}
      contentFit={contentFit}
      transition={transition}
      recyclingKey={recyclingKey}
      cachePolicy={cachePolicy}
    />
  );
}