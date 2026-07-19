import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.55 }]}
          hitSlop={14}
        >
          <Feather name="chevron-left" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand card */}
        <LinearGradient
          colors={["rgba(229,9,20,0.18)", "rgba(255,107,0,0.10)", "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandCard}
        >
          {/* Logo block */}
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoS}>S</Text>
            </View>
            <View>
              <Text style={styles.appName}>S-MOVIE ORIGINAL PREMIUM</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>v9.9.9</Text>
                </View>
                <View style={[styles.badge, styles.badgeGreen]}>
                  <Text style={[styles.badgeText, styles.badgeTextGreen]}>Stable Enterprise Build</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.description}>
            S-MOVIE PREMIUM is your elite, zero-latency entertainment command center featuring
            enterprise-grade media curation, decentralized catalog indexing, real-time global
            spotlight orchestration, and an advanced encrypted media tracking runtime optimized
            for high-performance sovereign streaming.
          </Text>
        </LinearGradient>

        {/* Info rows */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BUILD INFO</Text>

          <InfoRow label="App Name"    value="S-MOVIE ORIGINAL PREMIUM" />
          <InfoRow label="Version"     value="v9.9.9 (Stable Enterprise Build)" accent />
          <InfoRow label="Platform"    value="Secure Cloud Stream Grid" />
          <InfoRow label="Build Mode"  value="Encrypted Release" />
          <InfoRow label="Data Source" value="S-CLUSTER Private Core Pipeline" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TECHNOLOGY</Text>
          <InfoRow label="Framework"  value="S-Engine Custom Runtime" />
          <InfoRow label="Navigation" value="Matrix Route Optimizer (v5.0)" />
          <InfoRow label="Storage"    value="Local Encrypted Sandbox Vault" />
          <InfoRow label="Media API"  value="Global Syndicated Media Network" />
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          © 2025 S-MOVIE ORIGINAL. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, accent && rowStyles.valueAccent]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  label: {
    color: "#888",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  value: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
    flex: 1,
  },
  valueAccent: {
    color: "#34D399",
    fontFamily: "Inter_600SemiBold",
  },
});

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 10,
    minHeight: 52,
  },
  backBtn: {
    width: 44, height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingLeft: 6,
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  headerSpacer: { width: 44 },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 20 },

  brandCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.18)",
    gap: 14,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logoBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#e50914",
    alignItems: "center",
    justifyContent: "center",
  },
  logoS: {
    color: "#fff",
    fontSize: 30,
    fontFamily: "Inter_900Black",
    letterSpacing: -1,
  },
  appName: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: -0.5,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  badge: {
    backgroundColor: "rgba(229,9,20,0.12)",
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.28)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#e50914",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  badgeGreen: {
    backgroundColor: "rgba(52,211,153,0.10)",
    borderColor: "rgba(52,211,153,0.28)",
  },
  badgeTextGreen: {
    color: "#34D399",
  },
  description: {
    color: "#aaa",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },

  section: {
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  sectionTitle: {
    color: "#444",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },

  footerNote: {
    color: "#333",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
});
