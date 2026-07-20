import { BlurView } from "expo-blur";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useDownloads } from "@/contexts/DownloadContext";
import { useLanguage } from "@/contexts/LanguageContext";

function NetflixTabIcon({
  children,
  focused,
}: {
  children: React.ReactNode;
  focused: boolean;
}) {
  return (
    <View style={tabIconStyles.wrap}>
      {focused && <View style={tabIconStyles.dot} />}
      {children}
    </View>
  );
}

function HomeIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <NetflixTabIcon focused={focused}>
      <Feather name="home" size={22} color={color} />
    </NetflixTabIcon>
  );
}

function NewHotIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <NetflixTabIcon focused={focused}>
      <MaterialCommunityIcons name={focused ? "fire" : "fire-circle"} size={24} color={color} />
    </NetflixTabIcon>
  );
}

function DownloadsIcon({ color, focused }: { color: string; focused: boolean }) {
  const { downloadingCount } = useDownloads();
  return (
    <NetflixTabIcon focused={focused}>
      <View>
        <Ionicons
          name={focused ? "cloud-download" : "cloud-download-outline"}
          size={22}
          color={color}
        />
        {downloadingCount > 0 && (
          <View style={tabIconStyles.badge}>
            <Text style={tabIconStyles.badgeText}>{downloadingCount}</Text>
          </View>
        )}
      </View>
    </NetflixTabIcon>
  );
}

function SearchIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <NetflixTabIcon focused={focused}>
      <Ionicons name={focused ? "search" : "search-outline"} size={22} color={color} />
    </NetflixTabIcon>
  );
}

function ProfileIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <NetflixTabIcon focused={focused}>
      <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
    </NetflixTabIcon>
  );
}

function ClipsIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <NetflixTabIcon focused={focused}>
      <Ionicons
        name={focused ? "play-circle" : "play-circle-outline"}
        size={22}
        color={color}
      />
    </NetflixTabIcon>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#E50914",
    marginBottom: 1,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#E50914",
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    lineHeight: 14,
  },
});

function TabBarBackground() {
  if (Platform.OS === "ios") {
    return (
      <BlurView
        tint="dark"
        intensity={88}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: "rgba(5,5,5,0.97)" },
      ]}
    />
  );
}

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#606060",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(5,5,5,0.97)",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "rgba(255,255,255,0.07)",
          elevation: 0,
          paddingBottom: isWeb ? 8 : 22,
          paddingTop: 6,
          height: isWeb ? 72 : Platform.OS === "ios" ? 84 : 78,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          letterSpacing: 0.2,
          marginTop: 1,
        },
        tabBarBackground: () => <TabBarBackground />,
      }}
    >
      <Tabs.Screen
        name="downloads"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabHome,
          tabBarIcon: ({ color, focused }) => <HomeIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: t.tabNewHot,
          tabBarIcon: ({ color, focused }) => <NewHotIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clips"
        options={{
          title: t.tabClips,
          tabBarIcon: ({ color, focused }) => <ClipsIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t.tabSearch,
          tabBarIcon: ({ color, focused }) => <SearchIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabProfile,
          tabBarIcon: ({ color, focused }) => <ProfileIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="games" options={{ href: null }} />
      <Tabs.Screen name="originals" options={{ href: null }} />
    </Tabs>
  );
}
