import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Image } from "expo-image";

import {
  QUALITY_OPTIONS,
  addSeries,
  buildSeason,
  deleteSeries,
  getAllSeries,
  scrapeSeriesFromUrl,
  type ExternalSeries,
  type Quality,
} from "@/lib/externalSeries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Add-Source Modal ─────────────────────────────────────────────────────────

interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: (s: ExternalSeries) => void;
}

function AddSourceModal({ visible, onClose, onAdded }: AddModalProps) {
  const [url,      setUrl]      = useState("");
  const [title,    setTitle]    = useState("");
  const [year,     setYear]     = useState("");
  const [genre,    setGenre]    = useState("");
  const [seasons,  setSeasons]  = useState("1");
  const [episodes, setEpisodes] = useState("8");
  const [scraping, setScraping] = useState(false);

  const reset = () => {
    setUrl(""); setTitle(""); setYear(""); setGenre("");
    setSeasons("1"); setEpisodes("8"); setScraping(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true);
    try {
      const meta = await scrapeSeriesFromUrl(url.trim());
      if (meta.title)  setTitle(meta.title);
      if (meta.year)   setYear(meta.year);
      if (meta.genre)  setGenre(meta.genre);
    } finally {
      setScraping(false);
    }
  };

  const handleAdd = () => {
    const t = title.trim() || "Untitled Series";
    const sCount = Math.max(1, Math.min(20, parseInt(seasons, 10) || 1));
    const eCount = Math.max(1, Math.min(50, parseInt(episodes, 10) || 8));

    const entry: ExternalSeries = {
      id:        uid(),
      title:     t,
      sourceUrl: url.trim() || "https://",
      year:      year.trim() || undefined,
      genre:     genre.trim() || undefined,
      seasons:   Array.from({ length: sCount }, (_, i) => buildSeason(i + 1, eCount)),
      addedAt:   Date.now(),
    };
    addSeries(entry);
    onAdded(entry);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.modalSheet}>
          {/* Handle */}
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>Add Series Source</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* URL row */}
            <Text style={styles.label}>Page URL</Text>
            <View style={styles.urlRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="https://example.com/series-page"
                placeholderTextColor="#555"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Pressable
                style={[styles.scrapeBtn, scraping && { opacity: 0.5 }]}
                onPress={handleScrape}
                disabled={scraping}
              >
                {scraping
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="zap" size={15} color="#fff" />}
              </Pressable>
            </View>
            <Text style={styles.hint}>
              Tap ⚡ to auto-fill metadata (stub — wire your scraper in{" "}
              <Text style={styles.hintCode}>lib/externalSeries.ts</Text>)
            </Text>

            {/* Title */}
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Series name"
              placeholderTextColor="#555"
              value={title}
              onChangeText={setTitle}
            />

            {/* Year + Genre row */}
            <View style={styles.rowTwo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Year</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2024"
                  placeholderTextColor="#555"
                  value={year}
                  onChangeText={setYear}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>Genre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Drama, Action…"
                  placeholderTextColor="#555"
                  value={genre}
                  onChangeText={setGenre}
                />
              </View>
            </View>

            {/* Seasons + Episodes row */}
            <View style={styles.rowTwo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Seasons</Text>
                <TextInput
                  style={styles.input}
                  placeholder="4"
                  placeholderTextColor="#555"
                  value={seasons}
                  onChangeText={setSeasons}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ep / season</Text>
                <TextInput
                  style={styles.input}
                  placeholder="8"
                  placeholderTextColor="#555"
                  value={episodes}
                  onChangeText={setEpisodes}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>

            <Text style={styles.hint}>
              Quality slots (480p · 720p · 1080p) are pre-filled with sample
              MP4s. Edit individual URLs in the series detail view later.
            </Text>

            <Pressable style={styles.addBtn} onPress={handleAdd}>
              <Feather name="plus-circle" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Add to My Sources</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Episode Row ──────────────────────────────────────────────────────────────

interface EpRowProps {
  seriesId: string;
  seriesTitle: string;
  season: number;
  episode: number;
  epTitle: string;
  urls: Record<Quality, string>;
}

function EpisodeRow({ seriesId, seriesTitle, season, episode, epTitle, urls }: EpRowProps) {
  const [selectedQ, setSelectedQ] = useState<Quality>("720p");

  const play = () => {
    const url = urls[selectedQ];
    router.push({
      pathname: "/player",
      params: {
        id:         seriesId,
        season:     String(season),
        episode:    String(episode),
        type:       "tv",
        hdhubUrl:   url,
      },
    });
  };

  return (
    <View style={styles.epRow}>
      <View style={styles.epMeta}>
        <Text style={styles.epNum}>E{episode}</Text>
        <Text style={styles.epTitle} numberOfLines={1}>{epTitle}</Text>
      </View>

      {/* Quality pills */}
      <View style={styles.qualityPills}>
        {QUALITY_OPTIONS.map((q) => (
          <Pressable
            key={q}
            style={[styles.qPill, selectedQ === q && styles.qPillActive]}
            onPress={() => setSelectedQ(q)}
          >
            <Text style={[styles.qPillText, selectedQ === q && styles.qPillTextActive]}>
              {q}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Play */}
      <Pressable style={styles.playBtn} onPress={play}>
        <Ionicons name="play" size={14} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── Series Card ──────────────────────────────────────────────────────────────

interface CardProps {
  series: ExternalSeries;
  onDelete: (id: string) => void;
}

function SeriesCard({ series, onDelete }: CardProps) {
  const [expanded, setExpanded]       = useState(false);
  const [activeSeason, setActiveSeason] = useState(1);

  const handleDelete = () => {
    Alert.alert(
      "Remove Source",
      `Remove "${series.title}" from My Sources?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => { deleteSeries(series.id); onDelete(series.id); },
        },
      ],
    );
  };

  const currentSeason = series.seasons.find((s) => s.season === activeSeason) ?? series.seasons[0];

  return (
    <View style={styles.card}>
      {/* Card header */}
      <Pressable style={styles.cardHeader} onPress={() => setExpanded((v) => !v)}>
        {series.poster
          ? <Image source={{ uri: series.poster }} style={styles.cardPoster} contentFit="cover" />
          : (
            <View style={[styles.cardPoster, styles.cardPosterPlaceholder]}>
              <Feather name="film" size={22} color="#555" />
            </View>
          )
        }

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{series.title}</Text>
          <View style={styles.cardMeta}>
            {series.year  && <Text style={styles.metaChip}>{series.year}</Text>}
            {series.genre && <Text style={styles.metaChip}>{series.genre}</Text>}
            <Text style={styles.metaChip}>{series.seasons.length} season{series.seasons.length !== 1 ? "s" : ""}</Text>
          </View>
          <Text style={styles.cardUrl} numberOfLines={1}>{series.sourceUrl}</Text>
          <Text style={styles.cardAge}>{timeAgo(series.addedAt)}</Text>
        </View>

        <View style={styles.cardActions}>
          <Pressable style={styles.deleteBtn} onPress={handleDelete} hitSlop={8}>
            <Feather name="trash-2" size={15} color="#E50914" />
          </Pressable>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#888"
          />
        </View>
      </Pressable>

      {/* Expanded episodes */}
      {expanded && (
        <View style={styles.cardBody}>
          {/* Season tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seasonTabs}
          >
            {series.seasons.map((sn) => (
              <Pressable
                key={sn.season}
                style={[styles.seasonTab, activeSeason === sn.season && styles.seasonTabActive]}
                onPress={() => setActiveSeason(sn.season)}
              >
                <Text style={[styles.seasonTabText, activeSeason === sn.season && styles.seasonTabTextActive]}>
                  S{sn.season}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Episodes */}
          <View style={styles.epList}>
            {currentSeason?.episodes.map((ep) => (
              <EpisodeRow
                key={ep.episode}
                seriesId={series.id}
                seriesTitle={series.title}
                season={currentSeason.season}
                episode={ep.episode}
                epTitle={ep.title}
                urls={ep.urls}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SourcesScreen() {
  const [list,    setList]    = useState<ExternalSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllSeries();
    setList(data);
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdded = (s: ExternalSeries) => setList((prev) => [s, ...prev]);
  const handleDelete = (id: string) => setList((prev) => prev.filter((s) => s.id !== id));

  return (
    <View style={styles.screen}>
      {/* Header gradient */}
      <LinearGradient
        colors={["#1a0a0a", "#000"]}
        style={styles.headerGrad}
        pointerEvents="none"
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>My Sources</Text>
          <Text style={styles.topBarSub}>
            {list.length} series · tap a card to browse episodes
          </Text>
        </View>
        <Pressable style={styles.addFab} onPress={() => setModal(true)}>
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Scraper info banner */}
      <View style={styles.infoBanner}>
        <Feather name="info" size={13} color="#E50914" style={{ marginTop: 1 }} />
        <Text style={styles.infoText}>
          URLs are stored locally. Wire your parsing logic inside{" "}
          <Text style={styles.infoCode}>lib/externalSeries.ts → scrapeSeriesFromUrl()</Text>.
          Episode slots use sample MP4s until real URLs are added.
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#E50914" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {list.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="link" size={48} color="#333" />
              <Text style={styles.emptyTitle}>No sources yet</Text>
              <Text style={styles.emptySub}>
                Tap + to add a series page URL and set up seasons / episodes.
              </Text>
            </View>
          ) : (
            list.map((s) => (
              <SeriesCard key={s.id} series={s} onDelete={handleDelete} />
            ))
          )}
          <View style={{ height: 120 }} />
        </Animated.ScrollView>
      )}

      <AddSourceModal
        visible={modal}
        onClose={() => setModal(false)}
        onAdded={handleAdded}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#000" },
  headerGrad:   { position: "absolute", top: 0, left: 0, right: 0, height: 200, zIndex: 0 },

  topBar: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop:  Platform.OS === "ios" ? 58 : 42,
    paddingBottom: 12,
  },
  topBarTitle: { color: "#fff",  fontSize: 22, fontFamily: "Inter_700Bold" },
  topBarSub:   { color: "#666",  fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  addFab: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#E50914",
    alignItems: "center", justifyContent: "center",
  },

  infoBanner: {
    flexDirection:  "row",
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: "rgba(229,9,20,0.08)",
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.18)",
    borderRadius: 10,
    padding: 10,
  },
  infoText: { flex: 1, color: "#aaa", fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  infoCode: { color: "#E50914", fontFamily: "Inter_500Medium" },

  loader:    { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 14 },

  empty:      { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { color: "#fff",  fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySub:   { color: "#555",  fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },

  // ── Card ──
  card: {
    backgroundColor: "#111",
    borderRadius: 14,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e1e1e",
  },
  cardHeader:  { flexDirection: "row", padding: 14, gap: 12, alignItems: "flex-start" },
  cardPoster:  { width: 60, height: 90, borderRadius: 8, backgroundColor: "#1a1a1a" },
  cardPosterPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardInfo:    { flex: 1, gap: 4 },
  cardTitle:   { color: "#fff",  fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  cardMeta:    { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  metaChip: {
    backgroundColor: "#222", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2,
    color: "#aaa", fontSize: 10, fontFamily: "Inter_500Medium",
  },
  cardUrl:  { color: "#444", fontSize: 10, fontFamily: "Inter_400Regular" },
  cardAge:  { color: "#444", fontSize: 10, fontFamily: "Inter_400Regular" },
  cardActions: { alignItems: "center", gap: 8 },
  deleteBtn:   { padding: 4 },

  // ── Card body ──
  cardBody:   {},
  seasonTabs: { paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  seasonTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a",
  },
  seasonTabActive:     { backgroundColor: "#E50914", borderColor: "#E50914" },
  seasonTabText:       { color: "#888", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  seasonTabTextActive: { color: "#fff" },
  epList: { paddingHorizontal: 14, paddingBottom: 14, gap: 6 },

  // ── Episode row ──
  epRow: {
    flexDirection:  "row",
    alignItems:     "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  epMeta:   { width: 90, gap: 1 },
  epNum:    { color: "#E50914", fontSize: 11, fontFamily: "Inter_700Bold" },
  epTitle:  { color: "#ccc",   fontSize: 12, fontFamily: "Inter_400Regular" },
  qualityPills: { flex: 1, flexDirection: "row", gap: 5 },
  qPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    backgroundColor: "#222", borderWidth: 1, borderColor: "#333",
  },
  qPillActive:     { backgroundColor: "#1a3a1a", borderColor: "#2ecc71" },
  qPillText:       { color: "#666", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  qPillTextActive: { color: "#2ecc71" },
  playBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#E50914",
    alignItems: "center", justifyContent: "center",
  },

  // ── Modal ──
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderColor: "#222",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#333",
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: {
    color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 18,
  },
  label: { color: "#888", fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1, borderColor: "#2a2a2a", borderRadius: 10,
    color: "#fff", fontFamily: "Inter_400Regular", fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  urlRow:   { flexDirection: "row", gap: 8 },
  scrapeBtn: {
    width: 44, backgroundColor: "#E50914", borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  hint: {
    color: "#555", fontSize: 11, fontFamily: "Inter_400Regular",
    marginTop: 6, lineHeight: 16,
  },
  hintCode: { color: "#E50914" },
  rowTwo: { flexDirection: "row" },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 24, marginBottom: 8,
    backgroundColor: "#E50914", borderRadius: 12,
    paddingVertical: 14,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
