import api from './api';

export interface DashboardSummary {
  planName: string;
  flowsMax: number; // maximum allowed workflows for current plan
  apiCalls: number;
  apiCallsMax: number;
  storageUsedGb: number;
  storageMaxGb: number;
}

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>('/dashboard/summary');
    return data;
  },
};
