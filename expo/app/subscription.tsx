import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Animated,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Crown, Sparkles, Star, Shield, Zap } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useSystemConfig } from "@/providers/SystemConfigProvider";
import type { SubscriptionPlan } from "@/types/user";

function buildPlans(monthlyPrice: number, yearlyPrice: number, trialDays: number): SubscriptionPlan[] {
  const monthlyCostPerYear = monthlyPrice * 12;
  const savingsPercent = monthlyCostPerYear > 0 ? Math.round(((monthlyCostPerYear - yearlyPrice) / monthlyCostPerYear) * 100) : 0;

  return [
    {
      id: "monthly",
      name: "Monthly",
      price: `${monthlyPrice.toFixed(2)}`,
      period: "/month",
      priceValue: monthlyPrice,
      features: [
        "Full PFT Interpretation",
        "ABG Analysis",
        "All Clinical Calculators",
        "Unlimited PDF Storage",
        `${trialDays}-day Free Trial`,
      ],
    },
    {
      id: "yearly",
      name: "Yearly",
      price: `${yearlyPrice.toFixed(2)}`,
      period: "/year",
      priceValue: yearlyPrice,
      popular: true,
      features: [
        "Everything in Monthly",
        savingsPercent > 0 ? `Save ${savingsPercent}% vs Monthly` : "Best yearly value",
        "Priority Support",
        "Early Access to New Tools",
        `${trialDays}-day Free Trial`,
      ],
    },
  ];
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, scaledFont } = useTheme();
  const { subscription, updateSubscription, isAuthenticated } = useAuth();
  const { config } = useSystemConfig();

  const PLANS = React.useMemo(
    () => buildPlans(config.monthlyPrice, config.yearlyPrice, config.trialDurationDays),
    [config.monthlyPrice, config.yearlyPrice, config.trialDurationDays]
  );

  const [selectedPlan, setSelectedPlan] = useState<string>("yearly");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleSubscribe = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert("Sign In Required", "Please sign in to subscribe.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => router.push("/login" as never) },
      ]);
      return;
    }

    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const plan = PLANS.find((p) => p.id === selectedPlan);
    Alert.alert(
      "Start Free Trial",
      `You selected the ${plan?.name} plan (${plan?.price}${plan?.period}). Your ${config.trialDurationDays}-day free trial will start now.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Trial",
          onPress: () => {
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + config.trialDurationDays);
            updateSubscription({
              status: "trial",
              planId: selectedPlan,
              expiresAt: null,
              trialEndsAt: trialEnd.toISOString(),
            });
            if (Platform.OS !== "web") {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Trial Started!", `Your ${config.trialDurationDays}-day free trial has begun. You will be notified before it ends.`);
          },
        },
      ]
    );
  }, [selectedPlan, isAuthenticated, updateSubscription, router, config.trialDurationDays, PLANS]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      "Cancel Subscription",
      "Are you sure? You will continue to have access until the end of your current billing period.",
      [
        { text: "Keep Subscription", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => {
            updateSubscription({
              status: "cancelled",
              planId: subscription.planId,
              expiresAt: subscription.expiresAt,
              trialEndsAt: subscription.trialEndsAt,
            });
            Alert.alert("Subscription Cancelled", "You will retain access until the end of your billing period.");
          },
        },
      ]
    );
  }, [subscription, updateSubscription]);

  const isActive = subscription.status === "active" || subscription.status === "trial";

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "Subscription",
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
          <View style={styles.heroSection}>
            <View style={[styles.heroIcon, { backgroundColor: "#f59e0b" + "20" }]}>
              <Crown color="#f59e0b" size={36} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text, fontSize: scaledFont(24) }]}>
              PulmoLab Pro
            </Text>
            <Text style={[styles.heroDesc, { color: colors.textMuted, fontSize: scaledFont(13) }]}>
              Unlock the full potential of clinical pulmonary tools
            </Text>
          </View>

          {isActive && (
            <View style={[styles.statusCard, { backgroundColor: colors.green + "15", borderColor: colors.green + "30" }]}>
              <View style={styles.statusRow}>
                <Check color={colors.green} size={20} />
                <View style={styles.statusInfo}>
                  <Text style={[styles.statusTitle, { color: colors.green, fontSize: scaledFont(14) }]}>
                    {subscription.status === "trial" ? "Free Trial Active" : "Subscription Active"}
                  </Text>
                  <Text style={[styles.statusDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
                    {subscription.status === "trial" && subscription.trialEndsAt
                      ? `Trial ends ${new Date(subscription.trialEndsAt).toLocaleDateString()}`
                      : subscription.expiresAt
                        ? `Renews ${new Date(subscription.expiresAt).toLocaleDateString()}`
                        : "Active"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: colors.red, fontSize: scaledFont(12) }]}>Cancel Subscription</Text>
              </TouchableOpacity>
            </View>
          )}

          {subscription.status === "cancelled" && (
            <View style={[styles.statusCard, { backgroundColor: colors.amber + "15", borderColor: colors.amber + "30" }]}>
              <View style={styles.statusRow}>
                <Zap color={colors.amber} size={20} />
                <View style={styles.statusInfo}>
                  <Text style={[styles.statusTitle, { color: colors.amber, fontSize: scaledFont(14) }]}>
                    Subscription Cancelled
                  </Text>
                  <Text style={[styles.statusDesc, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
                    Access continues until end of billing period
                  </Text>
                </View>
              </View>
            </View>
          )}

          <Text style={[styles.plansLabel, { color: colors.textDim, fontSize: scaledFont(11) }]}>
            CHOOSE YOUR PLAN
          </Text>

          {PLANS.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              onPress={() => {
                setSelectedPlan(plan.id);
                if (Platform.OS !== "web") {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.bgCard,
                  borderColor: selectedPlan === plan.id ? colors.accent : colors.border,
                  borderWidth: selectedPlan === plan.id ? 2 : 1,
                },
              ]}
              activeOpacity={0.8}
            >
              {plan.popular && (
                <View style={[styles.popularBadge, { backgroundColor: "#f59e0b" }]}>
                  <Sparkles color="#fff" size={10} />
                  <Text style={styles.popularText}>BEST VALUE</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <View style={styles.planTitleRow}>
                  <View style={[styles.radioOuter, { borderColor: selectedPlan === plan.id ? colors.accent : colors.border }]}>
                    {selectedPlan === plan.id && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                  </View>
                  <Text style={[styles.planName, { color: colors.text, fontSize: scaledFont(18) }]}>{plan.name}</Text>
                </View>
                <View style={styles.planPrice}>
                  <Text style={[styles.priceValue, { color: colors.text, fontSize: scaledFont(24) }]}>{plan.price}</Text>
                  <Text style={[styles.pricePeriod, { color: colors.textMuted, fontSize: scaledFont(12) }]}>{plan.period}</Text>
                </View>
              </View>

              <View style={[styles.planDivider, { backgroundColor: colors.border }]} />

              {plan.features.map((feature, i) => (
                <View key={i} style={styles.featureRow}>
                  <Check color={colors.accent} size={14} />
                  <Text style={[styles.featureText, { color: colors.textSecondary, fontSize: scaledFont(12) }]}>{feature}</Text>
                </View>
              ))}
            </TouchableOpacity>
          ))}

          {!isActive && (
            <TouchableOpacity
              onPress={handleSubscribe}
              style={[styles.subscribeBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.8}
            >
              <Star color="#fff" size={18} />
              <Text style={[styles.subscribeText, { fontSize: scaledFont(16) }]}>
                Start {config.trialDurationDays}-Day Free Trial
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Shield color={colors.textDim} size={18} />
            <Text style={[styles.infoText, { color: colors.textMuted, fontSize: scaledFont(11) }]}>
              Payments are processed securely through Apple App Store or Google Play. No credit card data is stored on our servers. Cancel anytime.
            </Text>
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
  heroSection: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  heroTitle: { fontWeight: "800" as const, letterSpacing: -0.5 },
  heroDesc: { marginTop: 6, textAlign: "center" as const, lineHeight: 20 },
  statusCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 24 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusInfo: { flex: 1 },
  statusTitle: { fontWeight: "700" as const },
  statusDesc: { marginTop: 2 },
  cancelBtn: { marginTop: 12, alignSelf: "flex-start", padding: 4 },
  cancelText: { fontWeight: "600" as const },
  plansLabel: { letterSpacing: 3, fontWeight: "700" as const, marginBottom: 12 },
  planCard: { borderRadius: 18, padding: 18, marginBottom: 14, position: "relative" as const, overflow: "hidden" as const },
  popularBadge: { position: "absolute" as const, top: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderTopRightRadius: 18, borderBottomLeftRadius: 10 },
  popularText: { color: "#fff", fontSize: 9, fontWeight: "700" as const, letterSpacing: 1 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  planName: { fontWeight: "700" as const },
  planPrice: { alignItems: "flex-end" },
  priceValue: { fontWeight: "800" as const },
  pricePeriod: {},
  planDivider: { height: 1, marginVertical: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  featureText: { flex: 1 },
  subscribeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18, borderRadius: 16, marginTop: 4, marginBottom: 20 },
  subscribeText: { color: "#fff", fontWeight: "800" as const },
  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  infoText: { flex: 1, lineHeight: 18 },
});
