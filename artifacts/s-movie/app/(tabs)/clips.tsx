/**
 * Clips — Short Clips & Trailers reel (TikTok/Reels-style vertical feed)
 *
 * Fetches trending movies/shows from TMDB, grabs their trailers, and
 * presents them in a full-screen vertical scroll reel. Each card shows
 * the movie backdrop + title, and taps open the YoutubeEmbed trailer.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SmartImage from "@/components/SmartImage";
import { tmdb, tmdbImg } from "@/lib/tmdb";
import { haptic } from "@/lib/haptics";

const { width: W, height: H } = Dimensions.get("window");
const CLIP_H = H;

interface ClipItem {
  id: number;
  title: string;
  backdropUri: string | null;
  posterUri: string | null;
  youtubeKey: string | null;
  overview: string;
  mediaType: "movie" | "tv";
  year: string;
  rating: number;
  genre: string;
}

// ─── YouTube embed inline ──────────────────────────────────────────────────────
// On web: render a plain <iframe> (react-native-webview is not available on web).
// On native: lazily load react-native-webview via a safe try/require — any error
// (e.g. running in Expo Go without the native module) falls back to the web path.
function YoutubeEmbedInline({ videoKey }: { videoKey: string }) {
  const embedUrl = `https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0&controls=1&modestbranding=1`;

  if (Platform.OS === "web") {
    // On web, use a standard iframe — no native module needed.
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#000" } as any}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </View>
    );
  }

  // Native: use react-native-webview safely
  let NativeWebView: React.ComponentType<any> | null = null;
  try {
    NativeWebView = require("react-native-webview").WebView;
  } catch {
    NativeWebView = null;
  }

  if (!NativeWebView) {
    // Fallback: open in external browser when module unavailable
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 14, textAlign: "center", paddingHorizontal: 32 }}>
          Trailer player unavailable.{"\n"}Tap outside to close.
        </Text>
      </View>
    );
  }

  const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{background:#000}</style></head><body><iframe width="100%" height="100%" src="${embedUrl}" frameborder="0" allowfullscreen allow="autoplay"></iframe></body></html>`;
  return (
    <NativeWebView
      source={{ html }}
      style={{ flex: 1, backgroundColor: "#000" }}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
    />
  );
}

// ─── Single clip card ──────────────────────────────────────────────────────────
const ClipCard = React.memo(function ClipCard({ item }: { item: ClipItem }) {
  const [playing, setPlaying] = useState(false);
  const insets = useSafeAreaInsets();

  const handlePlay = useCallback(() => {
    haptic.medium();
    if (item.youtubeKey) {
      setPlaying(true);
    } else {
      router.push({
        pathname: "/movie/[id]",
        params: {
          id: `tmdb-${item.id}`,
          type: item.mediaType,
          title_param: item.title,
        },
      });
    }
  }, [item]);

  return (
    <View style={[styles.card, { height: CLIP_H }]}>
      {/* Background image */}
      <SmartImage
        source={item.backdropUri ? { uri: item.backdropUri } : item.posterUri ? { uri: item.posterUri } : null}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {/* Gradient overlay */}
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.85)"]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.4, 1]}
      />

      {/* Content */}
      <View style={[styles.cardContent, { paddingBottom: insets.bottom + 90 }]}>
        {/* Genre chip */}
        <View style={styles.genreChip}>
          <Text style={styles.genreText}>{item.genre}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

        {/* Year + rating */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.year}</Text>
          {item.rating > 0 && (
            <>
              <View style={styles.metaDot} />
              <Ionicons name="star" size={11} color="#FBBF24" />
              <Text style={styles.metaText}>{item.rating.toFixed(1)}</Text>
            </>
          )}
        </View>

        {/* Overview */}
        {item.overview ? (
          <Text style={styles.overview} numberOfLines={3}>{item.overview}</Text>
        ) : null}

        {/* Action row */}
        <View style={styles.actionRow}>
          {/* Play trailer */}
          <TouchableOpacity
            style={styles.playBtn}
            onPress={handlePlay}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={18} color="#000" />
            <Text style={styles.playBtnText}>
              {item.youtubeKey ? "Watch Trailer" : "View Details"}
            </Text>
          </TouchableOpacity>

          {/* Go to detail */}
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => {
              haptic.light();
              router.push({
                pathname: "/movie/[id]",
                params: {
                  id: `tmdb-${item.id}`,
                  type: item.mediaType,
                  title_param: item.title,
                },
              });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={26} color="#fff" />
            <Text style={styles.detailBtnText}>Info</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* YouTube player modal */}
      <Modal
        visible={playing}
        animationType="slide"
        onRequestClose={() => setPlaying(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <YoutubeEmbedInline videoKey={item.youtubeKey!} />
          <Pressable style={styles.closeBtn} onPress={() => setPlaying(false)}>
            <Ionicons name="close-circle" size={34} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
});

