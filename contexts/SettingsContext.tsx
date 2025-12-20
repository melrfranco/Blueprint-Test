
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ALL_SERVICES, STYLIST_LEVELS, MEMBERSHIP_TIERS, MOCK_CLIENTS } from '../data/mockData';
import type { Service, StylistLevel, Stylist, MembershipTier, Client, ServiceLinkingConfig } from '../types';

interface BrandingSettings {
    salonName: string;
    primaryColor: string;
    secondaryColor: string;
    font: string;
}

export interface IntegrationSettings {
    provider: 'vagaro' | 'square' | 'mindbody';
    squareAccessToken?: string;
    environment: 'sandbox' | 'production';
}

interface SettingsContextType {
    services: Service[];
    levels: StylistLevel[];
    stylists: Stylist[];
    clients: Client[];
    membershipTiers: MembershipTier[];
    branding: BrandingSettings;
    integration: IntegrationSettings;
    linkingConfig: ServiceLinkingConfig;
    updateServices: (services: Service[]) => void;
    updateLevels: (levels: StylistLevel[]) => void;
    updateStylists: (stylists: Stylist[]) => void;
    updateClients: (clients: Client[]) => void;
    updateMembershipTiers: (tiers: MembershipTier[]) => void;
    updateBranding: (branding: BrandingSettings) => void;
    updateIntegration: (integration: IntegrationSettings) => void;
    updateLinkingConfig: (config: ServiceLinkingConfig) => void;
    saveAll: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [services, setServices] = useState<Service[]>(() => {
        try {
            const saved = localStorage.getItem('admin_services');
            return saved ? JSON.parse(saved) : ALL_SERVICES;
        } catch { return ALL_SERVICES; }
    });

    const [linkingConfig, setLinkingConfig] = useState<ServiceLinkingConfig>(() => {
        try {
            const saved = localStorage.getItem('admin_linking_config');
            return saved ? JSON.parse(saved) : {
                enabled: false,
                triggerCategory: 'Color',
                triggerServiceIds: [],
                exclusionServiceId: '',
                linkedServiceId: ''
            };
        } catch { 
            return { enabled: false, triggerCategory: 'Color', triggerServiceIds: [], exclusionServiceId: '', linkedServiceId: '' };
        }
    });

    const [levels, setLevels] = useState<StylistLevel[]>(() => {
        try {
            const saved = localStorage.getItem('admin_levels');
            return saved ? JSON.parse(saved) : STYLIST_LEVELS;
        } catch { return STYLIST_LEVELS; }
    });

    const [stylists, setStylists] = useState<Stylist[]>(() => {
        try {
            const saved = localStorage.getItem('admin_team');
            return saved ? JSON.parse(saved) : [
                { 
                    id: 'TM-aBcDeFgHiJkLmN', 
                    name: 'Jessica Miller', 
                    role: 'Full Time', 
                    levelId: 'lvl_2', 
                    email: 'jessica@example.com', 
                    permissions: { 
                        canBookAppointments: true, 
                        canOfferDiscounts: true, 
                        requiresDiscountApproval: false, 
                        viewGlobalReports: false 
                    } 
                },
                { 
                    id: 'TM-oPqRsTuVwXyZaB', 
                    name: 'David Chen', 
                    role: 'Full Time', 
                    levelId: 'lvl_3', 
                    email: 'david@example.com', 
                    permissions: { 
                        canBookAppointments: true, 
                        canOfferDiscounts: true, 
                        requiresDiscountApproval: false, 
                        viewGlobalReports: true 
                    } 
                },
                { 
                    id: 'TM-cDeFgHiJkLmNoP', 
                    name: 'Sarah Jones', 
                    role: 'Apprentice', 
                    levelId: 'lvl_1', 
                    email: 'sarah@example.com', 
                    permissions: { 
                        canBookAppointments: false, 
                        canOfferDiscounts: false, 
                        requiresDiscountApproval: true, 
                        viewGlobalReports: false 
                    } 
                },
            ];
        } catch { return []; }
    });

    const [clients, setClients] = useState<Client[]>(() => {
        try {
            const saved = localStorage.getItem('admin_clients');
            return saved ? JSON.parse(saved) : MOCK_CLIENTS;
        } catch { return MOCK_CLIENTS; }
    });

    const [membershipTiers, setMembershipTiers] = useState<MembershipTier[]>(() => {
        try {
            const saved = localStorage.getItem('admin_memberships');
            return saved ? JSON.parse(saved) : MEMBERSHIP_TIERS;
        } catch { return MEMBERSHIP_TIERS; }
    });

    const [branding, setBranding] = useState<BrandingSettings>(() => {
        return {
            salonName: localStorage.getItem('admin_brand_name') || 'Luxe Salon & Spa',
            primaryColor: localStorage.getItem('admin_brand_primary') || '#BE123C',
            secondaryColor: localStorage.getItem('admin_brand_secondary') || '#0F766E',
            font: localStorage.getItem('admin_brand_font') || 'font-sans'
        };
    });

    const [integration, setIntegration] = useState<IntegrationSettings>(() => {
        try {
            const saved = localStorage.getItem('admin_integration');
            const parsed = saved ? JSON.parse(saved) : {};
            return { 
                provider: 'square', 
                squareAccessToken: '', 
                environment: 'production', 
                ...parsed 
            };
        } catch { return { provider: 'square', squareAccessToken: '', environment: 'production' }; }
    });

    useEffect(() => {
        document.documentElement.style.setProperty('--color-brand-pink', branding.primaryColor);
        document.documentElement.style.setProperty('--color-brand-teal', branding.secondaryColor);
        document.body.classList.remove('font-sans', 'font-serif', 'font-mono');
        document.body.classList.add(branding.font);
    }, [branding]);

    const saveAll = () => {
        try {
            localStorage.setItem('admin_services', JSON.stringify(services));
            localStorage.setItem('admin_linking_config', JSON.stringify(linkingConfig));
            localStorage.setItem('admin_levels', JSON.stringify(levels));
            localStorage.setItem('admin_team', JSON.stringify(stylists));
            localStorage.setItem('admin_clients', JSON.stringify(clients));
            localStorage.setItem('admin_memberships', JSON.stringify(membershipTiers));
            localStorage.setItem('admin_integration', JSON.stringify(integration));
            localStorage.setItem('admin_brand_name', branding.salonName);
            localStorage.setItem('admin_brand_primary', branding.primaryColor);
            localStorage.setItem('admin_brand_secondary', branding.secondaryColor);
            localStorage.setItem('admin_brand_font', branding.font);
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    };

    return (
        <SettingsContext.Provider value={{
            services, levels, stylists, clients, membershipTiers, branding, integration, linkingConfig,
            updateServices: setServices,
            updateLevels: setLevels,
            updateStylists: setStylists,
            updateClients: setClients,
            updateMembershipTiers: setMembershipTiers,
            updateBranding: setBranding,
            updateIntegration: setIntegration,
            updateLinkingConfig: setLinkingConfig,
            saveAll
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
};
