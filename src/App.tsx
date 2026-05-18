import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { FUEL_PRICES, TOLL_RATES_DEFAULT } from './constants';
import { AuthProvider, useAuth } from './lib/AuthContext';

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
import { DriverRoutesArea } from './components/DriverRoutesArea';
import { CompaniesArea } from './components/CompaniesArea';

function AppContent() {
  const { user, profile, loading: authLoading, logout, login, isMaster } = useAuth();
  const [activeTab, setActiveTab] = useState<'plan' | 'drivers' | 'vehicles' | 'users' | 'reports' | 'clients' | 'simulator' | 'settings' | 'my-routes' | 'companies'>('plan');
  const [reportSubTab, setReportSubTab] = useState<'general' | 'daily' | 'monthly_issuer'>('general');

  const [fuelPrices, setFuelPrices] = useState(FUEL_PRICES);
  const [tollRates, setTollRates] = useState(TOLL_RATES_DEFAULT);

  useEffect(() => {
    if (!profile && !isMaster) return;

    // First try company settings
    const companyId = profile?.companyId;
    if (companyId) {
      const unsubCompany = onSnapshot(doc(db, 'settings', companyId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fuelPrices) setFuelPrices(data.fuelPrices);
          if (data.tollRates) setTollRates(data.tollRates);
        } else {
          // Fallback to global if company-specific don't exist
          const unsubGlobal = onSnapshot(doc(db, 'settings', 'global'), (globalSnap) => {
             if (globalSnap.exists()) {
               const gData = globalSnap.data();
               if (gData.fuelPrices) setFuelPrices(gData.fuelPrices);
               if (gData.tollRates) setTollRates(gData.tollRates);
             }
          });
          return () => unsubGlobal();
        }
      });
      return () => unsubCompany();
    } else if (isMaster) {
      const unsubGlobal = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.fuelPrices) setFuelPrices(data.fuelPrices);
          if (data.tollRates) setTollRates(data.tollRates);
        }
      });
      return () => unsubGlobal();
    }
  }, [profile, isMaster]);

  // Redirect driver to their routes tab by default
  useEffect(() => {
    if (profile?.role === 'driver') {
      setActiveTab('my-routes');
    }
  }, [profile]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-slate-400 animate-pulse">A carregar sistema...</p>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={login} isLoggingIn={false} />;
  }

  // If user is logged in but no profile exists
  if (!profile && !isMaster) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="bg-slate-900 shadow-2xl p-8 rounded-2xl border border-slate-800 text-center max-w-sm">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Conta Pendente</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            A sua conta ainda não tem um perfil associado ou está a aguardar aprovação por um administrador.
          </p>
          <div className="flex flex-col gap-3">
             <button 
               onClick={() => window.location.reload()} 
               className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
             >
               Tentar novamente
             </button>
             <button 
               onClick={logout} 
               className="w-full text-indigo-400 font-bold hover:text-indigo-300 py-2 border-none bg-transparent text-sm"
             >
               Sair da conta
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950">
      <Sidebar 
        user={{
          uid: user.uid,
          username: profile?.username || 'utilizador',
          displayName: profile?.displayName || 'Utilizador',
          role: profile?.role || (isMaster ? 'master' : 'collaborator'),
          companyId: profile?.companyId || 'master'
        } as any} 
        onLogout={logout} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        reportSubTab={reportSubTab} 
        setReportSubTab={setReportSubTab} 
      />
      
      <main className="flex-1 overflow-auto p-4 md:p-8">
        {activeTab === 'plan' && <ManagerDashboard tollRates={tollRates} setActiveTab={setActiveTab} />}
        {activeTab === 'my-routes' && <DriverRoutesArea />}
        {activeTab === 'drivers' && <DriversArea />}
        {activeTab === 'vehicles' && <VehiclesArea />}
        {activeTab === 'clients' && <EmitterClientsArea />}
        {activeTab === 'reports' && <ReportsArea />}
        {activeTab === 'simulator' && <SimulatorArea fuelPrices={fuelPrices} tollRates={tollRates} />}
        {activeTab === 'settings' && <SettingsArea currentFuelPrices={fuelPrices} currentTollRates={tollRates} />}
        {activeTab === 'companies' && isMaster && <CompaniesArea />}
        {activeTab === 'users' && (profile?.role === 'admin' || isMaster) && <UsersManagementArea />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
