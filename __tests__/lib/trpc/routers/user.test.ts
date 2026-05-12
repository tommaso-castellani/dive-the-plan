import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockTRPCContext } from '@/__tests__/setup/mocks';

import { appRouter } from '@/lib/trpc/router';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('@/lib/auth/providers', () => ({
  auth: {
    api: {
      updateUser: vi.fn(),
    },
  },
}));

vi.mock('@/lib/storage', () => ({
  uploadProfileImage: vi.fn(),
  deleteProfileImage: vi.fn(),
}));

vi.mock('@/lib/services/user-service', () => ({
  getUserById: vi.fn(),
  getNotificationSettings: vi.fn(),
  updateNotificationSettings: vi.fn(),
  updateDisplayName: vi.fn(),
  deleteUserProfileImage: vi.fn(),
  isUserAdmin: vi.fn(),
}));

vi.mock('@/lib/services/notification-service', () => ({
  syncMarketingPreference: vi.fn(),
}));

vi.mock('@/lib/services/config-service', () => ({
  isGoogleApiKeyConfigured: vi.fn(() => true),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({})),
}));

describe('User Router', () => {
  const mockUserId = 'user_123';
  const base64Image =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  let caller: ReturnType<typeof appRouter.createCaller>;
  let auth: any;
  let uploadProfileImage: any;
  let deleteProfileImage: any;
  let userService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamically import after mocks are applied
    ({ auth } = await import('@/lib/auth/providers'));
    ({ uploadProfileImage, deleteProfileImage } = await import('@/lib/storage'));
    userService = await import('@/lib/services/user-service');

    // Default happy-path mocks
    auth.api.updateUser.mockResolvedValue({});
    uploadProfileImage.mockResolvedValue('http://localhost:3000/uploads/new-avatar.png');
    deleteProfileImage.mockResolvedValue(undefined);
    userService.deleteUserProfileImage.mockResolvedValue(
      'http://localhost:3000/uploads/old-avatar.png'
    );

    const ctx = await createMockTRPCContext({
      userId: mockUserId,
    });
    caller = await appRouter.createCaller(ctx);
  });

  describe('uploadProfileImage', () => {
    it('uploads a profile image successfully', async () => {
      const result = await caller.user.uploadProfileImage({
        fileBase64: base64Image,
        fileName: 'avatar.png',
        mimeType: 'image/png',
      });

      expect(uploadProfileImage).toHaveBeenCalledWith(expect.any(File), mockUserId);
      expect(auth.api.updateUser).toHaveBeenCalledWith({
        body: { image: 'http://localhost:3000/uploads/new-avatar.png' },
        headers: expect.any(Object),
      });
      expect(result).toEqual({
        success: true,
        imageUrl: 'http://localhost:3000/uploads/new-avatar.png',
        message: 'Profile image updated successfully',
      });
    });

    it('throws BAD_REQUEST when file size exceeds 5MB', async () => {
      const largeBase64 = 'data:image/png;base64,' + 'A'.repeat(7 * 1024 * 1024);

      await expect(
        caller.user.uploadProfileImage({
          fileBase64: largeBase64,
          fileName: 'big-avatar.png',
          mimeType: 'image/png',
        })
      ).rejects.toThrow(/File too large/);
    });

    it('throws when upload fails', async () => {
      uploadProfileImage.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(
        caller.user.uploadProfileImage({
          fileBase64: base64Image,
          fileName: 'avatar.png',
          mimeType: 'image/png',
        })
      ).rejects.toThrow(/Upload failed/);
    });
  });

  describe('deleteProfileImage', () => {
    it('deletes an existing profile image successfully', async () => {
      const result = await caller.user.deleteProfileImage();

      expect(userService.deleteUserProfileImage).toHaveBeenCalledWith(mockUserId);
      expect(deleteProfileImage).toHaveBeenCalledWith(
        'http://localhost:3000/uploads/old-avatar.png'
      );
      expect(result).toEqual({
        success: true,
        message: 'Profile image deleted successfully',
      });
    });

    it('throws when service rejects (no image to delete)', async () => {
      userService.deleteUserProfileImage.mockRejectedValueOnce(
        new Error('Profile image not found')
      );

      await expect(caller.user.deleteProfileImage()).rejects.toThrow(/Profile image not found/);
    });
  });

  describe('updateDisplayName', () => {
    it('updates display name successfully', async () => {
      userService.updateDisplayName.mockResolvedValueOnce({
        id: mockUserId,
        displayName: 'New Name',
      });

      const result = await caller.user.updateDisplayName({ displayName: 'New Name' });

      expect(userService.updateDisplayName).toHaveBeenCalledWith(mockUserId, 'New Name');
      expect(result).toEqual({
        success: true,
        displayName: 'New Name',
        message: 'Display name updated successfully',
      });
    });

    it('throws BAD_REQUEST when display name is empty', async () => {
      await expect(caller.user.updateDisplayName({ displayName: '' })).rejects.toThrow();
    });
  });

  describe('isAdmin', () => {
    it('returns true when user is admin', async () => {
      userService.isUserAdmin.mockResolvedValueOnce(true);

      const result = await caller.user.isAdmin();

      expect(userService.isUserAdmin).toHaveBeenCalledWith(mockUserId);
      expect(result).toBe(true);
    });

    it('returns false when user is not admin', async () => {
      userService.isUserAdmin.mockResolvedValueOnce(false);

      const result = await caller.user.isAdmin();

      expect(result).toBe(false);
    });
  });

  describe('checkGoogleApiKey', () => {
    it('returns configured: true when key is set', async () => {
      const result = await caller.user.checkGoogleApiKey();
      expect(result).toEqual({ configured: true });
    });
  });
});
