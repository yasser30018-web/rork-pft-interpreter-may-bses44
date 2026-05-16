import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
  Linking,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Upload, FileText, Trash2, ExternalLink, FolderOpen } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/providers/ThemeProvider";
import { useSources } from "@/providers/SourcesProvider";
import { useSystemConfig } from "@/providers/SystemConfigProvider";
import type { PDFSource } from "@/types/sources";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function PDFCard({ source, onDelete, onView, colors, scaledFont }: { source: PDFSource; onDelete: (id: string) => void; onView: (source: PDFSource) => void; colors: ReturnType<typeof useTheme>["colors"]; scaledFont: (n: number) => number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 100, friction: 10 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onView(source)}
        activeOpacity={0.9}
        style={[styles.pdfCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      >
        <View style={[styles.pdfIconContainer, { backgroundColor: colors.violet + "15" }]}>
          <FileText color={colors.violet} size={24} />
        </View>
        <View style={styles.pdfContent}>
          <Text style={[styles.pdfName, { color: colors.text, fontSize: scaledFont(13) }]} numberOfLines={2}>{source.name}</Text>
          <View style={styles.pdfMeta}>
            <Text style={[styles.pdfSize, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{formatFileSize(source.size)}</Text>
            <View style={[styles.pdfDot, { backgroundColor: colors.textDark }]} />
            <Text style={[styles.pdfDate, { color: colors.textMuted, fontSize: scaledFont(10) }]}>{formatDate(source.dateAdded)}</Text>
          </View>
        </View>
        <View style={styles.pdfActions}>
          <TouchableOpacity onPress={() => onView(source)} style={styles.actionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ExternalLink color={colors.accentLight} size={16} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(source.id)} style={styles.actionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Trash2 color={colors.red} size={16} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function SourcesScreen() {
  const insets = useSafeAreaInsets();
  const { colors, scaledFont } = useTheme();
  const { sources, addSource, removeSource, isLoading } = useSources();
  const { config } = useSystemConfig();
  const uploadsEnabled = config.allowFileUploads;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [uploadAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      const newSource: PDFSource = {
        id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: asset.name ?? "Untitled.pdf",
        uri: asset.uri,
        size: asset.size ?? 0,
        dateAdded: Date.now(),
        mimeType: asset.mimeType ?? "application/pdf",
      };

      addSource(newSource);

      Animated.sequence([
        Animated.timing(uploadAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
        Animated.timing(uploadAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();

      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Failed to pick document. Please try again.");
    }
  }, [addSource, uploadAnim]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert("Remove PDF", "Are you sure you want to remove this PDF from your library?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removeSource(id);
          if (Platform.OS !== "web") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        },
      },
    ]);
  }, [removeSource]);

  const handleView = useCallback((source: PDFSource) => {
    if (Platform.OS === "web") {
      window.open(source.uri, "_blank");
    } else {
      Linking.openURL(source.uri).catch(() => {
        Alert.alert("Error", "Unable to open this PDF.");
      });
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "Sources",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700", fontSize: 16 },
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {uploadsEnabled ? (
            <Animated.View style={{ transform: [{ scale: uploadAnim }] }}>
              <TouchableOpacity
                onPress={handlePickDocument}
                activeOpacity={0.8}
                style={[styles.uploadCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                testID="upload-pdf-button"
              >
                <View style={styles.uploadIconOuter}>
                  <View style={styles.uploadIconInner}>
                    <Upload color={colors.violet} size={28} />
                  </View>
                </View>
                <Text style={[styles.uploadTitle, { color: colors.text, fontSize: scaledFont(20) }]}>Upload PDF</Text>
                <Text style={[styles.uploadSubtitle, { color: colors.textMuted, fontSize: scaledFont(13) }]}>
                  Tap to select a PDF file from your device
                </Text>
                <View style={styles.uploadBadge}>
                  <Text style={[styles.uploadBadgeText, { fontSize: scaledFont(11) }]}>SELECT FILE</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={[styles.disabledUploadCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Upload color={colors.textDark} size={28} />
              <Text style={[styles.disabledUploadTitle, { color: colors.textMuted, fontSize: scaledFont(15) }]}>File Uploads Disabled</Text>
              <Text style={[styles.disabledUploadSubtitle, { color: colors.textDark, fontSize: scaledFont(12) }]}>
                File uploads are currently disabled by the administrator.
              </Text>
            </View>
          )}

          <View style={styles.libraryHeader}>
            <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>PDF LIBRARY</Text>
            <Text style={[styles.countLabel, { color: colors.textMuted, fontSize: scaledFont(11) }]}>{sources.length} files</Text>
          </View>

          {isLoading && (
            <View style={[styles.emptyState, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted, fontSize: scaledFont(12) }]}>Loading...</Text>
            </View>
          )}

          {!isLoading && sources.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <FolderOpen color={colors.textDark} size={48} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontSize: scaledFont(16) }]}>No PDFs Yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted, fontSize: scaledFont(12) }]}>
                Upload your first PDF to start building your pulmonary reference library
              </Text>
            </View>
          )}

          {sources.map(source => (
            <PDFCard
              key={source.id}
              source={source}
              onDelete={handleDelete}
              onView={handleView}
              colors={colors}
              scaledFont={scaledFont}
            />
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16 },
  uploadCard: { borderRadius: 20, padding: 28, alignItems: "center", borderWidth: 1, borderStyle: "dashed" as const, marginBottom: 24 },
  uploadIconOuter: { width: 72, height: 72, borderRadius: 24, backgroundColor: "rgba(139,92,246,0.08)", alignItems: "center", justifyContent: "center" },
  uploadIconInner: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(139,92,246,0.15)", alignItems: "center", justifyContent: "center" },
  uploadTitle: { fontWeight: "800" as const, marginTop: 16, letterSpacing: -0.3 },
  uploadSubtitle: { marginTop: 6, textAlign: "center" as const },
  uploadBadge: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(139,92,246,0.12)", borderWidth: 1, borderColor: "rgba(139,92,246,0.3)" },
  uploadBadgeText: { color: "#8b5cf6", fontWeight: "700" as const, letterSpacing: 2 },
  libraryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionLabel: { letterSpacing: 3, fontWeight: "700" as const },
  countLabel: {},
  emptyState: { borderRadius: 16, padding: 32, alignItems: "center", borderWidth: 1 },
  emptyTitle: { fontWeight: "700" as const, marginTop: 14 },
  emptyText: { marginTop: 6, textAlign: "center" as const, lineHeight: 18 },
  pdfCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  pdfIconContainer: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pdfContent: { flex: 1 },
  pdfName: { fontWeight: "600" as const, marginBottom: 4 },
  pdfMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  pdfSize: {},
  pdfDot: { width: 3, height: 3, borderRadius: 2 },
  pdfDate: {},
  pdfActions: { flexDirection: "row", gap: 12 },
  actionButton: { padding: 6 },
  disabledUploadCard: { borderRadius: 20, padding: 28, alignItems: "center" as const, borderWidth: 1, marginBottom: 24, opacity: 0.7 },
  disabledUploadTitle: { fontWeight: "700" as const, marginTop: 14 },
  disabledUploadSubtitle: { marginTop: 6, textAlign: "center" as const, lineHeight: 18 },
});
