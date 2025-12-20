
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { GeneratedPlan } from '../types';

interface PlanContextType {
    plans: GeneratedPlan[];
    savePlan: (plan: GeneratedPlan) => void;
    getPlanForClient: (clientId: string) => GeneratedPlan | null; // Gets latest
    getClientHistory: (clientId: string) => GeneratedPlan[]; // Gets all
    getStats: () => { totalRevenue: number, activePlansCount: number };
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const PlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [plans, setPlans] = useState<GeneratedPlan[]>(() => {
        try {
            const saved = localStorage.getItem('app_plans');
            // Parse dates back to Date objects
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.map((p: any) => ({
                    ...p,
                    appointments: p.appointments.map((a: any) => ({
                        ...a,
                        date: new Date(a.date)
                    }))
                }));
            }
            return [];
        } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem('app_plans', JSON.stringify(plans));
    }, [plans]);

    const savePlan = (newPlan: GeneratedPlan) => {
        setPlans(prev => {
            // Update if ID exists, otherwise add new. Do NOT delete other plans for this client.
            const existingIndex = prev.findIndex(p => p.id === newPlan.id);
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = newPlan;
                return updated;
            }
            return [...prev, newPlan];
        });
    };

    // Get the most recent plan for a client
    const getPlanForClient = (clientId: string) => {
        const clientPlans = plans.filter(p => p.client.id === clientId);
        if (clientPlans.length === 0) return null;
        // Sort by createdAt desc
        return clientPlans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    };
    
    // Get all plans for a client
    const getClientHistory = (clientId: string) => {
        return plans
            .filter(p => p.client.id === clientId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    };
    
    const getStats = () => {
        // Calculate revenue only from Approved plans
        const approvedPlans = plans.filter(p => p.status === 'active');
        const totalRevenue = approvedPlans.reduce((sum, p) => sum + p.totalCost, 0);
        return {
            totalRevenue,
            activePlansCount: approvedPlans.length
        };
    };

    return (
        <PlanContext.Provider value={{ plans, savePlan, getPlanForClient, getClientHistory, getStats }}>
            {children}
        </PlanContext.Provider>
    );
};

export const usePlans = () => {
    const context = useContext(PlanContext);
    if (!context) {
        throw new Error("usePlans must be used within a PlanProvider");
    }
    return context;
};
