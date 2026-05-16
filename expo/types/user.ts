export type UserRole = "Consultant" | "Fellow" | "Resident" | "Nurse";

export type FontSize = "small" | "medium" | "large" | "extra_large";

export interface UserProfile {
  id: string;
  fullName: string;
  nationalId: string;
  medicalSpecialty: string;
  role: UserRole;
  contactNumber: string;
  profileImageUri: string | null;
  email: string;
}

export interface UserPreferences {
  darkMode: boolean;
  fontSize: FontSize;
  notificationsEnabled: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  priceValue: number;
  features: string[];
  popular?: boolean;
}

export type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled" | "none";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  planId: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
}

export const FONT_SIZE_VALUES: Record<FontSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.15,
  extra_large: 1.3,
};

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  extra_large: "Extra Large",
};
