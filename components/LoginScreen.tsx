
import React, { useState } from 'react';
import type { UserRole } from '../types';
import { clearSupabaseConfig } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { UsersIcon, CheckCircleIcon, DocumentTextIcon, SettingsIcon, ChevronLeftIcon } from './icons';

interface LoginScreenProps {
  onLogin: (role: UserRole, id?: string) => void;
}

type AppMode = 'landing' | 'professional' | 'client';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [appMode, setAppMode] = useState<AppMode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { clients, stylists } = useSettings();

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
        setIsLoading(false);
        onLogin(appMode === 'professional' ? 'stylist' : 'client'); 
    }, 800);
  };

  if (appMode === 'landing') {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="text-center mb-10">
                <div className="w-20 h-20 bg-brand-blue rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl transform -rotate-3">
                    <span className="text-white font-bold text-4xl">S</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tighter">Salon Service Planner</h1>
                <p className="text-gray-500 mt-2 font-medium">Select your application portal</p>
            </div>

            <div className="w-full max-w-md space-y-4">
                <button 
                    onClick={() => setAppMode('professional')}
                    className="w-full bg-white p-6 rounded-[32px] shadow-lg border-4 border-transparent hover:border-brand-blue transition-all group text-left flex items-center"
                >
                    <div className="bg-brand-blue/10 p-4 rounded-2xl mr-5 group-hover:bg-brand-blue group-hover:text-white transition-colors text-brand-blue">
                        <SettingsIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-950 leading-none">Professional App</h3>
                        <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Stylists & Admins</p>
                    </div>
                </button>

                <button 
                    onClick={() => setAppMode('client')}
                    className="w-full bg-white p-6 rounded-[32px] shadow-lg border-4 border-transparent hover:border-brand-pink transition-all group text-left flex items-center"
                >
                    <div className="bg-brand-pink/10 p-4 rounded-2xl mr-5 group-hover:bg-brand-pink group-hover:text-white transition-colors text-brand-pink">
                        <UsersIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-950 leading-none">Client Portal</h3>
                        <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Customer Roadmaps</p>
                    </div>
                </button>
            </div>
            
            <p className="mt-12 text-gray-400 text-[10px] font-black uppercase tracking-widest">v1.4.0 • Enterprise Core</p>
        </div>
      );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 ${appMode === 'professional' ? 'bg-brand-blue' : 'bg-brand-pink'}`}>
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden relative border-4 border-gray-950">
        
        <button onClick={() => setAppMode('landing')} className="absolute top-6 left-6 text-gray-400 hover:text-gray-800 transition-colors">
            <ChevronLeftIcon className="w-7 h-7" />
        </button>

        <div className="bg-gray-50 p-10 text-center border-b-4 border-gray-100">
            <h1 className={`text-3xl font-black tracking-tighter ${appMode === 'professional' ? 'text-brand-blue' : 'text-brand-pink'}`}>
                {appMode === 'professional' ? 'Pro Access' : 'Client Access'}
            </h1>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-2">
                {appMode === 'professional' ? 'Internal Management' : 'Maintenance Roadmap'}
            </p>
        </div>

        <div className="p-10">
            <form onSubmit={handleFormLogin} className="space-y-4">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Auth Email</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full p-4 border-4 border-gray-100 rounded-2xl focus:border-brand-teal outline-none transition-all bg-gray-50 font-bold"
                    />
                </div>
                
                <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`w-full text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 border-b-8 ${appMode === 'professional' ? 'bg-brand-blue border-blue-900' : 'bg-brand-pink border-pink-900'}`}
                >
                    {isLoading ? "VERIFYING..." : "SECURE LOGIN"}
                </button>
            </form>

            <div className="mt-10 relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                    <span className="px-4 bg-white text-gray-400">Available Profiles</span>
                </div>
            </div>

            <div className="mt-6 space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {appMode === 'professional' ? (
                    <>
                        {stylists.slice(0, 3).map(s => (
                            <button key={s.id} onClick={() => onLogin('stylist', s.id)} className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-50 hover:border-brand-blue transition-all bg-white text-left">
                                <div className="w-10 h-10 rounded-xl bg-brand-blue text-white flex items-center justify-center font-black text-sm">{s.name[0]}</div>
                                <div className="ml-3">
                                    <p className="text-sm font-black text-gray-950 leading-none">{s.name}</p>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{s.role}</p>
                                </div>
                            </button>
                        ))}
                        <button onClick={() => onLogin('admin')} className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-950 bg-gray-950 text-white transition-all text-left">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-sm">A</div>
                            <div className="ml-3">
                                <p className="text-sm font-black leading-none">System Admin</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Full Controller</p>
                            </div>
                        </button>
                    </>
                ) : (
                    <>
                        {clients.slice(0, 5).map(c => (
                            <button key={c.id} onClick={() => onLogin('client', c.id)} className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-50 hover:border-brand-pink transition-all bg-white text-left">
                                <img src={c.avatarUrl} className="w-10 h-10 rounded-xl border-2 border-gray-100" />
                                <div className="ml-3">
                                    <p className="text-sm font-black text-gray-950 leading-none">{c.name}</p>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{c.externalId ? 'Square Sync' : 'Demo Client'}</p>
                                </div>
                            </button>
                        ))}
                    </>
                )}
            </div>
            
             <button onClick={clearSupabaseConfig} className="w-full text-center mt-10 text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-brand-blue transition-colors">
                Reset System Database Config
            </button>

        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
