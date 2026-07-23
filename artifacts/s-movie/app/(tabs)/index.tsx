import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import Header, { type Tab } from "@/components/Header";
import HeroBannerCarousel from "@/components/HeroBannerCarousel";
import MovieRow from "@/components/MovieRow";
import Top10Row from "@/components/Top10Row";
import MyListRow from "@/components/MyListRow";
import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";

import { type Movie } from "@/data/movies";
import {
  tmdb,
  tmdbToCard,
  fetchRandomPosterUri,
  clearPosterCache,
  dailyRotationIndex,
  rotateArray,
} from "@/lib/tmdb";
import { HOME_CATEGORIES } from "@/lib/categoryMap";
import { hasUnread as checkHasUnread } from "@/lib/notificationPrefs";
import { saveHomeCacheTTL, loadHomeCacheTTL, loadHomeCache, HERO_CACHE_KEY } from "@/lib/homeCache";
import { LATEST_NOTIF_AT } from "@/data/notifications";
import { getDailyGradient } from "@/lib/dailyGradient";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

// Stagger row fetches so we don't fire ~50 TMDB requests in the same tick.
const ROW_LOAD_STAGGER_MS = 120;

const { width: W } = Dimensions.get("window");

const CAROUSEL_CARD_W    = Math.round(W * 0.62);
const CAROUSEL_CARD_H    = Math.round(CAROUSEL_CARD_W * 1.52);
const HERO_SECTION_MIN_H = CAROUSEL_CARD_H + 318;

// ─── Hero data helper ─────────────────────────────────────────────────────────
function toMovieCard(raw: ReturnType<typeof tmdbToCard>): Movie {
  return {
    id:            raw.id,
    title:         raw.title,
    poster:        raw.poster ?? { uri: "" },
    hero:          raw.hero ?? undefined,
    year:          raw.year,
    rating:        raw.rating,
    duration:      "—",
    genres:        raw.genres,
    cast:          [],
    director:      "—",
    synopsis:      raw.synopsis,
    dominantColor: "#1a1a2e",
    tmdbRating:    raw.tmdbRating,
    tmdbId:        raw.tmdbId,
    mediaType:     raw.mediaType,
  } as Movie & { tmdbRating: number };
}

