import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { onSnapshot, doc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { UserProfile } from './types';
import { FUEL_PRICES, TOLL_RATES_DEFAULT } from './constants';

// Sub-components
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './components/LandingPage';
import { ManagerDashboard } from './components/ManagerDashboard';
import { DriversArea } from './components/DriversArea';
import { VehiclesArea } from './components/VehiclesArea';
import { EmitterClientsArea } from './components/EmitterClientsArea';
import { ReportsArea } from './components/ReportsArea';
import { SimulatorArea } from './components/SimulatorArea';
import { SettingsArea } from './components/SettingsArea';
import { UsersManagementArea } from './components/UsersManagementArea';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'plan' | 'drivers' | 'vehicles' | 'users' | 'reports' | 'clients' | 'simulator' | 'settings'>('plan');
  const [reportSubTab, setReportSubTab] = useState<'general' | 'daily' | 'monthly_issuer'>('general');

  const [fuelPrices, setFuelPrices] = useState(FUEL_PRICES);
  const [tollRates, setTollRates] = useState(TOLL_RATES_DEFAULT);

  useEffect(() => {
    // Attempt local storage recovery (simple persistence for this demo)
    const savedUser = localStorage.getItem('fleetflow_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }
    setLoading(false);

    // Watch for global settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.fuelPrices) setFuelPrices(data.fuelPrices);
        if (data.tollRates) setTollRates(data.tollRates);
      }
    });

    return () => unsubSettings();
  }, []);

  const handleLogin = async (username: string, pass: string) => {
    setIsLoggingIn(true);
    try {
      // Master login bypass for development/setup
      if (username.trim().toLowerCase() === 'master' && pass === '4049') {
        const masterUser = { uid: 'master-id', username: 'Master', displayName: 'Administrador Master', role: 'master' as const };
        setUser(masterUser);
        localStorage.setItem('fleetflow_user', JSON.stringify(masterUser));
        return;
      }

      // Standard Firestore user check
      const q = query(collection(db, 'users'), where('username', '==', username), where('password', '==', pass));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserProfile;
        setUser(userData);
        localStorage.setItem('fleetflow_user', JSON.stringify(userData));
      } else {
        alert('Credenciais inválidas! Tente master/4049 para primeira configuração.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de ligação ao sistema. Verifique a configuração do Firebase.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('fleetflow_user');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-slate-400 animate-pulse">A carregar sistema...</p>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} isLoggingIn={isLoggingIn} />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950">
      <Sidebar 
        user={user} 
        onLogout={handleLogout} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        reportSubTab={reportSubTab} 
        setReportSubTab={setReportSubTab} 
      />
      
      <main className="flex-1 overflow-auto p-4 md:p-8">
        {activeTab === 'plan' && <ManagerDashboard tollRates={tollRates} setActiveTab={setActiveTab} />}
        {activeTab === 'drivers' && <DriversArea userRole={user.role} />}
        {activeTab === 'vehicles' && <VehiclesArea userRole={user.role} />}
        {activeTab === 'clients' && <EmitterClientsArea />}
        {activeTab === 'reports' && <ReportsArea subTab={reportSubTab} fuelPrices={fuelPrices} tollRates={tollRates} />}
        {activeTab === 'simulator' && <SimulatorArea fuelPrices={fuelPrices} tollRates={tollRates} />}
        {activeTab === 'settings' && <SettingsArea currentFuelPrices={fuelPrices} currentTollRates={tollRates} />}
        {activeTab === 'users' && user.role === 'master' && <UsersManagementArea />}
      </main>
    </div>
  );
}
