// ============================================================
// OPERACIONAL5 — Hooks Centrais
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { getDataProvider } from '@/lib/data/data-provider';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useProfile } from '@/context/AuthContext';
import { getPermissions } from '@/lib/utils';
import type {
  Post, Profile, Role, Presence, Occurrence, FTRequest, Client,
  OperationalPostStatus, DashboardSummary, Schedule,
} from '@/lib/types';
import type {
  ClientFilters, CreateClientInput, PostFilters, EmployeeFilters, PresenceFilters, OccurrenceFilters,
  FTFilters, HandoverFilters, NotificationFilters, ScheduleFilters,
  ConfirmPresenceInput, CreateOccurrenceInput, TriggerSOSInput, OpenFTInput,
  PresenceResult, RondaPointData, RondaLogData, CreateRondaPointInput, HandoverData,
  ReportData, NotificationData, CreateHandoverInput, AuditEntryData, AuditFilters,
} from '@/lib/data/data-provider';


// ==================== USE CLIENTS ====================
export function useClients(filters?: ClientFilters) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useProfile();
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const data = await dp.clients.list(filters);
      setClients(data);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createClient = useCallback(async (
    data: Omit<CreateClientInput, 'company_id'> & { company_id?: string }
  ): Promise<Client> => {
    const dp = getDataProvider();
    const client = await dp.clients.create({
      ...data,
      company_id: data.company_id ?? profile.company_id,
    });
    await refresh();
    return client;
  }, [profile.company_id, refresh]);

  const updateClient = useCallback(async (id: string, data: Partial<CreateClientInput>): Promise<Client> => {
    const dp = getDataProvider();
    const client = await dp.clients.update(id, data);
    await refresh();
    return client;
  }, [refresh]);

  return { clients, loading, refresh, createClient, updateClient };
}

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

  const deactivatePost = useCallback((id: string): Promise<Post> => updatePost(id, { active: false }), [updatePost]);

  const reactivatePost = useCallback((id: string): Promise<Post> => updatePost(id, { active: true }), [updatePost]);

  const deletePost = useCallback(async (id: string): Promise<void> => {
    const dp = getDataProvider();
    await dp.posts.delete(id);
    await refresh();
  }, [refresh]);

  const getStatus = (postId: string) => statuses.find(s => s.post_id === postId);

  return {
    posts,
    statuses,
    getStatus,
    loading,
    permissions,
    refresh,
    createPost,
    updatePost,
    deactivatePost,
    reactivatePost,
    deletePost,
  };
}

