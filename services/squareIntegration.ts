
import { Service, Stylist, Client } from '../types';

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

function formatRFC3339WithOffset(date: Date, timezone: string = 'UTC') {
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
}

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

  findAvailableSlots: async (accessToken: string, env: SquareEnvironment, params: {
      locationId: string,
      startAt: string,
      teamMemberId: string,
      serviceVariationId: string
  }): Promise<string[]> => {
      const startDate = new Date(params.startAt);
      if (isNaN(startDate.getTime())) throw new Error("Invalid start time passed to Square.");

      // Expanded to 7 days so user can see "the whole week"
      const endDate = new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000)); 

      const body = {
          query: {
              filter: {
                  location_id: params.locationId,
                  start_at_range: {
                      start_at: params.startAt,
                      end_at: endDate.toISOString()
                  },
                  segment_filters: [
                      {
                          service_variation_id: params.serviceVariationId,
                          team_member_id_filter: { any: [params.teamMemberId] }
                      }
                  ]
              }
          }
      };

      const data = await fetchFromSquare('/bookings/availability/search', accessToken, env, { method: 'POST', body });
      const slots = (data.availabilities || [])
          .map((a: any) => a.start_at);
      
      return slots;
  },

  createAppointment: async (accessToken: string, env: SquareEnvironment, bookingDetails: {
      locationId: string;
      startAt: string; 
      customerId: string;
      teamMemberId: string;
      services: Service[];
  }): Promise<any> => {
      const { locationId, startAt, customerId, teamMemberId, services } = bookingDetails;
      
      if (!locationId) throw new Error("Location ID is required for booking.");
      if (!customerId) throw new Error("Customer ID is required for booking.");
      if (!teamMemberId) throw new Error("Team Member ID is required for booking.");

      const body = {
          idempotency_key: crypto.randomUUID(),
          booking: {
              location_id: locationId,
              start_at: startAt,
              customer_id: customerId,
              appointment_segments: services.map(s => ({
                  duration_minutes: Math.round(s.duration || 60), 
                  service_variation_id: s.id,
                  service_variation_version: s.version,
                  team_member_id: teamMemberId
              }))
          }
      };

      const data = await fetchFromSquare('/bookings', accessToken, env, { method: 'POST', body });
      return data.booking;
  },

  fetchCatalog: async (accessToken: string, env: SquareEnvironment): Promise<Service[]> => {
    const data = await fetchFromSquare('/catalog/search-catalog-items', accessToken, env, { 
        method: 'POST', 
        body: { product_types: ["APPOINTMENTS_SERVICE"] } 
    });
    
    const services: Service[] = [];
    if (data.items) {
        data.items.forEach((item: any) => {
            item.item_data?.variations?.forEach((v: any) => {
                if (v.item_variation_data.available_for_booking) {
                    services.push({
                        id: v.id,
                        version: v.version,
                        name: `${item.item_data.name}${v.item_variation_data.name !== 'Regular' ? ` - ${v.item_variation_data.name}` : ''}`,
                        category: 'Square Import',
                        cost: v.item_variation_data.price_money?.amount ? v.item_variation_data.price_money.amount / 100 : 0,
                        duration: v.item_variation_data.service_duration ? v.item_variation_data.service_duration / 60000 : 60,
                        tierPrices: {}
                    });
                }
            });
        });
    }
    return services;
  },

  fetchTeam: async (accessToken: string, env: SquareEnvironment): Promise<Stylist[]> => {
      const data = await fetchFromSquare('/bookings/team-member-booking-profiles', accessToken, env);
      return (data.team_member_booking_profiles || [])
          .filter((p: any) => p.is_bookable)
          .map((p: any) => ({
              id: p.team_member_id,
              name: p.display_name,
              role: 'Stylist',
              email: '', 
              levelId: 'lvl_1', 
              permissions: { 
                  canBookAppointments: true, 
                  canOfferDiscounts: false, 
                  requiresDiscountApproval: false, 
                  viewGlobalReports: false 
              }
          }));
  },

  fetchCustomers: async (accessToken: string, env: SquareEnvironment): Promise<Client[]> => {
      let cursor = undefined;
      const allClients: Client[] = [];
      
      do {
          const url = `/customers${cursor ? `?cursor=${cursor}` : ''}`;
          const data = await fetchFromSquare(url, accessToken, env);
          const customers = data.customers || [];
          
          customers.forEach((c: any) => {
              allClients.push({
                  id: c.id, 
                  externalId: c.id,
                  name: `${c.given_name || ''} ${c.family_name || ''}`.trim() || 'Unnamed Customer',
                  email: c.email_address || '',
                  phone: c.phone_number || '',
                  avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.given_name || 'U')}&background=random`,
                  historicalData: [],
              });
          });

          cursor = data.cursor;
      } while (cursor);

      return allClients;
  },
  
  searchCustomer: async (accessToken: string, env: SquareEnvironment, name: string): Promise<string | null> => {
      let cursor = undefined;
      const searchName = name.toLowerCase().trim();
      
      do {
          const url = `/customers${cursor ? `?cursor=${cursor}` : ''}`;
          const data = await fetchFromSquare(url, accessToken, env);
          const customers = data.customers || [];
          
          const match = customers.find((c: any) => {
              const given = (c.given_name || '').toLowerCase().trim();
              const family = (c.family_name || '').toLowerCase().trim();
              const fullName = `${given} ${family}`.trim();
              return fullName === searchName || given === searchName || family === searchName;
          });

          if (match) return match.id;
          cursor = data.cursor;
      } while (cursor);

      return null;
  },

  formatDate: formatRFC3339WithOffset
};
