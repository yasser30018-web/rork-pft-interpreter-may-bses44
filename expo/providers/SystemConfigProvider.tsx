import React, { useState, useCallback, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { DEFAULT_SYSTEM_CONFIG } from "@/mocks/adminData";
import type { SystemConfig } from "@/types/admin";

const STORAGE_KEY = "system_config";

export const [SystemConfigProvider, useSystemConfig] = createContextHook(() => {
  const [config, setConfig] = useState<SystemConfig>({ ...DEFAULT_SYSTEM_CONFIG });
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as SystemConfig;
            setConfig(parsed);
            console.log("SystemConfig loaded from storage:", parsed);
          } catch (e) {
            console.log("Failed to parse stored system config", e);
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const updateConfig = useCallback((updated: SystemConfig) => {
    setConfig(updated);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
      console.log("Failed to persist system config", e)
    );
    console.log("SystemConfig updated and persisted:", updated);
  }, []);

  const resetConfig = useCallback(() => {
    const defaults = { ...DEFAULT_SYSTEM_CONFIG };
    setConfig(defaults);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)).catch((e) =>
      console.log("Failed to persist reset system config", e)
    );
    console.log("SystemConfig reset to defaults");
  }, []);

  return useMemo(() => ({ config, updateConfig, resetConfig, loaded }), [config, updateConfig, resetConfig, loaded]);
});