// ==================== USE EMPLOYEES ====================
export function useEmployees(filters?: EmployeeFilters) {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const data = await dp.employees.list(filters);
      setEmployees(data);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createEmployee = useCallback(async (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: Role;
    ft_available: boolean;
    regime_trabalho: Profile['regime_trabalho'];
    data_referencia_ciclo: string;
  }): Promise<Profile> => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.functions.invoke('create-employee', {
      body: input,
    });

    if (error) {
      const errorWithContext = error as { context?: Response };
      const contextBody = errorWithContext.context
        ? await errorWithContext.context.json().catch(() => null)
        : null;

      throw new Error(
        contextBody?.error ??
        contextBody?.message ??
        error.message ??
        'Erro ao chamar Edge Function create-employee.'
      );
    }

    if (!data?.ok) {
      throw new Error(data?.error ?? 'Erro ao cadastrar funcionário.');
    }

    const createdProfile = data.profile as Profile;

    setEmployees(current => {
      const exists = current.some(employee => employee.id === createdProfile.id);
      if (exists) {
        return current.map(employee => employee.id === createdProfile.id ? createdProfile : employee);
      }
      return [...current, createdProfile].sort((a, b) => a.name.localeCompare(b.name));
    });

    await refresh();
    return createdProfile;
  }, [refresh]);

  const updateEmployee = useCallback(async (id: string, data: Partial<Profile>): Promise<Profile> => {
    const dp = getDataProvider();
    const updatedProfile = await dp.employees.update(id, data);

    setEmployees(current => {
      const next = current.map(employee => employee.id === id ? updatedProfile : employee);
      const shouldKeep = filters?.active === undefined || updatedProfile.active === filters.active;

      if (!current.some(employee => employee.id === id) && shouldKeep) {
        next.push(updatedProfile);
      }

      return next
        .filter(employee => filters?.active === undefined || employee.active === filters.active)
        .sort((a, b) => a.name.localeCompare(b.name));
    });

    await refresh();
    return updatedProfile;
  }, [refresh, filterKey]);

  return { employees, loading, refresh, createEmployee, updateEmployee };
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
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const data = await dp.occurrences.list(filters);
      setOccurrences(data);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createOccurrence = useCallback(async (input: CreateOccurrenceInput): Promise<Occurrence> => {
    const dp = getDataProvider();
    const occ = await dp.occurrences.create(input);
    await refresh();
    return occ;
  }, [refresh]);

  const acknowledgeOccurrence = useCallback(async (id: string, role: Role): Promise<Occurrence> => {
    const dp = getDataProvider();
    const occ = await dp.occurrences.acknowledge(id, role);
    await refresh();
    return occ;
  }, [refresh]);

  const resolveOccurrence = useCallback(async (id: string, resolvedBy: string): Promise<Occurrence> => {
    const dp = getDataProvider();
    const occ = await dp.occurrences.resolve(id, resolvedBy);
    await refresh();
    return occ;
  }, [refresh]);

  const closeSOSOccurrence = useCallback(async (id: string, closedBy: string, resolution: string): Promise<Occurrence> => {
    const dp = getDataProvider();
    const occ = await dp.sos.close(id, closedBy, resolution);
    await refresh();
    return occ;
  }, [refresh]);

  return {
    occurrences,
    loading,
    refresh,
    createOccurrence,
    acknowledgeOccurrence,
    resolveOccurrence,
    closeSOSOccurrence,
  };
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
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const [ftData, candData] = await Promise.all([
        dp.ft.list(filters),
        dp.employees.getAvailableForFT(),
      ]);
      setFts(ftData);
      setCandidates(candData);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openFT = useCallback(async (input: OpenFTInput): Promise<FTRequest> => {
    const dp = getDataProvider();
    const ft = await dp.ft.open(input);
    await refresh();
    return ft;
  }, [refresh]);

  const assignFT = useCallback(async (ftId: string, employeeId: string): Promise<FTRequest> => {
    const dp = getDataProvider();
    const ft = await dp.ft.assign(ftId, employeeId);
    await refresh();
    return ft;
  }, [refresh]);

  const resolveFT = useCallback(async (ftId: string): Promise<FTRequest> => {
    const dp = getDataProvider();
    const ft = await dp.ft.resolve(ftId);
    await refresh();
    return ft;
  }, [refresh]);

  const cancelFT = useCallback(async (ftId: string): Promise<FTRequest> => {
    const dp = getDataProvider();
    const ft = await dp.ft.cancel(ftId);
    await refresh();
    return ft;
  }, [refresh]);

  return { fts, candidates, loading, refresh, openFT, assignFT, resolveFT, cancelFT };
}

