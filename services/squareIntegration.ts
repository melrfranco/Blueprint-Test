
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

async function squareProxyFetch<T>(accessToken: string, path: string, options: { method?: string, body?: any } = {}): Promise<T> {
    const { method = 'GET', body } = options;
    const response = await fetch('/api/square/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            accessToken,
            path,
            method,
            body,
        }),
    });
    
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        data = { error: { detail: text } };
    }

    if (!response.ok) {
        const err = data.errors?.[0];
        const fieldInfo = err?.field ? ` (Field: ${err.field})` : '';
        throw new Error(err ? `${err.detail}${fieldInfo}` : `Square API Error via proxy: ${response.status}`);
    }
    return data as T;
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
  
  exchangeCodeForToken: async (code: string, env: SquareEnvironment): Promise<{ accessToken: string, refreshToken: string, merchantId: string }> => {
    const response = await fetch('/api/square/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();
    if (!response.ok) {
        const msg = data?.message || data?.error_description || data?.errors?.[0]?.detail || `OAuth Token Exchange Failed: ${response.status}`;
        throw new Error(msg);
    }
    
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        merchantId: data.merchant_id,
    };
  },
  
  fetchLocation: async (accessToken: string, env: SquareEnvironment): Promise<SquareLocation> => {
      const data: any = await squareProxyFetch(accessToken, '/v2/locations');
      const activeLocation = data.locations?.find((loc: any) => loc.status === 'ACTIVE');
      if (!activeLocation) throw new Error("No active location found.");
      return activeLocation;
  },

  fetchBusinessDetails: async (accessToken: string, env: SquareEnvironment): Promise<string> => {
      const loc = await SquareIntegrationService.fetchLocation(accessToken, env);
      return loc.business_name || loc.name;
  },

  fetchMerchantDetails: async (accessToken: string, env: SquareEnvironment, merchantId: string): Promise<{ business_name: string }> => {
      const data: any = await squareProxyFetch(accessToken, `/v2/merchants/${merchantId}`);
      const merchant = data.merchant;
      if (!merchant) throw new Error("Could not retrieve merchant details.");
      return { business_name: merchant.business_name || 'Admin' };
  },

  fetchCatalog: async (accessToken: string, env: SquareEnvironment): Promise<Service[]> => {
    const data: any = await squareProxyFetch(accessToken, '/v2/catalog/list?types=ITEM,ITEM_VARIATION,CATEGORY');
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
      const data: any = await squareProxyFetch(accessToken, '/v2/team-members/search', {
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
          const path = `/v2/customers/list${cursor ? `?cursor=${cursor}` : ''}`;
          const data: any = await squareProxyFetch(accessToken, path);
          
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

  searchCustomer: async (accessToken: string, env: SquareEnvironment, name: string): Promise<string | null> => {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      const body: any = {
          query: {
              filter: {},
              sort: {
                  field: "CREATED_AT",
                  order: "DESC"
              }
          },
          limit: 1
      };
      
      if (lastName) {
          body.query.filter.given_name = { exact: firstName };
          body.query.filter.family_name = { exact: lastName };
      } else if (firstName) {
          body.query.filter.given_name = { exact: firstName };
      }

      const data: any = await squareProxyFetch(accessToken, '/v2/customers/search', {
          method: 'POST',
          body: body
      });
      
      const customer = data.customers?.[0];
      return customer ? customer.id : null;
  },

  findAvailableSlots: async (accessToken: string, env: SquareEnvironment, params: {
      locationId: string,
      startAt: string,
      teamMemberId: string,
      serviceVariationId: string
  }): Promise<string[]> => {
      const startDate = new Date(params.startAt);
      if (isNaN(startDate.getTime())) throw new Error("Invalid start time passed to Square.");

      const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000)); 

      const segment_filter: {
          service_variation_id: string;
          team_member_id_filter?: { any: string[] };
      } = {
          service_variation_id: params.serviceVariationId,
      };

      const teamMemberId = params.teamMemberId;
      const isInvalidForFilter = !teamMemberId || teamMemberId.startsWith('TM-') || teamMemberId === 'admin';

      if (!isInvalidForFilter) {
          segment_filter.team_member_id_filter = { any: [teamMemberId] };
      }

      const body = {
          query: {
              filter: {
                  location_id: params.locationId,
                  start_at_range: {
                      start_at: params.startAt,
                      end_at: endDate.toISOString()
                  },
                  segment_filters: [segment_filter]
              }
          }
      };

      const data: any = await squareProxyFetch(accessToken, '/v2/bookings/availability/search', { method: 'POST', body });
      const slots = (data.availabilities || [])
          .map((a: any) => a.start_at);
      
      return slots;
  },

  fetchAllBookings: async (accessToken: string, env: SquareEnvironment, locationId: string): Promise<any[]> => {
    let cursor: string | undefined = undefined;
    const allBookings: any[] = [];
    
    do {
        const path = `/v2/bookings?location_id=${locationId}${cursor ? `&cursor=${cursor}` : ''}`;
        const data: any = await squareProxyFetch(accessToken, path);
        if (data.bookings) {
            allBookings.push(...data.bookings);
        }
        cursor = data.cursor;
    } while (cursor);

    return allBookings;
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

      let resolvedTeamMemberId = teamMemberId;
      const isInvalidTeamMemberId = !teamMemberId || teamMemberId.startsWith('TM-') || teamMemberId === 'admin';

      if (isInvalidTeamMemberId) {
          const teamMembers = await SquareIntegrationService.fetchTeam(accessToken, env);
          if (!teamMembers || teamMembers.length === 0) {
              throw new Error("No bookable team members found in Square to assign this appointment to.");
          }
          resolvedTeamMemberId = teamMembers[0].id;
      }
      
      const serviceVersionMap = new Map<string, number>();
      services.forEach(s => {
          if (s.id && s.version) {
              serviceVersionMap.set(s.id, s.version);
          }
      });

      const body = {
          booking: {
              location_id: locationId,
              start_at: startAt,
              customer_id: customerId,
              appointment_segments: services.map(service => ({
                  team_member_id: resolvedTeamMemberId,
                  service_variation_id: service.id,
                  service_variation_version: serviceVersionMap.get(service.id) || undefined
              }))
          }
      };

      return await squareProxyFetch(accessToken, '/v2/bookings', { method: 'POST', body });
  },
};
