import { router } from "expo-router";

import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Movie } from "@/data/movies";
import { haptic } from "@/lib/haptics";
import { type TMDBPage, tmdbToCard } from "@/lib/tmdb";
import { saveHomeCache, loadHomeCache } from "@/lib/homeCache";
import { sortByPopularityDesc } from "@/lib/badgeUtils";
import { Skeleton } from "@/components/Skeleton";
import SmartImage from "@/components/SmartImage";

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_W        = 120;
const CARD_H        = 180;
const POSTER_OFFSET = 38;               // px of rank number exposed left of poster
const ITEM_GAP      = 8;
const ITEM_W        = POSTER_OFFSET + CARD_W;   // layout width per item
const ITEM_STRIDE   = ITEM_W + ITEM_GAP;

const RANK_FONT     = 110;
const RANK_LINE_H   = 116;

interface Props {
  title:        string;
  movies:       Movie[];
  tmdbFetcher?: (page: number) => Promise<TMDBPage>;
  refreshKey?:  number;
  loadDelay?:   number;
}

const BLOCKED_IDS_T10 = new Set([155]);
function isBannedT10(m: { id: number; title?: string; name?: string }): boolean {
  if (BLOCKED_IDS_T10.has(m.id)) return true;
  const t = (m.title ?? m.name ?? "").toLowerCase();
  return t.includes("dark knight");
}

function mapResults(results: TMDBPage["results"]): Movie[] {
  return (
    sortByPopularityDesc(results.filter((m) => !isBannedT10(m) && m.poster_path))
      .slice(0, 10)
      .map((m, i) => {
        const c = tmdbToCard(m);
        return {
          id:            c.id,
          title:         c.title,
          poster:        c.poster ?? { uri: "" },
          hero:          c.hero ?? undefined,
          year:          c.year,
          rating:        c.rating,
          duration:      "—",
          genres:        c.genres,
          cast:          [],
          director:      "—",
          synopsis:      c.synopsis,
          tmdbRating:    c.tmdbRating,
          dominantColor: "#1a1a2e",
          isTop10:       true,
          top10Rank:     i + 1,
          mediaType:     c.mediaType,
          tmdbId:        c.tmdbId,
          poster_path:   m.poster_path,
        } as Movie;
      })
  );
}

// ── RankNumber — Netflix exact look ──────────────────────────────────────────
// Two absolute <Text> layers produce the "massive dark digit with crisp white
// outline" that Netflix uses.  React Native only supports a single textShadow
// direction, so the dual-layer trick is the only reliable cross-platform way to
// render a true outline without native code.
//
//   Layer 1 (bottom): white fill + tight white radial shadow → visible stroke
//   Layer 2 (top):    black fill → covers the digit interior leaving only stroke
//
// Both layers are absolutely positioned at bottom:-10, left:0 matching the spec.
function RankNumber({ rank }: { rank: number }) {
  const label = String(rank);
  return (
    <>
      {/* White outline layer */}
      <Text
        style={[s.rankBase, s.rankStroke]}
        numberOfLines={1}
        pointerEvents="none"
      >
        {label}
      </Text>
      {/* Black fill layer on top */}
      <Text
        style={[s.rankBase, s.rankFill]}
        numberOfLines={1}
        pointerEvents="none"
      >
        {label}
      </Text>
    </>
  );
}