// ==================== USE RONDAS ====================
export function useRondas(postId?: string) {
  const [points, setPoints] = useState<RondaPointData[]>([]);
  const [logs, setLogs] = useState<RondaLogData[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const [posts, logData] = await Promise.all([
        postId ? Promise.resolve([]) : dp.posts.list({ active: true }),
        dp.ronda.getLogs(postId ? { post_id: postId } : undefined),
      ]);

      const pointData = postId
        ? await dp.ronda.getPoints(postId)
        : (await Promise.all(posts.map(post => dp.ronda.getPoints(post.id)))).flat();

      setPoints(pointData);
      setLogs(logData);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const createPoint = useCallback(async (input: CreateRondaPointInput): Promise<RondaPointData> => {
    const dp = getDataProvider();
    const point = await dp.ronda.createPoint(input);
    await refresh();
    return point;
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { points, logs, loading, refresh, createPoint };
}

// ==================== USE AUDIT LOG ====================
export function useAuditLog(filters?: AuditFilters) {
  const [entries, setEntries] = useState<AuditEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useProfile();
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const data = await dp.audit.list({
        company_id: filters?.company_id ?? profile.company_id,
        ...filters,
      });
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [filterKey, profile.company_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, refresh };
}

// ==================== USE HANDOVERS ====================
export function useHandovers(filters?: HandoverFilters) {
  const [handovers, setHandovers] = useState<HandoverData[]>([]);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const data = await dp.handover.list(filters);
      setHandovers(data);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createHandover = useCallback(async (input: CreateHandoverInput): Promise<HandoverData> => {
    const dp = getDataProvider();
    const handover = await dp.handover.create(input);
    await refresh();
    return handover;
  }, [refresh]);

  const confirmHandover = useCallback(async (id: string): Promise<HandoverData> => {
    const dp = getDataProvider();
    const handover = await dp.handover.confirm(id);
    await refresh();
    return handover;
  }, [refresh]);

  const reportRetention = useCallback(async (id: string, reason: string): Promise<HandoverData> => {
    const dp = getDataProvider();
    const handover = await dp.handover.reportRetention(id, reason);
    await refresh();
    return handover;
  }, [refresh]);

  return { handovers, loading, refresh, createHandover, confirmHandover, reportRetention };
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
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const dp = getDataProvider();
      const [data, count] = await Promise.all([
        dp.notifications.list(filters),
        dp.notifications.getUnreadCount(),
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh(true);

    const interval = window.setInterval(() => {
      void refresh(false);
    }, 30_000);

    const handleFocus = () => void refresh(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  const markAsRead = useCallback(async (id: string) => {
    const dp = getDataProvider();
    await dp.notifications.markAsRead(id);
    await refresh(false);
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const dp = getDataProvider();
    await dp.notifications.markAllRead();
    await refresh(false);
  }, [refresh]);

  return { notifications, unreadCount, loading, refresh, markAsRead, markAllRead };
}

// ==================== USE SCHEDULES ====================
export function useSchedules(filters?: ScheduleFilters) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useProfile();
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dp = getDataProvider();
      const data = await dp.schedules.list(filters);
      setSchedules(data);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSchedule = useCallback(async (
    data: Omit<Schedule, 'id' | 'created_at' | 'company_id'> & {
      company_id?: string;
    }
  ): Promise<Schedule> => {
    const dp = getDataProvider();

    const schedule = await dp.schedules.create({
      ...data,
      company_id: data.company_id ?? profile.company_id,
    } as Omit<Schedule, 'id' | 'created_at'>);

    setSchedules(current => [...current, schedule].sort(
      (a, b) => new Date(a.shift_start).getTime() - new Date(b.shift_start).getTime()
    ));

    await refresh();
    return schedule;
  }, [profile.company_id, refresh]);

  const updateSchedule = useCallback(async (
    id: string,
    data: Partial<Omit<Schedule, 'id' | 'company_id' | 'created_at'>>
  ): Promise<Schedule> => {
    const dp = getDataProvider();
    const schedule = await dp.schedules.update(id, data);
    setSchedules(current => current
      .map(item => (item.id === id ? schedule : item))
      .sort((a, b) => new Date(a.shift_start).getTime() - new Date(b.shift_start).getTime())
    );
    await refresh();
    return schedule;
  }, [refresh]);

  const deactivateSchedule = useCallback((id: string): Promise<Schedule> => updateSchedule(id, {
    is_active: false,
    status: 'inactive',
  }), [updateSchedule]);

  const reactivateSchedule = useCallback((id: string): Promise<Schedule> => updateSchedule(id, {
    is_active: true,
    status: 'active',
  }), [updateSchedule]);

  const deleteSchedule = useCallback(async (id: string): Promise<void> => {
    const dp = getDataProvider();
    await dp.schedules.delete(id);
    setSchedules(current => current.filter(item => item.id !== id));
    await refresh();
  }, [refresh]);

  const detectConflicts = useCallback(async (employeeId: string) => {
    const dp = getDataProvider();
    return dp.schedules.detectConflicts(employeeId);
  }, []);

  return {
    schedules,
    loading,
    refresh,
    createSchedule,
    updateSchedule,
    deactivateSchedule,
    reactivateSchedule,
    deleteSchedule,
    detectConflicts,
  };
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
const DASHBOARD_AUTO_REFRESH_MS = 30_000;

export function useRealtimeDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [postStatuses, setStatuses] = useState<OperationalPostStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);

    try {
      const dp = getDataProvider();
      const [sum, statuses] = await Promise.all([
        dp.reports.getDashboardSummary(),
        dp.posts.getOperationalStatuses(),
      ]);
      setSummary(sum);
      setStatuses(statuses);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const interval = window.setInterval(() => {
      void refresh({ silent: true });
    }, DASHBOARD_AUTO_REFRESH_MS);

    const handleFocus = () => {
      void refresh({ silent: true });
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh]);

  return { summary, postStatuses, loading, refresh };
}
