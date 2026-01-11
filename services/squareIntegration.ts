
import { Service, Stylist, Client, PlanAppointment } from '../types';

// Square API Types (Simplified)
interface SquareLocation {
    id: string;
    name: string;
    business_name: string;
    timezone: string;
    status: string;
}

type SquareEnvironment = 'sandbox' | 'production';

const PROD_API_BASE = 'https://connect.squareup.com/v2';
const SANDBOX_API_BASE = 'https://connect.squareupsandbox.com/v2';
const PROXY_URL = 'https://corsproxy.io/?';

/**
 * --- SYSTEM INVARIANT DOCUMENTATION (Development Safety) ---
 *
 * This service acts as the strict boundary between the application and the
 * external Square API.
 *
 * INVARIANT E: CHANGE SAFETY RULES
 * E1) Any patch touching logic in this file MUST be applied in isolation
 *     and tested alone, as it can affect all other parts of the system.
 * E2) UI/copy patches MUST NOT touch any logic in this file.
 *
 * INVARIANT D: SCHEMA & NAMING RULES
 * D2) This file is the translation layer. It is responsible for converting
 *     Square's naming conventions (e.g., 'start_at') to the application's
 *     canonical schema names (e.g., 'start_time'). The application database
 *     schema MUST NOT be changed to mirror Square's naming.
 */
async function fetchFromSquare(endpoint: string, accessToken: string, environment: SquareEnvironment, options: { method?: string, body?: any } = {}) {
    const { method = 'GET', body } = options;
    const baseUrl = environment === 'sandbox' ? SANDBOX_API_BASE : PROD_API_BASE;
    const targetUrl = `${baseUrl}${endpoint}`;
    const proxiedUrl = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxiedUrl, {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2023-10-20'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    if (!response.ok) {
        const err = data.errors?.[0];
        const fieldInfo = err?.field ? ` (Field: ${err.field})` : '';
        throw new Error(err ? `${err.detail}${fieldInfo}` : `HTTP Error ${response.status}`);
    }
    return data;
}

