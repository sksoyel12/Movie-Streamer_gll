import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ClipboardExpo from "expo-clipboard";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Same key used by lib/deviceFingerprint.ts — shares the same stable UUID */
const DEVICE_ID_KEY = "@smovie:deviceId";

// ─────────────────────────────────────────────────────────────────────────────
// Data model
// ─────────────────────────────────────────────────────────────────────────────

interface DeviceData {
  appVersion: string;
  buildNumber: string;
  osLabel: string;
  brand: string;
  model: string;
  cpuArch: string;
  esn: string;
  isRealDevice: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data loader
// ─────────────────────────────────────────────────────────────────────────────

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Absolute fallback — should never happen
    return "00000000-0000-0000-0000-000000000000";
  }
}

async function loadDeviceData(): Promise<DeviceData> {
  const deviceId = await getOrCreateDeviceId();

  // ── App version ────────────────────────────────────────────────────────────
  const appVersion: string =
    Constants.expoConfig?.version ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).manifest?.version ??
    "9.9.9";

  // ── Build number (Android versionCode / iOS buildNumber) ──────────────────
  let buildNumber = "—";
  if (Platform.OS === "android") {
    const vc = Constants.expoConfig?.android?.versionCode;
    buildNumber = vc !== undefined ? String(vc) : "1";
  } else if (Platform.OS === "ios") {
    buildNumber = Constants.expoConfig?.ios?.buildNumber ?? "1";
  }

  // ── OS version label: "Android 13" / "iOS 17.2" / "Web" ──────────────────
  const osName    = Device.osName    ?? (Platform.OS === "web" ? "Web" : Platform.OS);
  const osVersion = Device.osVersion ?? "";
  const osLabel   = osVersion ? `${osName} ${osVersion}` : osName;

  // ── Brand & model ─────────────────────────────────────────────────────────
  const brand = Device.brand ?? (Platform.OS === "web" ? "Browser" : "Unknown");
  const model =
    Device.modelName ??
    (Platform.OS === "web" && typeof navigator !== "undefined"
      ? navigator.userAgent.split(" ").slice(-2).join(" ").replace(/[()]/g, "").trim() || "—"
      : "—");

  // ── CPU architecture ──────────────────────────────────────────────────────
  // expo-device exposes supportedCPUArchitectures on Android; fallback per platform
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const archList = (Device as any).supportedCPUArchitectures as string[] | null | undefined;
  const cpuArch =
    archList && archList.length > 0
      ? archList[0]
      : Platform.OS === "ios"
      ? "arm64"
      : Platform.OS === "android"
      ? "arm64-v8a"
      : typeof navigator !== "undefined" && navigator.userAgent.includes("x86_64")
      ? "x86_64"
      : "—";

  // ── ESN: NFANDROID1-SMOVIE- + first 8 chars of stable UUID ───────────────
  // Strips hyphens from UUID, takes first 8 chars, uppercases them.
  const esnSuffix = deviceId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const esn = `NFANDROID1-SMOVIE-${esnSuffix}`;

  return {
    appVersion,
    buildNumber,
    osLabel,
    brand,
    model,
    cpuArch,
    esn,
    isRealDevice: Device.isDevice ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [esnCopied, setEsnCopied] = useState(false);
  const esnCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load device data fresh every time this screen is opened so a new device
  // always reflects its own hardware — not stale data from a previous mount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDeviceData()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCopyEsn = async () => {
    if (!data?.esn) return;
    await ClipboardExpo.setStringAsync(data.esn).catch(() => {});
    setEsnCopied(true);
    if (esnCopiedTimer.current) clearTimeout(esnCopiedTimer.current);
    esnCopiedTimer.current = setTimeout(() => setEsnCopied(false), 2500);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
        {/* ── Brand card ───────────────────────────────────────────────────── */}
        <LinearGradient
          colors={["rgba(229,9,20,0.18)", "rgba(255,107,0,0.10)", "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandCard}
        >
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoS}>S</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.appName}>S-MOVIE ORIGINAL PREMIUM</Text>
              <View style={styles.badgeRow}>
                {loading ? (
                  <View style={styles.badge}>
                    <ActivityIndicator size="small" color="#e50914" />
                  </View>
                ) : (
                  <>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>v{data?.appVersion ?? "—"}</Text>
                    </View>
                    <View style={[styles.badge, styles.badgeGreen]}>
                      <Text style={[styles.badgeText, styles.badgeTextGreen]}>
                        {data?.isRealDevice ? "Real Device" : "Stable Enterprise Build"}
                      </Text>
                    </View>
                  </>
                )}
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

        {/* ── Device Info section ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Feather name="smartphone" size={13} color="#555" />
            <Text style={styles.sectionTitle}>DEVICE INFO</Text>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#333" />
              <Text style={styles.loadingText}>Reading hardware…</Text>
            </View>
          ) : (
            <>
              <InfoRow label="Device Brand"    value={data?.brand ?? "—"} />
              <InfoRow label="Device Model"    value={data?.model ?? "—"} />
              <InfoRow label="OS Version"      value={data?.osLabel ?? "—"} accent />
              <InfoRow label="CPU Architecture" value={data?.cpuArch ?? "—"} />

              {/* ESN row — tappable to copy */}
              <Pressable
                onPress={handleCopyEsn}
                style={({ pressed }) => [esnRowStyles.row, pressed && { backgroundColor: "rgba(229,9,20,0.04)" }]}
              >
                <Text style={esnRowStyles.label}>Device ESN</Text>
                <View style={esnRowStyles.valueWrap}>
                  <Text style={esnRowStyles.value} numberOfLines={1} adjustsFontSizeToFit>
                    {data?.esn ?? "—"}
                  </Text>
                  <View style={[esnRowStyles.copyBadge, esnCopied && esnRowStyles.copyBadgeCopied]}>
                    <Feather
                      name={esnCopied ? "check" : "copy"}
                      size={11}
                      color={esnCopied ? "#34D399" : "#555"}
                    />
                    <Text style={[esnRowStyles.copyText, esnCopied && { color: "#34D399" }]}>
                      {esnCopied ? "Copied" : "Copy"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </>
          )}
        </View>

        {/* ── Build Info section ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Feather name="info" size={13} color="#555" />
            <Text style={styles.sectionTitle}>BUILD INFO</Text>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#333" />
              <Text style={styles.loadingText}>Loading build info…</Text>
            </View>
          ) : (
            <>
              <InfoRow label="App Name"    value="S-MOVIE ORIGINAL PREMIUM" />
              <InfoRow label="Version"     value={`v${data?.appVersion ?? "—"}`} accent />
              <InfoRow label="Build"       value={`#${data?.buildNumber ?? "—"}`} />
              <InfoRow label="Build Mode"  value="Encrypted Release" />
              <InfoRow label="Data Source" value="S-CLUSTER Private Core Pipeline" />
            </>
          )}
        </View>

        {/* ── Technology section ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Feather name="cpu" size={13} color="#555" />
            <Text style={styles.sectionTitle}>TECHNOLOGY</Text>
          </View>
          <InfoRow label="Framework"  value="S-Engine Custom Runtime" />
          <InfoRow label="Navigation" value="Matrix Route Optimizer (v5.0)" />
          <InfoRow label="Storage"    value="Local Encrypted Sandbox Vault" />
          <InfoRow label="Media API"  value="Global Syndicated Media Network" />
        </View>

        <Text style={styles.footerNote}>
          © 2025 S-MOVIE ORIGINAL. All rights reserved.{"\n"}
          Device data is read in real-time from your hardware.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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
      <Text style={[rowStyles.value, accent && rowStyles.valueAccent]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

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

const esnRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  label: {
    color: "#888",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flexShrink: 0,
    width: 100,
  },
  valueWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  value: {
    color: "#E50914",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    flex: 1,
    textAlign: "right",
  },
  copyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1a1a1a",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  copyBadgeCopied: {
    borderColor: "rgba(52,211,153,0.3)",
    backgroundColor: "rgba(52,211,153,0.06)",
  },
  copyText: {
    color: "#555",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 10,
    minHeight: 52,
  },
  backBtn: {
    width: 44,
    height: 44,
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

  scroll: { flex: 1 },
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
    flexShrink: 0,
  },
  logoS: {
    color: "#fff",
    fontSize: 30,
    fontFamily: "Inter_900Black",
    letterSpacing: -1,
  },
  appName: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: -0.4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 5,
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "rgba(229,9,20,0.12)",
    borderWidth: 1,
    borderColor: "rgba(229,9,20,0.28)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 22,
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
  badgeTextGreen: { color: "#34D399" },
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    color: "#444",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  loadingText: {
    color: "#333",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
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
