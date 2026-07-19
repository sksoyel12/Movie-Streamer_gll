import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

// ─── Source chain ─────────────────────────────────────────────────────────────
const SOURCE_CHAIN = [
  { name: "fzmovies.cms",         slug: "fzmovies" },
  { name: "vegamovies.global",    slug: "vegamovies" },
  { name: "moviesmod.farm",       slug: "moviesmod" },
  { name: "kisskh.com",           slug: "kisskh" },
  { name: "mlwbd.st",             slug: "mlwbd" },
  { name: "southfreak.wiki",      slug: "southfreak" },
  { name: "mkvcinemas.cat",       slug: "mkvcinemas" },
  { name: "animeworldindia.com",  slug: "animeworld" },
  { name: "minoplres.xyz",        slug: "minoplres" },
  { name: "netnaija.com",         slug: "netnaija" },
];

const FILE_SIZES = [33.1, 45.4, 66.6, 76.4, 95.5, 108.2, 150.0, 175.5, 220.6];
const UPLOADERS = [
  "Hussain Omran",
  "Tehua Juvenal",
  "iam_ikeonyema",
  "Mouâtamid Rafouri",
  "Hota",
  "BIPIN SUBEDI",
  "CineStreamHD",
  "AnimeDubber",
  "StreamBot2K",
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildSourceMeta(title: string, domain: string, slug: string) {
  const size = FILE_SIZES[Math.floor(Math.random() * FILE_SIZES.length)];
  const uploader = rand(UPLOADERS);

  const year = 2023 + Math.floor(Math.random() * 3);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  const date = `${year}-${month}-${day}`;

  const titleSlug = title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-");
  const quality = rand(["1080P", "720P", "480P", "360P"]);

  let url: string;
  if (slug === "ailok") {
    url = `https://ailok.pe/info/${title}/S1E1-${quality}`;
  } else if (slug === "ugcvideo") {
    url = `https://www.ugc-video.com/BT4-tv-${titleSlug}-episode-1-${quality}`;
  } else if (slug === "vegamovies") {
    const hash = Math.random().toString(36).slice(2, 10);
    url = `https://vegamovies.pet/${hash}/season-1/episode-1-${quality}.mp4`;
  } else if (slug === "fzmovies" || slug === "fzmovie") {
    url = `https://www.${domain}/tv-${titleSlug}_1_1_${quality}-.html/season-1/epis...`;
  } else {
    url = `https://${domain}/${titleSlug}/s01e01-${quality}.mp4`;
  }

  return { size, uploader, date, url, domain };
}

interface Props {
  visible: boolean;
  title?: string;
  onComplete: () => void;
}

type Phase = "scanning" | "found";

const { height: SCREEN_H } = Dimensions.get("window");

export default function AnalysingModal({ visible, title, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("scanning");
  const [currentDomain, setCurrentDomain] = useState("");
  const [subtitlesDone, setSubtitlesDone] = useState(false);
  const [sourceMeta, setSourceMeta] = useState<ReturnType<typeof buildSourceMeta> | null>(null);

  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  const push = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  };

  // Slide in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  // Animated dots
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(dotAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (!visible) {
      clearAll();
      setPhase("scanning");
      setCurrentDomain("");
      setSubtitlesDone(false);
      setSourceMeta(null);
      fadeAnim.setValue(0);
      return;
    }

    // Randomly pick how many domains to "fail" before success (1–4)
    const failCount = 1 + Math.floor(Math.random() * 4);
    const successIdx = Math.min(failCount, SOURCE_CHAIN.length - 1);
    const chain = SOURCE_CHAIN.slice(0, successIdx + 1);

    let cursor = 300;

    chain.forEach(({ name }, idx) => {
      const isLast = idx === chain.length - 1;
      push(() => setCurrentDomain(name), cursor);
      cursor += isLast ? 800 : 450 + Math.random() * 250;

      if (isLast) {
        // Subtitles flash
        push(() => setSubtitlesDone(true), cursor - 200);

        // Switch to found phase
        push(() => {
          const winner = chain[chain.length - 1];
          const meta = buildSourceMeta(title ?? "Unknown", winner.name, winner.slug);
          setSourceMeta(meta);
          setPhase("found");
          Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        }, cursor);

        // Auto-dismiss after 2s
        push(() => { clearAll(); onComplete(); }, cursor + 2000);
      }
    });

    return clearAll;
  }, [visible]);

  const displayTitle = title && title.length > 36 ? title.slice(0, 33) + "…" : (title ?? "Unknown");

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <View style={styles.backdrop} pointerEvents="none" />

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {phase === "scanning" ? (
          /* ── Scanning phase ─────────────────────────────────────────── */
          <View style={styles.scanBody}>
            {/* Spinner + analysing text */}
            <View style={styles.scanRow}>
              <ActivityIndicator size="small" color="#4FC3F7" />
              <View style={styles.scanTextWrap}>
                <Text style={styles.analysingLabel}>
                  Analysing from{" "}
                  <Text style={styles.domainHighlight}>[{currentDomain || "…"}]</Text>
                </Text>
                {subtitlesDone && (
                  <Text style={styles.subtitleLine}>Subtitles downloaded successfully</Text>
                )}
              </View>
            </View>

            {/* Source dots strip */}
            <View style={styles.dotsStrip}>
              {SOURCE_CHAIN.slice(0, 6).map((s) => {
                const isDone = SOURCE_CHAIN.findIndex(x => x.name === currentDomain) >
                               SOURCE_CHAIN.findIndex(x => x.name === s.name);
                const isCurrent = s.name === currentDomain;
                return (
                  <View key={s.name} style={styles.dotItem}>
                    <View style={[
                      styles.dot,
                      isDone && styles.dotDone,
                      isCurrent && styles.dotActive,
                    ]} />
                    <Text style={[styles.dotLabel, isCurrent && styles.dotLabelActive]}>
                      {s.slug}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          /* ── Found phase — source info card ─────────────────────────── */
          <Animated.View style={[styles.foundBody, { opacity: fadeAnim }]}>
            {/* Top row: title + close */}
            <View style={styles.foundTitleRow}>
              <Text style={styles.foundTitle} numberOfLines={1}>{displayTitle}</Text>
              <Pressable onPress={() => { clearAll(); onComplete(); }} hitSlop={10}>
                <Text style={styles.closeX}>✕</Text>
              </Pressable>
            </View>

            {/* URL */}
            {sourceMeta && (
              <Text style={styles.foundUrl} numberOfLines={2} selectable>
                {sourceMeta.url}
              </Text>
            )}

            <View style={styles.metaDivider} />

            {/* Metadata rows */}
            {sourceMeta && (
              <>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Source:</Text>
                  <Text style={styles.metaValue}>
                    <Text style={styles.metaLink}>{sourceMeta.domain}</Text>
                    {" etc."}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Size:</Text>
                  <Text style={styles.metaValue}>{sourceMeta.size}MB</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Date:</Text>
                  <Text style={styles.metaValue}>{sourceMeta.date}</Text>
                </View>

                <View style={styles.metaDivider} />

                <Text style={styles.uploaderText}>
                  The Source is uploaded by{" "}
                  <Text style={styles.uploaderName}>{sourceMeta.uploader}</Text>
                  {" etc."}
                </Text>

                {/* Auto-close progress bar */}
                <AutoCloseBar durationMs={2000} color="#4FC3F7" />
              </>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Thin auto-close progress bar ─────────────────────────────────────────────
function AutoCloseBar({ durationMs, color }: { durationMs: number; color: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: 100,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.autoBarTrack}>
      <Animated.View
        style={[
          styles.autoBarFill,
          { width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }), backgroundColor: color },
        ]}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(12,12,12,0.98)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
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
    marginBottom: 14,
  },

  // ── Scanning phase
  scanBody: { paddingHorizontal: 18, gap: 16 },
  scanRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  scanTextWrap: { flex: 1, gap: 6 },
  analysingLabel: {
    color: "#d4d4d4",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  domainHighlight: {
    color: "#4FC3F7",
    fontFamily: "Inter_700Bold",
  },
  subtitleLine: {
    color: "#a3a3a3",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  dotsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dotItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#2a2a2a" },
  dotActive: { backgroundColor: "#FBBF24" },
  dotDone: { backgroundColor: "#22c55e" },
  dotLabel: { color: "#404040", fontSize: 10, fontFamily: "Inter_400Regular" },
  dotLabelActive: { color: "#FBBF24", fontFamily: "Inter_600SemiBold" },

  // ── Found phase
  foundBody: { paddingHorizontal: 18, gap: 0 },
  foundTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  foundTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
    marginRight: 10,
  },
  closeX: {
    color: "#737373",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  foundUrl: {
    color: "#737373",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginBottom: 10,
  },
  metaDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginVertical: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  metaKey: {
    color: "#737373",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    width: 54,
  },
  metaValue: {
    color: "#d4d4d4",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  metaLink: {
    color: "#4FC3F7",
    fontFamily: "Inter_600SemiBold",
  },
  uploaderText: {
    color: "#737373",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  uploaderName: {
    color: "#a3a3a3",
    fontFamily: "Inter_600SemiBold",
  },

  // Auto-close progress bar
  autoBarTrack: {
    marginTop: 14,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1,
    overflow: "hidden",
  },
  autoBarFill: {
    height: "100%",
    borderRadius: 1,
  },
});
