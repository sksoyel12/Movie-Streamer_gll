/**
 * Clips — Official Trailers & Clips reel (TikTok/Reels-style vertical feed)
 *
 * • Fetches trending movies/shows from TMDB + caches their videos (24 h)
 * • Snaps to each clip; auto-plays a muted preview when the card is visible
 * • Tapping the clip card opens the full-screen S-MOVIE player
 * • "Watch Trailer" opens the full-screen YouTube modal
 * • Only items with a backdrop/poster are shown; section hidden when empty
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  ViewabilityConfig,
  ViewToken,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import SmartImage from "@/components/SmartImage";
import { tmdb, tmdbImg } from "@/lib/tmdb";
import { haptic } from "@/lib/haptics";
import {
  getCachedVideos,
  setCachedVideos,
  type VideoEntry,
} from "@/lib/trailerCache";

const { width: W, height: H } = Dimensions.get("window");
const CLIP_H = H;

interface ClipItem {
  id: number;
  tmdbId: number;
  title: string;
  backdropUri: string | null;
  posterUri: string | null;
  youtubeKey: string | null;
  videoType: string; // "Trailer" | "Teaser" | "Clip"
  overview: string;
  mediaType: "movie" | "tv";
  year: string;
  rating: number;
  genre: string;
}

// ─── YouTube embed ────────────────────────────────────────────────────────────

function YoutubeEmbed({
  videoKey,
  muted = false,
  autoplay = false,
}: {
  videoKey: string;
  muted?: boolean;
  autoplay?: boolean;
}) {
  const params = [
    autoplay ? "autoplay=1" : "autoplay=0",
    muted ? "mute=1" : "mute=0",
    "rel=0",
    "controls=" + (muted ? "0" : "1"),
    "modestbranding=1",
    "playsinline=1",
    muted ? `loop=1&playlist=${videoKey}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const embedUrl = `https://www.youtube.com/embed/${videoKey}?${params}`;

  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <iframe
          src={embedUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            backgroundColor: "#000",
          } as any}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </View>
    );
  }

  let NativeWebView: React.ComponentType<any> | null = null;
  try { NativeWebView = require("react-native-webview").WebView; } catch {}

  if (!NativeWebView) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", textAlign: "center", paddingHorizontal: 32 }}>
          Trailer unavailable. Tap outside to close.
        </Text>
      </View>
    );
  }

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;background:#000}html,body{width:100%;height:100%}iframe{width:100%;height:100%}</style></head><body><iframe src="${embedUrl}" frameborder="0" allowfullscreen allow="autoplay; fullscreen"></iframe></body></html>`;

  return (
    <NativeWebView
      source={{ html }}
      style={{ flex: 1, backgroundColor: "#000" }}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      scrollEnabled={false}
    />
  );
}

// ─── Single clip card ─────────────────────────────────────────────────────────

interface ClipCardProps {
  item: ClipItem;
  isVisible: boolean;
}

const ClipCard = React.memo(function ClipCard({ item, isVisible }: ClipCardProps) {
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const insets = useSafeAreaInsets();

  // Tap on card → full-screen S-MOVIE player
  const handleCardPress = useCallback(() => {
    haptic.medium();
    router.push({
      pathname: "/player",
      params: {
        id: `tmdb-${item.tmdbId}`,
        type: item.mediaType,
        title_param: item.title,
      },
    });
  }, [item]);

  // "Watch Trailer" → YouTube modal
  const handleTrailer = useCallback((e: any) => {
    e.stopPropagation?.();
    if (!item.youtubeKey) {
      haptic.light();
      router.push({
        pathname: "/movie/[id]",
        params: { id: `tmdb-${item.tmdbId}`, type: item.mediaType, title_param: item.title },
      });
      return;
    }
    haptic.medium();
    setShowTrailerModal(true);
  }, [item]);

  // Type badge color
  const typeBadgeColor =
    item.videoType === "Teaser" ? "#F59E0B" :
    item.videoType === "Clip"   ? "#8B5CF6" :
    "#E50914";

  return (
    <Pressable
      style={[styles.card, { height: CLIP_H }]}
      onPress={handleCardPress}
    >
      {/* Muted auto-play preview when this card is visible */}
      {isVisible && item.youtubeKey ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
          <YoutubeEmbed videoKey={item.youtubeKey} muted autoplay />
        </View>
      ) : (
        <SmartImage
          source={
            item.backdropUri
              ? { uri: item.backdropUri }
              : item.posterUri
              ? { uri: item.posterUri }
              : null
          }
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      )}

      {/* Gradient overlay — always on top of media */}
      <LinearGradient
        colors={["rgba(0,0,0,0.10)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.82)"]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.4, 1]}
        pointerEvents="none"
      />

      {/* Content */}
      <View
        style={[styles.cardContent, { paddingBottom: insets.bottom + 90 }]}
        pointerEvents="box-none"
      >
        {/* Genre + type badges */}
        <View style={styles.badgeRow}>
          <View style={styles.genreChip}>
            <Text style={styles.genreText}>{item.genre}</Text>
          </View>
          {item.youtubeKey && (
            <View style={[styles.typeBadge, { backgroundColor: typeBadgeColor + "CC" }]}>
              <Text style={styles.typeBadgeText}>{item.videoType}</Text>
            </View>
          )}
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

        {/* Action row — stopPropagation so card press isn't triggered */}
        <View style={styles.actionRow} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.playBtn}
            onPress={handleTrailer}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={18} color="#000" />
            <Text style={styles.playBtnText}>
              {item.youtubeKey ? "Watch Trailer" : "View Details"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.detailBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              haptic.light();
              router.push({
                pathname: "/movie/[id]",
                params: { id: `tmdb-${item.tmdbId}`, type: item.mediaType, title_param: item.title },
              });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={26} color="#fff" />
            <Text style={styles.detailBtnText}>Info</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Full-screen YouTube trailer modal */}
      <Modal
        visible={showTrailerModal}
        animationType="slide"
        onRequestClose={() => setShowTrailerModal(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <YoutubeEmbed videoKey={item.youtubeKey!} autoplay />
          <Pressable
            style={styles.closeBtn}
            onPress={() => setShowTrailerModal(false)}
          >
            <Ionicons name="close-circle" size={34} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </View>
      </Modal>
    </Pressable>
  );
});

