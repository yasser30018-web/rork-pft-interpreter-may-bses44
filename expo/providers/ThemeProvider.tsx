import { useState, useEffect, useMemo, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import { LightTheme, DarkTheme } from "@/constants/themes";
import type { ThemeColors } from "@/constants/themes";
import type { FontSize, UserPreferences } from "@/types/user";
import { FONT_SIZE_VALUES } from "@/types/user";

const PREFS_KEY = "pulmolab_user_preferences";

const DEFAULT_PREFS: UserPreferences = {
  darkMode: false,
  fontSize: "medium",
  notificationsEnabled: true,
};

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);

  const prefsQuery = useQuery({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(PREFS_KEY);
      if (stored) {
        return { ...DEFAULT_PREFS, ...JSON.parse(stored) } as UserPreferences;
      }
      return DEFAULT_PREFS;
    },
  });

  useEffect(() => {
    if (prefsQuery.data) {
      setPrefs(prefsQuery.data);
    }
  }, [prefsQuery.data]);

  const syncMutation = useMutation({
    mutationFn: async (updated: UserPreferences) => {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      return updated;
    },
  });

  const setDarkMode = useCallback((enabled: boolean) => {
    const updated = { ...prefs, darkMode: enabled };
    setPrefs(updated);
    syncMutation.mutate(updated);
  }, [prefs, syncMutation]);

  const setFontSize = useCallback((size: FontSize) => {
    const updated = { ...prefs, fontSize: size };
    setPrefs(updated);
    syncMutation.mutate(updated);
  }, [prefs, syncMutation]);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    const updated = { ...prefs, notificationsEnabled: enabled };
    setPrefs(updated);
    syncMutation.mutate(updated);
  }, [prefs, syncMutation]);

  const colors: ThemeColors = prefs.darkMode ? DarkTheme : LightTheme;
  const fontScale = FONT_SIZE_VALUES[prefs.fontSize];
  const isDark = prefs.darkMode;

  const scaledFont = useCallback((baseSize: number) => {
    return Math.round(baseSize * fontScale);
  }, [fontScale]);

  return useMemo(() => ({
    colors,
    isDark,
    fontScale,
    fontSize: prefs.fontSize,
    darkMode: prefs.darkMode,
    notificationsEnabled: prefs.notificationsEnabled,
    setDarkMode,
    setFontSize,
    setNotificationsEnabled,
    scaledFont,
    isLoading: prefsQuery.isLoading,
  }), [colors, isDark, fontScale, prefs, setDarkMode, setFontSize, setNotificationsEnabled, scaledFont, prefsQuery.isLoading]);
});
