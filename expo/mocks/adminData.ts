import type { SystemConfig } from "@/types/admin";

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  monthlyPrice: 5.99,
  yearlyPrice: 59.99,
  trialDurationDays: 7,
  otpRateLimitPerWindow: 3,
  otpWindowMinutes: 15,
  maxFailedOtpAttempts: 5,
  lockoutDurationMinutes: 30,
  singleDevicePolicy: true,
  emailVerificationEnabled: true,
  smsVerificationEnabled: false,
  allowFileUploads: true,
};
