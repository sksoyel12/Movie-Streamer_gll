import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Text as SvgText } from "react-native-svg";

import type { Movie } from "@/data/movies";
import { haptic } from "@/lib/haptics";
import { type TMDBPage, tmdbToCard } from "@/lib/tmdb";
import { saveHomeCache, loadHomeCache } from "@/lib/homeCache";
import { sortByPopularityDesc } from "@/lib/badgeUtils";
import { Skeleton } from "@/components/Skeleton";
import SmartImage from "@/components/SmartImage";

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_W          = 134;             // poster width
const CARD_H          = 200;             // poster height  (≈ 2:3)
const BADGE_W         = 86;             // glass badge total width
const POSTER_OFFSET   = 52;             // px of badge visible left of poster
const ITEM_GAP        = 10;
const ITEM_W          = POSTER_OFFSET + CARD_W;
const ITEM_STRIDE     = ITEM_W + ITEM_GAP;
const RANK_FONT       = 152;
const RANK_LINE       = 152;

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

// ── Glassmorphism Rank Number ─────────────────────────────────────────────────
// Frosted-glass panel behind the poster + SVG outline number on top.
// iOS/web → real BlurView backdrop blur (glass sheen + gradient).
// Android  → dark semi-transparent fallback (BlurView unreliable on Android).
function RankNumber({ rank }: { rank: number }) {
  const label    = String(rank);
  const isDouble = label.length > 1;
  const fontSize = isDouble ? 108 : RANK_FONT;
  const strokeW  = isDouble ? 7   : 9;
  const textY    = CARD_H - 6;                     // baseline at bottom

  // SVG — three layers for the glassmorphism number effect
  const svgNumber = (
    <Svg
      width={BADGE_W}
      height={CARD_H}
      style={StyleSheet.absoluteFillObject as any}
    >
      {/* 1 — deep shadow: separates number from poster */}
      <SvgText
        x={BADGE_W / 2 + 3}
        y={textY + 5}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="900"
        fill="none"
        stroke="rgba(0,0,0,0.70)"
        strokeWidth={strokeW + 7}
        strokeLinejoin="round"
      >
        {label}
      </SvgText>
      {/* 2 — main glass fill: very slight frosted-white tint */}
      <SvgText
        x={BADGE_W / 2}
        y={textY}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="900"
        fill="rgba(255,255,255,0.10)"
        stroke="rgba(230,232,240,0.95)"
        strokeWidth={strokeW}
        strokeLinejoin="round"
      >
        {label}
      </SvgText>
      {/* 3 — inner-highlight: thin bright ring = glass sheen */}
      <SvgText
        x={BADGE_W / 2}
        y={textY}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="900"
        fill="transparent"
        stroke="rgba(255,255,255,0.38)"
        strokeWidth={1.8}
        strokeLinejoin="round"
      >
        {label}
      </SvgText>
    </Svg>
  );

  if (Platform.OS === "android") {
    return (
      <View style={s.rankOuter} pointerEvents="none">
        {/* Android: solid semi-transparent panel simulates glass */}
        <View style={[StyleSheet.absoluteFillObject, s.glassAndroid]} />
        {svgNumber}
      </View>
    );
  }

  return (
    <View style={s.rankOuter} pointerEvents="none">
      {/* Real frosted-glass blur — blurs the poster behind the badge */}
      <BlurView
        intensity={Platform.OS === "web" ? 18 : 26}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      {/* Glass sheen: diagonal light gradient from top-left */}
      <LinearGradient
        colors={[
          "rgba(255,255,255,0.16)",
          "rgba(255,255,255,0.06)",
          "rgba(255,255,255,0.01)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Glass edge highlight — top + left border gives the "glass rim" look */}
      <View style={s.glassBorder} pointerEvents="none" />
      {svgNumber}
    </View>
  );
}

// ── Individual card item with its own press-scale animation ───────────────────
function Top10Item({
  movie,
  rank,
  refreshKey,
  onPress,
}: {
  movie: Movie;
  rank: number;
  refreshKey: number;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1.05,
      useNativeDriver: true,
      damping: 12,
      stiffness: 260,
      mass: 0.8,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 240,
      mass: 0.8,
    }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={s.item}
    >
      {/* Netflix-style rank number — behind the poster */}
      <RankNumber rank={rank} />

      {/* Poster — overlaps the badge from the right */}
      <Animated.View style={[s.posterCol, { transform: [{ scale }] }]}>
        <View style={s.posterWrap}>
          <SmartImage
            source={
              (movie as any).poster_url
                ? { uri: (movie as any).poster_url }
                : (movie as any).poster_path
                ? { uri: `https://wsrv.nl/?url=https://image.tmdb.org/t/p/w342${(movie as any).poster_path}` }
                : (movie.poster as any)
            }
            style={s.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={`${movie.id}-r${refreshKey}`}
          />
          {/* Subtle bottom vignette */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.45)"]}
            style={s.cardGrad}
            pointerEvents="none"
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Main row ─────────────────────────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, loadDelay]);

  const renderItem = useCallback(
    ({ item: m, index }: { item: Movie; index: number }) => (
      <Top10Item
        movie={m}
        rank={index + 1}
        refreshKey={refreshKey}
        onPress={() => {
          haptic.light();
          router.push({
            pathname: "/movie/[id]",
            params: { id: m.id, type: (m as any).mediaType ?? "movie" },
          });
        }}
      />
    ),
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
                width={POSTER_OFFSET * 0.62}
                height={CARD_H * 0.66}
                borderRadius={6}
                style={{ alignSelf: "flex-end", marginRight: -4 }}
              />
              <Skeleton width={CARD_W} height={CARD_H} borderRadius={10} />
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
          style={{ minHeight: CARD_H + 20 }}
          contentContainerStyle={s.list}
          getItemLayout={getItemLayout}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          decelerationRate="fast"
          snapToInterval={ITEM_STRIDE}
          snapToAlignment="start"
          removeClippedSubviews={Platform.OS !== "web"}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap: { marginTop: 18, marginBottom: 6 },

  rowTitle: {
    color:             "#ffffff",
    fontSize:          17,
    fontFamily:        "Inter_700Bold",
    paddingHorizontal: 16,
    marginBottom:      12,
    letterSpacing:     -0.3,
  },

  list: {
    paddingHorizontal: 16,
    alignItems:        "flex-end",
  },

  // ── Item ─────────────────────────────────────────────────────────────────
  item: {
    position:      "relative",
    flexDirection: "row",
    alignItems:    "flex-end",
    width:         ITEM_W,
    marginRight:   ITEM_GAP,
    height:        CARD_H,
  },

  // ── Glassmorphism rank number ─────────────────────────────────────────────
  // Anchored bottom-left, sits behind the poster (lower zIndex).
  // overflow:hidden clips the blur + gradient exactly to the badge bounds.
  rankOuter: {
    position: "absolute",
    left:     0,
    bottom:   0,
    width:    BADGE_W,
    height:   CARD_H,
    zIndex:   1,
    overflow: "hidden",
  },

  // Android fallback — dark semi-transparent panel with a faint border
  glassAndroid: {
    backgroundColor: "rgba(10,12,22,0.72)",
    borderRightWidth: 1,
    borderColor:     "rgba(255,255,255,0.12)",
  },

  // Glass rim — top + right edge highlight (the "glass edge" catch-light)
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth:   1,
    borderRightWidth: 1,
    borderColor:      "rgba(255,255,255,0.18)",
  },

  // ── Poster ────────────────────────────────────────────────────────────────
  posterCol: {
    marginLeft: POSTER_OFFSET,
    zIndex:     10,
  },

  posterWrap: {
    width:           CARD_W,
    height:          CARD_H,
    borderRadius:    10,
    overflow:        "hidden",
    backgroundColor: "#1c1c1c",
    // Deep shadow for the "card floating over number" depth effect
    shadowColor:     "#000",
    shadowOffset:    { width: -6, height: 6 },
    shadowOpacity:   0.72,
    shadowRadius:    12,
    elevation:       12,
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
    height:   CARD_H * 0.32,
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
