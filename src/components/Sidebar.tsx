import React from 'react';
import { 
  MapPin, Truck, User, LogOut, Users, BarChart3, 
  Settings, Calculator, Package, Menu, X, Wifi, WifiOff, Building
} from 'lucide-react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  user: UserProfile;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  reportSubTab: string;
  setReportSubTab: (tab: any) => void;
}

export function Sidebar({ 
  user, onLogout, activeTab, setActiveTab, reportSubTab, setReportSubTab 
}: SidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  let menuItems = [];

  if (user.role === 'driver') {
    menuItems = [
      { id: 'my-routes', label: 'As Minhas Rotas', icon: MapPin, color: 'text-indigo-500' },
      { id: 'settings', label: 'Definições', icon: Settings, color: 'text-gray-400' },
    ];
  } else {
    menuItems = [
      { id: 'plan', label: 'Planeamento', icon: MapPin, color: 'text-blue-500' },
      { id: 'drivers', label: 'Motoristas', icon: User, color: 'text-green-500' },
      { id: 'vehicles', label: 'Veículos', icon: Truck, color: 'text-purple-500' },
      { id: 'clients', label: 'Clientes', icon: Package, color: 'text-orange-500' },
      { id: 'reports', label: 'Relatórios', icon: BarChart3, color: 'text-yellow-500' },
      { id: 'simulator', label: 'Simulador', icon: Calculator, color: 'text-pink-500' },
      { id: 'settings', label: 'Definições', icon: Settings, color: 'text-gray-400' },
    ];

    if (user.role === 'admin' || user.role === 'master') {
      menuItems.splice(4, 0, { id: 'users', label: 'Utilizadores', icon: Users, color: 'text-red-500' });
    }

    if (user.role === 'master') {
      menuItems.splice(1, 0, { id: 'companies', label: 'Empresas', icon: Building, color: 'text-cyan-500' });
    }
  }

  const toggleSidebar = () => setIsOpen(!isOpen);

  const [isOnline, setIsOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-slate-800 rounded-lg text-white"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/50 backdrop-blur-md border-r border-slate-800 flex flex-col transition-transform duration-300 md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">LogiRoute Pro</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group text-sm font-medium",
                activeTab === item.id 
                  ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5",
                activeTab === item.id ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"
              )} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Estado Local</span>
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-emerald-500">
                <span className="text-[10px] font-bold">Online</span>
                <Wifi className="w-3 h-3" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-orange-500">
                <span className="text-[10px] font-bold">Offline</span>
                <WifiOff className="w-3 h-3" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 p-2 bg-slate-800/40 rounded-xl mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
              {(user.displayName || user.username || 'U')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user.displayName || user.username}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{user.role} • @{user.username}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-900/20 hover:text-red-500 text-slate-400 rounded-lg transition-colors text-xs font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>
    </>
  );
}
