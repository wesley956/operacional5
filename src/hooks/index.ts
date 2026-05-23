// ============================================================
// OPERACIONAL5 — Hooks Centrais
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { getDataProvider } from '@/lib/data/data-provider';
import { useProfile } from '@/context/AuthContext';
import { getPermissions } from '@/lib/utils';
import type {
  Post, Profile, Presence, Occurrence, FTRequest,
  OperationalPostStatus, DashboardSummary, Schedule,
} from '@/lib/types';
import type {
  PostFilters, EmployeeFilters, PresenceFilters, OccurrenceFilters,
  FTFilters, HandoverFilters, NotificationFilters, ScheduleFilters,
  ConfirmPresenceInput, CreateOccurrenceInput, TriggerSOSInput, OpenFTInput,
  PresenceResult, RondaPointData, RondaLogData, HandoverData,
  ReportData, NotificationData,
} from '@/lib/data/data-provider';

// ==================== USE POSTS ====================
export function usePosts(filters?: PostFilters) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [statuses, setStatuses] = useState<OperationalPostStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useProfile();
  const permissions = getPermissions(profile.role);
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const [p, s] = await Promise.all([
        dp.posts.list(filters),
        dp.posts.getOperationalStatuses(),
      ]);
      setPosts(p);
      setStatuses(s);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createPost = useCallback(async (
    data: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'qr_code_token' | 'company_id'> & {
      company_id?: string;
    }
  ): Promise<Post> => {
    const dp = getDataProvider();

    const post = await dp.posts.create({
      ...data,
      company_id: data.company_id ?? profile.company_id,
    } as Omit<Post, 'id' | 'created_at' | 'updated_at' | 'qr_code_token'>);

    await refresh();
    return post;
  }, [profile.company_id, refresh]);

  const updatePost = useCallback(async (id: string, data: Partial<Post>): Promise<Post> => {
    const dp = getDataProvider();
    const post = await dp.posts.update(id, data);
    await refresh();
    return post;
  }, [refresh]);

  const getStatus = (postId: string) => statuses.find(s => s.post_id === postId);

  return { posts, statuses, getStatus, loading, permissions, refresh, createPost, updatePost };
}

// ==================== USE EMPLOYEES ====================
export function useEmployees(filters?: EmployeeFilters) {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const data = await dp.employees.list(filters);
        setEmployees(data);
      } finally { setLoading(false); }
    };
    load();
  }, [JSON.stringify(filters)]);

  return { employees, loading };
}

// ==================== USE PRESENCE ====================
export function usePresence(filters?: PresenceFilters) {
  const [presences, setPresences] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const data = await dp.presence.list(filters);
        setPresences(data);
      } finally { setLoading(false); }
    };
    load();
  }, [JSON.stringify(filters)]);

  const confirmPresence = useCallback(async (input: ConfirmPresenceInput): Promise<PresenceResult> => {
    const dp = getDataProvider();
    const result = await dp.presence.confirm(input);
    if (result.success) {
      const data = await dp.presence.list(filters);
      setPresences(data);
    }
    return result;
  }, [JSON.stringify(filters)]);

  return { presences, loading, confirmPresence };
}

// ==================== USE OCCURRENCES ====================
export function useOccurrences(filters?: OccurrenceFilters) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const data = await dp.occurrences.list(filters);
        setOccurrences(data);
      } finally { setLoading(false); }
    };
    load();
  }, [JSON.stringify(filters)]);

  const createOccurrence = useCallback(async (input: CreateOccurrenceInput): Promise<Occurrence> => {
    const dp = getDataProvider();
    const occ = await dp.occurrences.create(input);
    const data = await dp.occurrences.list(filters);
    setOccurrences(data);
    return occ;
  }, [JSON.stringify(filters)]);

  return { occurrences, loading, createOccurrence };
}

// ==================== USE SOS ====================
export function useSOS() {
  const [active, setActive] = useState<Occurrence[]>([]);

  useEffect(() => {
    const load = async () => {
      const dp = getDataProvider();
      const data = await dp.sos.getActive();
      setActive(data);
    };
    load();
  }, []);

  const triggerSOS = useCallback(async (input: TriggerSOSInput): Promise<Occurrence> => {
    const dp = getDataProvider();
    const occ = await dp.sos.trigger(input);
    const data = await dp.sos.getActive();
    setActive(data);
    return occ;
  }, []);

  const closeSOS = useCallback(async (occurrenceId: string, closedBy: string, resolution: string): Promise<Occurrence> => {
    const dp = getDataProvider();
    const occ = await dp.sos.close(occurrenceId, closedBy, resolution);
    const data = await dp.sos.getActive();
    setActive(data);
    return occ;
  }, []);

  return { active, triggerSOS, closeSOS };
}

