import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type {
  Service,
  StylistLevel,
  Stylist,
  MembershipTier,
  Client,
  ServiceLinkingConfig,
  BrandingSettings,
  MembershipConfig,
  AppTextSize,
} from '../types';
import { supabase } from '../lib/supabase';

interface IntegrationSettings {
  provider: 'square';
  environment: 'sandbox' | 'production';
}

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
  loadingTeam: boolean;
  teamError: string | null;
  updateClients: (clients: Client[]) => void;
  createClient: (clientData: { name: string; email: string }) => Promise<Client>;
  // FIX: Added missing properties to resolve TypeScript errors in AdminDashboard and AccountSettings.
  updateBranding: (branding: BrandingSettings) => void;
  updateMembershipConfig: (config: MembershipConfig) => void;
  updateStylists: (stylists: Stylist[]) => void;
  updateServices: (services: Service[]) => void;
  saveAll: () => Promise<void>;
  resolveClientByExternalId: (
    externalId: string,
    details: { name: string; email?: string; phone?: string; avatarUrl?: string }
  ) => Promise<Client>;
  updateTextSize: (size: AppTextSize) => void;
  updatePushAlertsEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  // FIX: Added state management for settings to allow updates from components.
  const [services, setServices] = useState<Service[]>([]);
  const [levels, setLevels] = useState<StylistLevel[]>([]);
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
    exclusionServiceId: 's1',
    linkedServiceId: 's6',
  });
  const [textSize, setTextSize] = useState<AppTextSize>('M');
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(false);
  const [pinnedReports, setPinnedReports] = useState<{ [userId: string]: string[] }>({});

  // --- REQUIRED: Load clients from Supabase only ---
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    const loadClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error('Failed to load clients:', error);
        setClients([]);
        return;
      }

      const mapped: Client[] = (data || []).map((row: any) => ({
        id: row.id,
        externalId: row.external_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        avatarUrl: row.avatar_url,
        historicalData: [],
        source: row.source || 'manual',
      }));

      setClients(mapped);
    };

    loadClients();

    return () => {
      cancelled = true;
    };
  }, []);

  // --- OPTIONAL: Load Square team (must NEVER block app) ---
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    setLoadingTeam(true);
    setTeamError(null);

    const loadTeam = async () => {
      const { data, error } = await supabase
        .from('square_team_members')
        .select('*');

      if (cancelled) return;

      if (error) {
        console.warn('Square team not available:', error.message);
        setStylists([]);
        setTeamError(null);
        setLoadingTeam(false);
        return;
      }

      const mapped: Stylist[] = (data || []).map((row: any) => ({
        id: row.square_team_member_id,
        name: row.name,
        role: row.role || 'Stylist',
        email: row.email,
        levelId: row.level_id || 'default',
        permissions: row.permissions || {},
      }));

      setStylists(mapped);
      setLoadingTeam(false);
    };

    loadTeam();

    return () => {
      cancelled = true;
    };
  }, []);

  const createClient = async (clientData: { name: string; email: string }) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      clientData.name
    )}&background=random`;

    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: clientData.name,
        email: clientData.email,
        avatar_url: avatarUrl,
      })
      .select()
      .single();

    if (error || !data) {
      throw error || new Error('Failed to create client');
    }

    const newClient: Client = {
      id: data.id,
      externalId: data.external_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      historicalData: [],
      source: 'manual',
    };

    setClients(prev => [...prev, newClient]);
    return newClient;
  };

  // FIX: Implemented missing update and utility functions.
  const updateBranding = (newBranding: BrandingSettings) => setBranding(newBranding);
  const updateMembershipConfig = (newConfig: MembershipConfig) => setMembershipConfig(newConfig);
  const updateStylists = (newStylists: Stylist[]) => setStylists(newStylists);
  const updateServices = (newServices: Service[]) => setServices(newServices);
  const updateTextSize = (newSize: AppTextSize) => setTextSize(newSize);
  const updatePushAlertsEnabled = (enabled: boolean) => setPushAlertsEnabled(enabled);

  const saveAll = async () => {
    console.log("Saving all settings... (not implemented)");
  };

  const resolveClientByExternalId = async (
    externalId: string,
    details: { name: string; email?: string; phone?: string; avatarUrl?: string }
  ): Promise<Client> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const existingLocal = clients.find(c => c.externalId === externalId);
    if (existingLocal) return existingLocal;
    
    const { data: dbData, error: dbError } = await supabase
      .from('clients')
      .select('*')
      .eq('external_id', externalId)
      .maybeSingle();

    if (dbError) console.error("Error checking for existing client:", dbError);
    
    if (dbData) {
      const client: Client = {
        id: dbData.id,
        externalId: dbData.external_id,
        name: dbData.name,
        email: dbData.email,
        phone: dbData.phone,
        avatarUrl: dbData.avatar_url,
        historicalData: [],
        source: dbData.source || 'square',
      };
      setClients(prev => [...prev.filter(c => c.id !== client.id), client]);
      return client;
    }
    
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: details.name,
        email: details.email,
        phone: details.phone,
        avatar_url: details.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(details.name)}&background=random`,
        external_id: externalId,
        source: 'square',
      })
      .select()
      .single();

    if (error) throw error;

    const newClient: Client = {
      id: data.id,
      externalId: data.external_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      historicalData: [],
      source: 'square',
    };
    setClients(prev => [...prev, newClient]);
    return newClient;
  };

  return (
    <SettingsContext.Provider
      value={{
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
        updateClients: setClients,
        createClient,
        updateBranding,
        updateMembershipConfig,
        updateStylists,
        updateServices,
        saveAll,
        resolveClientByExternalId,
        updateTextSize,
        updatePushAlertsEnabled,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
};
