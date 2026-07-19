import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import EmbedPlayer from "@/components/EmbedPlayer";
import SmartImage from "@/components/SmartImage";
import { findMovie, PLAYABLE_VIDEO_URL } from "@/data/movies";
import { haptic } from "@/lib/haptics";
import { tmdb, tmdbImg, proxyUrl, type TMDBEpisode, type TMDBDetail } from "@/lib/tmdb";
import { loadProgress, saveProgress } from "@/lib/watchProgress";
import {
  getDownloadRecord,
  deleteDownload as deleteDownloadFile,
  type DownloadStatus,
} from "@/lib/downloads";
import { useDownloads } from "@/contexts/DownloadContext";
import { getDirectStream } from "@/lib/streamingService";
import { fetchMovieLinks, fetchEpisodeLink } from "@/lib/movieLinks";

const LANGUAGES = [
  "English",
  "Hindi",
  "Japanese",
  "Korean",
  "Spanish",
] as const;
const SUBTITLES = ["Off", "English", "Hindi", "Japanese", "Korean"] as const;
const SPEEDS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x (Normal)", value: 1 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
  { label: "3x", value: 3 },
] as const;

type Language = (typeof LANGUAGES)[number];
type Subtitle = (typeof SUBTITLES)[number];
type SpeedValue = (typeof SPEEDS)[number]["value"];


