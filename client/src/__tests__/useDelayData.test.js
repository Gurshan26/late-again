import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDelayData } from '../hooks/useDelayData';

describe('useDelayData', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ currentRisk: 42 }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches data immediately for provided line', async () => {
    const { result } = renderHook(() => useDelayData('frankston'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.currentRisk).toBe(42);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('polls every 30 seconds', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayData('frankston'));

    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    await act(async () => {});
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('sets error on failed request', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useDelayData('frankston'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('HTTP 500');
  });
});
