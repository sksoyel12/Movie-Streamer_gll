import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

// ─── Fake source chain — cycles at exactly 600ms each ─────────────────────────
// These are all plausible-sounding piracy/aggregator domains.
// NONE are real API calls — this is purely cosmetic UX.
const SOURCE_CHAIN = [
  "123moviesfree.net",
  "fzmovie.net",
  "vegamovies.navy",
  "1377x.to",
  "netnaija.com",
  "moviesmod.farm",
  "fzmovies.ng",
  "hdhub4u.cl",
  "themoviebox.org",
  "mlwbd.st",
  "kisskh.com",
  "flickystream.su",
  "mkvcinemas.cat",
  "moviesapi.club",
];

const CYCLE_MS = 600; // exactly 600ms per source per spec

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Props {
  visible: boolean;
  title?: string;
  onComplete: () => void;
}

const { height: SCREEN_H } = Dimensions.get("window");

export default function AnalysingModal({ visible, title, onComplete }: Props) {
  const [currentDomain, setCurrentDomain] = useState("");
  const [showSubtitleFlash, setShowSubtitleFlash] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const push = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  };

  // Slide in / out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      clearAll();
      setCurrentDomain("");
      setShowSubtitleFlash(false);
      return;
    }

    // Pick a random subset of 4–7 sources to cycle through
    const count = 4 + Math.floor(Math.random() * 4);
    const shuffled = [...SOURCE_CHAIN].sort(() => Math.random() - 0.5);
    const chain = shuffled.slice(0, count);

    let idx = 0;
    setCurrentDomain(chain[0]);

    // Cycle each source at exactly 600ms
    intervalRef.current = setInterval(() => {
      idx++;
      if (idx < chain.length) {
        setCurrentDomain(chain[idx]);
      } else {
        // Done cycling — stop interval
        clearInterval(intervalRef.current!);
        intervalRef.current = null;

        // Show "Subtitles downloaded successfully" for exactly 1 second
        setShowSubtitleFlash(true);
        push(() => {
          setShowSubtitleFlash(false);
          clearAll();
          onComplete();
        }, 1000);
      }
    }, CYCLE_MS);

    return clearAll;
  }, [visible]);

  const displayTitle =
    title && title.length > 36 ? title.slice(0, 33) + "…" : (title ?? "Unknown");

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <View style={styles.backdrop} pointerEvents="none" />

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.movieTitle} numberOfLines={1}>
            {displayTitle}
          </Text>

          {/* Main scanning row */}
          <View style={styles.scanRow}>
            <ActivityIndicator size="small" color="#E50914" />
            <View style={styles.scanTextWrap}>
              {showSubtitleFlash ? (
                <Text style={styles.subtitleLine}>✓ Subtitles downloaded successfully</Text>
              ) : (
                <Text style={styles.analysingLabel}>
                  Analysing from{" "}
                  <Text style={styles.domainHighlight}>
                    {currentDomain ? `[${currentDomain}]` : "[…]"}
                  </Text>
                </Text>
              )}
            </View>
          </View>

          {/* Source dots strip */}
          <View style={styles.dotsStrip}>
            {SOURCE_CHAIN.slice(0, 8).map((s) => {
              const chainIdx = SOURCE_CHAIN.indexOf(currentDomain);
              const dotIdx = SOURCE_CHAIN.indexOf(s);
              const isDone = dotIdx !== -1 && chainIdx !== -1 && dotIdx < chainIdx;
              const isCurrent = s === currentDomain;
              return (
                <View key={s} style={styles.dotItem}>
                  <View
                    style={[
                      styles.dot,
                      isDone && styles.dotDone,
                      isCurrent && styles.dotActive,
                    ]}
                  />
                  <Text style={[styles.dotLabel, isCurrent && styles.dotLabelActive]}>
                    {s.split(".")[0]}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Status line */}
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {showSubtitleFlash
                ? "Stream ready — launching player"
                : "Racing 50+ sources in parallel…"}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,10,10,0.99)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 44,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderBottomWidth: 0,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 16,
  },
  body: {
    paddingHorizontal: 20,
    gap: 14,
  },
  movieTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(229,9,20,0.06)",
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.18)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scanTextWrap: { flex: 1 },
  analysingLabel: {
    color: "#d4d4d4",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  domainHighlight: {
    color: "#E50914",
    fontFamily: "Inter_700Bold",
  },
  subtitleLine: {
    color: "#4ade80",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  dotsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dotItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#2a2a2a" },
  dotActive: { backgroundColor: "#E50914" },
  dotDone: { backgroundColor: "#22c55e" },
  dotLabel: { color: "#404040", fontSize: 10, fontFamily: "Inter_400Regular" },
  dotLabelActive: { color: "#E50914", fontFamily: "Inter_600SemiBold" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E50914",
  },
  statusText: {
    color: "#525252",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