export default function PlayerScreen() {
  const { id, season, episode, type, hdhubUrl, directUrl, title_param } = useLocalSearchParams<{
    id: string;
    season?: string;
    episode?: string;
    type?: string;
    hdhubUrl?: string;
    directUrl?: string;
    title_param?: string;
  }>();
  const movie = findMovie(id ?? "");

  const { width: winW, height: winH } = useWindowDimensions();
  const isPortraitWeb = Platform.OS === "web" && winH > winW;

  const [orientationLocked, setOrientationLocked] = useState(false);
  const [streamResult, setStreamResult] = useState<{
    url: string;
    subtitles: any;
    isEmbed: boolean;
    source?: string;
    allSources: Array<{ url: string; source: string; isEmbed: boolean }>;
    currentIndex: number;
    isAutoSwitching: boolean;
  } | null>(null);

  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [autoplayCountdown, setAutoplayCountdown] = useState<number | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [embedMode, setEmbedMode] = useState(false);
  const [showEmbedButton, setShowEmbedButton] = useState(false);

  const ready = streamResult !== null && !streamResult.isAutoSwitching && autoplayCountdown === null;

  // ─── Resolve TMDB ID ─────────────────────────────────────────────────────────
  const tmdbId = (() => {
    if (id?.startsWith("tmdb-")) {
      const n = parseInt(id.replace("tmdb-", ""), 10);
      if (!isNaN(n)) return n;
    }
    const raw = (movie as any)?.tmdbId as number | undefined;
    if (raw) return raw;
    return null;
  })();

  const isTV =
    type === "tv" ||
    (movie as any)?.mediaType === "tv" ||
    Boolean(movie?.episodes && movie.episodes.length > 0);

  const currentSeason = season ? parseInt(season, 10) : 1;
  const currentEpisode = episode ? parseInt(episode, 10) : 1;

  // ─── Auth gate ─────────────────────────────────────────────────────────────
  // Player is gated on auth — unauthenticated users should not access streams.
  // We still wait for Firebase to confirm state (never redirect synchronously)
  // and use a 3-second timeout so the page never hangs if Firebase is slow.
  const [authChecked, setAuthChecked] = useState(false);
  const [authedUser, setAuthedUser] = useState<boolean>(false);
  useEffect(() => {
    let settled = false;
    const settle = (user: boolean) => {
      if (settled) return;
      settled = true;
      setAuthedUser(user);
      setAuthChecked(true);
    };
    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(firebaseAuth, (u) => settle(!!u));
    } catch {
      settle(false);
    }
    const timer = setTimeout(() => settle(false), 3000);
    return () => { unsub?.(); clearTimeout(timer); };
  }, []);

  // Fetch TV Series Metadata for navigation
  useEffect(() => {
    if (!isTV || !tmdbId) return;
    setLoadingMetadata(true);
    tmdb.detail("tv", tmdbId).then(detail => {
      const s = (detail.seasons ?? []).filter(x => x.episode_count > 0);
      setSeasons(s);
      const sNum = s.find(x => x.season_number === currentSeason)?.season_number ?? currentSeason;
      return tmdb.seasonDetail(tmdbId, sNum);
    }).then(res => {
      setEpisodes(res.episodes || []);
    }).catch(() => {
    }).finally(() => setLoadingMetadata(false));
  }, [tmdbId, isTV, currentSeason]);

  const getNextEpisode = () => {
    if (!isTV) return null;
    const epIdx = episodes.findIndex(e => e.episode_number === currentEpisode);
    if (epIdx !== -1 && epIdx < episodes.length - 1) {
      return { season: currentSeason, episode: episodes[epIdx + 1].episode_number };
    }
    const sIdx = seasons.findIndex(s => s.season_number === currentSeason);
    if (sIdx !== -1 && sIdx < seasons.length - 1) {
      return { season: seasons[sIdx + 1].season_number, episode: 1 };
    }
    return null;
  };

  const startNextEpisode = () => {
    const next = getNextEpisode();
    if (next) {
      router.setParams({ season: String(next.season), episode: String(next.episode) });
      setStreamResult(null); // Force reload
    }
    setAutoplayCountdown(null);
  };

  useEffect(() => {
    if (autoplayCountdown === null) return;
    if (autoplayCountdown <= 0) {
      startNextEpisode();
      return;
    }
    const timer = setTimeout(() => setAutoplayCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [autoplayCountdown]);

  const s = currentSeason;
  const e = currentEpisode;

  // ─── Fetch stream URL ──────────────────────────────────────────────────────────
  // Priority: 1) Direct URL param → 2) Local download → 3) Firebase admin link
  //           → 4) VegaMovies backend scraper (.mp4/.m3u8 direct)
  // NO embed URLs. NO WebViews. Direct streams only.
  useEffect(() => {
    let cancelled = false;

    const loadStream = async () => {
      // ── Step 1: directUrl param — play immediately ────────────────────────────
      if (directUrl) {
        setStreamResult({
          url: directUrl,
          subtitles: false,
          isEmbed: false,
          source: "Direct",
          allSources: [{ url: directUrl, source: "Direct", isEmbed: false }],
          currentIndex: 0,
          isAutoSwitching: false,
        });
        return;
      }

      // ── Step 2: Local download ────────────────────────────────────────────────
      if (movie) {
        const rec = await getDownloadRecord(movie.id).catch(() => null);
        if (!cancelled && rec?.status === "complete" && rec.localPath) {
          setStreamResult({
            url: rec.localPath,
            subtitles: false,
            isEmbed: false,
            source: "Local Download",
            allSources: [{ url: rec.localPath, source: "Local Download", isEmbed: false }],
            currentIndex: 0,
            isAutoSwitching: false,
          });
          return;
        }
      }

      // ── Step 3: Firebase admin-added direct video link ────────────────────────
      if (tmdbId) {
        try {
          let firebaseLink: { directVideo: string } | null = null;
          if (isTV) {
            firebaseLink = await fetchEpisodeLink(tmdbId, s, e);
          } else {
            const mLinks = await fetchMovieLinks(tmdbId);
            if (mLinks?.directVideo) firebaseLink = { directVideo: mLinks.directVideo };
          }
          if (!cancelled && firebaseLink?.directVideo) {
            const fUrl = firebaseLink.directVideo;
            setStreamResult({
              url: fUrl,
              subtitles: false,
              isEmbed: false,
              source: "Firebase",
              allSources: [{ url: fUrl, source: "Firebase", isEmbed: false }],
              currentIndex: 0,
              isAutoSwitching: false,
            });
            return;
          }
        } catch { }
      }

      // ── Step 4: No direct stream → use embed player immediately ─────────────
      // If tmdbId is available, EmbedPlayer handles 10 servers automatically.
      // Skip VegaMovies scraper (35s timeout) — user doesn't want to wait.
      if (!cancelled) {
        setStreamResult({
          url: "",
          subtitles: false,
          isEmbed: false,
          source: "none",
          allSources: [],
          currentIndex: 0,
          isAutoSwitching: false,
        });
      }
    };

    loadStream();
    return () => { cancelled = true; };
  }, [id, season, episode, isTV, tmdbId, directUrl]);

  // Lock landscape orientation
  useEffect(() => {
    let mounted = true;
    const lockLandscape = async () => {
      try {
        if (Platform.OS === "web") {
          const screen: any = (typeof window !== "undefined" && window.screen) || null;
          if (screen?.orientation?.lock) {
            try { await screen.orientation.lock("landscape"); } catch { }
          }
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
        }
        if (mounted) setOrientationLocked(true);
      } catch { }
    };
    lockLandscape();
    return () => {
      mounted = false;
      const restore = async () => {
        try {
          if (Platform.OS === "web") {
            const screen: any = (typeof window !== "undefined" && window.screen) || null;
            if (screen?.orientation?.unlock) {
              try { screen.orientation.unlock(); } catch { }
            }
          } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          }
        } catch { }
      };
      restore();
    };
  }, []);

  const handleBack = async () => {
    try {
      if (Platform.OS !== "web") {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    } catch { }
    router.back();
  };

  const switchToSource = (idx: number) => {
    if (!streamResult) return;
    const src = streamResult.allSources[idx];
    if (!src) return;
    haptic.medium();
    setStreamResult({
      ...streamResult,
      url: src.url,
      isEmbed: src.isEmbed,
      source: src.source,
      currentIndex: idx,
    });
    setShowServerModal(false);
  };

  const tryNextSource = () => {
    if (!streamResult) return;
    const nextIdx = streamResult.currentIndex + 1;
    if (nextIdx < streamResult.allSources.length) {

      const nextSource = streamResult.allSources[nextIdx];
      setStreamResult({
        ...streamResult,
        url: nextSource.url,
        isEmbed: nextSource.isEmbed,
        source: nextSource.source,
        currentIndex: nextIdx,
        isAutoSwitching: false, // Set to true momentarily to show loader if needed, but normally switching should trigger effects
      });
      haptic.light();
    } else {
      console.warn("[Player] All sources exhausted.");
      Alert.alert("Playback Error", "None of the available sources are responding. Please try again later.");
    }
  };

  // Wait for Firebase to confirm the session before rendering anything.
  if (!authChecked) {
    return (
      <View style={[styles.container, { backgroundColor: "#000", justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  // ─── Embed mode ───────────────────────────────────────────────────────────────
  if (embedMode && tmdbId) {
    const embedNextEp = getNextEpisode();
    return (
      <EmbedPlayer
        tmdbId={tmdbId}
        mediaType={isTV ? "tv" : "movie"}
        season={currentSeason}
        episode={currentEpisode}
        title={title_param || movie?.title}
        nextEpisode={embedNextEp}
        onBack={handleBack}
        onNextEpisode={embedNextEp ? startNextEpisode : undefined}
      />
    );
  }

  // Show fetching state until stream URL is ready
  if (!ready && autoplayCountdown === null) {
    const switchingNote = streamResult && streamResult.currentIndex > 0
      ? `Switching to backup server (${streamResult.currentIndex + 1}/${streamResult.allSources.length})...`
      : "Loading Video · Securing Stream...";

    return (
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        {/* Background Placeholder */}
        <SmartImage 
          source={movie?.poster} 
          style={[StyleSheet.absoluteFill, { opacity: 0.15 }]} 
          contentFit="cover" 
          blurRadius={20}
        />
        
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={{ 
            color: "#fff", 
            marginTop: 24, 
            fontFamily: "Inter_700Bold", 
            fontSize: 16,
            textAlign: 'center', 
            paddingHorizontal: 60,
            lineHeight: 24,
            letterSpacing: -0.2
          }}>
            {switchingNote}
          </Text>
          
          {/* Netflix-red progress track */}
          <View style={{ width: 140, height: 3, backgroundColor: '#1a1a1a', borderRadius: 2, marginTop: 40, overflow: 'hidden' }}>
             <Animated.View style={{ 
               width: '100%', 
               height: '100%', 
               backgroundColor: '#E50914',
               borderRadius: 2,
               transform: [{ scaleX: 0.35 }],
               transformOrigin: 'left',
             }} />
          </View>
        </View>

        {/* Floating Back Button during load */}
        <Pressable 
          onPress={handleBack}
          style={{ position: 'absolute', top: 30, left: 30, padding: 10, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>

        {/* Watch Online button — appears after 4s if stream still loading */}
        {tmdbId ? (
          <Pressable
            onPress={() => setEmbedMode(true)}
            style={{
              position: 'absolute',
              bottom: 60,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(229,9,20,0.18)',
              borderWidth: 1,
              borderColor: 'rgba(229,9,20,0.5)',
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: 28,
            }}
          >
            <Ionicons name="globe-outline" size={18} color="#E50914" />
            <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
              Watch Online Instead
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // No stream found — show WebView embed player with multiple sources
  if (streamResult?.source === "none") {
    const embedNextEp = getNextEpisode();
    return (
      <EmbedPlayer
        tmdbId={tmdbId ?? 0}
        mediaType={isTV ? "tv" : "movie"}
        season={currentSeason}
        episode={currentEpisode}
        title={title_param || movie?.title}
        nextEpisode={embedNextEp}
        onBack={handleBack}
        onNextEpisode={embedNextEp ? startNextEpisode : undefined}
      />
    );
  }

  const resolvedUrl = streamResult?.url || PLAYABLE_VIDEO_URL;
  const nextEp = getNextEpisode();

  const webLandscapeStyle = isPortraitWeb ? {
    position: "absolute" as const,
    width: winH,
    height: winW,
    left: -(winH - winW) / 2,
    top: (winH - winW) / 2,
    transform: [{ rotate: "90deg" }],
  } : { flex: 1 };

  return (
    <View style={isPortraitWeb ? { flex: 1, overflow: "hidden" } : { flex: 1 }}>
      <View style={webLandscapeStyle}>
        <NativePlayerScreen
            movieId={id ?? ""}
            videoUrl={resolvedUrl}
            title={title_param || movie?.title}
            posterUri={movie?.poster && typeof movie.poster === "object" && "uri" in movie.poster ? (movie.poster as any).uri : undefined}
            onBack={handleBack}
            orientationLocked={orientationLocked}
            isTV={isTV}
            tmdbId={tmdbId}
            initialSeason={currentSeason}
            initialEpisode={currentEpisode}
            onTimeout={tryNextSource}
            onEnded={() => nextEp && setAutoplayCountdown(5)}
            seasons={seasons}
            episodes={episodes}
          />

        {/* Autoplay Next Overlay */}
        {autoplayCountdown !== null && nextEp && (
          <View style={styles.autoplayOverlay}>
            <BlurView intensity={70} tint="dark" style={styles.autoplayCard}>
              <Text style={styles.autoplayComingUp}>Coming up next...</Text>
              <Text style={styles.autoplayTitle} numberOfLines={2}>
                E{nextEp.episode}: {episodes.find(e => e.episode_number === nextEp.episode)?.name || "Next Episode"}
              </Text>
              
              <View style={styles.autoplayCircleWrap}>
                 <Text style={styles.autoplaySeconds}>{autoplayCountdown}</Text>
              </View>

              <View style={styles.autoplayActions}>
                <Pressable 
                  onPress={() => setAutoplayCountdown(null)} 
                  style={styles.autoplayCancelBtn}
                >
                  <Text style={styles.autoplayCancelText}>Cancel</Text>
                </Pressable>
                
                <Pressable 
                  onPress={startNextEpisode} 
                  style={styles.autoplayNowBtn}
                >
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.autoplayNowText}>Play Now</Text>
                </Pressable>
              </View>
            </BlurView>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Native Player (expo-video) ────────────────────────────────────────────────

function NativePlayerScreen({
  movieId,
  videoUrl,
  title,
  posterUri,
  onBack,
  orientationLocked,
  isTV,
  tmdbId,
  initialSeason,
  initialEpisode,
  onTimeout,
  onEnded,
  seasons,
  episodes,
}: {
  movieId: string;
  videoUrl: string;
  title?: string;
  posterUri?: string;
  onBack: () => void;
  orientationLocked: boolean;
  isTV: boolean;
  tmdbId: number | null;
  initialSeason: number;
  initialEpisode: number;
  onTimeout?: () => void;
  onEnded?: () => void;
  seasons: any[];
  episodes: TMDBEpisode[];
}) {
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [settingsView, setSettingsView] = useState<
    "main" | "audio" | "subtitles" | "speed"
  >("main");

  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);

  useEffect(() => {
    if (seasons.length > 0) {
      const idx = seasons.findIndex(s => s.season_number === initialSeason);
      if (idx !== -1) setSelectedSeasonIdx(idx);
    }
  }, [initialSeason, seasons]);

  const [language, setLanguage] = useState<Language>("English");
  const [subtitle, setSubtitle] = useState<Subtitle>("Off");
  const [speed, setSpeed] = useState<SpeedValue>(1);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [skipIntroDismissed, setSkipIntroDismissed] = useState(false);

  // Handle episode switch
  const switchEpisode = (s: number, e: number) => {
    haptic.medium();
    setShowEpisodes(false);
    setIsBuffering(true);
    router.setParams({ season: String(s), episode: String(e) });
  };

  // Gesture controls
  const [volume, setVolumeState] = useState(1.0);
  const [brightness, setBrightnessState] = useState(1.0);
  const [activeGesture, setActiveGesture] = useState<null | "volume" | "brightness">(null);
  const volumeRef = useRef(1.0);
  const brightnessRef = useRef(1.0);
  const gestureStartValue = useRef(1.0);
  const gestureKind = useRef<null | "volume" | "brightness">(null);
  const gestureHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; side: "left" | "right" | null }>({ time: 0, side: null });
  const seekFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ side: "left" | "right" } | null>(null);

  const setVolume = (v: number) => { volumeRef.current = v; setVolumeState(v); };
  const setBrightness = (v: number) => { brightnessRef.current = v; setBrightnessState(v); };

  // Download state
  const { startDownload: ctxStartDownload, removeDownload: ctxRemoveDownload } = useDownloads();
  const [dlStatus, setDlStatus] = useState<DownloadStatus>("idle");
  const [dlProgress, setDlProgress] = useState(0);
  const [showDlBar, setShowDlBar] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(0);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    const subStatus = player.addListener("statusChange", (e: any) => {
      if ((player.status as string) === "finished") {

        onEnded?.();
      }
    });
    return () => subStatus.remove();
  }, [player, onEnded]);

  // Sync volume with player
  useEffect(() => {
    try { player.volume = volume; } catch { }
  }, [player, volume]);

  // Swipe gesture PanResponder — left half = brightness, right half = volume
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gs) =>
        Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2,
      onPanResponderGrant: (evt, _gs) => {
        const { width } = Dimensions.get("window");
        const side = evt.nativeEvent.locationX < width / 2 ? "brightness" : "volume";
        gestureKind.current = side;
        gestureStartValue.current =
          side === "brightness" ? brightnessRef.current : volumeRef.current;
        setActiveGesture(side);
        if (gestureHideTimer.current) clearTimeout(gestureHideTimer.current);
      },
      onPanResponderMove: (_evt, gs) => {
        const kind = gestureKind.current;
        if (!kind) return;
        const delta = -(gs.dy / 220);
        const next = Math.max(0, Math.min(1, gestureStartValue.current + delta));
        if (kind === "brightness") setBrightness(next);
        else setVolume(next);
      },
      onPanResponderRelease: (evt, gs) => {
        // Tiny movement = tap
        if (Math.abs(gs.dy) < 8 && Math.abs(gs.dx) < 8) {
          const { width } = Dimensions.get("window");
          const tapX = evt.nativeEvent.locationX;
          const side = tapX < width / 2 ? ("left" as const) : ("right" as const);
          const now = Date.now();
          const last = lastTapRef.current;
          if (now - last.time < 300 && last.side === side) {
            // Double-tap → seek ±10s
            const delta = side === "left" ? -10 : 10;
            try {
              const next = Math.max(0, Math.min((player.currentTime ?? 0) + delta, durationRef.current || 1e9));
              player.currentTime = next;
              setPosition(next);
            } catch {}
            haptic.light();
            if (seekFlashTimerRef.current) clearTimeout(seekFlashTimerRef.current);
            setSeekFlash({ side });
            seekFlashTimerRef.current = setTimeout(() => setSeekFlash(null), 800);
            lastTapRef.current = { time: 0, side: null };
          } else {
            // Single tap → toggle controls
            setShowControls((s) => !s);
            lastTapRef.current = { time: now, side };
          }
        }
        gestureKind.current = null;
        if (gestureHideTimer.current) clearTimeout(gestureHideTimer.current);
        gestureHideTimer.current = setTimeout(() => setActiveGesture(null), 1500);
      },
    }),
  ).current;

  // Check existing download status
  useEffect(() => {
    if (!movieId) return;
    getDownloadRecord(movieId).then((rec) => {
      if (rec) {
        setDlStatus(rec.status);
        setDlProgress(rec.progress);
        if (rec.status === "downloading") setShowDlBar(true);
      }
    }).catch(() => {});
  }, [movieId]);

  // Restore saved position
  useEffect(() => {
    if (!movieId) return;
    let cancelled = false;
    loadProgress(movieId).then((saved) => {
      if (saved && !cancelled && saved.positionSec > 5) {
        try { player.currentTime = saved.positionSec; } catch { }
      }
    });
    progressSaveRef.current = setInterval(() => {
      if (positionRef.current > 5 && durationRef.current > 0) {
        saveProgress({
          movieId,
          positionSec: positionRef.current,
          durationSec: durationRef.current,
          updatedAt: Date.now(),
          title,
          posterUri,
        });
      }
    }, 5000);
    return () => {
      cancelled = true;
      if (progressSaveRef.current) clearInterval(progressSaveRef.current);
      if (positionRef.current > 5 && durationRef.current > 0) {
        saveProgress({
          movieId,
          positionSec: positionRef.current,
          durationSec: durationRef.current,
          updatedAt: Date.now(),
          title,
          posterUri,
        });
      }
    };
  }, [movieId, player]);

  useEffect(() => {
    try { player.playbackRate = speed; } catch { }
  }, [player, speed]);

  useEffect(() => {
    const sub = player.addListener("playingChange", (e) => {
      setIsPlaying(e.isPlaying);
      if (e.isPlaying) setIsBuffering(false);
    });
    const sub2 = player.addListener("statusChange", (e: any) => {
      if (player.duration && !Number.isNaN(player.duration)) setDuration(player.duration);
      const status = e?.status ?? (player as any).status;
      if (status === "readyToPlay" || status === "idle") setIsBuffering(false);
      if (status === "loading") setIsBuffering(true);
      if (status === "error") {
        setIsBuffering(false);
        setVideoError("Unable to load video. Please try again.");
      }
    });
    const interval = setInterval(() => {
      try {
        if (player.currentTime != null) {
          setPosition(player.currentTime);
          positionRef.current = player.currentTime;
          // Once we have a non-zero position, buffering is done
          if (player.currentTime > 0) setIsBuffering(false);
        }
        if (player.duration && !Number.isNaN(player.duration)) {
          setDuration(player.duration);
          durationRef.current = player.duration;
        }
      } catch { }
    }, 500);
    // Auto-clear buffering after 5s and try next source
    const bufferTimeout = setTimeout(() => {
      if (isBuffering && onTimeout) {
         console.warn("[NativePlayer] Buffer timeout (15s), trying next source...");
         onTimeout();
      }
      setIsBuffering(false);
    }, 15000); 
    return () => { sub.remove(); sub2.remove(); clearInterval(interval); clearTimeout(bufferTimeout); };
  }, [player, onTimeout]);

  useEffect(() => {
    if (showControls && !showSettings) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [showControls, showSettings, isPlaying]);

  // Clean up seek flash timer on unmount
  useEffect(() => {
    return () => { if (seekFlashTimerRef.current) clearTimeout(seekFlashTimerRef.current); };
  }, []);

  const togglePlay = () => {
    haptic.medium();
    player.playing ? player.pause() : player.play();
  };

  const skip = (deltaSeconds: number) => {
    haptic.light();
    try {
      const next = Math.max(0, Math.min((player.currentTime ?? 0) + deltaSeconds, duration || 1e9));
      player.currentTime = next;
      setPosition(next);
    } catch { }
  };

  const fmt = (s: number) => {
    if (!s || Number.isNaN(s)) return "0:00";
    const total = Math.floor(s);
    const m = Math.floor(total / 60);
    const sec = total % 60;
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  // ─── Download from player ────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!movieId) return;
    haptic.medium();

    if (dlStatus === "complete") {
      Alert.alert(
        "Already Downloaded",
        `"${title ?? "This title"}" is saved for offline viewing.`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await ctxRemoveDownload(movieId);
              setDlStatus("idle");
              setDlProgress(0);
              setShowDlBar(false);
            },
          },
        ],
      );
      return;
    }

    if (dlStatus === "downloading") {
      Alert.alert("Downloading…", `${Math.round(dlProgress * 100)}% complete`);
      return;
    }

    haptic.success();
    setDlStatus("downloading");
    setDlProgress(0);
    setShowDlBar(true);

    try {
      await ctxStartDownload(
        { movieId, title: title ?? movieId, posterUri: null },
        videoUrl,
        (p) => { setDlProgress(p); },
      );
      setDlStatus("complete");
      setDlProgress(1);
      haptic.success();
      Alert.alert("Download Complete", `"${title ?? "This title"}" saved for offline viewing.`);
    } catch {
      setDlStatus("error");
      Alert.alert("Download Failed", "Please check your connection and try again.");
    } finally {
      setTimeout(() => setShowDlBar(false), 3000);
    }
  };

  const dlIcon = (() => {
    if (dlStatus === "complete") return "checkmark-circle";
    if (dlStatus === "downloading") return "cloud-download";
    if (dlStatus === "error") return "alert-circle";
    return "download-outline";
  })() as any;

  const dlIconColor = dlStatus === "complete" ? "#34D399" : dlStatus === "error" ? "#e50914" : "#fff";

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />

      {/* Buffering spinner — shown while video loads */}
      {isBuffering && !videoError && (
        <View pointerEvents="none" style={styles.bufferOverlay}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.bufferText}>FETCHING STREAM...</Text>
          <Text style={styles.bufferSubtext}>Configuring secure server channel inside S-MOVIE</Text>
        </View>
      )}

      {/* Video error state */}
      {videoError && (
        <View style={styles.errorOverlay}>
          <Feather name="alert-circle" size={40} color="#e50914" />
          <Text style={styles.errorOverlayText}>
            Playback Error.{"\n"}Please check your data connection or activate VPN.
          </Text>
          <Pressable
            onPress={() => { setVideoError(null); setIsBuffering(true); try { player.play(); } catch { } }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Download progress bar (shown at bottom when downloading) */}
      {showDlBar && dlStatus === "downloading" && (
        <View style={styles.dlBar}>
          <Ionicons name="cloud-download" size={13} color="#34D399" />
          <View style={styles.dlBarTrack}>
            <View style={[styles.dlBarFill, { width: `${Math.round(dlProgress * 100)}%` }]} />
          </View>
          <Text style={styles.dlBarText}>{Math.round(dlProgress * 100)}%</Text>
        </View>
      )}

      {/* Simulated brightness dimmer overlay */}
      {brightness < 0.99 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "#000", opacity: (1 - brightness) * 0.82, zIndex: 6 },
          ]}
        />
      )}

      {/* Brightness HUD — left side */}
      {activeGesture === "brightness" && (
        <View pointerEvents="none" style={gestureStyles.leftHud}>
          <Ionicons
            name={brightness < 0.3 ? "moon-outline" : brightness < 0.7 ? "sunny-outline" : "sunny"}
            size={22}
            color="#fff"
          />
          <View style={gestureStyles.sliderTrack}>
            <View style={[gestureStyles.sliderFill, { height: `${Math.round(brightness * 100)}%` as any }]} />
          </View>
          <Text style={gestureStyles.hudPct}>{Math.round(brightness * 100)}%</Text>
        </View>
      )}

      {/* Volume HUD — right side */}
      {activeGesture === "volume" && (
        <View pointerEvents="none" style={gestureStyles.rightHud}>
          <Ionicons
            name={volume === 0 ? "volume-mute" : volume < 0.4 ? "volume-low" : volume < 0.75 ? "volume-medium" : "volume-high"}
            size={22}
            color="#fff"
          />
          <View style={gestureStyles.sliderTrack}>
            <View style={[gestureStyles.sliderFill, { height: `${Math.round(volume * 100)}%` as any }]} />
          </View>
          <Text style={gestureStyles.hudPct}>{Math.round(volume * 100)}%</Text>
        </View>
      )}

      {/* Double-tap seek flash — left (-10s) */}
      {seekFlash?.side === "left" && (
        <View pointerEvents="none" style={tapStyles.leftFlash}>
          <MaterialIcons name="replay-10" size={40} color="#fff" />
          <Text style={tapStyles.seekLabel}>-10s</Text>
        </View>
      )}

      {/* Double-tap seek flash — right (+10s) */}
      {seekFlash?.side === "right" && (
        <View pointerEvents="none" style={tapStyles.rightFlash}>
          <MaterialIcons name="forward-10" size={40} color="#fff" />
          <Text style={tapStyles.seekLabel}>+10s</Text>
        </View>
      )}

      <View {...panResponder.panHandlers} style={StyleSheet.absoluteFill}>
        {showControls && (
          <View style={styles.overlay}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <Pressable onPress={onBack} hitSlop={10} style={styles.iconBtn}>
                <Feather name="x" size={26} color="#fff" />
              </Pressable>
              <Text style={styles.titleText} numberOfLines={1}>
                {title ?? "Now Playing"}
              </Text>

              <View style={{ flexDirection: 'row' }}>
                {/* Download button */}
                <Pressable
                  onPress={(e) => { e.stopPropagation(); handleDownload(); }}
                  hitSlop={10}
                  style={styles.iconBtn}
                >
                  <Ionicons name={dlIcon} size={22} color={dlIconColor} />
                </Pressable>

                <Pressable
                  onPress={() => { setShowSettings(true); setSettingsView("main"); }}
                  hitSlop={10}
                  style={styles.iconBtn}
                >
                  <Ionicons name="settings-sharp" size={24} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* Center controls */}
            <View style={styles.centerRow}>
              <Pressable
                onPress={() => skip(-10)}
                style={({ pressed }) => [styles.centerBtn, pressed && { opacity: 0.6 }]}
                hitSlop={10}
              >
                <MaterialIcons name="replay-10" size={44} color="#fff" />
              </Pressable>
              <Pressable
                onPress={togglePlay}
                style={({ pressed }) => [styles.playPauseBtn, pressed && { opacity: 0.7 }]}
                hitSlop={10}
              >
                <View style={styles.netflixPlayWrap}>
                  <Text style={styles.netflixN}>N</Text>
                  {isPlaying ? (
                    <View style={styles.nativePauseWrap}>
                      <View style={styles.nativePauseBar} />
                      <View style={styles.nativePauseBar} />
                    </View>
                  ) : (
                    <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} />
                  )}
                </View>
              </Pressable>
              <Pressable
                onPress={() => skip(10)}
                style={({ pressed }) => [styles.centerBtn, pressed && { opacity: 0.6 }]}
                hitSlop={10}
              >
                <MaterialIcons name="forward-10" size={44} color="#fff" />
              </Pressable>
            </View>

            {/* Skip Intro button — Netflix-style, bottom-right above progress bar */}
            {!skipIntroDismissed && position > 30 && position < 240 && duration > 300 && (
              <Pressable
                style={styles.skipIntroBtn}
                onPress={() => {
                  haptic.light();
                  player.currentTime = Math.min(240, duration);
                  setSkipIntroDismissed(true);
                }}
              >
                <Text style={styles.skipIntroBtnText}>Skip Intro</Text>
                <Ionicons name="play-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
              </Pressable>
            )}

            {/* Bottom progress */}
            <View style={styles.bottomBar}>
              <View style={styles.progressRow}>
                <Text style={styles.timeText}>{fmt(position)}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  <View style={[styles.progressKnob, { left: `${progress}%` }]} />
                </View>
                <Text style={styles.timeText}>-{fmt(Math.max(0, duration - position))}</Text>
              </View>

              <View style={styles.bottomActionsRow}>
                {/* Playback speed quick buttons */}
                {([1, 2, 3] as SpeedValue[]).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => { haptic.selection(); setSpeed(s); }}
                    style={[styles.speedChip, speed === s && styles.speedChipActive]}
                  >
                    <Text style={[styles.speedChipText, speed === s && styles.speedChipTextActive]}>
                      {s}x
                    </Text>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => { haptic.light(); setShowSettings(true); setSettingsView("audio"); }}
                  style={({ pressed }) => [styles.qualityChip, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                >
                  <Ionicons name="language" size={12} color="#fff" />
                  <Text style={styles.qualityChipText}>{language}</Text>
                </Pressable>

                <Pressable
                  onPress={() => { haptic.light(); setShowSettings(true); setSettingsView("subtitles"); }}
                  style={({ pressed }) => [styles.qualityChip, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                >
                  <MaterialIcons name="closed-caption" size={14} color="#fff" />
                  <Text style={styles.qualityChipText}>{subtitle}</Text>
                </Pressable>

                {isTV && (
                  <Pressable
                    onPress={() => { haptic.medium(); setShowEpisodes(true); }}
                    style={({ pressed }) => [styles.qualityChip, pressed && { opacity: 0.7 }, { backgroundColor: "rgba(229,9,20,0.2)", borderColor: "rgba(229,9,20,0.4)" }]}
                    hitSlop={6}
                  >
                    <Ionicons name="layers" size={14} color="#e50914" />
                    <Text style={[styles.qualityChipText, { color: "#e50914" }]}>Episodes</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      <Modal transparent visible={showEpisodes} animationType="fade" onRequestClose={() => setShowEpisodes(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEpisodes(false)}>
          <Pressable style={styles.modalDrawer} onPress={e => e.stopPropagation()}>
            <View style={styles.drawerHeader}>
              <Text style={styles.modalTitle}>Episodes</Text>
              <Pressable onPress={() => setShowEpisodes(false)} style={styles.drawerCloseX}>
                <Feather name="x" size={24} color="#fff" />
              </Pressable>
            </View>
            
            {/* Season Selector */}
            {seasons.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonScroll} contentContainerStyle={{ gap: 10 }}>
                {seasons.map((s, i) => (
                  <Pressable
                    key={s.season_number}
                    onPress={() => setSelectedSeasonIdx(i)}
                    style={[styles.speedChip, selectedSeasonIdx === i && styles.speedChipActive]}
                  >
                    <Text style={[styles.speedChipText, selectedSeasonIdx === i && styles.speedChipTextActive]}>
                      {s.name || `Season ${s.season_number}`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <ScrollView style={{ flex: 1 }}>
              {episodes.length > 0 ? (
                episodes.map((ep) => (
                  <Pressable
                    key={ep.id}
                    onPress={() => switchEpisode(seasons[selectedSeasonIdx]?.season_number ?? 1, ep.episode_number)}
                    style={({ pressed }) => [
                      styles.epModalRow,
                      pressed && { backgroundColor: "rgba(255,255,255,0.05)" },
                      initialSeason === (seasons[selectedSeasonIdx]?.season_number ?? 1) && initialEpisode === ep.episode_number && styles.epActiveRow
                    ]}
                  >
                    <View style={styles.epModalThumbWrap}>
                      <SmartImage
                        source={ep.still_path ? { uri: tmdbImg(ep.still_path, "w300") || "" } : posterUri ? { uri: proxyUrl(posterUri) || "" } : undefined}
                        style={styles.epModalThumb}
                      />
                      {initialSeason === (seasons[selectedSeasonIdx]?.season_number ?? 1) && initialEpisode === ep.episode_number && (
                        <View style={styles.epPlayingIndicator}>
                          <Ionicons name="play" size={16} color="#fff" />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.epModalTitle, initialSeason === (seasons[selectedSeasonIdx]?.season_number ?? 1) && initialEpisode === ep.episode_number && { color: "#e50914" }]} numberOfLines={1}>
                        {ep.episode_number}. {ep.name}
                      </Text>
                      <Text style={styles.epModalDesc} numberOfLines={3}>{ep.overview || "No description available."}</Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={{ color: "#737373", textAlign: "center", marginTop: 40 }}>No episodes found.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>


      {/* Persistent close button — always visible, not hidden by controls timeout */}
      <Pressable
        onPress={onBack}
        hitSlop={14}
        style={styles.persistentCloseBtn}
      >
        <View style={styles.persistentCloseBg}>
          <Feather name="x" size={22} color="#fff" />
        </View>
      </Pressable>

      {/* Settings modal */}
      <Modal
        transparent
        visible={showSettings}
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSettings(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {settingsView === "main" && (
              <>
                <Text style={styles.modalTitle}>Playback Settings</Text>
                <SettingsRow
                  icon={<Ionicons name="language" size={20} color="#fff" />}
                  label="Audio / Language"
                  value={language}
                  onPress={() => setSettingsView("audio")}
                />
                <SettingsRow
                  icon={<MaterialIcons name="closed-caption" size={22} color="#fff" />}
                  label="Subtitles"
                  value={subtitle}
                  onPress={() => setSettingsView("subtitles")}
                />
                <SettingsRow
                  icon={<MaterialIcons name="speed" size={22} color="#fff" />}
                  label="Playback Speed"
                  value={SPEEDS.find((s) => s.value === speed)?.label ?? `${speed}x`}
                  onPress={() => setSettingsView("speed")}
                />
                <Pressable onPress={() => setShowSettings(false)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>Done</Text>
                </Pressable>
              </>
            )}
            {settingsView === "audio" && (
              <OptionsList
                title="Audio / Language"
                options={LANGUAGES}
                selected={language}
                onSelect={(v) => { setLanguage(v as Language); setSettingsView("main"); }}
                onBack={() => setSettingsView("main")}
              />
            )}
            {settingsView === "subtitles" && (
              <OptionsList
                title="Subtitles"
                options={SUBTITLES}
                selected={subtitle}
                onSelect={(v) => { setSubtitle(v as Subtitle); setSettingsView("main"); }}
                onBack={() => setSettingsView("main")}
              />
            )}
            {settingsView === "speed" && (
              <OptionsList
                title="Playback Speed"
                options={SPEEDS.map((s) => s.label)}
                selected={SPEEDS.find((s) => s.value === speed)?.label ?? "1x (Normal)"}
                onSelect={(v) => {
                  const next = SPEEDS.find((s) => s.label === v);
                  if (next) setSpeed(next.value);
                  setSettingsView("main");
                }}
                onBack={() => setSettingsView("main")}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && { backgroundColor: "rgba(255,255,255,0.05)" },
      ]}
    >
      <View style={styles.settingsRowLeft}>
        {icon}
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        <Text style={styles.settingsValue}>{value}</Text>
        <Feather name="chevron-right" size={20} color="#a3a3a3" />
      </View>
    </Pressable>
  );
}

function OptionsList({
  title,
  options,
  selected,
  onSelect,
  onBack,
}: {
  title: string;
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
  onBack: () => void;
}) {
  return (
    <View>
      <View style={styles.optionsHeader}>
        <Pressable onPress={onBack} hitSlop={10}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.modalTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onSelect(opt)}
          style={({ pressed }) => [
            styles.optionRow,
            pressed && { backgroundColor: "rgba(255,255,255,0.05)" },
          ]}
        >
          <Text style={[styles.optionLabel, selected === opt && styles.optionLabelActive]}>
            {opt}
          </Text>
          {selected === opt && <Feather name="check" size={20} color="#e50914" />}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Gesture HUD Styles ────────────────────────────────────────────────────────

const gestureStyles = StyleSheet.create({
  leftHud: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -90,
    width: 44,
    height: 180,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    zIndex: 20,
  },
  rightHud: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -90,
    width: 44,
    height: 180,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    zIndex: 20,
  },
  sliderTrack: {
    flex: 1,
    width: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    marginVertical: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  sliderFill: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  hudPct: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});

// ─── Double-tap seek flash styles ─────────────────────────────────────────────

const tapStyles = StyleSheet.create({
  leftFlash: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "42%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.32)",
    borderTopRightRadius: 80,
    borderBottomRightRadius: 80,
    zIndex: 25,
  },
  rightFlash: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "42%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.32)",
    borderTopLeftRadius: 80,
    borderBottomLeftRadius: 80,
    zIndex: 25,
  },
  seekLabel: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  tapOverlay: { ...StyleSheet.absoluteFillObject },
  webTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: Platform.OS === "android" ? 36 : 52,
    backgroundColor: "rgba(0,0,0,0.55)",
    gap: 10,
  },
  webBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  webTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  // Persistent X — always rendered, top-left, not inside showControls gate
  persistentCloseBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 36 : 52,
    left: 16,
    zIndex: 99,
  },
  persistentCloseBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.60)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  titleText: { flex: 1, color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  centerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 60,
  },
  centerBtn: { padding: 8 },
  playPauseBtn: { padding: 8 },
  netflixPlayWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#e50914",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowColor: "#e50914",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 12,
  },
  netflixN: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: 1,
    position: "absolute",
    top: 7,
    left: 10,
    opacity: 0.9,
  },
  nativePauseWrap: { flexDirection: "row", gap: 6, marginTop: 4 },
  nativePauseBar: { width: 5, height: 28, backgroundColor: "#fff", borderRadius: 3 },
  bottomBar: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    minWidth: 44,
    textAlign: "center",
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    position: "relative",
  },
  progressFill: { height: "100%", backgroundColor: "#e50914", borderRadius: 2 },
  progressKnob: {
    position: "absolute",
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#e50914",
    marginLeft: -7,
  },
  bottomActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  speedChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  speedChipActive: {
    backgroundColor: "#e50914",
    borderColor: "#e50914",
  },
  speedChipText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  speedChipTextActive: {
    color: "#fff",
  },
  qualityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  qualityChipText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },

  // Skip Intro
  skipIntroBtn: {
    position: "absolute",
    right: 16,
    bottom: 96,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 20,
  },
  skipIntroBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },

  // Download bar
  dlBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 20,
  },
  dlBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  dlBarFill: {
    height: "100%",
    backgroundColor: "#34D399",
    borderRadius: 2,
  },
  dlBarText: {
    color: "#34D399",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    minWidth: 32,
    textAlign: "right",
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalDrawer: {
    backgroundColor: "#0d0d0d",
    width: '45%',
    height: '100%',
    padding: 20,
    borderLeftWidth: 1,
    borderLeftColor: "#262626",
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  drawerCloseX: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  seasonScroll: {
    marginBottom: 15,
    flexGrow: 0,
  },
  modalSheet: {
    backgroundColor: "#0d0d0d",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#1e1e1e",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 16,
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e1e1e",
  },
  settingsRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingsRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  settingsLabel: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
  settingsValue: { color: "#737373", fontSize: 13, fontFamily: "Inter_400Regular" },
  modalCloseBtn: {
    marginTop: 18,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  modalCloseText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  optionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
  },
  optionLabel: { color: "#a3a3a3", fontSize: 14, fontFamily: "Inter_400Regular" },
  optionLabelActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },

  // Autoplay Overlay
  autoplayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  autoplayCard: {
    width: "80%",
    maxWidth: 400,
    backgroundColor: "rgba(25,25,25,0.8)",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  autoplayComingUp: {
    color: "#a3a3a3",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  autoplayTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 24,
  },
  autoplayCircleWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(229,9,20,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    borderWidth: 3,
    borderColor: "rgba(229,9,20,0.4)",
  },
  autoplaySeconds: {
    color: "#e50914",
    fontSize: 34,
    fontFamily: "Inter_800ExtraBold",
  },
  autoplayActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  autoplayCancelBtn: {
    flex: 1,
    backgroundColor: "#262626",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  autoplayCancelText: {
    color: "#a3a3a3",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  autoplayNowBtn: {
    flex: 1.5,
    backgroundColor: "#e50914",
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  autoplayNowText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },

  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 5,
    gap: 14,
  },
  bufferText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  bufferSubtext: {
    color: "#555555",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },

  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.80)",
    zIndex: 10,
    gap: 14,
    paddingHorizontal: 32,
  },
  errorOverlayText: {
    color: "#e5e5e5",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: "#e50914",
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  epModalRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e1e1e",
  },
  epActiveRow: {
    backgroundColor: "rgba(229,9,20,0.06)",
  },
  epModalThumbWrap: {
    width: 120,
    height: 68,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  epModalThumb: {
    width: "100%",
    height: "100%",
  },
  epPlayingIndicator: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  epModalTitle: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  epModalDesc: {
    color: "#737373",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },

  // ── PikaShow-style server selector ────────────────────────────────────────
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 6,
  },
  serverRowActive: {
    backgroundColor: "rgba(229,9,20,0.08)",
    borderColor: "rgba(229,9,20,0.3)",
  },
  serverBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  serverBadgeActive: {
    backgroundColor: "#e50914",
  },
  serverBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  serverName: {
    color: "#e5e5e5",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  serverType: {
    color: "#525252",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  serverActiveDot: {
    marginLeft: "auto",
  },
});