// ─── Memoized hero section ────────────────────────────────────────────────────
const StableHero = React.memo(function StableHero({
  movies,
  refreshing,
}: {
  movies: Movie[];
  refreshing: boolean;
}) {
  return (
    <View style={{ minHeight: HERO_SECTION_MIN_H, backgroundColor: "transparent", borderWidth: 0, outlineWidth: 0 } as any}>
      <HeroBannerCarousel movies={movies} refreshing={refreshing} />
    </View>
  );
});

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [accentTop, accentMid] = getDailyGradient();
  const [activeTab, setActiveTab]           = useState<Tab>("Shows");
  const [heroMovies, setHeroMovies]         = useState<Movie[]>([]);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  // Smart Category Poster Refresh: bumping this forces every MovieRow/Top10Row
  // below the hero to re-fetch from TMDB and re-shuffle its display order
  // (weighted by popularity) — triggered on pull-to-refresh.
  const [rowRefreshKey, setRowRefreshKey]   = useState(0);

  // ── AI Personalization — loads silently in background, never blocks render ──
  const {
    topGenres,
    personalImageMode,
    personalRowTitle,
    ready: prefsReady,
  } = useUserPreferences();

  // Personalised fetcher — rebuilds only when topGenres changes (memoised).
  // Falls back to weekly trending until user has enough watch data.
  const personalFetcher = useMemo(
    () => tmdb.personalizedByGenres(topGenres, "tv"),
    [topGenres.join(",")], // stable key so MovieRow doesn't remount needlessly
  );

  const scrollY      = useRef(new Animated.Value(0)).current;
  const heroRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroTabRef   = useRef<Tab>("Shows");

  // Cross-row de-duplication: MovieRow instances share this set so the same
  // title never appears twice across the ~50 category rows below the hero.
  const seenIds = useRef<Set<string>>(new Set());

  // ── Real-time hero fetch — daily-rotating Movie / K-Drama / US Show mix ─────
  // Netflix-style hero rotation: pull today's #1 trending item from three
  // distinct pools (Movies, K-Dramas, US TV Shows) so the banner always has
  // variety across content types, and use a date-seeded rotation offset per
  // pool so the *order* those pools lead with changes once every 24 hours
  // (stable all day, shifts forward the next day) rather than reshuffling on
  // every single open/refresh.
  const fetchHero = useCallback(async () => {
    try {
      const [movieRes, kdramaRes, usShowRes] = await Promise.allSettled([
        tmdb.trendingMoviesDay(1),  // /trending/movie/day — today's #1 movie pool
        tmdb.koreanDramas(1),       // KR origin + drama genre, sorted by live popularity
        tmdb.usTVShows(1),          // US origin TV, sorted by live popularity
      ]);

      const moviesRaw = movieRes.status  === "fulfilled" ? (movieRes.value.results  ?? []).map((m) => ({ ...m, media_type: "movie" })) : [];
      const kdramaRaw = kdramaRes.status === "fulfilled" ? (kdramaRes.value.results ?? []).map((m) => ({ ...m, media_type: "tv" }))    : [];
      const usShowRaw = usShowRes.status === "fulfilled" ? (usShowRes.value.results ?? []).map((m) => ({ ...m, media_type: "tv" }))    : [];

      // Each pool is rotated by a seed that changes at midnight, so which
      // title from that pool leads changes daily — the underlying pool data
      // itself already updates live from TMDB every fetch.
      const pools = [
        rotateArray(moviesRaw, dailyRotationIndex(moviesRaw.length, 1)),
        rotateArray(kdramaRaw, dailyRotationIndex(kdramaRaw.length, 2)),
        rotateArray(usShowRaw, dailyRotationIndex(usShowRaw.length, 3)),
      ];

      // Rotate which pool leads the banner today (Movie/K-Drama/US Show cycle).
      const leadOffset = dailyRotationIndex(pools.length, 0);
      const orderedPools = rotateArray(pools, leadOffset);

      // Interleave Movie → K-Drama → US Show → repeat, so the banner always
      // cycles through content types rather than clustering one type first.
      const interleaved: any[] = [];
      const maxLen = Math.max(...orderedPools.map((p) => p.length));
      for (let i = 0; i < maxLen; i++) {
        for (const pool of orderedPools) {
          if (i < pool.length) interleaved.push(pool[i]);
        }
      }

      const seen = new Set<number>();
      const qualified = interleaved.filter((m) => {
        if (m.id === 155) return false;
        const t = (m.title ?? m.name ?? "").toLowerCase();
        if (t.includes("dark knight")) return false;
        if (!m.backdrop_path || !m.poster_path) return false;
        if (seen.has(m.id)) return false;
        if (!m.overview || m.overview.length < 20) return false;
        if ((m.vote_count ?? 0) < 50) return false;
        if (m.media_type !== "movie" && m.media_type !== "tv") return false;
        seen.add(m.id);
        return true;
      });

      const baseCards = qualified.slice(0, 10).map((m) => toMovieCard(tmdbToCard(m)));
      if (baseCards.length === 0) return;

      // Multi-Asset Rotation: swap in a randomly-selected alt poster/backdrop
      // from TMDB's /images pool for each item so the same title looks fresh
      // across visits instead of always showing the exact same artwork.
      const enriched = await Promise.allSettled(
        baseCards.map(async (card) => {
          const id = (card as any).tmdbId;
          if (!id || typeof id !== "number") return card;
          const mediaType: "movie" | "tv" = (card as any).mediaType ?? "movie";
          const uri = await fetchRandomPosterUri(id, mediaType, null);
          return uri ? ({ ...card, poster: { uri } } as Movie) : card;
        }),
      );

      const heroResult = enriched.map((r, i) => (r.status === "fulfilled" ? r.value : baseCards[i]));
      setHeroMovies(heroResult);
      // Persist hero with 24-hour TTL — banner only re-fetches once per day,
      // not on every app open. Cached result loads instantly on next visit.
      saveHomeCacheTTL(HERO_CACHE_KEY, heroResult).catch(() => {});
    } catch {
      // keep current state on error
    }
  }, []);

  // On tab focus: load cached hero first for instant display, then refresh
  useFocusEffect(
    useCallback(() => {
      checkHasUnread(LATEST_NOTIF_AT).then(setHasUnreadNotifs);
      // Show cached hero immediately; re-fetch only when cache is older than 24 h
      loadHomeCacheTTL<Movie[]>(HERO_CACHE_KEY, 24 * 60 * 60 * 1000).then((fresh) => {
        if (fresh && fresh.length > 0) {
          setHeroMovies(fresh);   // Cache is fresh — skip network fetch
        } else {
          // Cache expired or missing — load stale data first (instant display),
          // then fire a fresh fetch in background
          loadHomeCache<Movie[]>(HERO_CACHE_KEY).then((stale) => {
            if (stale && stale.length > 0) setHeroMovies(stale);
          });
          fetchHero();
        }
      });
    }, [fetchHero]),
  );

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    heroTabRef.current = tab;
    setHeroMovies([]);
    setTimeout(() => fetchHero(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchHero]);

  useEffect(() => {
    // Hero: background refresh every 30 min — more than enough given the
    // 24-hour TTL on the cache. Avoids hammering the API on every session.
    heroRefreshRef.current = setInterval(fetchHero, 30 * 60 * 1000);
    return () => {
      if (heroRefreshRef.current) clearInterval(heroRefreshRef.current);
    };
  }, [fetchHero]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    clearPosterCache();
    // Reset cross-row dedup so a fresh refetch isn't filtered against IDs
    // registered during the previous load.
    seenIds.current.clear();
    await fetchHero();
    // Bumping the key re-triggers every category row's fetch effect, which
    // pulls fresh TMDB data and re-shuffles the display order (weighted by
    // popularity) — see MovieRow / Top10Row.
    setRowRefreshKey((k) => k + 1);
    setRefreshing(false);
  }, [fetchHero]);

  const scrollHandler = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  );

  return (
    <View style={styles.container}>
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        hasUnread={hasUnreadNotifs}
        scrollY={scrollY}
      />

      <Animated.ScrollView
        style={[styles.scroll, { outlineWidth: 0, borderWidth: 0, outlineColor: "transparent" } as any]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#E50914"
            colors={["#E50914"]}
            progressBackgroundColor="#111"
          />
        }
      >
        {/* Background gradient behind hero */}
        <LinearGradient
          colors={[accentTop, accentTop, accentMid, "#000000"]}
          locations={[0, 0.18, 0.45, 0.72]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroGradient}
          pointerEvents="none"
        />

        {/* ── Hero Banner — untouched ── */}
        <StableHero movies={heroMovies} refreshing={refreshing} />

        {/* ── Category rows — driven by lib/categoryMap.ts ── */}
        {HOME_CATEGORIES.map((cat, index) => {
          const loadDelay = index * ROW_LOAD_STAGGER_MS;

          // ── Personalised "Top Picks For You" row — injected after
          // "Because you liked" (index 8) once prefs are ready ──────────────
          const personalRow = (index === 8 && prefsReady) ? (
            <MovieRow
              key="__topPicksForYou__"
              title={personalRowTitle}
              movies={[]}
              tmdbFetcher={personalFetcher}
              loadDelay={loadDelay + ROW_LOAD_STAGGER_MS}
              seenIds={seenIds}
              refreshKey={rowRefreshKey}
              imageMode={personalImageMode}
            />
          ) : null;

          if (cat.kind === "special") {
            const specialEl = (() => {
              switch (cat.key) {
                case "continueWatching":
                  return <ContinueWatchingRow key={cat.key} />;
                case "myList":
                  return <MyListRow key={cat.key} />;
                default:
                  return null;
              }
            })();
            return (
              <React.Fragment key={cat.key}>
                {personalRow}
                {specialEl}
              </React.Fragment>
            );
          }

          if (cat.kind === "top10") {
            return (
              <React.Fragment key={cat.title}>
                {personalRow}
                <Top10Row
                  title={cat.title}
                  movies={[]}
                  tmdbFetcher={cat.fetcher}
                  loadDelay={loadDelay}
                  refreshKey={rowRefreshKey}
                />
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={cat.title}>
              {personalRow}
              <MovieRow
                title={cat.title}
                movies={[]}
                tmdbFetcher={cat.fetcher}
                loadDelay={loadDelay}
                seenIds={seenIds}
                refreshKey={rowRefreshKey}
                imageMode={cat.imageMode}
              />
            </React.Fragment>
          );
        })}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#000000" },
  heroGradient:  { position: "absolute", top: 0, left: 0, right: 0, height: 720 },
  scroll:        { flex: 1, backgroundColor: "#000000" },
  scrollContent: { paddingBottom: 100 },
});
