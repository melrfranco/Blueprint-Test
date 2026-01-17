import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';

import type {
  Service,
  StylistLevel,
  Stylist,
  Client,
  ServiceLinkingConfig,
  BrandingSettings,
  MembershipConfig,
  AppTextSize,
} from '../types';

import { ALL_SERVICES, STYLIST_LEVELS } from '../data/mockData';
import { supabase } from '../lib/supabase';

type IntegrationProvider = 'square' | 'vagaro' | 'mindbody';
type IntegrationEnvironment = 'sandbox' | 'production';

export interface IntegrationSettings {
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
}

// Accept ALL valid UUID versions (Supabase ids)
const isValidUUID = (id?: string) =>
  !!id &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );

interface SettingsContextType {
  services: Service[];
  levels: StylistLevel[];
  stylists: Stylist[];
  clients: Client[];
  membershipConfig: MembershipConfig;
  branding: BrandingSettings;
  integration: IntegrationSettings;
  linkingConfig: ServiceLinkingConfig;
  textSize: AppTextSize;
  pushAlertsEnabled: boolean;
  pinnedReports: { [userId: string]: string[] };

  // Team loading states used by UI
  loadingTeam: boolean;
  teamError: string | null;

  // Updaters
  updateServices: (services: Service[]) => void;
  updateLevels: (levels: StylistLevel[]) => void;
  updateStylists: (stylists: Stylist[]) => void;
  updateClients: (clients: Client[]) => void;

  updateMembershipConfig: React.Dispatch<React.SetStateAction<MembershipConfig>>;
  updateBranding: (branding: BrandingSettings) => void;
  updateIntegration: (integration: IntegrationSettings) => void;
  updateLinkingConfig: (config: ServiceLinkingConfig) => void;

  updateTextSize: (size: AppTextSize) => void;
  updatePushAlertsEnabled: (enabled: boolean) => void;
  updatePinnedReports: (userId: string | number, reportIds: string[]) => void;

  createClient: (clientData: { name: string; email: string }) => Promise<Client>;
  resolveClientByExternalId: (
    externalId: string,
    clientDetails: { name: string; email?: string; phone?: string; avatarUrl?: string }
  ) => Promise<Client>;

  saveAll: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // --- Core settings state (single source of truth) ---
  const [services, setServices] = useState<Service[]>(() => ALL_SERVICES);
  const [levels, setLevels] = useState<StylistLevel[]>(() => STYLIST_LEVELS);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [membershipConfig, setMembershipConfig] = useState<MembershipConfig>({
    enabled: true,
    tiers: [],
  });

  const [branding, setBranding] = useState<BrandingSettings>({
    salonName: 'Blueprint',
    primaryColor: '#4338CA',
    secondaryColor: '#DB2777',
    accentColor: '#059669',
    font: 'Inter',
  });

  const [integration, setIntegration] = useState<IntegrationSettings>({
    provider: 'square',
    environment: 'production',
  });

  const [linkingConfig, setLinkingConfig] = useState<ServiceLinkingConfig>({
    enabled: true,
    triggerCategory: 'Color',
    triggerServiceIds: [],
    exclusionServiceId: '',
    linkedServiceId: '',
  });