// ─── Main Clips Screen ─────────────────────────────────────────────────────────
export default function ClipsScreen() {
  const insets = useSafeAreaInsets();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClips = useCallback(async () => {
    try {
      // Fetch trending movies + TV shows
      const [moviesPage, tvPage] = await Promise.allSettled([
        tmdb.trendingMovies(1),
        tmdb.trendingTV(1),
      ]);

      const movies = moviesPage.status === "fulfilled" ? moviesPage.value.results.slice(0, 10) : [];
      const tvShows = tvPage.status === "fulfilled" ? tvPage.value.results.slice(0, 8) : [];

      // Interleave movies and TV
      const combined = [...movies.map((m: any) => ({ ...m, media_type: "movie" as const })),
                        ...tvShows.map((t: any) => ({ ...t, media_type: "tv" as const }))]
        .sort(() => Math.random() - 0.5)
        .slice(0, 15);

      // Fetch trailers in parallel (first 8)
      const withTrailers = await Promise.all(
        combined.map(async (item: any) => {
          let youtubeKey: string | null = null;
          try {
            const videos = await tmdb.videos(item.media_type, item.id);
            const trailer = (videos.results ?? []).find(
              (v: any) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"),
            );
            if (trailer) youtubeKey = trailer.key;
          } catch {}

          const title = item.title ?? item.name ?? "Untitled";
          const year = (item.release_date ?? item.first_air_date ?? "").slice(0, 4);
          const backdropUri = item.backdrop_path ? tmdbImg(item.backdrop_path, "original") : null;
          const posterUri = item.poster_path ? tmdbImg(item.poster_path, "w780") : null;

          return {
            id: item.id,
            title,
            backdropUri,
            posterUri,
            youtubeKey,
            overview: item.overview ?? "",
            mediaType: item.media_type,
            year,
            rating: Math.round((item.vote_average ?? 0) * 10) / 10,
            genre: item.media_type === "tv" ? "TV Show" : "Movie",
          } as ClipItem;
        }),
      );

      // Filter out items with no image
      setClips(withTrailers.filter((c) => c.backdropUri || c.posterUri));
    } catch (e) {
      console.warn("[ClipsScreen] fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClips(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClips();
  }, [fetchClips]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E50914" />
        <Text style={styles.loadingText}>Loading clips…</Text>
      </View>
    );
  }

  if (clips.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="film-outline" size={52} color="#404040" />
        <Text style={styles.emptyText}>No clips available</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchClips}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerBrand}>
          <Text style={styles.headerLogo}>S</Text>
          <Text style={styles.headerTitle}>CLIPS</Text>
        </View>
      </View>

      <FlatList
        data={clips}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ClipCard item={item} />}
        pagingEnabled
        snapToInterval={CLIP_H}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
        getItemLayout={(_, index) => ({ length: CLIP_H, offset: CLIP_H * index, index })}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#737373",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  emptyText: {
    color: "#737373",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#E50914",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },

  // Header
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  headerLogo: {
    color: "#E50914",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
    marginLeft: 2,
  },

  // Clip card
  card: {
    width: W,
    position: "relative",
    overflow: "hidden",
  },
  cardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    gap: 8,
  },
  genreChip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(229,9,20,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  genreText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    lineHeight: 30,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  overview: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  playBtnText: {
    color: "#000",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  detailBtn: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
  },
  detailBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  closeBtn: {
    position: "absolute",
    top: 52,
    right: 16,
    zIndex: 100,
  },
});
