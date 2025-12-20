
import React, { useState, useMemo } from 'react';
import BottomNav from './BottomNav';
import StylistDashboard from './StylistDashboard';
import { SquareIntegrationService } from '../services/squareIntegration';
import { CURRENT_CLIENT } from '../data/mockData';
import { useSettings } from '../contexts/SettingsContext';
import { usePlans } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { 
    RefreshIcon, 
    CheckCircleIcon, 
    ChevronLeftIcon,
    ChevronRightIcon,
    PlusIcon,
    TrashIcon,
    UsersIcon,
    GlobeIcon,
    ClipboardIcon,
    DocumentTextIcon,
    HomeIcon,
    DatabaseIcon,
    SettingsIcon
} from './icons';
import type { UserRole, GeneratedPlan, Service, Stylist } from '../types';

type SettingsView = 'menu' | 'branding' | 'services' | 'team' | 'memberships' | 'integrations';

const AdminDashboard: React.FC<{ role: UserRole }> = ({ role }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSettingsView, setActiveSettingsView] = useState<SettingsView>('menu');
  const [editingStylist, setEditingStylist] = useState<Stylist | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');

  const { 
      services, updateServices,
      stylists, updateStylists,
      clients, updateClients,
      branding, updateBranding,
      integration, updateIntegration,
      linkingConfig, updateLinkingConfig,
      saveAll
  } = useSettings();
  
  const { getStats, plans } = usePlans();
  const { logout, user } = useAuth();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [adminPlan, setAdminPlan] = useState<GeneratedPlan | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const stats = getStats();
  const allPlansSorted = useMemo(() => [...plans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [plans]);
  
  const totalPipeline = stats.totalRevenue + plans.filter(p => p.status === 'active' || p.status === 'draft').reduce((sum, p) => sum + p.totalCost, 0);

  const markUnsaved = () => setHasUnsavedChanges(true);

  const handleSaveSettings = () => {
      saveAll();
      setHasUnsavedChanges(false);
      setSyncMessage("Settings Saved!");
      setTimeout(() => setSyncMessage(null), 2000);
  }

  const handleSync = async () => {
      const token = integration.squareAccessToken;
      const env = integration.environment;
      if (!token) { setSyncError("Access Token Required."); return; }

      setIsSyncing(true);
      setSyncMessage(null);
      setSyncError(null);

      try {
          const [newServices, newStylists, newClients] = await Promise.all([
              SquareIntegrationService.fetchCatalog(token, env),
              SquareIntegrationService.fetchTeam(token, env),
              SquareIntegrationService.fetchCustomers(token, env)
          ]);
          
          if (newServices.length > 0) updateServices(newServices);
          if (newStylists.length > 0) updateStylists(newStylists);
          if (newClients.length > 0) updateClients(newClients);
          
          setSyncMessage("Sync Successful!");
          saveAll();
          setHasUnsavedChanges(false);
      } catch (error: any) {
          setSyncError(error.message || "Sync failed.");
      } finally {
          setIsSyncing(false);
      }
  };

  const categories = useMemo(() => ['None', ...Array.from(new Set(services.map(s => s.category)))], [services]);

  const filteredServices = useMemo(() => {
      return services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()));
  }, [services, serviceSearch]);

  const toggleTriggerService = (serviceId: string) => {
      const current = linkingConfig.triggerServiceIds || [];
      const updated = current.includes(serviceId) 
          ? current.filter(id => id !== serviceId) 
          : [...current, serviceId];
      updateLinkingConfig({ ...linkingConfig, triggerServiceIds: updated });
      markUnsaved();
  };

  const renderServices = () => (
    <div className="space-y-8 animate-fade-in pb-32">
        <div className="bg-blue-50 p-6 rounded-[32px] border-4 border-brand-blue/10">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-brand-blue uppercase tracking-widest">Logic: Auto-Link Services</h4>
                <button 
                    onClick={() => { updateLinkingConfig({...linkingConfig, enabled: !linkingConfig.enabled}); markUnsaved(); }}
                    className={`w-14 h-8 rounded-full transition-all relative border-2 ${linkingConfig.enabled ? 'bg-brand-teal border-teal-600' : 'bg-gray-300 border-gray-400'}`}
                >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${linkingConfig.enabled ? 'left-7' : 'left-1'}`}></div>
                </button>
            </div>
            
            <p className="text-[11px] text-gray-950 font-bold leading-tight mb-6">If any "Trigger" services are selected, but the "Exclusion" is missing, we'll suggest the "Linked" service.</p>
            
            <div className="space-y-6">
                {/* Exclusion and Linked selectors (Sticky choices) */}
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-950 uppercase mb-1 tracking-widest">Step 1: The Exclusion (e.g. Haircut)</label>
                        <select 
                            value={linkingConfig.exclusionServiceId}
                            onChange={e => { updateLinkingConfig({...linkingConfig, exclusionServiceId: e.target.value}); markUnsaved(); }}
                            className="w-full p-4 border-2 border-gray-200 rounded-2xl font-black text-gray-950 bg-white outline-none"
                        >
                            <option value="">Select Exclusion Service...</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-950 uppercase mb-1 tracking-widest">Step 2: Suggest this instead (e.g. Blowdry)</label>
                        <select 
                            value={linkingConfig.linkedServiceId}
                            onChange={e => { updateLinkingConfig({...linkingConfig, linkedServiceId: e.target.value}); markUnsaved(); }}
                            className="w-full p-4 border-2 border-gray-200 rounded-2xl font-black text-gray-950 bg-white outline-none"
                        >
                            <option value="">Select Suggested Service...</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Bulk Trigger Category */}
                <div>
                    <label className="block text-[10px] font-black text-gray-950 uppercase mb-1 tracking-widest">Step 3: Trigger by Category (Optional)</label>
                    <select 
                        value={linkingConfig.triggerCategory}
                        onChange={e => { updateLinkingConfig({...linkingConfig, triggerCategory: e.target.value}); markUnsaved(); }}
                        className="w-full p-4 border-2 border-gray-200 rounded-2xl font-black text-gray-950 bg-white outline-none"
                    >
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                {/* Granular Trigger Selection */}
                <div className="pt-2">
                    <label className="block text-[10px] font-black text-gray-950 uppercase mb-3 tracking-widest">Step 4: Select Specific Trigger Services</label>
                    <div className="relative mb-3">
                        <input 
                            type="text" 
                            placeholder="Find services to checkmark..."
                            value={serviceSearch}
                            onChange={(e) => setServiceSearch(e.target.value)}
                            className="w-full p-3 bg-white border-2 border-gray-200 rounded-xl font-bold text-xs text-gray-950 outline-none"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 bg-white rounded-2xl p-3 border-2 border-gray-100 shadow-inner">
                        {filteredServices.map(service => {
                            const isChecked = linkingConfig.triggerServiceIds?.includes(service.id);
                            return (
                                <button 
                                    key={service.id}
                                    onClick={() => toggleTriggerService(service.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${isChecked ? 'bg-brand-blue/5 border-brand-blue text-brand-blue' : 'bg-gray-50 border-transparent text-gray-400'}`}
                                >
                                    <span className="text-xs font-black">{service.name}</span>
                                    {isChecked ? <CheckCircleIcon className="w-5 h-5" /> : <PlusIcon className="w-4 h-4" />}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[9px] font-black text-gray-400 mt-2 uppercase text-center">{linkingConfig.triggerServiceIds?.length || 0} services manually linked</p>
                </div>
            </div>
        </div>

        <div className="space-y-3">
            <h4 className="text-xs font-black text-gray-950 uppercase px-1 tracking-widest">Active Square Catalog</h4>
            {services.map(service => (
                <div key={service.id} className="bg-white p-5 rounded-3xl border-4 border-gray-100 flex justify-between items-center opacity-70 grayscale hover:grayscale-0 transition-all">
                    <div>
                        <p className="text-sm font-black text-gray-950">{service.name}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase">${service.cost} • {service.duration}m</p>
                    </div>
                    <span className="text-[9px] font-black bg-gray-100 px-3 py-1 rounded-full text-gray-400 border border-gray-200">SYNCED</span>
                </div>
            ))}
        </div>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-4 pb-32">
        {editingStylist ? (
            <div className="animate-fade-in">
                <div className="bg-gray-950 p-7 rounded-[40px] text-white mb-8 border-4 border-gray-900 shadow-xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Team Access Control</p>
                    <h2 className="text-3xl font-black">{editingStylist.name}</h2>
                </div>
                
                <h4 className="text-xs font-black text-gray-950 uppercase mb-6 tracking-widest px-1">Functional Permissions</h4>
                
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-[32px] border-4 border-gray-100 flex items-center justify-between text-gray-950">
                        <div className="pr-4">
                            <p className="text-lg font-black">Square Booking</p>
                            <p className="text-xs font-bold text-gray-500 leading-tight">Can sync roadmap visits to Square calendar.</p>
                        </div>
                        <button 
                            onClick={() => {
                                const newStylist = { ...editingStylist, permissions: { ...editingStylist.permissions, canBookAppointments: !editingStylist.permissions.canBookAppointments } };
                                setEditingStylist(newStylist);
                                updateStylists(stylists.map(s => s.id === editingStylist.id ? newStylist : s));
                                markUnsaved();
                            }}
                            className={`w-14 h-8 rounded-full transition-all relative border-2 ${editingStylist.permissions.canBookAppointments ? 'bg-brand-teal border-teal-600' : 'bg-gray-200 border-gray-300'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${editingStylist.permissions.canBookAppointments ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border-4 border-gray-100 flex items-center justify-between text-gray-950">
                        <div className="pr-4">
                            <p className="text-lg font-black">Plan Discounting</p>
                            <p className="text-xs font-bold text-gray-500 leading-tight">Can override service costs when creating roadmaps.</p>
                        </div>
                        <button 
                            onClick={() => {
                                const newStylist = { ...editingStylist, permissions: { ...editingStylist.permissions, canOfferDiscounts: !editingStylist.permissions.canOfferDiscounts } };
                                setEditingStylist(newStylist);
                                updateStylists(stylists.map(s => s.id === editingStylist.id ? newStylist : s));
                                markUnsaved();
                            }}
                            className={`w-14 h-8 rounded-full transition-all relative border-2 ${editingStylist.permissions.canOfferDiscounts ? 'bg-brand-teal border-teal-600' : 'bg-gray-200 border-gray-300'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${editingStylist.permissions.canOfferDiscounts ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-[32px] border-4 border-gray-100 flex items-center justify-between text-gray-950">
                        <div className="pr-4">
                            <p className="text-lg font-black">Approval Required</p>
                            <p className="text-xs font-bold text-gray-500 leading-tight">Discounted plans must be approved by an Admin.</p>
                        </div>
                        <button 
                            onClick={() => {
                                const newStylist = { ...editingStylist, permissions: { ...editingStylist.permissions, requiresDiscountApproval: !editingStylist.permissions.requiresDiscountApproval } };
                                setEditingStylist(newStylist);
                                updateStylists(stylists.map(s => s.id === editingStylist.id ? newStylist : s));
                                markUnsaved();
                            }}
                            className={`w-14 h-8 rounded-full transition-all relative border-2 ${editingStylist.permissions.requiresDiscountApproval ? 'bg-brand-teal border-teal-600' : 'bg-gray-200 border-gray-300'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${editingStylist.permissions.requiresDiscountApproval ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>
                </div>
            </div>
        ) : (
            <>
                <div className="bg-orange-50 p-6 rounded-[32px] border-4 border-orange-100 mb-8 text-gray-950">
                    <h4 className="text-sm font-black uppercase mb-2">Team Governance</h4>
                    <p className="text-xs font-bold leading-tight">Define permissions for your team. All services are available to all stylists by default.</p>
                </div>
                {stylists.map(stylist => (
                    <button key={stylist.id} onClick={() => setEditingStylist(stylist)} className="w-full bg-white p-6 rounded-[28px] border-4 border-gray-100 flex items-center justify-between shadow-sm active:scale-95 transition-all mb-4 group hover:border-brand-pink">
                        <div className="flex items-center space-x-4 text-gray-950">
                            <div className="w-14 h-14 bg-brand-pink rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg">{stylist.name[0]}</div>
                            <div className="text-left">
                                <p className="text-lg font-black leading-none mb-1 group-hover:text-brand-pink transition-colors">{stylist.name}</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stylist.role}</p>
                            </div>
                        </div>
                        <ChevronRightIcon className="w-6 h-6 text-gray-200" />
                    </button>
                ))}
            </>
        )}
    </div>
  );

  const renderIntegrations = () => (
    <div className="bg-white p-8 rounded-[40px] border-4 border-gray-950 shadow-2xl mb-8 animate-fade-in text-gray-950">
        <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-gray-950 text-2xl tracking-tighter">Square Connection</h3>
            <button onClick={() => setShowSetupGuide(!showSetupGuide)} className="text-[10px] font-black text-gray-950 underline uppercase bg-gray-100 px-4 py-2 rounded-xl border-2 border-gray-300">{showSetupGuide ? 'Hide' : 'Setup'}</button>
        </div>
        
        {showSetupGuide && (
            <div className="bg-gray-50 p-6 rounded-3xl border-2 border-gray-200 mb-8 text-gray-950">
                <p className="text-xs font-black uppercase mb-3 tracking-widest text-brand-blue">Setup Requirements</p>
                <ol className="text-xs font-bold space-y-3 list-decimal list-inside leading-tight">
                    <li>Production Access Token from Square Dev.</li>
                    <li>Location status must be <span className="text-green-600 font-black underline uppercase">Active</span>.</li>
                </ol>
            </div>
        )}

        <div className="space-y-6">
            <div>
                <label className="block text-sm font-black text-gray-950 mb-2 uppercase tracking-widest">Access Token (Production)</label>
                <input 
                    type="password" 
                    value={integration.squareAccessToken || ''}
                    onChange={e => { updateIntegration({...integration, squareAccessToken: e.target.value }); markUnsaved(); }}
                    className="w-full p-5 border-4 border-gray-950 rounded-2xl text-base font-mono focus:ring-4 focus:ring-brand-blue/20 outline-none text-gray-950 bg-white placeholder:text-gray-300"
                    placeholder="EAAA..."
                />
            </div>
            
            {(syncError || syncMessage) && (
                <div className={`p-5 rounded-2xl border-4 font-black text-sm text-center leading-tight ${syncError ? 'bg-red-50 border-red-950 text-red-950' : 'bg-green-50 border-green-900 text-green-950'}`}>
                    {syncError || syncMessage}
                </div>
            )}
            
            <button onClick={handleSync} disabled={isSyncing} className="w-full bg-gray-950 text-white font-black py-5 rounded-2xl flex items-center justify-center text-lg shadow-2xl active:scale-95 transition-all disabled:bg-gray-400 border-b-8 border-gray-800">
                {isSyncing ? <RefreshIcon className="w-6 h-6 animate-spin mr-3" /> : <RefreshIcon className="w-6 h-6 mr-3" />}
                <span>{isSyncing ? 'SYNCING DATA...' : 'RE-SYNC FROM SQUARE'}</span>
            </button>
        </div>
    </div>
  );

  const renderSettings = () => (
    <div className="p-4 flex flex-col h-full bg-gray-50 overflow-y-auto">
        <div className="sticky top-0 bg-gray-50 z-50 pt-2 pb-6">
            {activeSettingsView !== 'menu' ? (
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => { if(editingStylist) setEditingStylist(null); else setActiveSettingsView('menu'); }} 
                        className="bg-gray-950 p-4 rounded-3xl border-4 border-gray-800 shadow-2xl active:scale-90 transition-all group"
                        aria-label="Back to Menu"
                    >
                        <ChevronLeftIcon className="w-7 h-7 text-white" />
                    </button>
                    <div>
                        <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest leading-none mb-1">Editing Settings</p>
                        <h1 className="text-2xl font-black text-gray-950 capitalize leading-none tracking-tighter">{activeSettingsView.replace('-', ' ')}</h1>
                    </div>
                </div>
            ) : (
                <h1 className="text-3xl font-black text-brand-blue tracking-tighter">System Settings</h1>
            )}
        </div>
        
        {activeSettingsView === 'menu' && (
            <div className="space-y-4 pb-48">
                <button onClick={() => setActiveSettingsView('branding')} className="w-full bg-white p-7 rounded-[32px] border-4 border-gray-100 flex items-center shadow-sm hover:border-brand-blue transition-all group active:scale-95">
                    <div className="bg-brand-blue p-4 rounded-2xl text-white mr-5 shadow-lg group-hover:scale-110 transition-transform"><GlobeIcon className="w-7 h-7" /></div>
                    <div className="text-left"><p className="text-xl font-black text-gray-950 leading-none tracking-tight">App Branding</p></div>
                </button>
                <button onClick={() => setActiveSettingsView('services')} className="w-full bg-white p-7 rounded-[32px] border-4 border-gray-100 flex items-center shadow-sm hover:border-brand-teal transition-all group active:scale-95">
                    <div className="bg-brand-teal p-4 rounded-2xl text-white mr-5 shadow-lg group-hover:scale-110 transition-transform"><ClipboardIcon className="w-7 h-7" /></div>
                    <div className="text-left"><p className="text-xl font-black text-gray-950 leading-none tracking-tight">Service Links</p></div>
                </button>
                <button onClick={() => setActiveSettingsView('team')} className="w-full bg-white p-7 rounded-[32px] border-4 border-gray-100 flex items-center shadow-sm hover:border-brand-pink transition-all group active:scale-95">
                    <div className="bg-brand-pink p-4 rounded-2xl text-white mr-5 shadow-lg group-hover:scale-110 transition-transform"><UsersIcon className="w-7 h-7" /></div>
                    <div className="text-left"><p className="text-xl font-black text-gray-950 leading-none tracking-tight">Team Access</p></div>
                </button>
                <button onClick={() => setActiveSettingsView('integrations')} className="w-full bg-gray-950 p-7 rounded-[32px] border-4 border-gray-800 flex items-center shadow-2xl hover:bg-gray-900 transition-all group active:scale-95">
                    <div className="bg-white/10 p-4 rounded-2xl text-white mr-5 shadow-lg group-hover:scale-110 transition-transform"><RefreshIcon className="w-7 h-7" /></div>
                    <div className="text-left"><p className="text-xl font-black text-white leading-none tracking-tight">Integrations</p></div>
                </button>
            </div>
        )}

        {activeSettingsView === 'branding' && (
            <div className="space-y-8 animate-fade-in pb-48 px-1">
                <div>
                    <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Salon Entity Name</label>
                    <input type="text" value={branding.salonName} onChange={e => { updateBranding({...branding, salonName: e.target.value}); markUnsaved(); }} className="w-full p-5 border-4 border-gray-950 rounded-2xl font-black bg-white text-gray-950 outline-none text-lg" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Primary Identity</label>
                        <input type="color" value={branding.primaryColor} onChange={e => { updateBranding({...branding, primaryColor: e.target.value}); markUnsaved(); }} className="w-full h-16 rounded-2xl border-4 border-gray-950 cursor-pointer p-1" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-950 mb-2 tracking-widest">Secondary Accent</label>
                        <input type="color" value={branding.secondaryColor} onChange={e => { updateBranding({...branding, secondaryColor: e.target.value}); markUnsaved(); }} className="w-full h-16 rounded-2xl border-4 border-gray-950 cursor-pointer p-1" />
                    </div>
                </div>
            </div>
        )}

        {activeSettingsView === 'services' && renderServices()}
        {activeSettingsView === 'team' && renderTeam()}
        {activeSettingsView === 'integrations' && renderIntegrations()}

        {hasUnsavedChanges && (
            <div className="fixed bottom-24 left-4 right-4 bg-gray-950 text-white p-6 rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] flex justify-between items-center z-[100] border-4 border-gray-700 animate-bounce-in">
                <span className="font-black text-xs uppercase tracking-widest text-brand-teal">Pending Changes</span>
                <button onClick={handleSaveSettings} className="bg-brand-teal px-10 py-4 rounded-2xl font-black text-sm uppercase shadow-xl active:scale-95 border-b-4 border-teal-950">Update System</button>
            </div>
        )}
    </div>
  );

  const renderDashboard = () => (
    <div className="p-4 flex flex-col h-full overflow-y-auto pb-48 bg-gray-50">
        <h1 className="text-2xl font-black text-brand-blue mb-6 tracking-tighter">Business Overview</h1>
        
        <div className="bg-gray-950 p-7 rounded-[40px] shadow-2xl border-4 border-gray-900 mb-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Projected pipeline</p>
            <p className="text-5xl font-black text-brand-teal mb-4 tracking-tighter">${totalPipeline.toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-5 rounded-[28px] border-4 border-gray-100 shadow-sm">
                <p className="text-[10px] text-gray-950 font-black uppercase mb-1 tracking-widest">Active Plans</p>
                <p className="text-3xl font-black text-brand-blue">{stats.activePlansCount}</p>
            </div>
             <div className="bg-white p-5 rounded-[28px] border-4 border-gray-100 shadow-sm">
                <p className="text-[10px] text-gray-950 font-black uppercase mb-1 tracking-widest">Square Clients</p>
                <p className="text-3xl font-black text-brand-blue">{clients.length}</p>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="font-black text-gray-950 text-sm uppercase tracking-widest px-1">Recent Roadmaps</h3>
            {allPlansSorted.slice(0, 5).map(plan => (
                <button key={plan.id} onClick={() => { setAdminPlan(plan); setActiveTab('plans'); }} className="w-full bg-white p-5 rounded-[24px] border-4 border-gray-100 flex items-center justify-between group active:scale-95 transition-all shadow-sm">
                    <div className="text-left text-gray-950">
                        <p className="text-xs font-black text-brand-blue uppercase tracking-widest mb-1">{plan.client.name}</p>
                        <p className="text-xl font-black leading-none">${plan.totalCost.toLocaleString()}</p>
                    </div>
                    <ChevronRightIcon className="w-6 h-6 text-gray-200" />
                </button>
            ))}
        </div>
    </div>
  );

  const renderAccount = () => (
    <div className="p-4 flex flex-col h-full bg-gray-50 overflow-y-auto pb-48">
        <h1 className="text-2xl font-black text-brand-blue mb-8 tracking-tighter">Admin Account</h1>
        <div className="bg-white p-8 rounded-[40px] border-4 border-gray-950 shadow-2xl mb-8 relative text-gray-950">
            <div className="w-24 h-24 bg-brand-blue rounded-3xl mx-auto mb-6 flex items-center justify-center text-4xl font-black text-white shadow-xl border-4 border-gray-900">{user?.name?.[0] || 'A'}</div>
            <div className="text-center">
                <h2 className="text-2xl font-black mb-2">{user?.name}</h2>
                <p className="text-xs font-black text-brand-blue uppercase tracking-widest">System Controller</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border-4 border-gray-100 shadow-sm flex items-center justify-between text-gray-950">
            <div>
                <p className="text-[10px] font-black uppercase mb-1 tracking-widest">Square API Connection</p>
                <p className={`font-black text-sm ${integration.squareAccessToken ? 'text-green-600' : 'text-orange-600'}`}>Status: {integration.squareAccessToken ? 'ACTIVE' : 'OFFLINE'}</p>
            </div>
            {integration.squareAccessToken ? <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse border-2 border-green-200"></div> : <DatabaseIcon className="w-6 h-6 text-orange-500" />}
        </div>
        <div className="mt-12 pt-8 border-t-4 border-gray-200">
            <button onClick={logout} className="w-full text-white font-black py-5 bg-red-600 rounded-2xl border-b-8 border-red-900 uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3">
                <TrashIcon className="w-6 h-6" />
                <span>SIGN OUT OF SYSTEM</span>
            </button>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg relative">
      <div className="flex-grow flex flex-col h-screen overflow-hidden">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'plans' && (
             <StylistDashboard 
                client={CURRENT_CLIENT} 
                existingPlan={adminPlan} 
                onPlanChange={setAdminPlan} 
                role="admin"
                initialStep={allPlansSorted.length === 0 ? "select-client" : undefined}
                onLogout={() => setActiveTab('dashboard')}
             />
        )}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'account' && renderAccount()}
      </div>
      <BottomNav role={role} activeTab={activeTab} onNavigate={setActiveTab} />
    </div>
  );
};

export default AdminDashboard;
