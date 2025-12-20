
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { GeneratedPlan, UserRole, Service, PlanAppointment } from '../types';
import { SERVICE_COLORS } from '../data/mockData';
import { useSettings } from '../contexts/SettingsContext';
import { usePlans } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { SquareIntegrationService } from '../services/squareIntegration';
import { CheckCircleIcon, CalendarIcon, RefreshIcon, GlobeIcon, PlusIcon, ChevronRightIcon, ChevronLeftIcon, ShareIcon, DocumentTextIcon } from './icons';

interface PlanSummaryStepProps {
  plan: GeneratedPlan;
  role: UserRole;
  onEditPlan?: () => void;
}

type BookingStep = 'select-visit' | 'select-period' | 'select-slot';
type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'all';
type DeliveryMethod = 'sms' | 'email' | 'link';

const PlanSummaryStep: React.FC<PlanSummaryStepProps> = ({ plan, role, onEditPlan }) => {
  const [isMembershipModalOpen, setMembershipModalOpen] = useState(false);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  
  const [bookingStep, setBookingStep] = useState<BookingStep>('select-visit');
  const [selectedVisit, setSelectedVisit] = useState<PlanAppointment | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('sms');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  
  const { membershipTiers, integration, services: allServices, stylists: allStylists } = useSettings();
  const { savePlan } = usePlans();
  const { user } = useAuth();

  const isPlanActive = plan.status === 'active';
  const isMemberOffered = plan.membershipStatus === 'offered';

  // Permission Checks
  const canBook = user?.role === 'admin' || user?.stylistData?.permissions.canBookAppointments;

  const qualifyingTier = useMemo(() => {
      const sortedTiers = [...membershipTiers].sort((a, b) => b.minSpend - a.minSpend);
      return sortedTiers.find(t => plan.averageMonthlySpend >= t.minSpend) || sortedTiers[sortedTiers.length - 1];
  }, [plan.averageMonthlySpend, membershipTiers]);

  const invitationMessage = useMemo(() => {
    return `Hi ${plan.client.name.split(' ')[0]}! This is ${user?.name || 'your stylist'} from the salon. Based on your new maintenance roadmap, you qualify for our ${qualifyingTier.name} status! This includes ${qualifyingTier.perks.slice(0, 2).join(' & ')}. Check out your full roadmap here: [Link]`;
  }, [plan, qualifyingTier, user]);

  const futureVisits = useMemo(() => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      return plan.appointments.filter(a => {
          const apptDate = new Date(a.date);
          return apptDate.getTime() > today.getTime();
      });
  }, [plan.appointments]);

  // NEW CHART LOGIC: Show Individual Visits instead of 4-week buckets
  const visitChartData = useMemo(() => {
    return plan.appointments.slice(0, 15).map((appt, index) => {
        const dataPoint: any = {
            name: appt.date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            fullDate: appt.date.toLocaleDateString([], { dateStyle: 'long' }),
            index: index + 1
        };
        appt.services.forEach(s => {
            dataPoint[s.name] = (dataPoint[s.name] || 0) + s.cost;
        });
        return dataPoint;
    });
  }, [plan]);

  const serviceLegend = useMemo(() => Array.from(new Set(plan.appointments.flatMap(a => a.services.map(s => s.name)))), [plan.appointments]);
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

  const handlePublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
        savePlan({ ...plan, status: 'active' });
        setIsPublishing(false);
    }, 800);
  };

  const handleSendInvite = () => {
    setIsSendingInvite(true);
    
    const message = invitationMessage;
    const clientPhone = plan.client.phone || '';
    const clientEmail = plan.client.email || '';

    try {
        if (deliveryMethod === 'sms') {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const separator = isIOS ? '&' : '?';
            const cleanPhone = clientPhone.replace(/\D/g, ''); 
            window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
        } else if (deliveryMethod === 'email') {
            window.location.href = `mailto:${clientEmail}?subject=${encodeURIComponent("Your VIP Salon Roadmap Invitation")}&body=${encodeURIComponent(message)}`;
        } else if (deliveryMethod === 'link') {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(message);
            }
        }
    } catch (e) {
        console.error("Failed to trigger communication method", e);
    }

    setTimeout(() => {
      savePlan({ ...plan, membershipStatus: 'offered' });
      setIsSendingInvite(false);
      setInviteSent(true);
      setTimeout(() => {
        setMembershipModalOpen(false);
        setInviteSent(false);
      }, 1500);
    }, 1200);
  };

  const handleOpenBooking = () => {
      if (!canBook) return;
      setBookingModalOpen(true);
      setBookingStep('select-visit');
      setBookingSuccess(false);
      setFetchError(null);
  };

  const startFetchingSlots = async (visit: PlanAppointment) => {
    setSelectedVisit(visit);
    setBookingStep('select-period');
  };

  const confirmPeriodAndFetch = async (period: TimePeriod) => {
    setTimePeriod(period);
    setBookingStep('select-slot');
    setIsFetchingSlots(true);
    setFetchError(null);

    try {
        if (!selectedVisit) throw new Error("No visit selected.");
        const token = integration.squareAccessToken;
        if (!token) throw new Error("Missing Square Token in Settings.");
        const env = integration.environment || 'production';
        const loc = await SquareIntegrationService.fetchLocation(token, env);
        
        const stylistId = user?.stylistData?.id || allStylists[0]?.id;
        if (!stylistId) throw new Error("No team member selected or found.");
        
        const roadmapService = selectedVisit.services[0];
        const squareService = allServices.find(s => s.name.toLowerCase().includes(roadmapService.name.toLowerCase()));
        if (!squareService) throw new Error(`Could not find Square service: "${roadmapService.name}"`);

        const searchStart = new Date(selectedVisit.date);
        searchStart.setDate(searchStart.getDate() - 3);
        const now = new Date();
        if (searchStart < now) searchStart.setTime(now.getTime());

        const slots = await SquareIntegrationService.findAvailableSlots(token, env, {
            locationId: loc.id,
            startAt: SquareIntegrationService.formatDate(searchStart, loc.timezone),
            teamMemberId: stylistId,
            serviceVariationId: squareService.id
        });
        setAvailableSlots(slots);
    } catch (e: any) { 
        setFetchError(e.message); 
    } finally { 
        setIsFetchingSlots(false); 
    }
  };

  const filteredSlots = useMemo(() => {
      return availableSlots.filter(s => {
          const hour = new Date(s).getHours();
          if (timePeriod === 'morning') return hour < 12;
          if (timePeriod === 'afternoon') return hour >= 12 && hour < 17;
          if (timePeriod === 'evening') return hour >= 17;
          return true;
      });
  }, [availableSlots, timePeriod]);

  const groupedSlots = useMemo(() => {
      const groups: { [key: string]: string[] } = {};
      filteredSlots.forEach(s => {
          const day = new Date(s).toDateString();
          if (!groups[day]) groups[day] = [];
          groups[day].push(s);
      });
      return groups;
  }, [filteredSlots]);

  const executeBooking = async (slotTime: string) => {
      setIsBooking(true);
      setFetchError(null);
      try {
          const token = integration.squareAccessToken;
          if (!token) throw new Error("Missing Square Token.");
          const env = integration.environment || 'production';
          const loc = await SquareIntegrationService.fetchLocation(token, env);
          
          let customerId = plan.client.externalId || await SquareIntegrationService.searchCustomer(token, env, plan.client.name);
          if (!customerId) throw new Error(`Could not find client "${plan.client.name}" in Square.`);

          const stylistId = user?.stylistData?.id || allStylists[0]?.id;
          
          const validServices = selectedVisit!.services.map(rs => 
              allServices.find(as => as.name.toLowerCase().includes(rs.name.toLowerCase()))
          ).filter(Boolean) as Service[];

          await SquareIntegrationService.createAppointment(token, env, {
              locationId: loc.id,
              startAt: slotTime,
              customerId,
              teamMemberId: stylistId,
              services: validServices
          });

          setBookingSuccess(true);
          setTimeout(() => setBookingModalOpen(false), 2000);
      } catch (e: any) {
          setFetchError(e.message);
      } finally {
          setIsBooking(false);
      }
  };

  const isMissingContact = useMemo(() => {
    if (deliveryMethod === 'sms') return !plan.client.phone;
    if (deliveryMethod === 'email') return !plan.client.email;
    return false;
  }, [deliveryMethod, plan.client]);

  return (
    <div className="flex flex-col h-full bg-brand-bg relative">
      <div className="flex-grow p-4 pb-72 overflow-y-auto text-gray-950">
        <div className="mb-6 flex justify-between items-end border-b-2 border-gray-100 pb-4">
            <div>
                <h1 className="text-2xl font-black text-gray-950 tracking-tighter leading-none mb-1">Roadmap Summary</h1>
                <p className="text-base font-black text-brand-blue uppercase tracking-widest">{plan.client.name}</p>
            </div>
            <span className={`text-xs font-black px-4 py-1.5 rounded-full border-2 shadow-sm ${isPlanActive ? 'bg-green-50 text-green-900 border-green-400' : 'bg-gray-100 text-gray-950 border-gray-400'}`}>
                {isPlanActive ? 'PUBLISHED' : 'DRAFT'}
            </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="col-span-2 bg-gray-950 p-6 rounded-[32px] text-white shadow-2xl flex justify-between items-center border-4 border-gray-900">
                <div>
                    <p className="text-sm font-black uppercase text-gray-300 mb-1 tracking-widest">Yearly Investment</p>
                    <p className="text-5xl font-black text-brand-teal">{formatCurrency(plan.totalCost)}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black uppercase text-gray-400 mb-1 tracking-widest">VIP Tier</p>
                    <p className="text-xl font-black" style={{color: qualifyingTier.color}}>{qualifyingTier.name}</p>
                </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border-4 border-gray-100 shadow-lg">
                <p className="text-sm font-black uppercase text-gray-900 mb-1 tracking-widest">Avg. Visit</p>
                <p className="text-3xl font-black text-gray-950">{formatCurrency(plan.averageAppointmentCost)}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border-4 border-gray-100 shadow-lg">
                <p className="text-sm font-black uppercase text-gray-900 mb-1 tracking-widest">Avg. Monthly</p>
                <p className="text-3xl font-black text-gray-950">{formatCurrency(plan.averageMonthlySpend)}</p>
            </div>
            <div className="col-span-2 bg-brand-blue p-5 rounded-3xl shadow-xl flex justify-between items-center">
                <span className="text-sm font-black text-white uppercase tracking-widest">Planned Visits</span>
                <span className="text-3xl font-black text-white">{plan.totalYearlyAppointments}</span>
            </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border-4 border-gray-100 mb-8 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase text-gray-900 tracking-widest">Visit Value Forecast</h3>
                <span className="text-[10px] font-black text-gray-400 uppercase">Cost Per Appointment</span>
            </div>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visitChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                            dataKey="name" 
                            tick={{fontSize: 10, fontWeight: 900, fill: '#666'}} 
                            axisLine={{stroke:'#eee', strokeWidth:2}} 
                            tickLine={false}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                        />
                        <YAxis 
                            tick={{fontSize: 10, fontWeight: 900, fill: '#666'}} 
                            axisLine={{stroke:'#eee', strokeWidth:2}} 
                            tickLine={false} 
                        />
                        <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{backgroundColor: '#000', color: '#fff', borderRadius: '16px', border: 'none', fontWeight: 900}} 
                        />
                        {serviceLegend.map(name => (
                            <Bar 
                                key={name} 
                                dataKey={name} 
                                stackId="a" 
                                fill={SERVICE_COLORS[name] || '#cbd5e1'} 
                                radius={[0,0,0,0]} 
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {/* Simple Inline Legend */}
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
                {serviceLegend.map(name => (
                    <div key={name} className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: SERVICE_COLORS[name] || '#cbd5e1'}}></div>
                        <span className="text-[10px] font-black text-gray-600 uppercase">{name}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div className="fixed bottom-12 left-0 right-0 max-w-md mx-auto p-5 bg-white border-t-4 border-gray-950 shadow-[0_-20px_50px_rgba(0,0,0,0.15)] z-40 pb-16 flex flex-col space-y-4">
          {!isPlanActive && (
              <button onClick={handlePublish} disabled={isPublishing} className="w-full bg-gray-950 text-white py-5 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-4 border-gray-800">
                  {isPublishing ? <RefreshIcon className="w-6 h-6 animate-spin" /> : <GlobeIcon className="w-6 h-6" />}
                  <span>PUBLISH TO CLIENT</span>
              </button>
          )}
          
          <button 
              onClick={() => setMembershipModalOpen(true)}
              className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center space-x-3 shadow-xl active:scale-95 transition-all border-b-4 ${isMemberOffered ? 'bg-green-600 text-white border-green-900' : 'bg-brand-pink text-white border-pink-900'}`}
          >
              {isMemberOffered ? <CheckCircleIcon className="w-6 h-6" /> : <PlusIcon className="w-6 h-6" />}
              <span>{isMemberOffered ? 'INVITATION SENT' : 'SEND VIP INVITATION'}</span>
          </button>

          <button 
            onClick={handleOpenBooking} 
            disabled={!canBook}
            className={`w-full py-5 rounded-2xl font-black text-lg shadow-md active:scale-95 transition-all flex items-center justify-center space-x-3 border-b-8 ${canBook ? 'bg-white text-gray-950 border-gray-950' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
          >
              <CalendarIcon className={`w-6 h-6 ${canBook ? 'text-brand-teal' : 'text-gray-300'}`} />
              <span>{canBook ? 'SYNC VISIT TO SQUARE' : 'SYNC DISABLED'}</span>
          </button>
      </div>

      {/* VIP INVITATION MODAL */}
      {isMembershipModalOpen && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
              <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl relative overflow-hidden border-4 border-gray-950 flex flex-col">
                  <div className="bg-brand-pink text-white p-7 text-center">
                      <h2 className="text-2xl font-black tracking-tight">VIP Invitation</h2>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">Upgrade {plan.client.name.split(' ')[0]}'s Experience</p>
                  </div>
                  
                  <div className="p-6">
                      {inviteSent ? (
                        <div className="py-12 text-center animate-bounce-in">
                            <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4" />
                            <p className="text-2xl font-black text-gray-950">INVITE SENT!</p>
                            <p className="text-sm text-gray-500 font-bold mt-2">Client marked as 'Offered'</p>
                        </div>
                      ) : (
                        <div className="space-y-6 text-gray-950">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Delivery Method</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setDeliveryMethod('sms')} className={`p-3 rounded-2xl border-4 font-black text-xs transition-all ${deliveryMethod === 'sms' ? 'border-brand-pink bg-brand-pink/10 text-brand-pink' : 'border-gray-50 bg-gray-50 text-gray-400'}`}>SMS</button>
                                    <button onClick={() => setDeliveryMethod('email')} className={`p-3 rounded-2xl border-4 font-black text-xs transition-all ${deliveryMethod === 'email' ? 'border-brand-pink bg-brand-pink/10 text-brand-pink' : 'border-gray-50 bg-gray-50 text-gray-400'}`}>EMAIL</button>
                                    <button onClick={() => setDeliveryMethod('link')} className={`p-3 rounded-2xl border-4 font-black text-xs transition-all ${deliveryMethod === 'link' ? 'border-brand-pink bg-brand-pink/10 text-brand-pink' : 'border-gray-50 bg-gray-50 text-gray-400'}`}>LINK</button>
                                </div>
                            </div>

                            {isMissingContact && (
                                <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100 flex items-start space-x-3">
                                    <div className="bg-red-500 text-white rounded-full p-1 mt-0.5">!</div>
                                    <div>
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Contact Missing</p>
                                        <p className="text-[11px] font-bold text-red-800 leading-tight">No {deliveryMethod === 'sms' ? 'phone' : 'email'} found for this client. You can still open the app, but you'll need to manually enter the recipient.</p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gray-50 p-4 rounded-3xl border-2 border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Message Preview</p>
                                <div className="bg-white p-4 rounded-2xl border-2 border-gray-200 text-xs font-bold text-gray-800 leading-relaxed italic shadow-inner">
                                    "{invitationMessage}"
                                </div>
                            </div>

                            <button 
                                onClick={handleSendInvite}
                                disabled={isSendingInvite}
                                className="w-full bg-brand-pink text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-8 border-pink-900 disabled:opacity-50"
                            >
                                {isSendingInvite ? <RefreshIcon className="w-6 h-6 animate-spin" /> : <ShareIcon className="w-6 h-6" />}
                                <span>{isSendingInvite ? 'OPENING...' : `OPEN ${deliveryMethod.toUpperCase()}`}</span>
                            </button>
                            
                            <button onClick={() => setMembershipModalOpen(false)} className="w-full text-center text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-950 transition-colors">Cancel</button>
                        </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* SQUARE BOOKING MODAL */}
      {isBookingModalOpen && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
              <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl relative overflow-hidden border-4 border-gray-950 flex flex-col max-h-[90vh]">
                  
                  <div className="bg-gray-950 text-white p-6 relative">
                    {bookingStep !== 'select-visit' && !bookingSuccess && (
                        <button onClick={() => setBookingStep(bookingStep === 'select-slot' ? 'select-period' : 'select-visit')} className="absolute left-4 top-6">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                    )}
                    <h2 className="text-xl font-black text-center">Square Booking</h2>
                    <p className="text-[10px] text-center text-gray-400 font-black uppercase tracking-widest mt-1">
                        {bookingStep === 'select-visit' ? 'Which visit are you syncing?' : 
                         bookingStep === 'select-period' ? 'What time of day do you prefer?' : 'Choose your perfect opening'}
                    </p>
                  </div>

                  <div className="p-6 overflow-y-auto flex-grow">
                      {bookingSuccess ? (
                          <div className="py-12 text-center animate-bounce-in">
                              <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4" />
                              <p className="text-3xl font-black text-gray-950">BOOKED!</p>
                              <p className="text-lg text-gray-900 font-black mt-2">Added to Square calendar.</p>
                          </div>
                      ) : fetchError ? (
                          <div className="p-6 bg-red-50 text-red-950 rounded-3xl border-4 border-red-500 text-center">
                              <p className="font-black uppercase text-xs mb-3 text-red-700">Square Error</p>
                              <p className="text-base font-black leading-relaxed mb-6">{fetchError}</p>
                              <button onClick={() => setBookingModalOpen(false)} className="w-full py-4 bg-red-700 text-white rounded-2xl font-black uppercase shadow-xl border-b-4 border-red-900">Close</button>
                          </div>
                      ) : isFetchingSlots ? (
                          <div className="py-16 text-center">
                              <RefreshIcon className="w-16 h-16 text-brand-blue animate-spin mx-auto mb-6" />
                              <p className="font-black text-gray-950 uppercase tracking-widest">Searching Square...</p>
                          </div>
                      ) : (
                          <>
                              {bookingStep === 'select-visit' && (
                                  <div className="space-y-3 text-gray-950">
                                      {futureVisits.length > 0 ? futureVisits.map((visit, i) => (
                                          <button key={i} onClick={() => startFetchingSlots(visit)} className="w-full p-5 border-4 border-gray-100 rounded-3xl text-left flex justify-between items-center group active:scale-95 transition-all hover:border-brand-blue">
                                              <div className="text-gray-950">
                                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Maintenance Visit</p>
                                                <p className="text-xl font-black group-hover:text-brand-blue">{visit.date.toLocaleDateString([], {month:'long', day:'numeric'})}</p>
                                                <p className="text-xs font-bold text-gray-600 truncate max-w-[180px]">{visit.services.map(s => s.name).join(' + ')}</p>
                                              </div>
                                              <ChevronRightIcon className="w-6 h-6 text-gray-300" />
                                          </button>
                                      )) : (
                                          <div className="text-center py-10">
                                              <p className="font-black text-gray-950 text-lg leading-tight">No future roadmap visits<br/>available to sync.</p>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {bookingStep === 'select-period' && (
                                  <div className="space-y-4">
                                      <button onClick={() => confirmPeriodAndFetch('morning')} className="w-full p-6 bg-blue-50 border-4 border-blue-200 rounded-3xl text-left flex items-center space-x-4 active:scale-95 transition-all">
                                          <div className="bg-blue-500 text-white p-3 rounded-2xl text-xl">🌅</div>
                                          <div>
                                              <p className="text-xl font-black text-gray-950 leading-none">Morning</p>
                                              <p className="text-xs font-black uppercase tracking-widest text-blue-700 mt-2">Before 12:00 PM</p>
                                          </div>
                                      </button>
                                      <button onClick={() => confirmPeriodAndFetch('afternoon')} className="w-full p-6 bg-orange-50 border-4 border-orange-200 rounded-3xl text-left flex items-center space-x-4 active:scale-95 transition-all">
                                          <div className="bg-orange-500 text-white p-3 rounded-2xl text-xl">☀️</div>
                                          <div>
                                              <p className="text-xl font-black text-gray-950 leading-none">Afternoon</p>
                                              <p className="text-xs font-black uppercase tracking-widest text-orange-700 mt-2">12:00 PM - 5:00 PM</p>
                                          </div>
                                      </button>
                                      <button onClick={() => confirmPeriodAndFetch('evening')} className="w-full p-6 bg-indigo-50 border-4 border-indigo-200 rounded-3xl text-left flex items-center space-x-4 active:scale-95 transition-all">
                                          <div className="bg-indigo-500 text-white p-3 rounded-2xl text-xl">🌙</div>
                                          <div>
                                              <p className="text-xl font-black text-gray-950 leading-none">Evening</p>
                                              <p className="text-xs font-black uppercase tracking-widest text-indigo-700 mt-2">After 5:00 PM</p>
                                          </div>
                                      </button>
                                  </div>
                              )}

                              {bookingStep === 'select-slot' && (
                                  <div className="space-y-6">
                                      {Object.keys(groupedSlots).length > 0 ? Object.entries(groupedSlots).map(([day, slots]) => (
                                          <div key={day}>
                                              <h3 className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest border-b-2 border-gray-100 pb-2">{day}</h3>
                                              <div className="grid grid-cols-2 gap-2">
                                                  {slots.map((s, i) => (
                                                      <button key={i} onClick={() => executeBooking(s)} disabled={isBooking} className="p-4 border-4 border-gray-100 rounded-2xl text-center hover:border-brand-blue hover:bg-blue-50 active:scale-95 transition-all text-gray-950">
                                                          <span className="font-black text-base">{new Date(s).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                      </button>
                                                  ))}
                                              </div>
                                          </div>
                                      )) : (
                                          <div className="text-center py-10 text-gray-950">
                                              <p className="font-black text-lg leading-tight">No {timePeriod !== 'all' ? timePeriod : ''} openings<br/>found this week.</p>
                                              <button onClick={() => setBookingStep('select-period')} className="mt-4 text-brand-blue font-black underline">Change preference</button>
                                          </div>
                                      )}
                                  </div>
                              )}
                          </>
                      )}
                  </div>

                  {!bookingSuccess && (
                      <button onClick={() => setBookingModalOpen(false)} className="w-full p-6 text-gray-950 font-black uppercase tracking-widest text-[10px] border-t-4 border-gray-50 hover:bg-gray-50 transition-colors">Cancel Sync</button>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default PlanSummaryStep;
