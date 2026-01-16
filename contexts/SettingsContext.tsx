import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type {
  Client,
  Stylist,
  BrandingSettings,
  MembershipConfig,
  Service,
  StylistLevel,
  ServiceLinkingConfig,
  AppTextSize,
} from '../types';
import { ALL_SERVICES, STYLIST_LEVELS, MEMBERSHIP_TIERS } from '../data/mockData';

interface SettingsContextType {
  clients: Client[];
  stylists: Stylist[];
  services: Service[];
  levels: StylistLevel[];
  branding: BrandingSettings;
  membershipConfig: MembershipConfig;
  linkingConfig: ServiceLinkingConfig;
  loadingTeam: boolean;
  teamError: string | null;

  createClient: (data: { name: string; email?: string }) => Promise<Client>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [services] = useState<Service[]>(ALL_SERVICES);
  const [levels] = useState<StylistLevel[]>(STYLIST_LEVELS);
  const [branding] = useState<BrandingSettings>({
    salonName: 'Salon',
    primaryColor: '#000000',
    secondaryColor: '#000000',
    accentColor: '#000000',
    font: 'Inter',
  });
  const [membershipConfig] = useState<MembershipConfig>({
    enabled: true,
    tiers: MEMBERSHIP_TIERS,
  });
  const [linkingConfig] = useState<Service