// ─── Main Clips Screen ────────────────────────────────────────────────────────

export default function ClipsScreen() {
  const insets = useSafeAreaInsets();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);

  const fetchClips = useCallback(async () => {
    try {
      const [moviesPage, tvPage] = await Promise.allSettled([
        tmdb.trendingMovies(1),
        tmdb.trendingTV(1),
      ]);

      const movies = moviesPage.status === "fulfilled"
        ? moviesPage.value.results.slice(0, 12)
        : [];
      const tvShows = tvPage.status === "fulfilled"
        ? tvPage.value.results.slice(0, 8)
        : [];

      const combined = [
        ...movies.map((m: any) => ({ ...m, media_type: "movie" as const })),
        ...tvShows.map((t: any) => ({ ...t, media_type: "tv" as const })),
      ]
        .sort(() => Math.random() - 0.5)
        .slice(0, 18);

      // Fetch videos per item — try cache first, then TMDB
      const withVideos = await Promise.all(
        combined.map(async (item: any) => {
          let youtubeKey: string | null = null;
          let videoType = "Trailer";
          try {
            const mt: "movie" | "tv" = item.media_type;
            const tmdbId: number = item.id;

            // Cache-first
            let videos: VideoEntry[] | null = await getCachedVideos(tmdbId, mt);
            if (!videos) {
              const res = await tmdb.videos(mt, tmdbId);
              const ytVideos = (res.results ?? []).filter(
                (v: any) => v.site === "YouTube",
              ) as VideoEntry[];
              await setCachedVideos(tmdbId, mt, ytVideos);
              videos = ytVideos;
            }

            // Priority: Trailer > Teaser > Clip
            const pick =
              videos.find((v) => v.type === "Trailer") ??
              videos.find((v) => v.type === "Teaser") ??
              videos.find((v) => v.type === "Clip");

            if (pick) {
              youtubeKey = pick.key;
              videoType = pick.type;
            }
          } catch {}

          const title = item.title ?? item.name ?? "Untitled";
          const year = (item.release_date ?? item.first_air_date ?? "").slice(0, 4);
          const backdropUri = item.backdrop_path ? tmdbImg(item.backdrop_path, "original") : null;
          const posterUri = item.poster_path ? tmdbImg(item.poster_path, "w780") : null;

          return {
            id: item.id,
            tmdbId: item.id,
            title,
            backdropUri,
            posterUri,
            youtubeKey,
            videoType,
            overview: item.overview ?? "",
            mediaType: item.media_type,
            year,
            rating: Math.round((item.vote_average ?? 0) * 10) / 10,
            genre: item.media_type === "tv" ? "TV Show" : "Movie",
          } as ClipItem;
        }),
      );

      // Keep only items with an image
      setClips(withVideos.filter((c) => c.backdropUri || c.posterUri));
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

  // Track which item is fully on screen for auto-play
  const viewabilityConfig = useRef<ViewabilityConfig>({
    viewAreaCoveragePercentThreshold: 80,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setVisibleIndex(viewableItems[0].index);
      }
    },
  ).current;

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
        renderItem={({ item, index }) => (
          <ClipCard item={item} isVisible={index === visibleIndex} />
        )}
        pagingEnabled
        snapToInterval={CLIP_H}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
        getItemLayout={(_, index) => ({
          length: CLIP_H,
          offset: CLIP_H * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 1 },
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
    zIndex: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  genreChip: {
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
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 10,
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
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
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
