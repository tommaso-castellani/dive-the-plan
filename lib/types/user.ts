// Notification settings types
export interface NotificationSettings {
  emailNotifications: boolean;
  marketingEmails: boolean;
  securityAlerts: boolean;
}

// User roles for the Better Auth admin plugin
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