export default function Top10Row({
  title,
  movies: initialMovies,
  tmdbFetcher,
  refreshKey = 0,
  loadDelay  = 0,
}: Props) {
  const [movies,  setMovies]  = useState<Movie[]>(initialMovies);
  const [loading, setLoading] = useState(Boolean(tmdbFetcher));
  const mountedRef   = useRef(true);
  const fetcherRef   = useRef(tmdbFetcher);
  fetcherRef.current = tmdbFetcher;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!fetcherRef.current) { setMovies(initialMovies); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Offline-first: show cached data immediately while fetching fresh
      const cached = await loadHomeCache<Movie[]>(title);
      if (cached && cached.length > 0 && !cancelled && mountedRef.current) {
        setMovies(cached);
        setLoading(false);
      }

      if (loadDelay > 0) await new Promise((r) => setTimeout(r, loadDelay));
      if (cancelled || !mountedRef.current) return;
      try {
        const data   = await fetcherRef.current!(1);
        if (cancelled || !mountedRef.current) return;
        const mapped = mapResults(data.results);
        if (mapped.length > 0) {
          setMovies(mapped);
          saveHomeCache(title, mapped).catch(() => {});
        } else if (!cached) {
          setMovies(initialMovies);
        }
      } catch {
        if (!cancelled && mountedRef.current && !cached) setMovies(initialMovies);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // Only refreshKey is the intentional re-fetch trigger; fetcherRef is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, loadDelay]);

  const renderItem = useCallback(
    ({ item: m, index }: { item: Movie; index: number }) => {
      return (
        <Pressable
          onPress={() => {
            haptic.light();
            router.push({
              pathname: "/movie/[id]",
              params: { id: m.id, type: (m as any).mediaType ?? "movie" },
            });
          }}
          style={({ pressed }) => [s.item, pressed && { opacity: 0.78 }]}
        >
          {/* ── Rank number: absolutely anchored left:0, bottom:0 ── */}
          <RankNumber rank={index + 1} />

          {/* ── Poster column: marginLeft:35, zIndex:10 overlaps the number ── */}
          <View style={s.posterCol}>
            <View style={s.posterWrap}>
              <SmartImage
                source={
                  (m as any).poster_url
                    ? { uri: (m as any).poster_url }
                    : (m as any).poster_path
                    ? { uri: `https://wsrv.nl/?url=https://image.tmdb.org/t/p/w342${(m as any).poster_path}` }
                    : (m.poster as any)
                }
                style={s.poster}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={`${m.id}-r${refreshKey}`}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.55)"]}
                style={s.cardGrad}
                pointerEvents="none"
              />
            </View>
          </View>
        </Pressable>
      );
    },
    [refreshKey],
  );

  const keyExtractor = useCallback((m: Movie) => String(m.id), []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_STRIDE,
      offset: ITEM_STRIDE * index + 16,
      index,
    }),
    [],
  );

  return (
    <View style={s.wrap}>
      <Text style={s.rowTitle}>{title}</Text>

      {loading ? (
        <View style={s.skeletonRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={s.skeletonItem}>
              <Skeleton
                width={POSTER_OFFSET * 0.6}
                height={CARD_H * 0.65}
                borderRadius={4}
                style={{ alignSelf: "flex-end", marginRight: -4 }}
              />
              <Skeleton width={CARD_W} height={CARD_H} borderRadius={8} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={movies ?? []}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled
          nestedScrollEnabled
          style={{ minHeight: CARD_H + 16 }}
          contentContainerStyle={s.list}
          getItemLayout={getItemLayout}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          decelerationRate="fast"
          snapToInterval={ITEM_STRIDE}
          snapToAlignment="start"
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 16, marginBottom: 4 },

  rowTitle: {
    color:             "#ffffff",
    fontSize:          17,
    fontFamily:        "Inter_700Bold",
    paddingHorizontal: 16,
    marginBottom:      10,
    letterSpacing:     -0.3,
  },

  list: {
    paddingHorizontal: 16,
    alignItems:        "flex-end",
  },

  // ── Item: position:relative so the absolute number anchors to it ──────────
  item: {
    position:      "relative",
    flexDirection: "row",
    alignItems:    "flex-end",
    width:         ITEM_W,
    marginRight:   ITEM_GAP,
  },

  // ── Rank number layers — both absolutely anchored (left:0, bottom:0) ──────
  rankBase: {
    position:           "absolute",
    left:               0,
    bottom:             0,
    fontSize:           RANK_FONT,
    lineHeight:         RANK_LINE_H,
    fontFamily:         "Inter_900Black",
    letterSpacing:      -5,
    includeFontPadding: false,
    zIndex:             1,
    width:              POSTER_OFFSET + 60,  // wide enough for 2-digit numbers
  },

  // Layer 1 — white fill + tight white shadow creates the visible stroke
  rankStroke: {
    color:            "#ffffff",
    textShadowColor:  "rgba(255,255,255,0.95)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },

  // Layer 2 — black fill covers the interior of the digit leaving only stroke
  rankFill: {
    color: "#000000",
  },

  // ── Poster column: marginLeft pushes it right, zIndex puts it over number ─
  posterCol: {
    marginLeft:  POSTER_OFFSET,
    zIndex:      10,
    alignItems:  "center",
  },

  posterWrap: {
    width:           CARD_W,
    height:          CARD_H,
    borderRadius:    8,
    overflow:        "hidden",
    backgroundColor: "#1c1c1c",
    shadowColor:     "#000",
    shadowOffset:    { width: -4, height: 4 },
    shadowOpacity:   0.65,
    shadowRadius:    8,
    elevation:       8,
  },

  poster: {
    width:  "100%",
    height: "100%",
  },

  cardGrad: {
    position: "absolute",
    left:     0,
    right:    0,
    bottom:   0,
    height:   CARD_H * 0.35,
  },

  // ── Title below poster ───────────────────────────────────────────────────
  cardTitle: {
    color:       "rgba(255,255,255,0.78)",
    fontSize:    10,
    fontFamily:  "Inter_600SemiBold",
    marginTop:   4,
    width:       CARD_W,
    textAlign:   "center",
    letterSpacing: 0.1,
  },

  // ── Skeleton ──────────────────────────────────────────────────────────────
  skeletonRow: {
    flexDirection:     "row",
    paddingHorizontal: 16,
    gap:               ITEM_GAP,
    alignItems:        "flex-end",
  },
  skeletonItem: {
    flexDirection: "row",
    alignItems:    "flex-end",
  },
});