export const SquareIntegrationService = {
  formatDate(date: Date, timezone: string = 'UTC') {
    if (!date || isNaN(date.getTime())) {
        return new Date().toISOString();
    }

    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZoneName: 'shortOffset'
        });

        const parts = formatter.formatToParts(date);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

        const Y = getPart('year');
        const M = getPart('month');
        const D = getPart('day');
        const h = getPart('hour');
        const m = getPart('minute');
        const s = getPart('second');
        let tz = getPart('timeZoneName');

        let offset = '+00:00';
        if (tz === 'UTC' || tz === 'GMT') {
            offset = '+00:00';
        } else {
            let numeric = tz.replace('GMT', '');
            if (numeric.includes(':')) {
                offset = numeric;
            } else {
                const sign = numeric.startsWith('-') ? '-' : '+';
                const hours = numeric.replace(/[+-]/, '').padStart(2, '0');
                offset = `${sign}${hours}:00`;
            }
        }

        return `${Y}-${M}-${D}T${h}:${m}:${s}${offset}`;
    } catch (e) {
        console.error("[Date Formatter Error]", e);
        return date.toISOString();
    }
  },
  
  /**
   * SERVER-SIDE TOKEN EXCHANGE
   * Calls the application's backend endpoint to securely exchange the authorization code.
   * This prevents leaking the Square Client Secret to the frontend.
   */
  // FIX: Renamed from exchangeCodeViaServer to exchangeCodeForToken to match usage in App.tsx
  exchangeCodeForToken: async (code: string, env: SquareEnvironment): Promise<{ accessToken: string, refreshToken: string, merchantId: string }> => {
    // The server endpoint handles the Square API call directly using its secure client_secret.
    const response = await fetch('/api/square/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        environment: env
      }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || `Server-side OAuth exchange failed: ${response.status}`);
    }
    
    return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        merchantId: data.merchantId,
    };
  },
  
  fetchLocation: async (accessToken: string, env: SquareEnvironment): Promise<SquareLocation> => {
      const data = await fetchFromSquare('/locations', accessToken, env);
      const activeLocation = data.locations?.find((loc: any) => loc.status === 'ACTIVE');
      if (!activeLocation) throw new Error("No active location found.");
      return activeLocation;
  },

  fetchBusinessDetails: async (accessToken: string, env: SquareEnvironment): Promise<string> => {
      const loc = await SquareIntegrationService.fetchLocation(accessToken, env);
      return loc.business_name || loc.name;
  },

  fetchMerchantDetails: async (accessToken: string, env: SquareEnvironment, merchantId: string): Promise<{ business_name: string }> => {
      const data = await fetchFromSquare(`/merchants/${merchantId}`, accessToken, env);
      const merchant = data.merchant;
      if (!merchant) throw new Error("Could not retrieve merchant details.");
      return { business_name: merchant.business_name || 'Admin' };
  },

  fetchCatalog: async (accessToken: string, env: SquareEnvironment): Promise<Service[]> => {
    const data = await fetchFromSquare('/catalog/list?types=ITEM,ITEM_VARIATION,CATEGORY', accessToken, env);
    const objects = data.objects || [];
    const items = objects.filter((o: any) => o.type === 'ITEM');
    const variations = objects.filter((o: any) => o.type === 'ITEM_VARIATION');
    const categories = objects.filter((o: any) => o.type === 'CATEGORY');

    const services: Service[] = [];

    variations.forEach((variation: any) => {
        const item = items.find((i: any) => i.id === variation.item_variation_data.item_id);
        if (item) {
            const categoryObj = categories.find((c: any) => c.id === item.item_data.category_id);
            const priceMoney = variation.item_variation_data.price_money;
            const durationMs = variation.item_variation_data.service_duration;

            services.push({
                id: variation.id, 
                version: variation.version,
                name: `${item.item_data.name}${variation.item_variation_data.name !== 'Regular' ? ` - ${variation.item_variation_data.name}` : ''}`.trim(),
                category: categoryObj?.category_data?.name || 'Uncategorized',
                cost: priceMoney ? Number(priceMoney.amount) / 100 : 0,
                duration: durationMs ? durationMs / 1000 / 60 : 0, 
            });
        }
    });
    return services;
  },

  fetchTeam: async (accessToken: string, env: SquareEnvironment): Promise<Stylist[]> => {
      const data = await fetchFromSquare('/team-members/search', accessToken, env, {
          method: 'POST',
          body: {
              query: {
                  filter: {
                      status: 'ACTIVE',
                  }
              }
          }
      });
      const members = data.team_members || [];
      return members.map((member: any) => ({
          id: member.id, 
          name: `${member.given_name} ${member.family_name}`,
          role: member.is_owner ? 'Owner' : 'Team Member',
          email: member.email_address,
          levelId: 'lvl_2', 
          permissions: { 
              canBookAppointments: true,
              canOfferDiscounts: false,
              requiresDiscountApproval: true,
              viewGlobalReports: false,
              viewClientContact: true,
              viewAllSalonPlans: false,
          }
      }));
  },

  fetchCustomers: async (accessToken: string, env: SquareEnvironment): Promise<Partial<Client>[]> => {
      let cursor: string | undefined = undefined;
      const allCustomers: any[] = [];

      do {
          const url = `/customers/list${cursor ? `?cursor=${cursor}` : ''}`;
          const data = await fetchFromSquare(url, accessToken, env);
          
          if (data.customers) {
              allCustomers.push(...data.customers);
          }
          cursor = data.cursor;
      } while(cursor);
      
      return allCustomers.map((c: any) => ({
        id: c.id,
        externalId: c.id,
        name: `${c.given_name || ''} ${c.family_name || ''}`.trim() || c.email_address || 'Unnamed Client',
        email: c.email_address,
        phone: c.phone_number,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(`${c.given_name || ''} ${c.family_name || ''}`.trim() || c.email_address || 'UC')}&background=random`,
      }));
  },

  // FIX: Completed the searchCustomer function and resolved the return value error.
  searchCustomer: async (accessToken: string, env: SquareEnvironment, name: string): Promise<string | null> => {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      const body: any = {
          query: {
            filter: {
              given_name: { exact: firstName },
              family_name: { exact: lastName }
            }
          }
      };
      const data = await fetchFromSquare('/customers/search', accessToken, env, { method: 'POST', body });
      return data.customers?.[0]?.id || null;
  },

  // FIX: Added findAvailableSlots method to resolve errors in PlanSummaryStep.tsx.
  async findAvailableSlots(accessToken: string, environment: SquareEnvironment, params: { locationId: string, startAt: string, teamMemberId: string, serviceVariationId: string }) {
    const startAtDate = new Date(params.startAt);
    const endAt = new Date(startAtDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week window

    const body = {
      query: {
        filter: {
          start_at_range: {
            start_at: params.startAt,
            end_at: endAt.toISOString()
          },
          location_id: params.locationId,
          segment_filters: [
            {
              service_variation_id: params.serviceVariationId,
              team_member_id_filter: {
                any: [params.teamMemberId]
              }
            }
          ]
        }
      }
    };

    const data = await fetchFromSquare('/bookings/availability/search', accessToken, environment, { method: 'POST', body });
    return data.availabilities?.map((a: any) => a.start_at) || [];
  },

  // FIX: Added createAppointment method to resolve errors in PlanSummaryStep.tsx.
  async createAppointment(accessToken: string, environment: SquareEnvironment, params: { locationId: string, startAt: string, customerId: string, teamMemberId: string, services: Service[] }) {
    const body = {
      booking: {
        location_id: params.locationId,
        start_at: params.startAt,
        customer_id: params.customerId,
        appointment_segments: params.services.map(s => ({
          service_variation_id: s.id,
          team_member_id: params.teamMemberId,
          service_variation_version: s.version
        }))
      }
    };
    return await fetchFromSquare('/bookings', accessToken, environment, { method: 'POST', body });
  },

  // FIX: Added fetchAllBookings method to resolve error in AdminDashboard.tsx.
  async fetchAllBookings(accessToken: string, environment: SquareEnvironment, locationId: string) {
    const body = {
      query: {
        filter: {
          location_id: locationId,
          status: { any: ['ACCEPTED', 'PENDING'] }
        }
      }
    };
    const data = await fetchFromSquare('/bookings/search', accessToken, environment, { method: 'POST', body });
    return data.bookings || [];
  }
};
