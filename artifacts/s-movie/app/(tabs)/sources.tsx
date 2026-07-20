/**
 * Source Catalog — All 109 streaming sources organised by category.
 * Movies · Anime · Manga · Live Sports
 */

import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ALL_SOURCES,
  CATEGORY_COUNTS,
  SOURCE_COUNT,
  type SourceCategory,
  type SourceEntry,
  type SourceType,
} from "@/lib/sourceCatalog";

// ─── Category config ──────────────────────────────────────────────────────────

type Tab = "all" | SourceCategory;

const TABS: { id: Tab; label: string; icon: string; color: string }[] = [
  { id: "all",         label: "All",        icon: "layers",       color: "#E50914" },
  { id: "movies",      label: "Movies",     icon: "film",         color: "#3B82F6" },
  { id: "anime",       label: "Anime",      icon: "star",         color: "#8B5CF6" },
  { id: "manga",       label: "Manga",      icon: "book-open",    color: "#10B981" },
  { id: "live-sports", label: "Live",       icon: "radio",        color: "#F59E0B" },
];

const TYPE_META: Record<SourceType, { label: string; color: string; bg: string }> = {
  embed:   { label: "EMBED",   color: "#3B82F6", bg: "rgba(59,130,246,0.15)" },
  scraper: { label: "DL",      color: "#10B981", bg: "rgba(16,185,129,0.15)" },
  reader:  { label: "READER",  color: "#8B5CF6", bg: "rgba(139,92,246,0.15)" },
  live:    { label: "LIVE",    color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
};

// ─── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({ source }: { source: SourceEntry }) {
  const [pressed, setPressed] = useState(false);
  const typeMeta = TYPE_META[source.type];

  const handleOpen = () => {
    Linking.openURL(source.homeUrl).catch(() => {});
  };

  return (
    <Pressable
      style={[styles.card, pressed && styles.cardPressed]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={handleOpen}
    >
      {/* Left: favicon placeholder */}
      <View style={[styles.faviconWrap, { borderColor: typeMeta.color + "44" }]}>
        <Text style={[styles.faviconText, { color: typeMeta.color }]}>
          {source.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Middle: info */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{source.name}</Text>
        <Text style={styles.cardDomain} numberOfLines={1}>{source.domain}</Text>

        <View style={styles.cardTags}>
          {/* Type badge */}
          <View style={[styles.badge, { backgroundColor: typeMeta.bg }]}>
            <Text style={[styles.badgeText, { color: typeMeta.color }]}>{typeMeta.label}</Text>
          </View>

          {/* Indie-friendly badge */}
          {source.indieFriendly && (
            <View style={styles.indieBadge}>
              <Feather name="check-circle" size={9} color="#22C55E" />
              <Text style={styles.indieText}>India</Text>
            </View>
          )}

          {/* Embed indicator */}
          {source.type === "embed" && source.embedMovie && (
            <View style={styles.embedBadge}>
              <Feather name="play" size={9} color="#60A5FA" />
              <Text style={styles.embedBadgeText}>TMDB</Text>
            </View>
          )}
        </View>
      </View>

      {/* Right: open arrow */}
      <View style={styles.cardArrow}>
        <Feather name="external-link" size={14} color="#444" />
      </View>
    </Pressable>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.statsRow}
    >
      {(
        [
          { label: "Total",  count: SOURCE_COUNT,               color: "#E50914" },
          { label: "Movies", count: CATEGORY_COUNTS.movies,      color: "#3B82F6" },
          { label: "Anime",  count: CATEGORY_COUNTS.anime,       color: "#8B5CF6" },
          { label: "Manga",  count: CATEGORY_COUNTS.manga,       color: "#10B981" },
          { label: "Live",   count: CATEGORY_COUNTS["live-sports"], color: "#F59E0B" },
        ] as { label: string; count: number; color: string }[]
      ).map((s) => (
        <View key={s.label} style={styles.statChip}>
          <Text style={[styles.statNum, { color: s.color }]}>{s.count}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SourcesScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const switchTab = (tab: Tab) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setActiveTab(tab);
  };

  const filtered = useMemo(() => {
    let sources = ALL_SOURCES;

    if (activeTab !== "all") {
      sources = sources.filter((s) => s.categories.includes(activeTab as SourceCategory));
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      sources = sources.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.domain.toLowerCase().includes(q),
      );
    }

    return sources;
  }, [activeTab, query]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* BG gradient */}
      <LinearGradient
        colors={["#0d0010", "#000000"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Source Catalog</Text>
          <Text style={styles.headerSub}>{SOURCE_COUNT} streaming sources integrated</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="database-search" size={22} color="#E50914" />
        </View>
      </View>

      {/* Stats */}
      <StatsBar />

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color="#555" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sources..."
          placeholderTextColor="#444"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {query.length > 0 && Platform.OS !== "ios" && (
          <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
            <Feather name="x" size={13} color="#555" />
          </Pressable>
        )}
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.tab, isActive && { borderColor: tab.color, backgroundColor: tab.color + "22" }]}
              onPress={() => switchTab(tab.id)}
            >
              <Feather
                name={tab.icon as any}
                size={13}
                color={isActive ? tab.color : "#555"}
              />
              <Text style={[styles.tabText, isActive && { color: tab.color }]}>
                {tab.label}
              </Text>
              {isActive && (
                <View style={[styles.tabCount, { backgroundColor: tab.color }]}>
                  <Text style={styles.tabCountText}>{filtered.length}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Source list */}
      <Animated.ScrollView
        style={{ opacity: fadeAnim, flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={15} color="#E50914" />
          <Text style={styles.infoText}>
            All sources are automatically used when streaming. Tap any card to open the site directly.
          </Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="search" size={44} color="#222" />
            <Text style={styles.emptyTitle}>No sources found</Text>
            <Text style={styles.emptySub}>Try a different search term</Text>
          </View>
        ) : (
          filtered.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#000" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: { color: "#fff",  fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub:   { color: "#555",  fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(229,9,20,0.12)",
    borderWidth: 1, borderColor: "rgba(229,9,20,0.25)",
    alignItems: "center", justifyContent: "center",
  },

  // Stats
  statsRow: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  statChip: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e1e1e",
    minWidth: 60,
  },
  statNum:   { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { color: "#555", fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 1 },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    marginBottom: 12,
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222",
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    height: "100%",
  },
  clearBtn: { padding: 4 },

  // Tabs
  tabsScroll:   { flexGrow: 0 },
  tabsRow: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#111",
  },
  tabText:  { color: "#555", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabCount: {
    borderRadius: 8,
    minWidth: 18,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabCountText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },

  // List
  listContent:  { paddingHorizontal: 14 },

  // Info banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(229,9,20,0.06)",
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.15)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  infoText: { flex: 1, color: "#888", fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },

  // Source card
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0e0e0e",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1a1a1a",
  },
  cardPressed: { backgroundColor: "#161616", borderColor: "#2a2a2a" },

  faviconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#161616",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  faviconText: { fontSize: 18, fontFamily: "Inter_700Bold" },

  cardBody:   { flex: 1, gap: 3 },
  cardName:   { color: "#fff",  fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardDomain: { color: "#444",  fontSize: 11, fontFamily: "Inter_400Regular" },
  cardTags:   { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },

  badge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  indieBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  indieText: { color: "#22C55E", fontSize: 9, fontFamily: "Inter_600SemiBold" },

  embedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(96,165,250,0.12)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  embedBadgeText: { color: "#60A5FA", fontSize: 9, fontFamily: "Inter_600SemiBold" },

  cardArrow: { flexShrink: 0 },

  // Empty
  empty:      { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { color: "#fff",  fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub:   { color: "#444",  fontSize: 12, fontFamily: "Inter_400Regular" },
});
