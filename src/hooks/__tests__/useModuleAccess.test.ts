/**
 * useModuleAccess.test.ts - Tests for module access hook
 *
 * Purpose: Verify entitlement and enable state checking, multiple module access,
 * loading states, error handling, and refresh functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useModuleAccess, useModuleAccessMultiple, useModuleMetadata } from '../useModuleAccess';
import type { ModuleName } from '../../types/tenantModules';

// Mock the tenant module service
const mockGetTenantModuleConfig = vi.fn();

vi.mock('../../services/tenantModuleService', () => ({
  getTenantModuleConfig: () => mockGetTenantModuleConfig(),
}));

// Mock module metadata and getEntitlementName
vi.mock('../../types/tenantModules', () => ({
  getEntitlementName: (moduleName: string) => {
    // Map module names to entitlement names
    const mapping: Record<string, string> = {
      dental_enabled: 'dental_entitled',
      sdoh_enabled: 'sdoh_entitled',
      memory_clinic_enabled: 'memory_clinic_entitled',
      behavioral_enabled: 'behavioral_entitled',
    };
    return mapping[moduleName] || `${moduleName.replace('_enabled', '_entitled')}`;
  },
  MODULE_METADATA: {
    dental_enabled: {
      name: 'Dental Care',
      description: 'Dental care management module',
      icon: 'tooth',
    },
    sdoh_enabled: {
      name: 'SDOH Assessment',
      description: 'Social determinants of health module',
      icon: 'home',
    },
    memory_clinic_enabled: {
      name: 'Memory Clinic',
      description: 'Memory and cognitive assessment module',
      icon: 'brain',
    },
  },
}));

describe('useModuleAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should start in loading state', () => {
      mockGetTenantModuleConfig.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      expect(result.current.loading).toBe(true);
      expect(result.current.canAccess).toBe(false);
      expect(result.current.denialReason).toBe('loading');
    });

    it('should exit loading state after config loads', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: true,
        dental_entitled: true,
      });

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Access Checking', () => {
    it('should allow access when both entitled and enabled', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: true,
        dental_entitled: true,
      });

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccess).toBe(true);
      expect(result.current.isEntitled).toBe(true);
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.denialReason).toBeNull();
    });

    it('should deny access when entitled but not enabled', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: false,
        dental_entitled: true,
      });

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccess).toBe(false);
      expect(result.current.isEntitled).toBe(true);
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.denialReason).toBe('not_enabled');
    });

    it('should deny access when not entitled', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: true,
        dental_entitled: false,
      });

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccess).toBe(false);
      expect(result.current.isEntitled).toBe(false);
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.denialReason).toBe('not_entitled');
    });

    it('should deny access when neither entitled nor enabled', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: false,
        dental_entitled: false,
      });

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccess).toBe(false);
      expect(result.current.denialReason).toBe('not_entitled');
    });
  });

  describe('No Config Handling', () => {
    it('should handle null config gracefully', async () => {
      mockGetTenantModuleConfig.mockResolvedValue(null);

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccess).toBe(false);
      expect(result.current.denialReason).toBe('no_config');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      mockGetTenantModuleConfig.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
      // Should still allow access checks with defaults
      expect(result.current.canAccess).toBe(false);
    });

    it('should convert non-Error exceptions to Error objects', async () => {
      mockGetTenantModuleConfig.mockRejectedValue('String error');

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh config when refresh is called', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: false,
        dental_entitled: true,
      });

      const { result } = renderHook(() => useModuleAccess('dental_enabled'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccess).toBe(false);

      // Update mock to return different data
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: true,
        dental_entitled: true,
      });

      // Call refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.canAccess).toBe(true);
      expect(mockGetTenantModuleConfig).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useModuleAccessMultiple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Multiple Module Access', () => {
    it('should check access for multiple modules', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: true,
        dental_entitled: true,
        sdoh_enabled: true,
        sdoh_entitled: true,
        memory_clinic_enabled: false,
        memory_clinic_entitled: true,
      });

      const { result } = renderHook(() =>
        useModuleAccessMultiple(['dental_enabled', 'sdoh_enabled', 'memory_clinic_enabled'])
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.modules.dental_enabled).toBe(true);
      expect(result.current.modules.sdoh_enabled).toBe(true);
      expect(result.current.modules.memory_clinic_enabled).toBe(false);
    });

    it('should return canAccessAll=true when all modules accessible', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: true,
        dental_entitled: true,
        sdoh_enabled: true,
        sdoh_entitled: true,
      });

      const { result } = renderHook(() =>
        useModuleAccessMultiple(['dental_enabled', 'sdoh_enabled'])
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccessAll).toBe(true);
      expect(result.current.canAccessAny).toBe(true);
    });

    it('should return canAccessAll=false when any module inaccessible', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: true,
        dental_entitled: true,
        sdoh_enabled: false,
        sdoh_entitled: true,
      });

      const { result } = renderHook(() =>
        useModuleAccessMultiple(['dental_enabled', 'sdoh_enabled'])
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccessAll).toBe(false);
      expect(result.current.canAccessAny).toBe(true);
    });

    it('should return canAccessAny=false when no modules accessible', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: false,
        dental_entitled: false,
        sdoh_enabled: false,
        sdoh_entitled: false,
      });

      const { result } = renderHook(() =>
        useModuleAccessMultiple(['dental_enabled', 'sdoh_enabled'])
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccessAll).toBe(false);
      expect(result.current.canAccessAny).toBe(false);
    });
  });

  describe('No Config Handling', () => {
    it('should handle null config for multiple modules', async () => {
      mockGetTenantModuleConfig.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useModuleAccessMultiple(['dental_enabled', 'sdoh_enabled'])
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.modules.dental_enabled).toBe(false);
      expect(result.current.modules.sdoh_enabled).toBe(false);
      expect(result.current.canAccessAll).toBe(false);
      expect(result.current.canAccessAny).toBe(false);
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh all module states', async () => {
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: false,
        dental_entitled: true,
        sdoh_enabled: false,
        sdoh_entitled: true,
      });

      const { result } = renderHook(() =>
        useModuleAccessMultiple(['dental_enabled', 'sdoh_enabled'])
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canAccessAny).toBe(false);

      // Update mock
      mockGetTenantModuleConfig.mockResolvedValue({
        dental_enabled: true,
        dental_entitled: true,
        sdoh_enabled: true,
        sdoh_entitled: true,
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.canAccessAll).toBe(true);
    });
  });
});

describe('useModuleMetadata', () => {
  it('should return metadata for known module', () => {
    const { result } = renderHook(() => useModuleMetadata('dental_enabled'));

    expect(result.current).toEqual({
      name: 'Dental Care',
      description: 'Dental care management module',
      icon: 'tooth',
    });
  });

  it('should return undefined for unknown module', () => {
    const { result } = renderHook(() => useModuleMetadata('unknown_module' as 'dental_enabled'));

    expect(result.current).toBeUndefined();
  });
});