  const [textSize, setTextSize] = useState<AppTextSize>('M');
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(false);
  const [pinnedReports, setPinnedReports] = useState<{ [userId: string]: string[] }>(
    {}
  );

  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // --- Load clients + team from Supabase AFTER auth is ready ---
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    const load = async () => {
      // Ensure we have an authenticated user before querying user-scoped tables
      const { data: userResp, error: userErr } = await supabase.auth.getUser();
      if (cancelled) return;

      const user = userResp?.user;
      if (userErr || !user) {
        // Not signed in yet; do not loop, just exit quietly.
        return;
      }

      // --- Clients (RLS enabled) ---
      // Expectation: clients table uses `supabase_user_id` and RLS allows auth.uid() to read its own rows.
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('supabase_user_id', user.id)
          .order('created_at', { ascending: true });

        if (!cancelled) {
          if (error) {
            console.error('Failed to load clients:', error);
            setClients([]);
          } else {
            const mapped: Client[] = (data || [])
              .map((row: any) => ({
                id: row.id,
                externalId: row.external_id,
                name: row.name,
                email: row.email,
                phone: row.phone,
                avatarUrl: row.avatar_url,
                historicalData: [],
                source: row.source || 'manual',
              }))
              .filter((c: Client) => isValidUUID(c.id));

            setClients(mapped);
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load clients (fatal):', e);
          setClients([]);
        }
      }

      // --- Team (RLS disabled per your report) ---
      // Filter by merchant_id if available in user metadata.
      const merchantId =
        (user.user_metadata as any)?.merchant_id ||
        (user.app_metadata as any)?.merchant_id ||
        null;

      setLoadingTeam(true);
      setTeamError(null);

      try {
        let query = supabase.from('square_team_members').select('*');
        if (merchantId) {
          query = query.eq('merchant_id', merchantId);
        }

        const { data, error } = await query;

        if (!cancelled) {
          if (error) {
            console.warn('Square team not available:', error.message);
            setStylists([]);
            setTeamError(null);
          } else {
            const mapped: Stylist[] = (data || []).map((row: any) => ({
              id: row.square_team_member_id,
              name: row.name,
              role: row.role || 'Team Member',
              email: row.email,
              levelId: row.level_id || 'default',
              permissions: row.permissions || {},
            }));
            setStylists(mapped);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('Team load failed:', e);
          setStylists([]);
          setTeamError(e?.message || 'Failed to load team');
        }
      } finally {
        if (!cancelled) setLoadingTeam(false);
      }
    };

    // Load once when provider mounts AND whenever auth state changes to signed-in.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        void load();
      }
    });

    // Also attempt once immediately (covers already-signed-in users)
    void load();

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // --- Mutators / utilities ---
  const updateServices = (v: Service[]) => setServices(v);
  const updateLevels = (v: StylistLevel[]) => setLevels(v);
  const updateStylists = (v: Stylist[]) => setStylists(v);
  const updateClients = (v: Client[]) => setClients(v);

  const updateBranding = (v: BrandingSettings) => setBranding(v);
  const updateIntegration = (v: IntegrationSettings) => setIntegration(v);
  const updateLinkingConfig = (v: ServiceLinkingConfig) => setLinkingConfig(v);

  const updateTextSize = (size: AppTextSize) => setTextSize(size);
  const updatePushAlertsEnabled = (enabled: boolean) =>
    setPushAlertsEnabled(enabled);

  const updatePinnedReports = (userId: string | number, reportIds: string[]) => {
    setPinnedReports((prev) => ({ ...prev, [String(userId)]: reportIds }));
  };

  const createClient = async (clientData: { name: string; email: string }) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: userResp, error: userErr } = await supabase.auth.getUser();
    const user = userResp?.user;
    if (userErr || !user) throw new Error('Not authenticated');

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      clientData.name
    )}&background=random`;

    const { data, error } = await supabase
      .from('clients')
      .insert(
        {
          supabase_user_id: user.id,
          name: clientData.name,
          email: clientData.email,
          avatar_url: avatarUrl,
          source: 'manual',
        } as any
      )
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create client');

    const row = data as any;
    const newClient: Client = {
      id: row.id,
      externalId: row.external_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      historicalData: [],
      source: row.source || 'manual',
    };

    setClients((prev) => [...prev.filter((c) => c.id !== newClient.id), newClient]);
    return newClient;
  };

  const resolveClientByExternalId = async (
    externalId: string,
    clientDetails: { name: string; email?: string; phone?: string; avatarUrl?: string }
  ): Promise<Client> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: userResp, error: userErr } = await supabase.auth.getUser();
    const user = userResp?.user;
    if (userErr || !user) throw new Error('Not authenticated');

    const existingLocal = clients.find((c) => c.externalId === externalId);
    if (existingLocal) return existingLocal;

    const { data: existingDb, error: findErr } = await supabase
      .from('clients')
      .select('*')
      .eq('supabase_user_id', user.id)
      .eq('external_id', externalId)
      .maybeSingle();

    if (findErr) {
      console.error('Error checking for existing client:', findErr);
    }

    if (existingDb) {
      const row = existingDb as any;
      const client: Client = {
        id: row.id,
        externalId: row.external_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        avatarUrl: row.avatar_url,
        historicalData: [],
        source: row.source || 'square',
      };
      setClients((prev) => [...prev.filter((c) => c.id !== client.id), client]);
      return client;
    }

    const avatarUrl =
      clientDetails.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        clientDetails.name
      )}&background=random`;

    const { data, error } = await supabase
      .from('clients')
      .insert(
        {
          supabase_user_id: user.id,
          external_id: externalId,
          name: clientDetails.name,
          email: clientDetails.email || null,
          phone: clientDetails.phone || null,
          avatar_url: avatarUrl,
          source: 'square',
        } as any
      )
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create client');

    const row = data as any;
    const newClient: Client = {
      id: row.id,
      externalId: row.external_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      historicalData: [],
      source: row.source || 'square',
    };

    setClients((prev) => [...prev.filter((c) => c.id !== newClient.id), newClient]);
    return newClient;
  };

  // Save settings locally only (no assumptions about DB columns beyond confirmed tables)
  const saveAll = async () => {
    try {
      localStorage.setItem('admin_services', JSON.stringify(services));
      localStorage.setItem('admin_levels', JSON.stringify(levels));
      localStorage.setItem('admin_membership_config', JSON.stringify(membershipConfig));
      localStorage.setItem('admin_integration', JSON.stringify(integration));
      localStorage.setItem('admin_branding', JSON.stringify(branding));
      localStorage.setItem('admin_linking_config', JSON.stringify(linkingConfig));
      localStorage.setItem('admin_text_size', String(textSize));
      localStorage.setItem('admin_push_alerts_enabled', String(pushAlertsEnabled));
      localStorage.setItem('admin_pinned_reports', JSON.stringify(pinnedReports));
    } catch (e) {
      console.error('Failed to save settings locally:', e);
    }
  };

  const value = useMemo<SettingsContextType>(
    () => ({
      services,
      levels,
      stylists,
      clients,
      membershipConfig,
      branding,
      integration,
      linkingConfig,
      textSize,
      pushAlertsEnabled,
      pinnedReports,
      loadingTeam,
      teamError,
      updateServices,
      updateLevels,
      updateStylists,
      updateClients,
      updateMembershipConfig: setMembershipConfig,
      updateBranding,
      updateIntegration,
      updateLinkingConfig,
      updateTextSize,
      updatePushAlertsEnabled,
      updatePinnedReports,
      createClient,
      resolveClientByExternalId,
      saveAll,
    }),
    [
      services,
      levels,
      stylists,
      clients,
      membershipConfig,
      branding,
      integration,
      linkingConfig,
      textSize,
      pushAlertsEnabled,
      pinnedReports,
      loadingTeam,
      teamError,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
};