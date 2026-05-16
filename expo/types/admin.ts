export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  nationalId: string;
  medicalSpecialty: string;
  role: string;
  contactNumber: string;
  deviceId: string;
  status: "active" | "suspended" | "deleted";
  subscriptionStatus: "active" | "trial" | "expired" | "cancelled" | "none";
  subscriptionPlan: "monthly" | "yearly" | null;
  subscriptionExpiry: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  lastLoginAt: string;
  loginCount: number;
}

export interface PaymentEvent {
  id: string;
  userId: string;
  userName: string;
  type:
    | "trial_started"
    | "subscription_activated"
    | "subscription_renewed"
    | "subscription_cancelled"
    | "payment_failed"
    | "subscription_expired";
  plan: "monthly" | "yearly" | null;
  amount: number | null;
  timestamp: string;
}

export interface SecurityEvent {
  id: string;
  userId: string | null;
  userName: string | null;
  type:
    | "failed_login"
    | "otp_request"
    | "device_change"
    | "suspicious_activity"
    | "password_changed"
    | "account_locked";
  ipAddress: string;
  deviceInfo: string;
  timestamp: string;
  details: string;
}

export interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  ipAddress: string;
  deviceInfo: string;
  status: "success" | "failed";
}

export interface AdminStats {
  totalUsers: number;
  activeSubscribers: number;
  trialUsers: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  subscriberGrowth: number;
  cancelledThisMonth: number;
  failedPayments: number;
}

export interface SystemConfig {
  monthlyPrice: number;
  yearlyPrice: number;
  trialDurationDays: number;
  otpRateLimitPerWindow: number;
  otpWindowMinutes: number;
  maxFailedOtpAttempts: number;
  lockoutDurationMinutes: number;
  singleDevicePolicy: boolean;
  emailVerificationEnabled: boolean;
  smsVerificationEnabled: boolean;
  allowFileUploads: boolean;
}

export type AdminTab =
  | "overview"
  | "users"
  | "subscriptions"
  | "events"
  | "security"
  | "config"
  | "revenue";
