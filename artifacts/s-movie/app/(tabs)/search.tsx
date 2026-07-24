import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons } from "@expo/vector-icons";
import SmartImage from "@/components/SmartImage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { tmdb, tmdbToCard, type TMDBMovie } from "@/lib/tmdb";
import { ALL_MOVIES } from "@/data/movies";
import { GENRE_GROUPS, type GenreGroup } from "@/lib/genreData";

const { width: SCREEN_W } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const CARD_GAP = 8;
const CARD_W = (SCREEN_W - 32 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_H = Math.round(CARD_W * 1.5);

const HISTORY_KEY = "@smovie_search_history_tab";
const MAX_HISTORY = 12;

type Filter = "All" | "Movies" | "TV Shows";

// Genre grid card dimensions — 2 columns, tappable colored cards
const GENRE_COLS = 2;
const GENRE_GAP = 10;
const GENRE_CARD_W = (SCREEN_W - 32 - GENRE_GAP) / GENRE_COLS;
const GENRE_CARD_H = 56;

// ─── Genre group card ─────────────────────────────────────────
function GenreGroupCard({ group, onPress }: { group: GenreGroup; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        gc.card,
        { width: GENRE_CARD_W, height: GENRE_CARD_H },
        pressed && { opacity: 0.78, transform: [{ scale: 0.96 }] },
      ]}
    >
      <LinearGradient
        colors={group.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={gc.label} numberOfLines={2}>{group.label}</Text>
    </Pressable>
  );
}

const gc = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  emoji: { fontSize: 22 },
  label: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
    lineHeight: 17,
  },
});

// Legacy small chips kept for genre-in-search-results drilldown
interface GenreDef {
  label: string;
  type: "movie" | "tv";
  genreId?: number;
  special?: "kdrama" | "anime" | "bollywood" | "trending";
}

const GENRES: GenreDef[] = [
  { label: "Trending",    type: "movie", special: "trending" },
  { label: "Action",      type: "movie", genreId: 28 },
  { label: "Horror",      type: "movie", genreId: 27 },
  { label: "Comedy",      type: "movie", genreId: 35 },
  { label: "K-Drama",     type: "tv",    special: "kdrama" },
  { label: "Romance",     type: "movie", genreId: 10749 },
  { label: "Sci-Fi",      type: "movie", genreId: 878 },
  { label: "Thriller",    type: "movie", genreId: 53 },
  { label: "Crime",       type: "movie", genreId: 80 },
  { label: "Anime",       type: "tv",    special: "anime" },
  { label: "Documentary", type: "movie", genreId: 99 },
  { label: "Bollywood",   type: "movie", special: "bollywood" },
];

interface SearchResult {
  id: string;
  tmdbId?: number;
  title: string;
  poster: { uri: string } | null;
  year: number;
  rating: number;
  mediaType: "movie" | "tv";
  genres: string[];
}

