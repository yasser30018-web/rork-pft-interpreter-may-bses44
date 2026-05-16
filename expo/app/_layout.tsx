import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SourcesProvider } from "@/providers/SourcesProvider";
import { SystemConfigProvider } from "@/providers/SystemConfigProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";

SplashScreen.preventAutoHideAsync().catch(() => { });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function ThemedStack() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.bgHeader },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700", fontSize: 16 },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="pft" />
      <Stack.Screen name="abg" />
      <Stack.Screen name="tools" />
      <Stack.Screen name="sources" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="login" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="otp" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="security" />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="admin-login" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="admin-otp" options={{ headerShown: false }} />
      <Stack.Screen name="admin-recovery-setup" options={{ headerShown: false }} />
      <Stack.Screen name="admin-users" />
      <Stack.Screen name="admin-subscriptions" />
      <Stack.Screen name="admin-events" />
      <Stack.Screen name="admin-security" />
      <Stack.Screen name="admin-config" />
      <Stack.Screen name="admin-revenue" />
      <Stack.Screen name="logbook" />
      <Stack.Screen name="ai-scan" />
      <Stack.Screen name="ai-scan-history" />
      <Stack.Screen name="second-opinion" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SystemConfigProvider>
          <SourcesProvider>
            <ThemedStack />
          </SourcesProvider>
        </SystemConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
