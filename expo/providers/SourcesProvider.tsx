import { useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import createContextHook from "@nkzw/create-context-hook";
import type { PDFSource } from "@/types/sources";

const STORAGE_KEY = "pft_app_pdf_sources";

export const [SourcesProvider, useSources] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [sources, setSources] = useState<PDFSource[]>([]);

  const sourcesQuery = useQuery({
    queryKey: ["pdf-sources"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as PDFSource[]) : [];
    },
  });

  useEffect(() => {
    if (sourcesQuery.data) {
      setSources(sourcesQuery.data);
    }
  }, [sourcesQuery.data]);

  const syncMutation = useMutation({
    mutationFn: async (updated: PDFSource[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdf-sources"] });
    },
  });

  const addSource = useCallback((source: PDFSource) => {
    const updated = [source, ...sources];
    setSources(updated);
    syncMutation.mutate(updated);
  }, [sources, syncMutation]);

  const removeSource = useCallback((id: string) => {
    const updated = sources.filter(s => s.id !== id);
    setSources(updated);
    syncMutation.mutate(updated);
  }, [sources, syncMutation]);

  const isLoading = sourcesQuery.isLoading;

  return useMemo(() => ({
    sources,
    addSource,
    removeSource,
    isLoading,
  }), [sources, addSource, removeSource, isLoading]);
});