function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => { if (raw) setHistory(JSON.parse(raw)); }).catch(() => {});
  }, []);
  const add = useCallback(async (q: string) => {
    const t = q.trim();
    if (!t) return;
    setHistory((prev) => {
      const next = [t, ...prev.filter((h) => h.toLowerCase() !== t.toLowerCase())].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const remove = useCallback((q: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== q);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    setHistory([]);
    AsyncStorage.removeItem(HISTORY_KEY).catch(() => {});
  }, []);
  return { history, add, remove, clear };
}

function tmdbResultToItem(m: TMDBMovie): SearchResult {
  const card = tmdbToCard(m);
  return { id: card.id, tmdbId: card.tmdbId, title: card.title, poster: card.poster, year: card.year, rating: card.tmdbRating, mediaType: card.mediaType, genres: card.genres };
}

function staticFallback(q: string, filter: Filter): SearchResult[] {
  const lq = q.toLowerCase();
  return ALL_MOVIES
    .filter((m) => {
      const match = [m.title, ...m.genres, ...m.cast, m.director].join(" ").toLowerCase().includes(lq);
      if (!match) return false;
      if (filter === "Movies") return !(m as any).mediaType || (m as any).mediaType === "movie";
      if (filter === "TV Shows") return (m as any).mediaType === "tv" || Boolean(m.episodes?.length);
      return true;
    })
    .map((m) => ({ id: m.id, title: m.title, poster: m.poster as { uri: string } | null, year: m.year, rating: (m as any).tmdbRating ?? 0, mediaType: ((m as any).mediaType ?? "movie") as "movie" | "tv", genres: m.genres }));
}

function useTrending() {
  const [movies, setMovies] = useState<SearchResult[]>([]);
  const [tvShows, setTvShows] = useState<SearchResult[]>([]);
  useEffect(() => {
    tmdb.trendingMovies(1).then((d) => setMovies(d.results.slice(0, 10).map(tmdbResultToItem))).catch(() => {});
    tmdb.trendingTV(1).then((d) => setTvShows(d.results.slice(0, 10).map(tmdbResultToItem))).catch(() => {});
  }, []);
  return { movies, tvShows };
}

export default function SearchTabScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tmdbPage, setTmdbPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<GenreDef | null>(null);
  const [genreResults, setGenreResults] = useState<SearchResult[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genrePage, setGenrePage] = useState(1);
  const [genreTotalPages, setGenreTotalPages] = useState(1);
  const [genreLoadingMore, setGenreLoadingMore] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQuery  = useRef("");
  const inputRef     = useRef<TextInput>(null);

  const { movies: trendingMovies, tvShows: trendingTV } = useTrending();
  const { history, add: addHistory, remove: removeHistory, clear: clearHistory } = useSearchHistory();

  const searchTMDB = useCallback(async (q: string, f: Filter, page = 1, append = false) => {
    if (!q.trim()) return;
    if (!append) setLoading(true); else setLoadingMore(true);
    try {
      const data = await tmdb.search(q.trim(), page);
      const items = data.results
        .filter((m) => {
          if (!m.poster_path) return false;
          if (f === "Movies") return m.media_type !== "tv" && !m.name;
          if (f === "TV Shows") return m.media_type === "tv" || Boolean(m.name);
          return true;
        })
        .map(tmdbResultToItem);
      if (q !== latestQuery.current) return;
      setResults((prev) => {
        if (!append) return items;
        const ids = new Set(prev.map((r) => r.id));
        return [...prev, ...items.filter((r) => !ids.has(r.id))];
      });
      setTmdbPage(page);
      setTotalPages(data.total_pages);
    } catch {
      if (!append && q === latestQuery.current) setResults(staticFallback(q, f));
    } finally {
      if (!append) setLoading(false); else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    latestQuery.current = query;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => searchTMDB(query, filter, 1, false), 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, filter, searchTMDB]);

  const loadNextPage = useCallback(() => {
    if (loadingMore || loading || !query.trim() || tmdbPage >= totalPages) return;
    searchTMDB(query, filter, tmdbPage + 1, true);
  }, [loadingMore, loading, query, filter, tmdbPage, totalPages, searchTMDB]);

  const fetchByGenre = useCallback(async (genre: GenreDef, page = 1, append = false) => {
    if (!append) setGenreLoading(true); else setGenreLoadingMore(true);
    try {
      let data;
      if (genre.special === "trending")   data = await tmdb.trendingToday(page);
      else if (genre.special === "kdrama") data = await tmdb.koreanDramas(page);
      else if (genre.special === "anime")  data = await tmdb.discover("tv", 16, page);
      else if (genre.special === "bollywood") data = await tmdb.discover("movie", 28, page);
      else if (genre.genreId)              data = await tmdb.discover(genre.type, genre.genreId, page);
      else return;
      const items = (data.results as any[]).filter((m: any) => m.poster_path).map((m: any) => tmdbResultToItem(m));
      setGenreResults((prev) => {
        if (!append) return items;
        const ids = new Set(prev.map((r) => r.id));
        return [...prev, ...items.filter((r) => !ids.has(r.id))];
      });
      setGenrePage(page);
      setGenreTotalPages(data.total_pages ?? 1);
    } catch { } finally {
      if (!append) setGenreLoading(false); else setGenreLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedGenre) { setGenreResults([]); return; }
    fetchByGenre(selectedGenre, 1, false);
  }, [selectedGenre, fetchByGenre]);

  const loadNextGenrePage = useCallback(() => {
    if (!selectedGenre || genreLoadingMore || genreLoading || genrePage >= genreTotalPages) return;
    fetchByGenre(selectedGenre, genrePage + 1, true);
  }, [selectedGenre, genreLoadingMore, genreLoading, genrePage, genreTotalPages, fetchByGenre]);

  const onPressResult = (item: SearchResult) => {
    addHistory(item.title);
    router.push({
      pathname: "/movie/[id]",
      params: {
        id: item.id,
        type: item.mediaType,
        poster_path: item.poster?.uri ?? "",
        title_param: item.title ?? "",
      },
    });
  };

  // ── Grid card — clean poster only, no text/ratings per spec ─────
  const renderGridItem = ({ item }: { item: SearchResult }) => {
    return (
      <Pressable
        onPress={() => onPressResult(item)}
        style={({ pressed }) => [st.gridCard, pressed && { opacity: 0.78, transform: [{ scale: 0.96 }] }]}
      >
        {item.poster?.uri ? (
          <SmartImage source={{ uri: item.poster.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="disk" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111", alignItems: "center", justifyContent: "center" }]}>
            <Feather name="film" size={22} color="#2a2a2a" />
          </View>
        )}
      </Pressable>
    );
  };

  // ── Recommended row — 16:9 landscape thumbnail + title + circular play ──
  // NO ratings shown per spec ("Do NOT show any star ratings")
  const renderTrendingRow = (item: SearchResult) => (
    <Pressable
      key={item.id}
      onPress={() => onPressResult(item)}
      style={({ pressed }) => [st.trendRow, pressed && { backgroundColor: "#111" }]}
    >
      {/* 16:9 landscape backdrop thumbnail */}
      <View style={st.trendThumb}>
        {item.poster?.uri ? (
          <SmartImage source={{ uri: item.poster.uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" }]}>
            <Feather name="film" size={16} color="#333" />
          </View>
        )}
      </View>
      {/* Title — no rating, no year, no media type pill */}
      <Text style={st.trendTitle} numberOfLines={2}>{item.title}</Text>
      {/* Circular play button — right aligned */}
      <View style={st.playCircle}>
        <Feather name="play" size={16} color="#fff" />
      </View>
    </Pressable>
  );

  // ── Idle state (no query) ─────────────────────────────────────────
  const EmptyState = (
    <View>
      {/* Recent searches — chip style */}
      {history.length > 0 && (
        <View style={st.section}>
          <View style={st.sectionHead}>
            <View style={st.sectionLeft}>
              <Feather name="clock" size={14} color="#737373" />
              <Text style={st.sectionTitle}>Recent Searches</Text>
            </View>
            <Pressable onPress={clearHistory} hitSlop={8}><Text style={st.clearAll}>Clear all</Text></Pressable>
          </View>
          <View style={st.recentChips}>
            {history.map((term) => (
              <View key={term} style={st.recentChip}>
                <Pressable
                  onPress={() => { setQuery(term); inputRef.current?.focus(); }}
                  style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                >
                  <Text style={st.recentChipText} numberOfLines={1}>{term}</Text>
                </Pressable>
                <Pressable onPress={() => removeHistory(term)} hitSlop={10}>
                  <Feather name="x" size={11} color="#666" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recommended Shows & Movies — merged list, NO ratings per spec */}
      {(trendingMovies.length > 0 || trendingTV.length > 0) && (
        <View style={st.section}>
          <Text style={st.sectionTitle2}>Recommended Shows &amp; Movies</Text>
          {[...trendingTV.slice(0, 6), ...trendingMovies.slice(0, 6)]
            .filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i)
            .slice(0, 12)
            .map(renderTrendingRow)}
        </View>
      )}
      <View style={{ height: 100 }} />
    </View>
  );

  const isSearching = query.trim().length > 0;
  const isGenreBrowsing = !isSearching && selectedGenre !== null;

  return (
    <View style={st.root}>
      <SafeAreaView style={st.safe} edges={["top"]}>

        {/* ── Search bar — search icon left, mic/X icon right ────── */}
        <View style={st.searchBarWrap}>
          <View style={[st.searchBar, query.length > 0 && st.searchBarActive]}>
            <Feather name="search" size={19} color={query.length > 0 ? "#e5e5e5" : "#666"} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => { if (query.trim()) addHistory(query.trim()); }}
              placeholder="Search shows, movies, game..."
              placeholderTextColor="#555"
              style={st.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="never"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={12}>
                <View style={st.clearBtn}>
                  <Feather name="x" size={13} color="#999" />
                </View>
              </Pressable>
            ) : (
              <Pressable onPress={() => inputRef.current?.focus()} hitSlop={12} style={st.micBtn}>
                <Feather name="mic" size={17} color="#666" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Filter chips (shown while searching) ────────────────── */}
        {isSearching && (
          <View style={st.filterRow}>
            {(["All", "Movies", "TV Shows"] as Filter[]).map((f) => (
              <Pressable key={f} onPress={() => setFilter(f)} style={[st.filterChip, filter === f && st.filterChipOn]}>
                <Text style={[st.filterChipText, filter === f && st.filterChipTextOn]}>{f}</Text>
              </Pressable>
            ))}
            {loading && <ActivityIndicator size="small" color="#737373" style={{ marginLeft: 4 }} />}
          </View>
        )}

        {/* ── Content area ─────────────────────────────────────────── */}
        {isGenreBrowsing ? (
          genreLoading ? (
            <View style={st.skeletonGrid}>
              {Array.from({ length: 9 }).map((_, i) => <View key={i} style={st.skeletonCard} />)}
            </View>
          ) : (
            <FlatList
              data={genreResults}
              keyExtractor={(r) => r.id}
              renderItem={renderGridItem}
              numColumns={NUM_COLUMNS}
              contentContainerStyle={st.gridContent}
              keyboardShouldPersistTaps="handled"
              onEndReached={loadNextGenrePage}
              onEndReachedThreshold={0.4}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 }}>
                  <Text style={{ flex: 1, color: "#e5e5e5", fontSize: 16, fontFamily: "Inter_700Bold" }}>{selectedGenre?.label}</Text>
                  <Pressable onPress={() => setSelectedGenre(null)} hitSlop={10}>
                    <Feather name="x" size={16} color="#525252" />
                  </Pressable>
                </View>
              }
              ListFooterComponent={genreLoadingMore ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 }}>
                  <ActivityIndicator size="small" color="#E50914" />
                  <Text style={{ color: "#525252", fontSize: 13, fontFamily: "Inter_500Medium" }}>Loading more…</Text>
                </View>
              ) : null}
            />
          )
        ) : !isSearching ? (
          <FlatList
            data={[]}
            renderItem={null}
            keyExtractor={() => "k"}
            ListHeaderComponent={EmptyState}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        ) : loading && results.length === 0 ? (
          <View style={st.skeletonGrid}>
            {Array.from({ length: 9 }).map((_, i) => <View key={i} style={st.skeletonCard} />)}
          </View>
        ) : results.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 }}>
            <Feather name="search" size={42} color="#1f1f1f" />
            <Text style={{ color: "#737373", fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>No results for "{query}"</Text>
            <Text style={{ color: "#333", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" }}>Try a different title, actor or genre</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(r) => r.id}
            renderItem={renderGridItem}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={st.gridContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={loadNextPage}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={{ color: "#404040", fontSize: 11, fontFamily: "Inter_500Medium", paddingVertical: 10, letterSpacing: 0.3 }}>
                {results.length}+ results for "{query}"
              </Text>
            }
            ListFooterComponent={loadingMore ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 }}>
                <ActivityIndicator size="small" color="#E50914" />
                <Text style={{ color: "#525252", fontSize: 13, fontFamily: "Inter_500Medium" }}>Loading more…</Text>
              </View>
            ) : null}
          />
        )}

      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  safe: { flex: 1 },

  searchBarWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 11,
  },
  searchBarActive: { backgroundColor: "#222222" },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  filterChipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  filterChipText: { color: "#737373", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterChipTextOn: { color: "#000" },

  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  skeletonCard: {
    flex: 1,
    aspectRatio: 2 / 3,
    margin: 3,
    borderRadius: 4,
    backgroundColor: "#111",
  },

  // Grid — pure poster images, flex:1 + aspectRatio:2/3 for equal sizing, NO text/ratings
  gridContent: { paddingHorizontal: 4, paddingBottom: 100 },
  gridCard: {
    flex: 1,
    aspectRatio: 2 / 3,
    margin: 3,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#0d0d0d",
  },

  section: { marginTop: 20 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitle: { color: "#e5e5e5", fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionTitle2: { color: "#e5e5e5", fontSize: 15, fontFamily: "Inter_700Bold", paddingHorizontal: 16, marginBottom: 10 },
  clearAll: { color: "#737373", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Recent searches chips
  recentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    paddingVertical: 7,
    paddingLeft: 14,
    paddingRight: 10,
  },
  recentChipText: {
    color: "#d4d4d4",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    maxWidth: 160,
  },

  // Recommended row — 16:9 landscape thumb + title + circular play button, NO ratings
  trendRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 14, borderRadius: 6 },
  trendThumb: { width: 120, height: 68, borderRadius: 6, backgroundColor: "#111", overflow: "hidden" },
  trendTitle: { flex: 1, color: "#e5e5e5", fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 19 },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  chipActive: { backgroundColor: "#E50914", borderColor: "#E50914" },
  chipText: { color: "#a3a3a3", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chipTextActive: { color: "#fff" },
});
