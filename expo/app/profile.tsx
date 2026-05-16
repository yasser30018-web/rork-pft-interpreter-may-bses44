import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Animated,
  Switch,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  User,
  Camera,
  Trash2,
  Moon,
  Sun,
  Type,
  Bell,
  BellOff,
  Lock,
  CreditCard,
  LogOut,
  ChevronRight,
  Shield,
  Edit3,
  Save,
  X,
} from "lucide-react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import type { UserRole, FontSize } from "@/types/user";
import { FONT_SIZE_LABELS } from "@/types/user";

const ROLES: UserRole[] = ["Consultant", "Fellow", "Resident", "Nurse"];
const FONT_SIZES: FontSize[] = ["small", "medium", "large", "extra_large"];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark, scaledFont, darkMode, fontSize, notificationsEnabled, setDarkMode, setFontSize, setNotificationsEnabled } = useTheme();
  const { user, isAuthenticated, updateProfile, updateProfileImage, logout } = useAuth();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(user?.fullName ?? "");
  const [editSpecialty, setEditSpecialty] = useState<string>(user?.medicalSpecialty ?? "");
  const [editRole, setEditRole] = useState<UserRole>(user?.role ?? "Resident");
  const [editContact, setEditContact] = useState<string>(user?.contactNumber ?? "");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (user) {
      setEditName(user.fullName);
      setEditSpecialty(user.medicalSpecialty);
      setEditRole(user.role);
      setEditContact(user.contactNumber);
    }
  }, [user]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        updateProfileImage(result.assets[0].uri);
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to pick image.");
    }
  }, [updateProfileImage]);

  const handleRemoveImage = useCallback(() => {
    Alert.alert("Remove Photo", "Are you sure you want to remove your profile photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          updateProfileImage(null);
          if (Platform.OS !== "web") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        },
      },
    ]);
  }, [updateProfileImage]);

  const handleSaveProfile = useCallback(() => {
    updateProfile({
      fullName: editName.trim(),
      medicalSpecialty: editSpecialty.trim(),
      role: editRole,
      contactNumber: editContact.trim(),
    });
    setIsEditing(false);
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [editName, editSpecialty, editRole, editContact, updateProfile]);

  const handleLogout = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/" as never);
        },
      },
    ]);
  }, [logout, router]);

  const handleContactChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length <= 10) {
      setEditContact(cleaned);
    }
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "Profile & Settings",
          headerStyle: { backgroundColor: colors.bgHeader },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {isAuthenticated ? (
            <>
              <View style={[styles.profileCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={styles.avatarSection}>
                  {user?.profileImageUri ? (
                    <View style={styles.avatarContainer}>
                      <Image
                        source={{ uri: user.profileImageUri }}
                        style={styles.avatarImage}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        onPress={handlePickImage}
                        style={[styles.avatarEditBtn, { backgroundColor: colors.accent }]}
                      >
                        <Camera color="#fff" size={14} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
                      <View style={[styles.avatarPlaceholder, { backgroundColor: colors.bgElevated }]}>
                        <User color={colors.textDim} size={36} />
                      </View>
                      <View style={[styles.avatarEditBtn, { backgroundColor: colors.accent }]}>
                        <Camera color="#fff" size={14} />
                      </View>
                    </TouchableOpacity>
                  )}

                  {user?.profileImageUri && (
                    <TouchableOpacity onPress={handleRemoveImage} style={styles.removePhotoBtn}>
                      <Trash2 color={colors.red} size={14} />
                      <Text style={[styles.removePhotoText, { color: colors.red, fontSize: scaledFont(11) }]}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.profileInfo}>
                  {!isEditing ? (
                    <>
                      <Text style={[styles.profileName, { color: colors.text, fontSize: scaledFont(20) }]}>{user?.fullName}</Text>
                      <View style={[styles.roleBadge, { backgroundColor: colors.accent + "15" }]}>
                        <Text style={[styles.roleText, { color: colors.accent, fontSize: scaledFont(11) }]}>{user?.role}</Text>
                      </View>
                      <Text style={[styles.profileDetail, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{user?.medicalSpecialty}</Text>
                      <Text style={[styles.profileDetail, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{user?.email}</Text>
                      {user?.nationalId ? (
                        <Text style={[styles.profileDetail, { color: colors.textDim, fontSize: scaledFont(11) }]}>ID: {user.nationalId}</Text>
                      ) : null}
                      {user?.contactNumber ? (
                        <Text style={[styles.profileDetail, { color: colors.textDim, fontSize: scaledFont(11) }]}>+966 {user.contactNumber}</Text>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => setIsEditing(true)}
                        style={[styles.editBtn, { borderColor: colors.accent }]}
                      >
                        <Edit3 color={colors.accent} size={14} />
                        <Text style={[styles.editBtnText, { color: colors.accent, fontSize: scaledFont(12) }]}>Edit Profile</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>Full Name</Text>
                        <TextInput
                          value={editName}
                          onChangeText={setEditName}
                          style={[styles.editInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, fontSize: scaledFont(14) }]}
                        />
                      </View>
                      <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>National ID (read-only)</Text>
                        <TextInput
                          value={user?.nationalId ?? ""}
                          editable={false}
                          style={[styles.editInput, { backgroundColor: colors.bgElevated, borderColor: colors.border, color: colors.textDim, fontSize: scaledFont(14) }]}
                        />
                      </View>
                      <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>Specialty</Text>
                        <TextInput
                          value={editSpecialty}
                          onChangeText={setEditSpecialty}
                          style={[styles.editInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, fontSize: scaledFont(14) }]}
                        />
                      </View>
                      <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>Role</Text>
                        <View style={styles.editRoleRow}>
                          {ROLES.map((r) => (
                            <TouchableOpacity
                              key={r}
                              onPress={() => setEditRole(r)}
                              style={[styles.editRoleChip, { borderColor: editRole === r ? colors.accent : colors.border, backgroundColor: editRole === r ? colors.accent + "15" : colors.bgCard }]}
                            >
                              <Text style={[styles.editRoleText, { color: editRole === r ? colors.accent : colors.textMuted, fontSize: scaledFont(10) }]}>{r}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: colors.textSecondary, fontSize: scaledFont(11) }]}>Contact (+966)</Text>
                        <TextInput
                          value={editContact}
                          onChangeText={handleContactChange}
                          keyboardType="phone-pad"
                          maxLength={10}
                          style={[styles.editInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, fontSize: scaledFont(14) }]}
                        />
                      </View>
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          onPress={() => setIsEditing(false)}
                          style={[styles.editCancelBtn, { borderColor: colors.border }]}
                        >
                          <X color={colors.textMuted} size={14} />
                          <Text style={[styles.editCancelText, { color: colors.textMuted, fontSize: scaledFont(12) }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleSaveProfile}
                          style={[styles.editSaveBtn, { backgroundColor: colors.accent }]}
                        >
                          <Save color="#fff" size={14} />
                          <Text style={[styles.editSaveText, { fontSize: scaledFont(12) }]}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>APPEARANCE</Text>

          <View style={[styles.settingsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                {isDark ? <Moon color={colors.accent} size={20} /> : <Sun color={colors.accent} size={20} />}
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Dark Mode</Text>
                  <Text style={[styles.settingDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Reduce eye strain during night shifts</Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: colors.border, true: colors.accent + "60" }}
                thumbColor={darkMode ? colors.accent : "#f4f3f4"}
              />
            </View>

            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Type color={colors.accent} size={20} />
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Text Size</Text>
                  <Text style={[styles.settingDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>Adjust font size across the app</Text>
                </View>
              </View>
            </View>
            <View style={styles.fontSizeRow}>
              {FONT_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  onPress={() => {
                    setFontSize(size);
                    if (Platform.OS !== "web") {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  style={[
                    styles.fontSizeChip,
                    {
                      borderColor: fontSize === size ? colors.accent : colors.border,
                      backgroundColor: fontSize === size ? colors.accent + "15" : colors.bg,
                    },
                  ]}
                >
                  <Text style={[
                    styles.fontSizeLabel,
                    {
                      color: fontSize === size ? colors.accent : colors.textMuted,
                      fontSize: size === "small" ? 10 : size === "medium" ? 12 : size === "large" ? 14 : 16,
                    },
                  ]}>
                    {FONT_SIZE_LABELS[size]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>NOTIFICATIONS</Text>

          <View style={[styles.settingsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                {notificationsEnabled ? <Bell color={colors.accent} size={20} /> : <BellOff color={colors.textDim} size={20} />}
                <View>
                  <Text style={[styles.settingTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Notifications</Text>
                  <Text style={[styles.settingDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
                    {notificationsEnabled ? "Notifications are enabled" : "Notifications are disabled"}
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.border, true: colors.accent + "60" }}
                thumbColor={notificationsEnabled ? colors.accent : "#f4f3f4"}
              />
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>ACCOUNT</Text>

          <View style={[styles.settingsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {isAuthenticated && (
              <>
                <TouchableOpacity
                  onPress={() => router.push("/change-password" as never)}
                  style={styles.menuRow}
                >
                  <View style={styles.settingLeft}>
                    <Lock color={colors.accent} size={20} />
                    <Text style={[styles.settingTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Change Password</Text>
                  </View>
                  <ChevronRight color={colors.textDim} size={18} />
                </TouchableOpacity>

                <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
              </>
            )}

            <TouchableOpacity
              onPress={() => router.push("/subscription" as never)}
              style={styles.menuRow}
            >
              <View style={styles.settingLeft}>
                <CreditCard color={colors.accent} size={20} />
                <Text style={[styles.settingTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Subscription</Text>
              </View>
              <ChevronRight color={colors.textDim} size={18} />
            </TouchableOpacity>

            {isAuthenticated && (
              <>
                <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  onPress={() => router.push("/security" as never)}
                  style={styles.menuRow}
                >
                  <View style={styles.settingLeft}>
                    <Shield color={colors.accent} size={20} />
                    <Text style={[styles.settingTitle, { color: colors.text, fontSize: scaledFont(14) }]}>Account Security</Text>
                  </View>
                  <ChevronRight color={colors.textDim} size={18} />
                </TouchableOpacity>

                <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  onPress={handleLogout}
                  style={styles.menuRow}
                >
                  <View style={styles.settingLeft}>
                    <LogOut color={colors.red} size={20} />
                    <Text style={[styles.settingTitle, { color: colors.red, fontSize: scaledFont(14) }]}>Sign Out</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}


          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16 },
  loginPrompt: { borderRadius: 20, padding: 28, alignItems: "center", borderWidth: 1, marginBottom: 24 },
  promptIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  promptTitle: { fontWeight: "800" as const, letterSpacing: -0.3 },
  promptDesc: { marginTop: 6, textAlign: "center" as const, lineHeight: 20 },
  promptBtn: { marginTop: 20, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  promptBtnText: { color: "#fff", fontWeight: "700" as const },
  profileCard: { borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 24 },
  avatarSection: { alignItems: "center", marginBottom: 16 },
  avatarContainer: { position: "relative" as const },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarEditBtn: { position: "absolute" as const, bottom: 0, right: -4, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  removePhotoBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, padding: 4 },
  removePhotoText: { fontWeight: "500" as const },
  profileInfo: { alignItems: "center" },
  profileName: { fontWeight: "800" as const, letterSpacing: -0.3, marginBottom: 6 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  roleText: { fontWeight: "600" as const, letterSpacing: 0.5 },
  profileDetail: { marginBottom: 4 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  editBtnText: { fontWeight: "600" as const },
  editField: { width: "100%", marginBottom: 12 },
  editLabel: { fontWeight: "600" as const, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 1 },
  editInput: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, width: "100%" },
  editRoleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  editRoleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  editRoleText: { fontWeight: "600" as const },
  editActions: { flexDirection: "row", gap: 10, marginTop: 10, width: "100%" },
  editCancelBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  editCancelText: { fontWeight: "500" as const },
  editSaveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  editSaveText: { color: "#fff", fontWeight: "600" as const },
  sectionLabel: { letterSpacing: 3, fontWeight: "700" as const, marginBottom: 10, marginTop: 4 },
  settingsCard: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: "hidden" as const },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  settingTitle: { fontWeight: "600" as const },
  settingDesc: { marginTop: 2 },
  settingDivider: { height: 1, marginHorizontal: 16 },
  fontSizeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  fontSizeChip: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  fontSizeLabel: { fontWeight: "600" as const },
  menuRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
});
