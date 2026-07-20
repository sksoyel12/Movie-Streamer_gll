import { Ionicons } from "@expo/vector-icons";
import SmartImage from "@/components/SmartImage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptic } from "@/lib/haptics";
import { tmdb, tmdbGet, tmdbToCard, type TMDBMovie } from "@/lib/tmdb";
import HindiBadge from "@/components/HindiBadge";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NEW_HOT_CACHE_KEY = "smovie_new_hot_v3";
const NEW_HOT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes — keep fresh

const { width: SCREEN_W } = Dimensions.get("window");
const BANNER_H = Math.round(SCREEN_W * 0.555);

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// ─── Blacklist ────────────────────────────────────────────────────────────────
function isBlacklisted(item: any): boolean {
  return item?.tmdbId === 155 || item?.id === 155 || item?.title === "The Dark Knight";
}

// ─── Image helpers ────────────────────────────────────────────────────────────
function wrapProxy(directUrl: string): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(directUrl)}&output=webp&q=85`;
}

function ensureProxy(uri: string | null | undefined, size = "w780"): string | null {
  if (!uri || typeof uri !== "string") return null;
  if (uri.includes("weserv.nl") || uri.includes("wsrv.nl")) {
    const match = uri.match(/[?&]url=([^&]+)/);
    if (match) {
      try {
        const inner = decodeURIComponent(match[1]);
        if (inner.includes("image.tmdb.org/t/p/")) {
          return wrapProxy(inner.replace(/\/t\/p\/\w+\//, `/t/p/${size}/`));
        }
      } catch {}
    }
    return uri;
  }
  if (uri.includes("image.tmdb.org/t/p/")) {
    return wrapProxy(uri.replace(/\/t\/p\/\w+\//, `/t/p/${size}/`));
  }
  if (uri.startsWith("/")) {
    return wrapProxy(`https://image.tmdb.org/t/p/${size}${uri}`);
  }
  if (uri.startsWith("http://")) return uri.replace("http://", "https://");
  return uri;
}

// ─── Logo fetcher ─────────────────────────────────────────────────────────────
async function fetchLogoUri(tmdbId: number, mediaType: "movie" | "tv"): Promise<string | null> {
  try {
    const data = await tmdbGet<{
      logos?: Array<{ file_path: string; iso_639_1: string | null; vote_average: number }>;
    }>(`/${mediaType}/${tmdbId}/images`, { include_image_language: "en,hi" });
    const logos = data.logos ?? [];
    if (logos.length === 0) return null;
    const sorted = [...logos].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
    return wrapProxy(`https://image.tmdb.org/t/p/w500${sorted[0].file_path}`);
  } catch {
    return null;
  }
}

type Tab = "comingSoon" | "everyonesWatching";

