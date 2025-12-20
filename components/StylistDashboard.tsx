
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import type { Step, Service, PlanDetails, GeneratedPlan, PlanAppointment, Client, UserRole } from '../types';
import { TODAY_APPOINTMENTS, MOCK_CLIENTS } from '../data/mockData';
import SelectClientStep from './SelectClientStep';
import SelectServicesStep from './SelectServicesStep';
import SetDatesStep from './SetDatesStep';
import SetFrequencyStep from './SetFrequencyStep';
import LoadingStep from './LoadingStep';
import PlanSummaryStep from './PlanSummaryStep';
import BottomNav from './BottomNav';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../contexts/PlanContext';
import { RefreshIcon, DocumentTextIcon, PlusIcon, CalendarIcon, ChevronRightIcon, UsersIcon, TrashIcon } from './icons';

interface StylistDashboardProps {
    onLogout: () => void;
    client?: Client;
    existingPlan?: GeneratedPlan | null;
    onPlanChange?: (plan: GeneratedPlan | null) => void;
    role?: UserRole;
    initialStep?: Step;
}

const StylistDashboard: React.FC<StylistDashboardProps> = ({ onLogout, role: propRole, existingPlan: propPlan, client: propClient, initialStep }) => {
  const [activeTab, setActiveTab] = useState(initialStep ? 'plans' : 'home');
  const [step, setStep] = useState<Step | 'idle'>('idle');
  
  const { services: availableServices, clients: globalClients, integration } = useSettings(); 
  const { user } = useAuth();
  const { savePlan, getPlanForClient, getClientHistory } = usePlans();

  const [activeClient, setActiveClient] = useState<Client | null>(propClient || null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [planDetails, setPlanDetails] = useState<PlanDetails>({});
  
  const [clientSearch, setClientSearch] = useState('');
  const [viewingHistory, setViewingHistory] = useState(false);
  const [selectedHistoryPlan, setSelectedHistoryPlan] = useState<GeneratedPlan | null>(null);

  const currentPlan = selectedHistoryPlan || propPlan || (activeClient ? getPlanForClient(activeClient.id) : null);

  useEffect(() => {
      if (initialStep) {
          setStep(initialStep);
          setActiveTab('plans');
      }
  }, [initialStep]);

  const selectedServices = useMemo(() => {
    return availableServices.filter(service => selectedServiceIds.includes(service.id));
  }, [selectedServiceIds, availableServices]);

  const filteredClients = useMemo(() => {
      return globalClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clientSearch, globalClients]);

  const handleClientSelectedForPlan = (client: Client) => {
      setActiveClient(client);
      setViewingHistory(true);
      setSelectedHistoryPlan(null);
      setStep('idle');
      setActiveTab('plans');
  };

  const handleStartNewPlan = () => {
      if (!activeClient) return;
      setSelectedServiceIds([]);
      setPlanDetails({});
      setViewingHistory(false);
      setSelectedHistoryPlan(null);
      setStep('select-services');
  };
  
  const handleEditExistingPlan = () => {
      if(!currentPlan) return;
      const serviceIds: string[] = Array.from(new Set(currentPlan.appointments.flatMap(a => a.services.map(s => s.id))));
      setSelectedServiceIds(serviceIds);
      const details: PlanDetails = {};
      serviceIds.forEach((id: string) => {
          const firstAppt = currentPlan.appointments.find(a => a.services.some(s => s.id === id));
          details[id] = {
              firstDate: firstAppt ? new Date(firstAppt.date) : new Date(),
              frequency: 6
          };
      });
      setPlanDetails(details);
      setViewingHistory(false);
      setStep('select-services');
  }

  const handleClientSelectedFromWizard = (client: Client) => {
      setActiveClient(client);
      setStep('select-services');
  };

  const handleServicesSelected = (ids: string[]) => {
    setSelectedServiceIds(ids);
    const initialDetails: PlanDetails = {};
    ids.forEach(id => {
      initialDetails[id] = { firstDate: null, frequency: null };
    });
    setPlanDetails(initialDetails);
    setStep('set-dates');
  };
  
  const handleDatesSet = (details: PlanDetails) => {
    setPlanDetails(details);
    setStep('set-frequency');
  };

  const handleFrequencySet = (details: PlanDetails) => {
    setPlanDetails(details);
    setStep('loading');
    setTimeout(() => {
      generatePlan(details, ids => setSelectedServiceIds(ids));
    }, 1500);
  };
  
  const generatePlan = (details: PlanDetails, serviceIdUpdater: (ids: string[]) => void) => {
    if (!activeClient) return;
    const stylistLevelId = user?.stylistData?.levelId || 'lvl_1'; 
    const planStartDate = new Date();
    const planEndDate = new Date();
    planEndDate.setFullYear(planEndDate.getFullYear() + 1);
    const appointments: PlanAppointment[] = [];
    let totalCost = 0;
    const finalSelectedServices = availableServices.filter(s => details[s.id]?.firstDate && details[s.id]?.frequency);
    serviceIdUpdater(finalSelectedServices.map(s => s.id));
    finalSelectedServices.forEach(service => {
        const detail = details[service.id];
        if (!detail || detail.firstDate === null || detail.frequency === null) return;
        const dynamicCost = service.tierPrices?.[stylistLevelId] ?? service.cost;
        let currentDate = new Date(detail.firstDate.getTime());
        while (currentDate <= planEndDate) {
            if (currentDate >= planStartDate) {
                const serviceInstance = { ...service, cost: dynamicCost };
                appointments.push({
                    date: new Date(currentDate.getTime()),
                    services: [serviceInstance]
                });
                totalCost += dynamicCost;
            }
            currentDate.setDate(currentDate.getDate() + detail.frequency * 7);
        }
    });
    const mergedAppointments = appointments.reduce((acc, current) => {
        const existing = acc.find(a => a.date.toDateString() === current.date.toDateString());
        if (existing) {
            existing.services.push(...current.services);
        } else {
            acc.push(current);
        }
        return acc;
    }, [] as PlanAppointment[]);
    mergedAppointments.sort((a, b) => a.date.getTime() - b.date.getTime());
    const totalAppointments = mergedAppointments.length;
    const averageAppointmentCost = totalAppointments > 0 ? totalCost / totalAppointments : 0;
    const averageMonthlySpend = totalCost / 12;
    const newPlan: GeneratedPlan = {
        id: `plan_${Date.now()}`,
        status: 'draft',
        membershipStatus: 'none',
        createdAt: new Date().toISOString(),
        stylistId: user?.id?.toString() ?? '0',
        stylistName: user?.name || 'Stylist',
        client: activeClient, 
        appointments: mergedAppointments,
        totalYearlyAppointments: totalAppointments,
        averageAppointmentCost,
        averageMonthlySpend,
        totalCost,
    };
    savePlan(newPlan);
    setSelectedHistoryPlan(newPlan);
    setStep('summary');
  };

  const renderHome = () => (
      <div className="p-6 overflow-y-auto h-full pb-20">
          <div className="flex justify-between items-center mb-6">
              <div>
                  <h1 className="text-2xl font-bold text-brand-blue tracking-tighter">Stylist Portal</h1>
                  <p className="text-gray-950 font-black text-sm uppercase tracking-widest">{user?.name || 'Stylist'}</p>
              </div>
              <div className="w-12 h-12 bg-brand-pink rounded-2xl flex items-center justify-center text-white font-black border-4 border-gray-950 shadow-lg">
                {user?.name?.[0] || 'S'}
              </div>
          </div>
           <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-5 rounded-[24px] border-4 border-gray-100 shadow-sm">
                  <p className="text-[10px] text-gray-500 font-black uppercase mb-1 tracking-widest">Personal Rev</p>
                  <p className="text-3xl font-black text-brand-blue">$1,850</p>
              </div>
              <div className="bg-white p-5 rounded-[24px] border-4 border-gray-100 shadow-sm">
                  <p className="text-[10px] text-gray-500 font-black uppercase mb-1 tracking-widest">Efficiency</p>
                  <p className="text-3xl font-black text-brand-blue">92%</p>
              </div>
           </div>
           <button onClick={() => { setActiveTab('plans'); setStep('select-client'); }} className="w-full bg-brand-blue text-white font-black py-5 px-4 rounded-2xl shadow-xl mb-6 flex items-center justify-center space-x-3 border-b-4 border-blue-900 active:scale-95 transition-all">
              <PlusIcon className="w-6 h-6" />
              <span>NEW MAINTENANCE ROADMAP</span>
          </button>
      </div>
  );

  const renderAccount = () => (
      <div className="p-6 flex flex-col h-full overflow-y-auto pb-48">
          <h1 className="text-2xl font-black text-brand-blue mb-8 tracking-tighter">My Account</h1>
          
          <div className="bg-white p-8 rounded-[40px] border-4 border-gray-950 shadow-2xl mb-8">
            <div className="w-24 h-24 bg-brand-pink rounded-3xl mx-auto mb-6 flex items-center justify-center text-4xl font-black text-white shadow-xl border-4 border-gray-900">
                {user?.name?.[0] || 'S'}
            </div>
            <div className="text-center">
                <h2 className="text-2xl font-black text-gray-950 mb-2">{user?.name}</h2>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{user?.stylistData?.role || 'Senior Stylist'}</p>
            </div>
          </div>

          <div className="space-y-4">
              <div className="bg-white p-6 rounded-3xl border-4 border-gray-100 shadow-sm">
                  <p className="text-xs font-black text-gray-400 uppercase mb-1 tracking-widest">Email</p>
                  <p className="font-bold text-gray-950">{user?.stylistData?.email || 'stylist@salon.com'}</p>
              </div>
          </div>

          <div className="mt-12 pt-8 border-t-4 border-gray-200">
              <button onClick={onLogout} className="w-full text-white font-black py-5 bg-red-600 rounded-2xl border-b-8 border-red-900 uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3">
                  <TrashIcon className="w-6 h-6" />
                  <span>SIGN OUT OF APP</span>
              </button>
          </div>
      </div>
  );

  const renderClientHistory = () => {
      if (!activeClient) return null;
      const clientPlans = getClientHistory(activeClient.id);
      return (
          <div className="p-6 h-full flex flex-col">
              <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border-4 border-gray-100 text-center">
                  <img src={activeClient.avatarUrl} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-brand-teal" />
                  <h2 className="text-2xl font-black text-brand-blue">{activeClient.name}</h2>
                  {activeClient.externalId && <span className="text-[10px] text-green-600 font-black bg-green-50 px-2 py-0.5 rounded border border-green-200 uppercase tracking-widest">Square Linked</span>}
              </div>
              <h3 className="font-black text-gray-950 mb-3 text-sm uppercase tracking-widest px-1">Roadmap History</h3>
              <div className="flex-grow space-y-4 overflow-y-auto pb-24">
                  {clientPlans.length === 0 && <p className="text-center py-8 text-gray-400 font-bold uppercase text-xs">No active roadmaps found.</p>}
                  {clientPlans.map(plan => (
                      <div key={plan.id} className="bg-white p-5 rounded-[24px] border-4 border-gray-100 shadow-sm cursor-pointer hover:border-brand-teal transition-all active:scale-95" onClick={() => { setSelectedHistoryPlan(plan); setStep('summary'); }}>
                          <div className="flex justify-between items-center">
                              <div>
                                  <p className="font-black text-gray-950">Maintenance Plan</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Created {new Date(plan.createdAt).toLocaleDateString()}</p>
                              </div>
                              <p className="text-lg font-black text-brand-blue">${plan.totalCost.toLocaleString()}</p>
                          </div>
                      </div>
                  ))}
              </div>
              <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30">
                  <button onClick={handleStartNewPlan} className="w-full bg-brand-blue text-white font-black py-5 rounded-2xl shadow-2xl border-b-4 border-blue-900 active:scale-95 transition-all">NEW ROADMAP</button>
                  <button onClick={() => { setActiveClient(null); setViewingHistory(false); }} className="w-full text-center mt-3 text-gray-400 font-black uppercase tracking-widest text-xs">Back to Search</button>
              </div>
          </div>
      )
  }

  const renderContent = () => {
      switch (activeTab) {
          case 'home': return renderHome();
          case 'clients': return (
              <div className="p-4 flex flex-col h-full">
                  <h1 className="text-2xl font-black text-brand-blue mb-6 tracking-tighter">Client Directory</h1>
                   <div className="relative mb-6">
                        <input type="text" placeholder="Search by name..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full p-4 pl-12 bg-white border-4 border-gray-100 rounded-2xl outline-none font-bold text-gray-950 shadow-sm focus:border-brand-blue" />
                        <UsersIcon className="w-5 h-5 text-gray-400 absolute left-4 top-4.5" />
                   </div>
                  <div className="flex-grow overflow-y-auto space-y-3 px-1">
                    {filteredClients.map(c => (
                        <button key={c.id} className="w-full flex items-center p-4 bg-white border-4 border-gray-100 rounded-[24px] shadow-sm active:scale-95 transition-all text-left" onClick={() => handleClientSelectedForPlan(c)}>
                            <img src={c.avatarUrl} className="w-14 h-14 rounded-2xl mr-4 border-2 border-gray-50"/>
                            <div className="flex-grow">
                                <span className="font-black text-gray-950 block text-lg leading-tight">{c.name}</span>
                                {c.externalId && <span className="text-[10px] text-green-600 font-black uppercase tracking-widest">Square Connected</span>}
                            </div>
                            <ChevronRightIcon className="w-6 h-6 text-gray-200"/>
                        </button>
                    ))}
                  </div>
              </div>
          );
          case 'appointments': return (
              <div className="p-6 flex flex-col items-center justify-center h-full text-center">
                  <CalendarIcon className="w-16 h-16 text-brand-blue mb-6" />
                  <h1 className="text-2xl font-black text-brand-blue mb-2 tracking-tighter">Salon Schedule</h1>
                  <p className="text-gray-400 font-bold mb-8 px-8">Synchronized with your salon management system.</p>
                  <button className="bg-gray-950 text-white px-10 py-5 rounded-2xl font-black text-lg border-b-4 border-gray-800 shadow-xl active:scale-95 transition-all">LAUNCH POS</button>
              </div>
          ); 
          case 'plans': 
              if (activeClient && viewingHistory && step === 'idle') return renderClientHistory();
              if (step === 'select-client') return <SelectClientStep clients={globalClients} onSelect={handleClientSelectedFromWizard} onBack={() => { setStep('idle'); setActiveTab('home'); }} />;
              if (step === 'select-services') return <SelectServicesStep availableServices={availableServices} onNext={handleServicesSelected} onBack={() => { setViewingHistory(true); setStep('idle'); }} />;
              if (step === 'set-dates') return <SetDatesStep selectedServices={selectedServices} onNext={handleDatesSet} planDetails={planDetails} onBack={() => setStep('select-services')} />;
              if (step === 'set-frequency') return <SetFrequencyStep selectedServices={selectedServices} onNext={handleFrequencySet} planDetails={planDetails} onBack={() => setStep('set-dates')} />;
              if (step === 'loading') return <LoadingStep />;
              if (step === 'summary' && currentPlan) return <PlanSummaryStep plan={currentPlan} onEditPlan={handleEditExistingPlan} role={propRole || 'stylist'} />;
              return (
                 <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                    <DocumentTextIcon className="w-16 h-16 text-brand-blue mb-6" />
                    <h2 className="text-2xl font-black text-brand-blue mb-2 tracking-tighter">Plan Management</h2>
                    <p className="text-gray-400 font-bold mb-8">Select a client to view or create roadmaps.</p>
                    <button onClick={() => setStep('select-client')} className="bg-brand-pink text-white font-black py-5 px-10 rounded-2xl border-b-4 border-pink-900 shadow-xl active:scale-95 transition-all">START HERE</button>
                 </div>
              );
          case 'account': return renderAccount();
          default: return <div>Unknown Tab</div>;
      }
  };

  return (
      <div className="flex flex-col h-full bg-brand-bg">
        <div className="flex-grow flex flex-col pb-20 overflow-hidden">
            {renderContent()}
        </div>
        <BottomNav role={propRole || 'stylist'} activeTab={activeTab} onNavigate={(tab) => {
            setActiveTab(tab);
            if (tab === 'plans') {
                setStep('idle');
                setActiveClient(null);
                setViewingHistory(false);
                setSelectedHistoryPlan(null);
            }
        }} />
      </div>
  )
};

export default StylistDashboard;