// ==================== USE FT ====================
export function useFT(filters?: FTFilters) {
  const [fts, setFts] = useState<FTRequest[]>([]);
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const [ftData, candData] = await Promise.all([
          dp.ft.list(filters),
          dp.employees.getAvailableForFT(),
        ]);
        setFts(ftData);
        setCandidates(candData);
      } finally { setLoading(false); }
    };
    load();
  }, [JSON.stringify(filters)]);

  const openFT = useCallback(async (input: OpenFTInput): Promise<FTRequest> => {
    const dp = getDataProvider();
    const ft = await dp.ft.open(input);
    setFts(await dp.ft.list(filters));
    return ft;
  }, [JSON.stringify(filters)]);

  return { fts, candidates, loading, openFT };
}

// ==================== USE RONDAS ====================
export function useRondas(postId?: string) {
  const [points, setPoints] = useState<RondaPointData[]>([]);
  const [logs, setLogs] = useState<RondaLogData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const [ptData, logData] = await Promise.all([
          postId ? dp.ronda.getPoints(postId) : Promise.resolve([]),
          dp.ronda.getLogs(postId ? { post_id: postId } : undefined),
        ]);
        setPoints(ptData);
        setLogs(logData);
      } finally { setLoading(false); }
    };
    load();
  }, [postId]);

  return { points, logs, loading };
}

// ==================== USE HANDOVERS ====================
export function useHandovers(filters?: HandoverFilters) {
  const [handovers, setHandovers] = useState<HandoverData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const data = await dp.handover.list(filters);
        setHandovers(data);
      } finally { setLoading(false); }
    };
    load();
  }, [JSON.stringify(filters)]);

  return { handovers, loading };
}

// ==================== USE REPORTS ====================
export function useReports() {
  const [daily, setDaily] = useState<ReportData | null>(null);
  const [weekly, setWeekly] = useState<ReportData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const [d, w, dash] = await Promise.all([
          dp.reports.getDailyReport(),
          dp.reports.getWeeklyReport(),
          dp.reports.getDashboardSummary(),
        ]);
        setDaily(d);
        setWeekly(w);
        setDashboard(dash);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  return { daily, weekly, dashboard, loading };
}

// ==================== USE NOTIFICATIONS ====================
export function useNotifications(filters?: NotificationFilters) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const [data, count] = await Promise.all([
          dp.notifications.list(filters),
          dp.notifications.getUnreadCount(),
        ]);
        setNotifications(data);
        setUnreadCount(count);
      } finally { setLoading(false); }
    };
    load();
  }, [JSON.stringify(filters)]);

  const markAsRead = useCallback(async (id: string) => {
    const dp = getDataProvider();
    await dp.notifications.markAsRead(id);
    const [data, count] = await Promise.all([
      dp.notifications.list(filters),
      dp.notifications.getUnreadCount(),
    ]);
    setNotifications(data);
    setUnreadCount(count);
  }, [JSON.stringify(filters)]);

  const markAllRead = useCallback(async () => {
    const dp = getDataProvider();
    await dp.notifications.markAllRead();
    const [data, count] = await Promise.all([
      dp.notifications.list(filters),
      dp.notifications.getUnreadCount(),
    ]);
    setNotifications(data);
    setUnreadCount(count);
  }, [JSON.stringify(filters)]);

  return { notifications, unreadCount, loading, markAsRead, markAllRead };
}

// ==================== USE SCHEDULES ====================
export function useSchedules(filters?: ScheduleFilters) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const data = await dp.schedules.list(filters);
        setSchedules(data);
      } finally { setLoading(false); }
    };
    load();
  }, [JSON.stringify(filters)]);

  return { schedules, loading };
}

// ==================== USE OFFLINE STATUS ====================
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, pendingSync, setPendingSync };
}

// ==================== USE PERMISSIONS ====================
export function usePermissions() {
  const profile = useProfile();
  return getPermissions(profile.role);
}

// ==================== USE DASHBOARD ====================
export function useRealtimeDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [postStatuses, setStatuses] = useState<OperationalPostStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const dp = getDataProvider();
        const [sum, statuses] = await Promise.all([
          dp.reports.getDashboardSummary(),
          dp.posts.getOperationalStatuses(),
        ]);
        setSummary(sum);
        setStatuses(statuses);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const refresh = useCallback(async () => {
    const dp = getDataProvider();
    const [sum, statuses] = await Promise.all([
      dp.reports.getDashboardSummary(),
      dp.posts.getOperationalStatuses(),
    ]);
    setSummary(sum);
    setStatuses(statuses);
  }, []);

  return { summary, postStatuses, loading, refresh };
}
