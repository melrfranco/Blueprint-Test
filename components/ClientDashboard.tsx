
import React, { useState, useMemo } from 'react';
import type { Client, GeneratedPlan, UserRole } from '../types';
import PlanSummaryStep from './PlanSummaryStep';
import BottomNav from './BottomNav';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircleIcon, TrashIcon, DocumentTextIcon, RefreshIcon } from './icons';

interface ClientDashboardProps {
  client: Client;
  plan: GeneratedPlan | null;
  role: UserRole;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ client, plan, role }) => {
  const [activeTab, setActiveTab] = useState('plan');
  const { membershipTiers } = useSettings();
  const { logout, user } = useAuth();

  const monthlySpend = plan?.averageMonthlySpend || 0;
  
  const sortedTiers = useMemo(() => [...membershipTiers].sort((a, b) => b.minSpend - a.minSpend), [membershipTiers]);
  
  const currentTier = useMemo(() => {
      return sortedTiers.find(t => monthlySpend >= t.minSpend) || sortedTiers[sortedTiers.length - 1]; 
  }, [monthlySpend, sortedTiers]);

  const renderMemberships = () => (
      <div className="p-6 pb-24 h-full overflow-y-auto">
          <h1 className="text-2xl font-black text-brand-blue mb-4 tracking-tighter">Loyalty Status</h1>
          
          {plan && currentTier && (
              <div className="mb-8 p-1 rounded-[32px] bg-gray-950 shadow-2xl border-4 border-gray-900">
                  <div className="bg-white rounded-[28px] p-6 text-gray-950">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Your Benefits</p>
                            <h2 className="text-3xl font-black text-gray-950 tracking-tighter leading-none">{currentTier.name}</h2>
                          </div>
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border-4 border-gray-50 shadow-sm" style={{backgroundColor: currentTier.color + '20'}}>
                              <CheckCircleIcon className="w-8 h-8" style={{color: currentTier.color}} />
                          </div>
                      </div>
                      <ul className="space-y-3">
                          {currentTier.perks.map((perk, i) => (
                              <li key={i} className="flex items-center text-sm text-gray-950 font-black">
                                  <div className="w-2 h-2 rounded-full bg-green-500 mr-3"></div>
                                  {perk}
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>
          )}

          <h3 className="font-black text-gray-950 uppercase text-[10px] tracking-widest mb-4 px-1">Rewards Catalog</h3>
          
          <div className="space-y-4">
              {[...membershipTiers].reverse().map(tier => (
                  <div key={tier.id} className={`bg-white border-4 rounded-3xl overflow-hidden shadow-sm transition-all ${currentTier?.id === tier.id ? 'border-brand-teal ring-4 ring-teal-50' : 'border-gray-100 opacity-60'}`}>
                      <div className="p-5 text-gray-950">
                          <div className="flex justify-between items-center mb-3">
                              <h3 className="font-black text-gray-950">{tier.name}</h3>
                              <span className="text-[10px] font-black bg-gray-100 px-3 py-1 rounded-full uppercase tracking-tighter">Min ${tier.minSpend}/mo</span>
                          </div>
                          <ul className="space-y-2">
                              {tier.perks.map((perk, i) => (
                                  <li key={i} className="text-xs text-gray-600 font-bold flex items-center">
                                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-2"></div>
                                      {perk}
                                  </li>
                              ))}
                          </ul>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderAccount = () => (
      <div className="p-6 h-full overflow-y-auto pb-48">
          <h1 className="text-2xl font-black text-brand-blue mb-8 tracking-tighter">Profile</h1>
          
          <div className="bg-white p-8 rounded-[40px] border-4 border-gray-950 shadow-2xl mb-8">
            <img src={client.avatarUrl} className="w-24 h-24 rounded-3xl mx-auto mb-6 border-4 border-gray-50 shadow-lg object-cover" />
            <div className="text-center">
                <h2 className="text-2xl font-black text-gray-950 mb-2">{client.name}</h2>
                <p className="text-xs font-black text-brand-pink uppercase tracking-widest">Valued Guest</p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t-4 border-gray-200">
              <button onClick={logout} className="w-full text-white font-black py-5 bg-red-600 rounded-2xl border-b-8 border-red-900 uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3">
                  <TrashIcon className="w-6 h-6" />
                  <span>SIGN OUT</span>
              </button>
              <p className="text-center text-[10px] text-gray-400 font-black mt-8 uppercase tracking-widest">Salon ID: LUXE-PRIME-001</p>
          </div>
      </div>
  );

  const renderContent = () => {
    switch (activeTab) {
        case 'plan':
             if (!plan) return (
                 <div className="p-8 text-center h-full flex flex-col items-center justify-center text-gray-400 font-black uppercase text-sm tracking-widest">
                     <DocumentTextIcon className="w-16 h-16 mb-4 opacity-20" />
                     <p className="px-10 leading-tight">Your stylist is currently building your maintenance plan.</p>
                 </div>
             );
             
             if (plan.status === 'draft') return (
                <div className="p-8 text-center h-full flex flex-col items-center justify-center">
                    <RefreshIcon className="w-16 h-16 mb-4 text-brand-teal animate-spin-slow opacity-40" />
                    <h2 className="text-2xl font-black text-gray-950 tracking-tighter mb-2">Plan In Progress</h2>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-8 leading-relaxed">
                        Your personalized roadmap for {plan.client.name.split(' ')[0]} is under review. Check back shortly!
                    </p>
                </div>
             );

            return <PlanSummaryStep plan={plan} role={role} />;
        case 'memberships': return renderMemberships();
        case 'account': return renderAccount();
        default: return <div>Unknown</div>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
        <div className="flex-grow flex flex-col">
            {renderContent()}
        </div>
        <BottomNav role={role} activeTab={activeTab} onNavigate={setActiveTab} />
    </div>
  );
};

export default ClientDashboard;
