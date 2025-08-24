import { useEffect, useState, useCallback } from 'react';
import { dashboardService, DashboardSummary } from '../services/dashboardService';

export function useDashboardSummary() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await dashboardService.getSummary();
      setData(summary);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
