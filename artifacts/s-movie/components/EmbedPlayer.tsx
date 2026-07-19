/**
 * EmbedPlayer — v3.0 Netflix-style WebView player
 *
 * Improvements over v2:
 *   • Source racer: on mount, HEAD-pings all servers concurrently and sorts
 *     them fastest-first. Auto-switch hits the already-confirmed best server.
 *   • Also fires /api/stream/race (backend) for server-side latency data.
 *   • Aggressive ad/overlay blocking: eliminates popups, full-screen ads,
 *     redirect navigations, cookie banners, and overlay divs via CSS + JS.
 *   • Video plays as-is inside the WebView — looks clean and Netflix-like
 *     because all third-party chrome/ads are stripped.
 *   • No server-selection buttons shown to the user ever.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { raceSourceLatency, type RacedSource } from "@/lib/sourceRacer";
import { getApiBase } from "@/lib/streamingService";

// ─── Source definitions ────────────────────────────────────────────────────────

export interface EmbedSource {
  name: string;
  subtitle: string;
  urlMovie: (tmdbId: number) => string;
  urlTV: (tmdbId: number, season: number, episode: number) => string;
}

export const EMBED_SOURCES: EmbedSource[] = [
  {
    name: "SmashyStream",
    subtitle: "Fast · Hindi · Multi Quality",
    urlMovie: (id) => `https://embed.smashystream.com/playere.php?tmdb=${id}`,
    urlTV: (id, s, e) => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    name: "EmbedSu",
    subtitle: "HD · Reliable",
    urlMovie: (id) => `https://embed.su/embed/movie/${id}`,
    urlTV: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "SuperEmbed",
    subtitle: "India-Friendly · Multi-Source",
    urlMovie: (id) => `https://superembed.stream/embed/movie/${id}`,
    urlTV: (id, s, e) => `https://superembed.stream/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "MoviesAPI",
    subtitle: "Hindi · Fast",
    urlMovie: (id) => `https://moviesapi.club/movie/${id}`,
    urlTV: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}`,
  },
  {
    name: "VidLink",
    subtitle: "HD · Clean",
    urlMovie: (id) => `https://vidlink.pro/movie/${id}`,
    urlTV: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    name: "AutoEmbed",
    subtitle: "Fast · Hindi Dub",
    urlMovie: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    urlTV: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "2Embed",
    subtitle: "Hindi Dub",
    urlMovie: (id) => `https://www.2embed.cc/embed/${id}`,
    urlTV: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    name: "Rive",
    subtitle: "Multi-CDN",
    urlMovie: (id) => `https://rive.stream/e/${id}`,
    urlTV: (id, s, e) => `https://rive.stream/e/${id}?s=${s}&e=${e}`,
  },
  {
    name: "Nepu",
    subtitle: "Backup Server",
    urlMovie: (id) => `https://nepu.to/embed/movie?tmdb=${id}`,
    urlTV: (id, s, e) => `https://nepu.to/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    name: "CineBy",
    subtitle: "Alternate",
    urlMovie: (id) => `https://www.cineby.sc/movie/${id}`,
    urlTV: (id, s, e) => `https://www.cineby.sc/tv/${id}?season=${s}&episode=${e}`,
  },
  {
    name: "VidSrc.xyz",
    subtitle: "Classic · Fast",
    urlMovie: (id) => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
    urlTV: (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    name: "VidSrc.to",
    subtitle: "Reliable · HD",
    urlMovie: (id) => `https://vidsrc.to/embed/movie/${id}`,
    urlTV: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "VidSrc.me",
    subtitle: "Classic · Reliable",
    urlMovie: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    urlTV: (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    name: "VidBinge",
    subtitle: "Multi-CDN · Fast",
    urlMovie: (id) => `https://vidbinge.dev/embed/movie/${id}`,
    urlTV: (id, s, e) => `https://vidbinge.dev/embed/tv/${id}/${s}/${e}`,
  },
  // India-friendly extras ────────────────────────────────────────────────────
  {
    name: "HDToday",
    subtitle: "India · HD",
    urlMovie: (id) => `https://hdtodayz.net/embed/movie/${id}`,
    urlTV: (id, s, e) => `https://hdtodayz.net/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "RiveStream",
    subtitle: "India · Multi-CDN",
    urlMovie: (id) => `https://rivestream.ru/embed/movie/${id}`,
    urlTV: (id, s, e) => `https://rivestream.ru/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "123MoviesRulz",
    subtitle: "India · Fast",
    urlMovie: (id) => `https://123moviesrulz.online/embed/movie/${id}`,
    urlTV: (id, s, e) => `https://123moviesrulz.online/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "XPrime",
    subtitle: "Hindi · HD",
    urlMovie: (id) => `https://xprime.stream/movie/${id}`,
    urlTV: (id, s, e) => `https://xprime.stream/tv/${id}/${s}/${e}`,
  },
  // MultiEmbed (multiembed.mov) removed — actively returns 403 (blocked)
];

// ─── Timing constants ──────────────────────────────────────────────────────────

const AUTO_SWITCH_MS   = 12000; // switch server if no video after 12s
const NEXT_EP_COUNTDOWN = 5;    // seconds before auto-playing next episode

// ─── Ad-blocking JS — injected BEFORE page content loads ──────────────────────
// Runs in the WebView's isolated JS context. Blocks popup windows, disables
// webdriver fingerprinting, and intercepts redirect attempts.
const INJECT_BEFORE = `
(function() {
  try {
    // Anti-fingerprinting
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'hi'] });
  } catch(e) {}

  // Block popup windows entirely
  window.open = function() { return null; };
  window.alert = function() {};
  window.confirm = function() { return false; };
  window.prompt = function() { return null; };

  // Block redirect navigation attempts (common in ad scripts)
  var _pushState = history.pushState.bind(history);
  var _replaceState = history.replaceState.bind(history);
  Object.defineProperty(window, 'location', {
    get: function() { return window._safeLocation || location; },
    configurable: true,
  });

  // Block common ad SDK loaders
  var AD_DOMAINS = [
    'doubleclick', 'googlesyndication', 'adservice', 'popads', 'popcash',
    'exoclick', 'trafficjunky', 'adnxs', 'adsystem', 'adform',
    'pubmatic', 'rubiconproject', 'openx', 'criteo', 'taboola',
    'outbrain', 'media.net', 'valueimpression', 'mgid',
  ];
  var _fetch = window.fetch;
  window.fetch = function(url) {
    var s = String(url || '');
    for (var i = 0; i < AD_DOMAINS.length; i++) {
      if (s.indexOf(AD_DOMAINS[i]) !== -1) return Promise.reject(new Error('blocked'));
    }
    return _fetch.apply(this, arguments);
  };
  var _XHR = window.XMLHttpRequest;
  var _XHROpen = _XHR.prototype.open;
  _XHR.prototype.open = function(m, url) {
    var s = String(url || '');
    for (var i = 0; i < AD_DOMAINS.length; i++) {
      if (s.indexOf(AD_DOMAINS[i]) !== -1) { this._blocked = true; return; }
    }
    return _XHROpen.apply(this, arguments);
  };
  var _XHRSend = _XHR.prototype.send;
  _XHR.prototype.send = function() { if (this._blocked) return; return _XHRSend.apply(this, arguments); };

  true;
})();
`;

// ─── Ad-blocking CSS + event listeners — injected AFTER page loads ────────────
// Hides overlay/popup divs, prevents navigation hijacking, detects video events.
const INJECT_AFTER = `
(function(){
  // ── CSS: nuke overlays, popups, banners, cookie notices ─────────────────────
  var adCss = [
    '#popup', '#overlay', '#ad-overlay', '#advertisement',
    '.popup', '.popup-overlay', '.ad-overlay', '.ads-overlay',
    '.modal-backdrop', '#gdpr-overlay', '.cookie-consent', '.cookie-banner',
    '[class*="popup"]', '[id*="popup"]',
    '[class*="overlay"]:not(video)', '[id*="overlay"]:not(video)',
    '[class*="ad-"]', '[id*="ad-"]',
    '[class*="banner"]', '[id*="banner"]',
    'iframe[src*="ads"]', 'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]', 'iframe[src*="adservice"]',
    '[id*="advert"]', '[class*="advert"]',
    '.interstitial', '#interstitial', '.overlay-container',
    '.vjs-text-track-display .vjs-modal-dialog',
    '.plyr__ads', '.ima-ad-container',
    // Common Cloudflare / anti-bot overlays
    '#challenge-running', '#challenge-form',
  ].join(',') + '{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}';

  var style = document.createElement('style');
  style.id = '__smovie_blocker';
  style.textContent = adCss;
  (document.head || document.documentElement).appendChild(style);

  // ── Block script-created popups ───────────────────────────────────────────
  window.open = function() { return null; };
  window.alert = function() {};
  window.confirm = function() { return false; };

  // ── Block only true popup/new-tab link clicks ─────────────────────────────
  // Do NOT block external href navigations — many embed players use <a href>
  // to navigate to their video CDN or internal player pages. Blocking these
  // was preventing the Play button from working on SmashyStream, SuperEmbed, etc.
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var target = el.getAttribute('target') || '';
    var href = el.getAttribute('href') || '';
    // Only block _blank (new tab) attempts and ad domain links
    var AD_HOSTS = ['doubleclick', 'googlesyndication', 'adservice', 'popads', 'exoclick'];
    var isAd = AD_HOSTS.some(function(d) { return href.indexOf(d) !== -1; });
    if (target === '_blank' || isAd) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ── Video event forwarding to React Native ────────────────────────────────
  function onVideoEvent(eventName) {
    return function() {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(eventName);
    };
  }

  var attachedVideos = new WeakSet();

  function attachToVideo(video) {
    if (attachedVideos.has(video)) return;
    attachedVideos.add(video);

    // Remove controls from video element so we own the UI layer
    video.removeAttribute('controls');

    video.addEventListener('playing',  onVideoEvent('video_playing'));
    video.addEventListener('canplay',  onVideoEvent('video_canplay'));
    video.addEventListener('ended',    onVideoEvent('video_ended'));
    video.addEventListener('error',    onVideoEvent('video_error'));
    video.addEventListener('waiting',  onVideoEvent('video_buffering'));
    video.addEventListener('timeupdate', function() {
      if (video.duration > 0 && video.currentTime / video.duration > 0.95) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage('video_near_end');
      }
    });

    // Auto-unmute if muted by default (common on embed sites)
    if (video.muted) {
      video.muted = false;
      video.volume = 1;
    }
  }

  // Attach to videos already in the DOM
  document.querySelectorAll('video').forEach(attachToVideo);

  // Watch for dynamically added videos and new overlay divs
  var mo = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'VIDEO') attachToVideo(node);
        var vids = node.querySelectorAll && node.querySelectorAll('video');
        if (vids) vids.forEach(attachToVideo);
        // Hide dynamically-inserted ad overlays
        var isDomAd = (node.id || node.className || '').match(/popup|overlay|ad[-_]|banner|interstitial/i);
        if (isDomAd) {
          node.style.cssText += ';display:none!important;visibility:hidden!important;';
        }
      });
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // ── Block iframe-in-iframe redirect attacks ───────────────────────────────
  document.querySelectorAll('iframe').forEach(function(f) {
    var src = f.src || '';
    var AD_PATS = ['doubleclick', 'googlesyndication', 'adservice', 'popads', 'exoclick', 'trafficjunky'];
    for (var i = 0; i < AD_PATS.length; i++) {
      if (src.indexOf(AD_PATS[i]) !== -1) { f.remove(); return; }
    }
  });

  true;
})();
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmbedPlayerProps {
  tmdbId:       number;
  mediaType:    "movie" | "tv";
  season?:      number;
  episode?:     number;
  title?:       string;
  nextEpisode?: { season: number; episode: number } | null;
  onBack?:      () => void;
  onNextEpisode?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmbedPlayer({
  tmdbId,
  mediaType,
  season  = 1,
  episode = 1,
  title,
  nextEpisode,
  onBack,
  onNextEpisode,
}: EmbedPlayerProps) {
  // Source ordering — starts as default array index, re-sorted after latency race
  const [sourceOrder, setSourceOrder] = useState<number[]>(
    EMBED_SOURCES.map((_, i) => i),
  );
  const [orderIdx, setOrderIdx]   = useState(0); // index into sourceOrder
  const [loading, setLoading]     = useState(true);
  const [videoStarted, setVideoStarted] = useState(false);
  const [nextEpCountdown, setNextEpCountdown] = useState<number | null>(null);
  const [raceStatus, setRaceStatus] = useState<"pending" | "done">("pending");

  const webViewRef         = useRef<WebView>(null);
  const autoSwitchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval  = useRef<ReturnType<typeof setInterval> | null>(null);
  const nearEndFired        = useRef(false);
  const progressAnim        = useRef(new Animated.Value(0)).current;
  const progressLoop        = useRef<Animated.CompositeAnimation | null>(null);
  const videoStartedRef    = useRef(false);

  // Keep ref in sync for use inside closures
  useEffect(() => { videoStartedRef.current = videoStarted; }, [videoStarted]);

  const currentSourceIdx = sourceOrder[orderIdx] ?? 0;
  const currentSource    = EMBED_SOURCES[currentSourceIdx];
  const embedUrl =
    mediaType === "movie"
      ? currentSource.urlMovie(tmdbId)
      : currentSource.urlTV(tmdbId, season, episode);

  // ── Latency race on mount ─────────────────────────────────────────────────
  // Fire HEAD probes to all sources concurrently. Sort the source order by
  // measured latency. The first auto-switch will go to the second fastest
  // (winner is already loaded), and so on.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const cacheKey = `ep-${tmdbId}-${mediaType}-${season}-${episode}`;
      const inputs = EMBED_SOURCES.map((src) => ({
        url:    mediaType === "movie" ? src.urlMovie(tmdbId) : src.urlTV(tmdbId, season, episode),
        source: src.name,
      }));

      // Client-side race
      const clientRace = raceSourceLatency(inputs, 2500, cacheKey);

      // Server-side race (backend HEAD probes — more reliable behind server IP)
      // Uses apiClient so auth token + X-S-Movie-Client header are injected — /api/stream/race is protected
      const serverRace = import("@/lib/apiClient").then(({ apiClient }) =>
        apiClient.get<{ ranked: { url: string; source: string; latencyMs: number; ok: boolean }[] }>(
          "/stream/race",
          { id: String(tmdbId), type: mediaType, season: String(season), episode: String(episode) },
          { timeoutMs: 5000 },
        ).catch(() => null)
      ).catch(() => null);

      // Use whichever resolves first, merge second result in
      const [clientResult, serverResult] = await Promise.all([clientRace, serverRace]);
      if (cancelled) return;

      // Build name → latency maps from both sources
      const latencyMap = new Map<string, number>();

      // Server-side results (more authoritative — behind server IP)
      if (serverResult?.ranked) {
        for (const r of serverResult.ranked) {
          if (r.ok) latencyMap.set(r.source.toLowerCase(), r.latencyMs);
        }
      }

      // Client-side results fill gaps
      for (const r of clientResult.ranked) {
        const key = r.source.toLowerCase();
        if (!latencyMap.has(key) && r.ok) latencyMap.set(key, r.latencyMs);
      }

      // Re-sort EMBED_SOURCES indices by latency
      const sorted = EMBED_SOURCES
        .map((src, idx) => {
          const key = src.name.toLowerCase().replace(/\s+/g, "");
          // Match against name, domain-like substrings
          let latency = Infinity;
          for (const [k, v] of latencyMap.entries()) {
            if (key.includes(k) || k.includes(key)) { latency = v; break; }
          }
          return { idx, latency };
        })
        .sort((a, b) => a.latency - b.latency)
        .map((x) => x.idx);

      setSourceOrder(sorted);
      setRaceStatus("done");

      // If first source hasn't started video yet, switch to confirmed fastest
      if (!videoStartedRef.current && sorted[0] !== currentSourceIdx) {
        setOrderIdx(0); // re-point to the now-sorted fastest
      }
    };

    run().catch(() => {});
    return () => { cancelled = true; };
  }, [tmdbId, mediaType, season, episode]);

  // ── Auto-switch timer ─────────────────────────────────────────────────────
  const switchToNext = useCallback(() => {
    if (videoStartedRef.current) return;
    setOrderIdx((prev) => {
      const next = prev + 1;
      if (next >= sourceOrder.length) return prev; // all exhausted — stay
      return next;
    });
  }, [sourceOrder.length]);

  const startAutoSwitchTimer = useCallback(() => {
    if (autoSwitchTimer.current) clearTimeout(autoSwitchTimer.current);
    autoSwitchTimer.current = setTimeout(() => {
      if (!videoStartedRef.current) switchToNext();
    }, AUTO_SWITCH_MS);
  }, [switchToNext]);

  useEffect(() => {
    if (videoStarted && autoSwitchTimer.current) clearTimeout(autoSwitchTimer.current);
  }, [videoStarted]);

  // Reset on source change
  useEffect(() => {
    setLoading(true);
    setVideoStarted(false);
    videoStartedRef.current = false;
    nearEndFired.current = false;
    startAutoSwitchTimer();
    return () => { if (autoSwitchTimer.current) clearTimeout(autoSwitchTimer.current); };
  }, [orderIdx, tmdbId, season, episode]);

  // ── Loading pulse animation ───────────────────────────────────────────────
  useEffect(() => {
    if (loading && !videoStarted) {
      progressAnim.setValue(0);
      progressLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(progressAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      progressLoop.current.start();
    } else {
      progressLoop.current?.stop();
    }
    return () => progressLoop.current?.stop();
  }, [loading, videoStarted]);

  // ── Next-episode countdown ────────────────────────────────────────────────
  const startNextEpCountdown = useCallback(() => {
    if (!nextEpisode || !onNextEpisode) return;
    setNextEpCountdown(NEXT_EP_COUNTDOWN);
    countdownInterval.current = setInterval(() => {
      setNextEpCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval.current!);
          onNextEpisode();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [nextEpisode, onNextEpisode]);

  useEffect(() => {
    return () => { if (countdownInterval.current) clearInterval(countdownInterval.current); };
  }, []);

  // ── WebView message handler ───────────────────────────────────────────────
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const msg = event.nativeEvent.data;
      if (msg === "video_playing" || msg === "video_canplay") {
        setVideoStarted(true);
        videoStartedRef.current = true;
        setLoading(false);
      }
      if (msg === "video_ended") startNextEpCountdown();
      if (msg === "video_near_end" && !nearEndFired.current && mediaType === "tv") {
        nearEndFired.current = true;
        startNextEpCountdown();
      }
      if (msg === "video_error") {
        if (!videoStartedRef.current) switchToNext();
      }
    },
    [startNextEpCountdown, mediaType, switchToNext],
  );

  const handleLoadStart = useCallback(() => { setLoading(true); }, []);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    webViewRef.current?.injectJavaScript(INJECT_AFTER);
    startAutoSwitchTimer();
  }, [startAutoSwitchTimer]);

  const handleError = useCallback(() => {
    setLoading(false);
    if (!videoStartedRef.current) switchToNext();
  }, [switchToNext]);

  const cancelNextEp = useCallback(() => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setNextEpCountdown(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* WebView */}
      <WebView
        ref={webViewRef}
        key={`embed-${currentSourceIdx}-${tmdbId}-${season}-${episode}`}
        source={{ uri: embedUrl }}
        style={StyleSheet.absoluteFill}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        allowsProtectedMedia
        mixedContentMode="always"
        originWhitelist={["*"]}
        injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE}
        userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36"
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleError}
        onMessage={handleMessage}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => {
          const url = req.url ?? "";
          // Only block known ad/tracking domains — allow ALL other navigations
          // including CDN redirects that deliver the actual video stream.
          // Previously we blocked "other" navigationType for non-source domains
          // which was stopping video CDN redirects and preventing playback.
          const blocked = [
            "doubleclick", "googlesyndication", "adservice", "popads",
            "popcash", "exoclick", "trafficjunky", "adnxs", "taboola",
            "outbrain", "media.net", "mgid", "valueimpression", "pubmatic",
            "adform", "rubiconproject", "openx", "criteo",
          ];
          if (blocked.some((d) => url.includes(d))) return false;
          return true;
        }}
      />

      {/* Loading Overlay */}
      {loading && !videoStarted && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <Animated.View
            style={[styles.loadingLogo, {
              opacity: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
            }]}
          >
            <View style={styles.sIcon}>
              <Text style={styles.sIconText}>S</Text>
            </View>
          </Animated.View>

          <Text style={styles.loadingTitle}>{currentSource.name}</Text>
          <Text style={styles.loadingSubtitle}>
            {currentSource.subtitle}
            {raceStatus === "pending" ? " · Selecting fastest server..." : " · Connecting..."}
          </Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, {
                transform: [{
                  translateX: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-140, 140],
                  }),
                }],
              }]}
            />
          </View>

          <Text style={styles.autoNote}>
            {raceStatus === "pending"
              ? "Auto-selecting fastest server..."
              : `Auto-switching if slow · ${EMBED_SOURCES.length - orderIdx - 1} backups ready`}
          </Text>
        </View>
      )}

      {/* Top bar: back + title + live server indicator */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          onPress={onBack}
        >
          <BlurView intensity={60} tint="dark" style={styles.iconBtnBlur}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </BlurView>
        </Pressable>

        {title ? (
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
            {mediaType === "tv" ? `  S${season}:E${episode}` : ""}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {videoStarted && (
          <View style={styles.serverPill}>
            <View style={styles.serverDot} />
            <Text style={styles.serverPillText}>{currentSource.name}</Text>
          </View>
        )}
      </View>

      {/* Next Episode Countdown Banner */}
      {nextEpCountdown !== null && nextEpisode && (
        <View style={styles.nextEpBanner}>
          <BlurView intensity={80} tint="dark" style={styles.nextEpInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextEpLabel}>Next Episode</Text>
              <Text style={styles.nextEpInfo}>
                S{nextEpisode.season} · E{nextEpisode.episode} · playing in {nextEpCountdown}s
              </Text>
            </View>
            <Pressable style={styles.nextEpPlayBtn} onPress={onNextEpisode}>
              <Feather name="skip-forward" size={18} color="#fff" />
            </Pressable>
            <Pressable style={styles.nextEpCancelBtn} onPress={cancelNextEp}>
              <Text style={styles.nextEpCancelText}>Cancel</Text>
            </Pressable>
          </BlurView>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  loadingLogo: {
    marginBottom: 8,
  },
  sIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#E50914",
    justifyContent: "center",
    alignItems: "center",
  },
  sIconText: {
    color: "#fff",
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    lineHeight: 44,
  },
  loadingTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  loadingSubtitle: {
    color: "#888",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  progressTrack: {
    width: 140,
    height: 3,
    backgroundColor: "#222",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 20,
  },
  progressFill: {
    width: 70,
    height: "100%",
    backgroundColor: "#E50914",
    borderRadius: 2,
  },
  autoNote: {
    color: "#444",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 100,
  },
  iconBtn: {
    borderRadius: 24,
    overflow: "hidden",
  },
  iconBtnBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  titleText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  serverPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  serverDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2ecc71",
  },
  serverPillText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  nextEpBanner: {
    position: "absolute",
    bottom: 40,
    right: 16,
    left: 16,
    borderRadius: 16,
    overflow: "hidden",
    zIndex: 200,
  },
  nextEpInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  nextEpLabel: {
    color: "#E50914",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  nextEpInfo: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  nextEpPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E50914",
    justifyContent: "center",
    alignItems: "center",
  },
  nextEpCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nextEpCancelText: {
    color: "#888",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
