import React, { useState, useMemo } from 'react';
import type { Client } from '../types';
import { PlusIcon, UsersIcon } from './icons';

interface SelectClientStepProps {
  clients: Client[];
  onSelect: (client: Client) => void;
  onBack: () => void;
}

const SelectClientStep: React.FC<SelectClientStepProps> = ({ clients, onSelect, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = useMemo(() => {
    return clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clients, searchTerm]);

  return (
    <div className="flex flex-col h-full pb-12">
      <div className="p-4 bg-white border-b border-gray-100">
        <div className="w-full h-2 bg-gray-100 mb-4 rounded-full overflow-hidden">
            <div className="h-full bg-brand-teal w-1/5 rounded-full"></div>
        </div>
        <h1 className="text-2xl font-bold text-brand-blue text-center mb-1">Select Client</h1>
        <p className="text-sm text-gray-500 text-center mb-4">Who are we creating a plan for?</p>
        
        <div className="relative">
             <input 
                type="text" 
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-teal outline-none transition-all"
            />
            <div className="absolute left-3 top-3.5 text-gray-400">
                <UsersIcon className="w-5 h-5" />
            </div>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-brand-bg">
        {filteredClients.length === 0 ? (
            <div className="text-center py-10 opacity-50">
                <p>No clients found.</p>
            </div>
        ) : (
            filteredClients.map((client) => (
                <button 
                    key={client.id} 
                    onClick={() => onSelect(client)} 
                    className="w-full bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center hover:border-brand-teal hover:shadow-md transition-all group"
                >
                    <img src={client.avatarUrl} alt={client.name} className="w-12 h-12 rounded-full mr-4 border border-gray-100 group-hover:border-brand-teal" />
                    <div className="flex-grow text-left">
                        <h3 className="font-bold text-gray-900 group-hover:text-brand-teal text-lg">{client.name}</h3>
                        <p className="text-xs text-gray-500">Last seen: 2 weeks ago</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-brand-teal group-hover:text-white transition-colors">
                        <PlusIcon className="w-5 h-5" />
                    </div>
                </button>
            ))
        )}
      </div>

      <div className="p-4 mt-auto bg-white border-t border-gray-200">
        <button onClick={onBack} className="w-full bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-full hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SelectClientStep;