// NOTE: This screen intentionally does NOT embed a live YouTube player.
// YouTube's own "click to play" preview card (channel avatar, title, YT
// watermark) leaks through the iframe before autoplay starts and cannot be
// reliably suppressed. Instead we show the static TMDB/IMDb teaser artwork
// (backdrop or poster) for each title — no embedded video playback here.

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function NewAndHotScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 12) : insets.top;

  const [activeTab, setActiveTab]   = useState<Tab>("comingSoon");
  const [reminders, setReminders]   = useState<Set<string>>(new Set());
  const [upcoming, setUpcoming]     = useState<any[]>([]);
  const [trending, setTrending]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 2200);
  };

  // Load cached data immediately so the screen never starts blank
  useEffect(() => {
    AsyncStorage.getItem(NEW_HOT_CACHE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const { upcoming: u, trending: t, savedAt } = JSON.parse(raw);
        if (u?.length) setUpcoming(u);
        if (t?.length) setTrending(t);
        // If cache is fresh enough, skip the network fetch
        if (Date.now() - savedAt < NEW_HOT_CACHE_TTL) setLoading(false);
      } catch {}
    }).catch(() => {});
  }, []);

  const fetchData = async (isRefresh = false) => {
    setError(null);
    try {
      // Fetch all 4 required sources in parallel
      const [upcomingMovies, tvPopular, trendingDay, trendingWeek] = await Promise.all([
        tmdb.upcoming(1),
        tmdb.popularTV(1),
        tmdb.trendingToday(1),
        tmdb.trending(1),
      ]);

      // ── Coming Soon: upcoming movies + popular TV (sorted by nearest date)
      const movieCards = upcomingMovies.results
        .filter((m) => m.poster_path || m.backdrop_path)
        .map((m) => ({ ...tmdbToCard(m as TMDBMovie), releaseDate: m.release_date ?? (m as any).first_air_date }));

      const tvCards = tvPopular.results
        .filter((m) => m.poster_path || m.backdrop_path)
        .map((m) => ({ ...tmdbToCard(m as TMDBMovie), releaseDate: (m as any).first_air_date ?? m.release_date }));

      // Only show movies releasing from today or in the future
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const seenCS = new Set<string>();
      const mergedCS = [...movieCards, ...tvCards]
        .filter((m) => {
          if (isBlacklisted(m)) return false;
          if (seenCS.has(m.id)) return false;
          // Skip movies that have already released (past dates)
          const rd = m.releaseDate ? new Date(m.releaseDate) : null;
          if (rd && rd.getTime() < todayStart.getTime()) return false;
          seenCS.add(m.id);
          return true;
        })
        .sort((a, b) => {
          const dA = new Date(a.releaseDate ?? "2100-01-01").getTime();
          const dB = new Date(b.releaseDate ?? "2100-01-01").getTime();
          return dA - dB;
        });

      const upcomingList = mergedCS.slice(0, 20);
      setUpcoming(upcomingList);

      // ── Everyone's Watching: trending/day + trending/week merged & deduped
      const seenEW = new Set<string>();
      const trendingList = [...trendingDay.results, ...trendingWeek.results]
        .filter((m) => {
          if (isBlacklisted(m)) return false;
          const key = String(m.id);
          if (seenEW.has(key)) return false;
          seenEW.add(key);
          return true;
        })
        .map(tmdbToCard)
        .slice(0, 20);
      setTrending(trendingList);

      // Persist to cache
      await AsyncStorage.setItem(NEW_HOT_CACHE_KEY, JSON.stringify({
        upcoming: upcomingList,
        trending: trendingList,
        savedAt: Date.now(),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[NewHot] fetchData error:", msg);
      setError("Couldn't load content. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 minutes to keep Coming Soon & Everyone's Watching live
    const interval = setInterval(() => fetchData(), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => { setRefreshing(true); fetchData(true); };

  const toggleReminder = (m: any) => {
    haptic.selection();
    setReminders((prev) => {
      const next = new Set(prev);
      if (next.has(m.id)) { next.delete(m.id); showToast("Reminder removed"); }
      else                { next.add(m.id);    showToast("🔔 Reminder set!"); }
      return next;
    });
  };

  const items = activeTab === "comingSoon" ? upcoming : trending.slice(0, 20);

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      if (activeTab === "comingSoon") {
        return (
          <ComingSoonCard
            m={item}
            reminded={reminders.has(item.id)}
            onRemind={() => toggleReminder(item)}
          />
        );
      }
      return (
        <EveryonesWatchingCard
          m={item}
          rank={index + 1}
        />
      );
    },
    [activeTab, reminders],
  );

  return (
    <View style={styles.container}>
      {/* ─── Sticky header ─────────────────────────────────────────────── */}
      <View style={[styles.stickyHeader, { paddingTop: topPad + 14 }]}>
        <Text style={styles.pageTitle}>New & Hot</Text>
        <View style={styles.tabPills}>
          <Pressable
            onPress={() => { haptic.selection(); setActiveTab("comingSoon"); }}
            style={[styles.tabPill, activeTab === "comingSoon" && styles.tabPillActive]}
          >
            <Text style={[styles.tabPillText, activeTab === "comingSoon" && styles.tabPillTextActive]}>
              🍿 Coming Soon
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { haptic.selection(); setActiveTab("everyonesWatching"); }}
            style={[styles.tabPill, activeTab === "everyonesWatching" && styles.tabPillActive]}
          >
            <Text style={[styles.tabPillText, activeTab === "everyonesWatching" && styles.tabPillTextActive]}>
              🔥 Everyone's Watching
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        // ── Skeleton ──────────────────────────────────────────────────────────
        <FlatList
          key="skeleton"
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={styles.scrollContent}
          renderItem={() => (
            <View style={styles.cardSkeleton}>
              <View style={[styles.skeletonBlock, { width: 44, height: 44, borderRadius: 6, marginBottom: 12 }]} />
              <View style={[styles.skeletonBlock, { width: "100%", height: BANNER_H, borderRadius: 8 }]} />
              <View style={[styles.skeletonBlock, { width: "50%", height: 28, marginTop: 14 }]} />
              <View style={[styles.skeletonBlock, { width: "100%", height: 48, marginTop: 10 }]} />
              <View style={[styles.skeletonBlock, { width: 140, height: 40, borderRadius: 22, marginTop: 14 }]} />
            </View>
          )}
        />
      ) : (
        // ── Live feed — FlatList with viewability tracking ─────────────────────
        <FlatList
          key="live"
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews
          maxToRenderPerBatch={3}
          windowSize={5}
          initialNumToRender={2}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#E50914"
              colors={["#E50914"]}
            />
          }
          ListFooterComponent={<View style={{ height: 80 }} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {error ? (
                <>
                  <Ionicons name="cloud-offline-outline" size={44} color="#E50914" />
                  <Text style={styles.emptyTitle}>Couldn't load content</Text>
                  <Text style={styles.emptyBody}>{error}</Text>
                  <Pressable onPress={() => { setLoading(true); fetchData(); }} style={styles.retryBtn}>
                    <Text style={styles.retryBtnText}>Try Again</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Ionicons name="film-outline" size={44} color="#333" />
                  <Text style={styles.emptyTitle}>Nothing to show yet</Text>
                  <Text style={styles.emptyBody}>Pull down to refresh</Text>
                </>
              )}
            </View>
          }
        />
      )}

      {/* ── Toast notification ───────────────────────────────────────────── */}
      {toast.visible && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Friendly date helper ─────────────────────────────────────────────────────
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function getFriendlyDate(releaseDate?: string): string {
  if (!releaseDate) return "";
  const rd = new Date(releaseDate);
  rd.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((rd.getTime() - today.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Available Now";
  if (diffDays === 1) return "Coming Tomorrow";
  if (diffDays <= 6) return `Coming on ${WEEKDAYS[rd.getDay()]}`;
  return `Coming ${MONTHS[rd.getMonth()]} ${rd.getDate()}`;
}

// ─── Coming Soon card — Netflix style ─────────────────────────────────────────
function ComingSoonCard({
  m, reminded, onRemind,
}: {
  m: any; reminded: boolean; onRemind: () => void;
}) {
  const [logoUri, setLogoUri]         = useState<string | null>(null);
  const logoFetched    = useRef(false);

  useEffect(() => {
    if (logoFetched.current) return;
    logoFetched.current = true;
    fetchLogoUri(m.tmdbId, m.mediaType ?? "movie").then(setLogoUri);
  }, [m.tmdbId, m.mediaType]);

  const heroUri   = ensureProxy((m.hero   as { uri?: string })?.uri, "w780");
  const posterUri = ensureProxy((m.poster as { uri?: string })?.uri, "w500");
  const bannerUri = heroUri ?? posterUri;
  const friendlyDate = getFriendlyDate(m.releaseDate);

  return (
    <View style={styles.comingCard}>
      {/* ── Full-width static TMDB/IMDb teaser artwork (no embedded video) ── */}
      <View style={[styles.bannerWrap, { height: BANNER_H }]}>
        {bannerUri ? (
          <SmartImage
            source={{ uri: bannerUri }}
            style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            recyclingKey={`cs-${m.id}`}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.bannerPlaceholder]}>
            <Ionicons name="film-outline" size={40} color="#333" />
          </View>
        )}

        {/* Hindi badge — only rendered when TMDB confirms Hindi audio exists */}
        <HindiBadge
          tmdbId={m.tmdbId}
          mediaType={m.mediaType ?? "movie"}
          style={styles.hindiBadge}
          textStyle={styles.hindiBadgeText}
        />
      </View>

      {/* ── Content below banner ── */}
      <View style={styles.comingContent}>
        {/* Logo or title */}
        {logoUri ? (
          <SmartImage
            source={{ uri: logoUri }}
            style={styles.logoImg}
            contentFit="contain"
            transition={300}
            cachePolicy="memory-disk"
            recyclingKey={`cs-logo-${m.id}`}
          />
        ) : (
          <Text style={styles.fallbackTitle} numberOfLines={2}>{m.title}</Text>
        )}

        {/* Friendly date */}
        {!!friendlyDate && (
          <Text style={styles.friendlyDateText}>{friendlyDate}</Text>
        )}

        {/* Synopsis */}
        <Text style={styles.synopsis} numberOfLines={4}>{m.synopsis}</Text>

        {/* Full-width Remind Me */}
        <Pressable
          onPress={onRemind}
          style={({ pressed }) => [styles.remindBtnFull, reminded && styles.remindBtnFullActive, pressed && { opacity: 0.85 }]}
        >
          <Ionicons
            name={reminded ? "notifications" : "notifications-outline"}
            size={18}
            color={reminded ? "#fff" : "#000"}
          />
          <Text style={[styles.remindBtnFullText, reminded && { color: "#fff" }]}>
            {reminded ? "Reminder Set" : "Remind Me"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Everyone's Watching card ─────────────────────────────────────────────────
function EveryonesWatchingCard({
  m, rank,
}: {
  m: any; rank: number;
}) {
  const [logoUri, setLogoUri]         = useState<string | null>(null);
  const logoFetched    = useRef(false);

  useEffect(() => {
    if (logoFetched.current) return;
    logoFetched.current = true;
    fetchLogoUri(m.tmdbId, m.mediaType ?? "tv").then(setLogoUri);
  }, [m.tmdbId, m.mediaType]);

  const heroUri   = ensureProxy((m.hero  as { uri?: string })?.uri, "w780");
  const posterUri = ensureProxy((m.poster as { uri?: string })?.uri, "w500");
  const bannerUri = heroUri ?? posterUri;

  return (
    <View style={styles.ewCard}>
      {/* ── Full-width static TMDB/IMDb teaser artwork (no embedded video) ── */}
      <View style={[styles.bannerWrap, { height: BANNER_H }]}>
        {/* Static backdrop */}
        {bannerUri ? (
          <SmartImage
            source={{ uri: bannerUri }}
            style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
            contentFit="cover"
            transition={350}
            cachePolicy="memory-disk"
            recyclingKey={`ew-${m.id}`}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.bannerPlaceholder]}>
            <Ionicons name="film-outline" size={40} color="#333" />
          </View>
        )}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Rank overlay — bottom-left */}
        <View style={styles.rankOverlay}>
          <Text style={styles.rankNum}>#{rank}</Text>
          <Text style={styles.rankLabel}>in India Today</Text>
        </View>

        {/* Hindi badge — only rendered when TMDB confirms Hindi audio exists */}
        <HindiBadge
          tmdbId={m.tmdbId}
          mediaType={m.mediaType ?? "tv"}
          style={styles.hindiBadge}
          textStyle={styles.hindiBadgeText}
        />
      </View>

      {/* ── Logo or title ── */}
      {logoUri ? (
        <SmartImage
          source={{ uri: logoUri }}
          style={styles.logoImg}
          contentFit="contain"
          transition={300}
          cachePolicy="memory-disk"
          recyclingKey={`ew-logo-${m.id}`}
        />
      ) : (
        <Text style={styles.fallbackTitle} numberOfLines={2}>{m.title}</Text>
      )}

      {/* ── Description ── */}
      <Text style={styles.synopsis} numberOfLines={3}>{m.synopsis}</Text>

      {/* ── Action row: Play + More Info ── */}
      <View style={styles.cardActionRow}>
        <Pressable
          onPress={() => { haptic.medium(); router.push({ pathname: "/movie/[id]", params: { id: m.id, type: m.mediaType ?? "tv" } }); }}
          style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="play" size={18} color="#000" />
          <Text style={styles.playBtnText}>Play</Text>
        </Pressable>

        <Pressable
          onPress={() => { haptic.light(); router.push({ pathname: "/movie/[id]", params: { id: m.id, type: m.mediaType ?? "tv", title_param: m.title } }); }}
          style={({ pressed }) => [styles.infoBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="information-circle-outline" size={22} color="#fff" />
          <Text style={styles.infoBtnText}>Info</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#000" },

  stickyHeader: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingBottom: 14,
    zIndex: 10,
  },
  pageTitle: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 14,
  },

  tabPills:          { flexDirection: "row", gap: 8 },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  tabPillActive:     { backgroundColor: "#fff", borderColor: "#fff" },
  tabPillText:       { color: "#737373", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabPillTextActive: { color: "#000" },

  scrollContent: { paddingTop: 8, paddingBottom: 20 },

  // ─── Coming Soon card — Netflix style ───────────────────────────────────────
  comingCard: {
    marginBottom: 28,
    marginHorizontal: 14,
    backgroundColor: "#141414",
    borderRadius: 10,
    // no overflow clipping here — lets the video frame below break out to
    // full screen width via bannerWrap's negative horizontal margin
  },
  comingContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  friendlyDateText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginTop: 6,
    marginBottom: 2,
  },
  remindBtnFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E0E0E0",
    paddingVertical: 12,
    borderRadius: 6,
    marginTop: 14,
  },
  remindBtnFullActive: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#444",
  },
  remindBtnFullText: { color: "#000", fontSize: 14, fontFamily: "Inter_700Bold" },
  netflixPlayCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  // ─── Everyone's Watching card ───────────────────────────────────────────────
  ewCard: {
    marginBottom: 40,
    paddingHorizontal: 14,
  },

  // ─── Shared video frame — full screen width, no horizontal margins ────────
  bannerWrap: {
    marginHorizontal: -14, // cancels the parent card's horizontal inset
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#111",
    position: "relative",
  },
  bannerPlaceholder: {
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  comingBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(229,9,20,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 2,
  },
  comingBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
  },
  hindiBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 3,
  },
  hindiBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  trailerPlayBtn: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  muteBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  rankOverlay: {
    position: "absolute",
    bottom: 10,
    left: 12,
    zIndex: 2,
  },
  rankNum: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  rankLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },

  // ─── Logo / title ──────────────────────────────────────────────────────────
  logoImg: {
    width: "70%",
    height: 52,
    marginTop: 14,
    marginBottom: 2,
  },
  fallbackTitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: -0.5,
    marginTop: 14,
    marginBottom: 2,
  },

  // ─── Synopsis ──────────────────────────────────────────────────────────────
  synopsis: {
    color: "#CCCCCC",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 10,
  },

  // ─── Card action row ────────────────────────────────────────────────────────
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },

  // ─── Remind Me button ──────────────────────────────────────────────────────
  remindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  remindBtnActive: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#444",
  },
  remindBtnText:       { color: "#000", fontSize: 14, fontFamily: "Inter_700Bold" },
  remindBtnTextActive: { color: "#fff" },

  // ─── Info button ────────────────────────────────────────────────────────────
  infoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  infoBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },

  // ─── Play button ────────────────────────────────────────────────────────────
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
  },
  playBtnText: { color: "#000", fontSize: 14, fontFamily: "Inter_700Bold" },

  // ─── Skeleton loader ────────────────────────────────────────────────────────
  cardSkeleton: {
    paddingHorizontal: 14,
    marginBottom: 40,
  },
  skeletonBlock: {
    backgroundColor: "#1c1c1c",
    borderRadius: 6,
  },

  // ─── Empty / Error state ────────────────────────────────────────────────────
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptyBody: {
    color: "#737373",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: "#E50914",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  // ─── Toast ──────────────────────────────────────────────────────────────────
  toastWrap: {
    position: "absolute",
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  toastText: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
